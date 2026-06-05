"use client";

import { createContext, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

type ChangeAnalysis = { showChange: boolean; toggle: () => void };

const ChangeContext = createContext<ChangeAnalysis>({
  showChange: false,
  toggle: () => {},
});

/** 대시보드의 "변화 분석" 토글 상태. 사이드바와 대시보드가 공유한다. */
export const useChangeAnalysis = () => useContext(ChangeContext);

export function AppShell({
  email,
  children,
}: {
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [showChange, setShowChange] = useState(false);

  // 로그인 페이지나 미인증 상태에서는 앱 셸(사이드바)을 숨긴다.
  if (pathname === "/login" || !email) {
    return <>{children}</>;
  }

  return (
    <ChangeContext.Provider
      value={{ showChange, toggle: () => setShowChange((v) => !v) }}
    >
      <Sidebar />
      <div className="min-h-full md:pl-60">{children}</div>
    </ChangeContext.Provider>
  );
}
