import "server-only";

/**
 * Đóng gói file cuối bằng sharp: crop → resize đúng px/DPI → ghép bản in 10×15.
 *
 * Ảnh vào đây đã được AI thay nền. Từ đây trở đi không còn model nào can thiệp:
 * kích thước, DPI và bố cục tờ in phải lặp lại y hệt mỗi lần chạy.
 */

import sharp from "sharp";
import { mmToPx, outputSize, type DocSpec } from "./docs";
import type { CropBox } from "./geometry";

/** Khổ ảnh 10×15 (4R) */
const SHEET_W_MM = 102;
const SHEET_H_MM = 152;
const SHEET_DPI = 300;
const SHEET_MARGIN_MM = 4;
const SHEET_GUTTER_MM = 2;

/** Thanh trượt độ sáng (-30..30) → hệ số nhân, khớp với preview CSS ở client */
export function brightnessMultiplier(value: number): number {
  return 1 + value / 140;
}

export interface RenderedPhoto {
  buffer: Buffer;
  width: number;
  height: number;
  /** Ảnh gốc có đủ pixel không, hay đã phải phóng to (mất nét) */
  upscaled: boolean;
}

export async function renderSingle(
  input: Buffer,
  crop: CropBox,
  spec: DocSpec,
  opts: { brightness?: number; variant?: "print" | "digital" } = {}
): Promise<RenderedPhoto> {
  const target = outputSize(spec, opts.variant ?? "print");
  const brightness = brightnessMultiplier(opts.brightness ?? 0);

  let pipeline = sharp(input).extract({
    left: crop.left,
    top: crop.top,
    width: crop.width,
    height: crop.height,
  });

  if (brightness !== 1) pipeline = pipeline.modulate({ brightness });

  const buffer = await pipeline
    .resize(target.width, target.height, { fit: "fill" })
    .flatten({ background: spec.background })
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .withDensity(spec.dpi)
    .toBuffer();

  return {
    buffer,
    width: target.width,
    height: target.height,
    upscaled: crop.width < target.width || crop.height < target.height,
  };
}

export interface SheetResult {
  buffer: Buffer;
  width: number;
  height: number;
  /** Số ảnh xếp được trên tờ */
  count: number;
  cols: number;
  rows: number;
}

/**
 * Ghép một tờ 10×15 kín ảnh cùng loại. Không co giãn ảnh cho vừa lưới — ảnh giữ
 * đúng kích thước in thật, thừa chỗ thì để trắng, vì cắt ra phải đúng cm.
 */
export async function renderSheet(
  photo: Buffer,
  spec: DocSpec
): Promise<SheetResult> {
  const sheetW = mmToPx(SHEET_W_MM, SHEET_DPI);
  const sheetH = mmToPx(SHEET_H_MM, SHEET_DPI);
  const margin = mmToPx(SHEET_MARGIN_MM, SHEET_DPI);
  const gutter = mmToPx(SHEET_GUTTER_MM, SHEET_DPI);

  const cellW = mmToPx(spec.widthMm, SHEET_DPI);
  const cellH = mmToPx(spec.heightMm, SHEET_DPI);

  const tile = await sharp(photo).resize(cellW, cellH, { fit: "fill" }).toBuffer();

  const usableW = sheetW - margin * 2;
  const usableH = sheetH - margin * 2;
  const cols = Math.max(1, Math.floor((usableW + gutter) / (cellW + gutter)));
  const rows = Math.max(1, Math.floor((usableH + gutter) / (cellH + gutter)));

  const gridW = cols * cellW + (cols - 1) * gutter;
  const gridH = rows * cellH + (rows - 1) * gutter;
  const originX = Math.round((sheetW - gridW) / 2);
  const originY = Math.round((sheetH - gridH) / 2);

  const composites = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      composites.push({
        input: tile,
        left: originX + c * (cellW + gutter),
        top: originY + r * (cellH + gutter),
      });
    }
  }

  const buffer = await sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 3,
      background: "#ffffff",
    },
  })
    .composite(composites)
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .withDensity(SHEET_DPI)
    .toBuffer();

  return { buffer, width: sheetW, height: sheetH, count: cols * rows, cols, rows };
}

export async function imageSize(
  input: Buffer
): Promise<{ width: number; height: number }> {
  const meta = await sharp(input).metadata();
  if (!meta.width || !meta.height) throw new Error("Không đọc được kích thước ảnh.");
  return { width: meta.width, height: meta.height };
}
