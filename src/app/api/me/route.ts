/**
 * Số lượt còn lại hôm nay. KHÔNG gọi model, nên không tính phí.
 *
 * Có route này thì UI mới nói được "còn N lượt" trước khi khách bấm — gate mà vô
 * hình thì khách chỉ gặp một lỗi khó hiểu ở giữa luồng, tệ hơn là không có gate.
 */

import { NextResponse } from "next/server";
import { remainingFor, withClientCookie } from "@/lib/gate";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { remaining, perDay, clientId } = await remainingFor(request);
  return withClientCookie(
    NextResponse.json({ remaining, perDay }),
    request,
    clientId
  );
}
