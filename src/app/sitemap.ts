import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/landing";

/**
 * Sitemap — chỉ hai trang landing.
 *
 * Cố ý KHÔNG khai `/app` (màn công cụ, đã đặt noindex) và `/admin` (trang riêng).
 * Sitemap là lời mời đọc, không phải bản kê tài sản: khai những trang mình không
 * muốn ai đọc là tự mâu thuẫn với chính thẻ robots của chúng.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1,
      alternates: { languages: { vi: `${SITE_URL}/`, en: `${SITE_URL}/en` } },
    },
    {
      url: `${SITE_URL}/en`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: { languages: { vi: `${SITE_URL}/`, en: `${SITE_URL}/en` } },
    },
  ];
}
