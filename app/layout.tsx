import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import { ErrorBeacon } from "@/components/ErrorBeacon";
import { FocusScroll } from "@/components/FocusScroll";
import { RegisterSW } from "@/components/RegisterSW";
import { POLYFILLS } from "@/lib/polyfills";
import "./globals.css";

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Ủn Ỉn Cả Nhà",
  description: "Cùng con làm việc nhỏ · cùng nhau đi chơi to",
  applicationName: "Ủn Ỉn Cả Nhà",
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icon-512.png", sizes: "512x512", type: "image/png" }], apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Ủn Ỉn", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#FFC93C",
  viewportFit: "cover",
  interactiveWidget: "resizes-content", // Android: bàn phím hiện thì co nội dung lại thay vì che ô đang nhập
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${baloo.variable} ${nunito.variable}`}>
      <head>
        {/* Chạy trước mọi mã khác: bổ sung hàm còn thiếu cho Safari/iOS cũ */}
        <script dangerouslySetInnerHTML={{ __html: POLYFILLS }} />
      </head>
      <body>
        {children}
        <RegisterSW />
        <FocusScroll />
        <ErrorBeacon />
      </body>
    </html>
  );
}
