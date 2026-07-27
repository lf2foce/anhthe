/**
 * Bước 5 — xuất file.
 *
 * Không có model nào ở đây. Cùng một ảnh vào + cùng một landmark phải luôn cho
 * ra đúng từng byte kích thước như nhau, nên toàn bộ bước này là sharp thuần.
 */

import { getDoc, type DocSpec } from "@/lib/docs";
import { computeCrop, type FaceLandmarks } from "@/lib/geometry";
import { decodeDataUrl, bufferToDataUrl } from "@/lib/imageio";
import { imageSize, renderSheet, renderSingle } from "@/lib/render";

export const runtime = "nodejs";
export const maxDuration = 60;

export interface ExportedFile {
  name: string;
  docId: string | null;
  label: string;
  meta: string;
  width: number;
  height: number;
  bytes: number;
  dataUrl: string;
  /** Ảnh gốc thiếu điểm ảnh, đã phải phóng to */
  upscaled: boolean;
  /** Vi phạm hình học còn lại sau khi crop */
  warnings: string[];
}

interface Body {
  photo?: string;
  landmarks?: FaceLandmarks;
  docIds?: string[];
  brightness?: number;
  headScale?: number;
  sheet?: boolean;
  sheetDocId?: string;
}

function validLandmarks(lm: unknown): lm is FaceLandmarks {
  if (!lm || typeof lm !== "object") return false;
  const l = lm as Record<string, unknown>;
  return (["crownY", "chinY", "eyeMidY", "faceCenterX"] as const).every(
    (k) => typeof l[k] === "number" && Number.isFinite(l[k])
  );
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  if (!validLandmarks(body.landmarks)) {
    return Response.json({ error: "Thiếu landmark khuôn mặt." }, { status: 400 });
  }
  const lm = body.landmarks;

  const specs = (body.docIds ?? []).map(getDoc).filter((d) => d !== undefined);
  if (specs.length === 0) {
    return Response.json({ error: "Chưa chọn loại giấy tờ nào." }, { status: 400 });
  }

  let image;
  try {
    image = decodeDataUrl(body.photo);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }

  const brightness = clampNum(body.brightness, -30, 30, 0);
  const headScale = clampNum(body.headScale, 0.85, 1.15, 1);

  try {
    const { width, height } = await imageSize(image.buffer);
    const files: ExportedFile[] = [];
    const rendered = new Map<string, Buffer>();

    for (const spec of specs) {
      const { crop, errors } = computeCrop(lm, width, height, spec, headScale);
      const variant: "print" | "digital" = spec.digital ? "digital" : "print";
      const photo = await renderSingle(image.buffer, crop, spec, {
        brightness,
        variant,
      });
      rendered.set(spec.id, photo.buffer);

      files.push({
        name: `anh-the-${spec.id}.jpg`,
        docId: spec.id,
        label: spec.vi,
        meta: `${spec.dim} · ${photo.width}×${photo.height} px · ${spec.dpi}dpi`,
        width: photo.width,
        height: photo.height,
        bytes: photo.buffer.length,
        dataUrl: bufferToDataUrl(photo.buffer, "image/jpeg"),
        upscaled: photo.upscaled,
        warnings: errors,
      });
    }

    if (body.sheet !== false) {
      const sheetSpec: DocSpec =
        specs.find((s) => s.id === body.sheetDocId) ?? specs[0];
      // Bản in phải dùng kích thước IN, kể cả khi bản nộp online là digital.
      const { crop } = computeCrop(lm, width, height, sheetSpec, headScale);
      const printPhoto = await renderSingle(image.buffer, crop, sheetSpec, {
        brightness,
        variant: "print",
      });
      const sheet = await renderSheet(printPhoto.buffer, sheetSpec);

      files.push({
        name: `ban-in-ghep-10x15-${sheetSpec.id}.jpg`,
        docId: null,
        label: `Bản in ghép 10×15 · ${sheetSpec.vi}`,
        meta: `${sheet.count} ảnh (${sheet.cols}×${sheet.rows}) · ${sheet.width}×${sheet.height} px · 300dpi`,
        width: sheet.width,
        height: sheet.height,
        bytes: sheet.buffer.length,
        dataUrl: bufferToDataUrl(sheet.buffer, "image/jpeg"),
        upscaled: printPhoto.upscaled,
        warnings: [],
      });
    }

    return Response.json({ files });
  } catch (e) {
    console.error("[api/export]", e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

function clampNum(v: unknown, lo: number, hi: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.min(hi, Math.max(lo, v))
    : fallback;
}
