/**
 * Bước 4 — thay nền bằng model sinh ảnh.
 *
 * Model được yêu cầu giữ nguyên khung và vị trí người, nhưng đó là yêu cầu chứ
 * không phải bảo đảm: bản trả về có thể lệch vài phần trăm. Vì crop ở bước xuất
 * dựa hoàn toàn vào landmark, ở đây ĐO LẠI landmark trên chính ảnh vừa sinh —
 * dùng lại landmark của ảnh gốc là cách chắc chắn nhất để cắt trượt đầu.
 */

import { analyzePhoto, retouch } from "@/lib/gemini";
import { bgHex, type BackgroundId } from "@/lib/docs";
import { decodeDataUrl, toDataUrl } from "@/lib/imageio";
import { imageSize } from "@/lib/render";
import type { FaceLandmarks } from "@/lib/geometry";

export const runtime = "nodejs";
export const maxDuration = 120;

export interface RetouchResponse {
  photo: string;
  landmarks: FaceLandmarks;
  width: number;
  height: number;
}

export async function POST(request: Request) {
  let body: {
    photo?: string;
    background?: BackgroundId;
    smooth?: boolean;
    evenLighting?: boolean;
  };
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
    const src = await imageSize(image.buffer);

    const edited = await retouch({
      image: { data: image.base64, mimeType: image.mimeType },
      width: src.width,
      height: src.height,
      backgroundHex: bgHex(body.background ?? "white"),
      smooth: !!body.smooth,
      evenLighting: !!body.evenLighting,
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

    const res: RetouchResponse = {
      photo: toDataUrl(edited.data, edited.mimeType),
      landmarks: analysis.landmarks,
      width: size.width,
      height: size.height,
    };
    return Response.json(res);
  } catch (e) {
    console.error("[api/retouch]", e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
