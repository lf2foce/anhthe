import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/landing";

/**
 * Chặn máy tìm kiếm khỏi những chỗ không phải nội dung.
 *
 * `/api/` nằm trong danh sách cấm không phải vì bí mật — quyền đã chặn ở từng
 * route — mà vì để bot bò vào đó là đốt hạn mức gọi model bằng lưu lượng không
 * bao giờ thành khách.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/app"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
