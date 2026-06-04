"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  type CategorySlug,
} from "@/lib/categories";
import { FUNNEL_STAGES, deriveRow, type FunnelStage } from "@/lib/funnel";
import {
  deriveMetrics,
  sumTotals,
  fmtInt,
  fmtWon,
  fmtPct,
  fmtRoas,
  type DerivedMetrics,
} from "@/lib/metrics";
import { CategoryDonut } from "@/components/CategoryDonut";
import { TrendChart } from "@/components/TrendChart";
import type { DashboardData, MetricRow } from "@/lib/data";

type Filter = CategorySlug | "all";
type CompareMode = "prev" | "day" | "week" | "month";
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

const COMPARE_LABEL: Record<CompareMode, string> = {
  prev: "직전 기간",
  day: "전날",
  week: "전주",
  month: "전달",
};

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
  { key: "impressions", label: "노출수", pick: (m) => m.impressions, fmt: fmtInt, color: "#3b82f6" },
  { key: "clicks", label: "클릭수", pick: (m) => m.clicks, fmt: fmtInt, color: "#10b981" },
  { key: "cost", label: "광고비", pick: (m) => m.cost, fmt: fmtWon, color: "#f59e0b" },
  { key: "conversions", label: "전환", pick: (m) => m.conversions, fmt: fmtInt, color: "#8b5cf6" },
  { key: "conversionValue", label: "매출", pick: (m) => m.conversionValue, fmt: fmtWon, color: "#ec4899" },
  { key: "roas", label: "ROAS", pick: (m) => m.roas, fmt: fmtRoas, color: "#0ea5e9" },
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

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toIso(d);
};
const addMonths = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return toIso(d);
};
const daysInclusive = (start: string, end: string) =>
  Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1);

const agg = (rs: MetricRow[]) => deriveMetrics(sumTotals(rs));
const byCatOf = (rs: MetricRow[]) =>
  CATEGORIES.map((c) => ({
    slug: c.slug,
    label: c.label,
    metrics: agg(rs.filter((r) => r.category === c.slug)),
  }));

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 flex-1 rounded-full bg-slate-100">
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
    <span className={`text-[11px] ${good ? "text-emerald-600" : "text-red-500"}`}>
      {up ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(1)}%
    </span>
  );
}

function WoW({
  curr,
  prev,
  fmt,
  mode,
  goodWhenUp = true,
  showDetail = false,
  onClick,
}: {
  curr: number;
  prev: number | null;
  fmt: (n: number) => string;
  mode: CompareMode;
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
      {COMPARE_LABEL[mode]}대비{" "}
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

  const [rangeStart, setRangeStart] = useState(earliest);
  const [rangeEnd, setRangeEnd] = useState(latest);
  const [compareMode, setCompareMode] = useState<CompareMode>("prev");
  const [cat, setCat] = useState<Filter>("all");
  const [stageKey, setStageKey] = useState<FunnelStage["key"]>("awareness");
  const [trendKey, setTrendKey] = useState<MetricKey>("conversionValue");
  const [showChange, setShowChange] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);

  // 유효 범위 (데이터 범위로 보정)
  let rs = rangeStart && allDates.includes(rangeStart) ? rangeStart : earliest;
  let re = rangeEnd && allDates.includes(rangeEnd) ? rangeEnd : latest;
  if (rs && re && rs > re) [rs, re] = [re, rs];

  const inRange = (r: MetricRow) => {
    const d = rowDate(r);
    return d >= rs && d <= re;
  };
  const currentRows = data.rows.filter(inRange);

  // 비교 기준 기간 (범위를 통째로 뒤로 이동)
  const rangeLen = rs && re ? daysInclusive(rs, re) : 1;
  let baseStart: string, baseEnd: string;
  if (compareMode === "month") {
    baseStart = addMonths(rs, -1);
    baseEnd = addMonths(re, -1);
  } else {
    const off = compareMode === "day" ? 1 : compareMode === "week" ? 7 : rangeLen;
    baseStart = addDays(rs, -off);
    baseEnd = addDays(re, -off);
  }
  const baseRows = data.rows.filter((r) => {
    const d = rowDate(r);
    return d >= baseStart && d <= baseEnd;
  });

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

  const topRows = [...rows]
    .map((r) => {
      const dm = deriveRow(r);
      return { r, dm, v: primary.pick(dm) };
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

  // 기간 내 일자별 추이 (선택 카테고리 기준)
  const trendCfg = TREND_METRICS.find((t) => t.key === trendKey)!;
  const datesInRange = allDates.filter((d) => d >= rs && d <= re);
  const trendData = datesInRange.map((d) => ({
    label: mmdd(d),
    value: trendCfg.pick(agg(rows.filter((r) => rowDate(r) === d))),
  }));

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
    <div className="space-y-5">
      {/* 헤더 */}
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">네이버 광고 애널라이저</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* 기간 범위 선택 */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
            <DateSelect dates={allDates} value={rs} onChange={setRangeStart} />
            <span className="text-slate-400">~</span>
            <DateSelect dates={allDates} value={re} onChange={setRangeEnd} />
          </div>
          <select
            value={compareMode}
            onChange={(e) => setCompareMode(e.target.value as CompareMode)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
            title="비교 기준"
          >
            <option value="prev">직전 기간 대비</option>
            <option value="day">전날 대비</option>
            <option value="week">전주 대비</option>
            <option value="month">전달 대비</option>
          </select>
          <button
            onClick={() => setShowChange((v) => !v)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              showChange
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            변화 분석
          </button>
          <Link
            href="/manage"
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            데이터 관리
          </Link>
          <Link
            href="/upload"
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            데이터 업로드
          </Link>
        </div>
      </header>

      {!data.configured && (
        <Banner tone="amber">Supabase 환경변수가 설정되지 않았습니다.</Banner>
      )}
      {data.configured && !data.hasData && (
        <Banner tone="blue">
          데이터가 없습니다. 우측 상단 <b>데이터 업로드</b>에서 네이버 보고서를
          올리세요.
        </Banner>
      )}

      {/* 기간 내 추이 */}
      {data.hasData && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-800">
              기간 내 추이{" "}
              <span className="text-sm font-normal text-slate-400">
                {periodText} · {cat === "all" ? "전체" : CATEGORIES.find((c) => c.slug === cat)?.label}
              </span>
            </h3>
            <div className="flex flex-wrap gap-1">
              {TREND_METRICS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTrendKey(t.key)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    trendKey === t.key
                      ? "bg-slate-700 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {datesInRange.length <= 1 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              추이를 보려면 기간을 2일 이상으로 선택하세요. (현재 {datesInRange.length}일)
            </p>
          ) : (
            <TrendChart data={trendData} color={trendCfg.color} valueFmt={trendCfg.fmt} />
          )}
        </div>
      )}

      {/* 변화 분석 표 */}
      {showChange && (
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-800">
            변화 분석{" "}
            <span className="text-sm font-normal text-slate-400">
              {periodText} vs {COMPARE_LABEL[compareMode]}
            </span>
          </h3>
          {!base ? (
            <p className="py-6 text-center text-sm text-slate-400">
              비교할 {COMPARE_LABEL[compareMode]} 데이터가 없습니다.
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

      {/* 상단 카드: ROAS / 예산 */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">ROAS</span>
            <WoW
              curr={o.roas}
              prev={base?.roas ?? null}
              fmt={fmtRoas}
              mode={compareMode}
              showDetail={showChange}
              onClick={() => setShowChange((v) => !v)}
            />
          </div>
          <div className="mt-2 text-4xl font-bold text-slate-900">
            {fmtRoas(o.roas)}
          </div>
        </div>

        <button
          onClick={() => setBudgetOpen((v) => !v)}
          className="rounded-2xl bg-white p-6 text-left shadow-sm transition hover:ring-2 hover:ring-emerald-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              예산{" "}
              <span className="text-xs text-slate-400">
                ({fmtWon(data.dailyBudget)}/일 × {days}일)
              </span>
            </span>
            <span className="text-[11px] text-emerald-600">
              {budgetOpen ? "닫기 ▲" : "집행내역 ▼"}
            </span>
          </div>
          <div className="mt-2 text-4xl font-bold text-slate-900">
            {fmtWon(effBudget)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            집행 {fmtWon(o.cost)} · 집행률{" "}
            <span
              className={
                execRate && execRate > 1
                  ? "font-semibold text-red-500"
                  : "font-semibold text-emerald-600"
              }
            >
              {execRate != null ? fmtPct(execRate) : "-"}
            </span>
          </div>
        </button>
      </div>

      {budgetOpen && (
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-800">예산 집행 내역</h3>
            <div className="text-sm text-slate-500">
              예산 <b className="text-slate-700">{fmtWon(effBudget)}</b> · 집행{" "}
              <b className="text-slate-700">{fmtWon(o.cost)}</b> · 잔여{" "}
              <b
                className={
                  effBudget - o.cost < 0 ? "text-red-500" : "text-emerald-600"
                }
              >
                {fmtWon(effBudget - o.cost)}
              </b>
            </div>
          </div>
          <div className="space-y-2">
            {[...byCategory]
              .sort((a, b) => b.metrics.cost - a.metrics.cost)
              .map((c) => {
                const share = o.cost > 0 ? c.metrics.cost / o.cost : 0;
                return (
                  <div key={c.slug} className="flex items-center gap-3 text-sm">
                    <span className="w-20 shrink-0 text-slate-600">{c.label}</span>
                    <Bar pct={share * 100} color={CATEGORY_COLORS[c.slug]} />
                    <span className="w-28 shrink-0 text-right tabular-nums font-medium text-slate-800">
                      {fmtWon(c.metrics.cost)}
                    </span>
                    <span className="w-12 shrink-0 text-right text-xs text-slate-400">
                      {fmtPct(share)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 도넛 카드 3개 */}
      <div className="grid gap-5 md:grid-cols-3">
        <DonutCard
          title="총 전환건수"
          value={`${fmtInt(o.conversions)}개`}
          wow={
            <WoW curr={o.conversions} prev={base?.conversions ?? null} fmt={fmtInt} mode={compareMode} showDetail={showChange} onClick={() => setShowChange((v) => !v)} />
          }
          slices={slicesOf((m) => m.conversions)}
        />
        <DonutCard
          title="총매출액"
          value={fmtWon(o.conversionValue)}
          wow={
            <WoW curr={o.conversionValue} prev={base?.conversionValue ?? null} fmt={fmtWon} mode={compareMode} showDetail={showChange} onClick={() => setShowChange((v) => !v)} />
          }
          slices={slicesOf((m) => m.conversionValue)}
        />
        <DonutCard
          title="총광고비"
          value={fmtWon(o.cost)}
          wow={
            <WoW curr={o.cost} prev={base?.cost ?? null} fmt={fmtWon} mode={compareMode} goodWhenUp={false} showDetail={showChange} onClick={() => setShowChange((v) => !v)} />
          }
          slices={slicesOf((m) => m.cost)}
        />
      </div>

      {/* 카테고리 탭 + 퍼널 + 상세 분석 */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
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
                  className={`min-w-[150px] flex-1 overflow-hidden rounded-xl border text-left transition ${
                    selected
                      ? "border-emerald-500 ring-2 ring-emerald-200"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div
                    className={`px-4 py-2 text-center text-sm font-semibold text-white ${
                      selected ? "bg-emerald-600" : "bg-slate-400"
                    }`}
                  >
                    {s.label}
                  </div>
                  <div
                    className={`space-y-2 px-4 py-4 ${
                      selected ? "bg-emerald-50" : "bg-slate-50"
                    }`}
                  >
                    {s.metrics.map((m) => (
                      <div key={m.label} className="text-center">
                        <div className="text-xs text-slate-500">{m.label}</div>
                        <div className="font-bold text-slate-800">
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
    </div>
  );
}

/* ---------- 하위 컴포넌트 ---------- */

function DateSelect({
  dates,
  value,
  onChange,
}: {
  dates: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none"
    >
      {dates.length === 0 && <option value="">-</option>}
      {dates.map((d) => (
        <option key={d} value={d}>
          {fmtDate(d)}
        </option>
      ))}
    </select>
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
          <thead className="bg-slate-100 text-slate-500">
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

function DonutCard({
  title,
  value,
  wow,
  slices,
}: {
  title: string;
  value: string;
  wow: React.ReactNode;
  slices: { label: string; value: number; color: string }[];
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-slate-500">{title}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
        </div>
        {wow}
      </div>
      <div className="mt-3">
        <CategoryDonut slices={slices} />
      </div>
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
          ? "bg-slate-700 text-white"
          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
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
