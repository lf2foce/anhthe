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
    // Mặc định của helper: ảnh GIẤY TỜ (mặt bị khoá). Test chân dung phải mở
    // tường minh — đó là ranh giới đắt nhất của file này.
    strictFace: true,
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

  /**
   * Ranh giới đổi trang phục KHÔNG phải sở thích mà là luật của nơi nhận ảnh:
   * giấy tờ do nhà nước cấp/nhận cấm tường minh việc chỉnh sửa số hoá làm đổi
   * diện mạo; ảnh 3×4/4×6 dân dụng thì không có văn bản nào, và tiệm ảnh sửa áo
   * mỗi ngày. Đóng băng cả HAI phía — chỉ canh một phía thì một hàm luôn trả
   * "cấm" (hoặc luôn "cho") cũng xanh.
   */
  it("giấy tờ nhà nước: CẤM đổi trang phục", () => {
    for (const id of ["us", "schen", "vnhc", "exam"]) {
      const applied = sanitizeRetouch(getDoc(id)!, {
        outfit: "blazer",
        polish: true,
        hiRes: true,
      });
      expect(applied).toEqual({ outfit: "keep", polish: false, hiRes: false });
    }
  });

  it("ảnh thẻ dân dụng: CHO đổi trang phục, vẫn cấm làm đẹp mặt", () => {
    for (const id of ["vn34", "vn46"]) {
      const applied = sanitizeRetouch(getDoc(id)!, {
        outfit: "blazer",
        polish: true,
        hiRes: true,
      });
      // Đổi áo được, nhưng `polish`/`hiRes` thì KHÔNG: chúng sửa chính khuôn mặt.
      expect(applied).toEqual({ outfit: "blazer", polish: false, hiRes: false });
    }
  });

  it("loại mới quên khai thì rơi về phía AN TOÀN (không cho đổi áo)", () => {
    const unknown = { ...getDoc("vn34")!, id: "loai-moi-chua-khai" };
    expect(sanitizeRetouch(unknown, { outfit: "suit" }).outfit).toBe("keep");
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
    const p = retouchPrompt(opts({ outfit: "suit", strictFace: false }));
    expect(p.toLowerCase()).toContain("vest tối màu");
    expect(p).not.toContain("KHÔNG đổi quần áo");
    expect(p).toContain("hồ sơ nghề nghiệp");
  });

  it("mỗi trang phục ra một lệnh khác nhau", () => {
    const shirt = retouchPrompt(opts({ outfit: "shirt", strictFace: false }));
    const blazer = retouchPrompt(opts({ outfit: "blazer", strictFace: false }));
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
      { outfit: "suit" as const, strictFace: false },
      { polish: true, strictFace: false },
      { hiRes: true, strictFace: false },
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

describe("ảnh thẻ + đổi trang phục — mặt vẫn bị khoá", () => {
  /**
   * Chế độ này là chỗ dễ hỏng nhất trong cả file: nới một chút (cho đổi áo) mà
   * kéo theo cả gói nới của ảnh chân dung thì khách nhận về ảnh giấy tờ đang
   * mỉm cười — thứ bị trả ở quầy, và mình chính là người gây ra.
   */
  const p = retouchPrompt(opts({ outfit: "suit", strictFace: true }));

  it("có lệnh mặc vest", () => {
    expect(p.toLowerCase()).toContain("vest tối màu");
  });

  it("vẫn là ảnh thẻ, KHÔNG nhảy sang chế độ chân dung", () => {
    expect(p).toContain("ảnh thẻ/hộ chiếu");
    expect(p).not.toContain("hồ sơ nghề nghiệp");
  });

  it("giữ nguyên các lệnh cấm về KHUÔN MẶT", () => {
    expect(p).toContain("không đổi biểu cảm");
    expect(p).toContain("không thêm nụ cười");
    expect(p).toContain("KHÔNG làm thon mặt");
    expect(p).toContain("KHÔNG đổi cân nặng");
  });

  it("chỉ bỏ đúng dòng cấm đổi quần áo, và chốt ranh giới ở ĐƯỜNG CỔ", () => {
    expect(p).not.toContain("KHÔNG đổi quần áo");
    expect(p).toContain("TỪ ĐƯỜNG CỔ TRỞ XUỐNG");
    // Những thứ khác trong cùng dòng cũ không được mất theo
    expect(p).toContain("KHÔNG thêm trang sức");
    expect(p).toContain("không xoá nốt ruồi");
  });
});

describe("lọc theo TOÀN NHÓM — ảnh dùng chung phải theo loại khắt khe nhất", () => {
  /**
   * Ca đã dựng lại được: tick 3×4 (được mặc vest) cùng Visa Mỹ (cấm chỉnh sửa),
   * cả hai ra nền trắng. Lọc theo mỗi loại CHÍNH thì tấm ảnh mặc vest được dùng
   * cho cả hồ sơ visa. Đây là chốt thứ hai, độc lập với việc tách nhóm.
   */
  it("nhóm có một loại cấm đổi áo thì CẢ NHÓM không được đổi", () => {
    const applied = sanitizeRetouch(getDoc("vn34")!, { outfit: "suit" }, [
      getDoc("us")!,
    ]);
    expect(applied.outfit).toBe("keep");
  });

  it("cả nhóm đều được phép thì vẫn cho đổi", () => {
    const applied = sanitizeRetouch(getDoc("vn34")!, { outfit: "suit" }, [
      getDoc("vn46")!,
    ]);
    expect(applied.outfit).toBe("suit");
  });

  it("không truyền nhóm thì xử như chỉ có mình loại đó — không nới thêm gì", () => {
    expect(sanitizeRetouch(getDoc("us")!, { outfit: "suit" }).outfit).toBe("keep");
    expect(sanitizeRetouch(getDoc("vn34")!, { outfit: "suit" }).outfit).toBe("suit");
  });
});
