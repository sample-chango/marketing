"use client";

import { useEffect, useMemo, useState } from "react";
import { TopBar } from "@/components/TopBar";
import type { DashboardData, MetricRow } from "@/lib/data";
import {
  deriveMetrics,
  fmtInt,
  fmtPct,
  fmtRoas,
  fmtWon,
  sumTotals,
  type DerivedMetrics,
} from "@/lib/metrics";

type TermGroup = "metric" | "analysis" | "strategy";
type GroupFilter = TermGroup | "all";

type Term = {
  term: string;
  group: TermGroup;
  short: string;
  formula?: string;
  detail: string;
};

type StoredRanges = {
  aStart: string;
  aEnd: string;
  bStart: string;
  bEnd: string;
};

type Tip = {
  title: string;
  body: string;
  tone: "good" | "warn" | "danger" | "neutral";
};

const CHANGE_ANALYSIS_STORAGE_KEY = "marketing-change-analysis-ranges";

const groupLabels: Record<TermGroup, string> = {
  metric: "핵심 지표",
  analysis: "분석 화면",
  strategy: "운영 전략",
};

const groupFilters: { key: GroupFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "metric", label: "핵심 지표" },
  { key: "analysis", label: "분석 화면" },
  { key: "strategy", label: "운영 전략" },
];

const terms: Term[] = [
  {
    term: "노출수",
    group: "metric",
    short: "광고가 화면에 보인 횟수",
    detail:
      "발견 기회를 보는 지표입니다. 노출이 충분한데 클릭이 약하면 검색어, 소재 문구, 가격 표현의 연결성을 먼저 봅니다.",
  },
  {
    term: "클릭수",
    group: "metric",
    short: "광고를 눌러 방문한 횟수",
    detail:
      "관심의 크기입니다. 클릭은 늘었는데 전환이 적으면 유입 품질이나 랜딩 흐름에서 이탈이 생겼을 가능성이 큽니다.",
  },
  {
    term: "CTR",
    group: "metric",
    short: "노출 대비 클릭 비율",
    formula: "클릭수 / 노출수",
    detail:
      "광고가 얼마나 눌리고 있는지 봅니다. CTR이 떨어지면 소재 피로도, 검색어 의도 불일치, 가격 매력도를 함께 점검합니다.",
  },
  {
    term: "CPC",
    group: "metric",
    short: "방문 1회를 만드는 평균 비용",
    formula: "광고비 / 클릭수",
    detail:
      "입찰 경쟁과 유입 단가를 봅니다. CPC가 오르면 같은 예산으로 만들 수 있는 방문 수가 줄어듭니다.",
  },
  {
    term: "전환수",
    group: "metric",
    short: "구매, 문의처럼 목표 행동이 발생한 건수",
    detail:
      "실제 성과의 양입니다. 전환수는 많지만 매출이 낮으면 객단가를, 전환수는 적지만 매출이 높으면 고가 전환 비중을 봅니다.",
  },
  {
    term: "CVR",
    group: "metric",
    short: "클릭 대비 전환 비율",
    formula: "전환수 / 클릭수",
    detail:
      "방문자를 성과로 바꾸는 힘입니다. CVR 하락은 랜딩, 가격, 혜택, 신뢰 요소 중 하나가 약해졌다는 신호일 수 있습니다.",
  },
  {
    term: "CPA",
    group: "metric",
    short: "전환 1건을 만드는 평균 비용",
    formula: "광고비 / 전환수",
    detail:
      "성과 1건의 원가입니다. CPA가 목표 마진보다 높으면 매출이 나와도 손익이 나빠질 수 있습니다.",
  },
  {
    term: "광고비",
    group: "metric",
    short: "해당 기간에 실제로 집행된 금액",
    detail:
      "성과를 만들기 위해 쓴 비용입니다. 단독으로 보기보다 매출, 전환수, ROAS와 같이 봐야 의미가 생깁니다.",
  },
  {
    term: "매출액",
    group: "metric",
    short: "광고 성과로 잡힌 매출 합계",
    detail:
      "성과 규모를 봅니다. 매출이 늘었더라도 광고비가 더 빠르게 늘었다면 효율은 낮아질 수 있습니다.",
  },
  {
    term: "ROAS",
    group: "metric",
    short: "광고비 대비 매출 성과",
    formula: "매출액 / 광고비",
    detail:
      "광고 효율을 빠르게 보는 대표 지표입니다. 실제 의사결정에서는 마진율과 재구매 가능성까지 같이 보는 편이 안전합니다.",
  },
  {
    term: "집행률",
    group: "metric",
    short: "예산 대비 실제 광고비 비율",
    formula: "광고비 / 기간 예산",
    detail:
      "예산을 얼마나 소진했는지 봅니다. 집행률이 낮으면 노출 기회가 적었거나 입찰 경쟁력이 부족했을 수 있습니다.",
  },
  {
    term: "변화 분석",
    group: "analysis",
    short: "두 기간의 성과를 나란히 비교하는 화면",
    detail:
      "기간 A와 기간 B를 비교해 매출, 전환, 광고비, ROAS가 어느 쪽으로 움직였는지 확인하는 분석 화면입니다.",
  },
  {
    term: "기간 A / 기간 B",
    group: "analysis",
    short: "비교 기준 기간과 현재 확인 기간",
    detail:
      "보통 기간 A는 비교 기준, 기간 B는 확인하려는 기간으로 봅니다. 같은 길이의 기간끼리 비교하면 해석이 더 깔끔합니다.",
  },
  {
    term: "주요 변화 이슈",
    group: "analysis",
    short: "비교 기간 사이에서 변화 폭이 큰 항목",
    detail:
      "매출, 전환, 광고비, ROAS처럼 운영 판단에 바로 영향을 주는 변화만 우선순위로 추린 내용입니다.",
  },
  {
    term: "상세보기",
    group: "analysis",
    short: "요약 숫자를 구성하는 세부 항목",
    detail:
      "총 전환수, 매출액, ROAS처럼 큰 숫자를 눌렀을 때 어떤 항목이 영향을 줬는지 확인하는 보조 화면입니다.",
  },
  {
    term: "검색어 의도",
    group: "strategy",
    short: "사용자가 검색한 진짜 목적",
    detail:
      "정보 탐색, 가격 비교, 구매 준비처럼 검색 목적을 나눠 보면 광고 문구와 랜딩을 더 정확히 맞출 수 있습니다.",
  },
  {
    term: "랜딩페이지",
    group: "strategy",
    short: "광고 클릭 후 도착하는 페이지",
    detail:
      "광고 문구와 랜딩 내용이 다르면 CVR이 떨어집니다. 첫 화면에서 사용자가 기대한 정보를 바로 확인할 수 있어야 합니다.",
  },
  {
    term: "객단가",
    group: "strategy",
    short: "전환 1건당 평균 매출",
    formula: "매출액 / 전환수",
    detail:
      "전환수와 매출 사이를 이어주는 지표입니다. 객단가가 오르면 같은 전환수에서도 매출과 ROAS가 개선될 수 있습니다.",
  },
  {
    term: "마진 ROAS",
    group: "strategy",
    short: "이익 기준으로 다시 본 ROAS",
    formula: "매출총이익 / 광고비",
    detail:
      "매출 기준 ROAS가 좋아도 마진이 낮으면 실제 이익은 부족할 수 있습니다. 손익 판단에 더 가까운 보조 지표입니다.",
  },
  {
    term: "세그먼트",
    group: "strategy",
    short: "성과를 나눠 보는 기준",
    detail:
      "전체 평균만 보면 문제가 숨습니다. 검색어 의도, 신규/재방문, 캠페인 구조처럼 의미 있는 단위로 나눠 봅니다.",
  },
  {
    term: "크리에이티브 피로도",
    group: "strategy",
    short: "같은 소재의 반응이 시간이 지나며 약해지는 현상",
    detail:
      "노출은 유지되는데 CTR이 계속 낮아지면 문구, 이미지, 혜택 표현을 교체할 시점일 수 있습니다.",
  },
  {
    term: "리마케팅",
    group: "strategy",
    short: "방문했지만 전환하지 않은 사람에게 다시 노출",
    detail:
      "즉시 전환하지 않은 사용자를 다시 설득하는 방식입니다. 구매 고민 기간이 긴 업종에서 특히 중요합니다.",
  },
  {
    term: "LTV",
    group: "strategy",
    short: "고객이 장기적으로 만드는 총 가치",
    detail:
      "첫 구매의 ROAS만으로 판단하기 어려울 때 봅니다. 재구매나 추천 가능성이 높으면 허용 가능한 CPA도 달라집니다.",
  },
];

const toneClass: Record<Tip["tone"], string> = {
  good: "border-emerald-200 text-emerald-700",
  warn: "border-amber-200 text-amber-700",
  danger: "border-rose-200 text-rose-700",
  neutral: "border-slate-200 text-slate-600",
};

const rowDate = (row: MetricRow) => row.period_end;
const fmtDate = (iso: string) => (iso ? iso.replaceAll("-", ".") : "기간 없음");
const rangeLabel = (start: string, end: string) =>
  !start ? "기간 없음" : start === end ? fmtDate(start) : `${fmtDate(start)} - ${fmtDate(end)}`;
const daysInclusive = (start: string, end: string) =>
  start && end ? Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1) : 0;

function aggregate(rows: MetricRow[]): DerivedMetrics {
  return deriveMetrics(sumTotals(rows));
}

function normalizeRange(start: string, end: string, fallback: string, allDates: string[]) {
  let s = start && allDates.includes(start) ? start : fallback;
  let e = end && allDates.includes(end) ? end : fallback;
  if (s && e && s > e) [s, e] = [e, s];
  return { start: s, end: e };
}

function parseStoredRanges(
  raw: string | null,
  allDates: string[],
  fallback: StoredRanges,
): StoredRanges {
  if (!raw) return fallback;

  try {
    const saved = JSON.parse(raw) as Record<string, unknown>;
    const valid = (value: unknown): value is string =>
      typeof value === "string" && allDates.includes(value);

    return {
      aStart: valid(saved.aStart) ? saved.aStart : fallback.aStart,
      aEnd: valid(saved.aEnd) ? saved.aEnd : fallback.aEnd,
      bStart: valid(saved.bStart) ? saved.bStart : fallback.bStart,
      bEnd: valid(saved.bEnd) ? saved.bEnd : fallback.bEnd,
    };
  } catch {
    return fallback;
  }
}

function rowsBetween(rows: MetricRow[], start: string, end: string) {
  if (!start || !end) return [];
  return rows.filter((row) => {
    const date = rowDate(row);
    return date >= start && date <= end;
  });
}

function ratioDelta(current: number, base: number) {
  if (base <= 0) return null;
  return (current - base) / base;
}

function deltaText(delta: number | null) {
  if (delta == null) return "-";
  return `${delta >= 0 ? "+" : "-"}${Math.abs(delta * 100).toFixed(1)}%`;
}

function buildTips({
  aMetrics,
  bMetrics,
  aRows,
  bRows,
  bStart,
  bEnd,
  dailyBudget,
}: {
  aMetrics: DerivedMetrics;
  bMetrics: DerivedMetrics;
  aRows: MetricRow[];
  bRows: MetricRow[];
  bStart: string;
  bEnd: string;
  dailyBudget: number;
}): Tip[] {
  if (aRows.length === 0 || bRows.length === 0) {
    return [
      {
        title: "비교할 데이터가 부족합니다",
        body: "변화분석에서 기간 A와 기간 B가 모두 데이터가 있는 구간으로 잡혀야 꿀팁이 계산됩니다.",
        tone: "neutral",
      },
    ];
  }

  const tips: Tip[] = [];
  const roasDelta = bMetrics.roas - aMetrics.roas;
  const costDelta = ratioDelta(bMetrics.cost, aMetrics.cost);
  const revenueDelta = ratioDelta(bMetrics.conversionValue, aMetrics.conversionValue);
  const conversionDelta = ratioDelta(bMetrics.conversions, aMetrics.conversions);
  const ctrDelta = ratioDelta(bMetrics.ctr, aMetrics.ctr);
  const cvrDelta = ratioDelta(bMetrics.cvr, aMetrics.cvr);
  const days = daysInclusive(bStart, bEnd);
  const periodBudget = dailyBudget * days;
  const spendRate = periodBudget > 0 ? bMetrics.cost / periodBudget : 0;

  if (bMetrics.cost > 0 && aMetrics.cost > 0 && Math.abs(roasDelta) >= 0.25) {
    tips.push({
      title: roasDelta > 0 ? "ROAS가 개선됐습니다" : "ROAS 하락을 먼저 확인하세요",
      body: `${fmtRoas(aMetrics.roas)}에서 ${fmtRoas(bMetrics.roas)}로 움직였습니다. 광고비와 매출 중 어느 쪽 변화가 더 컸는지 같이 확인하면 원인이 빨리 좁혀집니다.`,
      tone: roasDelta > 0 ? "good" : "danger",
    });
  }

  if (costDelta != null && revenueDelta != null && costDelta > 0.15 && revenueDelta <= 0) {
    tips.push({
      title: "광고비 증가가 매출로 이어지지 않았습니다",
      body: `광고비는 ${deltaText(costDelta)}인데 매출은 ${deltaText(revenueDelta)}입니다. 예산이 늘어난 구간의 검색어와 랜딩 흐름을 우선 확인하세요.`,
      tone: "danger",
    });
  }

  if (revenueDelta != null && costDelta != null && revenueDelta > 0.12 && costDelta <= 0.08) {
    tips.push({
      title: "좋은 성장 구간입니다",
      body: `매출은 ${deltaText(revenueDelta)}, 광고비는 ${deltaText(costDelta)}입니다. 같은 방향의 예산 확대를 작게 테스트해볼 만합니다.`,
      tone: "good",
    });
  }

  if (ctrDelta != null && ctrDelta < -0.15 && aMetrics.impressions >= 100) {
    tips.push({
      title: "클릭 반응이 약해졌습니다",
      body: `CTR이 ${fmtPct(aMetrics.ctr)}에서 ${fmtPct(bMetrics.ctr)}로 낮아졌습니다. 소재 피로도나 검색어 의도 불일치 가능성을 봐야 합니다.`,
      tone: "warn",
    });
  }

  if (cvrDelta != null && cvrDelta < -0.15 && aMetrics.clicks >= 20) {
    tips.push({
      title: "클릭 이후 전환력이 떨어졌습니다",
      body: `CVR이 ${fmtPct(aMetrics.cvr)}에서 ${fmtPct(bMetrics.cvr)}로 낮아졌습니다. 랜딩 첫 화면, 가격, 혜택, 신뢰 요소를 점검하세요.`,
      tone: "warn",
    });
  }

  if (conversionDelta != null && Math.abs(conversionDelta) >= 0.2 && aMetrics.conversions >= 1) {
    tips.push({
      title: conversionDelta > 0 ? "전환수가 늘었습니다" : "전환수 감소가 보입니다",
      body: `전환수는 ${fmtInt(aMetrics.conversions)}건에서 ${fmtInt(bMetrics.conversions)}건으로 ${deltaText(conversionDelta)} 변했습니다. 같은 방향으로 매출도 움직였는지 함께 확인하세요.`,
      tone: conversionDelta > 0 ? "good" : "danger",
    });
  }

  if (spendRate > 1.1) {
    tips.push({
      title: "기간 예산보다 많이 집행됐습니다",
      body: `집행률은 ${fmtPct(spendRate)}입니다. 효율이 동반되지 않았다면 예산 제한이나 입찰 조정이 필요합니다.`,
      tone: "warn",
    });
  } else if (spendRate > 0 && spendRate < 0.5 && bMetrics.conversions > 0) {
    tips.push({
      title: "예산 여지가 남아 있습니다",
      body: `집행률은 ${fmtPct(spendRate)}입니다. ROAS가 유지된다면 예산이나 입찰을 조금씩 늘려 추가 전환을 확인할 수 있습니다.`,
      tone: "good",
    });
  }

  if (tips.length === 0) {
    tips.push({
      title: "큰 위험 신호는 적습니다",
      body: "기간 B가 기간 A와 비슷한 흐름입니다. 이럴 때는 급한 수정보다 검색어, 소재, 랜딩별 작은 차이를 보는 편이 좋습니다.",
      tone: "neutral",
    });
  }

  return tips.slice(0, 5);
}

function compareRows(aMetrics: DerivedMetrics, bMetrics: DerivedMetrics) {
  return [
    {
      label: "ROAS",
      before: fmtRoas(aMetrics.roas),
      after: fmtRoas(bMetrics.roas),
      delta: bMetrics.roas - aMetrics.roas,
      deltaLabel: `${bMetrics.roas >= aMetrics.roas ? "+" : ""}${fmtRoas(bMetrics.roas - aMetrics.roas)}`,
      goodWhenUp: true,
    },
    {
      label: "매출액",
      before: fmtWon(aMetrics.conversionValue),
      after: fmtWon(bMetrics.conversionValue),
      delta: bMetrics.conversionValue - aMetrics.conversionValue,
      deltaLabel: deltaText(ratioDelta(bMetrics.conversionValue, aMetrics.conversionValue)),
      goodWhenUp: true,
    },
    {
      label: "전환수",
      before: `${fmtInt(aMetrics.conversions)}건`,
      after: `${fmtInt(bMetrics.conversions)}건`,
      delta: bMetrics.conversions - aMetrics.conversions,
      deltaLabel: deltaText(ratioDelta(bMetrics.conversions, aMetrics.conversions)),
      goodWhenUp: true,
    },
    {
      label: "광고비",
      before: fmtWon(aMetrics.cost),
      after: fmtWon(bMetrics.cost),
      delta: bMetrics.cost - aMetrics.cost,
      deltaLabel: deltaText(ratioDelta(bMetrics.cost, aMetrics.cost)),
      goodWhenUp: false,
    },
  ];
}

export function MarketingGlossaryClient({ data }: { data: DashboardData }) {
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<GroupFilter>("all");

  const allDates = useMemo(() => [...new Set(data.rows.map(rowDate))].sort(), [data.rows]);
  const allDatesKey = allDates.join("|");
  const latest = allDates[allDates.length - 1] ?? "";
  const previous = allDates[allDates.length - 2] ?? latest;
  const fallbackRanges = useMemo<StoredRanges>(
    () => ({ aStart: previous, aEnd: previous, bStart: latest, bEnd: latest }),
    [latest, previous],
  );
  const [storedRanges, setStoredRanges] = useState<StoredRanges>(fallbackRanges);

  useEffect(() => {
    if (typeof window === "undefined") {
      setStoredRanges(fallbackRanges);
      return;
    }

    setStoredRanges(
      parseStoredRanges(
        window.localStorage.getItem(CHANGE_ANALYSIS_STORAGE_KEY),
        allDates,
        fallbackRanges,
      ),
    );
  }, [allDates, allDatesKey, fallbackRanges]);

  const rangeA = useMemo(
    () => normalizeRange(storedRanges.aStart, storedRanges.aEnd, previous, allDates),
    [allDates, previous, storedRanges.aEnd, storedRanges.aStart],
  );
  const rangeB = useMemo(
    () => normalizeRange(storedRanges.bStart, storedRanges.bEnd, latest, allDates),
    [allDates, latest, storedRanges.bEnd, storedRanges.bStart],
  );
  const rowsA = useMemo(
    () => rowsBetween(data.rows, rangeA.start, rangeA.end),
    [data.rows, rangeA.end, rangeA.start],
  );
  const rowsB = useMemo(
    () => rowsBetween(data.rows, rangeB.start, rangeB.end),
    [data.rows, rangeB.end, rangeB.start],
  );
  const metricsA = useMemo(() => aggregate(rowsA), [rowsA]);
  const metricsB = useMemo(() => aggregate(rowsB), [rowsB]);
  const tips = useMemo(
    () =>
      buildTips({
        aMetrics: metricsA,
        bMetrics: metricsB,
        aRows: rowsA,
        bRows: rowsB,
        bStart: rangeB.start,
        bEnd: rangeB.end,
        dailyBudget: data.dailyBudget,
      }),
    [data.dailyBudget, metricsA, metricsB, rangeB.end, rangeB.start, rowsA, rowsB],
  );
  const metricRows = useMemo(() => compareRows(metricsA, metricsB), [metricsA, metricsB]);

  const filteredTerms = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    return terms.filter((item) => {
      const matchesGroup = activeGroup === "all" || item.group === activeGroup;
      const matchesQuery =
        lowerQuery.length === 0 ||
        item.term.toLowerCase().includes(lowerQuery) ||
        item.short.toLowerCase().includes(lowerQuery) ||
        item.detail.toLowerCase().includes(lowerQuery) ||
        item.formula?.toLowerCase().includes(lowerQuery);

      return matchesGroup && matchesQuery;
    });
  }, [activeGroup, query]);

  return (
    <>
      <TopBar title="마케팅 용어사전" maxWidth="max-w-6xl" />
      <main className="mx-auto grid max-w-6xl gap-6 p-4 md:p-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-4">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">마케팅 용어사전</h1>
              <p className="mt-1 text-sm text-slate-500">
                대시보드 해석에 필요한 용어만 추려 정리했습니다.
              </p>
            </div>
            <div className="w-full max-w-md">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="CTR, ROAS, 랜딩페이지..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="용어 필터">
              {groupFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveGroup(filter.key)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    activeGroup === filter.key
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <span className="text-sm text-slate-400">{filteredTerms.length}개</span>
          </div>

          {filteredTerms.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              검색 결과가 없습니다.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredTerms.map((item) => (
                <article
                  key={`${item.group}-${item.term}`}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-slate-900">{item.term}</h2>
                      <p className="mt-1 text-sm font-medium text-slate-700">{item.short}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                      {groupLabels[item.group]}
                    </span>
                  </div>
                  {item.formula && (
                    <div className="mt-3 inline-flex rounded-md bg-emerald-50 px-2 py-1 font-mono text-xs font-semibold text-emerald-700">
                      {item.formula}
                    </div>
                  )}
                  <p className="mt-3 text-sm leading-6 text-slate-500">{item.detail}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-lg font-semibold text-slate-900">기간별 꿀팁</h2>
              <p className="mt-1 text-sm text-slate-500">
                기준: 기간 B vs 기간 A
              </p>
            </div>

            <div className="grid gap-2 border-b border-slate-200 py-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">기간 A</span>
                <strong className="text-right font-semibold text-slate-800">
                  {rangeLabel(rangeA.start, rangeA.end)}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">기간 B</span>
                <strong className="text-right font-semibold text-slate-800">
                  {rangeLabel(rangeB.start, rangeB.end)}
                </strong>
              </div>
            </div>

            <div className="divide-y divide-slate-100 border-b border-slate-200 py-2">
              {metricRows.map((row) => {
                const isGood = row.delta === 0 ? null : row.goodWhenUp ? row.delta > 0 : row.delta < 0;
                return (
                  <div key={row.label} className="grid grid-cols-[72px_1fr] gap-3 py-2.5 text-sm">
                    <span className="text-slate-500">{row.label}</span>
                    <div className="min-w-0 text-right">
                      <div className="font-semibold text-slate-800">
                        {row.before} → {row.after}
                      </div>
                      <div
                        className={`mt-0.5 text-xs ${
                          isGood == null
                            ? "text-slate-400"
                            : isGood
                              ? "text-emerald-600"
                              : "text-rose-600"
                        }`}
                      >
                        {row.deltaLabel}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="divide-y divide-slate-100 pt-2">
              {tips.map((tip) => (
                <article key={tip.title} className={`border-l-2 py-3 pl-3 ${toneClass[tip.tone]}`}>
                  <h3 className="text-sm font-semibold">{tip.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{tip.body}</p>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </main>
    </>
  );
}
