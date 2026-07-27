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
  const cropMarks: string[] = [];
  const markGap = mmToPx(0.35, SHEET_DPI);
  const markLength = mmToPx(1.3, SHEET_DPI);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const left = originX + c * (cellW + gutter);
      const top = originY + r * (cellH + gutter);
      const right = left + cellW;
      const bottom = top + cellH;

      composites.push({
        input: tile,
        left,
        top,
      });

      // Dấu cắt nằm ngoài ảnh và thẳng đúng theo bốn cạnh. Vì không vẽ đè lên
      // ảnh nên sau khi cắt sẽ không còn viền xám trên ảnh thành phẩm.
      cropMarks.push(
        `M ${left - markGap - markLength} ${top} H ${left - markGap}`,
        `M ${left} ${top - markGap - markLength} V ${top - markGap}`,
        `M ${right + markGap} ${top} H ${right + markGap + markLength}`,
        `M ${right} ${top - markGap - markLength} V ${top - markGap}`,
        `M ${left - markGap - markLength} ${bottom} H ${left - markGap}`,
        `M ${left} ${bottom + markGap} V ${bottom + markGap + markLength}`,
        `M ${right + markGap} ${bottom} H ${right + markGap + markLength}`,
        `M ${right} ${bottom + markGap} V ${bottom + markGap + markLength}`
      );
    }
  }

  const cropMarkOverlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}">
      <path d="${cropMarks.join(" ")}" fill="none" stroke="#9ca3af"
        stroke-width="${mmToPx(0.15, SHEET_DPI)}" stroke-linecap="butt"/>
    </svg>`
  );

  const buffer = await sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 3,
      background: "#ffffff",
    },
  })
    .composite([...composites, { input: cropMarkOverlay, left: 0, top: 0 }])
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
