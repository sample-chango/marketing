"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/** 링 안쪽에 퍼센트를 그려 잘리지 않게 하는 라벨 렌더러 */
function renderInsideLabel(props: unknown) {
  const p = props as {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
  };
  if (p.percent < 0.05) return null;
  const r = (p.innerRadius + p.outerRadius) / 2;
  const rad = (-p.midAngle * Math.PI) / 180;
  const x = p.cx + r * Math.cos(rad);
  const y = p.cy + r * Math.sin(rad);
  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      fontSize={11}
      fontWeight={600}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {Math.round(p.percent * 100)}%
    </text>
  );
}

/** 카테고리 비중 도넛 차트 + 범례 */
export function CategoryDonut({ slices }: { slices: DonutSlice[] }) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  const data = slices.filter((d) => d.value > 0);

  if (total <= 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-sm text-slate-300">
        데이터 없음
      </div>
    );
  }

  return (
    <div>
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={68}
              paddingAngle={1}
              labelLine={false}
              label={renderInsideLabel}
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
      <ul className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-[11px] text-slate-500">
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
