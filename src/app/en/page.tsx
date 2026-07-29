import { Landing } from "@/components/landing/Landing";
import { LANDING } from "@/lib/landing";

/** Landing tiếng Anh — cùng component với `/`, chỉ khác locale. */
export const metadata = {
  title: LANDING.en.metaTitle,
  description: LANDING.en.metaDescription,
  alternates: { canonical: "/en", languages: { vi: "/", en: "/en" } },
};

export default function Page() {
  return <Landing lang="en" />;
}
