/**
 * Dựng lại phiên xuất gần nhất của khách — đường về sau khi F5.
 *
 * Danh tính là cookie `aid` (30 ngày), không phải tài khoản: khoá R2 vốn đã đặt
 * theo clientId nên server tự biết ảnh nào của ai. Không có tham số nào từ
 * client quyết định đọc phiên của AI — chỉ đọc phiên của chính cookie đang gửi.
 *
 * Link presigned trong `files` chỉ sống 1 giờ, nên KÝ LẠI ở đây thay vì trả
 * nguyên bản ghi cũ: khách quay lại sau hai ngày vẫn xem và tải được.
 */

import { NextResponse } from "next/server";
import { remainingFor, withClientCookie } from "@/lib/gate";
import { latestSession, sessionPaid } from "@/lib/orders";
import { ownsKey, signedUrl, usingObjectStore } from "@/lib/storage";
import type { ExportedFile } from "@/app/api/export/route";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { clientId } = await remainingFor(request);
  const found = await latestSession(clientId);
  if (!found) {
    return withClientCookie(
      NextResponse.json({ session: null }),
      request,
      clientId
    );
  }

  const files = found.files as ExportedFile[];
  const paid = await sessionPaid(clientId, found.sessionId);

  // Ký lại từng link. Đã trả tiền thì trả bản SẠCH — cùng một luật với
  // /api/unlock, chỉ khác là gộp cả bộ trong một lượt.
  const refreshed = usingObjectStore
    ? await Promise.all(
        files.map(async (f) => {
          if (!ownsKey(clientId, f.img.key)) return f;
          // Chưa trả tiền: ký lại đúng bản ĐÓNG DẤU. Không có previewKey (bản
          // ghi cũ, trước khi lưu khoá này) thì đành trả link cũ — sẽ chết sau
          // một giờ, nhưng không được phép rơi sang bản sạch.
          if (!paid && !f.img.unlocked) {
            if (!f.img.previewKey || !ownsKey(clientId, f.img.previewKey)) return f;
            return { ...f, img: { ...f.img, url: await signedUrl(f.img.previewKey) } };
          }
          return {
            ...f,
            img: { ...f.img, url: await signedUrl(f.img.key), unlocked: true },
          };
        })
      )
    : files;

  return withClientCookie(
    NextResponse.json({
      session: { sessionId: found.sessionId, files: refreshed, paid },
    }),
    request,
    clientId
  );
}
