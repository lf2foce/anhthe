/**
 * Webhook SePay — tiền về tài khoản là đơn tự mở khoá, không cần ai thức canh
 * sao kê.
 *
 * SePay bắn POST cho MỌI giao dịch của tài khoản đã liên kết (cả tiền ra), kèm
 * header `Authorization: Apikey <key>` nếu cấu hình. Nguyên tắc của route:
 *
 * - ĐÓNG CỬA AN TOÀN: thiếu PHOTO_SEPAY_API_KEY hoặc thiếu DB là 503 thẳng —
 *   webhook "fail-open" là cửa cho ai đó tự đánh dấu đơn của mình là đã trả.
 * - Trả 2xx cho giao dịch không liên quan (tiền ra, không có memo, không khớp
 *   đơn): đó không phải LỖI, và trả 4xx/5xx là SePay retry mãi một giao dịch
 *   không bao giờ khớp được.
 * - KHÔNG đánh dấu khi thiếu tiền — log để đối soát tay, vẫn ack.
 * - Idempotent: cùng giao dịch bắn lại thì markPaid với đơn đã paid trả false,
 *   route vẫn ack thành công.
 */

import { NextResponse } from "next/server";
import { markPaid, orderByMemo, ordersAvailable } from "@/lib/orders";
import { decideSepay, type SepayPayload } from "@/lib/sepay";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const key = process.env.PHOTO_SEPAY_API_KEY;
  if (!key || !ordersAvailable) {
    // Chưa cấu hình thì coi như không tồn tại — đừng nhận tiền khi không thể
    // xác thực người gửi tin.
    return NextResponse.json({ success: false }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Apikey ${key}`) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  let payload: SepayPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const verdict = decideSepay(payload);
  if (verdict.action === "ignore") {
    return NextResponse.json({ success: true, ignored: verdict.reason });
  }

  const order = await orderByMemo(verdict.memo);
  if (!order) {
    console.warn(
      `[webhook/sepay] có memo ${verdict.memo} nhưng không có đơn (ref ${payload.referenceCode ?? "?"})`
    );
    return NextResponse.json({ success: true, ignored: "không có đơn" });
  }

  if (verdict.amount < order.amountVnd) {
    // Thiếu tiền: KHÔNG mở khoá. Log đủ để chủ app xử tay (hoàn/đòi thêm).
    console.warn(
      `[webhook/sepay] ${verdict.memo} thiếu tiền: nhận ${verdict.amount}, cần ${order.amountVnd} (ref ${payload.referenceCode ?? "?"})`
    );
    return NextResponse.json({ success: true, ignored: "thiếu tiền" });
  }

  const marked = await markPaid(verdict.memo);
  console.log(
    `[webhook/sepay] ${verdict.memo} ${marked ? "ĐÃ MỞ KHOÁ" : "đã paid từ trước"} (${verdict.amount}đ, ref ${payload.referenceCode ?? "?"})`
  );
  return NextResponse.json({ success: true, paid: true });
}
