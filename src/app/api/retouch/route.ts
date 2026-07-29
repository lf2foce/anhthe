/**
 * Bước 4 — thay nền (và với ảnh chân dung: đổi áo, làm đẹp, sinh lại ở 2K).
 *
 * Model được yêu cầu giữ nguyên khung và vị trí người, nhưng đó là yêu cầu chứ
 * không phải bảo đảm: bản trả về có thể lệch vài phần trăm. Vì crop ở bước xuất
 * dựa hoàn toàn vào landmark, ở đây ĐO LẠI landmark trên chính ảnh vừa sinh —
 * dùng lại landmark của ảnh gốc là cách chắc chắn nhất để cắt trượt đầu.
 *
 * Route nhận `docId` chứ không nhận "chế độ": họ giấy tờ suy ra từ registry ở
 * server, nên client không thể gửi cờ để mở vest cho ảnh visa.
 */

import { analyzePhoto, retouch } from "@/lib/gemini";
import {
  bgHex,
  getDoc,
  isBackgroundId,
  sanitizeRetouch,
  type BackgroundId,
  type OutfitId,
} from "@/lib/docs";
import { decodeDataUrl, toDataUrl } from "@/lib/imageio";
import {
  BACKGROUND_TOLERANCE,
  backgroundDeviation,
  imageSize,
} from "@/lib/render";
import {
  EXTEND_LIMIT,
  extendToFit,
  needsBodyFill,
  type FaceLandmarks,
} from "@/lib/geometry";
import { sharpExtend } from "@/lib/render";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";

import {
  checkGate,
  checkSize,
  isGateFailure,
  withClientCookie,
} from "@/lib/gate";

export const runtime = "nodejs";
export const maxDuration = 60;

export interface RetouchResponse {
  photo: string;
  landmarks: FaceLandmarks;
  width: number;
  height: number;
  /** Nền đã ĐÚNG màu chuẩn chưa — đo bằng số học, không tin lời model */
  backgroundOk: boolean;
  /** Lệch tối đa trên một kênh (0–255) so với nền chuẩn */
  backgroundDeviation: number;
  /** Tuỳ chọn THẬT SỰ được áp dụng sau khi lọc theo họ giấy tờ */
  applied: { outfit: OutfitId; polish: boolean; hiRes: boolean };
}

export async function POST(request: Request) {
  // Trần dung lượng TRƯỚC khi đọc body — xem lib/gate.ts.
  const tooBig = checkSize(request);
  if (tooBig) return tooBig.response;

  let body: {
    photo?: string;
    docId?: string;
    /** Landmark đo ở bước kiểm tra — cần để biết phải nới khung bao nhiêu */
    landmarks?: FaceLandmarks;
    /** Cỡ đầu đang chọn (1 = target). Quyết định khung rộng bao nhiêu. */
    headScale?: number;
    /** Mọi loại dùng chung nền này — khung dựng theo HỢP của các khổ */
    docIds?: string[];
    background?: BackgroundId;
    smooth?: boolean;
    evenLighting?: boolean;
    outfit?: OutfitId;
    polish?: boolean;
    hiRes?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  const spec = getDoc(body.docId ?? "");
  if (!spec) {
    return Response.json(
      { error: "Thiếu loại giấy tờ — không biết được phép sửa những gì." },
      { status: 400 }
    );
  }

  // Nền phải nằm trong danh mục đóng, và phải là nền spec CHO PHÉP.
  const background: BackgroundId = isBackgroundId(body.background)
    ? body.background
    : spec.backgrounds[0];
  if (!spec.backgrounds.includes(background)) {
    return Response.json(
      { error: `"${spec.vi}" không cho phép nền này.` },
      { status: 400 }
    );
  }

  /*
   * Lọc theo TOÀN NHÓM, không theo mỗi loại chính.
   *
   * Tấm ảnh này sẽ được dùng chung cho mọi loại trong `docIds`. Lọc theo loại
   * chính thôi thì khách tick 3×4 (được mặc vest) cùng Visa Mỹ (cấm chỉnh sửa),
   * hai loại cùng nền trắng, và tấm ảnh mặc vest đi thẳng vào hồ sơ visa. Đã
   * dựng lại được ca đó trước khi sửa.
   */
  const groupSpecs = (Array.isArray(body.docIds) ? body.docIds : [])
    .map((id) => getDoc(String(id)))
    .filter((d): d is NonNullable<ReturnType<typeof getDoc>> => !!d);
  const applied = sanitizeRetouch(spec, body, groupSpecs);

  // 2 lượt: một lần sinh ảnh, một lần chấm lại landmark trên ảnh vừa sinh.
  const gate = await checkGate(request, 2);
  if (isGateFailure(gate)) return gate.response;

  let image;
  try {
    image = decodeDataUrl(body.photo);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }

  try {
    const src = await imageSize(image.buffer);

    /*
     * Nới khung TRƯỚC khi gửi model, không phải sau.
     *
     * Ảnh chụp gần hơn khung giấy tờ thì lấp nền phẳng cho ra vai cụt giữa không
     * trung — nối được nền nhưng không nối được người. Nới trước rồi bảo model vẽ
     * tiếp thân vào phần trống thì nó liền mạch, và vẫn chỉ tốn ĐÚNG một lần gọi
     * model như cũ.
     *
     * Nới ít thì khỏi phiền model: dải thêm vào chỉ là nền, mắt không thấy.
     */
    let input = image.buffer;
    let inputSize = src;
    let fillMargins = false;

    if (body.landmarks) {
      /*
       * Nới theo CỠ ĐẦU ĐANG CHỌN, không theo target của spec.
       *
       * Khung rộng bao nhiêu tỉ lệ nghịch với cỡ đầu: kéo đầu từ 70% xuống 62% là
       * khung rộng thêm 13%, tức cần vẽ thêm chừng đó thân. Bản trước bỏ qua tham
       * số này nên luôn dựng theo target — người kéo nhỏ đầu rồi bấm chuẩn hoá lại
       * vẫn nhận đúng phần nới cũ, và phần thiếu bị lấp phẳng ở bước xuất: vai cụt
       * ngang giữa nền.
       *
       * Kẹp cùng dải với thanh trượt và với /api/export — ba nơi phải cùng một khung.
       */
      const headScale = Math.min(
        1.15,
        Math.max(0.85, Number(body.headScale) || 1)
      );

      /*
       * Khung dựng theo HỢP của MỌI khổ dùng chung nền này, không riêng loại chính.
       *
       * Một nền = một lần gọi model; các loại thêm sau lấy CHUNG ảnh này. Dựng
       * riêng cho loại chính thì khổ cao hơn (4×6 cạnh 3×4) thiếu thân dưới, và
       * phần thiếu bị lấp phẳng lúc xuất — không phải lỗi của riêng khổ nào, lỗi
       * ở chỗ dựng khung không nhìn hết danh sách.
       *
       * Registry quyết loại nào được vào hợp: cùng họ và cho phép nền này. Loại
       * nào MỘT MÌNH đã đòi nới quá EXTEND_LIMIT thì loại khỏi hợp thay vì chặn
       * cả lượt — nó sẽ tự nổ cảnh báo hình học ở bước xuất.
       */
      const lm = body.landmarks;
      const frameSpecs = [
        spec,
        ...(Array.isArray(body.docIds) ? body.docIds : [])
          .map((id) => getDoc(String(id)))
          .filter(
            (d): d is NonNullable<ReturnType<typeof getDoc>> =>
              !!d &&
              d.id !== spec.id &&
              d.family === spec.family &&
              d.backgrounds.includes(background)
          ),
      ].filter(
        (d) =>
          extendToFit(lm, src.width, src.height, [d], {
            [spec.id]: headScale,
          }).growth <= EXTEND_LIMIT
      );

      // Loại CHÍNH mà đã quá giới hạn thì không cứu được — báo chụp lại như cũ.
      if (!frameSpecs.some((d) => d.id === spec.id)) {
        return Response.json(
          {
            error:
              "Ảnh chụp quá sát, thiếu quá nhiều khoảng trống quanh đầu để dựng đúng khung. Chụp lùi ra xa hơn giúp nhé.",
            code: "TOO_TIGHT",
          },
          { status: 422 }
        );
      }

      const plan = extendToFit(lm, src.width, src.height, frameSpecs, {
        [spec.id]: headScale,
      });
      if (needsBodyFill(plan)) {
        /*
         * Nới DƯ mép dưới, không nới vừa khít.
         *
         * Landmark được đo LẠI trên ảnh model trả về, và model luôn xê dịch người
         * vài phần trăm — nới vừa khít thì sau khi đo lại vẫn thiếu một dải đáy
         * (đo thật: xin 9%, về vẫn hụt 3%), và dải đó bị lấp phẳng ở bước xuất:
         * đường cắt trắng đè lên áo. Nới dư thì phần model vẽ thừa chỉ bị crop bỏ
         * — vô hại, còn phần hụt là vết cắt giữa ngực. Hai rủi ro không đối xứng.
         *
         * Chỉ dư mép DƯỚI: ba mép kia là nền, hụt thì lấp phẳng vô hình.
         */
        const pad = {
          ...plan.pad,
          bottom:
            plan.pad.bottom > 0
              ? Math.ceil(plan.pad.bottom * 1.4 + src.height * 0.04)
              : 0,
        };
        input = await sharpExtend(image.buffer, pad, bgHex(background));
        inputSize = {
          width: src.width + pad.left + pad.right,
          height: src.height + pad.top + pad.bottom,
        };
        fillMargins = true;
      }
    }

    const edited = await retouch({
      image: {
        data: input.toString("base64"),
        mimeType: fillMargins ? "image/jpeg" : image.mimeType,
      },
      width: inputSize.width,
      height: inputSize.height,
      backgroundHex: bgHex(background),
      smooth: !!body.smooth,
      evenLighting: !!body.evenLighting,
      fillMargins,
      // Khoá mặt theo HỌ giấy tờ, không theo cờ nào client gửi.
      strictFace: spec.family === "id",
      ...applied,
    });

    const out = decodeDataUrl(toDataUrl(edited.data, edited.mimeType));
    const size = await imageSize(out.buffer);

    const analysis = await analyzePhoto({
      data: edited.data,
      mimeType: edited.mimeType,
    });
    if (!analysis.faceFound || !(analysis.landmarks.chinY > analysis.landmarks.crownY)) {
      return Response.json(
        {
          error:
            "Bản sửa nền không đo lại được khuôn mặt. Thử lại hoặc chụp lại ảnh gốc.",
        },
        { status: 422 }
      );
    }

    // Model được YÊU CẦU thay nền, nhưng nó có thể trả về ảnh gần như nguyên bản
    // mà vẫn "thành công". Đo lại nền ở đây, nếu không thì UI báo "đã thay nền"
    // trong khi nền cũ còn nguyên — và người dùng chỉ biết khi bị trả ở quầy.
    // Landmark ở đây đã đo trên chính ảnh vừa sinh, nên chinY dùng được trực tiếp.
    const deviation = await backgroundDeviation(out.buffer, bgHex(background), {
      chinFraction: analysis.landmarks.chinY,
    });

    const res: RetouchResponse = {
      photo: toDataUrl(edited.data, edited.mimeType),
      landmarks: analysis.landmarks,
      width: size.width,
      height: size.height,
      backgroundOk: deviation <= BACKGROUND_TOLERANCE,
      backgroundDeviation: deviation,
      applied,
    };
    return withClientCookie(NextResponse.json(res), request, gate.clientId);
  } catch (e) {
    return errorResponse("api/retouch", e);
  }
}
