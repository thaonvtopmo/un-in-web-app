import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";
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
};

export const viewport: Viewport = {
  themeColor: "#FFC93C",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${baloo.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
