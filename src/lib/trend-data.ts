import { CATEGORIES, CATEGORY_COLORS } from "./categories";
import { deriveMetrics, sumTotals } from "./metrics";
import type { DerivedMetrics } from "./metrics";
import type { MetricRow } from "./data";

export type TrendMetric = "conversionValue" | "cost" | "conversions";
export type TrendMode = "overall" | "categories";
export interface TrendSeries {
  key: string;
  name: string;
  color: string;
  total: number;
}
export interface TrendPoint {
  [key: string]: number | string;
  date: string;
  label: string;
  cost: number;
  conversionValue: number;
  conversions: number;
  roas: number;
  total: number;
}

/** Aggregate each saved date once; category segments always add up to its total. */
export function buildTrendData(rows: MetricRow[], dates: string[], metric: TrendMetric) {
  const known = new Set<string>(CATEGORIES.map((c) => c.slug));
  const groups: { slug: string; key: string; name: string; color: string }[] = CATEGORIES.map((c) => ({
    slug: c.slug,
    key: `category_${c.slug}`,
    name: c.label as string,
    color: CATEGORY_COLORS[c.slug],
  }));
  if (rows.some((row) => !known.has(row.category))) {
    groups.push({ slug: "other", key: "category_other", name: "기타", color: "#94a3b8" });
  }
  const bucket = new Map<string, MetricRow[]>();
  for (const row of rows) {
    const day = bucket.get(row.period_end) ?? [];
    day.push(row);
    bucket.set(row.period_end, day);
  }
  const data: TrendPoint[] = dates.map((date) => {
    const dayRows = bucket.get(date) ?? [];
    const metrics = deriveMetrics(sumTotals(dayRows));
    const point: TrendPoint = {
      date,
      label: date.slice(5).replace("-", "."),
      cost: metrics.cost,
      conversionValue: metrics.conversionValue,
      conversions: metrics.conversions,
      roas: metrics.roas,
      total: 0,
    };
    for (const group of groups) {
      const value = sumTotals(dayRows.filter((row) =>
        group.slug === "other" ? !known.has(row.category) : row.category === group.slug,
      ))[metric];
      point[group.key] = value;
      point.total += value;
    }
    return point;
  });
  const series: TrendSeries[] = groups.map((group) => ({
    key: group.key,
    name: group.name,
    color: group.color,
    total: data.reduce((sum, point) => sum + Number(point[group.key]), 0),
  })).sort((a, b) => b.total - a.total);
  const period: DerivedMetrics = deriveMetrics(sumTotals(dates.flatMap((date) => bucket.get(date) ?? [])));
  return { data, series, period };
}
