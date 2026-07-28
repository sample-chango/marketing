import { createAdminClient } from "@/lib/supabase/admin";
import { CURRENT_BID_SETTINGS_KEY, currentBidKey, parseCurrentBidMap } from "@/lib/current-bids";

export interface MetricRow {
  category: string;
  campaign: string | null;
  ad_group: string | null;
  keyword: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  currentBid: number | null;
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

function canReadDashboardData(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

const SELECT_COLS_WITH_CURRENT_BID =
  "category,campaign,ad_group,keyword,impressions,clicks,cost,current_bid,conversions,conversion_value,quality_score,report_date,period_start,period_end";
const SELECT_COLS_LEGACY =
  "category,campaign,ad_group,keyword,impressions,clicks,cost,conversions,conversion_value,quality_score,report_date,period_start,period_end";

interface RawRow {
  category: string;
  campaign: string | null;
  ad_group: string | null;
  keyword: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  current_bid?: number | null;
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
    currentBid: r.current_bid == null ? null : Number(r.current_bid),
    conversions: Number(r.conversions) || 0,
    conversionValue: Number(r.conversion_value) || 0,
    qualityScore: r.quality_score == null ? null : Number(r.quality_score),
    report_date: r.report_date,
    period_start: r.period_start ?? r.report_date,
    period_end: r.period_end ?? r.report_date,
  };
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function fetchCurrentBidMap(supabase: AdminClient): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", CURRENT_BID_SETTINGS_KEY)
    .maybeSingle();
  if (error) {
    console.warn("[data] current bid map load failed:", error.message);
    return {};
  }
  return parseCurrentBidMap(typeof data?.value === "string" ? data.value : null);
}

function applyCurrentBidMap(rows: MetricRow[], bidMap: Record<string, number>): MetricRow[] {
  if (Object.keys(bidMap).length === 0) return rows;
  return rows.map((row) => {
    const mappedBid = bidMap[currentBidKey(row)];
    if (!Number.isFinite(mappedBid) || mappedBid <= 0) return row;
    return { ...row, currentBid: mappedBid };
  });
}
function isMissingCurrentBidColumnError(error: unknown): boolean {
  const item = error as { code?: string; message?: string } | null | undefined;
  const message = String(item?.message ?? "").toLowerCase();
  return (
    message.includes("current_bid") &&
    (item?.code === "42703" || item?.code === "PGRST204" || message.includes("schema cache") || message.includes("does not exist"))
  );
}

async function fetchRows(): Promise<MetricRow[]> {
  if (!canReadDashboardData()) return [];

  const supabase = createAdminClient();
  const pageSize = 1000;
  const finishRows = async (rows: MetricRow[]) => applyCurrentBidMap(rows, await fetchCurrentBidMap(supabase));

  const fetchWithSelect = async (selectCols: string) => {
    const first = await supabase
      .from("ad_metrics")
      .select(selectCols, { count: "exact" })
      .order("period_end", { ascending: true })
      .range(0, pageSize - 1);

    if (first.error) return { rows: [] as MetricRow[], error: first.error };

    const firstRows = (first.data ?? []) as unknown as RawRow[];
    const total = first.count ?? firstRows.length;

    if (firstRows.length < pageSize || total <= firstRows.length) {
      return { rows: firstRows.map(normalize), error: null };
    }

    if (first.count == null) {
      const rows = [...firstRows];
      for (let from = pageSize; ; from += pageSize) {
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from("ad_metrics")
          .select(selectCols)
          .order("period_end", { ascending: true })
          .range(from, to);
        if (error) return { rows: [] as MetricRow[], error };
        rows.push(...((data ?? []) as unknown as RawRow[]));
        if ((data ?? []).length < pageSize) break;
      }
      return { rows: rows.map(normalize), error: null };
    }

    try {
      const ranges: Array<[number, number]> = [];
      for (let from = pageSize; from < total; from += pageSize) {
        ranges.push([from, Math.min(from + pageSize - 1, total - 1)]);
      }

      const pages = await Promise.all(
        ranges.map(async ([from, to]) => {
          const { data, error } = await supabase
            .from("ad_metrics")
            .select(selectCols)
            .order("period_end", { ascending: true })
            .range(from, to);
          if (error) throw error;
          return (data ?? []) as unknown as RawRow[];
        }),
      );

      return { rows: [...firstRows, ...pages.flat()].map(normalize), error: null };
    } catch (error) {
      return { rows: [] as MetricRow[], error };
    }
  };

  try {
    const withBid = await fetchWithSelect(SELECT_COLS_WITH_CURRENT_BID);
    if (!withBid.error) return finishRows(withBid.rows);

    if (isMissingCurrentBidColumnError(withBid.error)) {
      console.warn("[data] current_bid column is not available yet; loading rows without bid data.");
      const legacy = await fetchWithSelect(SELECT_COLS_LEGACY);
      if (!legacy.error) return finishRows(legacy.rows);
      console.error("[data] fetchRows error:", (legacy.error as Error).message);
      return [];
    }

    console.error("[data] fetchRows error:", (withBid.error as Error).message);
    return [];
  } catch (error) {
    console.error("[data] fetchRows error:", (error as Error).message);
    return [];
  }
}

const DEFAULT_DAILY_BUDGET = 40000;

async function fetchDailyBudget(): Promise<number> {
  if (!canReadDashboardData()) return DEFAULT_DAILY_BUDGET;
  const supabase = createAdminClient();
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
  key: string;
  start: string;
  end: string;
}

export interface DashboardData {
  configured: boolean;
  hasData: boolean;
  rows: MetricRow[];
  periods: PeriodOption[];
  dailyBudget: number;
}

const periodKey = (r: MetricRow) => r.period_start + "~" + r.period_end;
const DASHBOARD_CACHE_TTL_MS = 60_000;
let dashboardCache: { expiresAt: number; data: DashboardData } | null = null;
let dashboardCachePromise: Promise<DashboardData> | null = null;

export function clearDashboardDataCache() {
  dashboardCache = null;
  dashboardCachePromise = null;
}

async function loadDashboardData(): Promise<DashboardData> {
  const configured = isSupabaseConfigured();
  const [rows, dailyBudget] = await Promise.all([
    fetchRows(),
    fetchDailyBudget(),
  ]);

  const periodKeys = [...new Set(rows.map(periodKey))].sort((a, b) => {
    const [as, ae] = a.split("~");
    const [bs, be] = b.split("~");
    return ae === be ? as.localeCompare(bs) : ae.localeCompare(be);
  });
  const periods: PeriodOption[] = periodKeys.map((key) => {
    const [start, end] = key.split("~");
    return { key, start, end };
  });

  return {
    configured,
    hasData: rows.length > 0,
    rows,
    periods,
    dailyBudget,
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const now = Date.now();
  if (dashboardCache && dashboardCache.expiresAt > now) {
    return dashboardCache.data;
  }

  if (!dashboardCachePromise) {
    dashboardCachePromise = loadDashboardData().then((data) => {
      dashboardCache = { data, expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS };
      dashboardCachePromise = null;
      return data;
    }).catch((error) => {
      dashboardCachePromise = null;
      throw error;
    });
  }

  return dashboardCachePromise;
}
