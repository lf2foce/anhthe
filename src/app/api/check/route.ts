/**
 * Bước 3 — AI kiểm tra.
 *
 * Model thị giác trả về landmark + 6 tiêu chí quan sát; 2 tiêu chí còn lại
 * (tỉ lệ đầu, độ phân giải) tính bằng số học ở đây cho từng loại giấy tờ đã
 * chọn, vì cùng một khuôn mặt có thể đạt chuẩn 3×4 mà trượt chuẩn visa Mỹ.
 */

import { computeCrop, resolutionCheck } from "@/lib/geometry";
import { getDoc, outputSize } from "@/lib/docs";
import { analyzePhoto } from "@/lib/gemini";
import { decodeDataUrl } from "@/lib/imageio";
import { imageSize } from "@/lib/render";
import {
  CHECK_ORDER,
  FIXABLE,
  verdictOf,
  type CheckItem,
  type CheckResult,
  type DocFit,
} from "@/lib/checks";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { photo?: string; docIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  const docIds = Array.isArray(body.docIds) ? body.docIds : [];
  const specs = docIds.map(getDoc).filter((d) => d !== undefined);
  if (specs.length === 0) {
    return Response.json(
      { error: "Chưa chọn loại giấy tờ nào hợp lệ." },
      { status: 400 }
    );
  }

  let image;
  try {
    image = decodeDataUrl(body.photo);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }

  try {
    const { width, height } = await imageSize(image.buffer);
    const analysis = await analyzePhoto({
      data: image.base64,
      mimeType: image.mimeType,
    });

    if (!analysis.faceFound) {
      return Response.json(
        { error: "Không tìm thấy khuôn mặt rõ ràng trong ảnh." },
        { status: 422 }
      );
    }

    const lm = analysis.landmarks;
    if (!(lm.chinY > lm.crownY)) {
      return Response.json(
        { error: "Không đo được khuôn mặt — thử chụp lại gần và rõ hơn." },
        { status: 422 }
      );
    }

    // Hình học cho từng loại giấy tờ đã chọn
    const fits: DocFit[] = specs.map((spec) => {
      const { crop, headRatio, eyeFromBottom, errors } = computeCrop(
        lm,
        width,
        height,
        spec
      );
      const target = outputSize(spec, spec.digital ? "digital" : "print");
      const { ok } = resolutionCheck(crop, spec, target);
      return {
        docId: spec.id,
        headRatio,
        eyeFromBottom,
        resolutionOk: ok,
        errors,
      };
    });

    const geometryFails = fits.filter((f) => f.errors.length > 0);
    const resolutionFails = fits.filter((f) => !f.resolutionOk);

    const computed: CheckItem[] = [
      {
        id: "head_ratio",
        pass: geometryFails.length === 0,
        detail: geometryFails
          .map((f) => `${getDoc(f.docId)?.vi}: ${f.errors[0]}`)
          .join(" "),
        fixable: FIXABLE.has("head_ratio"),
      },
      {
        id: "resolution",
        pass: resolutionFails.length === 0,
        detail: resolutionFails.length
          ? `Thiếu điểm ảnh cho: ${resolutionFails
              .map((f) => getDoc(f.docId)?.vi)
              .join(", ")}. Ảnh sẽ bị phóng to và mất nét.`
          : "",
        fixable: FIXABLE.has("resolution"),
      },
    ];

    const byId = new Map<string, CheckItem>();
    for (const c of analysis.checks) {
      byId.set(c.id, { ...c, fixable: FIXABLE.has(c.id) });
    }
    for (const c of computed) byId.set(c.id, c);

    const checks = CHECK_ORDER.map((id) => byId.get(id)).filter(
      (c) => c !== undefined
    );

    const result: CheckResult = {
      landmarks: lm,
      imageWidth: width,
      imageHeight: height,
      checks,
      fits,
      verdict: verdictOf(checks),
    };

    return Response.json(result);
  } catch (e) {
    console.error("[api/check]", e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
