import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  BACKGROUND_TOLERANCE,
  backgroundDeviation,
  brightnessMultiplier,
  renderSheet,
  renderSingle,
} from "./render";
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

describe("làm nét", () => {
  /** Ảnh có biên rõ để đo được độ nét thay đổi; ảnh một màu thì không đo được gì. */
  async function edged(width: number, height: number): Promise<Buffer> {
    return sharp({
      create: { width, height, channels: 3, background: "#ffffff" },
    })
      .composite([
        {
          input: {
            create: {
              width: Math.round(width / 2),
              height,
              channels: 3 as const,
              background: "#404050",
            },
          },
          left: 0,
          top: 0,
        },
      ])
      .jpeg({ quality: 100 })
      .toBuffer();
  }

  const crop = { left: 0, top: 0, width: 1200, height: 1200 };

  it("tăng tương phản cục bộ ở biên", async () => {
    const src = await edged(1600, 1600);
    const plain = await renderSingle(src, crop, us, { variant: "digital" });
    const sharp1 = await renderSingle(src, crop, us, {
      variant: "digital",
      sharpen: true,
    });

    // Unsharp mask đẩy quầng sáng/tối hai bên biên → độ lệch chuẩn tăng.
    const sd = async (b: Buffer) =>
      (await sharp(b).stats()).channels[0].stdev;
    expect(await sd(sharp1.buffer)).toBeGreaterThan(await sd(plain.buffer));
  });

  it("KHÔNG đổi kích thước px hay DPI — compliance không phụ thuộc tuỳ chọn này", async () => {
    const src = await edged(1600, 1600);
    const out = await renderSingle(src, crop, us, {
      variant: "digital",
      sharpen: true,
    });
    const meta = await sharp(out.buffer).metadata();
    expect([meta.width, meta.height]).toEqual([600, 600]);
    expect(meta.density).toBe(300);
  });

  it("tắt thì cho ra đúng từng byte như trước — mặc định không đụng gì", async () => {
    const src = await edged(1600, 1600);
    const a = await renderSingle(src, crop, us, { variant: "digital" });
    const b = await renderSingle(src, crop, us, {
      variant: "digital",
      sharpen: false,
    });
    expect(a.buffer.equals(b.buffer)).toBe(true);
  });
});

describe("backgroundDeviation", () => {
  /**
   * Test canh CHỖ ĐO, không chỉ canh kết quả.
   *
   * Ảnh nền trắng đúng chuẩn nhưng giữa là khuôn mặt tối chiếm phần lớn diện tích —
   * đúng hình dạng một tấm ảnh thẻ thật. Nếu hàm đo trung bình CẢ ẢNH (bẫy
   * `extract().stats()` của sharp: stats bỏ qua extract) thì con số sẽ lệch rất xa
   * và test này đỏ. Chỉ đo đúng hai góc trên mới xanh.
   */
  it("mặt tối chiếm giữa ảnh KHÔNG bị tính là nền sai màu", async () => {
    const faceLike = await sharp({
      create: { width: 600, height: 600, channels: 3, background: "#ffffff" },
    })
      .composite([
        {
          input: {
            create: { width: 420, height: 480, channels: 3, background: "#4a3b2f" },
          },
          left: 90,
          top: 120,
        },
      ])
      .jpeg()
      .toBuffer();

    // Trung bình cả ảnh ở đây lệch > 100 khỏi trắng; hai góc trên vẫn trắng thuần.
    const wholeImage = await sharp(faceLike).stats();
    expect(Math.abs(wholeImage.channels[0].mean - 255)).toBeGreaterThan(60);

    expect(await backgroundDeviation(faceLike, "#ffffff")).toBeLessThan(
      BACKGROUND_TOLERANCE
    );
  });

  /**
   * Ca thật gặp phải: model làm trắng vùng quanh đầu nhưng để nguyên hàng rào ở
   * hai bên tầm vai. Bản chỉ đo hai Ô VUÔNG GÓC TRÊN sẽ báo ĐẠT ở ảnh này — vì
   * góc trên đã trắng. Đo theo DẢI DỌC xuống tới cằm thì bắt được.
   */
  it("nền chỉ đổi quanh đầu, hai bên còn nền cũ → phải bị bắt", async () => {
    const hedge = {
      create: { width: 90, height: 260, channels: 3 as const, background: "#3d6b2f" },
    };
    const partial = await sharp({
      create: { width: 600, height: 800, channels: 3, background: "#ffffff" },
    })
      .composite([
        // Góc trên đã trắng; nền cũ chỉ còn từ 22% chiều cao trở xuống.
        { input: hedge, left: 0, top: 180 },
        { input: hedge, left: 510, top: 180 },
      ])
      .jpeg()
      .toBuffer();

    // Cằm ở 70% chiều cao → dải đo phủ đúng vùng còn hàng rào.
    expect(
      await backgroundDeviation(partial, "#ffffff", { chinFraction: 0.7 })
    ).toBeGreaterThan(BACKGROUND_TOLERANCE);
  });

  it("chinFraction nhỏ thì bỏ lọt nhiều hơn — giới hạn đã biết, không phải bug", async () => {
    const lowHedge = await sharp({
      create: { width: 600, height: 800, channels: 3, background: "#ffffff" },
    })
      .composite([
        {
          input: { create: { width: 90, height: 200, channels: 3, background: "#3d6b2f" } },
          left: 0,
          top: 600,
        },
      ])
      .jpeg()
      .toBuffer();

    // Nền sai nằm DƯỚI cằm — vùng đó là vai/áo, cố ý không đo.
    expect(
      await backgroundDeviation(lowHedge, "#ffffff", { chinFraction: 0.6 })
    ).toBeLessThan(BACKGROUND_TOLERANCE);
  });

  it("vai/áo tối dưới cằm không bị tính là nền sai", async () => {
    const shoulders = await sharp({
      create: { width: 600, height: 800, channels: 3, background: "#ffffff" },
    })
      .composite([
        {
          input: { create: { width: 600, height: 240, channels: 3, background: "#2b2b33" } },
          left: 0,
          top: 560,
        },
      ])
      .jpeg()
      .toBuffer();

    expect(
      await backgroundDeviation(shoulders, "#ffffff", { chinFraction: 0.65 })
    ).toBeLessThan(BACKGROUND_TOLERANCE);
  });

  it("nền đúng màu thì lệch gần bằng 0", async () => {
    const white = await solid(600, 600, "#ffffff");
    expect(await backgroundDeviation(white, "#ffffff")).toBeLessThan(
      BACKGROUND_TOLERANCE
    );
  });

  it("bắt được nền sai màu — nền xanh nhạt trong khi chuẩn là trắng", async () => {
    const blue = await solid(600, 600, "#dfe9f2");
    expect(await backgroundDeviation(blue, "#ffffff")).toBeGreaterThan(
      BACKGROUND_TOLERANCE
    );
  });

  it("bắt được nền xám khi chuẩn là trắng và ngược lại", async () => {
    const grey = await solid(600, 600, "#e9e6e0");
    expect(await backgroundDeviation(grey, "#ffffff")).toBeGreaterThan(
      BACKGROUND_TOLERANCE
    );
    const white = await solid(600, 600, "#ffffff");
    expect(await backgroundDeviation(white, "#e9e6e0")).toBeGreaterThan(
      BACKGROUND_TOLERANCE
    );
  });

  it("tóc tràn vào MỘT góc trên không gây báo động giả", async () => {
    // Lấy min của hai góc trên chính là để chịu được trường hợp này.
    const withHair = await sharp({
      create: { width: 600, height: 600, channels: 3, background: "#ffffff" },
    })
      .composite([
        {
          input: {
            create: { width: 120, height: 120, channels: 3, background: "#221a14" },
          },
          left: 0,
          top: 0,
        },
      ])
      .jpeg()
      .toBuffer();
    expect(await backgroundDeviation(withHair, "#ffffff")).toBeLessThan(
      BACKGROUND_TOLERANCE
    );
  });

  it("nền sai màu vẫn bị bắt dù một góc bị tóc che", async () => {
    const wrongBgWithHair = await sharp({
      create: { width: 600, height: 600, channels: 3, background: "#dfe9f2" },
    })
      .composite([
        {
          input: {
            create: { width: 120, height: 120, channels: 3, background: "#221a14" },
          },
          left: 0,
          top: 0,
        },
      ])
      .jpeg()
      .toBuffer();
    expect(await backgroundDeviation(wrongBgWithHair, "#ffffff")).toBeGreaterThan(
      BACKGROUND_TOLERANCE
    );
  });

  it("renderSingle giữ nguyên nền đã có, không tự vẽ lại", async () => {
    // flatten chỉ ghép alpha; ảnh JPEG không có alpha nên nền ĐI VÀO thế nào thì
    // ĐI RA thế đó. Đây là lý do phải đo lại nền chứ không tin tham số truyền vào.
    const blueSource = await solid(1200, 1200, "#dfe9f2");
    const out = await renderSingle(
      blueSource,
      { left: 0, top: 0, width: 1200, height: 1200 },
      us,
      { variant: "digital", backgroundHex: "#ffffff" }
    );
    expect(await backgroundDeviation(out.buffer, "#ffffff")).toBeGreaterThan(
      BACKGROUND_TOLERANCE
    );
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
