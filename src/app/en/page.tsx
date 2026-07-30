import { Landing } from "@/components/landing/Landing";
import { LANDING } from "@/lib/landing";

/** Landing tiếng Anh — cùng component với `/`, chỉ khác locale. */
export const metadata = {
  title: { absolute: LANDING.en.metaTitle },
  description: LANDING.en.metaDescription,
  alternates: { canonical: "/en", languages: { vi: "/", en: "/en" } },
  openGraph: {
    title: LANDING.en.metaTitle,
    description: LANDING.en.metaDescription,
    url: "/en",
    locale: "en_US",
    images: [{ url: "/og-en.jpg", width: 1200, height: 630, alt: LANDING.en.metaTitle }],
  },
};

export default function Page() {
  return <Landing lang="en" />;
}
