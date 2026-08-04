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
  "rounded-[15px] bg-white p-6 shadow-[0_8px_22px_rgba(66,80,102,0.05)]";
const ACTIVE_CHIP_CLASS =
  "bg-[#03C75A] text-white shadow-[0_4px_10px_-5px_rgba(3,199,90,0.14)]";
const IDLE_CHIP_CLASS =
  "bg-[#EEF2F6] text-[#4F5B6A] shadow-[0_1px_4px_rgba(66,80,102,0.03)] hover:bg-[#E4EAF1]";

const METRIC_HELP: Record<string, { title: string; description: string }> = {
  노출수: {
    title: "노출수",
    description:
      "광고가 검색 결과나 지면에 보여진 횟수예요. 많을수록 고객에게 발견될 기회가 많다는 뜻입니다.",
  },
  클릭수: {
    title: "클릭수",
    description:
      "광고를 본 사람 중 실제로 눌러서 상세페이지나 사이트로 들어온 횟수예요.",
  },
  CTR: {
    title: "CTR",
    description:
      "클릭률이에요. 광고가 보여진 횟수 중 몇 번 클릭됐는지 보는 지표라, 문구나 상품 이미지가 눈길을 끄는지 판단할 때 씁니다.",
  },
  CPC: {
    title: "CPC",
    description:
      "클릭 1번을 얻는 데 평균 얼마를 썼는지예요. 낮을수록 같은 예산으로 더 많은 방문을 만들 수 있습니다.",
  },
  구매: {
    title: "구매",
    description:
      "광고를 통해 들어온 고객이 실제 구매 완료까지 이어진 횟수예요. 전환수와 같은 의미로 보면 됩니다.",
  },
  전환: {
    title: "전환",
    description:
      "광고 유입 이후 구매처럼 우리가 원하는 행동이 일어난 횟수예요. 이 화면에서는 구매 완료를 중심으로 봅니다.",
  },
  CVR: {
    title: "CVR",
    description:
      "전환율이에요. 클릭해서 들어온 사람 중 실제 구매까지 이어진 비율입니다. 방문자의 구매 의지가 좋은지 볼 때 씁니다.",
  },
  CPA: {
    title: "CPA",
    description:
      "구매 1건을 만들기 위해 평균 얼마의 광고비를 썼는지예요. 낮을수록 전환 효율이 좋습니다.",
  },
  매출: {
    title: "매출",
    description:
      "광고를 통해 발생한 구매 완료 매출액이에요. 광고가 실제 돈으로 얼마나 이어졌는지 보여줍니다.",
  },
  광고비: {
    title: "광고비",
    description:
      "선택한 기간 동안 광고에 쓴 비용이에요. 매출, 구매, ROAS와 함께 봐야 효율을 판단할 수 있습니다.",
  },
  ROAS: {
    title: "ROAS",
    description:
      "광고비 대비 매출이에요. 100%면 쓴 광고비만큼 매출이 난 것이고, 높을수록 광고 효율이 좋습니다.",
  },
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

interface ComparisonExplanation {
  tone: "good" | "warn" | "danger" | "neutral";
  title: string;
  body: string;
  details: string[];
  action: string;
}

const EXPLANATION_TONE_ORDER: ComparisonExplanation["tone"][] = [
  "good",
  "danger",
  "warn",
  "neutral",
];

const EXPLANATION_TONE_META: Record<
  ComparisonExplanation["tone"],
  {
    label: string;
    badge: string;
    cardClass: string;
    labelClass: string;
    dotClass: string;
  }
> = {
  good: {
    label: "비중 키울 제품",
    badge: "광고비 이동 후보",
    cardClass: "border-emerald-200 bg-emerald-50",
    labelClass: "text-emerald-700",
    dotClass: "bg-emerald-500",
  },
  danger: {
    label: "비중 줄일 제품",
    badge: "광고비 회수 후보",
    cardClass: "border-rose-200 bg-rose-50",
    labelClass: "text-rose-700",
    dotClass: "bg-rose-500",
  },
  warn: {
    label: "점검 조치",
    badge: "확인 후 조정",
    cardClass: "border-amber-200 bg-amber-50",
    labelClass: "text-amber-700",
    dotClass: "bg-amber-500",
  },
  neutral: {
    label: "필요 조치 없음",
    badge: "유지",
    cardClass: "border-slate-200 bg-slate-50",
    labelClass: "text-slate-500",
    dotClass: "bg-slate-400",
  },
};

const ACTION_TITLE_SUFFIXES = [
  "회복 테스트 후보",
  "회복/보호 후보",
  "광고비 재배분 후보",
  "힘 보탤 후보",
  "신규 집행 비용 점검",
  "매출 하락 우선 점검",
  "광고비 효율 점검",
  "전환 회복 필요",
  "ROAS 하락 점검",
  "비중 줄일 후보",
];

function actionDisplayParts(item: ComparisonExplanation) {
  for (const suffix of ACTION_TITLE_SUFFIXES) {
    if (item.title.endsWith(` ${suffix}`)) {
      return {
        target: item.title.slice(0, -suffix.length).trim(),
        actionType: suffix,
      };
    }
  }

  return {
    target: item.title,
    actionType: item.tone === "good" ? "힘 보탤 후보" : item.tone === "danger" ? "우선 조치" : "점검 조치",
  };
}

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
            tone: "warn",
            title: `${displayName} 감액 보류 점검`,
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
            tone: "good",
            title: `${displayName} 과거 흐름상 광고비 이동 후보`,
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
            tone: "good",
            title: `${displayName} 회복 테스트 후보`,
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
            tone: "good",
            title: `${displayName} 회복/보호 후보`,
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
            tone: "good",
            title: `${displayName} 광고비 재배분 후보`,
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
            tone: "good",
            title: `${displayName} 힘 보탤 후보`,
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
            tone: "danger",
            title: `${displayName} 비중 줄일 후보`,
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
            tone: "warn",
            title: `${displayName} 신규 집행 비용 점검`,
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
            tone: "warn",
            title: `${displayName} 매출 하락 우선 점검`,
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
            tone: "danger",
            title: `${displayName} 비중 줄일 후보`,
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
            tone: "warn",
            title: `${displayName} 전환 회복 필요`,
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
            tone: "warn",
            title: `${displayName} 광고효율 하락 점검`,
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
  const requiredActions = [
    ...actionableItems.filter((item) => item.tone === "good").slice(0, 2),
    ...actionableItems.filter((item) => item.tone === "danger").slice(0, 2),
    ...actionableItems.filter((item) => item.tone === "warn").slice(0, 1),
  ].slice(0, 5);

  if (requiredActions.length > 0) return requiredActions;

  return [
    {
      tone: "neutral",
      title: "추천할 조정 항목이 없습니다",
      body: "이번 비교 기간에서는 올리거나 줄일 만큼 뚜렷한 제품이 보이지 않습니다.",
      details: [
        "작은 변동까지 모두 조치하면 광고비와 소재가 흔들릴 수 있어, 현재 결과에는 의미 있는 하락/비효율만 표시합니다.",
        "다음 업로드에서 같은 제품이 2회 이상 반복 하락하거나 광고비가 늘어도 매출이 따라오지 않으면 조치 항목으로 올립니다.",
      ],
      action: "지금은 크게 바꾸지 말고 유지하세요. 같은 문제가 한 번 더 나오면 그때 이동/감액 후보로 올립니다.",
    },
  ];
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

function MetricHelpLabel({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  const help = METRIC_HELP[label];

  if (!help) return <span className={className}>{label}</span>;

  return (
    <span
      className={`group relative inline-flex cursor-help items-center gap-1 underline decoration-slate-300 decoration-dotted underline-offset-4 ${className}`}
      title={`${help.title}: ${help.description}`}
    >
      {label}
      <span
        aria-hidden="true"
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#E4EAF1] text-[10px] font-bold leading-none text-[#4F5B6A]"
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute left-0 top-full z-50 mt-2 w-64 translate-y-1 rounded-lg border border-[#DCE4EE] bg-white p-3 text-left opacity-0 shadow-[0_12px_30px_rgba(66,80,102,0.16)] transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100"
      >
        <span className="block text-xs font-semibold text-slate-800">
          {help.title}
        </span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {help.description}
        </span>
      </span>
    </span>
  );
}


type ExplanationGroup = {
  tone: ComparisonExplanation["tone"];
  meta: (typeof EXPLANATION_TONE_META)[ComparisonExplanation["tone"]];
  items: ComparisonExplanation[];
};

const groupExplanations = (items: ComparisonExplanation[]): ExplanationGroup[] =>
  EXPLANATION_TONE_ORDER.map((tone) => ({
    tone,
    meta: EXPLANATION_TONE_META[tone],
    items: items.filter((item) => item.tone === tone),
  })).filter((group) => group.items.length > 0);

function detailParts(detail: string) {
  const index = detail.indexOf(":");
  if (index <= 0 || index > 8) return { label: "근거", text: detail };
  return {
    label: detail.slice(0, index),
    text: detail.slice(index + 1).trim(),
  };
}

const isConclusionDetail = (detail: string) => detail.trim().startsWith("결론:");

function conclusionText(item: ComparisonExplanation) {
  const conclusion = item.details.find(isConclusionDetail);
  return conclusion ? detailParts(conclusion).text : item.body;
}

function statParts(text: string) {
  const parts = text.split("|").map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts : null;
}

function detailCardClass(label: string) {
  if (label.includes("현재") || label.includes("평균") || label.includes("흐름")) {
    return "border-slate-200 bg-white";
  }
  if (label.includes("세부")) return "border-sky-100 bg-sky-50/70";
  return "border-white/80 bg-white/75";
}
function ActionRecommendationPanel({
  title,
  subtitle,
  grouped,
  bidDataReady,
}: {
  title: string;
  subtitle: string;
  grouped: ExplanationGroup[];
  bidDataReady: boolean;
}) {
  return (
    <details className={CARD_CLASS} open>
      <summary className="mb-4 flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
        <span aria-hidden="true" className="rounded-full bg-[#F6F8FB] px-3 py-1 text-xs font-semibold text-slate-500">⌄</span>
      </summary>
      <div className="space-y-4">
        {!bidDataReady && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="text-sm font-bold text-amber-900">입찰가 계산 불가</div>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              현재 선택기간 마지막 날에 입찰가 데이터가 없어 현재가와 추천가를 계산하지 못합니다. D열 현재 입찰가가 포함된 파일을 다시 업로드하면 마지막 날 평균 입찰가와 조정 후 금액이 표시됩니다.
            </p>
          </div>
        )}
        {grouped.map((group) => (
          <section key={group.tone} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <span className={`h-2 w-2 rounded-full ${group.meta.dotClass}`} />
              <h4 className="text-xs font-semibold text-slate-700">{group.meta.label}</h4>
              <span className="rounded-full bg-[#F6F8FB] px-2 py-0.5 text-[11px] font-medium text-slate-400">
                {group.items.length}개
              </span>
            </div>
            <div className="grid gap-2">
              {group.items.map((item, index) => {
                const toneMeta = EXPLANATION_TONE_META[item.tone];
                const actionParts = actionDisplayParts(item);
                const conclusion = conclusionText(item);
                const evidenceDetails = item.details.filter((detail) => !isConclusionDetail(detail));
                return (
                  <details
                    key={`${item.title}-${index}`}
                    className={`group rounded-xl border ${toneMeta.cardClass}`}
                  >
                    <summary className="cursor-pointer list-none p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold ${toneMeta.labelClass}`}>
                              {toneMeta.badge}
                            </span>
                            <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                              {actionParts.actionType}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-3">
                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold text-slate-400">제품</div>
                              <div className="mt-1 break-words text-sm font-semibold leading-6 text-slate-900">
                                {actionParts.target}
                              </div>
                            </div>
                            <div className="border-l-4 border-slate-300 pl-3">
                              <div className={`text-[11px] font-semibold ${toneMeta.labelClass}`}>바로 할 일</div>
                              <div className="mt-1 space-y-2">
                                {item.action.split("\n").map((line, lineIndex) =>
                                  lineIndex === 0 ? (
                                    <p key={lineIndex} className="text-sm font-bold leading-6 text-slate-900">
                                      {line}
                                    </p>
                                  ) : (
                                    <p key={lineIndex} className="inline-flex max-w-full rounded-md bg-white/80 px-2.5 py-1.5 text-xs font-bold leading-5 text-slate-800 ring-1 ring-slate-200">
                                      {line}
                                    </p>
                                  ),
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <span className="mt-1 shrink-0 text-xs font-semibold text-slate-400">
                          근거 보기 <span aria-hidden="true" className="inline-block transition group-open:rotate-180">⌄</span>
                        </span>
                      </div>
                    </summary>
                    <div className="border-t border-white/70 px-4 pb-4 pt-3">
                      <div className="rounded-lg border border-white/80 bg-white/90 px-3 py-2.5">
                        <div className="text-[11px] font-semibold text-slate-400">결론</div>
                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-900">{conclusion}</p>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {evidenceDetails.map((detail, detailIndex) => {
                          const parts = detailParts(detail);
                          const stats = statParts(parts.text);
                          const isWideDetail = parts.label.includes("세부");
                          return (
                            <div key={detailIndex} className={`rounded-lg border px-3 py-2.5 ${isWideDetail ? "md:col-span-2" : ""} ${detailCardClass(parts.label)}`}>
                              <div className="text-[11px] font-semibold text-slate-400">{parts.label}</div>
                              {stats ? (
                                <div className={`mt-2 grid gap-1.5 ${isWideDetail ? "" : "sm:grid-cols-2"}`}>
                                  {stats.map((stat, statIndex) => (
                                    <span key={statIndex} className="rounded-md bg-slate-50 px-2.5 py-1.5 text-xs font-semibold leading-5 text-slate-700">
                                      {stat}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-1 text-xs leading-5 text-slate-600">{parts.text}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </details>
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
  const dashboardActionExplanations = buildComparisonExplanations(
    base ?? agg([]),
    o,
    byCatOf(baseRows),
    byCategory,
    baseRows,
    currentRows,
    data.rows,
  );
  const groupedDashboardExplanations = groupExplanations(dashboardActionExplanations);
  const latestCurrentDate = latestDateOf(currentRows);
  const hasCurrentBidData = currentRows.some(
    (row) =>
      latestCurrentDate != null &&
      rowDate(row) === latestCurrentDate &&
      typeof row.currentBid === "number" &&
      Number.isFinite(row.currentBid) &&
      row.currentBid > 0,
  );
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
  const showPeriodAverage = days > 1;
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
          average={showPeriodAverage ? `일 평균 ${fmtAvgCount(o.conversions / days)}개` : undefined}
          valueFormatter={(value) => `${fmtInt(value)}개`}
          showPercent={breakdownShowPercent}
          onToggleDisplay={() => setBreakdownShowPercent((value) => !value)}
          slices={slicesOf((m) => m.conversions)}
        />
        <BreakdownCard
          title="총 매출액"
          value={fmtWon(o.conversionValue)}
          average={showPeriodAverage ? `일 평균 ${fmtWon(o.conversionValue / days)}` : undefined}
          valueFormatter={fmtWon}
          showPercent={breakdownShowPercent}
          onToggleDisplay={() => setBreakdownShowPercent((value) => !value)}
          slices={slicesOf((m) => m.conversionValue)}
        />
        <BreakdownCard
          title="총 광고비"
          value={fmtWon(o.cost)}
          average={showPeriodAverage ? `일 평균 ${fmtWon(o.cost / days)}` : undefined}
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
                        <div className="text-xs text-slate-500">
                          <MetricHelpLabel label={m.label} />
                        </div>
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
              카테고리별 <MetricHelpLabel label={primary.label} />
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
              <MetricHelpLabel label={primary.label} /> 상위 상품{" "}
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

      <ActionRecommendationPanel
        title="광고 조정 추천"
        subtitle={`${periodText} 기준 · 전체 과거 흐름과 최근 7일, 직전 기간 ${basePeriodText}를 함께 보고 줄일 광고비와 옮길 곳을 보여줍니다.`}
        grouped={groupedDashboardExplanations}
        bidDataReady={hasCurrentBidData}
      />
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
  average,
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
  average?: string;
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
