/**
 * Proxy tải hộ ảnh từ R2 — tồn tại vì đúng MỘT lý do: browser không fetch chéo
 * origin sang bucket riêng tư không mở CORS được ("Tải tất cả (.zip)" chết bằng
 * câu "Failed to fetch"). Server fetch thì không có CORS.
 *
 * KHÔNG phải cửa quyền: mọi kiểm soát nằm ở `proxyAllowed` (đúng host R2 của
 * mình + đúng thư mục của khách đang gọi) và ở chính chữ ký presigned trong link
 * — proxy chỉ chuyển tiếp, không ký gì thêm. Không trừ lượt: đây là tải cái đã
 * trả tiền/đã sinh, không phải gọi model.
 */

import { remainingFor } from "@/lib/gate";
import { proxyAllowed } from "@/lib/storage";

export const runtime = "nodejs";

/** Tên file đưa vào Content-Disposition — chỉ giữ ký tự lành để khỏi bẻ header */
function safeName(raw: string | null): string {
  const cleaned = (raw ?? "").replace(/[^\w.-]/g, "");
  return cleaned || "anh.jpg";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("u") ?? "";

  const { clientId } = await remainingFor(request);
  if (!proxyAllowed(clientId, target)) {
    return Response.json({ error: "Link không hợp lệ." }, { status: 403 });
  }

  const upstream = await fetch(target);
  if (!upstream.ok || !upstream.body) {
    // Hạn presigned là 1 giờ — hết hạn thì phải xuất lại, nói thẳng.
    return Response.json(
      { error: "Link ảnh đã hết hạn. Xuất lại giúp nhé." },
      { status: 410 }
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Content-Disposition": `attachment; filename="${safeName(
        searchParams.get("name")
      )}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
