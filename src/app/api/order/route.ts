/**
 * Tạo/lấy đơn cho một phiên, trả về mã memo + link QR.
 *
 * Không gọi model nên không tính lượt. Không tích cổng thanh toán: khách chuyển
 * khoản kèm memo, chủ app đối soát rồi `markPaid`.
 */

import { NextResponse } from "next/server";
import { checkSize, remainingFor, withClientCookie } from "@/lib/gate";
import {
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

  let body: { sessionId?: string; planId?: string };
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

  return withClientCookie(
    NextResponse.json({
      memo: order.memo,
      amountVnd: order.amountVnd,
      status: order.status,
      qrUrl: vietQrUrl(order),
    }),
    request,
    clientId
  );
}
