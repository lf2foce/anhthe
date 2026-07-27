import { describe, expect, it } from "vitest";
import { computeCrop, resolutionCheck, type FaceLandmarks } from "./geometry";
import { getDoc, outputSize, type DocSpec } from "./docs";

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

describe("resolutionCheck", () => {
  it("phát hiện khung crop thiếu điểm ảnh so với kích thước xuất", () => {
    const target = outputSize(us, "digital");
    const small = { left: 0, top: 0, width: 300, height: 300 };
    expect(resolutionCheck(small, us, target).ok).toBe(false);
  });

  it("chấp nhận khi khung crop đủ lớn", () => {
    const target = outputSize(us, "digital");
    const big = { left: 0, top: 0, width: 1200, height: 1200 };
    expect(resolutionCheck(big, us, target).ok).toBe(true);
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
