import type { Metadata } from "next";
import "./globals.css";
import { isAdminUser } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "마케팅 애널라이저",
  description: "네이버 검색광고 성과 리포트 대시보드",
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
    <html lang="ko" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,1..1000&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full overflow-x-hidden bg-[#EEF2F6] text-slate-900">
        <AppShell email={user?.email ?? null} isAdmin={isAdminUser(user)}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
