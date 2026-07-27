/**
 * Registry loại giấy tờ — nguồn sự thật duy nhất cho cả UI, geometry và export.
 *
 * `headRatio` / `eyeFromBottom` là RÀNG BUỘC COMPLIANCE, không phải hằng số
 * trang trí: sai một con số ở đây là ảnh bị từ chối ở quầy. Mỗi spec phải kèm
 * `source` và chỉ `verified: true` khi đã đối chiếu văn bản gốc.
 */

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
  /** Màu nền bắt buộc (hex) */
  background: string;
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
    background: "#ffffff",
    headRatio: { min: 0.5, target: 0.6, max: 0.69 },
    eyeFromBottom: { min: 0.56, target: 0.625, max: 0.69 },
    noteVi: "Nền trắng, đầu chiếm 50–69% chiều cao",
    noteEn: "White background, head 50–69% of height",
    source: "travel.state.gov — Photo Requirements (2×2 in, head 1–1⅜ in)",
    verified: true,
  },
  {
    id: "schen",
    vi: "Schengen / Hộ chiếu",
    en: "Schengen / passport",
    widthMm: 35,
    heightMm: 45,
    dpi: 300,
    dim: "3.5×4.5 cm",
    background: "#ffffff",
    headRatio: { min: 0.7, target: 0.75, max: 0.8 },
    eyeFromBottom: { min: 0.6, target: 0.66, max: 0.72 },
    noteVi: "Nhìn thẳng, biểu cảm trung tính",
    noteEn: "Face front, neutral expression",
    source: "ICAO 9303 / EU Schengen photo guide (đầu cao 32–36 mm trên 45 mm)",
    verified: false,
  },
  {
    id: "vn34",
    vi: "Ảnh thẻ 3×4",
    en: "ID photo 3×4",
    widthMm: 30,
    heightMm: 40,
    dpi: 300,
    dim: "3×4 cm",
    background: "#ffffff",
    headRatio: { min: 0.62, target: 0.7, max: 0.78 },
    eyeFromBottom: { min: 0.58, target: 0.64, max: 0.7 },
    noteVi: "Dùng cho hồ sơ, giấy tờ hành chính",
    noteEn: "For forms and paperwork",
    source: "Thông lệ ảnh thẻ VN — CHƯA đối chiếu văn bản",
    verified: false,
  },
  {
    id: "vn46",
    vi: "Ảnh thẻ 4×6",
    en: "ID photo 4×6",
    widthMm: 40,
    heightMm: 60,
    dpi: 300,
    dim: "4×6 cm",
    background: "#ffffff",
    headRatio: { min: 0.55, target: 0.62, max: 0.7 },
    eyeFromBottom: { min: 0.58, target: 0.64, max: 0.7 },
    noteVi: "Sơ yếu lý lịch, đơn từ",
    noteEn: "CVs and applications",
    source: "Thông lệ ảnh thẻ VN — CHƯA đối chiếu văn bản",
    verified: false,
  },
  {
    id: "exam",
    vi: "Thi cử · HSSV",
    en: "Exams · student",
    widthMm: 30,
    heightMm: 40,
    dpi: 300,
    dim: "3×4 cm",
    background: "#ffffff",
    headRatio: { min: 0.62, target: 0.7, max: 0.78 },
    eyeFromBottom: { min: 0.58, target: 0.64, max: 0.7 },
    noteVi: "Nền trắng, thấy rõ tai",
    noteEn: "White background, ears visible",
    source: "Thông lệ hồ sơ thi VN — CHƯA đối chiếu văn bản",
    verified: false,
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
    background: "#e9e6e0",
    headRatio: { min: 0.4, target: 0.5, max: 0.62 },
    eyeFromBottom: { min: 0.58, target: 0.64, max: 0.7 },
    noteVi: "Nền dịu, cười nhẹ được",
    noteEn: "Soft background, a light smile is fine",
    source: "Không phải giấy tờ tuỳ thân — ràng buộc do studio tự đặt",
    verified: true,
  },
];

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

/** Nền phải là nền chuẩn của giấy tờ tuỳ thân — không cho user đổi tuỳ ý */
export const BACKGROUNDS = [
  { id: "white", hex: "#ffffff", vi: "Trắng", en: "White" },
  { id: "blue", hex: "#dfe9f2", vi: "Xanh nhạt", en: "Light blue" },
  { id: "grey", hex: "#e9e6e0", vi: "Xám nhạt", en: "Light grey" },
] as const;

export type BackgroundId = (typeof BACKGROUNDS)[number]["id"];

export function bgHex(id: BackgroundId): string {
  return BACKGROUNDS.find((b) => b.id === id)?.hex ?? "#ffffff";
}
