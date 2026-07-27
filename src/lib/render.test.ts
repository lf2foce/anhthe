import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { brightnessMultiplier, renderSheet, renderSingle } from "./render";
import { getDoc, mmToPx, outputSize } from "./docs";

const us = getDoc("us")!;
const vn34 = getDoc("vn34")!;

async function solid(
  width: number,
  height: number,
  background = "#8899aa"
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background },
  })
    .jpeg()
    .toBuffer();
}

describe("renderSingle", () => {
  it("xuất đúng số pixel của bản digital khi spec có bản digital", async () => {
    const src = await solid(2000, 3000);
    const out = await renderSingle(
      src,
      { left: 100, top: 100, width: 1200, height: 1200 },
      us,
      { variant: "digital" }
    );
    const meta = await sharp(out.buffer).metadata();
    expect([meta.width, meta.height]).toEqual([600, 600]);
    expect(out.upscaled).toBe(false);
  });

  it("xuất đúng số pixel in 300dpi cho spec 3×4 cm", async () => {
    const src = await solid(2000, 3000);
    const out = await renderSingle(
      src,
      { left: 0, top: 0, width: 900, height: 1200 },
      vn34
    );
    const target = outputSize(vn34, "print");
    expect(target).toEqual({ width: mmToPx(30, 300), height: mmToPx(40, 300) });
    const meta = await sharp(out.buffer).metadata();
    expect([meta.width, meta.height]).toEqual([target.width, target.height]);
  });

  it("ghi DPI vào file để tiệm in không co ảnh lại", async () => {
    const src = await solid(2000, 3000);
    const out = await renderSingle(
      src,
      { left: 0, top: 0, width: 900, height: 1200 },
      vn34
    );
    const meta = await sharp(out.buffer).metadata();
    expect(meta.density).toBe(300);
  });

  it("báo upscaled khi khung crop nhỏ hơn kích thước đích", async () => {
    const src = await solid(800, 800);
    const out = await renderSingle(
      src,
      { left: 0, top: 0, width: 400, height: 400 },
      us,
      { variant: "digital" }
    );
    expect(out.upscaled).toBe(true);
  });
});

describe("brightnessMultiplier", () => {
  it("0 là không đổi, và khớp công thức preview CSS ở client", () => {
    expect(brightnessMultiplier(0)).toBe(1);
    expect(brightnessMultiplier(30)).toBeCloseTo(1 + 30 / 140, 6);
    expect(brightnessMultiplier(-30)).toBeCloseTo(1 - 30 / 140, 6);
  });
});

describe("renderSheet", () => {
  it("dựng tờ 10×15 cm ở 300dpi", async () => {
    const photo = await solid(354, 472);
    const sheet = await renderSheet(photo, vn34);
    expect([sheet.width, sheet.height]).toEqual([
      mmToPx(102, 300),
      mmToPx(152, 300),
    ]);
    const meta = await sharp(sheet.buffer).metadata();
    expect([meta.width, meta.height]).toEqual([sheet.width, sheet.height]);
    expect(meta.density).toBe(300);

    const stats = await sharp(sheet.buffer).stats();
    expect(Math.min(...stats.channels.map((channel) => channel.min))).toBeLessThan(
      200
    );
  });

  it("xếp được nhiều ảnh 3×4 trên một tờ mà không tràn lề", async () => {
    const photo = await solid(354, 472);
    const sheet = await renderSheet(photo, vn34);
    expect(sheet.count).toBe(sheet.cols * sheet.rows);
    expect(sheet.count).toBeGreaterThanOrEqual(8);

    const cellW = mmToPx(vn34.widthMm, 300);
    const cellH = mmToPx(vn34.heightMm, 300);
    const gutter = mmToPx(2, 300);
    expect(sheet.cols * cellW + (sheet.cols - 1) * gutter).toBeLessThanOrEqual(
      sheet.width - mmToPx(4, 300) * 2
    );
    expect(sheet.rows * cellH + (sheet.rows - 1) * gutter).toBeLessThanOrEqual(
      sheet.height - mmToPx(4, 300) * 2
    );
  });

  it("ảnh vuông 51mm xếp ít ô hơn ảnh 3×4 trên cùng khổ giấy", async () => {
    const small = await renderSheet(await solid(354, 472), vn34);
    const big = await renderSheet(await solid(600, 600), us);
    expect(big.count).toBeLessThan(small.count);
  });

  it("ảnh nền trắng vẫn có dấu cắt nhìn thấy được ở ngoài ảnh", async () => {
    const sheet = await renderSheet(await solid(600, 600, "#ffffff"), us);
    const stats = await sharp(sheet.buffer).stats();
    expect(Math.min(...stats.channels.map((channel) => channel.min))).toBeLessThan(
      220
    );
  });
});
