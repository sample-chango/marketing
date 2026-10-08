export interface RecommendationAdjustment {
  direction: "up" | "down";
  minPct: number;
  maxPct?: number;
  condition?: "review" | "transfer";
}

export interface ComparisonExplanation {
  tone: "good" | "warn" | "danger" | "neutral";
  title: string;
  target?: string;
  reason?: string;
  body: string;
  details: string[];
  action: string;
  adjustment?: RecommendationAdjustment;
  evidence?: {
    currentBid: number | null;
    roas: number;
    overallRoas: number;
    cost: number;
    revenue: number;
    currentDailyRevenue: number;
    historyDailyRevenue: number;
    recentDailyRevenue: number;
  };
}

export function shortRecommendationName(name: string) {
  return name.split(/[ㅣ|｜]/, 1)[0].trim().replace(/^\[샘플창고\]\s*/, "");
}

export function adjustmentPercent(adjustment: RecommendationAdjustment) {
  const low = Math.round(Math.min(adjustment.minPct, adjustment.maxPct ?? adjustment.minPct) * 100);
  const high = Math.round(Math.max(adjustment.minPct, adjustment.maxPct ?? adjustment.minPct) * 100);
  return `${adjustment.direction === "up" ? "+" : "−"}${low === high ? low : `${low}~${high}`}%`;
}

/** Match the existing recommendation's won rounding and downward range order. */
export function adjustedBidRange(bid: number | null, adjustment: RecommendationAdjustment) {
  if (bid == null || bid <= 0) return null;
  const low = Math.round(bid * Math.min(adjustment.minPct, adjustment.maxPct ?? adjustment.minPct));
  const high = Math.round(bid * Math.max(adjustment.minPct, adjustment.maxPct ?? adjustment.minPct));
  return adjustment.direction === "up"
    ? [bid + low, bid + high] as const
    : [Math.max(0, bid - high), Math.max(0, bid - low)] as const;
}
