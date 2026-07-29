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
import { decodeDataUrl } from "@/lib/imageio";
import {
  newSessionId,
  ownsKey,
  readObject,
  storeImage,
  usingObjectStore,
  type StoredImage,
} from "@/lib/storage";
import { imageSize } from "@/lib/render";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";

import {
  checkGate,
  checkSize,
  isGateFailure,
  remainingFor,
  withClientCookie,
} from "@/lib/gate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  // Trần dung lượng TRƯỚC khi đọc body — xem lib/gate.ts.
  const tooBig = checkSize(request);
  if (tooBig) return tooBig.response;

  let body: {
    /** Khoá object của ảnh đang chỉnh — đường CHÍNH khi đã có kho ảnh */
    key?: string;
    /** Ảnh dạng data URL — chỉ dùng khi chưa cấu hình kho (dev) */
    photo?: string;
    note?: string;
    upscale?: boolean;
    sessionId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  /*
   * Lấy bytes ảnh đang chỉnh. Ưu tiên KHOÁ: client cầm link ký có hạn chứ không
   * cầm bytes, và khoá thì kiểm được chủ sở hữu — nhận URL rồi tự fetch là mở
   * cửa SSRF, còn bắt client tải về rồi gửi lại base64 là đội mấy MB mỗi lượt.
   *
   * Đọc clientId bằng `remainingFor` (KHÔNG trừ lượt) trước khi `checkGate`:
   * trừ tiền cho một yêu cầu sai đầu vào là tính phí việc mình chưa làm.
   */
  const { clientId } = await remainingFor(request);
  let image: { buffer: Buffer; mimeType: string };
  try {
    if (typeof body.key === "string" && body.key) {
      if (!usingObjectStore || !ownsKey(clientId, body.key)) {
        return Response.json({ error: "Không tìm thấy ảnh." }, { status: 404 });
      }
      image = { buffer: await readObject(body.key), mimeType: "image/jpeg" };
    } else {
      image = decodeDataUrl(body.photo);
    }
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

  const gate = await checkGate(request, 1);
  if (isGateFailure(gate)) return gate.response;

  try {
    // Giữ đúng khung của ảnh đang chỉnh — đổi khung là đổi bố cục.
    const size = await imageSize(image.buffer);
    const out = await stylize({
      image: { data: image.buffer.toString("base64"), mimeType: image.mimeType },
      prompt: buildRefinePrompt(note, upscale),
      aspectRatio: nearestAspectRatio(size.width, size.height),
      imageSize: upscale ? "2K" : undefined,
    });
    const sessionId =
      typeof body.sessionId === "string" && /^[a-f0-9]{16}$/.test(body.sessionId)
        ? body.sessionId
        : newSessionId();
    const stored: StoredImage = await storeImage({
      clientId: gate.clientId,
      sessionId,
      name: `sua-${Date.now()}`,
      buffer: Buffer.from(out.data, "base64"),
    });
    return withClientCookie(
      NextResponse.json({ image: stored, sessionId }),
      request,
      gate.clientId
    );
  } catch (e) {
    return errorResponse("api/refine", e);
  }
}
