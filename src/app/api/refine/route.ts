/**
 * Studio sáng tạo — vòng LẶP trên một ảnh đã sinh.
 *
 * Nhận ảnh KẾT QUẢ (không phải ảnh gốc) + ghi chú, trả về một ảnh chỉnh lại; hoặc
 * `upscale` để vẽ lại ở 2K. Nhờ vậy luồng không dừng ở "up mặt phát ra 2 ảnh" —
 * ảnh nào cũng chỉnh tiếp được tới khi ưng, mỗi lượt một lần gọi model.
 *
 * Sàn danh tính vẫn nằm trong prompt (lib/packs.ts) — chỉnh bao nhiêu vòng thì
 * ảnh vẫn phải là người đó.
 */

import { nearestAspectRatio, stylize } from "@/lib/gemini";
import { MAX_NOTE_LENGTH, buildRefinePrompt } from "@/lib/packs";
import { decodeDataUrl, toDataUrl } from "@/lib/imageio";
import { imageSize } from "@/lib/render";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  let body: { photo?: string; note?: string; upscale?: boolean };
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

  const note =
    typeof body.note === "string" ? body.note.slice(0, MAX_NOTE_LENGTH) : "";
  const upscale = !!body.upscale;
  if (!note.trim() && !upscale) {
    return Response.json(
      { error: "Cần ghi chú chỉnh sửa hoặc chọn nâng độ phân giải." },
      { status: 400 }
    );
  }

  try {
    // Giữ đúng khung của ảnh đang chỉnh — đổi khung là đổi bố cục.
    const size = await imageSize(image.buffer);
    const out = await stylize({
      image: { data: image.base64, mimeType: image.mimeType },
      prompt: buildRefinePrompt(note, upscale),
      aspectRatio: nearestAspectRatio(size.width, size.height),
      imageSize: upscale ? "2K" : undefined,
    });
    return Response.json({ image: toDataUrl(out.data, out.mimeType) });
  } catch (e) {
    console.error("[api/refine]", e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
