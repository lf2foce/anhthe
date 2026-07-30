import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Baloo_2, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/landing";

// Prototype dùng Caprasimo (tiêu đề) + Figtree (thân) và phải đổi font khi sang
// tiếng Việt vì cả hai đều KHÔNG có bộ dấu. Ở bản chạy thật thì đổi font giữa
// chừng là chữ nhảy, nên chọn thẳng hai font có sẵn subset vietnamese và giữ
// nguyên tinh thần chữ tròn, ấm của hệ Organic.
const display = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
});

const body = Be_Vietnam_Pro({
  variable: "--font-figtree",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  // metadataBase: thiếu nó thì mọi URL ảnh trong thẻ OG là đường dẫn tương đối,
  // và Facebook/Zalo bỏ qua — link dán ra chỉ còn chữ trơ.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Ảnh thẻ Studio — chụp một lần, đủ mọi cỡ",
    // Trang con tự nối tên thương hiệu, khỏi phải nhớ gõ tay ở từng trang.
    template: "%s · Ảnh thẻ Studio",
  },
  description:
    "Chụp bằng điện thoại, AI kiểm tra 8 tiêu chuẩn ảnh thẻ, thay nền và xuất đủ kích cỡ cho từng loại giấy tờ kèm bản in ghép 10×15.",
  applicationName: "Ảnh thẻ Studio",
  openGraph: {
    type: "website",
    siteName: "Ảnh thẻ Studio",
    locale: "vi_VN",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  // Màu thanh trình duyệt phải khớp NỀN THẬT của app — vẫn để màu nâu của bảng
  // cũ thì trên Android hiện một vệt nâu trên đầu trang sáng.
  themeColor: "#fffcf5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={`${display.variable} ${body.variable}`}>
      <body>
        {children}
        {/*
          Analytics của Vercel không đặt cookie và không dựng hồ sơ người dùng —
          hợp với chỗ này hơn GA vì app xử lý ẢNH KHUÔN MẶT: thêm một bên thứ ba
          theo dấu người dùng vào trang có dữ liệu sinh trắc là mở một nghĩa vụ
          pháp lý để đổi lấy vài biểu đồ.
        */}
        <Analytics />
      </body>
    </html>
  );
}
