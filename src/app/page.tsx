import { Landing } from "@/components/landing/Landing";
import { LANDING } from "@/lib/landing";

/** Landing tiếng Việt — trang gốc. Bản tiếng Anh ở `/en`, dùng chung component. */
export const metadata = {
  // `absolute` để tiêu đề trang gốc không bị nối thêm tên thương hiệu lần hai.
  title: { absolute: LANDING.vi.metaTitle },
  description: LANDING.vi.metaDescription,
  alternates: { canonical: "/", languages: { vi: "/", en: "/en" } },
  openGraph: {
    title: LANDING.vi.metaTitle,
    description: LANDING.vi.metaDescription,
    url: "/",
    locale: "vi_VN",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: LANDING.vi.metaTitle }],
  },
};

export default function Page() {
  return <Landing lang="vi" />;
}
