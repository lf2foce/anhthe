import { describe, expect, it, vi } from "vitest";
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

describe("proxyAllowed — chốt của proxy tải hộ /api/blob", () => {
  /**
   * Route nhận nguyên một URL từ client rồi fetch — không khoá thì đó là máy
   * SSRF công cộng. Ba chốt phải cùng đứng: đúng host R2 của mình, đúng thư mục
   * của khách đang gọi, và (ở tầng R2) chữ ký presigned còn hạn.
   */
  async function load() {
    vi.stubEnv("PHOTO_R2_ACCOUNT_ID", "acc123");
    vi.stubEnv("PHOTO_R2_ACCESS_KEY_ID", "k");
    vi.stubEnv("PHOTO_R2_SECRET_ACCESS_KEY", "s");
    vi.stubEnv("PHOTO_R2_BUCKET", "bucket");
    vi.resetModules();
    return import("./storage");
  }
  // Dạng THẬT SDK ký ra (đối chiếu từ link sống): bucket là SUBDOMAIN.
  // Bản đầu của proxyAllowed chỉ nhận dạng path-style và chặn nhầm chính link
  // mình vừa ký — test cũng bịa URL cùng kiểu nên xanh giả. Đóng băng dạng thật.
  const good = "https://bucket.acc123.r2.cloudflarestorage.com/client-a/sess/x.jpg?X-Amz-Signature=abc";
  const goodPathStyle = "https://acc123.r2.cloudflarestorage.com/bucket/client-a/sess/x.jpg?X-Amz-Signature=abc";

  it("link virtual-hosted (dạng SDK ký thật): cho qua", async () => {
    const { proxyAllowed } = await load();
    expect(proxyAllowed("client-a", good)).toBe(true);
  });

  it("dạng path-style cũng qua — cùng một object", async () => {
    const { proxyAllowed } = await load();
    expect(proxyAllowed("client-a", goodPathStyle)).toBe(true);
  });

  it("thư mục của NGƯỜI KHÁC: chặn — đây là ảnh khuôn mặt", async () => {
    const { proxyAllowed } = await load();
    expect(proxyAllowed("client-b", good)).toBe(false);
    expect(proxyAllowed("client-b", goodPathStyle)).toBe(false);
  });

  it("host lạ: chặn — kể cả khi path trông y hệt", async () => {
    const { proxyAllowed } = await load();
    expect(
      proxyAllowed("client-a", "https://evil.example.com/bucket/client-a/sess/x.jpg")
    ).toBe(false);
    // host CHỨA host thật cũng không được — so bằng, không so đuôi
    expect(
      proxyAllowed(
        "client-a",
        "https://acc123.r2.cloudflarestorage.com.evil.example.com/bucket/client-a/x.jpg"
      )
    ).toBe(false);
    // bucket giả trên subdomain sâu hơn cũng không được
    expect(
      proxyAllowed(
        "client-a",
        "https://bucket.acc123.r2.cloudflarestorage.com.evil.example.com/client-a/x.jpg"
      )
    ).toBe(false);
  });

  it("http thường, path leo thang, rác không parse được: chặn hết", async () => {
    const { proxyAllowed } = await load();
    expect(proxyAllowed("client-a", good.replace("https:", "http:"))).toBe(false);
    expect(
      proxyAllowed("client-a", "https://bucket.acc123.r2.cloudflarestorage.com/client-a/../client-b/x.jpg")
    ).toBe(false);
    expect(proxyAllowed("client-a", "khong-phai-url")).toBe(false);
  });

  it("chưa cấu hình R2 thì đóng hẳn — chế độ data URL không cần proxy", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("PHOTO_R2_ACCOUNT_ID", "");
    vi.resetModules();
    const { proxyAllowed } = await import("./storage");
    expect(proxyAllowed("client-a", good)).toBe(false);
  });
});
