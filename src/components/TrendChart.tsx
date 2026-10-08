"use client";

import { useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export interface TrendSeries {
  key: string;
  name: string;
  color: string;
}

function TrendLegend({
  series,
  hiddenKeys,
  onToggle,
  onHighlight,
}: {
  series: TrendSeries[];
  hiddenKeys: Set<string>;
  onToggle: (key: string) => void;
  onHighlight: (key: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 pt-2">
      {series.map((s) => {
        const hidden = hiddenKeys.has(s.key);
        return (
          <button
            key={s.key}
            type="button"
            aria-pressed={!hidden}
            title={`${s.name} ${hidden ? "표시" : "숨기기"}`}
            onClick={() => onToggle(s.key)}
            onMouseEnter={() => onHighlight(hidden ? null : s.key)}
            onMouseLeave={() => onHighlight(null)}
            onFocus={() => onHighlight(hidden ? null : s.key)}
            onBlur={() => onHighlight(null)}
            className={`inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
              hidden ? "text-slate-400 line-through" : "text-slate-600"
            }`}
          >
            <span
              aria-hidden="true"
              className="h-px w-4"
              style={{ backgroundColor: hidden ? "#cbd5e1" : s.color }}
            />
            {s.name}
          </button>
        );
      })}
    </div>
  );
}

/** 기간 내 일자별 추이 (각 시리즈의 실제 값을 0 기준으로 표시) */
export function TrendChart({
  data,
  series,
  valueFmt,
}: {
  data: Record<string, number | string>[];
  series: TrendSeries[];
  valueFmt: (n: number) => string;
}) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set());
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-[380px] items-center justify-center text-sm text-slate-300">
        데이터 없음
      </div>
    );
  }

  const multi = series.length > 1;
  const sortedSeries = series
    .map((s) => ({
      ...s,
      average:
        data.reduce((sum, point) => sum + Number(point[s.key] ?? 0), 0) /
        data.length,
    }))
    .sort((a, b) => a.average - b.average);
  const visibleSeries = sortedSeries.filter((s) => !hiddenKeys.has(s.key));
  const activeKey = visibleSeries.some((s) => s.key === highlightedKey)
    ? highlightedKey
    : null;

  function toggleSeries(key: string) {
    setHiddenKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setHighlightedKey(null);
  }

  return (
    <div className="relative h-[380px] w-full min-w-0 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <YAxis
            domain={[0, "auto"]}
            width={56}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => valueFmt(Number(v))}
          />
          <Tooltip
            cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
            includeHidden={false}
            formatter={(v, name) => [valueFmt(Number(v)), name as string]}
            itemSorter={(item) => -Number(item.value)}
            labelStyle={{ color: "#475569" }}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          {multi && (
            <Legend
              content={
                <TrendLegend
                  series={sortedSeries}
                  hiddenKeys={hiddenKeys}
                  onToggle={toggleSeries}
                  onHighlight={setHighlightedKey}
                />
              }
            />
          )}
          {multi
            ? sortedSeries.map((s) => (
                <Line
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  name={s.name}
                  hide={hiddenKeys.has(s.key)}
                  stroke={s.color}
                  strokeWidth={1}
                  strokeOpacity={activeKey && activeKey !== s.key ? 0.15 : 1}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              ))
            : sortedSeries.map((s) => (
                <Area
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  name={s.name}
                  baseValue={0}
                  stroke={s.color}
                  strokeWidth={1}
                  fill={s.color}
                  fillOpacity={0.2}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              ))}
        </ComposedChart>
      </ResponsiveContainer>
      {multi && visibleSeries.length === 0 && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center pb-10 text-sm text-slate-400">
          범례를 선택해 항목을 표시하세요.
        </p>
      )}
    </div>
  );
}
