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

/**
 * Tiêu chí mà TỪNG LOẠI cụ thể KHÔNG bị đánh trượt vì — ngoại lệ của luật họ.
 *
 * Vì sao cần: trước đây mọi giấy tờ tuỳ thân chịu chung một luật, nên đeo kính
 * là trượt cho cả bộ — kể cả khi khách chỉ làm ảnh 3×4 xin việc, nơi đeo kính là
 * bình thường. Cảnh báo sai chỗ thì khách hoặc chụp lại vô ích, hoặc học cách
 * phớt lờ cảnh báo — và lần sau phớt lờ đúng cái cảnh báo thật.
 *
 * Mỗi dòng phải có NGUỒN. Không tra được thì KHÔNG nới — mặc định là giữ
 * nguyên mức khắt khe của họ.
 */
const DOC_RELAXED: Record<string, readonly CheckId[]> = {
  // travel.state.gov: kính bị CẤM hẳn từ 01/11/2016 → us KHÔNG có tên ở đây.
  // ICAO 9303 / hướng dẫn Schengen: kính trong suốt được phép nếu thấy rõ mắt,
  // không loá, không gọng che mắt. Vậy đeo kính là GHI CHÚ, không phải trượt.
  schen: ["no_hat_no_glasses"],
  // Tờ khai TK01 ghi "không đeo kính màu" — tức kính trong suốt thì được.
  vnhc: ["no_hat_no_glasses"],
  // 3×4/4×6 dân dụng không có văn bản nào; thực tế tiệm ảnh chụp cả người đeo
  // kính. Biểu cảm cũng vậy — mỉm cười nhẹ trên ảnh hồ sơ xin việc là bình thường.
  vn34: ["no_hat_no_glasses", "neutral_expression"],
  vn46: ["no_hat_no_glasses", "neutral_expression"],
  // exam: hồ sơ thi đòi "kiểu căn cước" mà chưa tra được văn bản nói rõ về kính
  // → KHÔNG nới, giữ phía an toàn.
};

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

/**
 * Tiêu chí nào bắt buộc, và bắt buộc VÌ LOẠI NÀO.
 *
 * Trả về danh sách loại thay vì một cờ đúng/sai: khách cần biết "đeo kính thì
 * hỏng cái gì" chứ không phải "có gì đó hỏng". Rỗng = không loại nào đòi, tức
 * chỉ là ghi chú.
 */
export function requiredByDoc(docIds: string[]): Map<CheckId, string[]> {
  const out = new Map<CheckId, string[]>();
  for (const id of docIds) {
    const spec = getDoc(id);
    if (!spec) continue;
    const relaxed = DOC_RELAXED[spec.id] ?? [];
    for (const checkId of FAMILY_REQUIRED[spec.family]) {
      if (relaxed.includes(checkId)) continue;
      const list = out.get(checkId);
      if (list) list.push(spec.id);
      else out.set(checkId, [spec.id]);
    }
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
  /**
   * Những loại ĐANG CHỌN thật sự đòi tiêu chí này. Rỗng = chỉ là ghi chú.
   *
   * Có danh sách này thì UI nói được "đeo kính — hỏng Visa Mỹ" thay vì "đeo
   * kính — hỏng cái gì đó", và khách chỉ làm 3×4 thì không bị doạ vô cớ.
   */
  requiredBy: string[];
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
/**
 * Những tiêu chí mà bước thay nền GIẢI QUYẾT XONG.
 *
 * Quan sát của model là trên ảnh GỐC và không bao giờ được chấm lại (chấm lại =
 * thêm một lần gọi model cho mỗi lần thay nền). Nhưng nền mới thì đã được ĐO
 * bằng số học (`backgroundDeviation`) — đo đáng tin hơn chấm. Nên khi nền đã đo
 * là đúng chuẩn, hai tiêu chí này phải được coi là đạt; nếu không thì khách sửa
 * xong vẫn thấy "nền không đều" đỏ mãi và không hiểu phải làm gì nữa.
 */
const RESOLVED_BY_RETOUCH: readonly CheckId[] = [
  "background_even",
  "lighting_even",
];

export function evaluate(
  check: PhotoCheck,
  docIds: string[],
  headScales: Record<string, number> = {},
  /** Nền của MỌI nhóm đã thay xong và đo ra đúng màu chuẩn */
  retouchVerified = false
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

  const requiredBy = requiredByDoc(docIds);
  const byId = new Map<CheckId, CheckObservation>();
  for (const c of check.checks) {
    byId.set(
      c.id,
      retouchVerified && RESOLVED_BY_RETOUCH.includes(c.id)
        ? { ...c, pass: true, detail: "" }
        : c
    );
  }
  for (const c of computed) byId.set(c.id, c);

  const checks: CheckItem[] = CHECK_ORDER.filter((id) => byId.has(id)).map((id) => {
    const obs = byId.get(id)!;
    return {
      ...obs,
      fixable: FIXABLE.has(id),
      required: (requiredBy.get(id)?.length ?? 0) > 0,
      requiredBy: requiredBy.get(id) ?? [],
    };
  });

  return { checks, fits, verdict: verdictOf(checks) };
}
