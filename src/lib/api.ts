/** Client — ba lệnh gọi server của luồng. Lỗi luôn ném ra dạng Error có câu chữ đọc được. */

import type { PhotoCheck } from "./checks";
import type { FaceLandmarks } from "./geometry";
import type { BackgroundId } from "./docs";
import type { Working } from "./studio";
import type { ExportedFile, ExportGroup } from "@/app/api/export/route";
import type { StoredImage } from "./storage";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // để rơi xuống nhánh lỗi bên dưới
  }

  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Máy chủ trả về ${res.status}.`;
    throw new Error(message);
  }
  return payload as T;
}

/**
 * Chấm ảnh: cố ý KHÔNG truyền loại giấy tờ. Route chỉ trả quan sát, còn kết luận
 * tính ở client bằng `evaluate` — xem lib/checks.ts.
 */
export function checkPhoto(photo: string): Promise<PhotoCheck> {
  return post<PhotoCheck>("/api/check", { photo });
}

export function retouchPhoto(opts: {
  photo: string;
  /** Loại giấy tờ — server suy họ từ đây để biết được phép sửa những gì */
  docId: string;
  /** Landmark ảnh gốc — server cần để biết phải nới khung bao nhiêu */
  landmarks: FaceLandmarks;
  background: BackgroundId;
  smooth: boolean;
  evenLighting: boolean;
}): Promise<Working> {
  return post<Working>("/api/retouch", opts);
}

export function exportFiles(opts: {
  groups: ExportGroup[];
  brightness: number;
  headScales: Record<string, number>;
  sharpen: boolean;
  sheet: boolean;
  sheetDocId: string | null;
  sessionId: string | null;
}): Promise<{ files: ExportedFile[]; sessionId: string }> {
  return post("/api/export", opts);
}

/** Tạo/lấy đơn cho một phiên — trả mã memo và link QR */
export function createOrder(opts: {
  sessionId: string;
  planId: string;
}): Promise<{ memo: string; amountVnd: number; status: string; qrUrl: string }> {
  return post("/api/order", opts);
}

/** Xin link bản SẠCH cho một ảnh; 402 nếu phiên chưa trả tiền */
export function unlockImage(opts: {
  key: string;
  sessionId: string;
}): Promise<{ url: string }> {
  return post("/api/unlock", opts);
}

/** Studio sáng tạo: sinh `count` biến thể theo một phong cách */
export function generateImages(opts: {
  photo: string;
  packId: string;
  sessionId: string | null;
  count: number;
  note: string;
  aspectRatio: string;
  quality: "std" | "high";
}): Promise<{ packId: string; sessionId: string; images: StoredImage[] }> {
  return post("/api/generate", opts);
}

/** Vòng lặp trên một ảnh đã sinh: chỉnh theo ghi chú, hoặc vẽ lại ở 2K */
export function refineImage(opts: {
  photo: string;
  note: string;
  upscale: boolean;
  sessionId: string | null;
}): Promise<{ image: StoredImage; sessionId: string }> {
  return post("/api/refine", opts);
}

/** Số lượt còn lại hôm nay — không gọi model nên gọi thoải mái */
export async function fetchQuota(): Promise<{ remaining: number; perDay: number }> {
  const res = await fetch("/api/me");
  if (!res.ok) throw new Error("Không đọc được hạn mức.");
  return res.json();
}
