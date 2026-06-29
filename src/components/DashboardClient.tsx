"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { useChangeAnalysis } from "@/components/AppShell";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  type CategorySlug,
} from "@/lib/categories";
import { FUNNEL_STAGES, type FunnelStage } from "@/lib/funnel";
import {
  deriveMetrics,
  sumTotals,
  fmtInt,
  fmtWon,
  fmtPct,
  fmtRoas,
  type DerivedMetrics,
} from "@/lib/metrics";
import { CategoryBars } from "@/components/CategoryBars";
import { TrendChart } from "@/components/TrendChart";
import type { DashboardData, MetricRow } from "@/lib/data";

type Filter = CategorySlug | "all";
type MetricKey =
  | "impressions"
  | "clicks"
  | "cost"
  | "conversions"
  | "conversionValue"
  | "roas";

const fmtDate = (iso: string) => iso.replaceAll("-", ".");
const mmdd = (iso: string) => iso.slice(5).replace("-", ".");
const rowDate = (r: MetricRow) => r.period_end;
const BRAND = {
  green: "#03C75A",
  mint: "#12C8A8",
  cyan: "#20B7E8",
  blue: "#5B8DEF",
  violet: "#6F6AF8",
  purple: "#8B5CF6",
};

const CARD_CLASS =
  "rounded-[15px] bg-white p-6 shadow-[0_8px_22px_rgba(66,80,102,0.05)]";
const ACTIVE_CHIP_CLASS =
  "bg-[#03C75A] text-white shadow-[0_4px_10px_-5px_rgba(3,199,90,0.14)]";
const IDLE_CHIP_CLASS =
  "bg-[#EEF2F6] text-[#4F5B6A] shadow-[0_1px_4px_rgba(66,80,102,0.03)] hover:bg-[#E4EAF1]";

const PRIMARY: Record<
  FunnelStage["key"],
  { label: string; pick: (m: DerivedMetrics) => number; fmt: (n: number) => string }
> = {
  awareness: { label: "노출수", pick: (m) => m.impressions, fmt: fmtInt },
  acquisition: { label: "클릭수", pick: (m) => m.clicks, fmt: fmtInt },
  conversion: { label: "구매", pick: (m) => m.conversions, fmt: fmtInt },
  revenue: { label: "매출", pick: (m) => m.conversionValue, fmt: fmtWon },
};

const TREND_METRICS: {
  key: MetricKey;
  label: string;
  pick: (m: DerivedMetrics) => number;
  fmt: (n: number) => string;
  color: string;
}[] = [
  { key: "impressions", label: "노출수", pick: (m) => m.impressions, fmt: fmtInt, color: BRAND.blue },
  { key: "clicks", label: "클릭수", pick: (m) => m.clicks, fmt: fmtInt, color: BRAND.green },
  { key: "cost", label: "광고비", pick: (m) => m.cost, fmt: fmtWon, color: BRAND.violet },
  { key: "conversions", label: "전환", pick: (m) => m.conversions, fmt: fmtInt, color: BRAND.purple },
  { key: "conversionValue", label: "매출", pick: (m) => m.conversionValue, fmt: fmtWon, color: BRAND.mint },
  { key: "roas", label: "ROAS", pick: (m) => m.roas, fmt: fmtRoas, color: BRAND.cyan },
];

const CHANGE_ANALYSIS_STORAGE_KEY = "marketing-change-analysis-ranges";

const PRODUCT_PALETTE = [
  BRAND.green,
  BRAND.mint,
  BRAND.cyan,
  BRAND.blue,
  BRAND.violet,
  BRAND.purple,
  "#4F46E5",
  "#0EA5E9",
];

const CHANGE_COLS: {
  label: string;
  pick: (m: DerivedMetrics) => number;
  fmt: (n: number) => string;
  goodUp: boolean;
}[] = [
  { label: "노출수", pick: (m) => m.impressions, fmt: fmtInt, goodUp: true },
  { label: "클릭수", pick: (m) => m.clicks, fmt: fmtInt, goodUp: true },
  { label: "전환", pick: (m) => m.conversions, fmt: fmtInt, goodUp: true },
  { label: "매출", pick: (m) => m.conversionValue, fmt: fmtWon, goodUp: true },
  { label: "광고비", pick: (m) => m.cost, fmt: fmtWon, goodUp: false },
  { label: "ROAS", pick: (m) => m.roas, fmt: fmtRoas, goodUp: true },
];

const daysInclusive = (start: string, end: string) =>
  Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1);

const agg = (rs: MetricRow[]) => deriveMetrics(sumTotals(rs));
const byCatOf = (rs: MetricRow[]) =>
  CATEGORIES.map((c) => ({
    slug: c.slug,
    label: c.label,
    metrics: agg(rs.filter((r) => r.category === c.slug)),
  }));

/* ---------- 이슈(주요 변화) 분석 ---------- */

interface Issue {
  tone: "up" | "down" | "warn";
  emoji: string;
  title: string;
  detail: string;
  score: number;
}

const ISSUE_METRICS: {
  label: string;
  pick: (m: DerivedMetrics) => number;
  fmt: (n: number) => string;
  goodUp: boolean;
  minBase: number;
  warn?: boolean;
}[] = [
  { label: "노출수", pick: (m) => m.impressions, fmt: fmtInt, goodUp: true, minBase: 300 },
  { label: "클릭수", pick: (m) => m.clicks, fmt: fmtInt, goodUp: true, minBase: 10 },
  { label: "전환", pick: (m) => m.conversions, fmt: fmtInt, goodUp: true, minBase: 3 },
  { label: "매출", pick: (m) => m.conversionValue, fmt: fmtWon, goodUp: true, minBase: 10000 },
  { label: "광고비", pick: (m) => m.cost, fmt: fmtWon, goodUp: false, minBase: 5000, warn: true },
  { label: "ROAS", pick: (m) => m.roas, fmt: fmtRoas, goodUp: true, minBase: 0.5, warn: true },
];

const nameOf = (r: MetricRow) => r.keyword ?? r.ad_group ?? r.campaign ?? "-";
const truncName = (s: string, n = 22) => (s.length > n ? s.slice(0, n) + "…" : s);
function groupByName(rows: MetricRow[]) {
  const m = new Map<string, MetricRow[]>();
  for (const r of rows) {
    const n = nameOf(r);
    if (!m.has(n)) m.set(n, []);
    m.get(n)!.push(r);
  }
  return m;
}

/** 현재 vs 전날 비교에서 변화가 큰 이슈를 추출 */
function buildIssues(cur: MetricRow[], base: MetricRow[]): Issue[] {
  if (cur.length === 0 || base.length === 0) return [];
  const issues: Issue[] = [];
  const curG = groupByName(cur);
  const baseG = groupByName(base);

  // (1) 제품 매출 순위 변동
  const rankOf = (g: Map<string, MetricRow[]>) => {
    const sorted = [...g.entries()]
      .map(([n, rs]) => ({ n, v: agg(rs).conversionValue }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v);
    return new Map(sorted.map((x, i) => [x.n, i + 1]));
  };
  const curRank = rankOf(curG);
  const baseRank = rankOf(baseG);
  for (const [n, cr] of curRank) {
    const br = baseRank.get(n);
    if (br == null) continue;
    const change = br - cr; // +면 순위 상승
    if (Math.abs(change) >= 2) {
      issues.push({
        tone: change > 0 ? "up" : "down",
        emoji: change > 0 ? "🏆" : "🔻",
        title: `${truncName(n)} 매출 순위 ${change > 0 ? "상승" : "하락"}`,
        detail: `${br}위 → ${cr}위 (${change > 0 ? "▲" : "▼"}${Math.abs(change)})`,
        score: Math.abs(change) * 1.5,
      });
    }
  }

  // (2) 카테고리 지표 급변
  for (const c of CATEGORIES) {
    const cm = agg(cur.filter((r) => r.category === c.slug));
    const bm = agg(base.filter((r) => r.category === c.slug));
    for (const col of ISSUE_METRICS) {
      const cv = col.pick(cm);
      const bv = col.pick(bm);
      if (bv < col.minBase) continue;
      const d = (cv - bv) / bv;
      if (Math.abs(d) < 0.5) continue;
      const up = cv >= bv;
      const good = up === col.goodUp;
      issues.push({
        tone: col.warn && !good ? "warn" : up ? "up" : "down",
        emoji: col.warn && !good ? "⚠️" : up ? "📈" : "📉",
        title: `${c.label} ${col.label} ${up ? "급증" : "급감"}`,
        detail: `${col.fmt(bv)} → ${col.fmt(cv)} (${up ? "▲" : "▼"}${Math.round(
          Math.abs(d) * 100,
        )}%)`,
        score: Math.abs(d),
      });
    }
  }

  // (3) 제품 노출 신규 / 급증
  for (const [n, rs] of curG) {
    const cImp = agg(rs).impressions;
    if (cImp < 500) continue;
    const bRows = baseG.get(n);
    const bImp = bRows ? agg(bRows).impressions : 0;
    if (bImp === 0) {
      issues.push({
        tone: "up",
        emoji: "🆕",
        title: `${truncName(n)} 신규 노출`,
        detail: `노출 ${fmtInt(cImp)} (전날 없음)`,
        score: 1.2,
      });
    } else if (cImp / bImp >= 3) {
      issues.push({
        tone: "up",
        emoji: "🚀",
        title: `${truncName(n)} 노출 급증`,
        detail: `${fmtInt(bImp)} → ${fmtInt(cImp)} (▲${Math.round(
          (cImp / bImp - 1) * 100,
        )}%)`,
        score: cImp / bImp / 3,
      });
    }
  }

  return issues.sort((a, b) => b.score - a.score).slice(0, 5);
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2.5 flex-1 rounded-full bg-[#EEF5FF]">
      <div
        className="h-2.5 rounded-full"
        style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: color }}
      />
    </div>
  );
}

function Delta({
  curr,
  prev,
  goodWhenUp = true,
}: {
  curr: number;
  prev: number | null;
  goodWhenUp?: boolean;
}) {
  if (prev == null || prev <= 0)
    return <span className="text-[11px] text-slate-300">—</span>;
  const delta = (curr - prev) / prev;
  const up = curr >= prev;
  const good = up === goodWhenUp;
  return (
    <span className={`text-[11px] ${good ? "text-[#03C75A]" : "text-red-500"}`}>
      {up ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(1)}%
    </span>
  );
}

export function DashboardClient({ data }: { data: DashboardData }) {
  const allDates = [...new Set(data.rows.map(rowDate))].sort();
  const allDatesKey = allDates.join("|");
  const earliest = allDates[0] ?? "";
  const latest = allDates[allDates.length - 1] ?? "";
  const previous = allDates[allDates.length - 2] ?? latest;

  // 기본값: 가장 최근 1일 (전날 대비 = 최근일 vs 바로 전날). 기간은 달력으로 넓힐 수 있음
  const [rangeStart, setRangeStart] = useState(latest);
  const [rangeEnd, setRangeEnd] = useState(latest);
  const [cat, setCat] = useState<Filter>("all");
  const [stageKey, setStageKey] = useState<FunnelStage["key"]>("awareness");
  const [trendKey, setTrendKey] = useState<MetricKey>("conversionValue");
  const [trendByCat, setTrendByCat] = useState(true);
  const { showChange } = useChangeAnalysis();
  const [costDetailOpen, setCostDetailOpen] = useState(false);
  const [breakdownShowPercent, setBreakdownShowPercent] = useState(false);
  const [analysisAStart, setAnalysisAStart] = useState(previous);
  const [analysisAEnd, setAnalysisAEnd] = useState(previous);
  const [analysisBStart, setAnalysisBStart] = useState(latest);
  const [analysisBEnd, setAnalysisBEnd] = useState(latest);
  const [analysisStorageLoaded, setAnalysisStorageLoaded] = useState(false);

  useEffect(() => {
    if (analysisStorageLoaded || typeof window === "undefined") return;

    const isValidDate = (value: unknown): value is string =>
      typeof value === "string" && allDates.includes(value);

    try {
      const raw = window.localStorage.getItem(CHANGE_ANALYSIS_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, unknown>;
        setAnalysisAStart(isValidDate(saved.aStart) ? saved.aStart : previous);
        setAnalysisAEnd(isValidDate(saved.aEnd) ? saved.aEnd : previous);
        setAnalysisBStart(isValidDate(saved.bStart) ? saved.bStart : latest);
        setAnalysisBEnd(isValidDate(saved.bEnd) ? saved.bEnd : latest);
      }
    } catch {
      // Ignore broken local preview settings.
    } finally {
      setAnalysisStorageLoaded(true);
    }
  }, [allDates, allDatesKey, analysisStorageLoaded, latest, previous]);

  useEffect(() => {
    if (!analysisStorageLoaded || typeof window === "undefined") return;

    window.localStorage.setItem(
      CHANGE_ANALYSIS_STORAGE_KEY,
      JSON.stringify({
        aStart: analysisAStart,
        aEnd: analysisAEnd,
        bStart: analysisBStart,
        bEnd: analysisBEnd,
      }),
    );
  }, [
    analysisAEnd,
    analysisAStart,
    analysisBEnd,
    analysisBStart,
    analysisStorageLoaded,
  ]);
  // 변화분석은 대시보드 집계보다 먼저 처리해 메뉴 전환을 가볍게 유지한다.
  const normalizeAnalysisRange = (start: string, end: string, fallback: string) => {
    let s = start && allDates.includes(start) ? start : fallback;
    let e = end && allDates.includes(end) ? end : fallback;
    if (s && e && s > e) [s, e] = [e, s];
    return { start: s, end: e };
  };
  const rangeText = (start: string, end: string) =>
    start
      ? start === end
        ? fmtDate(start)
        : `${fmtDate(start)} - ${fmtDate(end)}`
      : "기간 없음";
  const rowsBetween = (start: string, end: string) =>
    data.rows.filter((r) => {
      const d = rowDate(r);
      return d >= start && d <= end;
    });

  const analysisA = normalizeAnalysisRange(analysisAStart, analysisAEnd, previous);
  const analysisB = normalizeAnalysisRange(analysisBStart, analysisBEnd, latest);
  const analysisARows = rowsBetween(analysisA.start, analysisA.end);
  const analysisBRows = rowsBetween(analysisB.start, analysisB.end);
  const analysisAMetrics = agg(analysisARows);
  const analysisBMetrics = agg(analysisBRows);
  const analysisByCategoryA = byCatOf(analysisARows);
  const analysisByCategoryB = byCatOf(analysisBRows);
  const analysisIssues = buildIssues(analysisBRows, analysisARows);
  const analysisBaseMetric = (
    slug: string,
    pick: (m: DerivedMetrics) => number,
  ) => {
    const m = analysisByCategoryA.find((c) => c.slug === slug)?.metrics;
    return m ? pick(m) : null;
  };
  const analysisHasRows = analysisARows.length > 0 || analysisBRows.length > 0;

  if (showChange) {
    return (
      <>
        <TopBar title="Change Analysis" />
        <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
          {!data.configured && (
            <Banner tone="amber">Supabase 환경변수가 설정되지 않았습니다.</Banner>
          )}
          {data.configured && !data.hasData && (
            <Banner tone="blue">
              데이터가 없습니다. 우측 상단 <b>데이터 업로드</b>에서 네이버 보고서를
              올리세요.
            </Banner>
          )}

          <section className={CARD_CLASS}>
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-800">변화 분석</h2>
              <p className="mt-1 text-sm text-slate-400">
                원하는 두 기간을 선택해 카테고리별 변화를 비교합니다.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-600">기간 A</div>
                <RangeCalendar
                  start={analysisA.start}
                  end={analysisA.end}
                  min={earliest}
                  max={latest}
                  onChange={(s, e) => {
                    setAnalysisAStart(s);
                    setAnalysisAEnd(e);
                  }}
                />
                <div className="text-xs text-slate-400">
                  {rangeText(analysisA.start, analysisA.end)}
                </div>
              </div>
              <div className="pb-8 text-center text-xs font-semibold text-slate-400">VS</div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-600">기간 B</div>
                <RangeCalendar
                  start={analysisB.start}
                  end={analysisB.end}
                  min={earliest}
                  max={latest}
                  onChange={(s, e) => {
                    setAnalysisBStart(s);
                    setAnalysisBEnd(e);
                  }}
                />
                <div className="text-xs text-slate-400">
                  {rangeText(analysisB.start, analysisB.end)}
                </div>
              </div>
            </div>
          </section>

          <section className={CARD_CLASS}>
            <h3 className="mb-3 font-semibold text-slate-800">
              비교 결과{" "}
              <span className="text-sm font-normal text-slate-400">
                기간 B vs 기간 A
              </span>
            </h3>
            {!analysisHasRows ? (
              <p className="py-6 text-center text-sm text-slate-400">
                선택한 기간에 비교할 데이터가 없습니다.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="px-2 py-2 text-left font-medium">카테고리</th>
                      {CHANGE_COLS.map((c) => (
                        <th key={c.label} className="px-2 py-2 text-right font-medium">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <ChangeRow
                      label="전체"
                      bold
                      metrics={analysisBMetrics}
                      baseMetrics={analysisAMetrics}
                    />
                    {analysisByCategoryB.map((c) => (
                      <ChangeRow
                        key={c.slug}
                        label={c.label}
                        metrics={c.metrics}
                        basePick={(pick) => analysisBaseMetric(c.slug, pick)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className={CARD_CLASS}>
            <h3 className="text-lg font-semibold text-slate-800">주요 변화 이슈 TOP5</h3>
            <p className="mb-4 text-sm text-slate-400">
              {rangeText(analysisB.start, analysisB.end)} vs {rangeText(analysisA.start, analysisA.end)} · 변화가 큰 순
            </p>
            {analysisARows.length === 0 || analysisBRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                두 기간 모두에 데이터가 있어야 주요 변화 이슈를 계산할 수 있습니다.
              </p>
            ) : analysisIssues.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                선택한 기간 사이에 큰 변화가 없습니다.
              </p>
            ) : (
              <ul className="grid gap-2 md:grid-cols-2">
                {analysisIssues.map((issue, i) => (
                  <li
                    key={i}
                    className={`flex items-start gap-3 rounded-xl border p-3 ${
                      issue.tone === "up"
                        ? "border-emerald-200 bg-emerald-50"
                        : issue.tone === "warn"
                          ? "border-amber-200 bg-amber-50"
                          : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <span className="text-lg leading-none">{issue.emoji}</span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">
                        {issue.title}
                      </div>
                      <div className="text-xs text-slate-500">{issue.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </>
    );
  }

  // 유효 범위 (데이터 범위로 보정)
  let rs = rangeStart && allDates.includes(rangeStart) ? rangeStart : earliest;
  let re = rangeEnd && allDates.includes(rangeEnd) ? rangeEnd : latest;
  if (rs && re && rs > re) [rs, re] = [re, rs];

  const inRange = (r: MetricRow) => {
    const d = rowDate(r);
    return d >= rs && d <= re;
  };
  const currentRows = data.rows.filter(inRange);

  // 비교 기준 기간 — 실제 "저장된 날짜" 기준
  const selDates = allDates.filter((d) => d >= rs && d <= re);
  const k = Math.max(1, selDates.length);
  const firstSelIdx = selDates.length
    ? allDates.indexOf(selDates[0])
    : allDates.length;

  // 비교 기준 = 동일 개수만큼의 직전 저장일 (단일 날짜면 "바로 직전 저장일")
  const baseDates = allDates.slice(Math.max(0, firstSelIdx - k), firstSelIdx);
  const baseSet = new Set(baseDates);
  const baseRows = data.rows.filter((r) => baseSet.has(rowDate(r)));
  const basePeriodText =
    baseDates.length === 0
      ? "없음"
      : baseDates[0] === baseDates[baseDates.length - 1]
        ? fmtDate(baseDates[0])
        : `${fmtDate(baseDates[0])} - ${fmtDate(baseDates[baseDates.length - 1])}`;

  const o = agg(currentRows);
  const base = baseRows.length ? agg(baseRows) : null;
  const byCategory = byCatOf(currentRows);
  const byCategoryBase = baseRows.length ? byCatOf(baseRows) : null;

  const current: DerivedMetrics =
    cat === "all" ? o : byCategory.find((c) => c.slug === cat)?.metrics ?? o;
  const rows =
    cat === "all" ? currentRows : currentRows.filter((r) => r.category === cat);

  const stage = FUNNEL_STAGES.find((s) => s.key === stageKey)!;
  const primary = PRIMARY[stageKey];

  const catBars = byCategory
    .map((c) => ({
      slug: c.slug,
      label: c.label,
      value: primary.pick(c.metrics),
      color: CATEGORY_COLORS[c.slug],
    }))
    .sort((a, b) => b.value - a.value);
  const catMax = Math.max(1, ...catBars.map((b) => b.value));

  // 제품명 기준으로 묶어 기간 내 일자별 행을 합산 (동일 상품이 날짜마다 중복되지 않도록)
  const topRows = [...groupByName(rows).values()]
    .map((rs) => {
      const dm = agg(rs);
      return { r: rs[0], dm, v: primary.pick(dm) };
    })
    .sort((a, b) => b.v - a.v)
    .slice(0, 10);
  const topMax = Math.max(1, ...topRows.map((t) => t.v));

  const slicesOf = (pick: (m: DerivedMetrics) => number) =>
    byCategory.map((c) => ({
      label: c.label,
      value: pick(c.metrics),
      color: CATEGORY_COLORS[c.slug],
    }));

  // 기간 내 일자별 추이
  const trendCfg = TREND_METRICS.find((t) => t.key === trendKey)!;
  const datesInRange = allDates.filter((d) => d >= rs && d <= re);
  const rowName = (r: MetricRow) =>
    r.keyword ?? r.ad_group ?? r.campaign ?? "-";
  const shortName = (s: string) => (s.length > 18 ? s.slice(0, 18) + "…" : s);

  // 전체 탭 → 카테고리별 라인 / 특정 카테고리 탭 → 제품(상품)별 라인 / 그 외 → 단일
  const showCatLines = cat === "all" && trendByCat;
  const showProductLines = cat !== "all" && trendByCat;

  // 제품별: 선택 지표 기준 상위 6개 상품
  const productNames: string[] = [];
  if (showProductLines) {
    const byName = new Map<string, MetricRow[]>();
    for (const r of rows) {
      const n = rowName(r);
      if (!byName.has(n)) byName.set(n, []);
      byName.get(n)!.push(r);
    }
    productNames.push(
      ...[...byName.entries()]
        .map(([n, rs2]) => ({ n, v: trendCfg.pick(agg(rs2)) }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 6)
        .map((p) => p.n),
    );
  }

  const trendSeries: { key: string; name: string; color: string }[] = showCatLines
    ? [...byCategory]
        .map((c) => ({ c, v: trendCfg.pick(c.metrics) }))
        .sort((a, b) => b.v - a.v)
        .map(({ c }) => ({
          key: c.slug,
          name: c.label,
          color: CATEGORY_COLORS[c.slug],
        }))
    : showProductLines
      ? productNames.map((n, i) => ({
          key: `p${i}`,
          name: shortName(n),
          color: PRODUCT_PALETTE[i % PRODUCT_PALETTE.length],
        }))
      : [
          {
            key: "value",
            name:
              cat === "all"
                ? "전체"
                : CATEGORIES.find((c) => c.slug === cat)?.label ?? "전체",
            color: trendCfg.color,
          },
        ];

  const trendData: Record<string, number | string>[] = datesInRange.map((d) => {
    const dayRows = rows.filter((r) => rowDate(r) === d);
    const point: Record<string, number | string> = { label: mmdd(d) };
    if (showCatLines) {
      for (const c of CATEGORIES)
        point[c.slug] = trendCfg.pick(
          agg(dayRows.filter((r) => r.category === c.slug)),
        );
    } else if (showProductLines) {
      productNames.forEach((n, i) => {
        point[`p${i}`] = trendCfg.pick(
          agg(dayRows.filter((r) => rowName(r) === n)),
        );
      });
    } else {
      point.value = trendCfg.pick(agg(dayRows));
    }
    return point;
  });

  const days = rs && re ? daysInclusive(rs, re) : 0;
  const effBudget = data.dailyBudget * days;
  const execRate = effBudget > 0 ? o.cost / effBudget : null;
  const periodText = rs
    ? rs === re
      ? fmtDate(rs)
      : `${fmtDate(rs)} - ${fmtDate(re)}`
    : "기간 없음";

  const baseMetric = (slug: string, pick: (m: DerivedMetrics) => number) => {
    if (!byCategoryBase) return null;
    const m = byCategoryBase.find((c) => c.slug === slug)?.metrics;
    return m ? pick(m) : null;
  };

  const conversionBreakdown = byCategory
    .map((c) => ({
      slug: c.slug,
      label: c.label,
      value: c.metrics.conversions,
      prev: baseMetric(c.slug, (m) => m.conversions),
      color: CATEGORY_COLORS[c.slug],
    }))
    .sort((a, b) => b.value - a.value);

  const revenueBreakdown = byCategory
    .map((c) => ({
      slug: c.slug,
      label: c.label,
      value: c.metrics.conversionValue,
      prev: baseMetric(c.slug, (m) => m.conversionValue),
      color: CATEGORY_COLORS[c.slug],
    }))
    .sort((a, b) => b.value - a.value);

  const roasBreakdown = byCategory
    .map((c) => ({
      slug: c.slug,
      label: c.label,
      value: c.metrics.roas,
      prev: baseMetric(c.slug, (m) => m.roas),
      color: CATEGORY_COLORS[c.slug],
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <>
      {/* 상단 바: 제목 + 기간 선택(우측). 변화분석/네비/로그아웃은 사이드바 */}
      <TopBar title="Analytics Dashboard" contentClassName="px-4 py-[18px] md:px-8">
        {/* 기간 범위 선택 (달력 하나) */}
        <RangeCalendar
          start={rs}
          end={re}
          min={earliest}
          max={latest}
          onChange={(s, e) => {
            setRangeStart(s);
            setRangeEnd(e);
          }}
        />
      </TopBar>

      {/* 본문 */}
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      {!data.configured && (
        <Banner tone="amber">Supabase 환경변수가 설정되지 않았습니다.</Banner>
      )}
      {data.configured && !data.hasData && (
        <Banner tone="blue">
          데이터가 없습니다. 우측 상단 <b>데이터 업로드</b>에서 네이버 보고서를
          올리세요.
        </Banner>
      )}


      {/* 상단 카드: ROAS */}
      <div className="grid gap-5">
        <div className={CARD_CLASS}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">ROAS</span>
          </div>
          <div className="mt-2 text-5xl font-bold text-slate-900">
            {fmtRoas(o.roas)}
          </div>
        </div>
      </div>

      {/* 카테고리 비중 막대 카드 3개 */}
      <div className="grid gap-5 md:grid-cols-3">
        <BreakdownCard
          title="총 전환건수"
          value={`${fmtInt(o.conversions)}개`}
          valueFormatter={(value) => `${fmtInt(value)}개`}
          showPercent={breakdownShowPercent}
          onToggleDisplay={() => setBreakdownShowPercent((value) => !value)}
          slices={slicesOf((m) => m.conversions)}
        />
        <BreakdownCard
          title="총 매출액"
          value={fmtWon(o.conversionValue)}
          valueFormatter={fmtWon}
          showPercent={breakdownShowPercent}
          onToggleDisplay={() => setBreakdownShowPercent((value) => !value)}
          slices={slicesOf((m) => m.conversionValue)}
        />
        <BreakdownCard
          title="총 광고비"
          value={fmtWon(o.cost)}
          valueFormatter={fmtWon}
          showPercent={breakdownShowPercent}
          onToggleDisplay={() => setBreakdownShowPercent((value) => !value)}
          action={
            <button
              type="button"
              onClick={() => setCostDetailOpen((value) => !value)}
              className="text-[11px] font-medium text-[#03A84E] hover:text-[#027A38]"
            >
              {costDetailOpen ? "집행내역 접기 ▲" : "집행내역 보기 ▼"}
            </button>
          }
          slices={slicesOf((m) => m.cost)}
        >
          {costDetailOpen && (
            <div className="rounded-lg border border-[#E1E7EF] bg-[#F6F8FB] p-3 text-xs text-slate-500">
              <div className="flex items-center justify-between gap-3">
                <span>기간 예산</span>
                <span className="tabular-nums font-semibold text-slate-700">
                  {fmtWon(effBudget)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span>일 예산 × 기간</span>
                <span className="tabular-nums text-slate-400">
                  {fmtWon(data.dailyBudget)} × {days}일
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span>집행률</span>
                <span
                  className={
                    execRate && execRate > 1
                      ? "tabular-nums font-semibold text-red-500"
                      : "tabular-nums font-semibold text-[#03A84E]"
                  }
                >
                  {execRate != null ? fmtPct(execRate) : "-"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span>잔여</span>
                <span
                  className={
                    effBudget - o.cost < 0
                      ? "tabular-nums font-semibold text-red-500"
                      : "tabular-nums font-semibold text-[#03A84E]"
                  }
                >
                  {fmtWon(effBudget - o.cost)}
                </span>
              </div>
            </div>
          )}
        </BreakdownCard>
      </div>

      {/* 기간 내 추이 (중앙) */}
      {data.hasData && (
        <div className={CARD_CLASS}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-800">
              기간 내 추이{" "}
              <span className="text-sm font-normal text-slate-400">
                {periodText} · {cat === "all" ? "전체" : CATEGORIES.find((c) => c.slug === cat)?.label}
              </span>
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-md bg-[#EEF2F6] shadow-[0_1px_4px_rgba(66,80,102,0.03)]">
                <button
                  onClick={() => setTrendByCat(false)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    !trendByCat ? "bg-[#465466] text-white" : "text-[#4F5B6A] hover:bg-[#E4EAF1]"
                  }`}
                >
                  합산
                </button>
                <button
                  onClick={() => setTrendByCat(true)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    trendByCat ? "bg-[#465466] text-white" : "text-[#4F5B6A] hover:bg-[#E4EAF1]"
                  }`}
                >
                  {cat === "all" ? "카테고리별" : "제품별"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {TREND_METRICS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTrendKey(t.key)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      trendKey === t.key
                        ? ACTIVE_CHIP_CLASS
                        : IDLE_CHIP_CLASS
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {datesInRange.length <= 1 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              추이를 보려면 기간을 2일 이상으로 선택하세요. (현재 {datesInRange.length}일)
            </p>
          ) : (
            <TrendChart
              data={trendData}
              series={trendSeries}
              valueFmt={trendCfg.fmt}
            />
          )}
        </div>
      )}

      {/* 카테고리 탭 + 퍼널 + 상세 분석 */}
      <section className={CARD_CLASS}>
        <div className="mb-5 flex flex-wrap gap-2">
          <Tab active={cat === "all"} onClick={() => setCat("all")}>
            전체
          </Tab>
          {CATEGORIES.map((c) => (
            <Tab key={c.slug} active={cat === c.slug} onClick={() => setCat(c.slug)}>
              {c.label}
            </Tab>
          ))}
        </div>

        <div className="grid items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
          {FUNNEL_STAGES.map((s, i) => {
            const selected = s.key === stageKey;
            return (
              <Fragment key={s.key}>
                <button
                  onClick={() => setStageKey(s.key)}
                  className={`flex min-w-0 flex-col rounded-[15px] border text-left transition ${
                    selected
                      ? "border-[#03C75A] bg-[#F4FFF8]"
                      : "border-transparent bg-[#EEF2F6] hover:bg-[#E4EAF1] hover:shadow-[0_4px_10px_rgba(66,80,102,0.04)]"
                  }`}
                >
                  <div
                    className={`rounded-t-[14px] px-4 py-2 text-center text-sm font-semibold ${
                      selected
                        ? "bg-[#03C75A] text-white"
                        : "bg-[#E4EAF1] text-[#4F5B6A]"
                    }`}
                  >
                    {s.label}
                  </div>
                  <div
                    className={`flex-1 space-y-2 rounded-b-[14px] px-4 py-4 ${
                      selected ? "bg-[#F4FFF8]" : "bg-[#F6F8FB]"
                    }`}
                  >
                    {s.metrics.map((m) => (
                      <div
                        key={m.label}
                        className="flex items-center justify-between gap-3 text-left"
                      >
                        <div className="text-xs text-slate-500">{m.label}</div>
                        <div className="shrink-0 text-right font-bold text-slate-800">
                          {m.value(current)}
                        </div>
                      </div>
                    ))}
                  </div>
                </button>
                {i < FUNNEL_STAGES.length - 1 && (
                  <div className="hidden items-center justify-center px-1 text-lg text-slate-300 md:flex">
                    ▶
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-2">
          <div className="md:col-span-3">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              카테고리별 {primary.label}
            </h3>
            <div className="md:pr-7">
              <MetricRankList
                items={catBars.map((b) => ({
                  key: b.slug,
                  label: b.label,
                  value: b.value,
                  color: b.color,
                  active: cat === b.slug,
                  onClick: () => setCat(b.slug),
                }))}
                maxValue={catMax}
                valueFormatter={primary.fmt}
                showIndex={false}
              />
            </div>
          </div>

          <div className="md:col-span-3 md:col-start-5 md:pl-7 md:pr-[17px]">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              {primary.label} 상위 상품{" "}
              <span className="font-normal text-slate-400">
                · {cat === "all" ? "전체" : CATEGORIES.find((c) => c.slug === cat)?.label}
              </span>
            </h3>
            <MetricRankList
              items={topRows.map((t, i) => ({
                key: `${t.r.keyword ?? t.r.ad_group ?? t.r.campaign ?? "row"}-${i}`,
                label: t.r.keyword ?? t.r.ad_group ?? t.r.campaign ?? "-",
                value: t.v,
                color: CATEGORY_COLORS[t.r.category] ?? "#94a3b8",
              }))}
              maxValue={topMax}
              valueFormatter={primary.fmt}
            />
          </div>
        </div>
      </section>

      </div>
    </>
  );
}

/* ---------- 하위 컴포넌트 ---------- */

/** 달력 하나로 기간(시작~종료)을 선택하는 팝오버 */
function RangeCalendar({
  start,
  end,
  min,
  max,
  onChange,
}: {
  start: string;
  end: string;
  min: string;
  max: string;
  onChange: (start: string, end: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [view, setView] = useState(start || max);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPending(null);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setPending(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const parse = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return { y, m: m - 1, d };
  };
  const fmtD = (iso: string) => iso.replaceAll("-", ".");

  // 데이터가 없으면 달력 대신 안내
  if (!max) {
    return (
      <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">
        기간 없음
      </span>
    );
  }

  const base = view || start || max;
  const { y: vy, m: vm } = parse(base);
  const monthLabel = `${vy}년 ${vm + 1}월`;
  const firstWeekday = new Date(vy, vm, 1).getDay();
  const daysInMonth = new Date(vy, vm + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(vy, vm, d));

  const shift = (delta: number) => {
    const nd = new Date(vy, vm + delta, 1);
    setView(toISO(nd.getFullYear(), nd.getMonth(), 1));
  };
  const viewMonth = base.slice(0, 7);
  const canPrev = viewMonth > min.slice(0, 7);
  const canNext = viewMonth < max.slice(0, 7);

  const pick = (day: string) => {
    if (day < min || day > max) return;
    if (pending == null) {
      setPending(day);
    } else {
      let s = pending;
      let e = day;
      if (s > e) [s, e] = [e, s];
      onChange(s, e);
      setPending(null);
      setOpen(false);
    }
  };

  const label =
    start === end ? fmtD(start) : `${fmtD(start)} ~ ${fmtD(end)}`;
  const isEdge = (day: string) =>
    pending ? day === pending : day === start || day === end;
  const within = (day: string) =>
    pending ? false : day > start && day < end;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            setView(start || max);
            setPending(null);
            setOpen(true);
          }
        }}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        <span aria-hidden>📅</span>
        <span>{start ? label : "기간 선택"}</span>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-[280px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => canPrev && shift(-1)}
              disabled={!canPrev}
              className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-slate-700">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => canNext && shift(1)}
              disabled={!canNext}
              className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-slate-400">
            {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const disabled = day < min || day > max;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(day)}
                  className={`h-8 rounded-md text-xs transition ${
                    disabled
                      ? "cursor-default text-slate-300"
                      : isEdge(day)
                        ? "bg-emerald-600 font-semibold text-white"
                        : within(day)
                          ? "bg-emerald-100 text-emerald-800"
                          : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {parse(day).d}
                </button>
              );
            })}
          </div>

          <div className="mt-2 text-center text-[11px] text-slate-400">
            {pending ? "종료일을 선택하세요" : "시작일 → 종료일 순으로 클릭"}
          </div>
        </div>
      )}
    </div>
  );
}

function ChangeRow({
  label,
  metrics,
  baseMetrics,
  basePick,
  bold,
}: {
  label: string;
  metrics: DerivedMetrics;
  baseMetrics?: DerivedMetrics;
  basePick?: (pick: (m: DerivedMetrics) => number) => number | null;
  bold?: boolean;
}) {
  return (
    <tr className={bold ? "bg-slate-50" : ""}>
      <td className={`px-2 py-2 text-left ${bold ? "font-bold" : "text-slate-600"}`}>
        {label}
      </td>
      {CHANGE_COLS.map((col) => {
        const cur = col.pick(metrics);
        const prev = baseMetrics
          ? col.pick(baseMetrics)
          : basePick
            ? basePick(col.pick)
            : null;
        return (
          <td key={col.label} className="px-2 py-2 text-right">
            <div className="tabular-nums font-medium text-slate-800">
              {col.fmt(cur)}
            </div>
            <Delta curr={cur} prev={prev} goodWhenUp={col.goodUp} />
          </td>
        );
      })}
    </tr>
  );
}

function MetricRankList({
  items,
  maxValue,
  valueFormatter,
  showIndex = true,
}: {
  items: {
    key: string;
    label: string;
    value: number;
    color: string;
    active?: boolean;
    onClick?: () => void;
  }[];
  maxValue: number;
  valueFormatter: (value: number) => string;
  showIndex?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-slate-400">
        데이터가 없습니다.
      </div>
    );
  }

  return (
    <ol className="m-0 list-none space-y-2.5 p-0">
      {items.map((item, index) => {
        const labelClass = item.active
          ? "font-bold text-slate-900"
          : "text-slate-700 hover:text-slate-900";
        return (
          <li key={item.key} className="flex items-start gap-2.5 text-sm">
            {showIndex && (
              <span className="w-5 shrink-0 pt-0.5 text-left text-xs font-semibold text-slate-400">
                {index + 1}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="grid grid-cols-[minmax(0,1fr)_10rem] items-start gap-2">
                {item.onClick ? (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className={`block min-w-0 truncate text-left ${labelClass}`}
                    title={item.label}
                  >
                    {item.label}
                  </button>
                ) : (
                  <div className="min-w-0 truncate text-slate-700" title={item.label}>
                    {item.label}
                  </div>
                )}
                <span aria-hidden />
              </div>
              <div className="mt-1 grid grid-cols-[minmax(0,1fr)_10rem] items-center gap-2">
                <Bar pct={(item.value / maxValue) * 100} color={item.color} />
                <span className="block w-full text-right tabular-nums font-semibold text-slate-800">
                  {valueFormatter(item.value)}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function BreakdownCard({
  title,
  value,
  wow,
  action,
  slices,
  valueFormatter,
  showPercent,
  onToggleDisplay,
  children,
}: {
  title: string;
  value: string;
  wow?: React.ReactNode;
  action?: React.ReactNode;
  slices: { label: string; value: number; color: string }[];
  valueFormatter?: (value: number) => string;
  showPercent?: boolean;
  onToggleDisplay?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 ${CARD_CLASS}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-500">{title}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
        </div>
        {(wow || action) && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            {wow}
            {action}
          </div>
        )}
      </div>
      <div className="mt-3">
        <CategoryBars
          slices={slices}
          valueFormatter={valueFormatter}
          showPercent={showPercent}
          onToggleDisplay={onToggleDisplay}
        />
      </div>
      {children && <div className="mt-4 border-t border-slate-100 pt-4">{children}</div>}
    </div>
  );
}

function MetricBreakdown({
  items,
  fmt,
  unit = "",
}: {
  items: {
    slug: string;
    label: string;
    value: number;
    prev: number | null;
    color: string;
  }[];
  fmt: (n: number) => string;
  unit?: string;
}) {
  const formatValue = (value: number) => `${fmt(value)}${unit}`;

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div
          key={item.slug}
          className="grid grid-cols-[6rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-sm"
        >
          <span className="whitespace-nowrap text-slate-600">{item.label}</span>
          <span className="min-w-0 whitespace-nowrap text-right tabular-nums font-semibold text-slate-800">
            {formatValue(item.value)}
          </span>
          <span className="whitespace-nowrap text-right">
            <Delta curr={item.value} prev={item.prev} />
          </span>
        </div>
      ))}
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active
          ? ACTIVE_CHIP_CLASS
          : IDLE_CHIP_CLASS
      }`}
    >
      {children}
    </button>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "amber" | "blue";
  children: React.ReactNode;
}) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}