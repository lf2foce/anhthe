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
  /** Chiều cao đầu tính bằng pixel ảnh nguồn — KHÔNG đổi khi nới khung */
  headPx: number;
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
      headPx: 0,
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

  return {
    crop,
    headRatio: achievedHead,
    eyeFromBottom: achievedEye,
    headPx,
    errors,
  };
}

/**
 * Vị trí để VẼ dải hướng dẫn trên preview, quy về tỉ lệ 0..1 tính từ đỉnh khung.
 *
 * Vẽ một đường "đỉnh đầu ở đây" là thông tin vô dụng — người dùng không thuộc
 * chuẩn để biết thế là đúng hay sai. Vẽ DẢI cho phép kèm đường thực tế nằm
 * trong/ngoài dải thì tự nó trả lời câu hỏi duy nhất khách quan tâm: đạt chưa.
 *
 * Đường thực tế suy từ chính `CropResult` chứ không tính lại, để con số trên
 * nhãn và vị trí đường kẻ không bao giờ nói hai chuyện khác nhau.
 */
export function guideBands(
  lm: FaceLandmarks,
  spec: DocSpec,
  fit: CropResult
): {
  eye: { from: number; to: number; at: number; ok: boolean };
  crown: { from: number; to: number; at: number; ok: boolean };
} {
  // `eyeFromBottom` đo từ MÉP DƯỚI nên phải lật khi vẽ từ trên xuống.
  const eyeAt = 1 - fit.eyeFromBottom;

  // Tỉ lệ mắt nằm ở đâu trên chiều cao đầu — đo từ landmark của CHÍNH người này,
  // không dùng hằng số nhân trắc chung. Mỗi người một khác, và số đo đã có sẵn.
  const headSpan = lm.chinY - lm.crownY;
  const eyeInHead = headSpan > 0 ? (lm.eyeMidY - lm.crownY) / headSpan : 0.5;

  return {
    eye: {
      from: 1 - spec.eyeFromBottom.max,
      to: 1 - spec.eyeFromBottom.min,
      at: eyeAt,
      ok:
        fit.eyeFromBottom >= spec.eyeFromBottom.min &&
        fit.eyeFromBottom <= spec.eyeFromBottom.max,
    },
    crown: {
      from: eyeAt - spec.headRatio.max * eyeInHead,
      to: eyeAt - spec.headRatio.min * eyeInHead,
      at: eyeAt - fit.headRatio * eyeInHead,
      ok:
        fit.headRatio >= spec.headRatio.min &&
        fit.headRatio <= spec.headRatio.max,
    },
  };
}

// ── Nới khung: thêm khoảng trống quanh đầu bằng SỐ HỌC ────────────────────────

export interface CanvasPad {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface ExtendPlan {
  pad: CanvasPad;
  /** Kích thước ảnh sau khi nới */
  width: number;
  height: number;
  /** Landmark quy về hệ toạ độ ảnh MỚI — suy ra bằng phép dịch, không đo lại */
  landmarks: FaceLandmarks;
  /** Có phải nới thật không, hay ảnh đã đủ rộng */
  needed: boolean;
}

export const NO_PAD: CanvasPad = { top: 0, left: 0, right: 0, bottom: 0 };

/**
 * Tính khoảng trống cần THÊM quanh ảnh để mọi spec đã chọn crop được đúng chuẩn.
 *
 * Đây là cách đúng để sửa lỗi "ảnh gốc quá sát khuôn mặt" / "đường mắt ngoài chuẩn":
 * KHÔNG nhờ model dịch người trong khung — làm vậy là bắt nó vẽ lại chủ thể, đúng thứ
 * prompt retouch đang cấm, và là rủi ro biến dạng nhận dạng. Thay vào đó nới CANVAS
 * và lấp bằng đúng màu nền chuẩn: chỉ thêm nền, không thêm một nét nào lên người.
 *
 * Thuần số học nên landmark mới suy ra được chính xác bằng phép dịch — không cần gọi
 * model đo lại như bước thay nền.
 *
 * Chỉ dùng được khi nền ĐÃ phẳng và đúng màu; nếu không thì chỗ nới sẽ thấy đường
 * ghép. Người gọi phải tự kiểm điều đó (xem `backgroundDeviation`).
 */
export function extendToFit(
  lm: FaceLandmarks,
  imgW: number,
  imgH: number,
  specs: DocSpec[],
  headScales: Record<string, number> = {}
): ExtendPlan {
  const headPx = (lm.chinY - lm.crownY) * imgH;
  const eyePx = lm.eyeMidY * imgH;
  const centerPx = lm.faceCenterX * imgW;

  const pad: CanvasPad = { ...NO_PAD };

  if (headPx > 0) {
    for (const spec of specs) {
      const wantRatio = clamp(
        spec.headRatio.target * (headScales[spec.id] ?? 1),
        spec.headRatio.min,
        spec.headRatio.max
      );
      const cropH = headPx / wantRatio;
      const cropW = cropH * (spec.widthMm / spec.heightMm);

      // Khung MONG MUỐN, chưa bị kẹp vào ảnh — phần tràn ra ngoài chính là phần thiếu.
      const wantTop = eyePx - (1 - spec.eyeFromBottom.target) * cropH;
      const wantLeft = centerPx - cropW / 2;

      pad.top = Math.max(pad.top, Math.ceil(-wantTop));
      pad.left = Math.max(pad.left, Math.ceil(-wantLeft));
      pad.right = Math.max(pad.right, Math.ceil(wantLeft + cropW - imgW));
      pad.bottom = Math.max(pad.bottom, Math.ceil(wantTop + cropH - imgH));
    }
  }

  pad.top = Math.max(0, pad.top);
  pad.left = Math.max(0, pad.left);
  pad.right = Math.max(0, pad.right);
  pad.bottom = Math.max(0, pad.bottom);

  const width = imgW + pad.left + pad.right;
  const height = imgH + pad.top + pad.bottom;
  const needed = width !== imgW || height !== imgH;

  return {
    pad,
    width,
    height,
    // Không nới thì trả landmark NGUYÊN BẢN — công thức quy đổi với pad 0 chỉ là
    // nhân-chia lại chính nó, và sai số float làm "không đổi gì" khác "đổi 0 đơn vị".
    landmarks: needed
      ? {
          crownY: (lm.crownY * imgH + pad.top) / height,
          chinY: (lm.chinY * imgH + pad.top) / height,
          eyeMidY: (lm.eyeMidY * imgH + pad.top) / height,
          faceCenterX: (lm.faceCenterX * imgW + pad.left) / width,
        }
      : lm,
    needed,
  };
}


/**
 * Độ phân giải sau crop có đủ cho spec không — kiểm tra TRƯỚC khi phóng to,
 * vì resize lên không tạo thêm chi tiết.
 */
export function resolutionCheck(
  crop: CropBox,
  target: { width: number; height: number }
): { ok: boolean; scale: number } {
  const scale = Math.min(crop.width / target.width, crop.height / target.height);
  return { ok: scale >= 1, scale };
}
