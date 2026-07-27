/**
 * Kết luận đạt/không đạt — hợp đồng dùng chung giữa route handler và UI.
 *
 * Ranh giới cố ý: model CHỈ trả về QUAN SÁT (`CheckObservation`) — 6 điều chỉ nhìn
 * mới biết, cộng 4 landmark. Mọi thứ suy ra từ con số (tỉ lệ đầu, độ phân giải,
 * khung crop) và mọi KẾT LUẬN đều tính ở đây bằng `evaluate`, thuần hàm.
 *
 * Nhờ vậy một lần gọi model phục vụ được MỌI tập giấy tờ: người dùng tick thêm
 * loại ở màn Xuất ảnh thì kết luận tính lại tức thì, không phải chấm lại ảnh. Nếu
 * bake sẵn kết luận ở server thì mỗi lần tick là một lần gọi model, và cùng một
 * tấm ảnh sẽ cho hai quan sát khác nhau chỉ vì người dùng bấm khác.
 */

import {
  familiesOf,
  getDoc,
  outputSize,
  type DocFamily,
} from "./docs";
import {
  computeCrop,
  extendToFit,
  resolutionCheck,
  type FaceLandmarks,
} from "./geometry";

export const AI_CHECK_IDS = [
  "face_front",
  "eyes_open",
  "neutral_expression",
  "background_even",
  "lighting_even",
  "no_hat_no_glasses",
] as const;

export const COMPUTED_CHECK_IDS = ["head_ratio", "resolution"] as const;

export type AiCheckId = (typeof AI_CHECK_IDS)[number];
export type CheckId = AiCheckId | (typeof COMPUTED_CHECK_IDS)[number];

/** Thứ tự hiển thị trên màn hình kiểm tra */
export const CHECK_ORDER: CheckId[] = [
  "face_front",
  "eyes_open",
  "neutral_expression",
  "background_even",
  "lighting_even",
  "head_ratio",
  "resolution",
  "no_hat_no_glasses",
];

/**
 * Lỗi nào bước retouch sửa được bằng phần mềm. Ngoài danh sách này thì phải
 * chụp lại — không hứa suông với người dùng.
 */
export const FIXABLE: ReadonlySet<CheckId> = new Set<CheckId>([
  "background_even",
  "lighting_even",
  "head_ratio",
]);

/**
 * Tiêu chí mà ảnh chân dung nghề nghiệp KHÔNG bị đánh trượt vì.
 *
 * LinkedIn tự khai "cười nhẹ được", và đeo kính là bình thường — nên hai tiêu chí
 * này chỉ là ghi chú khi người dùng chỉ chọn ảnh chân dung.
 */
const RELAXED_FOR_PORTRAIT: readonly CheckId[] = [
  "neutral_expression",
  "no_hat_no_glasses",
];

/** Tiêu chí BẮT BUỘC theo từng họ giấy tờ. */
export const FAMILY_REQUIRED: Record<DocFamily, ReadonlySet<CheckId>> = {
  id: new Set<CheckId>(CHECK_ORDER),
  portrait: new Set<CheckId>(
    CHECK_ORDER.filter((id) => !RELAXED_FOR_PORTRAIT.includes(id))
  ),
};

/**
 * Hợp của các họ đang chọn — chọn kèm một giấy tờ tuỳ thân là siết lại toàn bộ,
 * vì tấm ảnh phải dùng được cho cả hai.
 */
export function requiredChecks(families: DocFamily[]): ReadonlySet<CheckId> {
  const out = new Set<CheckId>();
  for (const family of families) {
    for (const id of FAMILY_REQUIRED[family]) out.add(id);
  }
  return out;
}

/** Quan sát thuần — model chấm, không phụ thuộc người dùng chọn loại nào */
export interface CheckObservation {
  id: CheckId;
  pass: boolean;
  /** Câu giải thích ngắn hiển thị dưới tiêu chí khi không đạt */
  detail: string;
}

export interface CheckItem extends CheckObservation {
  fixable: boolean;
  /** Có bắt buộc với tập giấy tờ người dùng đang chọn không */
  required: boolean;
}

/** Đánh giá hình học của ảnh với MỘT loại giấy tờ */
export interface DocFit {
  docId: string;
  headRatio: number;
  eyeFromBottom: number;
  /** Ảnh gốc đủ pixel để xuất đúng kích thước yêu cầu chưa */
  resolutionOk: boolean;
  errors: string[];
}

export type Verdict = "pass" | "fixable" | "fail";

/** Những gì MODEL trả về — không có kết luận nào ở đây */
export interface PhotoCheck {
  landmarks: FaceLandmarks;
  imageWidth: number;
  imageHeight: number;
  checks: CheckObservation[];
}

export interface Compliance {
  checks: CheckItem[];
  fits: DocFit[];
  verdict: Verdict;
}

/** Chỉ tiêu chí BẮT BUỘC mới quyết định đạt/không — phần còn lại là ghi chú. */
export function verdictOf(checks: CheckItem[]): Verdict {
  const failed = checks.filter((c) => c.required && !c.pass);
  if (failed.length === 0) return "pass";
  return failed.every((c) => c.fixable) ? "fixable" : "fail";
}

export function passCount(checks: CheckItem[]): number {
  return checks.filter((c) => c.required && c.pass).length;
}

export function requiredCount(checks: CheckItem[]): number {
  return checks.filter((c) => c.required).length;
}

/**
 * Kết luận cho MỘT tập giấy tờ cụ thể.
 *
 * Thuần hàm, gọi được ở client — nên tick thêm một loại ở màn Xuất ảnh là kết luận
 * đổi ngay, kể cả khi ảnh đã chấm từ trước với tập khác. Đây là chỗ chặn cái bẫy
 * "chấm ảnh cho LinkedIn (được cười) rồi thêm visa Mỹ vào mà không ai kiểm lại".
 *
 * @param headScales hệ số tỉ lệ đầu RIÊNG từng loại; thiếu thì coi là 1 (đúng target).
 */
export function evaluate(
  check: PhotoCheck,
  docIds: string[],
  headScales: Record<string, number> = {}
): Compliance {
  const specs = docIds.map(getDoc).filter((d) => d !== undefined);

  // Nới khung ảo trước khi chấm: lỗi "quá sát khuôn mặt" / "đường mắt lệch" được
  // app tự sửa lúc xuất (thêm nền quanh đầu bằng số học), nên KHÔNG bắt người dùng
  // chụp lại vì nó — cảnh báo về thứ app tự sửa là cảnh báo sai. /api/export làm
  // đúng phép nới này bằng sharp.extend, nên dự đoán ở đây khớp file thật.
  const plan = extendToFit(
    check.landmarks,
    check.imageWidth,
    check.imageHeight,
    specs,
    headScales
  );

  const fits: DocFit[] = specs.map((spec) => {
    const { crop, headRatio, eyeFromBottom, errors } = computeCrop(
      plan.landmarks,
      plan.width,
      plan.height,
      spec,
      headScales[spec.id] ?? 1
    );
    const target = outputSize(spec, spec.digital ? "digital" : "print");
    return {
      docId: spec.id,
      headRatio,
      eyeFromBottom,
      resolutionOk: resolutionCheck(crop, target).ok,
      errors,
    };
  });

  const geometryFails = fits.filter((f) => f.errors.length > 0);
  const resolutionFails = fits.filter((f) => !f.resolutionOk);

  const computed: CheckObservation[] = [
    {
      id: "head_ratio",
      pass: geometryFails.length === 0,
      detail: geometryFails
        .map((f) => `${getDoc(f.docId)?.vi}: ${f.errors[0]}`)
        .join(" "),
    },
    {
      id: "resolution",
      pass: resolutionFails.length === 0,
      detail: resolutionFails.length
        ? `Thiếu điểm ảnh cho: ${resolutionFails
            .map((f) => getDoc(f.docId)?.vi)
            .join(", ")}. Ảnh sẽ bị phóng to và mất nét.`
        : "",
    },
  ];

  const required = requiredChecks(familiesOf(docIds));
  const byId = new Map<CheckId, CheckObservation>();
  for (const c of check.checks) byId.set(c.id, c);
  for (const c of computed) byId.set(c.id, c);

  const checks: CheckItem[] = CHECK_ORDER.filter((id) => byId.has(id)).map((id) => {
    const obs = byId.get(id)!;
    return {
      ...obs,
      fixable: FIXABLE.has(id),
      required: required.has(id),
    };
  });

  return { checks, fits, verdict: verdictOf(checks) };
}
