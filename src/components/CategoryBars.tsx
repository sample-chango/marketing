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
}: {
  slices: CategorySlice[];
  valueFormatter?: (value: number) => string;
}) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  const data = slices
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  if (total <= 0) {
    return (
      <div className="flex min-h-[180px] items-center justify-center text-sm text-slate-300">
        데이터 없음
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2" data-category-bars="true">
      {data.map((d, index) => {
        const pct = (d.value / total) * 100;
        const width = Math.max(4, pct);
        const isPrimary = index === 0;
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
              {valueFormatter ? (
                <span className="flex shrink-0 items-baseline gap-1 tabular-nums">
                  <span
                    className={
                      isPrimary
                        ? "font-bold text-slate-900"
                        : "font-semibold text-slate-600"
                    }
                  >
                    {valueFormatter(d.value)}
                  </span>
                  <span className="text-slate-300">{pct.toFixed(0)}%</span>
                </span>
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
                className="h-full rounded-full shadow-[0_5px_12px_rgba(66,80,102,0.14)]"
                style={{
                  width: `${width}%`,
                  background: `linear-gradient(90deg, ${d.color}, color-mix(in srgb, ${d.color} 72%, white))`,
                }}
              />
            </div>
          </div>
        );
      })}
      <ul className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[11px] text-slate-400">
        {slices.map((d) => (
          <li key={d.label} className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            {d.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
