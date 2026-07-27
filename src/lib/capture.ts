/**
 * Client — biến mọi nguồn ảnh (camera hoặc file) thành MỘT dạng chuẩn duy nhất:
 * JPEG dựng từ <canvas>, đã xoay đúng chiều, cạnh dài tối đa MAX_EDGE.
 *
 * Đây là ảnh gốc của cả phiên. Landmark đo ở bước kiểm tra và khung crop ở bước
 * xuất đều tính trên đúng bộ pixel này, nên không được xoay hay resize lại ở
 * bất kỳ bước nào sau đó.
 */

/** Cạnh dài tối đa. 2048px đủ cho 600×600 (visa Mỹ) sau khi crop còn ~60% khung. */
export const MAX_EDGE = 2048;

const QUALITY = 0.92;

function drawToDataUrl(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  mirror = false
): string {
  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không dựng được canvas.");

  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", QUALITY);
}

/** File người dùng chọn → ảnh chuẩn. `imageOrientation` xử lý EXIF thay ta. */
export async function fileToPhoto(file: Blob): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Tệp không phải ảnh.");
  }
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    return drawToDataUrl(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

/**
 * Khung hình đang phát từ camera → ảnh chuẩn.
 *
 * Camera trước được HIỂN THỊ dạng gương (CSS) cho dễ canh, nhưng khung hình thô
 * mà getUserMedia trả về đã là ảnh thật. Vì vậy mặc định `flip = false`: lật
 * thêm lần nữa ở đây là ra ảnh ngược, mà ảnh thẻ ngược thì chữ trên áo, ngôi tóc
 * và nốt ruồi đều sai bên.
 */
export function videoToPhoto(video: HTMLVideoElement, flip = false): string {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error("Camera chưa sẵn sàng.");
  return drawToDataUrl(video, w, h, flip);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
