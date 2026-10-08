"use client";

import { useMemo, useState } from "react";
import { TrendChart } from "@/components/TrendChart";
import { buildTrendData, type TrendMetric, type TrendMode } from "@/lib/trend-data";
import { fmtInt, fmtRoas, fmtWon } from "@/lib/metrics";
import type { MetricRow } from "@/lib/data";

const METRICS: { key: TrendMetric; label: string; format: (value: number) => string }[] = [
  { key: "conversionValue", label: "매출", format: fmtWon },
  { key: "cost", label: "광고비", format: fmtWon },
  { key: "conversions", label: "전환", format: (value) => `${fmtInt(value)}개` },
];

export function PeriodTrend({ rows, dates, periodText }: {
  rows: MetricRow[];
  dates: string[];
  periodText: string;
}) {
  const [mode, setMode] = useState<TrendMode>("overall");
  const [metric, setMetric] = useState<TrendMetric>("conversionValue");
  const [selectedDate, setSelectedDate] = useState(dates[dates.length - 1] ?? "");
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const cfg = METRICS.find((item) => item.key === metric)!;
  const { data, series, period } = useMemo(() => buildTrendData(rows, dates, metric), [rows, dates, metric]);
  const selected = data.find((point) => point.date === selectedDate) ?? data[data.length - 1];
  const categories = mode === "categories";
  const date = selected?.date ?? "";
  const stats = [
    { name: "매출", value: fmtWon(period.conversionValue), color: "#03C75A", line: true },
    { name: "광고비", value: fmtWon(period.cost), color: "#CBD5E1" },
    { name: "ROAS", value: fmtRoas(period.roas) },
  ];

  return (
    <section className="rounded-[15px] bg-white p-4 shadow-[0_8px_22px_rgba(66,80,102,0.05)] sm:p-6" aria-label="기간 내 추이">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-800">기간 내 추이</h3>
          <p className="mt-1 text-xs text-slate-400">{periodText} · 전체</p>
        </div>
        <div className="inline-flex rounded-lg bg-[#EEF2F6] p-1" aria-label="추이 분석 방식">
          {([{ key: "overall", name: "전체 성과" }, { key: "categories", name: "카테고리 비교" }] as const).map((item) => (
            <button type="button" key={item.key} aria-pressed={mode === item.key}
              onClick={() => { setMode(item.key); setHighlightedKey(null); }}
              className={`min-h-9 rounded-md px-3 py-2 text-xs font-medium transition-colors ${mode === item.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
              {item.name}
            </button>
          ))}
        </div>
      </header>

      {categories ? (
        <div className="my-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500">기간 총 {cfg.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{cfg.format(period[metric])}</p>
            <p className="mt-1 text-[11px] text-slate-400">전체 {series.length}개 카테고리</p>
          </div>
          <label className="flex flex-col gap-1.5 text-[11px] text-slate-400">지표
            <select value={metric} aria-label="카테고리 비교 지표" onChange={(event) => setMetric(event.target.value as TrendMetric)}
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700">
              {METRICS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
        </div>
      ) : (
        <div className="my-6 flex flex-wrap items-start gap-x-8 gap-y-4">
          {stats.map((stat) => (
            <div key={stat.name}>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                {stat.color && <i aria-hidden="true" className={stat.line ? "h-[2px] w-4" : "h-2.5 w-2.5 rounded-sm"} style={{ backgroundColor: stat.color }} />}
                {stat.name}
              </p>
              <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">{stat.value}</p>
            </div>
          ))}
        </div>
      )}
      <p className="mb-1 text-[11px] text-slate-400">{categories && metric === "conversions" ? "전환 · 개" : "금액 · 원"}</p>
      {dates.length <= 1 ? (
        <p className="flex h-[380px] items-center justify-center text-center text-sm text-slate-400">
          추이를 보려면 기간을 2일 이상으로 선택하세요. (현재 {dates.length}일)
        </p>
      ) : (
        <TrendChart key={`${mode}-${metric}`} data={data} series={series} mode={mode}
          valueFmt={cfg.format} metricLabel={cfg.label} isCount={metric === "conversions"}
          selectedDate={date} highlightedKey={highlightedKey} onSelectDate={setSelectedDate} />
      )}

      {selected && (
        <>
          <div className="mb-3 mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-700">{categories ? `카테고리별 ${cfg.label}` : "날짜별 상세 수치"}</p>
            <label className="flex items-center gap-2 text-[11px] text-slate-400">선택 날짜
              <select value={date} aria-label="추이 상세 날짜" onChange={(event) => setSelectedDate(event.target.value)}
                className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700">
                {dates.map((day) => <option key={day} value={day}>{day.replaceAll("-", ".")}</option>)}
              </select>
            </label>
          </div>
          {categories ? (
            <table className="w-full table-fixed text-[11px] sm:text-xs">
              <caption className="sr-only">카테고리별 기간 합계와 {date}의 {cfg.label}</caption>
              <thead className="border-b border-slate-100 text-[11px] font-normal text-slate-400">
                <tr><th className="w-[38%] py-2 text-left font-normal">카테고리</th><th className="py-2 text-right font-normal">기간 합계</th><th className="py-2 text-right font-normal">{selected.label}</th></tr>
              </thead>
              <tbody>
                {series.map((item, index) => (
                  <tr key={item.key} className={`border-b border-slate-100 hover:bg-slate-50 ${index === 0 ? "font-semibold text-slate-800" : "text-slate-600"}`}
                    onMouseEnter={() => setHighlightedKey(item.key)} onMouseLeave={() => setHighlightedKey(null)}>
                    <td className="py-3">
                      <button type="button" aria-pressed={highlightedKey === item.key} onClick={() => setHighlightedKey(item.key)}
                        onFocus={() => setHighlightedKey(item.key)} onBlur={() => setHighlightedKey(null)}
                        className="inline-flex min-h-7 items-center gap-1.5 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400">
                        <i aria-hidden="true" className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />{item.name}
                      </button>
                    </td>
                    <td className="py-3 text-right tabular-nums">{cfg.format(item.total)}</td>
                    <td className="py-3 text-right tabular-nums">{cfg.format(Number(selected[item.key]))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 text-xs sm:grid-cols-4" aria-live="polite">
              {[
                ["매출", fmtWon(selected.conversionValue)], ["광고비", fmtWon(selected.cost)],
                ["전환", `${fmtInt(selected.conversions)}개`], ["ROAS", fmtRoas(selected.roas)],
              ].map(([name, value]) => (
                <div key={name}><dt className="text-[11px] text-slate-400">{name}</dt><dd className="mt-1 font-semibold tabular-nums text-slate-700">{value}</dd></div>
              ))}
            </dl>
          )}
        </>
      )}
    </section>
  );
}
