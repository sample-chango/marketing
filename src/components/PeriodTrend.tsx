"use client";

import { useMemo, useState } from "react";
import { TrendChart } from "@/components/TrendChart";
import { buildTrendData, type TrendMetric, type TrendMode } from "@/lib/trend-data";
import { fmtInt, fmtRoas, fmtWon } from "@/lib/metrics";
import type { MetricRow } from "@/lib/data";
import { CATEGORY_COLORS } from "@/lib/categories";

const METRICS: { key: TrendMetric; label: string; format: (value: number) => string }[] = [
  { key: "conversionValue", label: "매출", format: fmtWon },
  { key: "cost", label: "광고비", format: fmtWon },
  { key: "conversions", label: "전환", format: (value) => `${fmtInt(value)}개` },
];

export function PeriodTrend({ rows, dates }: {
  rows: MetricRow[];
  dates: string[];
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
    { name: "광고비", value: fmtWon(period.cost), color: CATEGORY_COLORS.film },
    { name: "ROAS", value: fmtRoas(period.roas) },
  ];

  return (
    <section className={`period-trend-card ${categories ? "trend-categories" : ""} rounded-[15px] bg-[#F9F9F9] px-4 py-4 shadow-[0_8px_22px_rgba(66,80,102,0.05)] sm:px-5`} aria-label="성과 추이">
      <header className="trend-summary">
        <div className="trend-summary-primary min-w-0">
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            {!categories && <i aria-hidden="true" className="h-[2px] w-4" style={{ backgroundColor: "#03C75A" }} />}
            기간 총 {categories ? cfg.label : "매출"}
          </p>
          <p className="trend-primary-value mt-1 font-bold tabular-nums text-slate-900">
            {categories ? cfg.format(period[metric]) : fmtWon(period.conversionValue)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">전체 {series.length}개 카테고리</p>
        </div>
        <div className="trend-summary-controls inline-flex rounded-lg bg-[#EEF2F6] p-1" aria-label="추이 분석 방식">
          {([{ key: "overall", name: "전체 성과" }, { key: "categories", name: "카테고리 비교" }] as const).map((item) => (
            <button type="button" key={item.key} aria-pressed={mode === item.key}
              onClick={() => { setMode(item.key); setHighlightedKey(null); }}
              className={`min-h-9 rounded-md px-3 py-2 text-xs font-medium transition-colors ${mode === item.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
              {item.name}
            </button>
          ))}
        </div>
        <div className="trend-summary-secondary">
          {categories ? (
            <label className="flex items-center gap-2 text-[11px] text-slate-400">지표
              <select value={metric} aria-label="카테고리 비교 지표" onChange={(event) => setMetric(event.target.value as TrendMetric)}
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700">
                {METRICS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </label>
          ) : (
            <div className="flex items-end gap-x-6">
              {stats.map((stat) => (
                <div key={stat.name}>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    {stat.color && <i aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: stat.color }} />}
                    {stat.name}
                  </p>
                  <p className="mt-1 text-2xl font-bold leading-8 tabular-nums text-slate-900 sm:text-[28px]">{stat.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>
      <p className="mb-1 text-[11px] text-slate-400">{categories && metric === "conversions" ? "전환 · 개" : "금액 · 원"}</p>
      <div className="trend-plot-area">
      {dates.length <= 1 ? (
        <p className="flex h-[140px] items-center justify-center text-center text-sm text-slate-400">
          추이를 보려면 기간을 2일 이상으로 선택하세요. (현재 {dates.length}일)
        </p>
      ) : (
        <TrendChart key={`${mode}-${metric}`} data={data} series={series} mode={mode}
          valueFmt={cfg.format} metricLabel={cfg.label} isCount={metric === "conversions"}
          selectedDate={date} highlightedKey={highlightedKey} onSelectDate={setSelectedDate} />
      )}

      </div>
      {categories && selected && (
        <>
          <div className="mb-2 mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700">{`선택일 카테고리별 ${cfg.label}`}</p>
            <label className="flex items-center gap-2 text-[11px] text-slate-400">선택 날짜
              <select value={date} aria-label="추이 상세 날짜" onChange={(event) => setSelectedDate(event.target.value)}
                className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700">
                {dates.map((day) => <option key={day} value={day}>{day.replaceAll("-", ".")}</option>)}
              </select>
            </label>
          </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
              aria-label={`카테고리별 ${date}의 ${cfg.label}와 기간 합계`}>
              {series.map((item) => (
                <li key={item.key} className="min-w-0">
                  <button type="button" aria-pressed={highlightedKey === item.key}
                    onClick={() => setHighlightedKey(item.key)}
                    onMouseEnter={() => setHighlightedKey(item.key)} onMouseLeave={() => setHighlightedKey(null)}
                    onFocus={() => setHighlightedKey(item.key)} onBlur={() => setHighlightedKey(null)}
                    className="flex h-full w-full min-w-0 flex-col rounded-lg bg-slate-50 p-2 text-left transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400">
                    <span className="flex w-full min-w-0 items-center gap-1.5 text-[11px] text-slate-600">
                      <i aria-hidden="true" className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
                      <span className="truncate" title={item.name}>{item.name}</span>
                    </span>
                    <span className="mt-1 w-full break-all text-sm font-semibold tabular-nums text-slate-800">
                      {cfg.format(Number(selected[item.key]))}
                    </span>
                    <span className="mt-1 flex w-full flex-wrap gap-x-1 text-[11px]">
                      <span className="text-slate-400">기간 합계</span>
                      <span className="break-all tabular-nums text-slate-500">{cfg.format(item.total)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
        </>
      )}
    </section>
  );
}
