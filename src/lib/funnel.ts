import {
  deriveMetrics,
  sumTotals,
  fmtInt,
  fmtWon,
  fmtPct,
  fmtRoas,
  type DerivedMetrics,
} from "./metrics";

/**
 * 마케팅 퍼널(AARRR, 유지·추천 제외) — 이미지 기준 4단계.
 * 각 단계는 퍼널 박스에 보이는 지표(metrics)와,
 * 단계 클릭 시 상세테이블에 표시할 컬럼(columns)을 가집니다.
 */
export interface MetricDef {
  label: string;
  value: (m: DerivedMetrics) => string;
  align?: "left" | "right";
}

export interface FunnelStage {
  key: "awareness" | "acquisition" | "conversion" | "revenue";
  label: string; // 한글 단계명
  english: string;
  metrics: MetricDef[]; // 퍼널 박스 표시
  columns: MetricDef[]; // 상세테이블 표시
}

export const FUNNEL_STAGES: FunnelStage[] = [
  {
    key: "awareness",
    label: "인식",
    english: "Awareness",
    metrics: [{ label: "노출수", value: (m) => fmtInt(m.impressions) }],
    columns: [{ label: "노출수", value: (m) => fmtInt(m.impressions) }],
  },
  {
    key: "acquisition",
    label: "유입",
    english: "Acquisition",
    metrics: [
      { label: "클릭수", value: (m) => fmtInt(m.clicks) },
      { label: "CTR", value: (m) => fmtPct(m.ctr) },
      { label: "CPC", value: (m) => fmtWon(m.cpc) },
    ],
    columns: [
      { label: "클릭수", value: (m) => fmtInt(m.clicks) },
      { label: "CTR", value: (m) => fmtPct(m.ctr) },
      { label: "CPC", value: (m) => fmtWon(m.cpc) },
    ],
  },
  {
    key: "conversion",
    label: "전환",
    english: "Conversion",
    metrics: [
      { label: "구매", value: (m) => fmtInt(m.conversions) },
      { label: "CVR", value: (m) => fmtPct(m.cvr) },
      { label: "CPA", value: (m) => fmtWon(m.cpa) },
    ],
    columns: [
      { label: "구매", value: (m) => fmtInt(m.conversions) },
      { label: "CVR", value: (m) => fmtPct(m.cvr) },
      { label: "CPA", value: (m) => fmtWon(m.cpa) },
    ],
  },
  {
    key: "revenue",
    label: "성과",
    english: "Revenue",
    metrics: [{ label: "ROAS", value: (m) => fmtRoas(m.roas) }],
    columns: [
      { label: "매출", value: (m) => fmtWon(m.conversionValue) },
      { label: "광고비", value: (m) => fmtWon(m.cost) },
      { label: "ROAS", value: (m) => fmtRoas(m.roas) },
    ],
  },
];

/** 단일 행을 파생지표로 변환 (상세테이블 셀 계산용) */
export function deriveRow(row: {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  qualityScore: number | null;
}): DerivedMetrics {
  return deriveMetrics(sumTotals([row]));
}
