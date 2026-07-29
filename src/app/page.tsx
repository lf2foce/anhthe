import { Landing } from "@/components/landing/Landing";
import { LANDING } from "@/lib/landing";

/** Landing tiếng Việt — trang gốc. Bản tiếng Anh ở `/en`, dùng chung component. */
export const metadata = {
  title: LANDING.vi.metaTitle,
  description: LANDING.vi.metaDescription,
  alternates: { canonical: "/", languages: { vi: "/", en: "/en" } },
};

export default function Page() {
  return <Landing lang="vi" />;
}
