"use client";

import { useRef, useState, type CSSProperties } from "react";
import { fmtRoas, fmtWon } from "@/lib/metrics";
import { adjustedBidRange, adjustmentPercent, shortRecommendationName, type ComparisonExplanation } from "@/lib/recommendation-display";

const GROUPS = [
  { tone: "good", label: "확대 후보", icon: "↗", accent: "text-emerald-700", background: "bg-emerald-50", border: "border-emerald-100" },
  { tone: "danger", label: "축소 후보", icon: "↘", accent: "text-rose-700", background: "bg-rose-50", border: "border-rose-100" },
  { tone: "warn", label: "점검 · 보류", icon: "Ⅱ", accent: "text-amber-700", background: "bg-amber-50", border: "border-amber-100" },
  { tone: "neutral", label: "데이터 확인", icon: "?", accent: "text-slate-600", background: "bg-slate-50", border: "border-slate-200" },
] as const;

function RevenueBars({ evidence }: { evidence: NonNullable<ComparisonExplanation["evidence"]> }) {
  const values = [evidence.historyDailyRevenue, evidence.recentDailyRevenue, evidence.currentDailyRevenue];
  const max = Math.max(1, ...values);
  return (
    <div className="flex min-w-0 items-center gap-1.5" aria-label={`일평균 매출: 과거 ${fmtWon(values[0])}, 최근 최대 7개 저장일 ${fmtWon(values[1])}, 현재 ${fmtWon(values[2])}`}>
      <span className="shrink-0 text-[10px] text-slate-400">일매출</span>
      {values.map((value, index) => (
        <span key={index} className="flex min-w-0 flex-1 items-center gap-1" title={`${["전체 과거", "최근", "선택기간"][index]} 일평균 매출 ${fmtWon(value)}`}>
          <span className="text-[10px] text-slate-400">{["과거", "최근", "현재"][index]}</span>
          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <span className={`block h-full rounded-full ${index === 2 ? "bg-slate-600" : "bg-slate-300"}`} style={{ width: `${value / max * 100}%` }} />
          </span>
        </span>
      ))}
    </div>
  );
}

function BidRange({ item }: { item: ComparisonExplanation }) {
  const adjustment = item.adjustment;
  const bid = item.evidence?.currentBid ?? null;
  const range = adjustment ? adjustedBidRange(bid, adjustment) : null;
  return (
    <span className="block text-[9px] leading-3 tabular-nums text-slate-500">
      {range ? `${Math.round(bid!).toLocaleString("ko-KR")} → ${range[0].toLocaleString("ko-KR")}${range[0] === range[1] ? "" : `~${range[1].toLocaleString("ko-KR")}`}원`
        : bid != null ? `현재 ${Math.round(bid).toLocaleString("ko-KR")}원` : "입찰가 미등록"}
    </span>
  );
}

export function ActionRecommendationPanel({ title, periodText, items, bidDataReady }: {
  title: string;
  periodText: string;
  items: ComparisonExplanation[];
  bidDataReady: boolean;
}) {
  const [selected, setSelected] = useState<ComparisonExplanation | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  if (items.length === 0) return null;
  const groups = GROUPS.map((group) => ({ ...group, items: items.filter((item) => item.tone === group.tone) })).filter((group) => group.items.length > 0);

  return (
    <section aria-label={title} className="recommendation-card rounded-[15px] bg-white px-4 py-3 shadow-[0_8px_22px_rgba(66,80,102,0.05)] sm:px-5">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <span className="text-[11px] text-slate-400">{periodText}</span>
        </div>
        <span className="text-[11px] text-slate-500">{items.every((item) => item.tone === "neutral") ? "비교 데이터 필요" : "총예산 유지 · 상품 간 재배분"}</span>
      </header>
      {!bidDataReady && items.some((item) => item.adjustment) && (
        <p className="mb-3 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
          <span aria-hidden="true">ⓘ</span>입찰가 미등록 · 조정 비율만 표시
          <span className="group relative ml-auto shrink-0 cursor-help underline decoration-dotted" tabIndex={0} aria-label="입찰가 등록 안내">
            안내
            <span role="tooltip" className="pointer-events-none invisible absolute right-0 top-full z-10 mt-1 w-52 rounded-lg border border-amber-100 bg-white p-2 text-left leading-5 opacity-0 shadow-md group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100">
              선택기간 마지막 날의 입찰가가 필요합니다. D열 현재 입찰가가 포함된 파일을 업로드하면 현재가와 조정 후 금액이 표시됩니다.
            </span>
          </span>
        </p>
      )}
      <div className={`recommendation-groups grid items-start gap-3 ${groups.length === 1 ? "" : groups.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
        {groups.map((group) => (
          <section key={group.tone} aria-label={group.label} className="recommendation-group min-w-0">
            <h4 className={`mb-2 flex items-center gap-1.5 text-xs font-semibold ${group.accent}`}>
              <span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded ${group.background}`}>{group.icon}</span>
              {group.label}<span className="ml-auto text-[11px] font-medium text-slate-400">{group.items.length}개</span>
            </h4>
            <div className="recommendation-items grid gap-1" style={{ "--recommendation-rows": Math.max(...groups.map((item) => item.items.length)) } as CSSProperties}>
              {group.items.map((item, index) => {
                const name = shortRecommendationName(item.target ?? item.title);
                const adjustment = item.adjustment;
                const condition = adjustment?.condition;
                const label = condition === "review" ? "유지 → 확인 후" : condition === "transfer" ? "유지 → 재배분 시" : adjustment ? (adjustment.direction === "up" ? "입찰가 증액" : "입찰가 감액") : item.tone === "good" ? "현재 유지" : item.tone === "neutral" ? "비교 자료 부족" : "조정 전 점검";
                return (
                  <button key={`${item.title}-${index}`} type="button" title={name}
                    aria-label={`${name}, ${item.reason ?? group.label}, ${label}${adjustment ? ` ${adjustmentPercent(adjustment)}` : ""}, 상세 근거 보기`}
                    onClick={() => { setSelected(item); dialog.current?.showModal(); }}
                    className={`min-w-0 rounded-lg border p-2 text-left transition hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${group.border}`}>
                    <span className="flex items-center gap-1 text-xs font-semibold text-slate-800">
                      <span className="min-w-0 flex-1 truncate">{name}</span><span aria-hidden="true" className="text-slate-300">›</span>
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-[10px] text-slate-400">{item.reason ?? (item.evidence ? "성과 확인" : "자료를 등록해 주세요")}</span>
                        {item.evidence && <span className="flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
                          <span className="text-xs font-bold text-slate-800">ROAS {fmtRoas(item.evidence.roas)}</span>
                          <span className="text-[10px] text-slate-400">전체 {fmtRoas(item.evidence.overallRoas)}</span>
                        </span>}
                      </span>
                      <span className={`shrink-0 rounded-md px-2 py-1 text-right ${group.background} ${group.accent}`}>
                        <span className="block text-[10px] leading-3">{label}</span>
                        <span className="block text-sm font-bold leading-4 tabular-nums">{adjustment ? adjustmentPercent(adjustment) : item.tone === "good" ? "유지" : "미정"}</span>
                        {(bidDataReady || item.evidence?.currentBid != null) && <BidRange item={item} />}
                      </span>
                    </span>
                    {item.evidence && <div className="mt-1"><RevenueBars evidence={item.evidence} /></div>}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <dialog ref={dialog} onClose={() => setSelected(null)} aria-labelledby="recommendation-detail-title"
        className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%_-_32px)] max-w-lg overflow-y-auto rounded-2xl border-0 bg-white p-5 shadow-xl backdrop:bg-slate-900/30">
        {selected && <>
          <header className="flex items-start justify-between gap-3">
            <h4 id="recommendation-detail-title" className="text-sm font-semibold text-slate-900">{shortRecommendationName(selected.target ?? selected.title)}</h4>
            <button type="button" autoFocus aria-label="상세 근거 닫기" onClick={() => dialog.current?.close()} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button>
          </header>
          <p className="mt-3 text-xs leading-5 text-slate-600">{selected.body}</p>
          <div className="mt-3 rounded-lg bg-slate-50 p-3">
            <h5 className="text-xs font-semibold text-slate-800">조정 범위 및 조건</h5>
            {selected.action.split("\n").map((line, index) => <p key={index} className="mt-1 text-xs leading-5 text-slate-600">{line}</p>)}
          </div>
          <div className="mt-3 space-y-2">
            {selected.evidence && <dl className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 p-3 text-xs">
              {[["기간 매출", fmtWon(selected.evidence.revenue)], ["기간 광고비", fmtWon(selected.evidence.cost)], ["과거 일평균 매출", fmtWon(selected.evidence.historyDailyRevenue)], ["최근 일평균 매출", fmtWon(selected.evidence.recentDailyRevenue)], ["선택기간 일평균 매출", fmtWon(selected.evidence.currentDailyRevenue)]].map(([label, value]) => <div key={label}><dt className="text-[11px] text-slate-400">{label}</dt><dd className="mt-0.5 font-semibold tabular-nums text-slate-800">{value}</dd></div>)}
            </dl>}
            {selected.details.map((detail, index) => <p key={index} className="text-xs leading-5 text-slate-500">{detail}</p>)}
          </div>
        </>}
      </dialog>
    </section>
  );
}
