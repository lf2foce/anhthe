/**
 * Trạng thái phiên chụp — dùng chung giữa Studio và các màn.
 *
 * Luồng: chọn MỘT loại chính (`primary`) → chụp → chỉnh cho đúng loại đó → ưng →
 * mới đẩy sang các loại khác ở màn Xuất ảnh (`picked`). `primary` luôn nằm trong
 * `picked` và không bỏ tick được, vì nó là loại tấm ảnh được chụp và canh cho.
 */

import {
  docsOf,
  familyOf,
  getDoc,
  groupByBackground,
  resolveBackground,
  type BackgroundGroup,
  type BackgroundId,
  type DocFamily,
} from "./docs";
import { evaluate, type Compliance, type PhotoCheck } from "./checks";
import type { FaceLandmarks } from "./geometry";
import type { ExportedFile, ExportGroup } from "@/app/api/export/route";

export const SCREENS = [
  "home",
  "capture",
  "check",
  "edit",
  "export",
  "done",
] as const;

export type Screen = (typeof SCREENS)[number];

/** Ảnh đang dùng để xuất — hoặc ảnh gốc, hoặc bản đã thay nền */
export interface Working {
  photo: string;
  landmarks: FaceLandmarks;
  width: number;
  height: number;
  /**
   * Nền đã đo được là ĐÚNG màu chuẩn chưa. `undefined` = ảnh gốc, chưa qua thay
   * nền nên chưa có gì để khẳng định.
   */
  backgroundOk?: boolean;
  backgroundDeviation?: number;
}

export interface StudioState {
  screen: Screen;
  /** Loại giấy tờ tấm ảnh được chụp và canh cho */
  primary: string;
  /** Toàn bộ loại sẽ xuất — luôn chứa `primary` */
  picked: string[];

  /** Ảnh gốc (data URL) từ camera hoặc file */
  photo: string | null;

  check: PhotoCheck | null;
  checking: boolean;

  /**
   * Nền người dùng thích. CHỈ được áp cho spec nào cho phép màu đó — spec vẫn là
   * người quyết định, xem `resolveBackground`.
   */
  bgPref: BackgroundId | null;
  brightness: number;
  /**
   * Hệ số kéo tỉ lệ đầu, RIÊNG từng loại giấy tờ.
   *
   * Không dùng một giá trị chung: mỗi spec có target và dải cho phép khác nhau, nên
   * "kéo lên 10%" mang nghĩa khác nhau ở từng loại. Một thanh trượt dùng chung sẽ
   * âm thầm đổi cả những loại người dùng không xem tới.
   */
  headScales: Record<string, number>;
  smooth: boolean;
  /**
   * Làm nét khi xuất file. Tích chập thuần, không gọi model — nên đổi cờ này KHÔNG
   * làm mất bản đã thay nền.
   */
  sharpen: boolean;
  /** Một bản đã thay nền cho MỖI màu nền cần dùng trong phiên */
  retouched: Partial<Record<BackgroundId, Working>>;
  retouching: boolean;

  sheet: boolean;
  sheetDocId: string | null;
  files: ExportedFile[] | null;
  exporting: boolean;

  error: string | null;
}

export const DEFAULT_PRIMARY = "vn34";

export const INITIAL: StudioState = {
  screen: "home",
  primary: DEFAULT_PRIMARY,
  picked: [DEFAULT_PRIMARY],
  photo: null,
  check: null,
  checking: false,
  bgPref: null,
  brightness: 0,
  headScales: {},
  smooth: true,
  sharpen: false,
  retouched: {},
  retouching: false,
  sheet: true,
  sheetDocId: null,
  files: null,
  exporting: false,
  error: null,
};

export function headScaleOf(s: StudioState, docId: string): number {
  return s.headScales[docId] ?? 1;
}

/**
 * Chế độ đang chạy = họ của loại chính. KHÔNG lưu riêng: hai nguồn sự thật cho cùng
 * một thứ là chỗ sinh trạng thái vô nghĩa (chế độ "giấy tờ" mà loại chính là LinkedIn).
 */
export function mode(s: StudioState): DocFamily {
  return familyOf(s.primary);
}

/** Những loại chọn được trong chế độ hiện tại */
export function docsInMode(s: StudioState) {
  return docsOf(mode(s));
}

/** Ảnh gốc kèm landmark đo ở bước kiểm tra — chưa thay nền */
export function originalWorking(s: StudioState): Working | null {
  if (!s.photo || !s.check) return null;
  return {
    photo: s.photo,
    landmarks: s.check.landmarks,
    width: s.check.imageWidth,
    height: s.check.imageHeight,
  };
}

/**
 * Ảnh dùng cho crop/xuất MỘT loại giấy tờ: ưu tiên bản đã thay nền đúng màu của
 * loại đó, vì landmark bản đó đã được đo lại trên chính nó.
 */
export function workingFor(s: StudioState, docId: string): Working | null {
  const original = originalWorking(s);
  const spec = getDoc(docId);
  if (!spec) return original;
  return s.retouched[resolveBackground(spec, s.bgPref)] ?? original;
}

/** Nhóm nền cần cho tập giấy tờ đang chọn — mỗi nhóm là một lần gọi model */
export function retouchGroups(s: StudioState): BackgroundGroup[] {
  return groupByBackground(s.picked, s.bgPref);
}

/** Nhóm chưa có bản thay nền — đúng số lần còn phải gọi model */
export function pendingGroups(s: StudioState): BackgroundGroup[] {
  return retouchGroups(s).filter((g) => !s.retouched[g.background]);
}

/**
 * Nhóm ĐÃ chạy thay nền nhưng đo ra nền vẫn sai màu.
 *
 * Đây là trường hợp model trả về ảnh mà không thật sự đổi nền. Phải tách khỏi
 * `pendingGroups` vì nó đã tốn một lần gọi model rồi, và phải nói thẳng ra chứ
 * không được hiện dấu tích xanh.
 */
export function failedBackgrounds(s: StudioState): BackgroundId[] {
  return retouchGroups(s)
    .filter((g) => s.retouched[g.background]?.backgroundOk === false)
    .map((g) => g.background);
}

/**
 * Kết luận đạt/trượt cho tập giấy tờ ĐANG chọn.
 *
 * Tính lại mỗi lần `picked` đổi — nên tick thêm visa Mỹ vào một ảnh đã chấm cho
 * LinkedIn là verdict siết lại ngay, không cần gọi lại model.
 */
export function compliance(s: StudioState): Compliance | null {
  if (!s.check) return null;
  return evaluate(s.check, s.picked, s.headScales, retouchVerified(s));
}

/**
 * MỌI nhóm nền đã thay xong VÀ đo ra đúng màu chuẩn.
 *
 * Phải đủ cả hai vế và phải đúng cho MỌI nhóm: còn một nhóm chưa thay, hoặc một
 * nhóm thay rồi mà đo ra sai màu, thì kết luận về nền vẫn phải giữ nguyên là chưa đạt.
 */
export function retouchVerified(s: StudioState): boolean {
  const groups = retouchGroups(s);
  if (groups.length === 0) return false;
  return groups.every((g) => s.retouched[g.background]?.backgroundOk === true);
}

/** Payload cho /api/export: mỗi nhóm nền kèm ảnh và landmark của chính nó */
export function exportGroups(s: StudioState): ExportGroup[] {
  const original = originalWorking(s);
  if (!original) return [];
  return retouchGroups(s).map((g) => {
    const working = s.retouched[g.background] ?? original;
    return {
      photo: working.photo,
      landmarks: working.landmarks,
      background: g.background,
      docIds: g.docIds,
    };
  });
}

export function fileCount(s: StudioState): number {
  return s.picked.length + (s.sheet ? 1 : 0);
}
