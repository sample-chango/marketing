"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { fmtWon } from "@/lib/metrics";

export default function BudgetPage() {
  const [amount, setAmount] = useState("40000");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/budget")
      .then((r) => r.json())
      .then((d: { dailyBudget?: number }) => {
        if (d.dailyBudget != null) setAmount(String(d.dailyBudget));
      })
      .catch(() => {});
  }, []);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyBudget: Number(amount) || 0 }),
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
    <>
      <TopBar title="예산 설정" maxWidth="max-w-2xl" />
      <div className="mx-auto max-w-2xl p-4 md:p-8">
        <p className="mb-6 text-sm text-slate-500">
          하루 예산을 입력하면 대시보드에서 기간 일수 × 일예산으로 집행률이
          계산됩니다.
        </p>

        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            하루 예산
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              step={1000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-48 rounded-lg border border-slate-300 px-3 py-2 text-right text-lg font-semibold tabular-nums"
            />
            <span className="text-sm text-slate-400">원 / 일</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            현재 설정: <b>{fmtWon(Number(amount) || 0)}</b> /일
          </p>
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
    </>
  );
}
