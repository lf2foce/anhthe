/**
 * Giá và hạn mức — MỘT chỗ duy nhất.
 *
 * Landing page, màn hết lượt và (sau này) trang thanh toán đều đọc từ đây. Rải
 * con số ra nhiều chỗ là kiểu gì cũng có chỗ quên sửa, và với sản phẩm thu tiền
 * thì lệch giá giữa trang bán và trang trả tiền là mất niềm tin ngay lần đầu.
 *
 * Con số dưới đây là ĐỀ XUẤT, chưa đối chiếu giá vốn thật. Trước khi mở bán phải
 * đo chi phí model thật mỗi lượt rồi chốt lại — xem `notes` ở từng gói.
 */

export interface Plan {
  id: string;
  vi: string;
  en: string;
  /** Giá VND; 0 = miễn phí */
  priceVnd: number;
  unitVi: string;
  unitEn: string;
  featuresVi: string[];
  featuresEn: string[];
  highlight?: boolean;
  /** Ghi chú nội bộ, KHÔNG hiển thị cho khách */
  notes: string;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    vi: "Dùng thử",
    en: "Free trial",
    priceVnd: 0,
    unitVi: "không cần đăng ký",
    unitEn: "no signup",
    featuresVi: [
      "Kiểm tra ảnh theo 8 tiêu chuẩn",
      "Xem trước khung cắt đúng chuẩn",
      "Vài lượt tạo mỗi ngày",
    ],
    featuresEn: [
      "Check a photo against 8 requirements",
      "Preview the exact compliant crop",
      "A few generations per day",
    ],
    notes:
      "Hạn mức ngày phải đủ để khách THẤY được ảnh đẹp — đó là toàn bộ lý do tồn tại của bậc này.",
  },
  {
    id: "id-set",
    vi: "Bộ ảnh thẻ",
    en: "ID photo set",
    priceVnd: 49000,
    unitVi: "mỗi bộ",
    unitEn: "per set",
    featuresVi: [
      "Đủ mọi cỡ bạn chọn, đúng px và DPI",
      "Thay nền đúng màu chuẩn của từng loại",
      "Bản in ghép 10×15 kèm dấu cắt",
      "Kèm phiếu kiểm định số đo",
    ],
    featuresEn: [
      "Every size you pick, exact px and DPI",
      "Background replaced to each type's required colour",
      "10×15 print sheet with crop marks",
      "Includes a measurement report",
    ],
    highlight: true,
    notes:
      "Giá vốn: 1–2 lần gọi model thay nền + sharp (gần như miễn phí). Biên tốt. " +
      "Phiếu kiểm định là thứ đối thủ KHÔNG có — đừng bỏ.",
  },
  {
    id: "creative",
    vi: "Studio sáng tạo",
    en: "Creative studio",
    priceVnd: 149000,
    unitVi: "10 ảnh",
    unitEn: "10 shots",
    featuresVi: [
      "Chọn phong cách bất kỳ, tạo bao nhiêu biến thể tuỳ ý",
      "Tinh chỉnh từng ảnh bằng lời dặn",
      "Tải bản 2K in được",
    ],
    featuresEn: [
      "Any style, as many variants as you like",
      "Refine each shot by describing what to change",
      "Download print-ready 2K",
    ],
    notes:
      "Giá vốn CAO: mỗi ảnh là một lần gọi model sinh ảnh không-lite. PHẢI đo giá thật " +
      "trước khi chốt — đây là gói dễ lỗ nhất nếu bán theo lượt không giới hạn.",
  },
];

export function formatVnd(v: number): string {
  return v === 0 ? "0đ" : `${v.toLocaleString("vi-VN")}đ`;
}
