/**
 * Lớp lỗi có mã — ranh giới giữa "lỗi mình chủ động nói" và "lỗi lạ".
 *
 * Trước đây mọi route `catch (e) → e.message` thẳng ra UI: lỗi SDK tiếng Anh,
 * stack nội bộ, tên model — khách đọc được hết mà không hiểu gì. Quy tắc mới:
 *
 * - Lỗi MÌNH ném (`AppError`) mang sẵn câu tiếng Việt cho khách + mã máy đọc
 *   → trả nguyên văn.
 * - Mọi lỗi khác là chuyện nội bộ → log đầy đủ ở server, khách chỉ nhận một
 *   câu chung kèm mã UNKNOWN. Message của Error lạ KHÔNG bao giờ qua biên.
 *
 * Các route cứ `throw new AppError(...)` ở chỗ biết chuyện gì xảy ra, và kết
 * thúc bằng `catch (e) { return errorResponse(tag, e) }`.
 */

export type ErrorCode =
  | "BAD_INPUT" // request thiếu/sai trường — lỗi phía client code, không phải khách
  | "TOO_TIGHT" // ảnh chụp quá sát, không dựng nổi khung
  | "NO_FACE" // không đo được khuôn mặt trên ảnh
  | "MODEL_NO_IMAGE" // model không trả về ảnh (từ chối / lỗi sinh)
  | "GATE_LIMIT" // hết lượt trong ngày
  | "GATE_UNAVAILABLE" // kho đếm lượt không truy cập được — đóng cửa an toàn
  | "PAYMENT" // lỗi luồng thanh toán/đơn hàng
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNKNOWN";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, viMessage: string, status = 400) {
    super(viMessage);
    this.code = code;
    this.status = status;
  }
}

/** Câu chung cho lỗi lạ — đủ lịch sự, không đổ lỗi cho khách, không lộ ruột. */
const GENERIC_VI =
  "Có lỗi khi xử lý. Thử lại giúp nhé — nếu vẫn lỗi thì chờ vài phút.";

/**
 * Đóng gói lỗi thành Response cho khách.
 *
 * @param tag nhãn route cho log server (vd "api/retouch") — để lỗi lạ vẫn tra
 *        được đầy đủ ở server dù khách chỉ thấy câu chung.
 */
export function errorResponse(tag: string, e: unknown): Response {
  if (e instanceof AppError) {
    // Lỗi chủ động: đã là câu dành cho khách, log gọn để đếm tần suất.
    console.warn(`[${tag}] ${e.code}: ${e.message}`);
    return Response.json({ error: e.message, code: e.code }, { status: e.status });
  }

  console.error(`[${tag}] UNKNOWN:`, e);
  return Response.json({ error: GENERIC_VI, code: "UNKNOWN" }, { status: 500 });
}
