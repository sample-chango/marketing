"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { fmtInt, fmtWon } from "@/lib/metrics";

interface Period {
  start: string;
  end: string;
  rowCount: number;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
}

interface RowData {
  id: string;
  category: string;
  keyword: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversion_value: number;
  quality_score: number | null;
}

const periodLabel = (p: { start: string; end: string }) =>
  p.start === p.end ? p.start : `${p.start} ~ ${p.end}`;

export function DataManagePanel() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [editing, setEditing] = useState<Period | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPeriods = useCallback(async () => {
    setLoading(true);
    const d = await (await fetch("/api/manage")).json();
    setPeriods(d.periods ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  async function openEdit(p: Period) {
    setEditing(p);
    setRows([]);
    const d = await (
      await fetch(`/api/manage/rows?start=${p.start}&end=${p.end}`)
    ).json();
    setRows(d.rows ?? []);
  }

  async function deletePeriod(p: Period) {
    if (!confirm(`${periodLabel(p)} 데이터 ${p.rowCount}건을 삭제할까요?`)) return;
    await fetch(`/api/manage?start=${p.start}&end=${p.end}`, {
      method: "DELETE",
    });
    if (editing && editing.start === p.start && editing.end === p.end) {
      setEditing(null);
    }
    loadPeriods();
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">기간</th>
              <th className="px-4 py-3 text-right font-medium">상품수</th>
              <th className="px-4 py-3 text-right font-medium">노출</th>
              <th className="px-4 py-3 text-right font-medium">클릭</th>
              <th className="px-4 py-3 text-right font-medium">광고비</th>
              <th className="px-4 py-3 text-right font-medium">매출</th>
              <th className="px-4 py-3 text-center font-medium">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  불러오는 중…
                </td>
              </tr>
            ) : periods.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  저장된 데이터가 없습니다.{" "}
                  <Link href="/upload" className="text-emerald-600 underline">
                    업로드
                  </Link>
                </td>
              </tr>
            ) : (
              periods.map((p) => (
                <tr key={`${p.start}~${p.end}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {periodLabel(p)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {p.rowCount}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmtInt(p.impressions)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmtInt(p.clicks)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmtWon(p.cost)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmtWon(p.conversionValue)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => openEdit(p)}
                      className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => deletePeriod(p)}
                      className="ml-2 rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">
              {periodLabel(editing)} · 행 편집{" "}
              <span className="text-sm font-normal text-slate-400">
                ({rows.length}건)
              </span>
            </h2>
            <button
              onClick={() => setEditing(null)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              닫기 X
            </button>
          </div>
          <div className="space-y-2">
            {rows.map((row) => (
              <RowEditor
                key={row.id}
                row={row}
                onDeleted={() => {
                  setRows((rs) => rs.filter((r) => r.id !== row.id));
                  loadPeriods();
                }}
                onSaved={() => loadPeriods()}
              />
            ))}
            {rows.length === 0 && (
              <div className="py-6 text-center text-sm text-slate-400">
                불러오는 중…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RowEditor({
  row,
  onDeleted,
  onSaved,
}: {
  row: RowData;
  onDeleted: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    category: row.category,
    keyword: row.keyword ?? "",
    impressions: String(row.impressions),
    clicks: String(row.clicks),
    cost: String(row.cost),
    conversions: String(row.conversions),
    conversionValue: String(row.conversion_value),
    qualityScore: row.quality_score == null ? "" : String(row.quality_score),
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof f, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setDone(false);
  };

  async function save() {
    setBusy(true);
    await fetch("/api/manage/rows", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, ...f }),
    });
    setBusy(false);
    setDone(true);
    onSaved();
  }

  async function del() {
    if (!confirm("이 상품 행을 삭제할까요?")) return;
    await fetch(`/api/manage/rows?id=${row.id}`, { method: "DELETE" });
    onDeleted();
  }

  const num = (k: keyof typeof f, w = "w-24") => (
    <input
      type="number"
      min={0}
      value={f[k]}
      onChange={(e) => set(k, e.target.value)}
      className={`${w} rounded border border-slate-300 px-2 py-1 text-right text-xs tabular-nums`}
    />
  );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
      <select
        value={f.category}
        onChange={(e) => set("category", e.target.value)}
        className="rounded border border-slate-300 px-2 py-1 text-xs"
      >
        {CATEGORIES.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        value={f.keyword}
        onChange={(e) => set("keyword", e.target.value)}
        className="min-w-[180px] flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
        placeholder="상품명"
      />
      <Field label="노출">{num("impressions")}</Field>
      <Field label="클릭">{num("clicks", "w-16")}</Field>
      <Field label="광고비">{num("cost")}</Field>
      <Field label="전환">{num("conversions", "w-16")}</Field>
      <Field label="매출">{num("conversionValue", "w-28")}</Field>
      <Field label="품질">{num("qualityScore", "w-12")}</Field>
      <button
        onClick={save}
        disabled={busy}
        className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? "…" : done ? "✓ 저장됨" : "저장"}
      </button>
      <button
        onClick={del}
        className="rounded bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
      >
        삭제
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-1 text-[11px] text-slate-400">
      {label}
      {children}
    </label>
  );
}