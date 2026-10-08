"use client";

import { useEffect, useRef, useState } from "react";
import type { CategorySlice } from "@/components/CategoryBars";

const CHART_HEIGHT = 246;

function point(cx: number, cy: number, radius: number, angle: number) {
  // Keep SVG attributes identical across server and browser math engines.
  return `${(cx + Math.sin(angle) * radius).toFixed(3)},${(cy - Math.cos(angle) * radius).toFixed(3)}`;
}

function donutPath(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  start: number,
  end: number,
) {
  // A complete circle needs two arcs; one arc with coincident endpoints is empty.
  if (end - start >= Math.PI * 2 - 1e-6) {
    return `M${cx},${cy - outer} A${outer},${outer} 0 1 1 ${cx},${cy + outer} A${outer},${outer} 0 1 1 ${cx},${cy - outer} Z M${cx},${cy - inner} A${inner},${inner} 0 1 0 ${cx},${cy + inner} A${inner},${inner} 0 1 0 ${cx},${cy - inner} Z`;
  }
  const largeArc = end - start > Math.PI ? 1 : 0;
  return `M${point(cx, cy, outer, start)} A${outer},${outer} 0 ${largeArc} 1 ${point(cx, cy, outer, end)} L${point(cx, cy, inner, end)} A${inner},${inner} 0 ${largeArc} 0 ${point(cx, cy, inner, start)} Z`;
}

/** Actual category shares, with the largest category highlighted by default. */
export function CategoryDonut({
  title,
  slices,
  valueFormatter = (value) => value.toLocaleString("ko-KR"),
}: {
  title: string;
  slices: CategorySlice[];
  valueFormatter?: (value: number) => string;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(280);
  const [pinnedLabel, setPinnedLabel] = useState<string | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const data = [...slices].sort((a, b) => b.value - a.value);
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  const selectedLabel = hoveredLabel ?? pinnedLabel;
  const selected = total > 0
    ? data.find((slice) => slice.label === selectedLabel) ?? data[0]
    : undefined;
  const cx = width / 2;
  const cy = CHART_HEIGHT / 2;
  const radius = Math.max(40, Math.min(94, width / 2 - 24));
  const inner = Math.max(30, radius - 45);
  const segments = data.map((slice, index) => {
    const start = total > 0
      ? data.slice(0, index).reduce((sum, previous) => sum + previous.value, 0) / total * Math.PI * 2
      : 0;
    const share = total > 0 ? slice.value / total : 0;
    return { ...slice, start, end: start + share * Math.PI * 2, share };
  });
  const selectedSegment = segments.find((slice) => slice.label === selected?.label);
  const middle = selectedSegment && selectedSegment.share > 0
    ? (selectedSegment.start + selectedSegment.end) / 2
    : Math.PI / 4;
  const bubbleX = Math.max(39, Math.min(width - 39, cx + Math.sin(middle) * (radius + 1)));
  const bubbleY = Math.max(39, Math.min(CHART_HEIGHT - 39, cy - Math.cos(middle) * (radius + 1)));

  return (
    <div data-category-donut={title}>
      <div ref={chartRef} className="relative mx-auto my-3 h-[246px] w-full max-w-[320px]">
        <svg
          className="block h-full w-full overflow-visible"
          viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
          role="img"
          aria-label={`${title} 항목별 비중`}
        >
          <title>{`${title} 항목별 비중`}</title>
          <desc>
            {segments.map((slice) => `${slice.label} ${valueFormatter(slice.value)}, ${(slice.share * 100).toFixed(1)}%`).join("; ")}
          </desc>
          {total > 0 ? segments.filter((slice) => slice.share > 0).map((slice) => (
            <path
              key={slice.label}
              data-category={slice.label}
              data-active={slice.label === selected?.label}
              d={donutPath(cx, cy, inner, radius + (slice.label === selected?.label ? 11 : 0), slice.start, slice.end)}
              fill={slice.color}
              fillRule="evenodd"
              opacity={slice.label === selected?.label ? 1 : 0.5}
              className="cursor-pointer transition-[d,opacity] duration-150 motion-reduce:transition-none"
              onPointerEnter={() => setHoveredLabel(slice.label)}
              onPointerLeave={() => setHoveredLabel(null)}
              onClick={() => setPinnedLabel(slice.label)}
            />
          )) : (
            <>
              <circle cx={cx} cy={cy} r={(radius + inner) / 2} fill="none" stroke="#EDF1F6" strokeWidth={radius - inner} />
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="fill-slate-400 text-xs">
                데이터 없음
              </text>
            </>
          )}
        </svg>
        {selected && (
          <div
            className="pointer-events-none absolute flex h-[74px] w-[74px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-full bg-white shadow-[0_5px_22px_rgba(34,52,75,0.08)]"
            style={{ left: Number(bubbleX.toFixed(3)), top: Number(bubbleY.toFixed(3)) }}
            data-donut-selection={selected.label}
          >
            <span className="max-w-[70px] text-center text-[11px] leading-tight text-slate-700">{selected.label}</span>
            <span className="text-xl font-bold tabular-nums" style={{ color: selected.color }}>
              {((selected.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      <div className="space-y-0.5 border-t border-slate-100 pt-3" role="group" aria-label={`${title} 항목 선택`}>
        {segments.map((slice) => {
          const active = slice.label === selected?.label;
          return (
            <button
              key={slice.label}
              type="button"
              disabled={total <= 0}
              aria-label={`${slice.label}, ${valueFormatter(slice.value)}, ${(slice.share * 100).toFixed(1)}%`}
              aria-pressed={active}
              data-category={slice.label}
              className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 [@media(pointer:coarse)]:min-h-11 ${
                active ? "bg-[#F5F7FA] font-semibold text-slate-900" : "text-slate-600"
              }`}
              onPointerEnter={() => setHoveredLabel(slice.label)}
              onPointerLeave={() => setHoveredLabel(null)}
              onFocus={() => setHoveredLabel(slice.label)}
              onBlur={() => setHoveredLabel(null)}
              onClick={() => setPinnedLabel(slice.label)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden="true" />
                <span className="truncate" title={slice.label}>{slice.label}</span>
              </span>
              <span className="shrink-0 text-right font-semibold tabular-nums">{valueFormatter(slice.value)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
