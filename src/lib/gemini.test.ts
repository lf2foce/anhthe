/**
 * Test cho RANH GIỚI giữa hai chế độ.
 *
 * Đây là chỗ dễ nhất để một dòng cấm rơi mất mà không ai biết, và hậu quả chỉ hiện
 * ra ở ảnh của khách — sau khi bị trả ở quầy. Không gọi mạng: chỉ dựng prompt và
 * kiểm chính sách.
 */

import { describe, expect, it } from "vitest";
import { retouchPrompt, type RetouchOptions } from "./gemini";
import { FAMILY_TOOLKIT, getDoc, sanitizeRetouch } from "./docs";

function opts(over: Partial<RetouchOptions> = {}): RetouchOptions {
  return {
    image: { data: "", mimeType: "image/jpeg" },
    width: 1200,
    height: 1600,
    backgroundHex: "#ffffff",
    smooth: false,
    evenLighting: false,
    outfit: "keep",
    polish: false,
    hiRes: false,
    fillMargins: false,
    ...over,
  };
}

describe("sanitizeRetouch — lọc theo họ ở server", () => {
  const us = getDoc("us")!;
  const link = getDoc("link")!;

  it("ảnh giấy tờ tuỳ thân: bỏ HẾT vest / làm đẹp / upscale dù client gửi lên", () => {
    expect(
      sanitizeRetouch(us, { outfit: "suit", polish: true, hiRes: true })
    ).toEqual({ outfit: "keep", polish: false, hiRes: false });
  });

  it("mọi loại giấy tờ tuỳ thân đều bị lọc như nhau", () => {
    for (const id of ["us", "schen", "vn34", "vn46", "exam"]) {
      const spec = getDoc(id)!;
      const applied = sanitizeRetouch(spec, {
        outfit: "blazer",
        polish: true,
        hiRes: true,
      });
      expect(applied).toEqual({ outfit: "keep", polish: false, hiRes: false });
    }
  });

  it("ảnh chân dung: cho qua đủ cả ba", () => {
    expect(
      sanitizeRetouch(link, { outfit: "suit", polish: true, hiRes: true })
    ).toEqual({ outfit: "suit", polish: true, hiRes: true });
  });

  it("trang phục lạ thì về 'keep', không đi vào prompt", () => {
    expect(
      sanitizeRetouch(link, { outfit: "ao-giap" as never }).outfit
    ).toBe("keep");
  });

  it("bảng công cụ khớp với ý định: id đóng hết, portrait mở hết", () => {
    expect(FAMILY_TOOLKIT.id).toEqual({
      outfit: false,
      polish: false,
      hiRes: false,
    });
    expect(FAMILY_TOOLKIT.portrait).toEqual({
      outfit: true,
      polish: true,
      hiRes: true,
    });
  });
});

describe("retouchPrompt — ảnh giấy tờ tuỳ thân", () => {
  const p = retouchPrompt(opts());

  it("tự nhận là ảnh thẻ/hộ chiếu", () => {
    expect(p).toContain("ảnh thẻ/hộ chiếu");
  });

  it("cấm tường minh đổi quần áo và đổi biểu cảm", () => {
    expect(p).toContain("KHÔNG đổi quần áo");
    expect(p).toContain("KHÔNG làm thon mặt");
    expect(p).toContain("không đổi biểu cảm");
    expect(p).toContain("không thêm nụ cười");
  });

  it("không bao giờ chứa lệnh mặc vest", () => {
    expect(p.toLowerCase()).not.toContain("vest");
    expect(p.toLowerCase()).not.toContain("blazer");
    expect(p.toLowerCase()).not.toContain("sơ mi");
  });

  it("giữ nguyên vị trí và khung — crop ở bước xuất dựa vào landmark", () => {
    expect(p).toContain("NGUYÊN vị trí");
    expect(p).toContain("Giữ nguyên khung hình");
  });
});

describe("retouchPrompt — ảnh chân dung", () => {
  it("mặc vest thì có lệnh vest, và KHÔNG còn dòng cấm đổi quần áo", () => {
    const p = retouchPrompt(opts({ outfit: "suit" }));
    expect(p.toLowerCase()).toContain("vest tối màu");
    expect(p).not.toContain("KHÔNG đổi quần áo");
    expect(p).toContain("hồ sơ nghề nghiệp");
  });

  it("mỗi trang phục ra một lệnh khác nhau", () => {
    const shirt = retouchPrompt(opts({ outfit: "shirt" }));
    const blazer = retouchPrompt(opts({ outfit: "blazer" }));
    expect(shirt.toLowerCase()).toContain("sơ mi trắng");
    expect(blazer.toLowerCase()).toContain("blazer");
    expect(shirt).not.toEqual(blazer);
  });

  /**
   * Sàn chung: ảnh chân dung được sửa thoải mái hơn nhưng vẫn phải là người đó.
   * Đây là điều dễ mất nhất khi nới ràng buộc.
   */
  it("vẫn giữ sàn: không thành người khác, không xoá nốt ruồi, không thon mặt", () => {
    for (const over of [
      { outfit: "suit" as const },
      { polish: true },
      { hiRes: true },
    ]) {
      const p = retouchPrompt(opts(over));
      expect(p).toContain("KHÔNG đổi khuôn mặt thành người khác");
      expect(p).toContain("KHÔNG xoá nốt ruồi");
      expect(p).toContain("KHÔNG làm thon mặt");
      expect(p).toContain("NGUYÊN vị trí");
    }
  });

  it("không bật gì thì prompt y như chế độ giấy tờ", () => {
    expect(retouchPrompt(opts())).toEqual(retouchPrompt(opts({ outfit: "keep" })));
  });
});

describe("retouchPrompt — nới mép cho ảnh chụp quá sát", () => {
  /**
   * Lấp nền phẳng nối được NỀN nhưng không nối được NGƯỜI: ảnh hẹp hơn khung thì
   * ra vai cụt giữa không trung. Nới mép trước rồi bảo model vẽ tiếp thân vào.
   */
  it("có lệnh vẽ tiếp thân vào phần trống", () => {
    const p = retouchPrompt(opts({ fillMargins: true }));
    expect(p).toContain("Vẽ TIẾP phần thân và vai");
    expect(p).toContain("chụp lùi xa hơn");
  });

  it("lệnh nối thân đứng ĐẦU danh sách việc", () => {
    // Nếu nó nằm cuối, model hay chỉ làm nền rồi bỏ qua — ta được đúng cái đang có.
    const p = retouchPrompt(opts({ fillMargins: true, smooth: true }));
    expect(p.indexOf("Vẽ TIẾP phần thân")).toBeLessThan(p.indexOf("Thay TOÀN BỘ nền"));
  });

  /**
   * Đây là chỗ dễ hỏng nhất: vừa bảo model vẽ thêm vào mép, vừa bảo "giữ nguyên
   * khung hình" là hai lệnh mâu thuẫn, và nó sẽ bỏ một trong hai.
   */
  it("KHÔNG còn câu 'giữ nguyên khung hình của ảnh gốc' khi đang nới mép", () => {
    const p = retouchPrompt(opts({ fillMargins: true }));
    expect(p).not.toContain("Giữ nguyên khung hình và tỉ lệ khung của ảnh gốc");
    expect(p).toContain("đã bao gồm phần nới");
  });

  it("vẫn cấm xê dịch và phóng to người", () => {
    const p = retouchPrompt(opts({ fillMargins: true }));
    expect(p).toContain("KHÔNG di chuyển");
    expect(p).toContain("giữ NGUYÊN");
  });

  it("không bật thì prompt không nhắc gì tới nới mép", () => {
    expect(retouchPrompt(opts())).not.toContain("Vẽ TIẾP");
  });
});

describe("retouchPrompt — phần dùng chung", () => {
  it("luôn có mã hex nền chuẩn", () => {
    expect(retouchPrompt(opts({ backgroundHex: "#e9e6e0" }))).toContain("#e9e6e0");
  });

  it("chỉ thêm việc khi bật cờ tương ứng", () => {
    expect(retouchPrompt(opts())).not.toContain("Làm mịn da");
    expect(retouchPrompt(opts({ smooth: true }))).toContain("Làm mịn da");
    expect(retouchPrompt(opts())).not.toContain("Cân bằng ánh sáng");
    expect(retouchPrompt(opts({ evenLighting: true }))).toContain(
      "Cân bằng ánh sáng"
    );
  });
});
