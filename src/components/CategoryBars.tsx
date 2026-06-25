"use client";

export interface CategorySlice {
  label: string;
  value: number;
  color: string;
}

/** 카테고리 비중 막대그래프 */
export function CategoryBars({
  slices,
  valueFormatter,
  showPercent = false,
  onToggleDisplay,
}: {
  slices: CategorySlice[];
  valueFormatter?: (value: number) => string;
  showPercent?: boolean;
  onToggleDisplay?: () => void;
}) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  const data = [...slices].sort((a, b) => b.value - a.value);
  const canToggleValue = Boolean(valueFormatter && onToggleDisplay);

  if (data.length === 0) {
    return (
      <div className="flex min-h-[180px] items-center justify-center text-sm text-slate-300">
        데이터 없음
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2" data-category-bars="true">
      {data.map((d, index) => {
        const pct = total > 0 ? (d.value / total) * 100 : 0;
        const width = pct > 0 ? Math.max(4, pct) : 0;
        const isPrimary = index === 0;
        const metricText =
          canToggleValue && !showPercent && valueFormatter
            ? valueFormatter(d.value)
            : `${pct.toFixed(0)}%`;
        return (
          <div key={d.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="flex min-w-0 items-center gap-2 font-medium text-slate-600">
                <span
                  className={`inline-block rounded-full ${
                    isPrimary ? "h-2.5 w-2.5" : "h-2 w-2"
                  }`}
                  style={{ backgroundColor: d.color }}
                />
                <span className="truncate">{d.label}</span>
              </span>
              {canToggleValue ? (
                <button
                  type="button"
                  onClick={onToggleDisplay}
                  aria-label={`${d.label} 표시 전환`}
                  aria-pressed={showPercent}
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-right tabular-nums transition hover:bg-[#EEF2F6] ${
                    isPrimary
                      ? "font-bold text-slate-900"
                      : "font-semibold text-slate-600"
                  }`}
                >
                  {metricText}
                </button>
              ) : (
                <span
                  className={`tabular-nums ${
                    isPrimary
                      ? "font-bold text-slate-900"
                      : "font-semibold text-slate-500"
                  }`}
                >
                  {pct.toFixed(0)}%
                </span>
              )}
            </div>
            <div
              className={`overflow-hidden rounded-full bg-[#EDF1F6] ${
                isPrimary ? "h-3" : "h-2.5"
              }`}
            >
              <div
                className="h-full rounded-full shadow-[0_4px_10px_rgba(66,80,102,0.08)]"
                style={{
                  width: `${width}%`,
                  background: `linear-gradient(90deg, ${d.color}, color-mix(in srgb, ${d.color} 72%, white))`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
