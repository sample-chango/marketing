import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "네이버 광고 리포트",
  description: "네이버 검색광고 성과 리포팅 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-slate-50 text-slate-900">
        <Nav />
        <main className="flex-1 min-w-0 p-6 md:p-8">{children}</main>
      </body>
    </html>
  );
}
