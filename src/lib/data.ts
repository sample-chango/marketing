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
}

export function isSupabaseConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

const SELECT_COLS =
  "category,campaign,ad_group,keyword,impressions,clicks,cost,conversions,conversion_value,quality_score,report_date";

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

/** 특정 월(YYYY-MM)의 카테고리별 예산 */
async function fetchBudgets(month: string): Promise<Record<string, number>> {
  if (!isSupabaseConfigured()) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("category,amount")
    .eq("month", month);
  if (error) {
    console.error("[data] fetchBudgets error:", error.message);
    return {};
  }
  const out: Record<string, number> = {};
  for (const b of (data ?? []) as { category: string; amount: number }[]) {
    out[b.category] = Number(b.amount) || 0;
  }
  return out;
}

export interface CategorySummary {
  slug: CategorySlug;
  label: string;
  metrics: DerivedMetrics;
}

export interface DashboardData {
  configured: boolean;
  hasData: boolean;
  /** 최신 스냅샷(가장 최근 일자) 기준 전체 지표 */
  overall: DerivedMetrics;
  /** 직전 일자 기준 전체 지표 (전주대비 비교용, 없으면 null) */
  prevOverall: DerivedMetrics | null;
  byCategory: CategorySummary[];
  rows: MetricRow[];
  period: { start: string; end: string } | null;
  prevDate: string | null;
  month: string | null; // 'YYYY-MM'
  budgetByCategory: Record<string, number>;
  totalBudget: number;
}

/** 종합 대시보드 데이터 — 최신 스냅샷 기준 + 직전 대비 + 예산 */
export async function getDashboardData(): Promise<DashboardData> {
  const configured = isSupabaseConfigured();
  const allRows = await fetchRows();

  const distinctDates = [...new Set(allRows.map((r) => r.report_date))]
    .filter(Boolean)
    .sort(); // 오름차순
  const latest = distinctDates[distinctDates.length - 1] ?? null;
  const prevDate =
    distinctDates.length >= 2 ? distinctDates[distinctDates.length - 2] : null;

  const rows = latest ? allRows.filter((r) => r.report_date === latest) : [];
  const prevRows = prevDate
    ? allRows.filter((r) => r.report_date === prevDate)
    : [];

  const byCategory: CategorySummary[] = CATEGORIES.map((c) => ({
    slug: c.slug,
    label: c.label,
    metrics: deriveMetrics(sumTotals(rows.filter((r) => r.category === c.slug))),
  }));

  const month = latest ? latest.slice(0, 7) : null;
  const budgetByCategory = month ? await fetchBudgets(month) : {};
  const totalBudget = Object.values(budgetByCategory).reduce(
    (s, n) => s + n,
    0,
  );

  return {
    configured,
    hasData: rows.length > 0,
    overall: deriveMetrics(sumTotals(rows)),
    prevOverall: prevDate ? deriveMetrics(sumTotals(prevRows)) : null,
    byCategory,
    rows,
    period: latest ? { start: latest, end: latest } : null,
    prevDate,
    month,
    budgetByCategory,
    totalBudget,
  };
}
