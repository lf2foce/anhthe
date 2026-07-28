import { Studio } from "@/components/Studio";

/**
 * Studio thật, tách khỏi landing ở `/`.
 *
 * (Nhãn tên model ở chân trang đã bỏ theo redesign — thông tin vận hành,
 * không phải thông tin của khách — nên page không cần đọc lib/gemini nữa.)
 */
export const metadata = {
  title: "Ảnh thẻ Studio",
};

export default function AppPage() {
  return <Studio />;
}
