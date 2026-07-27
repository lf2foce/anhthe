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
import { decodeDataUrl, toDataUrl } from "@/lib/imageio";

export const runtime = "nodejs";
export const maxDuration = 180;

/** Trần biến thể một lần gọi — mỗi biến thể là một lần gọi model trả phí */
const MAX_VARIANTS = 4;

export interface GenerateResponse {
  packId: string;
  images: string[];
}

export async function POST(request: Request) {
  let body: {
    photo?: string;
    packId?: string;
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

  const count = Math.min(
    MAX_VARIANTS,
    Math.max(1, Math.round(typeof body.count === "number" ? body.count : 2))
  );
  const note =
    typeof body.note === "string" ? body.note.slice(0, MAX_NOTE_LENGTH) : "";
  const aspectRatio = isAspectChoice(body.aspectRatio)
    ? body.aspectRatio
    : pack.aspectRatio;
  const imageSize = body.quality === "high" ? "2K" : undefined;

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

    const images = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => toDataUrl(r.value.data, r.value.mimeType));

    if (images.length === 0) {
      const first = results.find((r) => r.status === "rejected");
      throw first && "reason" in first
        ? (first.reason as Error)
        : new Error("Không sinh được ảnh nào.");
    }

    const res: GenerateResponse = { packId: pack.id, images };
    return Response.json(res);
  } catch (e) {
    console.error("[api/generate]", e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
