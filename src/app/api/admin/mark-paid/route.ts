/**
 * Đánh dấu một đơn đã nhận tiền, sau khi đối soát sao kê bằng mắt.
 *
 * Cố tình đơn giản: một token bí mật trong header, không tài khoản quản trị,
 * không giao diện. Lượng đơn còn đếm trên đầu ngón tay thì đây là đủ; xây trang
 * quản trị bây giờ là xây cho công việc chưa tồn tại.
 *
 * Không đặt PHOTO_ADMIN_TOKEN thì route TẮT hẳn — mặc định mở là mọi người đánh
 * dấu đã trả tiền hộ nhau được.
 */

import { NextResponse } from "next/server";
import { markPaid, ordersAvailable } from "@/lib/orders";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = process.env.PHOTO_ADMIN_TOKEN;
  if (!token || !ordersAvailable) {
    return NextResponse.json({ error: "Không khả dụng." }, { status: 404 });
  }
  if (request.headers.get("x-admin-token") !== token) {
    return NextResponse.json({ error: "Không khả dụng." }, { status: 404 });
  }

  let body: { memo?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  const memo = (body.memo ?? "").trim().toUpperCase();
  if (!/^AT[A-Z0-9]{6}$/.test(memo)) {
    return NextResponse.json({ error: "Mã memo không hợp lệ." }, { status: 400 });
  }

  const ok = await markPaid(memo);
  return NextResponse.json(
    ok
      ? { ok: true, memo }
      : { ok: false, error: "Không có đơn đang chờ với mã này." },
    { status: ok ? 200 : 404 }
  );
}
