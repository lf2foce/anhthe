import "server-only";

/**
 * Đóng dấu bản xem thử.
 *
 * Ranh giới miễn phí/trả tiền nằm ở ĐẦU RA: khách xem thoải mái, tải bản sạch
 * thì trả tiền. Đây là công cụ CHUYỂN ĐỔI, không phải công cụ kiểm soát chi phí —
 * tiền model đã tiêu ở /api/generate trước khi có tấm ảnh nào để đóng dấu. Chốt
 * chi phí là `lib/gate.ts`, đừng nhầm hai việc.
 *
 * Dấu lát kín theo đường chéo chứ không phải một góc: một góc thì cắt là xong.
 */

import sharp from "sharp";

export const WATERMARK_TEXT = "Ảnh thẻ Studio · bản xem thử";

/**
 * Dấu phải co theo ảnh. Cỡ chữ cố định thì trên ảnh 2K nó thành hạt bụi, còn
 * trên ảnh nhỏ thì che kín mặt.
 */
function overlaySvg(width: number, height: number): Buffer {
  const font = Math.max(14, Math.round(width / 26));
  // Khoảng cách phải đủ dày để KHÔNG cắt ra được một mảng dùng được mà sạch dấu.
  // Bản đầu để 11×font (~330px trên ảnh 800px) và test tìm ra cả vùng 100×100
  // trắng trơn — cắt phát là mất dấu. Dọc dày hơn ngang vì dòng chữ vốn đã dài.
  const rowGap = font * 4.5;
  const colGap = font * 16;
  const rows: string[] = [];
  // Phủ dư ra ngoài khung: sau khi xoay 30° thì mép sẽ hụt nếu chỉ vẽ vừa khung.
  for (let y = -height; y < height * 2; y += rowGap) {
    for (let x = -width; x < width * 2; x += colGap) {
      rows.push(
        `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${font}" ` +
          `fill="#ffffff" fill-opacity="0.34" font-weight="700">${WATERMARK_TEXT}</text>`
      );
    }
  }
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <g transform="rotate(-30 ${width / 2} ${height / 2})">${rows.join("")}</g>
    </svg>`
  );
}

/** Trả về bản JPEG đã đóng dấu. Không đụng tới bản gốc. */
export async function watermarked(input: Buffer): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const width = meta.width ?? 800;
  const height = meta.height ?? 1000;
  return sharp(input)
    .composite([{ input: overlaySvg(width, height), top: 0, left: 0 }])
    .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
    .toBuffer();
}
