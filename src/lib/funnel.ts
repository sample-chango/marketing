import type { DerivedMetrics } from "./metrics";
import { fmtInt, fmtWon, fmtPct, fmtRoas } from "./metrics";

/**
 * 마케팅 퍼널(AARRR) — 유지(Retention)·추천(Referral) 단계는 제외.
 * 각 단계는 해당 지표들로 표현됩니다.
 */
export interface FunnelMetric {
  key: keyof DerivedMetrics;
  label: string;
  format: (m: DerivedMetrics) => string;
  hint?: string;
}

export interface FunnelStage {
  key: string;
  label: string; // 한글 단계명
  english: string;
  description: string;
  metrics: FunnelMetric[];
}

export const FUNNEL_STAGES: FunnelStage[] = [
  {
    key: "awareness",
    label: "인지",
    english: "Awareness",
    description: "광고가 얼마나 많이 노출되었는가",
    metrics: [
      {
        key: "impressions",
        label: "노출수",
        format: (m) => fmtInt(m.impressions),
      },
    ],
  },
  {
    key: "acquisition",
    label: "획득",
    english: "Acquisition",
    description: "노출에서 클릭으로 얼마나 유입되었는가",
    metrics: [
      { key: "ctr", label: "CTR (클릭률)", format: (m) => fmtPct(m.ctr) },
      { key: "cpc", label: "CPC (클릭당비용)", format: (m) => fmtWon(m.cpc) },
    ],
  },
  {
    key: "activation",
    label: "활성화",
    english: "Activation",
    description: "클릭이 얼마나 전환으로 이어졌는가",
    metrics: [
      { key: "cvr", label: "CVR (전환율)", format: (m) => fmtPct(m.cvr) },
      { key: "cpa", label: "CPA (전환당비용)", format: (m) => fmtWon(m.cpa) },
    ],
  },
  {
    key: "revenue",
    label: "수익",
    english: "Revenue",
    description: "광고비 대비 매출 효율",
    metrics: [
      { key: "roas", label: "ROAS (광고수익률)", format: (m) => fmtRoas(m.roas) },
    ],
  },
];
