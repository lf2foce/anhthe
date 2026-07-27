import { describe, expect, it } from "vitest";
import {
  AI_CHECK_IDS,
  CHECK_ORDER,
  FIXABLE,
  evaluate,
  passCount,
  requiredChecks,
  requiredCount,
  verdictOf,
  type CheckId,
  type CheckItem,
  type PhotoCheck,
} from "./checks";
import { familiesOf, getDoc } from "./docs";

/** Dựng bộ 8 tiêu chí, mặc định đạt hết; `failed` là những id cho trượt. */
function checksFor(docIds: string[], failed: CheckId[] = []): CheckItem[] {
  const required = requiredChecks(familiesOf(docIds));
  return CHECK_ORDER.map((id) => ({
    id,
    pass: !failed.includes(id),
    detail: "",
    fixable: FIXABLE.has(id),
    required: required.has(id),
  }));
}

describe("requiredChecks", () => {
  it("giấy tờ tuỳ thân bắt buộc cả 8 tiêu chí", () => {
    expect(requiredChecks(["id"]).size).toBe(CHECK_ORDER.length);
  });

  it("ảnh chân dung không bắt buộc biểu cảm trung tính và không kính", () => {
    const req = requiredChecks(["portrait"]);
    expect(req.has("neutral_expression")).toBe(false);
    expect(req.has("no_hat_no_glasses")).toBe(false);
    // Còn lại vẫn bắt buộc — nới hai cái không phải bỏ kiểm tra.
    expect(req.has("face_front")).toBe(true);
    expect(req.has("eyes_open")).toBe(true);
    expect(req.has("head_ratio")).toBe(true);
    expect(req.has("resolution")).toBe(true);
  });

  it("chọn kèm giấy tờ tuỳ thân là siết lại toàn bộ", () => {
    // Tấm ảnh phải dùng được cho CẢ HAI, nên mức khắt khe là hợp của hai họ.
    expect(requiredChecks(["portrait", "id"]).size).toBe(CHECK_ORDER.length);
  });

  it("tỉ lệ đầu và độ phân giải luôn bắt buộc với mọi họ", () => {
    for (const family of ["id", "portrait"] as const) {
      expect(requiredChecks([family]).has("head_ratio")).toBe(true);
      expect(requiredChecks([family]).has("resolution")).toBe(true);
    }
  });
});

describe("verdictOf", () => {
  it("chỉ chọn LinkedIn mà cười nhẹ thì KHÔNG bị đánh trượt", () => {
    const checks = checksFor(["link"], ["neutral_expression"]);
    expect(verdictOf(checks)).toBe("pass");
  });

  it("cùng ảnh cười nhẹ đó, thêm visa Mỹ vào là trượt thật", () => {
    // Đây là cái bẫy: cùng một quan sát của model, hai kết luận khác nhau, và
    // khác nhau vì tập giấy tờ chứ không vì model chấm lại.
    const checks = checksFor(["link", "us"], ["neutral_expression"]);
    expect(verdictOf(checks)).toBe("fail");
  });

  it("đeo kính chỉ chặn khi có giấy tờ tuỳ thân trong danh sách", () => {
    expect(verdictOf(checksFor(["link"], ["no_hat_no_glasses"]))).toBe("pass");
    expect(verdictOf(checksFor(["vn34"], ["no_hat_no_glasses"]))).toBe("fail");
  });

  it("lỗi sửa được bằng phần mềm thì là fixable, không phải fail", () => {
    expect(verdictOf(checksFor(["us"], ["background_even"]))).toBe("fixable");
    expect(verdictOf(checksFor(["us"], ["lighting_even", "head_ratio"]))).toBe(
      "fixable"
    );
  });

  it("trộn lỗi sửa được với lỗi không sửa được thì là fail", () => {
    expect(verdictOf(checksFor(["us"], ["background_even", "eyes_open"]))).toBe(
      "fail"
    );
  });

  it("đạt hết thì pass", () => {
    expect(verdictOf(checksFor(["us", "vn34", "link"]))).toBe("pass");
  });

  it("độ phân giải không sửa được bằng phần mềm — phải chụp lại", () => {
    expect(FIXABLE.has("resolution")).toBe(false);
    expect(verdictOf(checksFor(["us"], ["resolution"]))).toBe("fail");
  });
});

describe("điểm hiển thị", () => {
  it("mẫu số là số tiêu chí BẮT BUỘC, không phải tổng số tiêu chí", () => {
    const portrait = checksFor(["link"]);
    expect(portrait).toHaveLength(8);
    expect(requiredCount(portrait)).toBe(6);
    expect(passCount(portrait)).toBe(6);
  });

  it("tiêu chí không bắt buộc trượt không làm tụt điểm", () => {
    const checks = checksFor(["link"], ["neutral_expression"]);
    expect(passCount(checks)).toBe(requiredCount(checks));
  });

  it("với giấy tờ tuỳ thân thì mẫu số là 8", () => {
    expect(requiredCount(checksFor(["us"]))).toBe(8);
  });
});

/** Quan sát của model trên một ảnh 2000×2667, đầu chiếm 35% chiều cao */
function photoCheck(failedAi: CheckId[] = []): PhotoCheck {
  return {
    landmarks: { crownY: 0.12, chinY: 0.47, eyeMidY: 0.22, faceCenterX: 0.5 },
    imageWidth: 2000,
    imageHeight: 2667,
    checks: AI_CHECK_IDS.map((id) => ({
      id,
      pass: !failedAi.includes(id),
      detail: "",
    })),
  };
}

describe("evaluate", () => {
  /**
   * Lời hứa của luồng "chốt một ảnh rồi đẩy sang loại khác": tick thêm một loại
   * KHẮT KHE hơn ở màn Xuất ảnh phải siết kết luận lại NGAY, không gọi lại model.
   * Không có cái này thì flow là lời hứa suông — ảnh chấm cho LinkedIn (được cười)
   * đem đi làm visa Mỹ mà không ai kiểm.
   */
  it("thêm visa Mỹ vào ảnh đã chấm cho LinkedIn thì verdict siết lại ngay", () => {
    const check = photoCheck(["neutral_expression"]);

    expect(evaluate(check, ["link"]).verdict).toBe("pass");
    expect(evaluate(check, ["link", "us"]).verdict).toBe("fail");
  });

  it("bỏ tick loại khắt khe thì verdict nới lại — cùng một quan sát", () => {
    const check = photoCheck(["no_hat_no_glasses"]);
    expect(evaluate(check, ["link", "vn34"]).verdict).toBe("fail");
    expect(evaluate(check, ["link"]).verdict).toBe("pass");
  });

  it("tính fit cho ĐÚNG những loại đang chọn", () => {
    const one = evaluate(photoCheck(), ["us"]);
    expect(one.fits.map((f) => f.docId)).toEqual(["us"]);

    const many = evaluate(photoCheck(), ["us", "schen", "link"]);
    expect(many.fits.map((f) => f.docId)).toEqual(["us", "schen", "link"]);
    for (const f of many.fits) expect(f.errors).toEqual([]);
  });

  it("mỗi loại đạt target tỉ lệ đầu RIÊNG của nó từ cùng một ảnh", () => {
    const { fits } = evaluate(photoCheck(), ["us", "schen"]);
    for (const f of fits) {
      expect(f.headRatio).toBeCloseTo(getDoc(f.docId)!.headRatio.target, 2);
    }
  });

  it("bỏ qua id không có trong registry thay vì nổ", () => {
    expect(evaluate(photoCheck(), ["us", "khong-ton-tai"]).fits).toHaveLength(1);
  });

  it("không chọn loại nào thì không có fit nào, và head_ratio coi như đạt", () => {
    const r = evaluate(photoCheck(), []);
    expect(r.fits).toEqual([]);
    expect(r.checks.find((c) => c.id === "head_ratio")?.pass).toBe(true);
  });

  describe("headScales riêng từng loại", () => {
    /**
     * Đây là chỗ khó chịu của bản cũ: MỘT thanh trượt dùng chung cho mọi loại, nên
     * kéo lúc đang xem visa Mỹ thì file 3×4 cũng đổi theo mà không ai thấy.
     */
    it("kéo tỉ lệ đầu của một loại KHÔNG ảnh hưởng loại khác", () => {
      const base = evaluate(photoCheck(), ["us", "vn34"]);
      const nudged = evaluate(photoCheck(), ["us", "vn34"], { us: 1.15 });

      const headOf = (r: typeof base, id: string) =>
        r.fits.find((f) => f.docId === id)!.headRatio;

      expect(headOf(nudged, "us")).toBeGreaterThan(headOf(base, "us"));
      expect(headOf(nudged, "vn34")).toBeCloseTo(headOf(base, "vn34"), 6);
    });

    it("thiếu hệ số thì loại đó canh theo target của chính nó", () => {
      const r = evaluate(photoCheck(), ["us", "vn34"], { us: 1.1 });
      expect(r.fits.find((f) => f.docId === "vn34")!.headRatio).toBeCloseTo(
        getDoc("vn34")!.headRatio.target,
        2
      );
    });

    it("hệ số vẫn bị kẹp trong dải cho phép của loại đó", () => {
      const r = evaluate(photoCheck(), ["us"], { us: 5 });
      const us = getDoc("us")!;
      expect(r.fits[0].headRatio).toBeLessThanOrEqual(us.headRatio.max + 1e-6);
    });
  });
});

describe("hợp đồng danh sách tiêu chí", () => {
  it("CHECK_ORDER chứa đúng 6 tiêu chí AI + 2 tiêu chí số học", () => {
    expect(CHECK_ORDER).toHaveLength(8);
    for (const id of AI_CHECK_IDS) expect(CHECK_ORDER).toContain(id);
    expect(new Set(CHECK_ORDER).size).toBe(CHECK_ORDER.length);
  });
});
