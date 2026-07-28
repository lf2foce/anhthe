/**
 * Đối soát tự động qua SePay — phần THUẦN, tách khỏi route để test được.
 *
 * SePay theo dõi tài khoản ngân hàng và bắn webhook mỗi khi có giao dịch.
 * Việc của mình gói trong một câu: tìm mã memo trong nội dung chuyển khoản,
 * khớp với đơn đang chờ, đủ tiền thì đánh dấu đã trả.
 *
 * Vì sao phải viết riêng phép TÌM MÃ: nội dung chuyển khoản về tay mình không
 * bao giờ sạch — ngân hàng chèn tiền tố ("MBVCB.123456."), viết thường, dán
 * liền không dấu cách, và khách thì gõ thêm lời nhắn quanh mã. Regex bám đúng
 * BẢNG CHỮ của memo (không có I/O/0/1 — xem newMemo ở orders.ts) để giảm khớp
 * nhầm với chữ thường gặp trong câu.
 */

/** Đúng bảng chữ sinh memo: AT + 6 ký tự, không I/O/0/1 */
export const MEMO_RE = /AT[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}/;

/**
 * Tìm mã memo trong (các) trường văn bản của giao dịch, ưu tiên theo thứ tự
 * truyền vào. SePay có trường `code` (mã tự tách nếu cấu hình pattern bên họ)
 * và `content` (nội dung thô) — đưa `code` lên trước.
 */
export function extractMemo(
  ...fields: Array<string | null | undefined>
): string | null {
  for (const f of fields) {
    const m = (f ?? "").toUpperCase().match(MEMO_RE);
    if (m) return m[0];
  }
  return null;
}

/** Payload webhook của SePay — chỉ khai những trường mình dùng */
export interface SepayPayload {
  /** "in" = tiền vào. Tiền ra cũng bắn webhook — phải lọc. */
  transferType?: string;
  transferAmount?: number;
  /** Nội dung chuyển khoản thô */
  content?: string | null;
  /** Mã SePay tự tách theo pattern cấu hình bên họ (nếu có) */
  code?: string | null;
  /** Mã tham chiếu phía ngân hàng — chỉ để log đối soát */
  referenceCode?: string | null;
}

export type SepayVerdict =
  | { action: "ignore"; reason: string }
  | { action: "pay"; memo: string; amount: number };

/**
 * Quyết định làm gì với một giao dịch — thuần, chưa đụng DB.
 *
 * Chỉ trả "pay" cho tiền VÀO có mã memo. Số tiền có đủ hay không so ở tầng
 * route (cần đọc đơn từ DB mới biết giá) — ở đây chỉ gạt những thứ chắc chắn
 * không liên quan để route khỏi tốn truy vấn.
 */
export function decideSepay(p: SepayPayload): SepayVerdict {
  if (p.transferType !== "in") {
    return { action: "ignore", reason: "không phải tiền vào" };
  }
  const amount = Number(p.transferAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { action: "ignore", reason: "số tiền không hợp lệ" };
  }
  const memo = extractMemo(p.code, p.content);
  if (!memo) return { action: "ignore", reason: "không thấy mã memo" };
  return { action: "pay", memo, amount };
}
