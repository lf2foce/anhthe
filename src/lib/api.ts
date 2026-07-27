/** Client — ba lệnh gọi server của luồng. Lỗi luôn ném ra dạng Error có câu chữ đọc được. */

import type { CheckResult } from "./checks";
import type { BackgroundId } from "./docs";
import type { FaceLandmarks } from "./geometry";
import type { Working } from "./studio";
import type { ExportedFile } from "@/app/api/export/route";

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

export function checkPhoto(photo: string, docIds: string[]): Promise<CheckResult> {
  return post<CheckResult>("/api/check", { photo, docIds });
}

export function retouchPhoto(opts: {
  photo: string;
  background: BackgroundId;
  smooth: boolean;
  evenLighting: boolean;
}): Promise<Working> {
  return post<Working>("/api/retouch", opts);
}

export function exportFiles(opts: {
  photo: string;
  landmarks: FaceLandmarks;
  docIds: string[];
  brightness: number;
  headScale: number;
  sheet: boolean;
  sheetDocId: string | null;
}): Promise<{ files: ExportedFile[] }> {
  return post<{ files: ExportedFile[] }>("/api/export", opts);
}
