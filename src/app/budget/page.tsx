"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { fmtWon } from "@/lib/metrics";

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function BudgetPage() {
  const [month, setMonth] = useState(thisMonth());
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 선택 월의 기존 예산 로드
  useEffect(() => {
    setMsg(null);
    fetch(`/api/budget?month=${month}`)
      .then((r) => r.json())
      .then((d: { budgets?: Record<string, number> }) => {
        const next: Record<string, string> = {};
        for (const c of CATEGORIES) {
          const v = d.budgets?.[c.slug];
          next[c.slug] = v ? String(v) : "";
        }
        setAmounts(next);
      })
      .catch(() => {});
  }, [month]);

  const total = CATEGORIES.reduce(
    (s, c) => s + (Number(amounts[c.slug]) || 0),
    0,
  );

  async function save() {
    setBusy(true);
    setMsg(null);
    const budgets: Record<string, number> = {};
    for (const c of CATEGORIES) budgets[c.slug] = Number(amounts[c.slug]) || 0;
    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, budgets }),
      });
      const d = await res.json();
      setMsg(res.ok ? "✅ 저장되었습니다." : `⚠️ ${d.error}`);
    } catch (e) {
      setMsg(`⚠️ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">예산 설정</h1>
          <p className="text-sm text-slate-500">
            카테고리별 월 예산을 입력하면 대시보드에서 집행률이 표시됩니다.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
        >
          ← 대시보드
        </Link>
      </header>

      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            대상 월
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="divide-y divide-slate-100">
          {CATEGORIES.map((c) => (
            <div key={c.slug} className="flex items-center justify-between py-2.5">
              <span className="text-sm font-medium text-slate-700">
                {c.label}
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={amounts[c.slug] ?? ""}
                  onChange={(e) =>
                    setAmounts((a) => ({ ...a, [c.slug]: e.target.value }))
                  }
                  placeholder="0"
                  className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-right text-sm tabular-nums"
                />
                <span className="text-sm text-slate-400">원</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <span className="text-sm font-semibold text-slate-600">합계</span>
          <span className="text-lg font-bold text-slate-900">
            {fmtWon(total)}
          </span>
        </div>

        <button
          onClick={save}
          disabled={busy}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "저장 중…" : "예산 저장"}
        </button>

        {msg && (
          <div className="text-center text-sm font-medium text-slate-700">
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
