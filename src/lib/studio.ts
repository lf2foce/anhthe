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
  type OutfitId,
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
  /**
   * Mịn da NHẸ trong lệnh chuẩn hoá. Luồng ảnh thẻ KHÔNG còn toggle cho nó —
   * mịn nhẹ là một phần của mẫu chuẩn chung (như tiệm ảnh, không ai hỏi khách
   * chọn mức da), nên giá trị này đứng yên ở true. Giữ trong state + variantKey
   * vì nó vẫn là tham số THẬT của lệnh model — nguồn sự thật của version.
   */
  smooth: boolean;
  /**
   * Trang phục AI mặc cho khách. CHỈ áp cho loại giấy tờ được registry cho phép
   * (`OUTFIT_ALLOWED`) — server lọc lại lần nữa, client không mở được cửa này.
   */
  outfit: OutfitId;
  /**
   * Làm nét khi xuất file. Tích chập thuần, không gọi model — nên đổi cờ này KHÔNG
   * làm mất bản đã thay nền.
   */
  sharpen: boolean;
  /**
   * Cache VERSION: mỗi bộ tuỳ chọn AI = một bản ảnh riêng, key từ `variantKey`.
   *
   * Model không tất định — chạy lại cùng yêu cầu KHÔNG ra cùng ảnh — nên đây
   * không phải tối ưu tiết kiệm lượt mà là thứ duy nhất làm cho toggle ổn định:
   * tắt "Làm mịn da" rồi bật lại phải trả về ĐÚNG bản đã ưng, không phải một bản
   * mới hên xui. Bản cũ không bao giờ bị xoá vì đổi tuỳ chọn; chỉ ảnh gốc mới
   * (chụp lại) mới làm cache vô nghĩa.
   */
  retouched: Partial<Record<string, Working>>;
  retouching: boolean;

  sheet: boolean;
  sheetDocId: string | null;
  files: ExportedFile[] | null;
  /** Phiên xuất file — gom ảnh cùng lượt vào một thư mục trên kho */
  exportSessionId: string | null;
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
  outfit: "keep",
  sharpen: false,
  retouched: {},
  retouching: false,
  sheet: true,
  sheetDocId: null,
  files: null,
  exportSessionId: null,
  exporting: false,
  error: null,
};

export function headScaleOf(s: StudioState, docId: string): number {
  return s.headScales[docId] ?? 1;
}

/**
 * Key version cho một nền theo TUỲ CHỌN ĐANG BẬT.
 *
 * Chỉ những tham số THẬT SỰ đổi lệnh gửi model mới được vào key — thêm thứ không
 * đổi ảnh (sharpen chạy lúc xuất, brightness là CSS/sharp) là tự làm cache trượt
 * vô ích. `evenLighting` cũng không vào key: nó suy từ kết quả kiểm tra của TẤM
 * ẢNH, mà đổi ảnh thì cache đã bị xoá toàn bộ ở runCheck rồi — trong đời một
 * cache, nó là hằng số.
 */
export function variantKey(s: StudioState, bg: BackgroundId): string {
  return `${bg}/${s.smooth ? "smooth" : "plain"}/${s.outfit}`;
}

/** Bản đã chuẩn hoá của nền này Ở BỘ TUỲ CHỌN HIỆN TẠI — thiếu nghĩa là chưa sinh */
export function variantOf(
  s: StudioState,
  bg: BackgroundId
): Working | undefined {
  return s.retouched[variantKey(s, bg)];
}

/**
 * Bản GẦN NHẤT để HIỂN THỊ: đúng version, không có thì version anh em (cùng
 * nền, khác mỗi tuỳ chọn mịn).
 *
 * Chỉ dành cho preview. Bật mịn da khi bản-có-mịn chưa sinh mà preview rơi
 * thẳng về ảnh gốc nền phòng khách thì đọc ra là "mất trắng công chuẩn hoá" —
 * trong khi bản không-mịn vẫn nằm trong cache và khác bản đích đúng một lớp da.
 * Mọi kết luận (pending, verified, block, payload xuất) vẫn đi qua `variantOf`
 * nghiêm ngặt — hiển thị được phép gần đúng, cam kết thì không.
 */
export function nearestWorking(
  s: StudioState,
  bg: BackgroundId
): Working | undefined {
  // Bản "anh em" gần nhất: cùng nền và cùng trang phục, chỉ khác lớp da. Đổi
  // TRANG PHỤC thì không có anh em nào cả — ảnh mặc áo khác là ảnh khác hẳn,
  // hiện tạm nó lên là nói dối về thứ khách sắp nhận.
  return (
    variantOf(s, bg) ??
    s.retouched[`${bg}/${s.smooth ? "plain" : "smooth"}/${s.outfit}`]
  );
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
 * Ảnh để HIỂN THỊ cho một loại giấy tờ: đúng version → version anh em → ảnh gốc.
 *
 * Đây là hàm của preview, không phải của cam kết: payload xuất thật nằm ở
 * `exportGroups` (nghiêm ngặt theo version), và nút Xuất bị `exportBlock` khoá
 * tới khi đúng version tồn tại — nên hiển thị gần đúng không giao nhầm file.
 */
export function workingFor(s: StudioState, docId: string): Working | null {
  const original = originalWorking(s);
  const spec = getDoc(docId);
  if (!spec) return original;
  return nearestWorking(s, resolveBackground(spec, s.bgPref)) ?? original;
}

/** Nhóm nền cần cho tập giấy tờ đang chọn — mỗi nhóm là một lần gọi model */
export function retouchGroups(s: StudioState): BackgroundGroup[] {
  return groupByBackground(s.picked, s.bgPref);
}

/**
 * Nhóm chưa có bản thay nền Ở VERSION HIỆN TẠI — đúng số lần còn phải gọi model.
 *
 * "Pending" là thuộc tính của VERSION chứ không phải của nền: tắt "Làm mịn da"
 * khi mới chỉ sinh bản có mịn là nhóm đó pending trở lại — bản kia vẫn nằm trong
 * cache, bật lại là về ngay không tốn lượt.
 */
export function pendingGroups(s: StudioState): BackgroundGroup[] {
  return retouchGroups(s).filter((g) => !variantOf(s, g.background));
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
    .filter((g) => variantOf(s, g.background)?.backgroundOk === false)
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
  return groups.every((g) => variantOf(s, g.background)?.backgroundOk === true);
}

/**
 * Đã đủ điều kiện xuất file chưa.
 *
 * Đây là chốt cuối của lời hứa cốt lõi. Không có nó thì luồng vẫn cho đi thẳng
 * Kiểm tra → Chỉnh sửa → Xuất ảnh và giao file cắt từ ảnh GỐC nền phòng khách —
 * đúng thứ màn Kiểm tra vừa hứa là "app sửa tự động ở bước sau".
 */
export type ExportBlock = "pending-background" | "failed-background" | null;

export function exportBlock(s: StudioState): ExportBlock {
  if (!originalWorking(s)) return "pending-background";
  if (failedBackgrounds(s).length > 0) return "failed-background";
  if (pendingGroups(s).length > 0) return "pending-background";
  return null;
}

/** Payload cho /api/export: mỗi nhóm nền kèm ảnh và landmark của chính nó */
export function exportGroups(s: StudioState): ExportGroup[] {
  const original = originalWorking(s);
  if (!original) return [];
  return retouchGroups(s).map((g) => {
    const working = variantOf(s, g.background) ?? original;
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
