import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { newSessionId, ownsKey } from "./storage";
import { watermarked } from "./watermark";

describe("ownsKey — chốt chống tải ảnh người khác", () => {
  /**
   * Ảnh ở đây là KHUÔN MẶT người thật. Khoá khó đoán không phải là quyền — phải
   * so chủ sở hữu trước khi cấp bất kỳ link nào.
   */
  it("chỉ nhận khoá thuộc đúng khách", () => {
    expect(ownsKey("abc123", "abc123/phien1/anh.jpg")).toBe(true);
    expect(ownsKey("abc123", "kh4c/phien1/anh.jpg")).toBe(false);
  });

  it("không cho tiền tố trùng một phần lách qua", () => {
    // "abc123x" không phải "abc123" — thiếu dấu / là lọt.
    expect(ownsKey("abc123", "abc123x/phien1/anh.jpg")).toBe(false);
  });

  it("chặn đường dẫn leo thư mục", () => {
    expect(ownsKey("abc123", "abc123/../kh4c/anh.jpg")).toBe(false);
  });

  it("chuỗi rỗng hay khoá lạ đều bị từ chối", () => {
    expect(ownsKey("abc123", "")).toBe(false);
    expect(ownsKey("abc123", "/abc123/anh.jpg")).toBe(false);
  });
});

describe("newSessionId", () => {
  it("mỗi lần một khác và chỉ chứa ký tự an toàn cho khoá object", () => {
    const a = newSessionId();
    const b = newSessionId();
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[a-f0-9]{16}$/);
  });
});

describe("watermark", () => {
  async function solid(w: number, h: number): Promise<Buffer> {
    return sharp({
      create: { width: w, height: h, channels: 3, background: "#7a8a5e" },
    })
      .jpeg()
      .toBuffer();
  }

  it("giữ nguyên kích thước ảnh — dấu là lớp phủ, không phải khung thêm vào", async () => {
    const src = await solid(600, 800);
    const meta = await sharp(await watermarked(src)).metadata();
    expect([meta.width, meta.height]).toEqual([600, 800]);
  });

  /**
   * Phải thấy được trên MỌI nền, đặc biệt nền TRẮNG.
   *
   * Bản đầu vẽ chữ trắng 34% và tàng hình hoàn toàn trên ảnh thẻ — mà ảnh thẻ
   * theo quy định là nền trắng, tức dấu vô dụng đúng ở luồng bán chính. Nó sống
   * sót qua test vì test cũ chỉ dùng một nền ô-liu trung tính. Giờ canh cả ba.
   */
  it.each([
    ["trắng (ảnh thẻ)", "#ffffff"],
    ["đen (glamour, đen trắng)", "#101010"],
    ["trung tính", "#7a8a5e"],
  ])("thấy được trên nền %s", async (_label, bg) => {
    const src = await sharp({
      create: { width: 600, height: 800, channels: 3, background: bg },
    })
      .jpeg()
      .toBuffer();
    const before = await sharp(src).stats();
    const after = await sharp(await watermarked(src)).stats();
    expect(after.channels[0].stdev).toBeGreaterThan(
      before.channels[0].stdev + 3
    );
  });

  /**
   * Dấu phải co theo ảnh: cỡ chữ cố định thì trên ảnh 2K thành hạt bụi (cắt là
   * xong) còn trên ảnh nhỏ thì che kín mặt.
   */
  it("phủ tương đương nhau ở ảnh nhỏ và ảnh lớn", async () => {
    const small = await sharp(await watermarked(await solid(400, 500))).stats();
    const large = await sharp(await watermarked(await solid(1600, 2000))).stats();
    const ratio = large.channels[0].stdev / small.channels[0].stdev;
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(2);
  });

  /**
   * Tính chất cần canh không phải "mọi ô 100px đều có dấu" — cắt 100px của ảnh
   * 800px thì cũng chẳng dùng được. Cần canh là: KHÔNG cắt ra được một mảng ĐỦ
   * DÙNG (một phần tư ảnh) mà sạch dấu.
   */
  it("không cắt ra được một phần tư ảnh nào sạch dấu", async () => {
    const marked = await watermarked(await solid(800, 800));
    for (const [left, top] of [
      [0, 0],
      [400, 0],
      [0, 400],
      [400, 400],
    ]) {
      const { data, info } = await sharp(marked)
        .extract({ left, top, width: 400, height: 400 })
        .raw()
        .toBuffer({ resolveWithObject: true });
      let min = 255;
      let max = 0;
      for (let i = 0; i < info.width * info.height; i++) {
        const v = data[i * info.channels];
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
      expect(max - min, `mảng (${left},${top}) sạch dấu`).toBeGreaterThan(8);
    }
  });
});
