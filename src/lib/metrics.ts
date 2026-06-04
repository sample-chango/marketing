/**
 * 광고 성과 지표 계산.
 * 원시 합계(노출/클릭/비용/전환/전환매출)로부터 파생 지표를 계산합니다.
 */

/** 원시 합계 데이터 (DB 행을 합산한 결과) */
export interface MetricTotals {
  impressions: number; // 노출수
  clicks: number; // 클릭수
  cost: number; // 광고비 (원)
  conversions: number; // 전환수
  conversionValue: number; // 전환매출액 (원)
  /** 품질지수: 가중 평균(노출 기준)을 위해 합계와 가중치를 함께 보관 */
  qualitySum: number; // sum(품질지수 * 노출수)
  qualityWeight: number; // sum(노출수 where 품질지수 존재)
}

export const EMPTY_TOTALS: MetricTotals = {
  impressions: 0,
  clicks: 0,
  cost: 0,
  conversions: 0,
  conversionValue: 0,
  qualitySum: 0,
  qualityWeight: 0,
};

/** 파생 지표 */
export interface DerivedMetrics {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  ctr: number; // 클릭률 = 클릭/노출
  cpc: number; // 평균클릭비용 = 비용/클릭
  cvr: number; // 전환율 = 전환/클릭
  cpa: number; // 전환당비용 = 비용/전환
  roas: number; // 광고수익률 = 전환매출/비용
  qualityScore: number | null; // 노출 가중 평균 품질지수
}

function safeDiv(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

export function deriveMetrics(t: MetricTotals): DerivedMetrics {
  return {
    impressions: t.impressions,
    clicks: t.clicks,
    cost: t.cost,
    conversions: t.conversions,
    conversionValue: t.conversionValue,
    ctr: safeDiv(t.clicks, t.impressions),
    cpc: safeDiv(t.cost, t.clicks),
    cvr: safeDiv(t.conversions, t.clicks),
    cpa: safeDiv(t.cost, t.conversions),
    roas: safeDiv(t.conversionValue, t.cost),
    qualityScore: t.qualityWeight > 0 ? t.qualitySum / t.qualityWeight : null,
  };
}

/** 여러 행/합계를 누적 */
export function addToTotals(
  acc: MetricTotals,
  row: {
    impressions?: number | null;
    clicks?: number | null;
    cost?: number | null;
    conversions?: number | null;
    conversionValue?: number | null;
    qualityScore?: number | null;
  },
): MetricTotals {
  const impr = row.impressions ?? 0;
  acc.impressions += impr;
  acc.clicks += row.clicks ?? 0;
  acc.cost += row.cost ?? 0;
  acc.conversions += row.conversions ?? 0;
  acc.conversionValue += row.conversionValue ?? 0;
  if (row.qualityScore != null && impr > 0) {
    acc.qualitySum += row.qualityScore * impr;
    acc.qualityWeight += impr;
  }
  return acc;
}

export function sumTotals(rows: Parameters<typeof addToTotals>[1][]): MetricTotals {
  return rows.reduce(addToTotals, { ...EMPTY_TOTALS });
}

// ===== 표시용 포맷터 =====
export const fmtInt = (n: number) => Math.round(n).toLocaleString("ko-KR");
export const fmtWon = (n: number) =>
  "₩" + Math.round(n).toLocaleString("ko-KR");
export const fmtPct = (ratio: number) => (ratio * 100).toFixed(2) + "%";
export const fmtRoas = (ratio: number) => (ratio * 100).toFixed(0) + "%";
export const fmtQuality = (q: number | null) =>
  q == null ? "-" : q.toFixed(1);
