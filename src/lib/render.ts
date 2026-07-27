import "server-only";

/**
 * Đóng gói file cuối bằng sharp: crop → resize đúng px/DPI → ghép bản in 10×15.
 *
 * Ảnh vào đây đã được AI thay nền. Từ đây trở đi không còn model nào can thiệp:
 * kích thước, DPI và bố cục tờ in phải lặp lại y hệt mỗi lần chạy.
 */

import sharp from "sharp";
import { bgHex, mmToPx, outputSize, type DocSpec } from "./docs";
import type { CanvasPad, CropBox } from "./geometry";

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

/**
 * Làm nét bằng tích chập (unsharp mask), CỐ Ý không dùng model sinh ảnh.
 *
 * Upscale sinh ảnh "làm nét" bằng cách BỊA THÊM chi tiết mặt — lỗ chân lông, lông
 * mi, gọng kính nó tưởng là có. Trên ảnh giấy tờ tuỳ thân đó là sửa nội dung ảnh
 * nhận dạng. Tích chập chỉ tăng tương phản cục bộ trên chi tiết ĐANG CÓ, nên nó
 * không thêm gì vào ảnh và lặp lại y hệt mỗi lần chạy.
 *
 * Mức nhẹ: mục tiêu là bù lại độ mềm do resize, không phải tạo cảm giác "nét hơn thật".
 */
const SHARPEN = { sigma: 1, m1: 0.6, m2: 1.6 } as const;

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
  opts: {
    brightness?: number;
    variant?: "print" | "digital";
    /** Nền chuẩn đã resolve cho spec này; mặc định là nền đầu tiên spec cho phép */
    backgroundHex?: string;
    /** Làm nét bằng tích chập — KHÔNG bịa thêm chi tiết, xem `SHARPEN` */
    sharpen?: boolean;
  } = {}
): Promise<RenderedPhoto> {
  const target = outputSize(spec, opts.variant ?? "print");
  const brightness = brightnessMultiplier(opts.brightness ?? 0);
  const background = opts.backgroundHex ?? bgHex(spec.backgrounds[0]);

  let pipeline = sharp(input).extract({
    left: crop.left,
    top: crop.top,
    width: crop.width,
    height: crop.height,
  });

  if (brightness !== 1) pipeline = pipeline.modulate({ brightness });

  // `flatten` chỉ ghép kênh alpha nếu có — ảnh JPEG vào đây không có alpha nên
  // đây là chốt phòng khi model trả PNG trong suốt, KHÔNG phải chỗ tạo ra nền.
  // Nền thật do bước thay nền quyết định; `backgroundDeviation` kiểm lại sau đó.
  pipeline = pipeline
    .resize(target.width, target.height, { fit: "fill" })
    .flatten({ background });

  // Làm nét SAU khi resize: làm trước thì phép resize bôi lại phần vừa làm nét.
  if (opts.sharpen) pipeline = pipeline.sharpen(SHARPEN);

  const buffer = await pipeline
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

/**
 * Nới canvas theo kế hoạch của `extendToFit`: chỉ thêm NỀN đúng màu chuẩn quanh
 * ảnh, không đụng một pixel nào của người. Phần số học (nới bao nhiêu, landmark
 * mới ở đâu) nằm ở geometry.ts — đây chỉ là thao tác sharp thuần.
 */
export async function sharpExtend(
  input: Buffer,
  pad: CanvasPad,
  backgroundHex: string
): Promise<Buffer> {
  return sharp(input)
    .extend({
      top: pad.top,
      left: pad.left,
      right: pad.right,
      bottom: pad.bottom,
      background: backgroundHex,
    })
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

/** Lệch màu tối đa cho phép trên một kênh (0–255) trước khi coi là sai nền */
export const BACKGROUND_TOLERANCE = 18;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * Màu trung bình của một vùng, tính từ pixel thô.
 *
 * CỐ Ý không dùng `sharp().stats()`: `stats()` đo ẢNH ĐẦU VÀO và bỏ qua `extract()`
 * đứng trước nó, nên `extract(góc).stats()` trả về trung bình CẢ ẢNH. Với ảnh thẻ —
 * phần lớn diện tích là mặt và áo — con số đó không nói gì về nền.
 */
async function regionMean(
  input: Buffer,
  region: { left: number; top: number; width: number; height: number }
): Promise<[number, number, number]> {
  const { data, info } = await sharp(input)
    .extract(region)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const count = info.width * info.height;
  const sums = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    const at = i * info.channels;
    sums[0] += data[at];
    sums[1] += data[at + 1];
    sums[2] += data[at + 2];
  }
  return [sums[0] / count, sums[1] / count, sums[2] / count];
}

/**
 * Nền của ảnh thành phẩm có ĐÚNG màu chuẩn không — trả về lệch tối đa trên một
 * kênh (0–255).
 *
 * Đây là compliance bằng số học, không phải quan sát của model: model được YÊU CẦU
 * thay nền sang đúng hex nhưng vẫn có thể trả về lệch tông, hoặc chỉ đổi nền quanh
 * đầu mà để nguyên phần còn lại. Tiêu chí `background_even` của model chỉ nói nền
 * có ĐỀU không, không nói nền có ĐÚNG MÀU không.
 *
 * Vùng đo là hai DẢI DỌC sát mép trái/phải, từ đỉnh ảnh xuống tới đường cằm:
 *
 * - Chỉ lấy hai bên vì cột giữa là đầu và thân người.
 * - Chỉ lấy phần trên đường cằm vì dưới cằm là vai và áo, không phải nền.
 * - Dải dọc (không phải ô vuông ở góc) vì model hay đổi nền quanh đầu rồi bỏ sót
 *   phần thấp hơn — chỉ đo góc trên là bỏ lọt đúng ca đó.
 *
 * Lấy giá trị NHỎ HƠN của hai dải: tóc rộng có thể tràn vào một bên, nhưng nếu nền
 * sai màu thì cả hai bên đều lệch, nên min không làm mất trường hợp sai.
 *
 * Giới hạn đã biết: nền sai ở phần DƯỚI cằm thì hàm này không thấy — vùng đó không
 * phân biệt được với áo.
 *
 * @param chinFraction vị trí đường cằm theo chiều cao ảnh (0–1). Thiếu thì lấy 0.5,
 *        tức chỉ đo nửa trên — an toàn nhưng bỏ lọt nhiều hơn.
 */
export async function backgroundDeviation(
  input: Buffer,
  expectedHex: string,
  opts: { chinFraction?: number } = {}
): Promise<number> {
  const want = hexToRgb(expectedHex);
  const { width, height } = await imageSize(input);

  const stripW = Math.max(2, Math.round(width * 0.1));
  const chin = Math.min(0.95, Math.max(0.2, opts.chinFraction ?? 0.5));
  const stripH = Math.max(2, Math.round(height * chin));
  if (stripW * 2 > width || stripH > height) return 0;

  const strips = [
    { left: 0, top: 0, width: stripW, height: stripH },
    { left: width - stripW, top: 0, width: stripW, height: stripH },
  ];

  const deviations = await Promise.all(
    strips.map(async (strip) => {
      const got = await regionMean(input, strip);
      return Math.max(...got.map((v, i) => Math.abs(v - want[i])));
    })
  );

  return Math.min(...deviations);
}
