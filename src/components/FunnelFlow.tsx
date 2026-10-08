"use client";

import { Fragment, useMemo, useState } from "react";
import { CATEGORIES, CATEGORY_COLORS, categoryLabel } from "@/lib/categories";
import { fmtInt, fmtWon, type DerivedMetrics } from "@/lib/metrics";
import { buildFlowData, FLOW_STAGES, flowComparison, flowRate, type FlowStage } from "@/lib/funnel-flow";
import type { MetricRow } from "@/lib/data";

const count = (value: number) => value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
const approximate = (value: number) => value > 0 && value < 0.1 ? "0.1 미만" : value.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
const percent = (value: number | null) => value == null ? "—" : value > 0 && value < 0.0001 ? "0.01% 미만" : `${(value * 100).toFixed(2)}%`;
const multiple = (value: number | null) => value == null ? "—" : value > 0 && value < 0.01 ? "0.01배 미만" : `${value.toFixed(2)}배`;

function FlowIcon({ stage }: { stage: FlowStage }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] text-slate-400" aria-hidden="true">
    {stage === "awareness" ? <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>
      : stage === "acquisition" ? <path d="m5 3 14 9-7 1-3 7-4-17Z" />
        : stage === "conversion" ? <><rect x="4" y="7" width="16" height="14" rx="2" /><path d="M8 7V5a4 4 0 0 1 8 0v2M8 11a4 4 0 0 0 8 0" /></>
          : <><ellipse cx="9" cy="6" rx="6" ry="3" /><path d="M3 6v7c0 2 4 3 7 3M3 10c0 2 3 3 6 3M15 6v3" /><ellipse cx="16" cy="13" rx="5" ry="3" /><path d="M11 13v5c0 4 10 4 10 0v-5" /></>}
  </svg>;
}

function stageValue(stage: FlowStage, metrics: DerivedMetrics) {
  return stage === "awareness" ? `${fmtInt(metrics.impressions)}회` : stage === "acquisition" ? `${fmtInt(metrics.clicks)}회`
    : stage === "conversion" ? `${count(metrics.conversions)}건` : multiple(flowRate(metrics, "revenue"));
}

function explanation(stage: FlowStage, metrics: DerivedMetrics) {
  if (stage === "awareness") return { label: "보여진 횟수", title: `광고가 총 ${fmtInt(metrics.impressions)}회 보여졌어요`, detail: "노출의 증감은 일평균 기준으로 이전 기간과 비교해요." };
  if (stage === "acquisition") return { label: "클릭 연결률", title: metrics.impressions > 0 ? `1,000회 보여졌을 때 약 ${approximate(metrics.ctr * 1000)}회 클릭` : "광고가 보여진 데이터가 없어요", detail: "보여진 횟수 중 얼마나 클릭으로 이어졌는지 확인해요." };
  if (stage === "conversion") return { label: "구매 연결률", title: metrics.clicks > 0 ? `100번 클릭했을 때 약 ${approximate(metrics.cvr * 100)}건 구매` : "클릭 데이터가 없어 구매 연결률을 계산할 수 없어요", detail: "클릭이 실제 구매로 이어지는 비율을 확인해요." };
  const rate = flowRate(metrics, "revenue");
  return { label: "광고비 대비 매출", title: rate == null ? "광고비 데이터가 없어 매출 비율을 계산할 수 없어요" : `광고비 1원당 매출 약 ${approximate(rate)}원`, detail: `광고비 ${fmtWon(metrics.cost)} → 매출 ${fmtWon(metrics.conversionValue)} · 이익과는 달라요.` };
}

export function FunnelFlow({ currentRows, baseRows, currentDays, baseDays, periodText }: {
  currentRows: MetricRow[];
  baseRows: MetricRow[];
  currentDays: number;
  baseDays: number;
  periodText: string;
}) {
  const [category, setCategory] = useState("all");
  const [stage, setStage] = useState<FlowStage>("acquisition");
  const { current, previous, products } = useMemo(() => buildFlowData(currentRows, baseRows, category, stage), [currentRows, baseRows, category, stage]);
  const selected = explanation(stage, current);
  const comparison = flowComparison(stage, current, previous, currentDays, baseDays);
  const changeLabel = stage === "awareness" ? "일평균 노출" : stage === "revenue" ? "비용 대비 매출" : "연결률";
  const productLabel = stage === "awareness" ? "많이 보여진 상품" : stage === "acquisition" ? "많이 클릭한 상품" : stage === "conversion" ? "구매가 많은 상품" : "매출이 많은 상품";
  const productValue = (value: number) => stage === "revenue" ? fmtWon(value) : `${count(value)}${stage === "conversion" ? "건" : "회"}`;
  const comparisonValue = (value: number) => stage === "awareness" ? `${count(Math.round(value))}회/일` : stage === "revenue" ? multiple(value) : percent(value);
  const preciseComparisonValue = (value: number) => {
    if (!comparison || comparison.direction === "same" || comparisonValue(comparison.now) !== comparisonValue(comparison.before)) return comparisonValue(value);
    // Avoid a change label beside two identical rounded values.
    if (stage === "awareness") return `${count(value)}회/일`;
    const scale = stage === "revenue" ? 1 : 100;
    let digits = 3;
    while (digits < 6 && (comparison.now * scale).toFixed(digits) === (comparison.before * scale).toFixed(digits)) digits++;
    return `${(value * scale).toFixed(digits)}${stage === "revenue" ? "배" : "%"}`;
  };

  return (
    <section aria-label="전환 흐름" className="funnel-flow-card rounded-[15px] bg-[#F9F9F9] px-4 py-4 shadow-[0_8px_22px_rgba(66,80,102,0.05)] sm:px-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-slate-400">{periodText}</p>
        <label className="flex items-center gap-2 text-[11px] text-slate-400">카테고리
          <select aria-label="성과 흐름 카테고리" value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 outline-none focus:border-slate-400">
            <option value="all">전체</option>{CATEGORIES.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}
          </select>
        </label>
      </header>
      <div role="group" aria-label="확인할 광고 단계" className="flow-stages grid grid-cols-[minmax(0,1fr)_42px_minmax(0,1fr)] items-center gap-x-1 gap-y-2 md:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)_48px_minmax(0,1fr)_18px_minmax(0,1fr)]">
        {FLOW_STAGES.map((item, index) => <Fragment key={item.key}>
          <button type="button" aria-pressed={stage === item.key} onClick={() => setStage(item.key)}
            className={`flex h-full min-w-0 flex-col gap-1 rounded-xl px-3 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${stage === item.key ? "bg-[#03C75A]/25" : "bg-[#EEF2F6] hover:bg-slate-100"}`}>
            <FlowIcon stage={item.key} /><span className="mt-2 text-xs text-slate-600">{item.label}</span>
            <strong className="whitespace-nowrap text-[17px] font-bold tabular-nums text-slate-900 md:text-xl lg:text-[22px]">{stageValue(item.key, current)}</strong>
            <span className="hidden text-[11px] text-slate-400 md:block">{item.description}</span>
          </button>
          {index < FLOW_STAGES.length - 1 && <div className={`flex items-center justify-center gap-1 text-center text-[10px] text-slate-400 ${index === 1 ? "col-span-3 flex-row md:col-span-1 md:flex-col" : "flex-col"}`}>
            {index < 2 && <><span>{index === 0 ? "클릭 연결" : "구매 연결"}</span><span className="font-medium tabular-nums text-slate-600">{percent(flowRate(current, index === 0 ? "acquisition" : "conversion"))}</span></>}
            <span aria-hidden="true" className={index === 1 ? "rotate-90 md:rotate-0" : ""}>→</span>
          </div>}
        </Fragment>)}
      </div>
      <div className="my-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-y border-slate-100 py-3" aria-live="polite">
        <div className="min-w-0"><p className="text-[11px] text-slate-400">{selected.label}</p><p className="mt-1 text-sm font-semibold text-slate-800 sm:text-base">{selected.title}</p><p className="mt-1 text-[11px] text-slate-400">{selected.detail}</p></div>
        <div className="min-w-0 text-xs">
          {comparison ? <><p className={`font-medium ${stage === "awareness" || comparison.direction === "same" ? "text-slate-500" : comparison.direction === "up" ? "text-emerald-700" : "text-orange-700"}`}>
            <span aria-hidden="true">{comparison.direction === "up" ? "↑" : comparison.direction === "down" ? "↓" : "＝"}</span> {changeLabel} {comparison.direction === "same" ? "비슷함" : comparison.direction === "up" ? "높아짐" : "낮아짐"}
          </p><p className="mt-1 text-[11px] tabular-nums text-slate-400">이전 {preciseComparisonValue(comparison.before)} → 현재 {preciseComparisonValue(comparison.now)}</p></>
            : <p className="text-[11px] text-slate-400">— 이전 기간 비교 데이터 부족</p>}
        </div>
      </div>
      <div aria-live="polite">
        <div className="mb-2 flex items-center justify-between gap-2"><h4 className="text-xs font-semibold text-slate-700">{productLabel} · {category === "all" ? "전체" : categoryLabel(category)}</h4><span className="text-[11px] text-slate-400">최대 3개</span></div>
        {products.length > 0 ? <ol className="grid gap-2 sm:grid-cols-3">
          {products.map((product, index) => {
            const rate = stage === "awareness" ? null : flowRate(product.metrics, stage);
            return <li key={product.key} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-2 rounded-lg p-2.5 sm:block"
              style={{ backgroundColor: `color-mix(in srgb, ${CATEGORY_COLORS[product.category] ?? "#94A3B8"} 25%, transparent)` }}>
              <div className="flex items-start gap-1.5"><span className="shrink-0 text-[11px] tabular-nums text-slate-400">{index + 1}</span><p title={product.name} className="line-clamp-2 min-w-0 text-xs leading-5 text-slate-600">{product.name}</p></div>
              <div className="flex flex-col items-end gap-y-1 sm:mt-2 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-2"><strong className="text-sm font-semibold tabular-nums text-slate-800">{productValue(product.value)}</strong>
                {stage !== "awareness" && <span className="text-[11px] tabular-nums text-slate-500">{stage === "revenue" ? "비용 대비" : stage === "acquisition" ? "클릭 연결" : "구매 연결"} {stage === "revenue" ? multiple(rate) : percent(rate)}</span>}
              </div>
              <p className="col-span-2 mt-1 flex items-center gap-1 text-[10px] text-slate-400"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_COLORS[product.category] ?? "#94A3B8" }} />{categoryLabel(product.category)}</p>
            </li>;
          })}
        </ol> : <p className="rounded-lg bg-slate-50 px-3 py-4 text-xs text-slate-400">선택한 기간에 {stage === "awareness" ? "노출" : stage === "acquisition" ? "클릭" : stage === "conversion" ? "구매" : "매출"}이 발생한 상품이 없어요.</p>}
      </div>
    </section>
  );
}
