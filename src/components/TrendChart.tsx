"use client";

import {
  LineChart,
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

/** 기간 내 일자별 추이 (단일/다중 시리즈) */
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
      <div className="flex h-[260px] items-center justify-center text-sm text-slate-300">
        데이터 없음
      </div>
    );
  }

  const multi = series.length > 1;

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 4 }}>
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
          {multi && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2.2}
              dot={{ r: 2.5, fill: s.color }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
