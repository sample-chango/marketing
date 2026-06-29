"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

type PendingNav = string | null;

type ChangeAnalysis = {
  showChange: boolean;
  setShowChange: (show: boolean) => void;
  pendingNav: PendingNav;
  setPendingNav: (target: PendingNav) => void;
  toggle: () => void;
};

const ChangeContext = createContext<ChangeAnalysis>({
  showChange: false,
  setShowChange: () => {},
  pendingNav: null,
  setPendingNav: () => {},
  toggle: () => {},
});

export const useChangeAnalysis = () => useContext(ChangeContext);

const transitionMeta: Record<string, { title: string; width?: string }> = {
  "/": { title: "Analytics Dashboard" },
  change: { title: "Change Analysis" },
  "/upload": { title: "데이터 업로드", width: "max-w-5xl" },
  "/glossary": { title: "마케팅 용어사전" },
  "/admin/signups": { title: "가입 승인", width: "max-w-4xl" },
};

function isPendingResolved(
  pendingNav: PendingNav,
  pathname: string,
  showChange: boolean,
) {
  if (!pendingNav) return true;
  if (pendingNav === "change") return pathname === "/" && showChange;
  if (pendingNav === "/") return pathname === "/" && !showChange;
  return pathname === pendingNav;
}

function RouteTransitionCover({ target }: { target: string }) {
  const meta = transitionMeta[target] ?? { title: "Loading" };
  const width = meta.width ?? "max-w-6xl";
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      setElapsed(performance.now() - startedAt);
    }, 50);
    return () => window.clearInterval(timer);
  }, [target]);

  const progress = Math.min(96, 35 + elapsed * 1.4);

  return (
    <div className="fixed inset-y-0 left-0 right-0 z-50 bg-[#EEF2F6] md:left-60">
      <TopBar title={meta.title} maxWidth={width}>
        <span className="text-xs font-semibold text-[#667384]">
          {(elapsed / 1000).toFixed(1)}s
        </span>
      </TopBar>
      <div className={`mx-auto ${width} p-4 md:p-8`} aria-busy="true">
        <div className="h-1 overflow-hidden rounded-full bg-[#DDE5EE]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#03C75A] via-[#20B7E8] to-[#8B5CF6] transition-[width] duration-75 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
export function AppShell({
  email,
  isAdmin,
  children,
}: {
  email: string | null;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [showChange, setShowChange] = useState(false);
  const [pendingNav, setPendingNav] = useState<PendingNav>(null);

  useEffect(() => {
    if (pathname !== "/") setShowChange(false);
  }, [pathname]);

  useEffect(() => {
    if (!pendingNav || !isPendingResolved(pendingNav, pathname, showChange)) return;

    const frame = window.requestAnimationFrame(() => setPendingNav(null));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, pendingNav, showChange]);

  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/pending" ||
    !email
  ) {
    return <>{children}</>;
  }

  const pendingActive = pendingNav !== null;

  return (
    <ChangeContext.Provider
      value={{
        showChange,
        setShowChange,
        pendingNav,
        setPendingNav,
        toggle: () => setShowChange((value) => !value),
      }}
    >
      <Sidebar isAdmin={isAdmin} />
      <div className="min-h-full md:pl-60">
        {children}
        {pendingActive && pendingNav && <RouteTransitionCover target={pendingNav} />}
      </div>
    </ChangeContext.Provider>
  );
}
