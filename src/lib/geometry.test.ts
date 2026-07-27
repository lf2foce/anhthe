import { describe, expect, it } from "vitest";
import {
  computeCrop,
  extendToFit,
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
