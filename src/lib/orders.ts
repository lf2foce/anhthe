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

/**
 * Kênh liên hệ khi thanh toán trục trặc. Bắt buộc phải có khi thu tiền: khách
 * chuyển khoản mà webhook lỗi thì hiện tại không biết kêu ai, và mã memo là
 * bằng chứng duy nhất họ cầm.
 */
export const SUPPORT = process.env.PHOTO_SUPPORT_CONTACT ?? "";

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

/**
 * Ghi lại danh sách file của một lượt xuất, để dựng lại màn Hoàn tất sau F5.
 *
 * Ghi ĐÈ theo (client, session): xuất lại cùng phiên (thêm cỡ, đổi độ sáng) là
 * thay bộ file cũ, không đẻ hàng mới.
 */
export async function saveSessionFiles(
  clientId: string,
  sessionId: string,
  files: unknown
): Promise<void> {
  if (!sql) return;
  await sql`
    INSERT INTO photo_session (client_id, session_id, files)
    VALUES (${clientId}, ${sessionId}, ${JSON.stringify(files)})
    ON CONFLICT (client_id, session_id)
      DO UPDATE SET files = EXCLUDED.files, created_at = now()
  `;
}

/** Đọc lại phiên xuất gần nhất của khách này — nguồn cho việc khôi phục sau F5 */
export async function latestSession(
  clientId: string
): Promise<{ sessionId: string; files: unknown } | null> {
  if (!sql) return null;
  const rows = (await sql`
    SELECT session_id, files FROM photo_session
    WHERE client_id = ${clientId}
    ORDER BY created_at DESC LIMIT 1
  `) as Array<{ session_id: string; files: unknown }>;
  return rows.length > 0
    ? { sessionId: rows[0].session_id, files: rows[0].files }
    : null;
}

/**
 * Gắn email vào đơn — xin lúc trả tiền để còn gửi lại link nếu hỏng.
 *
 * Không bắt buộc: khách không muốn cho email vẫn phải mua được. Đây là lời mời,
 * không phải cửa ải.
 */
export async function attachEmail(memo: string, email: string): Promise<void> {
  if (!sql) return;
  await sql`UPDATE photo_order SET email = ${email} WHERE memo = ${memo}`;
}

/** Đọc đơn theo mã memo — webhook cần biết GIÁ trước khi đánh dấu đã trả. */
export async function orderByMemo(memo: string): Promise<Order | null> {
  if (!sql) return null;
  const rows = (await sql`
    SELECT * FROM photo_order WHERE memo = ${memo}
    ORDER BY created_at DESC LIMIT 1
  `) as OrderRow[];
  return rows.length > 0 ? toOrder(rows[0]) : null;
}

export interface AdminStats {
  paidToday: number;
  revenueToday: number;
  paid30: number;
  revenue30: number;
  pendingCount: number;
  /** Doanh thu 14 ngày gần nhất, cũ → mới, ngày không có đơn vẫn có mặt với 0 */
  daily: Array<{ day: string; orders: number; revenue: number }>;
  byPlan: Array<{ planId: string; orders: number; revenue: number }>;
  /** Lượt gọi model hôm nay (hàng __global__ của photo_quota) */
  callsToday: number;
  recent: Array<{
    memo: string;
    planId: string;
    amountVnd: number;
    status: string;
    email: string | null;
    createdAt: string;
    paidAt: string | null;
  }>;
}

/**
 * Số liệu cho dashboard chủ app.
 *
 * Tính TRONG SQL chứ không kéo hết đơn về rồi cộng ở JS: bảng đơn sẽ dài mãi
 * còn trang này mở hằng ngày. `generate_series` để ngày không có đơn vẫn xuất
 * hiện với 0 — biểu đồ nhảy cóc qua ngày trống là biểu đồ nói dối về nhịp bán.
 */
export async function adminStats(): Promise<AdminStats | null> {
  if (!sql) return null;

  const [totals, daily, byPlan, calls, recent] = await Promise.all([
    sql`
      SELECT
        count(*) FILTER (WHERE status = 'paid' AND paid_at::date = CURRENT_DATE) AS paid_today,
        coalesce(sum(amount_vnd) FILTER (WHERE status = 'paid' AND paid_at::date = CURRENT_DATE), 0) AS revenue_today,
        count(*) FILTER (WHERE status = 'paid' AND paid_at >= now() - INTERVAL '30 days') AS paid_30,
        coalesce(sum(amount_vnd) FILTER (WHERE status = 'paid' AND paid_at >= now() - INTERVAL '30 days'), 0) AS revenue_30,
        count(*) FILTER (WHERE status = 'pending') AS pending_count
      FROM photo_order
    `,
    sql`
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
             count(o.id) AS orders,
             coalesce(sum(o.amount_vnd), 0) AS revenue
      FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, INTERVAL '1 day') AS d(day)
      LEFT JOIN photo_order o
        ON o.status = 'paid' AND o.paid_at::date = d.day
      GROUP BY d.day ORDER BY d.day
    `,
    sql`
      SELECT plan_id, count(*) AS orders, coalesce(sum(amount_vnd), 0) AS revenue
      FROM photo_order WHERE status = 'paid'
      GROUP BY plan_id ORDER BY revenue DESC
    `,
    sql`SELECT coalesce(used, 0) AS used FROM photo_quota
        WHERE key = '__global__' AND day = CURRENT_DATE`,
    sql`
      SELECT memo, plan_id, amount_vnd, status, email, created_at, paid_at
      FROM photo_order ORDER BY created_at DESC LIMIT 20
    `,
  ]);

  const t = (totals as Array<Record<string, unknown>>)[0] ?? {};
  const n = (v: unknown) => Number(v ?? 0);

  return {
    paidToday: n(t.paid_today),
    revenueToday: n(t.revenue_today),
    paid30: n(t.paid_30),
    revenue30: n(t.revenue_30),
    pendingCount: n(t.pending_count),
    daily: (daily as Array<Record<string, unknown>>).map((r) => ({
      day: String(r.day),
      orders: n(r.orders),
      revenue: n(r.revenue),
    })),
    byPlan: (byPlan as Array<Record<string, unknown>>).map((r) => ({
      planId: String(r.plan_id),
      orders: n(r.orders),
      revenue: n(r.revenue),
    })),
    callsToday: n((calls as Array<Record<string, unknown>>)[0]?.used),
    recent: (recent as Array<Record<string, unknown>>).map((r) => ({
      memo: String(r.memo),
      planId: String(r.plan_id),
      amountVnd: n(r.amount_vnd),
      status: String(r.status),
      email: r.email ? String(r.email) : null,
      createdAt: String(r.created_at),
      paidAt: r.paid_at ? String(r.paid_at) : null,
    })),
  };
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
