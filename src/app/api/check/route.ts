/**
 * Bước 3 — AI kiểm tra.
 *
 * Route này CHỈ trả về quan sát: 4 landmark + 6 tiêu chí thị giác. Không có kết
 * luận đạt/trượt nào ở đây, và cố ý không nhận `docIds`.
 *
 * Lý do: tỉ lệ đầu và độ phân giải suy được từ landmark bằng số học, còn mức khắt
 * khe khi kết luận thì tuỳ tập giấy tờ người dùng chọn — mà tập đó còn đổi ở màn
 * Xuất ảnh. Tính kết luận ở đây là buộc mỗi lần tick thêm một loại phải gọi lại
 * model. `evaluate` ở lib/checks.ts làm việc đó ở client, tức thì và miễn phí.
 */

import { analyzePhoto } from "@/lib/gemini";
import { decodeDataUrl } from "@/lib/imageio";
import { imageSize } from "@/lib/render";
import type { PhotoCheck } from "@/lib/checks";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { photo?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body phải là JSON." }, { status: 400 });
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

    const result: PhotoCheck = {
      landmarks: lm,
      imageWidth: width,
      imageHeight: height,
      checks: analysis.checks.map((c) => ({
        id: c.id,
        pass: c.pass,
        detail: c.detail,
      })),
    };

    return Response.json(result);
  } catch (e) {
    console.error("[api/check]", e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
