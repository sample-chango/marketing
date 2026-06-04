import { createClient } from "@/lib/supabase/server";
import { deriveMetrics, sumTotals, type DerivedMetrics } from "@/lib/metrics";
import { CATEGORIES, type CategorySlug } from "@/lib/categories";

export interface MetricRow {
  category: string;
  campaign: string | null;
  ad_group: string | null;
  keyword: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  qualityScore: number | null;
  report_date: string;
  period_start: string;
  period_end: string;
}

export function isSupabaseConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

const SELECT_COLS =
  "category,campaign,ad_group,keyword,impressions,clicks,cost,conversions,conversion_value,quality_score,report_date,period_start,period_end";

interface RawRow {
  category: string;
  campaign: string | null;
  ad_group: string | null;
  keyword: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversion_value: number;
  quality_score: number | null;
  report_date: string;
  period_start: string | null;
  period_end: string | null;
}

function normalize(r: RawRow): MetricRow {
  return {
    category: r.category,
    campaign: r.campaign,
    ad_group: r.ad_group,
    keyword: r.keyword,
    impressions: Number(r.impressions) || 0,
    clicks: Number(r.clicks) || 0,
    cost: Number(r.cost) || 0,
    conversions: Number(r.conversions) || 0,
    conversionValue: Number(r.conversion_value) || 0,
    qualityScore: r.quality_score == null ? null : Number(r.quality_score),
    report_date: r.report_date,
    period_start: r.period_start ?? r.report_date,
    period_end: r.period_end ?? r.report_date,
  };
}

async function fetchRows(): Promise<MetricRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("ad_metrics").select(SELECT_COLS);
  if (error) {
    console.error("[data] fetchRows error:", error.message);
    return [];
  }
  return ((data ?? []) as unknown as RawRow[]).map(normalize);
}

const DEFAULT_DAILY_BUDGET = 40000;

/** 일 예산 (settings.daily_budget) */
async function fetchDailyBudget(): Promise<number> {
  if (!isSupabaseConfigured()) return DEFAULT_DAILY_BUDGET;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "daily_budget")
    .maybeSingle();
  if (error || !data) return DEFAULT_DAILY_BUDGET;
  const n = Number(data.value);
  return Number.isFinite(n) ? n : DEFAULT_DAILY_BUDGET;
}

export interface CategorySummary {
  slug: CategorySlug;
  label: string;
  metrics: DerivedMetrics;
}

export interface DashboardData {
  configured: boolean;
  hasData: boolean;
  /** 최신 기간(스냅샷) 기준 전체 지표 */
  overall: DerivedMetrics;
  /** 직전 기간 기준 전체 지표 (전주대비 비교용, 없으면 null) */
  prevOverall: DerivedMetrics | null;
  byCategory: CategorySummary[];
  rows: MetricRow[];
  period: { start: string; end: string } | null;
  prevPeriod: { start: string; end: string } | null;
  /** 일 예산 (원) */
  dailyBudget: number;
}

/** 기간 그룹키 (start~end). 단일 일자는 start=end */
const periodKey = (r: MetricRow) => `${r.period_start}~${r.period_end}`;

/** 종합 대시보드 데이터 — 최신 기간 기준 + 직전 기간 대비 + 예산 */
export async function getDashboardData(): Promise<DashboardData> {
  const configured = isSupabaseConfigured();
  const allRows = await fetchRows();

  // 기간(period_start~period_end)별로 그룹핑, period_end → period_start 순 정렬
  const periodKeys = [...new Set(allRows.map(periodKey))].sort((a, b) => {
    const [as, ae] = a.split("~");
    const [bs, be] = b.split("~");
    return ae === be ? as.localeCompare(bs) : ae.localeCompare(be);
  });
  const latestKey = periodKeys[periodKeys.length - 1] ?? null;
  const prevKey =
    periodKeys.length >= 2 ? periodKeys[periodKeys.length - 2] : null;

  const rows = latestKey
    ? allRows.filter((r) => periodKey(r) === latestKey)
    : [];
  const prevRows = prevKey
    ? allRows.filter((r) => periodKey(r) === prevKey)
    : [];

  const byCategory: CategorySummary[] = CATEGORIES.map((c) => ({
    slug: c.slug,
    label: c.label,
    metrics: deriveMetrics(sumTotals(rows.filter((r) => r.category === c.slug))),
  }));

  const dailyBudget = await fetchDailyBudget();

  const toPeriod = (key: string | null) => {
    if (!key) return null;
    const [start, end] = key.split("~");
    return { start, end };
  };

  return {
    configured,
    hasData: rows.length > 0,
    overall: deriveMetrics(sumTotals(rows)),
    prevOverall: prevKey ? deriveMetrics(sumTotals(prevRows)) : null,
    byCategory,
    rows,
    period: toPeriod(latestKey),
    prevPeriod: toPeriod(prevKey),
    dailyBudget,
  };
}
