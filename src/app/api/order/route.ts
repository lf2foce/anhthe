/**
 * Tạo/lấy đơn cho một phiên, trả về mã memo + link QR.
 *
 * Không gọi model nên không tính lượt. Không tích cổng thanh toán: khách chuyển
 * khoản kèm memo, chủ app đối soát rồi `markPaid`.
 */

import { NextResponse } from "next/server";
import { checkSize, remainingFor, withClientCookie } from "@/lib/gate";
import {
  attachEmail,
  SUPPORT,
  ensureOrder,
  ordersAvailable,
  payeeConfigured,
  vietQrUrl,
} from "@/lib/orders";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const tooBig = checkSize(request);
  if (tooBig) return tooBig.response;

  if (!ordersAvailable || !payeeConfigured) {
    return NextResponse.json(
      { error: "Thanh toán chưa mở. Bản đang chạy cho dùng thử miễn phí." },
      { status: 503 }
    );
  }

  let body: { sessionId?: string; planId?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  if (typeof body.sessionId !== "string" || !/^[a-f0-9]{16}$/.test(body.sessionId)) {
    return NextResponse.json({ error: "Thiếu phiên." }, { status: 400 });
  }

  const { clientId } = await remainingFor(request);
  const order = await ensureOrder({
    clientId,
    sessionId: body.sessionId,
    planId: body.planId ?? "creative",
  });
  if (!order) {
    return NextResponse.json({ error: "Gói không hợp lệ." }, { status: 400 });
  }

  /*
   * Email là TUỲ CHỌN: khách không muốn cho vẫn phải mua được.
   *
   * Kiểm hình dạng ở đây thay vì tin `type="email"` của trình duyệt — route này
   * gọi được trực tiếp. Sai hình dạng thì BỎ QUA lặng lẽ chứ không chặn đơn:
   * chặn một giao dịch có tiền thật vì cái email gõ nhầm là đánh đổi sai.
   */
  const email = (body.email ?? "").trim().toLowerCase();
  if (email && /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(email) && email.length <= 254) {
    try {
      await attachEmail(order.memo, email);
    } catch (e) {
      console.error("[api/order] không gắn được email:", e);
    }
  }

  return withClientCookie(
    NextResponse.json({
      memo: order.memo,
      amountVnd: order.amountVnd,
      status: order.status,
      qrUrl: vietQrUrl(order),
      support: SUPPORT,
    }),
    request,
    clientId
  );
}
