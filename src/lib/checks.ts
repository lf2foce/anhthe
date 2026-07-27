/**
 * Kết quả bước "AI kiểm tra" — hợp đồng dùng chung giữa route handler và UI.
 *
 * 6 tiêu chí do model thị giác chấm (những thứ chỉ nhìn mới biết), 2 tiêu chí
 * tính bằng số học từ landmark + kích thước ảnh. Ranh giới đó là cố ý: những gì
 * đo được thì không hỏi AI, vì AI không ổn định trên con số.
 */

import type { FaceLandmarks } from "./geometry";

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

export interface CheckItem {
  id: CheckId;
  pass: boolean;
  /** Câu giải thích ngắn hiển thị dưới tiêu chí khi không đạt */
  detail: string;
  fixable: boolean;
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

export interface CheckResult {
  landmarks: FaceLandmarks;
  imageWidth: number;
  imageHeight: number;
  checks: CheckItem[];
  fits: DocFit[];
  verdict: Verdict;
}

export function verdictOf(checks: CheckItem[]): Verdict {
  const failed = checks.filter((c) => !c.pass);
  if (failed.length === 0) return "pass";
  return failed.every((c) => c.fixable) ? "fixable" : "fail";
}

export function passCount(checks: CheckItem[]): number {
  return checks.filter((c) => c.pass).length;
}
