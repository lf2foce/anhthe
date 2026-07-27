/**
 * Geometry engine — biến landmark khuôn mặt thành khung crop đúng ràng buộc
 * hình học của từng spec (tỉ lệ đầu, đường mắt).
 *
 * Đây là phần KHÔNG giao cho AI: model sinh ảnh không đảm bảo được "đầu chiếm
 * đúng 60% chiều cao ở 600×600 px". AI chỉ đo landmark và sửa nền; mọi con số
 * quyết định đạt/không đạt được tính ở đây rồi cắt bằng sharp.
 *
 * Thuần hàm, không đụng DOM/sharp — test được độc lập.
 */

import type { DocSpec } from "./docs";

/** Landmark chuẩn hoá 0..1 theo chiều rộng/cao ảnh gốc, gốc toạ độ góc trên-trái */
export interface FaceLandmarks {
  /** y đỉnh đầu, tính cả tóc */
  crownY: number;
  /** y cằm */
  chinY: number;
  /** y trung điểm hai mắt */
  eyeMidY: number;
  /** x trung điểm khuôn mặt */
  faceCenterX: number;
}

export interface CropBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CropResult {
  crop: CropBox;
  /** Tỉ lệ đầu thực tế đạt được sau crop */
  headRatio: number;
  /** Đường mắt từ mép dưới sau crop */
  eyeFromBottom: number;
  /** Lý do ảnh KHÔNG dùng được cho spec này (crop tràn khỏi ảnh gốc…) */
  errors: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Tính khung crop.
 *
 * @param headScale hệ số người dùng kéo tỉ lệ đầu quanh target (1 = đúng target).
 *        Kết quả luôn bị kẹp lại trong [min, max] của spec — thanh trượt không
 *        bao giờ kéo được ảnh ra ngoài chuẩn.
 */
export function computeCrop(
  lm: FaceLandmarks,
  imgW: number,
  imgH: number,
  spec: DocSpec,
  headScale = 1
): CropResult {
  const errors: string[] = [];

  const headPx = (lm.chinY - lm.crownY) * imgH;
  if (!(headPx > 0)) {
    return {
      crop: { left: 0, top: 0, width: imgW, height: imgH },
      headRatio: 0,
      eyeFromBottom: 0,
      errors: ["Không đo được chiều cao đầu (landmark không hợp lệ)."],
    };
  }

  const wantRatio = clamp(
    spec.headRatio.target * headScale,
    spec.headRatio.min,
    spec.headRatio.max
  );

  let cropH = headPx / wantRatio;
  let cropW = cropH * (spec.widthMm / spec.heightMm);

  // Ảnh gốc không đủ rộng/cao để lấy được khung — thu nhỏ khung theo cạnh
  // chật nhất rồi báo lỗi, vì tỉ lệ đầu sẽ vượt chuẩn.
  if (cropW > imgW || cropH > imgH) {
    const fit = Math.min(imgW / cropW, imgH / cropH);
    cropW *= fit;
    cropH *= fit;
    errors.push(
      "Ảnh gốc quá sát khuôn mặt — cần chụp lùi ra để còn khoảng trống quanh đầu."
    );
  }

  const eyePx = lm.eyeMidY * imgH;
  let top = eyePx - (1 - spec.eyeFromBottom.target) * cropH;
  let left = lm.faceCenterX * imgW - cropW / 2;

  top = clamp(top, 0, imgH - cropH);
  left = clamp(left, 0, imgW - cropW);

  const crop: CropBox = {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(cropW),
    height: Math.round(cropH),
  };

  const achievedHead = headPx / crop.height;
  const achievedEye = (crop.top + crop.height - eyePx) / crop.height;

  if (achievedHead < spec.headRatio.min || achievedHead > spec.headRatio.max) {
    errors.push(
      `Tỉ lệ đầu ${(achievedHead * 100).toFixed(0)}% nằm ngoài chuẩn ${(
        spec.headRatio.min * 100
      ).toFixed(0)}–${(spec.headRatio.max * 100).toFixed(0)}%.`
    );
  }
  if (
    achievedEye < spec.eyeFromBottom.min ||
    achievedEye > spec.eyeFromBottom.max
  ) {
    errors.push(
      `Đường mắt ${(achievedEye * 100).toFixed(
        0
      )}% từ mép dưới, ngoài chuẩn ${(spec.eyeFromBottom.min * 100).toFixed(
        0
      )}–${(spec.eyeFromBottom.max * 100).toFixed(0)}%.`
    );
  }

  return { crop, headRatio: achievedHead, eyeFromBottom: achievedEye, errors };
}

/**
 * Độ phân giải sau crop có đủ cho spec không — kiểm tra TRƯỚC khi phóng to,
 * vì resize lên không tạo thêm chi tiết.
 */
export function resolutionCheck(
  crop: CropBox,
  spec: DocSpec,
  target: { width: number; height: number }
): { ok: boolean; scale: number } {
  const scale = Math.min(crop.width / target.width, crop.height / target.height);
  return { ok: scale >= 1, scale };
}
