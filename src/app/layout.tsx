import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Baloo_2, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

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
  title: "Ảnh thẻ Studio — chụp một lần, đủ mọi cỡ",
  description:
    "Chụp bằng điện thoại, AI kiểm tra 8 tiêu chuẩn ảnh thẻ, thay nền và xuất đủ kích cỡ cho từng loại giấy tờ kèm bản in ghép 10×15.",
};

export const viewport: Viewport = {
  themeColor: "#2e2b25",
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
          Đo lưu lượng và tốc độ thật.
          Analytics của Vercel không đặt cookie và không dựng hồ sơ người dùng —
          hợp với chỗ này hơn GA vì app xử lý ẢNH KHUÔN MẶT: thêm một bên thứ ba
          theo dấu người dùng vào trang có dữ liệu sinh trắc là mở một nghĩa vụ
          pháp lý để đổi lấy vài biểu đồ.
          SpeedInsights đo Web Vitals THẬT trên máy khách — quan trọng vì luồng
          này chạy trên điện thoại tầm trung, nơi số đo trên máy dev nói dối.
        */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
