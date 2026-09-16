import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "pretendard/dist/web/static/pretendard.css";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "아이에스씨앤에어(ISSEA&AIR) | 실시간 수출입 포워딩 운임 조회",
  description: "중국발 한국 수입 FCL 자동 견적 생성 시스템",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
