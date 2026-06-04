import { FUNNEL_STAGES } from "@/lib/funnel";
import type { DerivedMetrics } from "@/lib/metrics";

const STAGE_COLORS = [
  "border-blue-200 bg-blue-50",
  "border-emerald-200 bg-emerald-50",
  "border-amber-200 bg-amber-50",
  "border-violet-200 bg-violet-50",
];

/** AARRR 퍼널(유지·추천 제외) 시각화 */
export function FunnelView({ metrics }: { metrics: DerivedMetrics }) {
  return (
    <div className="space-y-3">
      {FUNNEL_STAGES.map((stage, i) => (
        <div
          key={stage.key}
          className={`rounded-xl border p-4 ${STAGE_COLORS[i % STAGE_COLORS.length]}`}
          style={{
            marginLeft: `${i * 1.5}rem`,
            marginRight: `${i * 0.5}rem`,
          }}
        >
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-base font-bold text-slate-800">
                {i + 1}. {stage.label}
              </span>
              <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">
                {stage.english}
              </span>
            </div>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{stage.description}</p>
          <div className="mt-3 flex flex-wrap gap-6">
            {stage.metrics.map((metric) => (
              <div key={metric.key}>
                <div className="text-xs font-medium text-slate-500">
                  {metric.label}
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {metric.format(metrics)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
