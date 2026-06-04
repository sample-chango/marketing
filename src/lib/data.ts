import { createClient } from "@/lib/supabase/server";
import {
  deriveMetrics,
  sumTotals,
  type DerivedMetrics,
} from "@/lib/metrics";
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

/** 전체 행을 가져옴 (카테고리 필터 선택) */
async function fetchRows(category?: CategorySlug): Promise<MetricRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  let query = supabase.from("ad_metrics").select(SELECT_COLS);
  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) {
    console.error("[data] fetchRows error:", error.message);
    return [];
  }
  return ((data ?? []) as unknown as RawRow[]).map(normalize);
}

export interface CategorySummary {
  slug: CategorySlug;
  label: string;
  metrics: DerivedMetrics;
}

export interface DashboardData {
  configured: boolean;
  hasData: boolean;
  overall: DerivedMetrics;
  byCategory: CategorySummary[];
}

/** 종합 대시보드 데이터 (전체 + 카테고리별) */
export async function getDashboardData(): Promise<DashboardData> {
  const configured = isSupabaseConfigured();
  const rows = await fetchRows();

  const byCategory: CategorySummary[] = CATEGORIES.map((c) => {
    const catRows = rows.filter((r) => r.category === c.slug);
    return {
      slug: c.slug,
      label: c.label,
      metrics: deriveMetrics(sumTotals(catRows)),
    };
  });

  return {
    configured,
    hasData: rows.length > 0,
    overall: deriveMetrics(sumTotals(rows)),
    byCategory,
  };
}

export interface CategoryDetail {
  configured: boolean;
  hasData: boolean;
  metrics: DerivedMetrics;
  rows: MetricRow[];
}

/** 카테고리 상세(퍼널) 데이터 */
export async function getCategoryDetail(
  category: CategorySlug,
): Promise<CategoryDetail> {
  const rows = await fetchRows(category);
  return {
    configured: isSupabaseConfigured(),
    hasData: rows.length > 0,
    metrics: deriveMetrics(sumTotals(rows)),
    rows: rows.sort((a, b) => b.cost - a.cost),
  };
}
