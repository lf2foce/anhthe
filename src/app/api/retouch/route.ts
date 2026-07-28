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
  FLAT_FILL_LIMIT,
  extendToFit,
  type FaceLandmarks,
} from "@/lib/geometry";
import { sharpExtend } from "@/lib/render";
import { NextResponse } from "next/server";

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

  // Lọc theo họ: ảnh giấy tờ tuỳ thân không mở vest / làm đẹp / upscale sinh ảnh.
  const applied = sanitizeRetouch(spec, body);

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
      const plan = extendToFit(
        body.landmarks,
        src.width,
        src.height,
        [spec]
      );
      if (plan.growth > EXTEND_LIMIT) {
        return Response.json(
          {
            error:
              "Ảnh chụp quá sát, thiếu quá nhiều khoảng trống quanh đầu để dựng đúng khung. Chụp lùi ra xa hơn giúp nhé.",
            code: "TOO_TIGHT",
          },
          { status: 422 }
        );
      }
      if (plan.growth > FLAT_FILL_LIMIT) {
        input = await sharpExtend(image.buffer, plan.pad, bgHex(background));
        inputSize = { width: plan.width, height: plan.height };
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
    console.error("[api/retouch]", e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
