"use client";

import { useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { DashboardSections } from "@/components/DashboardSections";
import { useChangeAnalysis } from "@/components/AppShell";
import {
  CATEGORIES,
  CATEGORY_COLORS,
} from "@/lib/categories";
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
import { PeriodTrend } from "@/components/PeriodTrend";
import { FunnelFlow } from "@/components/FunnelFlow";
import { ActionRecommendationPanel } from "@/components/ActionRecommendationPanel";
import type { ComparisonExplanation } from "@/lib/recommendation-display";
import type { DashboardData, MetricRow } from "@/lib/data";

const fmtDate = (iso: string) => iso.replaceAll("-", ".");
const fmtAvgCount = (n: number) =>
  n.toLocaleString("ko-KR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(n) ? 0 : 1,
  });
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
  "rounded-[15px] bg-[#F9F9F9] p-6 shadow-[0_8px_22px_rgba(66,80,102,0.05)]";
const CHANGE_ANALYSIS_STORAGE_KEY = "marketing-change-analysis-ranges";

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

const RECOMMENDATION_TONES: ComparisonExplanation["tone"][] = [
  "good",
  "danger",
  "warn",
];
const MAX_RECOMMENDATIONS_PER_TONE = 5;

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

const ratioDelta = (current: number, base: number, minBase = 0) =>
  base > minBase ? (current - base) / base : null;

const fmtDelta = (delta: number | null) =>
  delta == null
    ? "변화율 계산 불가"
    : `${delta >= 0 ? "+" : "-"}${Math.abs(delta * 100).toFixed(1)}%`;

const fmtVsAverage = (value: number, average: number, fmt: (n: number) => string) =>
  average > 0
    ? value >= average
      ? `전체 평균 ${fmt(average)}보다 높음`
      : `전체 평균 ${fmt(average)}보다 낮음`
    : "전체 평균 비교 불가";

const metricVsAverage = (
  label: string,
  value: number,
  average: number,
  fmt: (n: number) => string,
) =>
  average > 0
    ? `${label} = ${fmt(value)} / 전체 평균 ${fmt(average)} / 평균보다 ${value >= average ? "높음" : "낮음"}`
    : `${label} = ${fmt(value)} / 전체 평균 비교 불가`;

const latestDateOf = (rows: MetricRow[]) =>
  rows.reduce<string | null>((latest, row) => {
    const date = rowDate(row);
    return latest == null || date > latest ? date : latest;
  }, null);

const currentBidOf = (rows: MetricRow[], targetDate: string | null = latestDateOf(rows)) => {
  const bids = rows
    .filter((row) => targetDate != null && rowDate(row) === targetDate)
    .map((row) => row.currentBid)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (bids.length === 0) return null;
  return Math.round(bids.reduce((sum, value) => sum + value, 0) / bids.length);
};

const fmtBidWon = (value: number) => `${Math.round(value).toLocaleString("ko-KR")}원`;

const fmtBidRange = (low: number, high: number) =>
  low === high ? fmtBidWon(low) : `${Math.round(low).toLocaleString("ko-KR")}~${fmtBidWon(high)}`;

const bidChangeText = (
  bid: number | null,
  direction: "up" | "down",
  minPct: number,
  maxPct = minPct,
) => {
  if (bid == null || bid <= 0) {
    return "입찰가 기준: 선택기간 마지막 날 입찰가 데이터가 없어 현재가/추천가 계산 불가입니다.";
  }

  const lowPct = Math.min(minPct, maxPct);
  const highPct = Math.max(minPct, maxPct);
  const lowAmount = Math.round(bid * lowPct);
  const highAmount = Math.round(bid * highPct);
  const nextLow = direction === "down" ? Math.max(0, bid - highAmount) : bid + lowAmount;
  const nextHigh = direction === "down" ? Math.max(0, bid - lowAmount) : bid + highAmount;
  const pctText =
    lowPct === highPct
      ? `${Math.round(lowPct * 100)}%`
      : `${Math.round(lowPct * 100)}~${Math.round(highPct * 100)}%`;
  const mark = direction === "down" ? "▼" : "▲";

  return `입찰가 기준: 현재 입찰가 ${fmtBidWon(bid)} → ${fmtBidRange(nextLow, nextHigh)} (${pctText}${mark}) 변경 추천`;
};

const withBidChange = (
  action: string,
  bid: number | null,
  direction: "up" | "down",
  minPct: number,
  maxPct = minPct,
) => `${action}\n${bidChangeText(bid, direction, minPct, maxPct)}`;

function buildComparisonExplanations(
  base: DerivedMetrics,
  current: DerivedMetrics,
  baseByCategory: ReturnType<typeof byCatOf>,
  currentByCategory: ReturnType<typeof byCatOf>,
  baseRows: MetricRow[],
  currentRows: MetricRow[],
  allRows: MetricRow[],
): ComparisonExplanation[] {
  const hasBase = base.cost > 0 || base.conversions > 0 || base.conversionValue > 0;
  const hasCurrent = current.cost > 0 || current.conversions > 0 || current.conversionValue > 0;
  if (!hasBase || !hasCurrent) {
    return [
      {
        tone: "neutral",
        title: "비교할 데이터가 부족합니다",
        body: "기준기간과 비교기간 모두에 광고비, 전환, 매출 데이터가 있어야 제품별 변화 원인과 조치 방향을 설명할 수 있습니다.",
        details: [
          "한쪽 기간에 데이터가 없으면 어떤 제품이 좋아졌거나 나빠졌는지 기준점을 잡기 어렵습니다.",
          "두 기간 모두 같은 방식으로 업로드되어 있는지 먼저 확인하세요.",
        ],
        action: "기준기간과 비교기간에 같은 형식의 보고서를 업로드한 뒤 다시 비교하세요.",
      },
    ];
  }

  type ScoredExplanation = { score: number; item: ComparisonExplanation };


  const categoryName = (slug: string) =>
    CATEGORIES.find((category) => category.slug === slug)?.label ?? slug;

  const metricLine = (prev: DerivedMetrics, cur: DerivedMetrics) => {
    const rev = ratioDelta(cur.conversionValue, prev.conversionValue);
    const conv = ratioDelta(cur.conversions, prev.conversions);
    const cost = ratioDelta(cur.cost, prev.cost);
    return `매출 ${fmtWon(prev.conversionValue)} → ${fmtWon(cur.conversionValue)} (${fmtDelta(rev)}), 전환 ${fmtInt(prev.conversions)}건 → ${fmtInt(cur.conversions)}건 (${fmtDelta(conv)}), 광고비 ${fmtWon(prev.cost)} → ${fmtWon(cur.cost)} (${fmtDelta(cost)}), ROAS ${fmtRoas(prev.roas)} → ${fmtRoas(cur.roas)}`;
  };

  const flowLine = (prev: DerivedMetrics, cur: DerivedMetrics) => {
    const clicks = ratioDelta(cur.clicks, prev.clicks);
    const cvr = ratioDelta(cur.cvr, prev.cvr);
    return `클릭 ${fmtInt(prev.clicks)} → ${fmtInt(cur.clicks)} (${fmtDelta(clicks)}), CVR ${fmtPct(prev.cvr)} → ${fmtPct(cur.cvr)} (${fmtDelta(cvr)})`;
  };

  const signal = (currentValue: number, baseValue: number, threshold = 0.1) => {
    const delta = ratioDelta(currentValue, baseValue);
    if (delta == null) return "기준 없음";
    if (delta >= threshold) return "↑";
    if (delta <= -threshold) return "↓";
    return "→";
  };

  const signalLine = (prev: DerivedMetrics, cur: DerivedMetrics) =>
    `지표 조합: 노출 ${signal(cur.impressions, prev.impressions)} / 클릭 ${signal(cur.clicks, prev.clicks)} / CTR ${signal(cur.ctr, prev.ctr)} / CVR ${signal(cur.cvr, prev.cvr)} / ROAS ${signal(cur.roas, prev.roas, 0.15)} / 매출 ${signal(cur.conversionValue, prev.conversionValue)}`;

  const diagnoseProduct = (prev: DerivedMetrics, cur: DerivedMetrics) => {
    const impressions = ratioDelta(cur.impressions, prev.impressions);
    const clicks = ratioDelta(cur.clicks, prev.clicks);
    const ctr = ratioDelta(cur.ctr, prev.ctr);
    const cvr = ratioDelta(cur.cvr, prev.cvr);
    const conv = ratioDelta(cur.conversions, prev.conversions);
    const revenue = ratioDelta(cur.conversionValue, prev.conversionValue);
    const cost = ratioDelta(cur.cost, prev.cost);
    const roas = ratioDelta(cur.roas, prev.roas, 0.1);

    if (impressions != null && impressions <= -0.15 && revenue != null && revenue <= -0.15) {
      const efficiencyHeld = (roas == null || roas >= -0.1) && (cvr == null || cvr >= -0.1);
      if (efficiencyHeld) {
        return {
          cause: "노출이 줄면서 매출도 같이 줄었지만 CVR/ROAS는 크게 무너지지 않았습니다. 상품 효율보다 노출량 부족에 가까운 흐름입니다.",
          focus: "입찰가 소폭 상향, 노출 회복 후 ROAS 유지 여부",
          action: "입찰가를 바로 크게 올리지 말고 10~15%만 올려 테스트하세요. 효율이 유지될 때만 비중 줄일 제품은 낮추고 이 제품은 올리는 방식으로 옮기세요.",
        };
      }

      return {
        cause: "노출도 줄고 매출도 줄었는데 CVR/ROAS도 방어되지 않았습니다. 억지로 노출을 회복시키기보다 광고비를 회수하는 쪽이 안전합니다.",
        focus: "입찰가 하향, 더 효율 좋은 제품으로 이동",
        action: "이 제품은 입찰가를 10~20% 낮추세요. 낮춘 만큼 같은 카테고리에서 ROAS 또는 CVR이 유지되는 제품 쪽을 올리는 것이 좋습니다. 다음에도 노출과 매출이 같이 빠지면 이동 대상에서 제외하세요.",
      };
    }

    if (cost != null && cost >= 0.2 && (revenue == null || revenue <= 0.05)) {
      return {
        cause: "광고비가 늘었는데 매출이 거의 따라오지 않았습니다. 돈을 더 써도 성과가 붙지 않는 비효율 구간입니다.",
        focus: "입찰가 하향, 전환 없는 검색어 제외, 효율 제품으로 이동",
        action: "입찰가를 10~20% 낮추고, 비용은 발생했지만 구매가 없는 검색어를 제외하세요. 이 제품을 올리기보다 같은 기간에 ROAS가 유지된 제품을 올리는 판단이 맞습니다.",
      };
    }

    if (clicks != null && clicks >= 0.2 && cvr != null && cvr <= -0.2) {
      return {
        cause: "클릭은 늘었지만 CVR이 떨어졌습니다. 관심 없는 클릭이 늘어난 상태라 클릭 수만 보고 좋아졌다고 판단하면 안 됩니다.",
        focus: "입찰가 하향, 넓은 검색어 축소, 구매 없는 클릭 차단",
        action: "클릭을 늘린 검색어 중 구매가 없는 항목을 먼저 줄이세요. 입찰가는 10~15% 낮추고, ROAS가 유지되는 검색어만 남겨야 합니다. 이 상태에서 올리면 클릭은 더 늘어도 매출 효율은 더 나빠질 수 있습니다.",
      };
    }

    if (ctr != null && ctr >= 0.15 && cvr != null && cvr <= -0.2 && (roas == null || roas <= 0.05)) {
      return {
        cause: "CTR은 좋아졌지만 CVR이 떨어져 의미 없는 클릭이 늘어난 흐름입니다. 노출/클릭보다 구매 전환 품질을 먼저 봐야 합니다.",
        focus: "입찰가 유지 또는 하향, 검색어 정리, 구매 없는 유입 축소",
        action: "입찰가를 올리지 말고 유지하거나 10% 낮추세요. 클릭은 많지만 구매가 없는 검색어를 제외하고, CVR과 ROAS가 같이 유지되는 제품은 우선 올리세요.",
      };
    }

    if (conv != null && conv <= -0.35) {
      return {
        cause: "전환수가 의미 있게 줄었습니다. 매출 하락 전 단계일 수 있으므로 광고비를 무작정 유지하면 위험합니다.",
        focus: "전환 발생 검색어 보호, 비전환 검색어 축소, 입찰가 재조정",
        action: "전환이 발생했던 검색어와 광고그룹은 유지하고, 전환 없는 검색어의 입찰가를 낮추세요. 전환이 줄었는데도 비용이 유지되거나 늘었다면 10~20% 낮춰 효율 제품 쪽을 올리는 것이 좋습니다.",
      };
    }

    if (roas != null && roas <= -0.2) {
      return {
        cause: "ROAS가 떨어졌습니다. 같은 돈을 써도 매출이 덜 나오는 상태라 입찰 확장보다 비용 방어가 먼저입니다.",
        focus: "입찰가 하향, 고비용 저매출 검색어 정리, 효율 제품으로 이동",
        action: "비용 상위 검색어를 매출 발생 여부로 나눠 보세요. 비용은 큰데 매출이 낮은 검색어는 입찰가를 낮추거나 제외하고, 전환당 매출이 높은 제품/키워드 쪽을 올리세요.",
      };
    }

    if (impressions != null && impressions <= -0.15 && (roas == null || roas >= 0) && (cvr == null || cvr >= 0)) {
      return {
        cause: "노출은 줄었지만 CVR/ROAS는 유지되고 있습니다. 성과가 나쁜 게 아니라 보여지는 양이 줄어든 상태일 수 있습니다.",
        focus: "입찰가 소폭 상향 테스트",
        action: "입찰가를 10% 정도만 올려 노출 회복을 테스트하세요. 총예산은 늘리지 말고, 효율이 유지될 때만 비효율 제품을 낮추고 이 제품을 올리면 됩니다.",
      };
    }

    return {
      cause: "한 지표만으로 판단하기 어렵고, 노출·클릭·전환·ROAS가 섞여 움직이는 복합 구간입니다.",
      focus: "광고비 상위 검색어, 전환 발생 여부, ROAS 유지 여부",
      action: "입찰가를 크게 바꾸지 말고 비용 상위 검색어부터 전환 유무를 확인하세요. 전환 없는 검색어는 낮추고, ROAS가 유지되는 제품은 조금씩 올리는 방식이 안전합니다.",
    };
  };
  const baseGroups = groupByName(baseRows);
  const currentGroups = groupByName(currentRows);
  const currentPeriodDays = Math.max(1, new Set(currentRows.map(rowDate)).size);
  const names = [...new Set([...baseGroups.keys(), ...currentGroups.keys()])];
  const currentStartDate = currentRows.reduce<string | null>((earliest, row) => {
    const date = rowDate(row);
    return earliest == null || date < earliest ? date : earliest;
  }, null);
  const historyRowsAll = currentStartDate != null
    ? allRows.filter((row) => rowDate(row) < currentStartDate)
    : baseRows;
  const historyGroups = groupByName(historyRowsAll);
  const overallHistoryMetrics = agg(historyRowsAll);
  const minimumInvestRoas = Math.max(3, current.roas * 0.8);
  const minimumHistoryRoas = Math.max(1, overallHistoryMetrics.roas * 0.5);
  const minimumPoorRoas = Math.max(0.8, current.roas * 0.35);
  const productHistory = (name: string, fallbackRows: MetricRow[]) => {
    const historyRows = historyGroups.get(name) ?? fallbackRows;
    const historyDates = [...new Set(historyRows.map(rowDate))].sort();
    const recentDateSet = new Set(historyDates.slice(-7));
    const recentRows = historyRows.filter((row) => recentDateSet.has(rowDate(row)));
    const metrics = agg(historyRows);
    const recentMetrics = agg(recentRows);
    return {
      metrics,
      recentMetrics,
      recentDays: Math.max(1, recentDateSet.size),
      activeDays: historyDates.length,
      hasStrongHistory:
        metrics.conversionValue >= 50000 &&
        metrics.cost > 0 &&
        metrics.roas >= minimumHistoryRoas &&
        metrics.conversions >= 2,
    };
  };

  type ProductDriver = {
    name: string;
    detail: string;
    reason: string;
    score: number;
  };

  const productDriversForCategory = (
    slug: string,
    mode: "bad" | "good",
  ): ProductDriver[] =>
    names
      .map((name): ProductDriver | null => {
        const prevRows = (baseGroups.get(name) ?? []).filter((row) => row.category === slug);
        const curRows = (currentGroups.get(name) ?? []).filter((row) => row.category === slug);
        if (prevRows.length === 0 && curRows.length === 0) return null;

        const prev = agg(prevRows);
        const cur = agg(curRows);
        const displayName = truncName(name, 34);
        const rev = ratioDelta(cur.conversionValue, prev.conversionValue);
        const cost = ratioDelta(cur.cost, prev.cost);
        const conv = ratioDelta(cur.conversions, prev.conversions);
        const roasDelta = cur.roas - prev.roas;
        const lostRevenue = Math.max(0, prev.conversionValue - cur.conversionValue);
        const extraCost = Math.max(0, cur.cost - prev.cost);
        const metricSummary = `매출 ${fmtWon(prev.conversionValue)} → ${fmtWon(cur.conversionValue)}, 광고비 ${fmtWon(prev.cost)} → ${fmtWon(cur.cost)}, ROAS ${fmtRoas(prev.roas)} → ${fmtRoas(cur.roas)}`;

        if (mode === "good") {
          if (cur.conversionValue >= 10000 && rev != null && rev >= 0.2 && cur.roas >= prev.roas) {
            return {
              name: displayName,
              reason: "매출과 효율 개선",
              detail: `${displayName}: 매출 ${fmtDelta(rev)}, ROAS ${fmtRoas(prev.roas)} → ${fmtRoas(cur.roas)}`,
              score: rev + cur.conversionValue / 100000,
            };
          }
          return null;
        }

        if (prevRows.length === 0 && cur.cost >= 10000 && cur.conversionValue <= 0) {
          return {
            name: displayName,
            reason: "신규 비용 발생/매출 없음",
            detail: `${displayName}: 신규 광고비 ${fmtWon(cur.cost)}, 매출 ${fmtWon(cur.conversionValue)}`,
            score: cur.cost / 10000 + cur.clicks / 20,
          };
        }

        if (prev.conversionValue >= 30000 && rev != null && rev <= -0.25) {
          return {
            name: displayName,
            reason: "매출 하락",
            detail: `${displayName}: ${metricSummary}`,
            score: lostRevenue / 50000 + Math.abs(rev) + Math.abs(Math.min(conv ?? 0, 0)),
          };
        }

        if (cur.cost >= 10000 && cost != null && cost >= 0.25 && (rev == null || rev <= 0.05 || roasDelta <= -0.25)) {
          return {
            name: displayName,
            reason: "비용 증가 대비 매출 약함",
            detail: `${displayName}: ${metricSummary}`,
            score: extraCost / 20000 + cost + Math.abs(Math.min(rev ?? 0, 0)) + Math.abs(Math.min(roasDelta, 0)),
          };
        }

        if (prev.conversions >= 2 && conv != null && conv <= -0.35) {
          return {
            name: displayName,
            reason: "전환수 하락",
            detail: `${displayName}: 전환 ${fmtInt(prev.conversions)}건 → ${fmtInt(cur.conversions)}건, ${metricSummary}`,
            score: Math.abs(conv) + lostRevenue / 70000,
          };
        }

        if (prev.cost >= 10000 && roasDelta <= -0.35) {
          return {
            name: displayName,
            reason: "ROAS 하락",
            detail: `${displayName}: ${metricSummary}`,
            score: Math.abs(roasDelta) + extraCost / 30000,
          };
        }

        return null;
      })
      .filter((item): item is ProductDriver => item != null)
      .sort((a, b) => b.score - a.score);
  const currentLatestDate = latestDateOf(currentRows);
  const productInsights = names
    .map((name): ScoredExplanation | null => {
      const prevRows = baseGroups.get(name) ?? [];
      const curRows = currentGroups.get(name) ?? [];
      if (prevRows.length === 0 && curRows.length === 0) return null;

      const prev = agg(prevRows);
      const cur = agg(curRows);
      const currentBid = currentBidOf(curRows, currentLatestDate);
      const category = categoryName(curRows[0]?.category ?? prevRows[0]?.category ?? "all");
      const displayName = truncName(name, 44);
      const rev = ratioDelta(cur.conversionValue, prev.conversionValue);
      const cost = ratioDelta(cur.cost, prev.cost);
      const conv = ratioDelta(cur.conversions, prev.conversions);
      const roasDrop = cur.roas - prev.roas;
      const lostRevenue = Math.max(0, prev.conversionValue - cur.conversionValue);
      const extraCost = Math.max(0, cur.cost - prev.cost);
      const diagnosis = diagnoseProduct(prev, cur);
      const impressions = ratioDelta(cur.impressions, prev.impressions);
      const revenueChange = ratioDelta(cur.conversionValue, prev.conversionValue);
      const cvrChange = ratioDelta(cur.cvr, prev.cvr);
      const roasChange = ratioDelta(cur.roas, prev.roas, 0.1);
      const efficiencyHeld = (roasChange == null || roasChange >= -0.1) && (cvrChange == null || cvrChange >= -0.1);
      const history = productHistory(name, prevRows);
      const cvrOkVsOverall = current.cvr <= 0 || cur.cvr >= current.cvr * 0.7;
      const isEfficientNow =
        cur.conversionValue >= 10000 &&
        cur.cost > 0 &&
        cur.roas >= minimumInvestRoas &&
        cur.conversions >= 2 &&
        cvrOkVsOverall;
      const exposureNeedsHelp = impressions != null && impressions <= -0.1;
      const recentHistoryHasSignal =
        history.recentMetrics.cost >= 3000 ||
        history.recentMetrics.conversions >= 2 ||
        history.recentMetrics.conversionValue >= 30000;
      const recentHistoryIsGood =
        recentHistoryHasSignal &&
        history.recentMetrics.conversionValue >= 30000 &&
        history.recentMetrics.roas >= minimumHistoryRoas &&
        history.recentMetrics.conversions >= 2;
      const recentHistoryIsWeak =
        recentHistoryHasSignal &&
        (history.recentMetrics.conversionValue <= 0 ||
          history.recentMetrics.roas < minimumPoorRoas ||
          (current.cvr > 0 &&
            history.recentMetrics.cvr < current.cvr * 0.5 &&
            history.recentMetrics.conversions <= 1));
      const historyDays = Math.max(1, history.activeDays);
      const recentHistoryDays = Math.max(1, history.recentDays);
      const currentDailyRevenue = cur.conversionValue / currentPeriodDays;
      const currentDailyCost = cur.cost / currentPeriodDays;
      const currentDailyConversions = cur.conversions / currentPeriodDays;
      const historyDailyRevenue = history.metrics.conversionValue / historyDays;
      const historyDailyCost = history.metrics.cost / historyDays;
      const historyDailyConversions = history.metrics.conversions / historyDays;
      const recentDailyRevenue = history.recentMetrics.conversionValue / recentHistoryDays;
      const recentDailyCost = history.recentMetrics.cost / recentHistoryDays;
      const currentVsHistoryRevenue = ratioDelta(currentDailyRevenue, historyDailyRevenue);
      const currentVsHistoryCost = ratioDelta(currentDailyCost, historyDailyCost);
      const currentVsHistoryRoas = ratioDelta(cur.roas, history.metrics.roas, 0.1);
      const currentVsRecentRevenue = ratioDelta(currentDailyRevenue, recentDailyRevenue);
      const currentVsRecentCost = ratioDelta(currentDailyCost, recentDailyCost);
      const historyTrendStillStrong = history.hasStrongHistory && recentHistoryIsGood && !recentHistoryIsWeak;
      const flowInvestmentCandidate =
        historyTrendStillStrong &&
        cur.cost > 0 &&
        cur.conversions >= 1 &&
        cur.roas >= Math.max(minimumHistoryRoas, history.metrics.roas * 0.7) &&
        (currentVsHistoryRevenue == null || currentVsHistoryRevenue >= -0.2) &&
        (currentVsRecentRevenue == null || currentVsRecentRevenue >= -0.35);
      const evidence = {
        currentBid, roas: cur.roas, overallRoas: current.roas,
        cost: cur.cost, revenue: cur.conversionValue,
        currentDailyRevenue, historyDailyRevenue, recentDailyRevenue,
      };
      const baseDetails = [
        `현재 수치: 마지막 날 평균 입찰가 ${currentBid == null ? "없음" : fmtWon(currentBid)} | 광고비 ${fmtWon(cur.cost)} | 매출 ${fmtWon(cur.conversionValue)} | 구매 ${fmtInt(cur.conversions)}건 | ROAS ${fmtRoas(cur.roas)} | CTR ${fmtPct(cur.ctr)} | CVR ${fmtPct(cur.cvr)}`,
        `흐름: 선택기간 일평균 매출 ${fmtWon(Math.round(currentDailyRevenue))} | 전체 과거 일평균 매출 ${fmtWon(Math.round(historyDailyRevenue))} | 최근 ${recentHistoryDays}일 일평균 매출 ${fmtWon(Math.round(recentDailyRevenue))}`,
        `세부 정리: ${metricVsAverage("ROAS", cur.roas, current.roas, fmtRoas)} | ${metricVsAverage("CTR", cur.ctr, current.ctr, fmtPct)} | ${metricVsAverage("CVR", cur.cvr, current.cvr, fmtPct)}`,
      ];
      const noRevenueSpend = cur.cost >= 1000 && cur.clicks >= 1 && cur.conversionValue <= 0;
      const poorCurrentEfficiency = cur.cost >= 1000 && cur.roas < minimumPoorRoas && cur.conversionValue < 10000;
      const costUpWeakSales = cur.cost >= 1000 && cost != null && cost >= 0.15 && ((rev != null && rev <= 0.05) || (prev.conversionValue <= 0 && cur.conversionValue <= 0));
      const conversionLostWithSpend = prev.conversions >= 1 && cur.conversions <= 0 && cur.cost >= 1000;
      const historicalCostWaste =
        cur.cost >= 1000 &&
        history.metrics.cost > 0 &&
        currentVsHistoryCost != null &&
        currentVsHistoryCost >= 0.2 &&
        (currentVsHistoryRevenue == null || currentVsHistoryRevenue <= -0.2) &&
        currentVsHistoryRoas != null &&
        currentVsHistoryRoas <= -0.35;
      const longTermWeakSpend =
        cur.cost >= 1000 &&
        !history.hasStrongHistory &&
        cur.conversionValue <= 0 &&
        history.metrics.conversionValue < 30000;
      const shouldCutCost =
        noRevenueSpend ||
        poorCurrentEfficiency ||
        costUpWeakSales ||
        conversionLostWithSpend ||
        historicalCostWaste ||
        longTermWeakSpend;
      const cutReason = historicalCostWaste
        ? "전체 과거 흐름보다 광고비는 높고 매출/효율은 낮습니다."
        : longTermWeakSpend
          ? "과거 흐름도 약하고 현재 매출도 없습니다."
          : noRevenueSpend
            ? "광고비는 쓰고 있지만 매출이 없습니다."
            : conversionLostWithSpend
              ? "이전에는 전환이 있었지만 비교기간에는 전환이 끊겼습니다."
              : costUpWeakSales
                ? "광고비가 늘었는데 매출이 따라오지 않았습니다."
                : "광고효율이 전체보다 낮습니다.";
      const cutConfirmedByHistory =
        recentHistoryIsWeak ||
        (!history.hasStrongHistory && !recentHistoryIsGood) ||
        (historicalCostWaste && !historyTrendStillStrong);
      const cutShouldBeDeferred = shouldCutCost && historyTrendStillStrong;
      if (cutShouldBeDeferred) {
        return {
          score: cur.cost / 1500 + Math.abs(Math.min(currentVsHistoryRevenue ?? rev ?? 0, 0)),
          item: {
            target: name,
            evidence,
            tone: "warn",
            title: `${displayName} 감액 보류 점검`,
            reason: "과거·최근 성과 유지",
            adjustment: { direction: "down", minPct: 0.1, condition: "review" },
            body: `선택 기간만 보면 성과가 나쁘지만, 전체 과거와 최근 흐름이 좋아 바로 줄이면 회복 가능한 제품을 놓칠 수 있습니다.`,
            details: [
              ...baseDetails,
              "결론: 과거와 최근 흐름이 아직 살아 있어 지금은 줄이지 말고 한 번 더 확인하는 쪽이 안전합니다.",
            ],
            action: withBidChange("지금은 입찰가를 유지하세요. 다음 업로드에서도 전체 과거 대비 매출과 광고효율이 계속 낮으면 그때 10%만 줄이세요.", currentBid, "down", 0.1),
          },
        };
      }

      if (flowInvestmentCandidate) {
        return {
          score: history.metrics.roas + cur.roas + currentDailyRevenue / 10000 + Math.max(currentVsHistoryRevenue ?? 0, 0),
          item: {
            target: name,
            evidence,
            tone: "good",
            title: `${displayName} 과거 흐름상 광고비 이동 후보`,
            reason: exposureNeedsHelp ? "노출 감소 · 성과 유지" : "과거·최근 성과 유지",
            adjustment: currentVsHistoryRevenue != null && currentVsHistoryRevenue >= 0.15
              ? { direction: "up", minPct: 0.1, maxPct: 0.2, condition: "transfer" }
              : exposureNeedsHelp ? { direction: "up", minPct: 0.05, maxPct: 0.1 } : undefined,
            body: `직전 기간보다 전체 과거와 최근 7일 흐름을 기준으로 봤을 때, 다른 제품을 낮춘 만큼 올려볼 만한 제품입니다.`,
            details: baseDetails,
            action: currentVsHistoryRevenue != null && currentVsHistoryRevenue >= 0.15
              ? withBidChange("전체 과거 하루 평균보다 매출이 올라온 상태입니다. 총예산은 늘리지 말고, 비중 줄일 제품은 낮추고 이 제품은 10~20% 올려보세요.", currentBid, "up", 0.1, 0.2)
              : exposureNeedsHelp
                ? withBidChange("성과 흐름은 좋은데 노출이 약합니다. 입찰가를 5~10%만 올려 노출 회복을 테스트하세요.", currentBid, "up", 0.05, 0.1)
                : "지금은 유지하세요. 비중 줄일 제품이 있을 때만 이 제품을 소폭 올려보세요.",
          },
        };
      }

      if (
        history.hasStrongHistory &&
        isEfficientNow &&
        impressions != null &&
        impressions <= -0.15 &&
        revenueChange != null &&
        revenueChange <= -0.15 &&
        efficiencyHeld
      ) {
        return {
          score: cur.roas + Math.abs(impressions) + Math.abs(revenueChange) + cur.conversionValue / 100000,
          item: {
            target: name,
            evidence,
            tone: "good",
            title: `${displayName} 회복 테스트 후보`,
            reason: "노출 감소 · 효율 유지",
            adjustment: { direction: "up", minPct: 0.05, maxPct: 0.1 },
            body: `매출은 줄었지만 효율은 아직 좋습니다. 바로 줄이지 말고 회복 테스트를 해볼 제품입니다.`,
            details: baseDetails,
            action: withBidChange("입찰가를 5~10%만 올려 하루 테스트하세요. 효율이 유지될 때만 비효율 제품은 낮추고 이 제품은 올리는 방식으로 옮기고, 떨어지면 바로 원래대로 돌리세요.", currentBid, "up", 0.05, 0.1),
          },
        };
      }

      if (history.hasStrongHistory && isEfficientNow && revenueChange != null && revenueChange <= -0.2) {
        return {
          score: cur.roas + cur.conversionValue / 50000 + Math.abs(revenueChange),
          item: {
            target: name,
            evidence,
            tone: "good",
            title: `${displayName} 회복/보호 후보`,
            reason: "매출 감소 · 구매 유지",
            adjustment: exposureNeedsHelp ? { direction: "up", minPct: 0.05, maxPct: 0.1 } : undefined,
            body: `매출은 줄었지만 광고효율과 구매는 살아 있습니다. 하루만 보고 광고비를 회수하기엔 아까운 제품입니다.`,
            details: baseDetails,
            action: exposureNeedsHelp
              ? withBidChange("노출도 줄었습니다. 입찰가를 5~10%만 올려 보고, 효율이 유지될 때만 비효율 제품을 낮추고 이 제품을 올리세요.", currentBid, "up", 0.05, 0.1)
              : "노출은 크게 문제 없습니다. 지금은 입찰가를 유지하고, 다음에도 매출이 빠지면 낮추세요.",
          },
        };
      }

      if (
        history.hasStrongHistory &&
        isEfficientNow &&
        (cur.conversionValue >= 30000 || history.recentMetrics.conversionValue >= 30000) &&
        (revenueChange == null || revenueChange >= 0.15 || prev.conversionValue <= 0) &&
        (roasChange == null || roasChange >= -0.2) &&
        (cvrChange == null || cvrChange >= -0.2)
      ) {
        return {
          score: cur.roas + cur.conversionValue / 50000 + Math.max(revenueChange ?? 0.25, 0),
          item: {
            target: name,
            evidence,
            tone: "good",
            title: `${displayName} 광고비 재배분 후보`,
            reason: "현재·과거 성과 양호",
            adjustment: exposureNeedsHelp
              ? { direction: "up", minPct: 0.05, maxPct: 0.1 }
              : { direction: "up", minPct: 0.1, maxPct: 0.2, condition: "transfer" },
            body: `지금 성과가 좋고 과거에도 팔렸습니다. 비중 줄일 제품을 낮춘 만큼 먼저 올려볼 제품입니다.`,
            details: [...baseDetails, "결론: 과거와 최근 흐름이 모두 괜찮아 다른 제품을 낮춘 만큼 올려볼 후보입니다."],
            action: exposureNeedsHelp
              ? withBidChange("성과는 좋은데 노출이 줄었습니다. 총예산은 늘리지 말고 비효율 제품을 낮춘 만큼 이 제품의 입찰가를 5~10%만 올려보세요.", currentBid, "up", 0.05, 0.1)
              : withBidChange("지금은 유지하고, 비중 줄일 제품을 낮춘 뒤 이 제품은 10~20% 범위에서만 올려보세요. 노출이 부족할 때만 조금 올리면 됩니다.", currentBid, "up", 0.1, 0.2),
          },
        };
      }

      if (history.hasStrongHistory && isEfficientNow) {
        return {
          score: cur.roas + cur.conversionValue / 70000,
          item: {
            target: name,
            evidence,
            tone: "good",
            title: `${displayName} 힘 보탤 후보`,
            reason: "현재 효율 · 과거 성과",
            adjustment: exposureNeedsHelp
              ? { direction: "up", minPct: 0.05, maxPct: 0.1 }
              : { direction: "up", minPct: 0.05, condition: "transfer" },
            body: `현재 효율도 좋고 과거 성과도 있습니다. 다른 제품을 낮춘 만큼 올려볼 수 있는 제품입니다.`,
            details: baseDetails,
            action: exposureNeedsHelp
              ? withBidChange("노출이 줄었습니다. 입찰가를 5~10%만 올려보고, 광고효율이 떨어지면 멈추세요.", currentBid, "up", 0.05, 0.1)
              : withBidChange("지금은 유지하고, 비중 줄일 제품을 낮춘 뒤 이 제품은 5%만 올려보세요. 클릭만 늘고 구매가 안 늘면 다시 원래대로 돌리세요.", currentBid, "up", 0.05),
          },
        };
      }

      if (shouldCutCost && cutConfirmedByHistory) {
        return {
          score: cur.cost / 1000 + Math.max(0, minimumPoorRoas - cur.roas) + Math.abs(Math.min(rev ?? 0, 0)),
          item: {
            target: name,
            evidence,
            tone: "danger",
            title: `${displayName} 비중 줄일 후보`,
            reason: "광고비 대비 매출 부족",
            adjustment: { direction: "down", minPct: 0.1, maxPct: 0.2 },
            body: `${cutReason} 지금은 이 제품의 입찰가를 낮추고 더 잘 팔리는 제품을 올리는 편이 낫습니다.`,
            details: [
              ...baseDetails,
              history.hasStrongHistory
                ? "결론: 과거에는 잘 팔렸지만 최근에는 광고비가 구매로 잘 이어지지 않습니다. 회복 신호가 보일 때까지 광고비를 줄이는 쪽이 안전합니다."
                : "결론: 과거에도 충분히 팔린 기록이 약하고, 현재도 광고비가 매출로 돌아오지 않습니다. 우선 줄이는 쪽이 안전합니다.",
            ],
            action: withBidChange("이 제품의 입찰가를 10~20% 줄이세요. 낮춘 만큼 위의 비중 키울 제품을 먼저 올리세요.", currentBid, "down", 0.1, 0.2),
          },
        };
      }

      if (prevRows.length === 0 && cur.cost >= 10000 && cur.conversionValue <= 0) {
        return {
          score: cur.cost / 10000 + cur.clicks / 20,
          item: {
            target: name,
            evidence,
            tone: "warn",
            title: `${displayName} 신규 집행 비용 점검`,
            reason: "신규 비용 · 매출 없음",
            adjustment: { direction: "down", minPct: 0.1, condition: "review" },
            body: `돈은 쓰고 있는데 아직 매출이 없습니다. 테스트가 아니라면 빠르게 줄여야 합니다.`,
            details: baseDetails,
            action: withBidChange("하루만 더 보고, 클릭은 있는데 구매가 없으면 입찰가를 10% 낮추세요.", currentBid, "down", 0.1),
          },
        };
      }

      if (prev.conversionValue >= 30000 && rev != null && rev <= -0.25) {
        return {
          score: lostRevenue / 50000 + Math.abs(rev) + Math.abs(Math.min(conv ?? 0, 0)),
          item: {
            target: name,
            evidence,
            tone: "warn",
            title: `${displayName} 매출 하락 우선 점검`,
            reason: "매출 감소 · 원인 점검",
            body: `매출이 크게 줄었습니다. 아직 올릴 제품은 아니고, 원인을 먼저 봐야 합니다.`,
            details: baseDetails,
            action: cur.cost < 1000 && cur.clicks <= 1
              ? "현재는 비용과 클릭이 거의 없어 바로 줄일 대상이라기보다, 노출/입찰 상태가 왜 약해졌는지 먼저 확인하세요."
              : "바로 감액 확정은 아닙니다. 구매 없는 검색어가 비용을 쓰는지 먼저 확인하고, 확인된 검색어만 입찰가를 낮추세요.",
          },
        };
      }

      if (cutConfirmedByHistory && cur.cost >= 1000 && cost != null && cost >= 0.25 && (rev == null || rev <= 0.05 || roasDrop <= -0.25)) {
        return {
          score: extraCost / 2000 + cost + Math.abs(Math.min(rev ?? 0, 0)) + Math.abs(Math.min(roasDrop, 0)),
          item: {
            target: name,
            evidence,
            tone: "danger",
            title: `${displayName} 비중 줄일 후보`,
            reason: "광고비 대비 매출 부족",
            adjustment: { direction: "down", minPct: 0.1, maxPct: 0.2 },
            body: `광고비가 늘었지만 매출은 따라오지 않았습니다. 광고비를 줄이는 쪽이 좋습니다.`,
            details: [...baseDetails, `비용 증가: 광고비가 ${fmtWon(extraCost)} 더 늘었습니다.`],
            action: withBidChange("입찰가를 10~20% 낮추고, 구매 없는 검색어는 제외하세요. 낮춘 만큼 비중 키울 제품을 올리세요.", currentBid, "down", 0.1, 0.2),
          },
        };
      }

      if (prev.conversions >= 2 && conv != null && conv <= -0.35) {
        return {
          score: Math.abs(conv) + lostRevenue / 70000,
          item: {
            target: name,
            evidence,
            tone: "warn",
            title: `${displayName} 전환 회복 필요`,
            reason: "구매 감소 · 원인 점검",
            body: `구매가 줄었습니다. 클릭보다 실제 구매가 왜 줄었는지 먼저 봐야 합니다.`,
            details: baseDetails,
            action: cur.cost < 1000 && cur.clicks <= 1
              ? "현재는 비용과 클릭이 거의 없어 바로 줄일 대상이라기보다, 노출/입찰 상태가 왜 약해졌는지 먼저 확인하세요."
              : "바로 감액 확정은 아닙니다. 구매 없는 검색어가 비용을 쓰는지 먼저 확인하고, 확인된 검색어만 입찰가를 낮추세요.",
          },
        };
      }

      if (prev.cost >= 10000 && roasDrop <= -0.35) {
        return {
          score: Math.abs(roasDrop) + extraCost / 30000,
          item: {
            target: name,
            evidence,
            tone: "warn",
            title: `${displayName} 광고효율 하락 점검`,
            reason: "ROAS 하락 · 비용 점검",
            body: `광고효율이 내려갔습니다. 돈을 더 쓰기 전에 비용부터 확인해야 합니다.`,
            details: baseDetails,
            action: cur.cost < 1000 && cur.clicks <= 1
              ? "현재는 비용과 클릭이 거의 없어 바로 줄일 대상이라기보다, 노출/입찰 상태가 왜 약해졌는지 먼저 확인하세요."
              : "바로 감액 확정은 아닙니다. 구매 없는 검색어가 비용을 쓰는지 먼저 확인하고, 확인된 검색어만 입찰가를 낮추세요.",
          },
        };
      }
      return null;
    })
    .filter((item): item is ScoredExplanation => item != null)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);

  const categoryInsights = currentByCategory
    .map((cur): ScoredExplanation | null => {
      const prev = baseByCategory.find((item) => item.slug === cur.slug)?.metrics;
      if (!prev) return null;
      const rev = ratioDelta(cur.metrics.conversionValue, prev.conversionValue, 10000);
      const cost = ratioDelta(cur.metrics.cost, prev.cost, 5000);
      const badDrivers = productDriversForCategory(cur.slug, "bad").slice(0, 3);
      const goodDrivers = productDriversForCategory(cur.slug, "good").slice(0, 2);
      if (badDrivers.length === 0) return null;

      const driverNames = badDrivers.map((driver) => driver.name).join(", ");
      const goodNames = goodDrivers.map((driver) => driver.name).join(", ");
      const goodContext = goodDrivers.length > 0
        ? ` 반대로 ${goodNames}은 좋은 흐름이므로 함께 줄이면 안 됩니다.`
        : "";
      const driverDetails = [
        `원인 제품군: ${badDrivers.map((driver) => `${driver.name}(${driver.reason})`).join(", ")}`,
        ...badDrivers.map((driver) => driver.detail),
        ...(goodDrivers.length > 0
          ? [`같은 카테고리의 유지/이동 후보: ${goodDrivers.map((driver) => driver.detail).join(" / ")}`]
          : []),
      ];

      if (rev != null && rev <= -0.2) {
        return {
          score: Math.abs(rev) + badDrivers[0].score,
          item: {
            tone: "danger",
            title: `${cur.label} 하락 원인: ${driverNames}`,
            body: `${cur.label} 전체 매출은 하락했지만, 문제는 카테고리 전체가 아니라 위 제품군 쪽에 몰려 있습니다.${goodContext}`,
            details: [signalLine(prev, cur.metrics), metricLine(prev, cur.metrics), flowLine(prev, cur.metrics), ...driverDetails],
            action: `${driverNames}은 입찰가를 먼저 낮추고, 비용만 쓰는 검색어를 제외하세요.${goodDrivers.length > 0 ? ` ${goodNames}은 성과가 확인된 제품이라 올릴 후보로 분리하세요.` : ""}`,
          },
        };
      }
      if (cost != null && cost >= 0.2 && (rev == null || rev <= 0.05)) {
        return {
          score: cost + badDrivers[0].score,
          item: {
            tone: "warn",
            title: `${cur.label} 비용 점검 대상: ${driverNames}`,
            body: `${cur.label} 광고비 증가가 매출 증가로 충분히 이어지지 않았고, 원인은 위 제품군에서 먼저 확인됩니다.${goodContext}`,
            details: [signalLine(prev, cur.metrics), metricLine(prev, cur.metrics), flowLine(prev, cur.metrics), ...driverDetails],
            action: `${driverNames}의 검색어별 비용과 전환 여부를 나눠 보고, 전환 없는 검색어는 제외하세요.${goodDrivers.length > 0 ? ` ${goodNames}처럼 효율이 유지되는 제품을 올리는 편이 자연스럽습니다.` : ""}`,
          },
        };
      }
      return null;
    })
    .filter((item): item is ScoredExplanation => item != null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((entry) => entry.item);

  const actionableItems = productInsights
    .filter((item) => item.tone === "good" || item.tone === "danger" || item.tone === "warn");
  const requiredActions = RECOMMENDATION_TONES.flatMap((tone) =>
    actionableItems
      .filter((item) => item.tone === tone)
      .slice(0, MAX_RECOMMENDATIONS_PER_TONE),
  );

  if (requiredActions.length > 0) return requiredActions;

  return [];
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
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  return (
    <span className={`text-[11px] font-semibold ${good ? "text-[#03C75A]" : "text-red-500"}`}>
      {sign}{Math.abs(delta * 100).toFixed(1)}%
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
  const { showChange } = useChangeAnalysis();
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
  const analysisComparisonMetric = (
    slug: string,
    pick: (m: DerivedMetrics) => number,
  ) => {
    const m = analysisByCategoryB.find((c) => c.slug === slug)?.metrics;
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
                표의 값은 위에서부터 비교기간, 기준기간, 기준기간 대비 변화율 순서로 보여줍니다.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-600">기준기간</div>
                <RangeCalendar
                  start={analysisA.start}
                  end={analysisA.end}
                  min={earliest}
                  max={latest}
                  availableDates={allDates}
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
                <div className="text-sm font-medium text-slate-600">비교기간</div>
                <RangeCalendar
                  start={analysisB.start}
                  end={analysisB.end}
                  min={earliest}
                  max={latest}
                  availableDates={allDates}
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
                비교기간 값 / 기준기간 값 / 기준기간 대비 변화율
              </span>
            </h3>
            {!analysisHasRows ? (
              <p className="py-6 text-center text-sm text-slate-400">
                기준기간 또는 비교기간에 표시할 데이터가 없습니다.
              </p>
            ) : (
              <>
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
                      metrics={analysisAMetrics}
                      comparisonMetrics={analysisBMetrics}
                    />
                    {analysisByCategoryA.map((c) => (
                      <ChangeRow
                        key={c.slug}
                        label={c.label}
                        metrics={c.metrics}
                        comparisonPick={(pick) => analysisComparisonMetric(c.slug, pick)}
                      />
                    ))}
                  </tbody>
                </table>
                </div>

              </>
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
  const o = agg(currentRows);
  const base = baseRows.length ? agg(baseRows) : null;
  const byCategory = byCatOf(currentRows);
  const byCategoryBase = baseRows.length ? byCatOf(baseRows) : null;
  const dashboardActionExplanations = buildComparisonExplanations(
    base ?? agg([]),
    o,
    byCatOf(baseRows),
    byCategory,
    baseRows,
    currentRows,
    data.rows,
  );
  const latestCurrentDate = latestDateOf(currentRows);
  const hasCurrentBidData = currentRows.some(
    (row) =>
      latestCurrentDate != null &&
      rowDate(row) === latestCurrentDate &&
      typeof row.currentBid === "number" &&
      Number.isFinite(row.currentBid) &&
      row.currentBid > 0,
  );
  const slicesOf = (pick: (m: DerivedMetrics) => number) =>
    byCategory.map((c) => ({
      label: c.label,
      value: pick(c.metrics),
      color: CATEGORY_COLORS[c.slug],
    }));

  const days = rs && re ? daysInclusive(rs, re) : 0;
  const showPeriodAverage = days > 1;

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
    <DashboardSections controls={
        <RangeCalendar
          start={rs}
          end={re}
          min={earliest}
          max={latest}
          availableDates={allDates}
          onChange={(s, e) => {
            setRangeStart(s);
            setRangeEnd(e);
          }}
        />
      }>
      {!data.configured && (
        <Banner tone="amber">Supabase 환경변수가 설정되지 않았습니다.</Banner>
      )}
      {data.configured && !data.hasData && (
        <Banner tone="blue">
          데이터가 없습니다. 우측 상단 <b>데이터 업로드</b>에서 네이버 보고서를
          올리세요.
        </Banner>
      )}


      <div className="dashboard-screen dashboard-summary" data-dashboard-title="성과 요약">
      <section className="summary-layout flex flex-1 flex-col gap-3" data-period-average={showPeriodAverage} aria-label="성과 요약">
      <div className="roas-hero" aria-label="전체 광고 성과 ROAS">
        <p className="flex items-center gap-2 text-[10.8px] leading-[14.4px] font-medium text-slate-300"><span className="h-2 w-2 rounded-full bg-[#03C75A]" aria-hidden="true" />전체 광고 성과 · ROAS</p>
        <div className="roas-metrics">
          <p className="roas-number">{o.cost > 0 ? fmtRoas(o.roas) : "—"}</p>
          <div className="roas-context">
            <span className="block text-[10.8px] leading-[14.4px] text-slate-200">광고비 대비 발생한 매출</span>
            <p className="mt-[3.6px] text-[12.6px] leading-[18px] font-medium text-white">{o.cost > 0 ? <>광고비 <span className="text-slate-300">1원</span><span aria-hidden="true" className="mx-2 text-[#03C75A]">→</span>매출 <strong className="text-[18px] text-[#6FE5A3]">{o.roas.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원</strong></> : "광고비 데이터 없음"}</p>
          </div>
        </div>
      </div>

      {/* 카테고리 비중 도넛 카드 3개 */}
      <div className="summary-cards grid gap-3 lg:grid-cols-3">
        <BreakdownCard
          title="총 전환건수"
          value={`${fmtInt(o.conversions)}개`}
          average={showPeriodAverage ? `일 평균 ${fmtAvgCount(o.conversions / days)}개` : undefined}
          valueFormatter={(value) => `${fmtInt(value)}개`}
          slices={slicesOf((m) => m.conversions)}
        />
        <BreakdownCard
          title="총 매출액"
          value={fmtWon(o.conversionValue)}
          average={showPeriodAverage ? `일 평균 ${fmtWon(o.conversionValue / days)}` : undefined}
          valueFormatter={fmtWon}
          slices={slicesOf((m) => m.conversionValue)}
        />
        <BreakdownCard
          title="총 광고비"
          value={fmtWon(o.cost)}
          average={showPeriodAverage ? `일 평균 ${fmtWon(o.cost / days)}` : undefined}
          valueFormatter={fmtWon}
          slices={slicesOf((m) => m.cost)}
        />
      </div>
      </section>
      </div>

      {/* 전체 성과와 카테고리 기여도를 비교하는 기간 추이 */}
      {data.hasData && (
        <div className="dashboard-screen dashboard-trend" data-dashboard-title="성과 추이"><PeriodTrend rows={currentRows} dates={selDates} /></div>
      )}

      <div className="dashboard-screen dashboard-flow" data-dashboard-title="전환 흐름">
      <FunnelFlow
        currentRows={currentRows}
        baseRows={baseRows}
        currentDays={selDates.length}
        baseDays={baseDates.length}
      />

      </div>
      <div className="dashboard-screen dashboard-recommendations" data-dashboard-title="조정 추천">
      <ActionRecommendationPanel
        title="조정 추천"
        items={dashboardActionExplanations}
        bidDataReady={hasCurrentBidData}
      />
      </div>
    </DashboardSections>
  );
}

/* ---------- 하위 컴포넌트 ---------- */

/** 달력 하나로 기간(시작~종료)을 선택하는 팝오버 */
function RangeCalendar({
  start,
  end,
  min,
  max,
  availableDates,
  onChange,
}: {
  start: string;
  end: string;
  min: string;
  max: string;
  availableDates: string[];
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
  const availableDateSet = new Set(availableDates);
  const isAvailable = (day: string) => availableDateSet.has(day);

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
    if (day < min || day > max || !isAvailable(day)) return;
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
    pending ? false : isAvailable(day) && day > start && day < end;

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
              const disabled = day < min || day > max || !isAvailable(day);
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
  comparisonMetrics,
  comparisonPick,
  bold,
}: {
  label: string;
  metrics: DerivedMetrics;
  comparisonMetrics?: DerivedMetrics;
  comparisonPick?: (pick: (m: DerivedMetrics) => number) => number | null;
  bold?: boolean;
}) {
  return (
    <tr className={bold ? "bg-slate-50" : ""}>
      <td className={`px-2 py-2 text-left ${bold ? "font-bold" : "text-slate-600"}`}>
        {label}
      </td>
      {CHANGE_COLS.map((col) => {
        const baseValue = col.pick(metrics);
        const comparisonValue = comparisonMetrics
          ? col.pick(comparisonMetrics)
          : comparisonPick
            ? comparisonPick(col.pick)
            : null;
        return (
          <td key={col.label} className="px-2 py-2 text-right align-top">
            <div className="space-y-0.5">
              {comparisonValue == null ? (
                <>
                  <div className="tabular-nums font-medium text-slate-800">-</div>
                  <div className="tabular-nums text-[12px] font-medium text-slate-500">
                    {col.fmt(baseValue)}
                  </div>
                  <span className="text-[11px] text-slate-300">-</span>
                </>
              ) : (
                <>
                  <div className="tabular-nums font-medium text-slate-800">
                    {col.fmt(comparisonValue)}
                  </div>
                  <div className="tabular-nums text-[12px] font-medium text-slate-500">
                    {col.fmt(baseValue)}
                  </div>
                  <Delta curr={comparisonValue} prev={baseValue} goodWhenUp={col.goodUp} />
                </>
              )}
            </div>
          </td>
        );
      })}
    </tr>
  );
}

function BreakdownCard({
  title,
  value,
  wow,
  average,
  action,
  slices,
  valueFormatter,
  children,
}: {
  title: string;
  value: string;
  wow?: React.ReactNode;
  average?: string;
  action?: React.ReactNode;
  slices: { label: string; value: number; color: string }[];
  valueFormatter?: (value: number) => string;
  children?: React.ReactNode;
}) {
  return (
    <div className="breakdown-card min-w-0 rounded-[15px] bg-[#F9F9F9] p-4 shadow-[0_8px_22px_rgba(66,80,102,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-500">{title}</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</div>
          {average && (
            <div className="mt-1 text-xs font-medium text-slate-400">{average}</div>
          )}
        </div>
        {(wow || action) && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            {wow}
            {action}
          </div>
        )}
      </div>
      <div className="donut-holder mt-2">
        <CategoryDonut
          key={slices.map((slice) => `${slice.label}:${slice.value}`).join("|")}
          title={title}
          slices={slices}
          valueFormatter={valueFormatter}
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
