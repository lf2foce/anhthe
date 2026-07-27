/**
 * Cấp link bản SẠCH cho một ảnh, nếu phiên đã trả tiền.
 *
 * Hai chốt, thiếu cái nào cũng hỏng:
 * 1. Khoá object phải THUỘC về khách đang gọi (`ownsKey`) — đây là ảnh khuôn
 *    mặt, khoá khó đoán không phải là quyền.
 * 2. Phiên phải đã thanh toán.
 */

import { NextResponse } from "next/server";
import { checkSize, remainingFor, withClientCookie } from "@/lib/gate";
import { sessionPaid } from "@/lib/orders";
import { ownsKey, signedUrl, usingObjectStore } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const tooBig = checkSize(request);
  if (tooBig) return tooBig.response;

  let body: { key?: string; sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  const { clientId } = await remainingFor(request);
  const key = typeof body.key === "string" ? body.key : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";

  if (!ownsKey(clientId, key)) {
    // Không nói "ảnh của người khác" — chỉ nói không thấy. Phân biệt hai câu trả
    // lời là cho người dò biết khoá nào có thật.
    return NextResponse.json({ error: "Không tìm thấy ảnh." }, { status: 404 });
  }

  if (!(await sessionPaid(clientId, sessionId))) {
    return NextResponse.json(
      { error: "Bộ ảnh này chưa được mở khoá.", code: "LOCKED" },
      { status: 402 }
    );
  }

  if (!usingObjectStore) {
    return NextResponse.json(
      { error: "Kho ảnh chưa được cấu hình." },
      { status: 503 }
    );
  }

  return withClientCookie(
    NextResponse.json({ url: await signedUrl(key) }),
    request,
    clientId
  );
}
