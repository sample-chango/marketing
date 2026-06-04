"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";

export default function Nav() {
  const pathname = usePathname();

  const item = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-emerald-600 text-white font-medium"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-4 flex flex-col gap-1">
      <Link href="/" className="px-3 py-2 mb-2">
        <div className="text-base font-bold text-slate-900">네이버 광고 리포트</div>
        <div className="text-xs text-slate-400">Search Ad Reporting</div>
      </Link>

      {item("/", "종합 대시보드", pathname === "/")}

      <div className="mt-4 mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        카테고리
      </div>
      {CATEGORIES.map((c) =>
        item(
          `/category/${c.slug}`,
          c.label,
          pathname === `/category/${c.slug}`,
        ),
      )}

      <div className="mt-auto pt-4">
        {item("/upload", "＋ 데이터 업로드", pathname === "/upload")}
      </div>
    </aside>
  );
}
