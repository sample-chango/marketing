"use client";

import {
  Bar, CartesianGrid, Cell, ComposedChart, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis, usePlotArea, useXAxisScale, useYAxisScale,
} from "recharts";
import { fmtInt, fmtRoas, fmtWon } from "@/lib/metrics";
import type { TrendMode, TrendPoint, TrendSeries } from "@/lib/trend-data";

export type { TrendSeries } from "@/lib/trend-data";

export function compactTrendValue(value: number, isCount = false) {
  if (isCount) return fmtInt(value);
  if (Math.abs(value) >= 10000) return `${Number((value / 10000).toFixed(1))}만`;
  return fmtInt(value);
}

// Position totals independently of the final segment, which may be exactly zero.
function TotalLabels({ data, isCount }: { data: TrendPoint[]; isCount: boolean }) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  const plot = usePlotArea();
  if (!xScale || !yScale || !plot || data.length > 14 || plot.width / data.length < 32) return null;
  return (
    <g className="trend-total-labels" pointerEvents="none">
      {data.map((point) => {
        const x = xScale(point.date, { position: "middle" });
        const y = yScale(point.total);
        return x == null || y == null ? null : (
          <text key={point.date} x={x} y={Math.max(12, y - 8)} textAnchor="middle" fill="#475569" fontSize={11}>
            {compactTrendValue(point.total, isCount)}
          </text>
        );
      })}
    </g>
  );
}

function TrendTooltip({ active, payload, mode, series, valueFmt, metricLabel }: {
  active?: boolean;
  payload?: readonly { payload?: TrendPoint }[];
  mode: TrendMode;
  series: TrendSeries[];
  valueFmt: (value: number) => string;
  metricLabel: string;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const items = mode === "overall"
    ? [
        { name: "매출", value: fmtWon(point.conversionValue), color: "#03C75A" },
        { name: "광고비", value: fmtWon(point.cost), color: "#CBD5E1" },
        { name: "전환", value: `${fmtInt(point.conversions)}개` },
        { name: "ROAS", value: fmtRoas(point.roas) },
      ]
    : [...series].sort((a, b) => Number(point[b.key]) - Number(point[a.key]))
        .map((s) => ({ name: s.name, value: valueFmt(Number(point[s.key])), color: s.color }));
  return (
    <div className="min-w-[190px] rounded-xl border border-slate-100 bg-white p-3 text-xs shadow-lg">
      <p className="mb-2 font-semibold text-slate-700">{point.date.replaceAll("-", ".")}</p>
      {items.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-5 py-1">
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            {item.color && <i className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} />}
            {item.name}
          </span>
          <span className="tabular-nums font-medium text-slate-800">{item.value}</span>
        </div>
      ))}
      {mode === "categories" && (
        <div className="mt-2 flex justify-between gap-5 border-t border-slate-100 pt-2 font-semibold text-slate-800">
          <span>총 {metricLabel}</span><span className="tabular-nums">{valueFmt(point.total)}</span>
        </div>
      )}
    </div>
  );
}

/** KRW bars + revenue line, or additive category bars; both start at actual zero. */
export function TrendChart({ data, series, mode, valueFmt, metricLabel, isCount,
  selectedDate, highlightedKey, onSelectDate }: {
  data: TrendPoint[];
  series: TrendSeries[];
  mode: TrendMode;
  valueFmt: (value: number) => string;
  metricLabel: string;
  isCount: boolean;
  selectedDate: string;
  highlightedKey: string | null;
  onSelectDate: (date: string) => void;
}) {
  const categories = mode === "categories";
  return (
    <div className="h-[380px] w-full min-w-0" role="img"
      aria-label={categories ? `날짜별 총 ${metricLabel}와 카테고리별 기여도 누적 막대그래프` : "광고비 막대와 매출 선을 같은 원화 눈금으로 표시한 전체 성과 그래프"}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={data} margin={{ top: 28, right: 8, bottom: 4, left: 0 }}
          onClick={(state) => {
            const point = data.find((d) => d.date === state.activeLabel);
            if (point) onSelectDate(point.date);
          }}>
          <CartesianGrid stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5).replace("-", ".")} tick={{ fontSize: 11, fill: "#94A3B8" }}
            tickLine={false} axisLine={{ stroke: "#E2E8F0" }} minTickGap={20} />
          <YAxis domain={[0, "auto"]} width={48} tick={{ fontSize: 11, fill: "#94A3B8" }}
            tickLine={false} axisLine={false} allowDecimals={!isCount}
            tickFormatter={(v) => compactTrendValue(Number(v), categories && isCount)} />
          <Tooltip cursor={categories ? { fill: "#F8FAFC" } : { stroke: "#CBD5E1", strokeWidth: 1 }}
            content={<TrendTooltip mode={mode} series={series} valueFmt={valueFmt} metricLabel={metricLabel} />} />
          {categories ? series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} stackId="categories"
              fill={s.color} maxBarSize={46} isAnimationActive={false}>
              {data.map((point) => (
                <Cell key={point.date} fillOpacity={highlightedKey && highlightedKey !== s.key ? 0.2 : point.date === selectedDate ? 1 : 0.82} />
              ))}
            </Bar>
          )) : (
            <>
              <Bar dataKey="cost" name="광고비" fill="#CBD5E1" maxBarSize={32}
                radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Line dataKey="conversionValue" name="매출" type="linear" stroke="#03C75A"
                strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive={false} />
            </>
          )}
          {categories && <TotalLabels data={data} isCount={isCount} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
