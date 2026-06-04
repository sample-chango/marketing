import { createClient } from "@/lib/supabase/server";

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

export interface PeriodOption {
  key: string; // 'start~end'
  start: string;
  end: string;
}

export interface DashboardData {
  configured: boolean;
  hasData: boolean;
  /** 전체 행(모든 기간). 날짜/기간 전환·비교는 클라이언트에서 수행 */
  rows: MetricRow[];
  /** 업로드된 기간 목록 (오름차순) */
  periods: PeriodOption[];
  /** 일 예산 (원) */
  dailyBudget: number;
}

/** 기간 그룹키 (start~end). 단일 일자는 start=end */
const periodKey = (r: MetricRow) => `${r.period_start}~${r.period_end}`;

/** 종합 대시보드 데이터 — 전체 행 + 기간 목록 + 예산 */
export async function getDashboardData(): Promise<DashboardData> {
  const configured = isSupabaseConfigured();
  const rows = await fetchRows();

  const periodKeys = [...new Set(rows.map(periodKey))].sort((a, b) => {
    const [as, ae] = a.split("~");
    const [bs, be] = b.split("~");
    return ae === be ? as.localeCompare(bs) : ae.localeCompare(be);
  });
  const periods: PeriodOption[] = periodKeys.map((key) => {
    const [start, end] = key.split("~");
    return { key, start, end };
  });

  const dailyBudget = await fetchDailyBudget();

  return {
    configured,
    hasData: rows.length > 0,
    rows,
    periods,
    dailyBudget,
  };
}
