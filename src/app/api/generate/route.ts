/**
 * Studio sáng tạo — sinh ảnh theo phong cách.
 *
 * Luồng này TÁCH HẲN luồng ảnh thẻ: không compliance, không landmark, không crop.
 * Model vẽ lại toàn bộ (trang phục, bối cảnh, ánh sáng); sàn duy nhất là danh tính
 * — nằm trong prompt do lib/packs.ts dựng, có test riêng.
 *
 * Mỗi biến thể là một lần gọi model độc lập với gợi ý góc máy khác nhau, chạy song
 * song. Một biến thể lỗi không kéo cả lô chết: trả về những ảnh đã thành công.
 */

import { stylize } from "@/lib/gemini";
import {
  MAX_NOTE_LENGTH,
  buildPackPrompt,
  getPack,
  isAspectChoice,
} from "@/lib/packs";
import { decodeDataUrl } from "@/lib/imageio";
import { newSessionId, storeImage, type StoredImage } from "@/lib/storage";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";

import {
  checkGate,
  checkSize,
  isGateFailure,
  withClientCookie,
} from "@/lib/gate";

export const runtime = "nodejs";
// Đo thật: count=2 thường 9,6s, count=2 ở 2K 14,1s (các biến thể chạy song
// song nên không cộng dồn). 180 là con số tự đặt cho an toàn và nó nói dối người
// đọc — hạ về 60 cho khớp thực tế và khớp trần Vercel Hobby.
export const maxDuration = 60;

/** Trần biến thể một lần gọi — mỗi biến thể là một lần gọi model trả phí */
const MAX_VARIANTS = 4;

/**
 * Ở 2K thì mỗi ảnh nặng ~1,1MB base64 (đã đo). Bốn ảnh là ~4,4MB — sát trần
 * response 4,5MB của Vercel, tức lượt đắt nhất cũng là lượt dễ vỡ nhất. Hạ trần
 * riêng cho 2K: vừa giữ payload trong ngưỡng, vừa chặn một lượt đốt 4 lần gọi
 * model đắt nhất.
 */
const MAX_VARIANTS_HI = 2;

export interface GenerateResponse {
  packId: string;
  /** Id phiên — client gửi lại ở lượt sau để ảnh cùng một phiên nằm chung thư mục */
  sessionId: string;
  images: StoredImage[];
}

export async function POST(request: Request) {
  // Trần dung lượng TRƯỚC khi đọc body — xem lib/gate.ts.
  const tooBig = checkSize(request);
  if (tooBig) return tooBig.response;

  let body: {
    photo?: string;
    packId?: string;
    sessionId?: string;
    count?: number;
    /** Ghi chú tự do của người dùng — cắt ở MAX_NOTE_LENGTH, chèn trước sàn danh tính */
    note?: string;
    aspectRatio?: string;
    /** "high" = sinh ở 2K — chậm và đắt hơn, người dùng chủ động chọn */
    quality?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  const pack = getPack(body.packId ?? "");
  if (!pack) {
    return Response.json(
      { error: "Phong cách không có trong danh mục." },
      { status: 400 }
    );
  }

  let image;
  try {
    image = decodeDataUrl(body.photo);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }

  const hiRes = body.quality === "high";
  const count = Math.min(
    hiRes ? MAX_VARIANTS_HI : MAX_VARIANTS,
    Math.max(1, Math.round(typeof body.count === "number" ? body.count : 2))
  );
  const note =
    typeof body.note === "string" ? body.note.slice(0, MAX_NOTE_LENGTH) : "";
  const aspectRatio = isAspectChoice(body.aspectRatio)
    ? body.aspectRatio
    : pack.aspectRatio;
  const imageSize = hiRes ? "2K" : undefined;

  // Chốt chi phí SAU khi biết `count` (mỗi biến thể = 1 lần gọi model) nhưng
  // TRƯỚC khi gọi. Trừ trước, không trừ sau khi thành công — xem lib/gate.ts.
  const gate = await checkGate(request, count);
  if (isGateFailure(gate)) return gate.response;

  const sessionId =
    typeof body.sessionId === "string" && /^[a-f0-9]{16}$/.test(body.sessionId)
      ? body.sessionId
      : newSessionId();

  try {
    const results = await Promise.allSettled(
      Array.from({ length: count }, (_, i) =>
        stylize({
          image: { data: image.base64, mimeType: image.mimeType },
          prompt: buildPackPrompt(pack, i, note),
          aspectRatio,
          imageSize,
        })
      )
    );

    const ok = results.filter((r) => r.status === "fulfilled");

    // Cất ảnh ra object storage rồi trả URL. Trả base64 thì vừa đụng trần
    // response của nền tảng, vừa bốc hơi khi khách F5.
    const stamp = Date.now();
    const images: StoredImage[] = await Promise.all(
      ok.map((r, i) =>
        storeImage({
          clientId: gate.clientId,
          sessionId,
          name: `${pack.id}-${stamp}-${i}`,
          buffer: Buffer.from(r.value.data, "base64"),
        })
      )
    );

    if (images.length === 0) {
      const first = results.find((r) => r.status === "rejected");
      throw first && "reason" in first
        ? (first.reason as Error)
        : new Error("Không sinh được ảnh nào.");
    }

    const res: GenerateResponse = { packId: pack.id, sessionId, images };
    return withClientCookie(NextResponse.json(res), request, gate.clientId);
  } catch (e) {
    return errorResponse("api/generate", e);
  }
}
