import type { MetricRow } from "@/lib/data";
import { deriveMetrics, sumTotals, type DerivedMetrics } from "@/lib/metrics";

export type FlowStage = "awareness" | "acquisition" | "conversion" | "revenue";

export const FLOW_STAGES: { key: FlowStage; label: string; description: string }[] = [
  { key: "awareness", label: "보여짐", description: "광고가 보여진 횟수" },
  { key: "acquisition", label: "클릭", description: "광고를 눌러본 횟수" },
  { key: "conversion", label: "구매", description: "구매로 이어진 횟수" },
  { key: "revenue", label: "광고비 대비 매출", description: "쓴 비용당 발생한 매출" },
];

export function flowRate(metrics: DerivedMetrics, stage: FlowStage): number | null {
  if (stage === "acquisition") return metrics.impressions > 0 ? metrics.ctr : null;
  if (stage === "conversion") return metrics.clicks > 0 ? metrics.cvr : null;
  if (stage === "revenue") return metrics.cost > 0 ? metrics.roas : null;
  return metrics.impressions;
}

export function flowProductValue(metrics: DerivedMetrics, stage: FlowStage) {
  return stage === "awareness" ? metrics.impressions : stage === "acquisition" ? metrics.clicks
    : stage === "conversion" ? metrics.conversions : metrics.conversionValue;
}

export function shortFlowProductName(name: string) {
  return name.split(/[ㅣ|｜│]/, 1)[0].trim().replace(/^\[샘플창고\]\s*/, "");
}

export function flowComparison(stage: FlowStage, current: DerivedMetrics, previous: DerivedMetrics | null, currentDays: number, previousDays: number) {
  if (!previous || currentDays <= 0 || previousDays <= 0) return null;
  // Counts use daily averages so a partially available prior window is comparable.
  const now = stage === "awareness" ? current.impressions / currentDays : flowRate(current, stage);
  const before = stage === "awareness" ? previous.impressions / previousDays : flowRate(previous, stage);
  if (now == null || before == null) return null;
  const direction = Math.abs(now - before) < 1e-9 ? "same" : now > before ? "up" : "down";
  return { now, before, direction };
}

export function buildFlowData(currentRows: MetricRow[], baseRows: MetricRow[], category: string, stage: FlowStage) {
  const filter = (rows: MetricRow[]) => category === "all" ? rows : rows.filter((row) => row.category === category);
  const rows = filter(currentRows);
  const priorRows = filter(baseRows);
  const grouped = new Map<string, { name: string; category: string; rows: MetricRow[] }>();
  for (const row of rows) {
    const name = row.keyword ?? row.ad_group ?? row.campaign ?? "이름 없는 상품";
    const key = JSON.stringify([row.category, name]);
    const existing = grouped.get(key);
    if (existing) existing.rows.push(row);
    else grouped.set(key, { name, category: row.category, rows: [row] });
  }
  const products = [...grouped.entries()].map(([key, group]) => {
    const metrics = deriveMetrics(sumTotals(group.rows));
    return { key, name: shortFlowProductName(group.name), category: group.category, metrics, value: flowProductValue(metrics, stage) };
  }).filter((product) => product.value > 0).sort((a, b) => b.value - a.value).slice(0, 3);
  return {
    current: deriveMetrics(sumTotals(rows)),
    previous: priorRows.length > 0 ? deriveMetrics(sumTotals(priorRows)) : null,
    products,
  };
}
