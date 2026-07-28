import { describe, expect, it } from "vitest";
import {
  FLAT_FILL_LIMIT,
  NO_PAD,
  computeCrop,
  extendToFit,
  needsBodyFill,
  type CanvasPad,
  type ExtendPlan,
  guideBands,
  resolutionCheck,
  type FaceLandmarks,
} from "./geometry";
import { DOCS, getDoc, outputSize, type DocSpec } from "./docs";

const us = getDoc("us")!;
const vn34 = getDoc("vn34")!;

/** Khuôn mặt "chuẩn": đầu chiếm 30% chiều cao khung 3000px, nằm giữa. */
const lm: FaceLandmarks = {
  crownY: 0.2,
  chinY: 0.5,
  eyeMidY: 0.32,
  faceCenterX: 0.5,
};

describe("computeCrop", () => {
  it("cắt đúng tỉ lệ khung của spec", () => {
    const { crop } = computeCrop(lm, 2000, 3000, us);
    expect(crop.width / crop.height).toBeCloseTo(us.widthMm / us.heightMm, 3);
  });

  it("đưa tỉ lệ đầu về đúng target khi ảnh đủ rộng", () => {
    const r = computeCrop(lm, 2000, 3000, us);
    expect(r.errors).toEqual([]);
    expect(r.headRatio).toBeCloseTo(us.headRatio.target, 2);
  });

  it("đặt đường mắt đúng vị trí yêu cầu", () => {
    const r = computeCrop(lm, 2000, 3000, us);
    expect(r.eyeFromBottom).toBeCloseTo(us.eyeFromBottom.target, 2);
  });

  it("kẹp headScale trong [min, max] của spec, không cho kéo ra ngoài chuẩn", () => {
    const tooBig = computeCrop(lm, 2000, 3000, us, 5);
    const tooSmall = computeCrop(lm, 2000, 3000, us, 0.1);
    expect(tooBig.headRatio).toBeLessThanOrEqual(us.headRatio.max + 0.01);
    expect(tooSmall.headRatio).toBeGreaterThanOrEqual(us.headRatio.min - 0.01);
  });

  it("báo lỗi khi ảnh chụp quá sát, không đủ khoảng trống quanh đầu", () => {
    // Đầu chiếm 90% chiều cao khung — không cách nào cắt ra tỉ lệ 60%.
    const tight: FaceLandmarks = {
      crownY: 0.03,
      chinY: 0.93,
      eyeMidY: 0.3,
      faceCenterX: 0.5,
    };
    const r = computeCrop(tight, 1000, 1000, us);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("không bao giờ trả khung tràn ra ngoài ảnh gốc", () => {
    const offCentre: FaceLandmarks = {
      crownY: 0.05,
      chinY: 0.35,
      eyeMidY: 0.15,
      faceCenterX: 0.05,
    };
    const { crop } = computeCrop(offCentre, 2000, 3000, vn34);
    expect(crop.left).toBeGreaterThanOrEqual(0);
    expect(crop.top).toBeGreaterThanOrEqual(0);
    expect(crop.left + crop.width).toBeLessThanOrEqual(2000);
    expect(crop.top + crop.height).toBeLessThanOrEqual(3000);
  });

  it("landmark vô lý (cằm trên đỉnh đầu) thì báo lỗi thay vì cắt bừa", () => {
    const bad: FaceLandmarks = {
      crownY: 0.6,
      chinY: 0.2,
      eyeMidY: 0.4,
      faceCenterX: 0.5,
    };
    const r = computeCrop(bad, 2000, 3000, us);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe("extendToFit", () => {
  const link = getDoc("link")!;

  /** Ảnh chụp quá sát: đầu chiếm 64% chiều cao, sát mép trên — đúng ca ở ảnh thật */
  const tight = { crownY: 0.06, chinY: 0.7, eyeMidY: 0.28, faceCenterX: 0.5 };

  it("ảnh đã đủ rộng thì không nới gì", () => {
    const roomy = { crownY: 0.12, chinY: 0.47, eyeMidY: 0.22, faceCenterX: 0.5 };
    const plan = extendToFit(roomy, 2000, 2667, [getDoc("vn34")!]);
    expect(plan.needed).toBe(false);
    expect(plan.pad).toEqual({ top: 0, left: 0, right: 0, bottom: 0 });
    expect(plan.landmarks).toEqual(roomy);
  });

  /**
   * Điều kiện đúng đắn của cả tính năng: sau khi nới, computeCrop trên ảnh MỚI phải
   * hết lỗi. Nếu không thì nới xong vẫn trượt chuẩn, tính năng vô nghĩa.
   */
  it("sau khi nới thì computeCrop KHÔNG còn lỗi nào", () => {
    const before = computeCrop(tight, 1200, 1600, link);
    expect(before.errors.length).toBeGreaterThan(0);

    const plan = extendToFit(tight, 1200, 1600, [link]);
    expect(plan.needed).toBe(true);

    const after = computeCrop(plan.landmarks, plan.width, plan.height, link);
    expect(after.errors).toEqual([]);
    expect(after.headRatio).toBeCloseTo(link.headRatio.target, 2);
    expect(after.eyeFromBottom).toBeCloseTo(link.eyeFromBottom.target, 2);
  });

  it("nới đủ cho MỌI spec được truyền vào, không chỉ spec khó nhất", () => {
    const specs = DOCS.slice();
    const plan = extendToFit(tight, 1200, 1600, specs);
    for (const spec of specs) {
      const r = computeCrop(plan.landmarks, plan.width, plan.height, spec);
      expect(r.errors, `spec ${spec.id}`).toEqual([]);
    }
  });

  it("landmark mới trỏ đúng vào cùng điểm ảnh cũ — chỉ là phép dịch", () => {
    const plan = extendToFit(tight, 1200, 1600, [link]);
    // Cùng một pixel: toạ độ tuyệt đối phải khớp sau khi trừ padding.
    expect(plan.landmarks.crownY * plan.height - plan.pad.top).toBeCloseTo(
      tight.crownY * 1600,
      6
    );
    expect(plan.landmarks.chinY * plan.height - plan.pad.top).toBeCloseTo(
      tight.chinY * 1600,
      6
    );
    expect(plan.landmarks.faceCenterX * plan.width - plan.pad.left).toBeCloseTo(
      tight.faceCenterX * 1200,
      6
    );
  });

  it("chiều cao đầu tính bằng pixel KHÔNG đổi — nới nền không tạo thêm chi tiết", () => {
    const before = computeCrop(tight, 1200, 1600, link);
    const plan = extendToFit(tight, 1200, 1600, [link]);
    const after = computeCrop(plan.landmarks, plan.width, plan.height, link);
    expect(after.headPx).toBeCloseTo(before.headPx, 4);
  });

  it("mặt lệch sang một bên thì nới lệch theo, không nới đều hai bên", () => {
    const offCenter = { ...tight, faceCenterX: 0.2 };
    const plan = extendToFit(offCenter, 1200, 1600, [link]);
    expect(plan.pad.left).toBeGreaterThan(plan.pad.right);
  });

  it("landmark vô lý thì không nới, thay vì nới bừa", () => {
    const bad = { crownY: 0.7, chinY: 0.2, eyeMidY: 0.4, faceCenterX: 0.5 };
    expect(extendToFit(bad, 1200, 1600, [link]).needed).toBe(false);
  });

  it("không spec nào thì không nới", () => {
    expect(extendToFit(tight, 1200, 1600, []).needed).toBe(false);
  });
});

describe("nới khung không làm sai phép đo độ phân giải", () => {
  /**
   * Nghi vấn tự nhiên: nới khung bằng nền giả có làm resolutionCheck "đạt oan" không?
   * KHÔNG — vì sau khi nới, cropH = headPx / ratio, nên cropH ≥ targetH tương đương
   * headPx ≥ ratio × targetH: đo theo khung sau khi nới CHÍNH LÀ đo theo đầu.
   * Test này đóng băng điều đó bằng một ca đầu thật sự thiếu pixel.
   */
  it("ảnh thiếu px thì sau khi nới VẪN thiếu px", () => {
    // Ảnh nhỏ 600×800, đầu 512px — cần 0.5×1200 = 600px cho bản digital LinkedIn.
    const tight = { crownY: 0.06, chinY: 0.7, eyeMidY: 0.28, faceCenterX: 0.5 };
    const link = getDoc("link")!;
    const target = outputSize(link, "digital");

    const before = computeCrop(tight, 600, 800, link);
    expect(resolutionCheck(before.crop, target).ok).toBe(false);

    const plan = extendToFit(tight, 600, 800, [link]);
    expect(plan.needed).toBe(true);
    const after = computeCrop(plan.landmarks, plan.width, plan.height, link);
    expect(after.errors).toEqual([]);
    // Khung đã đủ rộng để đúng chuẩn hình học, nhưng pixel đầu không tự sinh ra.
    expect(resolutionCheck(after.crop, target).ok).toBe(false);
  });
});

describe("guideBands — dải hướng dẫn trên preview", () => {
  const roomy = { crownY: 0.12, chinY: 0.47, eyeMidY: 0.22, faceCenterX: 0.5 };

  /**
   * Nhãn hiện "mắt 62%" mà đường kẻ vẽ ở chỗ khác thì hướng dẫn còn hại hơn
   * không có. Cả hai phải suy từ CÙNG một `CropResult`.
   */
  it("đường thực tế khớp đúng con số trên nhãn", () => {
    const fit = computeCrop(roomy, 2000, 2667, us);
    const b = guideBands(roomy, us, fit);
    expect(b.eye.at).toBeCloseTo(1 - fit.eyeFromBottom, 6);
  });

  it("ảnh đạt chuẩn thì đường nằm TRONG dải và báo ok", () => {
    const fit = computeCrop(roomy, 2000, 2667, us);
    const b = guideBands(roomy, us, fit);
    expect(b.eye.ok).toBe(true);
    expect(b.crown.ok).toBe(true);
    expect(b.eye.at).toBeGreaterThanOrEqual(b.eye.from);
    expect(b.eye.at).toBeLessThanOrEqual(b.eye.to);
    expect(b.crown.at).toBeGreaterThanOrEqual(b.crown.from - 1e-9);
    expect(b.crown.at).toBeLessThanOrEqual(b.crown.to + 1e-9);
  });

  it("ảnh trượt chuẩn thì báo KHÔNG ok — đây là toàn bộ lý do dải tồn tại", () => {
    // Ảnh chụp quá sát: khung bị kẹp, đường mắt rơi ra ngoài dải.
    const tight = { crownY: 0.06, chinY: 0.7, eyeMidY: 0.28, faceCenterX: 0.5 };
    const link = getDoc("link")!;
    const fit = computeCrop(tight, 600, 800, link);
    expect(fit.errors.length).toBeGreaterThan(0);
    const b = guideBands(tight, link, fit);
    expect(b.eye.ok && b.crown.ok).toBe(false);
  });

  /**
   * Vị trí đỉnh đầu suy từ landmark của CHÍNH người đó, không dùng hằng số nhân
   * trắc chung — bản đầu nhân bừa 0.62 và sai với mọi khuôn mặt khác tỉ lệ đó.
   */
  it("người có trán cao và người có trán thấp cho dải đỉnh đầu KHÁC nhau", () => {
    const tranCao = { crownY: 0.10, chinY: 0.50, eyeMidY: 0.30, faceCenterX: 0.5 };
    const tranThap = { crownY: 0.10, chinY: 0.50, eyeMidY: 0.22, faceCenterX: 0.5 };
    const a = guideBands(tranCao, us, computeCrop(tranCao, 2000, 2667, us));
    const b = guideBands(tranThap, us, computeCrop(tranThap, 2000, 2667, us));
    expect(Math.abs(a.crown.at - b.crown.at)).toBeGreaterThan(0.02);
  });

  it("landmark vô lý thì không nổ, không sinh NaN", () => {
    const bad = { crownY: 0.5, chinY: 0.5, eyeMidY: 0.5, faceCenterX: 0.5 };
    const b = guideBands(bad, us, computeCrop(bad, 1000, 1000, us));
    for (const v of [b.eye.at, b.eye.from, b.eye.to, b.crown.at]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe("resolutionCheck", () => {
  it("phát hiện khung crop thiếu điểm ảnh so với kích thước xuất", () => {
    const target = outputSize(us, "digital");
    const small = { left: 0, top: 0, width: 300, height: 300 };
    expect(resolutionCheck(small, target).ok).toBe(false);
  });

  it("chấp nhận khi khung crop đủ lớn", () => {
    const target = outputSize(us, "digital");
    const big = { left: 0, top: 0, width: 1200, height: 1200 };
    expect(resolutionCheck(big, target).ok).toBe(true);
  });
});

describe("spec registry", () => {
  it("mọi spec có dải headRatio hợp lệ và target nằm trong dải", () => {
    const all: DocSpec[] = [us, vn34];
    for (const s of all) {
      expect(s.headRatio.min).toBeLessThan(s.headRatio.max);
      expect(s.headRatio.target).toBeGreaterThanOrEqual(s.headRatio.min);
      expect(s.headRatio.target).toBeLessThanOrEqual(s.headRatio.max);
    }
  });
});

describe("hai đầu dải: sai số làm tròn pixel không được thành lỗi", () => {
  /**
   * Bug thật, chụp được trên máy khách: kéo thanh trượt về sát đáy thì hiện dòng
   * "Tỉ lệ đầu 62% nằm ngoài chuẩn 62–78%" — một câu tự mâu thuẫn.
   *
   * Nguyên nhân: `wantRatio` đã bị kẹp vào đúng 0.62, nhưng chiều cao khung phải
   * là pixel nguyên nên `Math.round` làm nó cao thêm nửa pixel, và tỉ lệ đạt được
   * tụt xuống 61.99%. Con số in ra làm tròn thành "62", còn phép so thì không.
   */
  const tight: FaceLandmarks = {
    crownY: 0.2,
    chinY: 0.65, // đầu = 0.45 × 1200 = 540px, đúng ca dựng lại được bug
    eyeMidY: 0.44,
    faceCenterX: 0.5,
  };

  it("kéo hết về đáy: đạt đúng biên, không sinh lỗi", () => {
    const r = computeCrop(tight, 900, 1200, vn34, 0.885);
    // Ở đây là chỗ bug sống: tỉ lệ thật tụt xuống dưới min một tí xíu…
    expect(r.headRatio).toBeLessThan(vn34.headRatio.min);
    // …nhưng lệch chưa tới một pixel, nên KHÔNG được coi là ngoài chuẩn.
    expect((vn34.headRatio.min - r.headRatio) * r.crop.height).toBeLessThan(1);
    expect(r.headOk).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("kéo hết lên đỉnh cũng không sinh lỗi", () => {
    const r = computeCrop(tight, 900, 1200, vn34, 1.15);
    expect(r.headOk).toBe(true);
    expect(r.errors.filter((e) => e.includes("Tỉ lệ đầu"))).toEqual([]);
  });

  it("lệch THẬT vẫn bị bắt — dung sai chỉ bằng một pixel, không nới tay", () => {
    // Ảnh quá sát: khung bị thu lại cho vừa ảnh nên tỉ lệ đầu vọt lên hẳn.
    const huge: FaceLandmarks = {
      crownY: 0.02,
      chinY: 0.92,
      eyeMidY: 0.35,
      faceCenterX: 0.5,
    };
    const r = computeCrop(huge, 900, 1200, vn34);
    expect(r.headOk).toBe(false);
    expect(r.errors.some((e) => e.includes("Tỉ lệ đầu"))).toBe(true);
  });

  it("dải hướng dẫn KHÔNG tự kết luận lại — lấy thẳng từ computeCrop", () => {
    const r = computeCrop(tight, 900, 1200, vn34, 0.885);
    const bands = guideBands(tight, vn34, r);
    // Trước đây dải tự so `headRatio` với min/max nên nó đỏ trong khi không có
    // dòng lỗi nào: hai nơi cùng kết luận một chuyện, và đã nói khác nhau.
    expect(bands.crown.ok).toBe(r.headOk);
    expect(bands.eye.ok).toBe(r.eyeOk);
  });
});

describe("nới khung phải theo CỠ ĐẦU ĐANG CHỌN", () => {
  /**
   * Vì sao có test này: /api/retouch từng gọi `extendToFit` mà không truyền cỡ đầu,
   * tức luôn dựng theo target. Người dùng kéo đầu nhỏ lại rồi bấm "Chuẩn hoá lại"
   * thì nhận đúng phần nới cũ — phần thiếu bị lấp nền phẳng ở bước xuất và ra vai
   * cụt ngang giữa nền.
   */
  // Ảnh chụp hơi gần — đúng kiểu ảnh khách tự chụp bằng điện thoại.
  const near: FaceLandmarks = {
    crownY: 0.1,
    chinY: 0.7,
    eyeMidY: 0.5,
    faceCenterX: 0.5,
  };

  it("đầu nhỏ hơn ⇒ khung rộng hơn ⇒ phải nới NHIỀU hơn", () => {
    const atTarget = extendToFit(near, 900, 1200, [vn34]);
    const atMin = extendToFit(near, 900, 1200, [vn34], { vn34: 0.885 });
    expect(atMin.growth).toBeGreaterThan(atTarget.growth);
    expect(atMin.height).toBeGreaterThan(atTarget.height);
  });

  it("và có ca vượt HẲN sang bên kia ngưỡng nhờ model vẽ tiếp", () => {
    // Đây là ca trong ảnh chụp màn hình: ở target thì lấp nền phẳng là vô hình nên
    // không phiền model; kéo đầu xuống đáy thì phần thiếu đủ to để lộ vai cụt.
    expect(extendToFit(near, 900, 1200, [vn34]).growth).toBeLessThan(
      FLAT_FILL_LIMIT
    );
    expect(
      extendToFit(near, 900, 1200, [vn34], { vn34: 0.885 }).growth
    ).toBeGreaterThan(FLAT_FILL_LIMIT);
  });

  it("bỏ qua cỡ đầu = dựng đúng như target, tức bỏ sót phần người dùng vừa xin", () => {
    // Đây chính là hành vi cũ. Giữ lại thành test để không ai lặng lẽ khôi phục nó.
    expect(extendToFit(near, 900, 1200, [vn34], {})).toEqual(
      extendToFit(near, 900, 1200, [vn34], { vn34: 1 })
    );
  });
});

describe("needsBodyFill — mép dưới không có 'nới ít thì vô hình'", () => {
  /**
   * Bug thật trên máy khách: khổ 4×6 (đường mắt 64% từ đáy) cần thêm ~7% thân
   * dưới. 7% lọt dưới ngưỡng chung 8% nên hệ thống lấp nền phẳng — và đường cắt
   * trắng đè ngang áo, ngay giữa ảnh thành phẩm. Ngưỡng 8% dựa trên giả định
   * phần nới chỉ là NỀN: đúng cho trên/trái/phải, sai cho mép dưới.
   */
  const plan = (pad: Partial<CanvasPad>, imgW = 900, imgH = 1200): ExtendPlan => {
    const p = { ...NO_PAD, ...pad };
    const width = imgW + p.left + p.right;
    const height = imgH + p.top + p.bottom;
    return {
      pad: p,
      width,
      height,
      landmarks: lm,
      needed: width !== imgW || height !== imgH,
      growth: Math.max((width - imgW) / imgW, (height - imgH) / imgH),
    };
  };

  it("thiếu đáy 7% — dưới ngưỡng chung — VẪN phải nhờ model", () => {
    const p = plan({ bottom: 84 }); // 84/1200 = 7%
    expect(p.growth).toBeLessThan(FLAT_FILL_LIMIT);
    expect(needsBodyFill(p)).toBe(true);
  });

  it("thiếu TRÊN 7% thì lấp phẳng được — trên đầu là nền, không phải người", () => {
    expect(needsBodyFill(plan({ top: 84 }))).toBe(false);
  });

  it("thiếu hai bên 7% cũng lấp phẳng được", () => {
    expect(needsBodyFill(plan({ left: 32, right: 31 }))).toBe(false);
  });

  it("ngưỡng chung vẫn giữ: nới to ở bất kỳ mép nào là phải nhờ model", () => {
    expect(needsBodyFill(plan({ top: 200 }))).toBe(true); // 16.7% > 8%
  });

  it("không nới gì thì thôi", () => {
    expect(needsBodyFill(plan({}))).toBe(false);
  });
});

describe("khung dựng theo HỢP các khổ cùng nền", () => {
  /**
   * Một nền = một lần gọi model, các loại thêm sau dùng CHUNG ảnh đó. Dựng khung
   * chỉ theo loại chính thì khổ cao hơn thiếu thân dưới — và phần thiếu bị lấp
   * phẳng lúc xuất. Hợp của các khổ phải phủ được từng khổ một.
   */
  const near: FaceLandmarks = {
    crownY: 0.1,
    chinY: 0.7,
    eyeMidY: 0.5,
    faceCenterX: 0.5,
  };

  it("pad hợp ≥ pad từng khổ, theo TỪNG mép", () => {
    const both = extendToFit(near, 900, 1200, [vn34, getDoc("vn46")!]);
    for (const spec of [vn34, getDoc("vn46")!]) {
      const one = extendToFit(near, 900, 1200, [spec]);
      expect(both.pad.top).toBeGreaterThanOrEqual(one.pad.top);
      expect(both.pad.bottom).toBeGreaterThanOrEqual(one.pad.bottom);
      expect(both.pad.left).toBeGreaterThanOrEqual(one.pad.left);
      expect(both.pad.right).toBeGreaterThanOrEqual(one.pad.right);
    }
  });

  it("ca thật: khung 3×4 đủ mà thêm 4×6 là phải nới đáy thêm", () => {
    const only34 = extendToFit(near, 900, 1200, [vn34]);
    const with46 = extendToFit(near, 900, 1200, [vn34, getDoc("vn46")!]);
    expect(with46.pad.bottom).toBeGreaterThan(only34.pad.bottom);
  });
});
