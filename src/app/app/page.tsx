import { Studio } from "@/components/Studio";
import type { Lang } from "@/lib/i18n";

/**
 * Studio thật, tách khỏi landing ở `/`.
 *
 * Ngôn ngữ đọc từ `?lang=` NGAY Ở SERVER rồi truyền xuống — không đọc trong
 * effect ở client: server render "vi" mà client sửa thành "en" vừa là một nhịp
 * nhấp thấy được, vừa là setState-trong-effect (React compiler cảnh báo cascading
 * render). Đọc ở đây thì HTML đầu tiên đã đúng ngôn ngữ.
 */
export const metadata = {
  title: "Studio",
  /*
   * KHÔNG cho đánh chỉ mục màn ứng dụng.
   *
   * Nó là một màn công cụ rỗng khi chưa có ảnh — người từ Google rơi thẳng vào
   * đây sẽ thấy một trang không giải thích gì và thoát ngay, kéo tụt chính trang
   * bán hàng đang cạnh tranh cùng từ khoá. Trang cần được tìm thấy là landing.
   */
  robots: { index: false, follow: true },
};

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const initialLang: Lang = lang === "en" ? "en" : "vi";
  return <Studio initialLang={initialLang} />;
}
