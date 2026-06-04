"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/** 카테고리 비중 도넛 차트 + 범례 */
export function CategoryDonut({ slices }: { slices: DonutSlice[] }) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  const data = slices.filter((d) => d.value > 0);

  if (total <= 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-slate-300">
        데이터 없음
      </div>
    );
  }

  return (
    <div>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={1}
              labelLine={false}
              label={(e) => {
                const pct = (e as { percent?: number }).percent ?? 0;
                return pct >= 0.03 ? `${Math.round(pct * 100)}%` : "";
              }}
              stroke="#fff"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.label} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
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
