"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useChangeAnalysis } from "@/components/AppShell";

type NavItem = { href: string; label: string; icon: React.ReactNode };

const ICON = {
  dashboard: (
    <path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" />
  ),
  upload: (
    <path
      d="M12 16V4m0 0L7 9m5-5 5 5M5 20h14"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  glossary: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
      <path d="M8 7h8M8 11h6M6.5 19H20" />
    </>
  ),
  budget: (
    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
};

const NAV: NavItem[] = [
  {
    href: "/",
    label: "대시보드",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
        {ICON.dashboard}
      </svg>
    ),
  },
  {
    href: "/upload",
    label: "데이터 업로드",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current">
        {ICON.upload}
      </svg>
    ),
  },
  {
    href: "/glossary",
    label: "마케팅 용어사전",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 fill-none stroke-current"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICON.glossary}
      </svg>
    ),
  },
];

const ADMIN_NAV: NavItem[] = [
  {
    href: "/admin/signups",
    label: "가입 승인",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 fill-none stroke-current"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICON.users}
      </svg>
    ),
  },
];

const itemBase =
  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition";
const itemActive =
  "bg-gradient-to-r from-[#03C75A] via-[#20B7E8] to-[#8B5CF6] text-white shadow-[0_10px_20px_rgba(3,199,90,0.14)]";
const itemIdle =
  "border border-transparent text-[#EEF2F7] hover:border-[#667384] hover:bg-[#3D4A5A] hover:text-white";
export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { showChange, toggle } = useChangeAnalysis();
  const navItems = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV;

  const leaveChangeMode = () => {
    if (showChange) toggle();
  };

  const onChangeClick = () => {
    if (pathname !== "/") {
      router.push("/");
      if (!showChange) toggle();
    } else {
      toggle();
    }
  };

  const renderNavItem = (item: NavItem) => {
    const active =
      item.href === "/"
        ? pathname === "/" && !showChange
        : pathname === item.href && !showChange;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={leaveChangeMode}
        className={`${itemBase} ${active ? itemActive : itemIdle}`}
      >
        {item.icon}
        {item.label}
      </Link>
    );
  };
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[#3A4656] bg-[#465466] text-white shadow-[10px_0_28px_rgba(37,48,63,0.08)] md:flex">
      <div className="flex items-center gap-4 px-5 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="스마트스토어"
          className="h-8 w-8 rounded-lg"
        />
        <span className="text-lg font-bold text-white">스마트스토어</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.slice(0, 1).map(renderNavItem)}

        <button
          type="button"
          onClick={onChangeClick}
          className={`${itemBase} w-full ${
            showChange && pathname === "/" ? itemActive : itemIdle
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 fill-none stroke-current"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 17l6-6 4 4 8-8M21 7h-5M21 7v5" />
          </svg>
          변화 분석
        </button>

        {navItems.slice(1).map(renderNavItem)}
      </nav>

      <div className="border-t border-[#556272] p-3">
        <form action="/auth/signout" method="post">
          <button type="submit" className={`${itemBase} w-full ${itemIdle}`}>
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 fill-none stroke-current"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            </svg>
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}