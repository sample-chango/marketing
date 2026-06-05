import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "네이버 광고 애널라이저",
  description: "네이버 검색광고 성과 리포팅 대시보드",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-100 text-slate-900">
        {user && (
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
              <span className="text-sm text-slate-500">{user.email}</span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  로그아웃
                </button>
              </form>
            </div>
          </header>
        )}
        <main className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
      </body>
    </html>
  );
}
