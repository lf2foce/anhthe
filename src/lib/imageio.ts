/**
 * Chuyển đổi giữa data URL (client giữ ảnh dạng này) và Buffer (server xử lý).
 *
 * Ảnh chuẩn của cả luồng là JPEG dựng từ <canvas> ở client: đã xoay đúng chiều,
 * không còn EXIF. Nhờ vậy toạ độ landmark đo được ở bước kiểm tra vẫn khớp pixel
 * khi crop ở bước xuất — server không được xoay hay đổi kích thước ảnh gốc.
 */

export interface DecodedImage {
  buffer: Buffer;
  mimeType: string;
  /** base64 thuần, không có tiền tố */
  base64: string;
}

const DATA_URL = /^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/s;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export function decodeDataUrl(value: unknown): DecodedImage {
  if (typeof value !== "string") throw new Error("Thiếu ảnh.");
  const m = DATA_URL.exec(value.trim());
  if (!m) throw new Error("Ảnh phải ở dạng data URL base64.");
  const [, mimeType, base64] = m;
  if (!ALLOWED.has(mimeType)) {
    throw new Error(`Định dạng ảnh không hỗ trợ: ${mimeType}`);
  }
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) throw new Error("Ảnh rỗng.");
  return { buffer, mimeType, base64 };
}

export function toDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}

export function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return toDataUrl(buffer.toString("base64"), mimeType);
}
