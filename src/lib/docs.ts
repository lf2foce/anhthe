/**
 * Registry loại giấy tờ — nguồn sự thật duy nhất cho cả UI, geometry và export.
 *
 * `headRatio` / `eyeFromBottom` / `backgrounds` là RÀNG BUỘC COMPLIANCE, không
 * phải hằng số trang trí: sai một con số ở đây là ảnh bị từ chối ở quầy. Mỗi spec
 * phải kèm `source` và chỉ `verified: true` khi đã đối chiếu văn bản gốc.
 */

/**
 * Nền được phép dùng. Đây là danh mục ĐÓNG: mỗi spec chỉ chọn trong đây, và người
 * dùng chỉ chọn trong phạm vi spec cho phép — xem `resolveBackground`.
 */
export const BACKGROUNDS = [
  { id: "white", hex: "#ffffff", vi: "Trắng", en: "White" },
  // Ảnh thẻ VN dùng phông xanh ĐẬM, không phải xanh nhạt. Sắc độ chính xác
  // CHƯA đối chiếu văn bản — cùng diện `verified: false` với vn34/vn46.
  { id: "blue", hex: "#1f5aa6", vi: "Xanh đậm", en: "Dark blue" },
  { id: "grey", hex: "#e9e6e0", vi: "Xám nhạt", en: "Light grey" },
] as const;

export type BackgroundId = (typeof BACKGROUNDS)[number]["id"];

export function bgHex(id: BackgroundId): string {
  return BACKGROUNDS.find((b) => b.id === id)?.hex ?? "#ffffff";
}

export function isBackgroundId(v: unknown): v is BackgroundId {
  return BACKGROUNDS.some((b) => b.id === v);
}

/**
 * Họ giấy tờ — quyết định mức khắt khe khi KẾT LUẬN, không phải khi đo.
 *
 * `id`   giấy tờ tuỳ thân: chuẩn hộ chiếu, miệng khép, không mũ không kính.
 * `portrait` ảnh chân dung dùng cho hồ sơ nghề nghiệp: cười nhẹ và đeo kính đều
 *            được, nên hai tiêu chí đó không được phép đánh trượt ảnh.
 *
 * Đây là trục KHÁC với tỉ lệ đầu. Hai spec cùng họ vẫn có thể khác `headRatio`,
 * và điều đó không xung đột: mỗi spec tự cắt khung riêng từ cùng một ảnh nguồn.
 */
export type DocFamily = "id" | "portrait";

export const DOC_FAMILIES = [
  {
    id: "id",
    vi: "Giấy tờ tuỳ thân",
    en: "Identity documents",
    subVi: "Visa, hộ chiếu, ảnh thẻ, hồ sơ thi",
    subEn: "Visas, passports, ID photos, exams",
  },
  {
    id: "portrait",
    vi: "Ảnh chân dung",
    en: "Portrait",
    subVi: "LinkedIn, CV, ảnh profile — được sửa thoải mái hơn",
    subEn: "LinkedIn, CV, profile shots — far more editing allowed",
  },
] as const satisfies readonly { id: DocFamily; [k: string]: string }[];

/**
 * Bộ công cụ AI mở cho từng họ.
 *
 * Đây là RÀNG BUỘC, không phải cấu hình UI: đổi quần áo hay làm đẹp trên ảnh giấy
 * tờ tuỳ thân là sửa nội dung ảnh nhận dạng, và upscale sinh ảnh thì BỊA THÊM chi
 * tiết mặt. Ảnh chân dung nghề nghiệp không phải giấy tờ pháp lý nên không vướng.
 *
 * `/api/retouch` đọc bảng này để LỌC tuỳ chọn client gửi lên — không tin client.
 */
export interface AiToolkit {
  /** Đổi quần áo (vest, sơ mi…) */
  outfit: boolean;
  /** Làm đẹp: đều màu da, sáng mắt */
  polish: boolean;
  /** Sinh lại ở độ phân giải cao hơn — bịa thêm chi tiết */
  hiRes: boolean;
}

export const FAMILY_TOOLKIT: Record<DocFamily, AiToolkit> = {
  id: { outfit: false, polish: false, hiRes: false },
  portrait: { outfit: true, polish: true, hiRes: true },
};

/**
 * Loại giấy tờ này có cho phép AI THAY TRANG PHỤC không.
 *
 * Đây là ngoại lệ per-spec của `FAMILY_TOOLKIT.id`, và ranh giới KHÔNG phải sở
 * thích mà là luật của nơi nhận ảnh:
 *
 * - Giấy tờ do NHÀ NƯỚC cấp/nhận (visa Mỹ, Schengen, hộ chiếu, hồ sơ thi) cấm
 *   tường minh việc chỉnh sửa số hoá làm thay đổi diện mạo. Ảnh sửa áo bị phát
 *   hiện là hồ sơ bị từ chối, và khách mất nhiều hơn tiền mua ảnh.
 * - Ảnh 3×4 / 4×6 dân dụng (hồ sơ xin việc, sơ yếu lý lịch) KHÔNG có văn bản
 *   nào — tiệm ảnh sửa áo bằng Photoshop mỗi ngày, và đây chính là thứ khách
 *   trả tiền để có. Đổi áo ở đây còn giúp tăng tỉ lệ đạt: áo trắng trên nền
 *   trắng là lỗi hay bị trả nhất.
 *
 * Mặc định là KHÔNG cho — thêm loại mới mà quên khai thì nó rơi về phía an toàn.
 */
export const OUTFIT_ALLOWED: ReadonlySet<string> = new Set(["vn34", "vn46"]);

export const OUTFITS = [
  { id: "keep", vi: "Giữ nguyên", en: "Keep as is" },
  { id: "shirt", vi: "Sơ mi trắng", en: "White shirt" },
  { id: "suit", vi: "Vest tối màu", en: "Dark suit" },
  { id: "blazer", vi: "Blazer lịch sự", en: "Smart blazer" },
] as const;

export type OutfitId = (typeof OUTFITS)[number]["id"];

export function isOutfitId(v: unknown): v is OutfitId {
  return OUTFITS.some((o) => o.id === v);
}

export interface DocSpec {
  id: string;
  vi: string;
  en: string;
  /** Kích thước in vật lý */
  widthMm: number;
  heightMm: number;
  dpi: number;
  /** Nhãn kích thước hiển thị cho người dùng */
  dim: string;
  /** Kích thước file nộp online, nếu khác kích thước in */
  digital?: { width: number; height: number };
  family: DocFamily;
  /** Nền được phép, phần tử ĐẦU là mặc định. Không bao giờ rỗng. */
  backgrounds: readonly BackgroundId[];
  /** (đỉnh đầu → cằm) / chiều cao ảnh */
  headRatio: { min: number; target: number; max: number };
  /** Đường mắt tính từ MÉP DƯỚI / chiều cao ảnh */
  eyeFromBottom: { min: number; target: number; max: number };
  noteVi: string;
  noteEn: string;
  source: string;
  verified: boolean;
}

export const DOCS: DocSpec[] = [
  {
    id: "us",
    vi: "Visa Mỹ",
    en: "US visa",
    widthMm: 51,
    heightMm: 51,
    dpi: 300,
    dim: "2×2 in (51×51 mm)",
    digital: { width: 600, height: 600 },
    family: "id",
    backgrounds: ["white"],
    headRatio: { min: 0.5, target: 0.6, max: 0.69 },
    eyeFromBottom: { min: 0.56, target: 0.625, max: 0.69 },
    noteVi: "Nền trắng, đầu chiếm 50–69% chiều cao",
    noteEn: "White background, head 50–69% of height",
    source: "travel.state.gov — Photo Requirements (2×2 in, head 1–1⅜ in, nền trắng/trắng ngà)",
    verified: true,
  },
  {
    id: "schen",
    vi: "Visa Schengen",
    en: "Schengen visa",
    widthMm: 35,
    heightMm: 45,
    dpi: 300,
    family: "id",
    // Một số nước Schengen nhận nền xám nhạt, nhưng chưa đối chiếu được từng
    // nước nên chỉ để trắng — cho phép rộng hơn chuẩn là đẩy rủi ro sang khách.
    backgrounds: ["white"],
    dim: "3.5×4.5 cm",
    headRatio: { min: 0.7, target: 0.75, max: 0.8 },
    eyeFromBottom: { min: 0.6, target: 0.66, max: 0.72 },
    noteVi: "Nhìn thẳng, biểu cảm trung tính",
    noteEn: "Face front, neutral expression",
    source:
      "ICAO Doc 9303 / hướng dẫn ảnh Schengen: 35×45 mm, đầu cao 32–36 mm (≈70–80%) — khớp dải trong spec. Đối chiếu 07/2026.",
    verified: true,
  },
  {
    // Hộ chiếu VN là loại RIÊNG, không dùng chung với 3.5×4.5: mẫu TK01 đòi
    // 4×6 nền trắng — nhãn cũ "Schengen / Hộ chiếu" từng dắt khách sai khổ.
    id: "vnhc",
    vi: "Hộ chiếu VN",
    en: "VN passport",
    widthMm: 40,
    heightMm: 60,
    dpi: 300,
    dim: "4×6 cm",
    family: "id",
    backgrounds: ["white"],
    headRatio: { min: 0.7, target: 0.75, max: 0.8 },
    eyeFromBottom: { min: 0.55, target: 0.62, max: 0.7 },
    noteVi: "Nền trắng, đầu để trần, ảnh chụp không quá 6 tháng",
    noteEn: "White background, head uncovered, photo under 6 months old",
    source:
      "Tờ khai TK01 + hướng dẫn Cổng DVC (hộ chiếu phổ thông): 4×6 cm, nền trắng, mặt nhìn thẳng, đầu trần, không kính màu, ảnh ≤ 6 tháng; mặt chiếm 70–80% — đối chiếu 07/2026. Dải đường mắt suy từ ICAO 9303, văn bản VN không quy định.",
    verified: true,
  },
  {
    id: "vn34",
    vi: "Ảnh thẻ 3×4",
    en: "ID photo 3×4",
    widthMm: 30,
    heightMm: 40,
    dpi: 300,
    dim: "3×4 cm",
    family: "id",
    backgrounds: ["white", "blue"],
    headRatio: { min: 0.62, target: 0.7, max: 0.78 },
    eyeFromBottom: { min: 0.58, target: 0.64, max: 0.7 },
    noteVi: "Dùng cho hồ sơ, giấy tờ hành chính",
    noteEn: "For forms and paperwork",
    source:
      "Đối chiếu 07/2026: KHÔNG tồn tại văn bản quy định chung cho ảnh 3×4 dân dụng — đây là thông lệ tiệm ảnh (nền trắng hoặc xanh đậm; sắc độ xanh #1f5aa6 do studio chọn). Số đo do studio đặt trong dải thông lệ.",
    verified: true,
  },
  {
    id: "vn46",
    vi: "Ảnh thẻ 4×6",
    en: "ID photo 4×6",
    widthMm: 40,
    heightMm: 60,
    dpi: 300,
    dim: "4×6 cm",
    family: "id",
    backgrounds: ["white", "blue"],
    headRatio: { min: 0.55, target: 0.62, max: 0.7 },
    eyeFromBottom: { min: 0.58, target: 0.64, max: 0.7 },
    noteVi: "Sơ yếu lý lịch, đơn từ — làm hộ chiếu thì chọn loại Hộ chiếu VN",
    noteEn: "CVs and forms — for a passport use the VN passport type",
    source:
      "Đối chiếu 07/2026: ảnh 4×6 hồ sơ dân dụng không có văn bản chung — thông lệ tiệm ảnh (nền trắng hoặc xanh đậm; sắc độ xanh do studio chọn). Hộ chiếu có chuẩn riêng — xem loại vnhc.",
    verified: true,
  },
  {
    id: "exam",
    vi: "Thi cử · HSSV",
    en: "Exams · student",
    widthMm: 40,
    heightMm: 60,
    dpi: 300,
    dim: "4×6 cm",
    // Quy chế đòi ảnh upload ≥ 400×600 px — xuất digital dư một bậc cho an toàn.
    digital: { width: 480, height: 720 },
    family: "id",
    backgrounds: ["white"],
    headRatio: { min: 0.7, target: 0.75, max: 0.8 },
    eyeFromBottom: { min: 0.55, target: 0.62, max: 0.7 },
    noteVi: "Thi THPT/ĐH: 4×6 kiểu căn cước, ảnh không quá 6 tháng",
    noteEn: "VN exams: 4×6 ID-style, photo under 6 months old",
    source:
      "Quy chế thi tốt nghiệp THPT (đăng ký dự thi): ảnh 4×6 kiểu căn cước, chụp ≤ 6 tháng, tối thiểu 400×600 px; nền KHÔNG quy định — để trắng cho an toàn. Đối chiếu 07/2026. (Ảnh 3×4 chỉ là thông lệ thẻ HSSV cũ.)",
    verified: true,
  },
  {
    id: "link",
    vi: "LinkedIn / CV",
    en: "LinkedIn / CV",
    widthMm: 51,
    heightMm: 51,
    dpi: 300,
    dim: "1:1 vuông",
    digital: { width: 1200, height: 1200 },
    family: "portrait",
    backgrounds: ["grey", "white"],
    headRatio: { min: 0.4, target: 0.5, max: 0.62 },
    eyeFromBottom: { min: 0.58, target: 0.64, max: 0.7 },
    noteVi: "Nền dịu, cười nhẹ được",
    noteEn: "Soft background, a light smile is fine",
    source: "Không phải giấy tờ tuỳ thân — ràng buộc do studio tự đặt",
    verified: true,
  },
  {
    id: "profile45",
    vi: "Chân dung dọc 4:5",
    en: "Portrait 4:5",
    widthMm: 40,
    heightMm: 50,
    dpi: 300,
    dim: "4:5 dọc",
    digital: { width: 1080, height: 1350 },
    family: "portrait",
    backgrounds: ["grey", "white"],
    // Khung rộng hơn LinkedIn: ảnh dọc thấy cả vai, đầu chiếm ít hơn.
    headRatio: { min: 0.32, target: 0.42, max: 0.52 },
    eyeFromBottom: { min: 0.62, target: 0.68, max: 0.74 },
    noteVi: "Thấy vai, dùng cho profile & portfolio",
    noteEn: "Shows shoulders, for profiles and portfolios",
    source: "Không phải giấy tờ tuỳ thân — ràng buộc do studio tự đặt",
    verified: true,
  },
];

/** Loại giấy tờ thuộc một họ — dùng cho danh sách ở trang chủ và màn Xuất ảnh */
export function docsOf(family: DocFamily): DocSpec[] {
  return DOCS.filter((d) => d.family === family);
}

/**
 * Họ của một loại giấy tờ. Đây là NGUỒN SỰ THẬT cho chế độ đang chạy — không lưu
 * `mode` riêng, vì hai nguồn sự thật cho cùng một thứ là chỗ sinh trạng thái vô nghĩa
 * (chế độ "giấy tờ" mà loại chính là LinkedIn).
 */
export function familyOf(docId: string): DocFamily {
  return getDoc(docId)?.family ?? "id";
}

/**
 * Lọc tuỳ chọn retouch theo họ. Gọi ở SERVER trước khi dựng prompt — client gửi gì
 * cũng không mở được vest cho ảnh visa.
 */
export function sanitizeRetouch(
  spec: DocSpec,
  requested: { outfit?: OutfitId; polish?: boolean; hiRes?: boolean }
): { outfit: OutfitId; polish: boolean; hiRes: boolean } {
  const toolkit = FAMILY_TOOLKIT[spec.family];
  // Trang phục có ngoại lệ per-spec; `polish`/`hiRes` thì KHÔNG — làm thon mặt
  // hay vẽ lại ở 2K là sửa chính khuôn mặt, không loại giấy tờ nào cho.
  const canOutfit = toolkit.outfit || OUTFIT_ALLOWED.has(spec.id);
  return {
    outfit:
      canOutfit && isOutfitId(requested.outfit) ? requested.outfit : "keep",
    polish: toolkit.polish && !!requested.polish,
    hiRes: toolkit.hiRes && !!requested.hiRes,
  };
}

export const DOC_IDS = DOCS.map((d) => d.id);

export function getDoc(id: string): DocSpec | undefined {
  return DOCS.find((d) => d.id === id);
}

export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi);
}

/** Kích thước pixel đầu ra của một spec (bản in, hoặc bản digital nếu có) */
export function outputSize(
  spec: DocSpec,
  variant: "print" | "digital" = "print"
): { width: number; height: number } {
  if (variant === "digital" && spec.digital) return spec.digital;
  return {
    width: mmToPx(spec.widthMm, spec.dpi),
    height: mmToPx(spec.heightMm, spec.dpi),
  };
}

/** Nhãn "413×531 px · 300dpi" cho UI */
export function pxLabel(spec: DocSpec): string {
  const { width, height } = outputSize(spec, spec.digital ? "digital" : "print");
  return `${width}×${height} px · ${spec.dpi}dpi`;
}

// ── Nền: spec quyết định, người dùng chỉ chọn trong phạm vi được phép ──────────

/**
 * Nền thật sẽ dùng cho một spec.
 *
 * Lựa chọn của người dùng chỉ được tôn trọng khi spec CHO PHÉP màu đó; ngược lại
 * rơi về mặc định của spec. Nhờ vậy không có đường nào để xuất ra visa Mỹ nền xanh.
 */
export function resolveBackground(
  spec: DocSpec,
  pref: BackgroundId | null
): BackgroundId {
  if (pref && spec.backgrounds.includes(pref)) return pref;
  return spec.backgrounds[0];
}

/** Những nền mà ÍT NHẤT một trong các spec đang chọn cho phép */
export function allowedBackgrounds(docIds: string[]): BackgroundId[] {
  const out = new Set<BackgroundId>();
  for (const id of docIds) {
    for (const bg of getDoc(id)?.backgrounds ?? []) out.add(bg);
  }
  return BACKGROUNDS.filter((b) => out.has(b.id)).map((b) => b.id);
}

export interface BackgroundGroup {
  background: BackgroundId;
  hex: string;
  docIds: string[];
}

/**
 * Gom giấy tờ theo nền đã resolve.
 *
 * Mỗi nhóm là MỘT lần gọi model thay nền: một tấm ảnh chỉ có một màu nền, nên
 * không thể dùng bản nền trắng cho loại giấy tờ đòi nền xám. Thứ tự nhóm theo
 * BACKGROUNDS để kết quả không phụ thuộc thứ tự người dùng bấm chọn.
 */
export function groupByBackground(
  docIds: string[],
  pref: BackgroundId | null
): BackgroundGroup[] {
  const groups = new Map<BackgroundId, string[]>();
  for (const id of docIds) {
    const spec = getDoc(id);
    if (!spec) continue;
    const bg = resolveBackground(spec, pref);
    const list = groups.get(bg);
    if (list) list.push(id);
    else groups.set(bg, [id]);
  }
  return BACKGROUNDS.filter((b) => groups.has(b.id)).map((b) => ({
    background: b.id,
    hex: b.hex,
    docIds: groups.get(b.id) ?? [],
  }));
}

/** Các họ có mặt trong tập giấy tờ đang chọn */
export function familiesOf(docIds: string[]): DocFamily[] {
  const out = new Set<DocFamily>();
  for (const id of docIds) {
    const spec = getDoc(id);
    if (spec) out.add(spec.family);
  }
  return [...out];
}
