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
  "bg-[#03C75A] text-white shadow-[0_10px_18px_rgba(32,183,232,0.22)]";
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

  return issues.sort((a, b) => b.score - a.score).slice(0, 12);
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 flex-1 rounded-full bg-[#EEF5FF]">
      <div
        className="h-2 rounded-full"
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

function WoW({
  curr,
  prev,
  fmt,
  goodWhenUp = true,
  showDetail = false,
  onClick,
}: {
  curr: number;
  prev: number | null;
  fmt: (n: number) => string;
  goodWhenUp?: boolean;
  showDetail?: boolean;
  onClick?: () => void;
}) {
  const has = prev != null && prev > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-right text-[11px] font-normal text-slate-400 hover:text-slate-600"
      title="클릭하면 변화값 표시"
    >
      {showDetail && has && (
        <span className="block text-slate-500">
          {fmt(prev!)} → {fmt(curr)}
        </span>
      )}
      전날대비{" "}
      {has ? (
        <Delta curr={curr} prev={prev} goodWhenUp={goodWhenUp} />
      ) : (
        <span className="text-slate-300">—</span>
      )}
    </button>
  );
}

export function DashboardClient({ data }: { data: DashboardData }) {
  const allDates = [...new Set(data.rows.map(rowDate))].sort();
  const earliest = allDates[0] ?? "";
  const latest = allDates[allDates.length - 1] ?? "";

  // 기본값: 가장 최근 1일 (전날 대비 = 최근일 vs 바로 전날). 기간은 달력으로 넓힐 수 있음
  const [rangeStart, setRangeStart] = useState(latest);
  const [rangeEnd, setRangeEnd] = useState(latest);
  const [cat, setCat] = useState<Filter>("all");
  const [stageKey, setStageKey] = useState<FunnelStage["key"]>("awareness");
  const [trendKey, setTrendKey] = useState<MetricKey>("conversionValue");
  const [trendByCat, setTrendByCat] = useState(true);
  const { showChange, toggle: toggleChange } = useChangeAnalysis();
  const [costDetailOpen, setCostDetailOpen] = useState(false);

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
  const issues = buildIssues(currentRows, baseRows);

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

  return (
    <>
      {/* 상단 바: 제목 + 기간 선택(우측). 변화분석/네비/로그아웃은 사이드바 */}
      <TopBar title="Analytics Dashboard" contentClassName="px-4 md:px-8">
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
        <Banner tone="purple">Supabase 환경변수가 설정되지 않았습니다.</Banner>
      )}
      {data.configured && !data.hasData && (
        <Banner tone="blue">
          데이터가 없습니다. 우측 상단 <b>데이터 업로드</b>에서 네이버 보고서를
          올리세요.
        </Banner>
      )}

      {/* 변화 분석 표 */}
      {showChange && (
        <div className={CARD_CLASS}>
          <h3 className="mb-3 font-semibold text-slate-800">
            변화 분석{" "}
            <span className="text-sm font-normal text-slate-400">
              {periodText} vs 전날 ({basePeriodText})
            </span>
          </h3>
          {!base ? (
            <p className="py-6 text-center text-sm text-slate-400">
              비교할 전날 데이터가 없습니다.
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
                  <ChangeRow label="전체" bold metrics={o} baseMetrics={base} />
                  {byCategory.map((c) => (
                    <ChangeRow
                      key={c.slug}
                      label={c.label}
                      metrics={c.metrics}
                      basePick={(pick) => baseMetric(c.slug, pick)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 상단 카드: ROAS */}
      <div className="grid gap-5">
        <div className={CARD_CLASS}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">ROAS</span>
            <WoW
              curr={o.roas}
              prev={base?.roas ?? null}
              fmt={fmtRoas}
              showDetail={showChange}
              onClick={toggleChange}
            />
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
          wow={
            <WoW curr={o.conversions} prev={base?.conversions ?? null} fmt={fmtInt} showDetail={showChange} onClick={toggleChange} />
          }
          valueFormatter={(value) => `${fmtInt(value)}개`}
          slices={slicesOf((m) => m.conversions)}
        />
        <BreakdownCard
          title="총 매출액"
          value={fmtWon(o.conversionValue)}
          wow={
            <WoW curr={o.conversionValue} prev={base?.conversionValue ?? null} fmt={fmtWon} showDetail={showChange} onClick={toggleChange} />
          }
          valueFormatter={fmtWon}
          slices={slicesOf((m) => m.conversionValue)}
        />
        <BreakdownCard
          title="총 광고비"
          value={fmtWon(o.cost)}
          wow={
            <WoW curr={o.cost} prev={base?.cost ?? null} fmt={fmtWon} goodWhenUp={false} showDetail={showChange} onClick={toggleChange} />
          }
          valueFormatter={fmtWon}
          action={
            <button
              type="button"
              onClick={() => setCostDetailOpen((v) => !v)}
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
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    !trendByCat
                      ? "bg-[#465466] text-white"
                      : "text-[#4F5B6A] hover:bg-[#E4EAF1]"
                  }`}
                >
                  합산
                </button>
                <button
                  onClick={() => setTrendByCat(true)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    trendByCat
                      ? "bg-[#465466] text-white"
                      : "text-[#4F5B6A] hover:bg-[#E4EAF1]"
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

        <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
          {FUNNEL_STAGES.map((s, i) => {
            const selected = s.key === stageKey;
            return (
              <Fragment key={s.key}>
                <button
                  onClick={() => setStageKey(s.key)}
                  className={`flex min-w-[120px] flex-1 flex-col overflow-hidden rounded-xl text-left transition ${
                    selected
                      ? "outline outline-2 outline-[#03C75A]"
                      : "bg-[#EEF2F6] hover:bg-[#E4EAF1] hover:shadow-[0_4px_10px_rgba(66,80,102,0.04)]"
                  }`}
                >
                  <div
                    className={`px-4 py-2 text-center text-sm font-semibold ${
                      selected
                        ? "bg-[#03C75A] text-white"
                        : "bg-[#E4EAF1] text-[#4F5B6A]"
                    }`}
                  >
                    {s.label}
                  </div>
                  <div
                    className={`flex-1 space-y-2 px-4 py-4 ${
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
                  <div className="flex items-center text-lg text-slate-300">▶</div>
                )}
              </Fragment>
            );
          })}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              카테고리별 {primary.label}
            </h3>
            <div className="space-y-2.5">
              {catBars.map((b) => (
                <div key={b.slug} className="flex items-center gap-3 text-sm">
                  <button
                    onClick={() => setCat(b.slug)}
                    className={`w-20 shrink-0 text-left ${
                      cat === b.slug
                        ? "font-bold text-slate-900"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {b.label}
                  </button>
                  <Bar pct={(b.value / catMax) * 100} color={b.color} />
                  <span className="w-24 shrink-0 text-right tabular-nums font-medium text-slate-800">
                    {primary.fmt(b.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              {primary.label} 상위 상품{" "}
              <span className="font-normal text-slate-400">
                · {cat === "all" ? "전체" : CATEGORIES.find((c) => c.slug === cat)?.label}
              </span>
            </h3>
            {topRows.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                데이터가 없습니다.
              </div>
            ) : (
              <ol className="space-y-2.5">
                {topRows.map((t, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm">
                    <span className="w-5 shrink-0 text-right text-xs font-semibold text-slate-400">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-slate-700" title={t.r.keyword ?? ""}>
                        {t.r.keyword ?? t.r.ad_group ?? t.r.campaign ?? "-"}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Bar
                          pct={(t.v / topMax) * 100}
                          color={CATEGORY_COLORS[t.r.category] ?? "#94a3b8"}
                        />
                        <span className="w-24 shrink-0 text-right tabular-nums font-semibold text-slate-800">
                          {primary.fmt(t.v)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <DetailTable stage={stage} cat={cat} topRows={topRows} />
      </section>

      {/* 주요 변화 이슈 (전날 대비) */}
      {data.hasData && (
        <section className={CARD_CLASS}>
          <h2 className="text-lg font-semibold text-slate-800">주요 변화 이슈</h2>
          <p className="mb-4 text-sm text-slate-400">
            {periodText} vs 전날({basePeriodText}) · 변화가 큰 순
          </p>
          {!base ? (
            <p className="py-8 text-center text-sm text-slate-400">
              전날 데이터가 없어 비교할 수 없습니다. 다른 날짜 데이터를 업로드하세요.
            </p>
          ) : issues.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              전날 대비 큰 변화가 없습니다.
            </p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {issues.map((is, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-3 rounded-xl border p-3 ${
                    is.tone === "up"
                      ? "border-[#BFEFD2] bg-[#F4FFF8]"
                      : is.tone === "warn"
                        ? "border-[#D9D1FF] bg-[#F8F6FF]"
                        : "border-[#D8DEE8] bg-[#F6F8FB]"
                  }`}
                >
                  <span className="text-lg leading-none">{is.emoji}</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800">
                      {is.title}
                    </div>
                    <div className="text-xs text-slate-500">{is.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
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
        className="flex items-center gap-2 rounded-lg bg-[#EEF2F6] px-3 py-2 text-sm font-semibold text-[#4F5B6A] shadow-[0_1px_4px_rgba(66,80,102,0.03)] hover:bg-[#E4EAF1]"
      >
        <span aria-hidden>📅</span>
        <span>{start ? label : "기간 선택"}</span>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-[280px] rounded-lg border border-[#D8DEE8] bg-white p-3 shadow-[0_10px_22px_rgba(66,80,102,0.08)]">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => canPrev && shift(-1)}
              disabled={!canPrev}
              className="rounded-md px-2 py-1 text-[#6B7480] hover:bg-[#F3F6FA] disabled:opacity-30"
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
              className="rounded-md px-2 py-1 text-[#6B7480] hover:bg-[#F3F6FA] disabled:opacity-30"
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
                        ? `${ACTIVE_CHIP_CLASS} font-semibold`
                        : within(day)
                          ? "bg-[#E8F8EF] text-[#027A38]"
                          : "text-slate-700 hover:bg-[#F3F6FA]"
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

function DetailTable({
  stage,
  cat,
  topRows,
}: {
  stage: FunnelStage;
  cat: Filter;
  topRows: { r: MetricRow; dm: DerivedMetrics; v: number }[];
}) {
  if (topRows.length === 0) return null;
  return (
    <div className="mt-6">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">
        {stage.label} 세부 지표
      </h3>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-[#F3F6FA] text-slate-500">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">상품명</th>
              {cat === "all" && (
                <th className="px-3 py-2.5 text-left font-medium">카테고리</th>
              )}
              {stage.columns.map((col) => (
                <th key={col.label} className="px-3 py-2.5 text-right font-medium">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {topRows.map(({ r, dm }, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td
                  className="max-w-[360px] truncate px-3 py-2.5 text-slate-700"
                  title={r.keyword ?? ""}
                >
                  {r.keyword ?? r.ad_group ?? r.campaign ?? "-"}
                </td>
                {cat === "all" && (
                  <td className="px-3 py-2.5">
                    <CategoryBadge slug={r.category} />
                  </td>
                )}
                {stage.columns.map((col) => (
                  <td
                    key={col.label}
                    className="px-3 py-2.5 text-right tabular-nums text-slate-800"
                  >
                    {col.value(dm)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  value,
  wow,
  action,
  slices,
  valueFormatter,
  children,
}: {
  title: string;
  value: string;
  wow: React.ReactNode;
  action?: React.ReactNode;
  slices: { label: string; value: number; color: string }[];
  valueFormatter?: (value: number) => string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 ${CARD_CLASS}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-500">{title}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {wow}
          {action}
        </div>
      </div>
      <div className="mt-3">
        <CategoryBars slices={slices} valueFormatter={valueFormatter} />
      </div>
      {children && <div className="mt-4 border-t border-slate-100 pt-4">{children}</div>}
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

function CategoryBadge({ slug }: { slug: string }) {
  const label = CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
  const color = CATEGORY_COLORS[slug] ?? "#94a3b8";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "purple" | "blue";
  children: React.ReactNode;
}) {
  const tones = {
    purple: "border-[#D9D1FF] bg-[#F8F6FF] text-[#5B3FD6]",
    blue: "border-[#D8DEE8] bg-white text-[#2F5FB8]",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}
