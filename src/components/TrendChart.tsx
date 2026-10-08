"use client";

import {
  AreaChart,
  Area,
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

/** 기간 내 일자별 추이 (평균값이 낮은 시리즈부터 쌓는 영역 차트) */
export function TrendChart({
  data,
  series,
  valueFmt,
}: {
  data: Record<string, number | string>[];
  series: TrendSeries[];
  valueFmt: (n: number) => string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[480px] items-center justify-center text-sm text-slate-300">
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

  return (
    <div className="h-[480px] w-full min-w-0 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <YAxis
            width={56}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => valueFmt(Number(v))}
          />
          <Tooltip
            formatter={(v, name) => [valueFmt(Number(v)), name as string]}
            itemSorter={(item) => -Number(item.value)}
            labelStyle={{ color: "#475569" }}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          {multi && <Legend itemSorter={null} wrapperStyle={{ fontSize: 11 }} />}
          {sortedSeries.map((s) => (
            <Area
              key={s.key}
              type="linear"
              dataKey={s.key}
              name={s.name}
              legendType="square"
              stackId="trend"
              stroke={s.color}
              strokeWidth={1.5}
              fill={s.color}
              fillOpacity={0.2}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
