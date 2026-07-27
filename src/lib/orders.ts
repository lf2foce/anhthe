import "server-only";

/**
 * Đơn hàng — đủ để THU TIỀN THẬT mà không tích hợp cổng thanh toán nào.
 *
 * Cách làm: sinh một mã memo ngắn, hiện VietQR kèm mã đó, khách chuyển khoản với
 * memo, chủ app đối soát rồi đánh dấu đã trả. Không phí cổng, không webhook,
 * không hợp đồng — và quan trọng hơn: không xây quầy thu ngân cho cửa hàng chưa
 * có khách. Khi nào lượng đơn đủ phiền thì mới tự động hoá đối soát.
 *
 * Bảng nằm cùng Postgres với `photo_quota` (xem migrations/).
 */

import { neon } from "@neondatabase/serverless";
import { PLANS } from "./pricing";

const dbUrl = process.env.PHOTO_DATABASE_URL;
const sql = dbUrl ? neon(dbUrl) : null;

export const ordersAvailable = sql !== null;

/** Thông tin nhận tiền — hiện trên QR. Thiếu thì UI không mời trả tiền. */
export const PAYEE = {
  bank: process.env.PHOTO_BANK_CODE ?? "",
  account: process.env.PHOTO_BANK_ACCOUNT ?? "",
  name: process.env.PHOTO_BANK_NAME ?? "",
};

export const payeeConfigured =
  PAYEE.bank !== "" && PAYEE.account !== "" && PAYEE.name !== "";

export type OrderStatus = "pending" | "paid";

export interface Order {
  id: string;
  clientId: string;
  sessionId: string;
  planId: string;
  amountVnd: number;
  memo: string;
  status: OrderStatus;
}

/**
 * Mã memo: chữ HOA + số, bỏ các ký tự dễ đọc nhầm khi khách gõ tay vào app ngân
 * hàng (O/0, I/1). Đối soát bằng mắt nên nó phải ngắn và không gây nhầm.
 */
function newMemo(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "AT";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Link ảnh QR theo chuẩn VietQR. Dùng dịch vụ ảnh của vietqr.io nên không phải
 * tự dựng chuỗi EMVCo — đổi sang tự sinh sau cũng chỉ là thay hàm này.
 */
export function vietQrUrl(order: Order): string {
  const info = encodeURIComponent(order.memo);
  const name = encodeURIComponent(PAYEE.name);
  return (
    `https://img.vietqr.io/image/${PAYEE.bank}-${PAYEE.account}-compact2.png` +
    `?amount=${order.amountVnd}&addInfo=${info}&accountName=${name}`
  );
}

interface OrderRow {
  id: string;
  client_id: string;
  session_id: string;
  plan_id: string;
  amount_vnd: number;
  memo: string;
  status: string;
}

function toOrder(r: OrderRow): Order {
  return {
    id: r.id,
    clientId: r.client_id,
    sessionId: r.session_id,
    planId: r.plan_id,
    amountVnd: Number(r.amount_vnd),
    memo: r.memo,
    status: r.status === "paid" ? "paid" : "pending",
  };
}

/**
 * Lấy đơn đang chờ của phiên này, hoặc tạo mới.
 *
 * Cố tình KHÔNG tạo đơn mới mỗi lần bấm: khách bấm hai lần rồi chuyển khoản theo
 * mã cũ là tiền về mà đơn mới vẫn treo. Một phiên một đơn.
 */
export async function ensureOrder(opts: {
  clientId: string;
  sessionId: string;
  planId: string;
}): Promise<Order | null> {
  if (!sql) return null;
  const plan = PLANS.find((p) => p.id === opts.planId && p.priceVnd > 0);
  if (!plan) return null;

  const existing = (await sql`
    SELECT * FROM photo_order
    WHERE client_id = ${opts.clientId} AND session_id = ${opts.sessionId}
    ORDER BY created_at DESC LIMIT 1
  `) as OrderRow[];
  if (existing.length > 0) return toOrder(existing[0]);

  const rows = (await sql`
    INSERT INTO photo_order (client_id, session_id, plan_id, amount_vnd, memo)
    VALUES (${opts.clientId}, ${opts.sessionId}, ${plan.id}, ${plan.priceVnd}, ${newMemo()})
    RETURNING *
  `) as OrderRow[];
  return toOrder(rows[0]);
}

/**
 * Phiên này đã trả tiền chưa.
 *
 * Chưa cấu hình DB thì trả `true` — bản dev không có gì để bán, khoá lại chỉ
 * làm người phát triển không thử được luồng. Production BẮT BUỘC có DB.
 */
export async function sessionPaid(
  clientId: string,
  sessionId: string
): Promise<boolean> {
  if (!sql) return true;
  const rows = (await sql`
    SELECT 1 FROM photo_order
    WHERE client_id = ${clientId} AND session_id = ${sessionId} AND status = 'paid'
    LIMIT 1
  `) as unknown[];
  return rows.length > 0;
}

/** Đánh dấu đã nhận tiền. Gọi tay sau khi đối soát sao kê. */
export async function markPaid(memo: string): Promise<boolean> {
  if (!sql) return false;
  const rows = (await sql`
    UPDATE photo_order SET status = 'paid', paid_at = now()
    WHERE memo = ${memo} AND status = 'pending'
    RETURNING id
  `) as unknown[];
  return rows.length > 0;
}
