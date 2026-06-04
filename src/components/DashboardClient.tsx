"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  type CategorySlug,
} from "@/lib/categories";
import { FUNNEL_STAGES, deriveRow, type FunnelStage } from "@/lib/funnel";
import { fmtInt, fmtWon, fmtPct, fmtRoas, type DerivedMetrics } from "@/lib/metrics";
import { CategoryDonut } from "@/components/CategoryDonut";
import type { DashboardData } from "@/lib/data";

type Filter = CategorySlug | "all";

const fmtDate = (iso: string) => iso.replaceAll("-", ".");

const SORT_KEY: Record<
  FunnelStage["key"],
  (r: { impressions: number; clicks: number; conversions: number; conversionValue: number }) => number
> = {
  awareness: (r) => r.impressions,
  acquisition: (r) => r.clicks,
  conversion: (r) => r.conversions,
  revenue: (r) => r.conversionValue,
};

/** 전주대비(직전 일자 대비) 증감 표시 */
function WoW({
  curr,
  prev,
  goodWhenUp = true,
}: {
  curr: number;
  prev: number | null;
  goodWhenUp?: boolean;
}) {
  if (prev == null || prev <= 0) {
    return (
      <span className="text-[11px] font-normal text-slate-400">
        전주대비 <span className="text-slate-300">—</span>
      </span>
    );
  }
  const delta = (curr - prev) / prev;
  const up = curr >= prev;
  const good = up === goodWhenUp;
  return (
    <span className="text-[11px] font-normal text-slate-400">
      전주대비{" "}
      <span className={good ? "text-emerald-600" : "text-red-500"}>
        {up ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(1)}%
      </span>
    </span>
  );
}

export function DashboardClient({ data }: { data: DashboardData }) {
  const [cat, setCat] = useState<Filter>("all");
  const [stageKey, setStageKey] = useState<FunnelStage["key"]>("awareness");

  const o = data.overall;
  const p = data.prevOverall;

  // 퍼널·테이블은 선택 카테고리 기준
  const current: DerivedMetrics =
    cat === "all"
      ? o
      : data.byCategory.find((c) => c.slug === cat)?.metrics ?? o;
  const rows =
    cat === "all" ? data.rows : data.rows.filter((r) => r.category === cat);

  const stage = FUNNEL_STAGES.find((s) => s.key === stageKey)!;
  const sortedRows = [...rows]
    .sort((a, b) => SORT_KEY[stageKey](b) - SORT_KEY[stageKey](a))
    .slice(0, 100);

  const slicesOf = (pick: (m: DerivedMetrics) => number) =>
    data.byCategory.map((c) => ({
      label: c.label,
      value: pick(c.metrics),
      color: CATEGORY_COLORS[c.slug],
    }));

  const periodText = data.period
    ? data.period.start === data.period.end
      ? fmtDate(data.period.start)
      : `${fmtDate(data.period.start)} - ${fmtDate(data.period.end)}`
    : "기간 없음";

  const execRate = data.totalBudget > 0 ? o.cost / data.totalBudget : null;

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">네이버 광고 애널라이저</h1>
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
            {periodText}
          </span>
          <Link
            href="/budget"
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            예산 설정
          </Link>
          <Link
            href="/upload"
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            데이터 업로드
          </Link>
        </div>
      </header>

      {!data.configured && (
        <Banner tone="amber">Supabase 환경변수가 설정되지 않았습니다.</Banner>
      )}
      {data.configured && !data.hasData && (
        <Banner tone="blue">
          데이터가 없습니다. 우측 상단 <b>데이터 업로드</b>에서 네이버 보고서를
          올리세요.
        </Banner>
      )}

      {/* 상단 카드: ROAS / 예산 (전체 기준) */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">ROAS</span>
            <WoW curr={o.roas} prev={p?.roas ?? null} />
          </div>
          <div className="mt-2 text-4xl font-bold text-slate-900">
            {fmtRoas(o.roas)}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">예산</span>
            <Link href="/budget" className="text-[11px] text-emerald-600 hover:underline">
              설정
            </Link>
          </div>
          {data.totalBudget > 0 ? (
            <>
              <div className="mt-2 text-4xl font-bold text-slate-900">
                {fmtWon(data.totalBudget)}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                집행 {fmtWon(o.cost)} · 집행률{" "}
                <span
                  className={
                    execRate && execRate > 1
                      ? "font-semibold text-red-500"
                      : "font-semibold text-emerald-600"
                  }
                >
                  {execRate != null ? fmtPct(execRate) : "-"}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="mt-2 text-2xl font-bold text-slate-300">
                미설정
              </div>
              <Link
                href="/budget"
                className="mt-1 inline-block text-xs text-emerald-600 hover:underline"
              >
                예산 입력하기 →
              </Link>
            </>
          )}
        </div>
      </div>

      {/* 도넛 카드 3개 (전체 기준) */}
      <div className="grid gap-5 md:grid-cols-3">
        <DonutCard
          title="총 전환건수"
          value={`${fmtInt(o.conversions)}개`}
          wow={<WoW curr={o.conversions} prev={p?.conversions ?? null} />}
          slices={slicesOf((m) => m.conversions)}
        />
        <DonutCard
          title="총매출액"
          value={fmtWon(o.conversionValue)}
          wow={<WoW curr={o.conversionValue} prev={p?.conversionValue ?? null} />}
          slices={slicesOf((m) => m.conversionValue)}
        />
        <DonutCard
          title="총광고비"
          value={fmtWon(o.cost)}
          wow={<WoW curr={o.cost} prev={p?.cost ?? null} goodWhenUp={false} />}
          slices={slicesOf((m) => m.cost)}
        />
      </div>

      {/* 카테고리 탭 + 퍼널 + 상세테이블 */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap gap-2">
          <Tab active={cat === "all"} onClick={() => setCat("all")}>
            전체
          </Tab>
          {CATEGORIES.map((c) => (
            <Tab
              key={c.slug}
              active={cat === c.slug}
              onClick={() => setCat(c.slug)}
            >
              {c.label}
            </Tab>
          ))}
        </div>

        {/* 퍼널 (클릭 가능) */}
        <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
          {FUNNEL_STAGES.map((s, i) => {
            const selected = s.key === stageKey;
            return (
              <Fragment key={s.key}>
                <button
                  onClick={() => setStageKey(s.key)}
                  className={`min-w-[150px] flex-1 overflow-hidden rounded-xl border text-left transition ${
                    selected
                      ? "border-emerald-500 ring-2 ring-emerald-200"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div
                    className={`px-4 py-2 text-center text-sm font-semibold text-white ${
                      selected ? "bg-emerald-600" : "bg-slate-400"
                    }`}
                  >
                    {s.label}
                  </div>
                  <div
                    className={`space-y-2 px-4 py-4 ${
                      selected ? "bg-emerald-50" : "bg-slate-50"
                    }`}
                  >
                    {s.metrics.map((m) => (
                      <div key={m.label} className="text-center">
                        <div className="text-xs text-slate-500">{m.label}</div>
                        <div className="font-bold text-slate-800">
                          {m.value(current)}
                        </div>
                      </div>
                    ))}
                  </div>
                </button>
                {i < FUNNEL_STAGES.length - 1 && (
                  <div className="flex items-center text-lg text-slate-300">▶</div>
                )}
              </Fragment>
            );
          })}
        </div>

        {/* 상세테이블 */}
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-slate-800">
            상세테이블
            <span className="ml-2 text-sm font-normal text-slate-400">
              {stage.label} ·{" "}
              {cat === "all"
                ? "전체"
                : CATEGORIES.find((c) => c.slug === cat)?.label}
            </span>
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">상품명</th>
                  {cat === "all" && (
                    <th className="px-3 py-2.5 text-left font-medium">카테고리</th>
                  )}
                  {stage.columns.map((col) => (
                    <th
                      key={col.label}
                      className="px-3 py-2.5 text-right font-medium"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2 + stage.columns.length}
                      className="px-3 py-10 text-center text-slate-400"
                    >
                      데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((r, idx) => {
                    const dm = deriveRow(r);
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="max-w-[420px] truncate px-3 py-2.5 text-slate-700">
                          {r.keyword ?? r.ad_group ?? r.campaign ?? "-"}
                        </td>
                        {cat === "all" && (
                          <td className="px-3 py-2.5">
                            <CategoryBadge slug={r.category} />
                          </td>
                        )}
                        {stage.columns.map((col) => (
                          <td
                            key={col.label}
                            className="px-3 py-2.5 text-right tabular-nums text-slate-800"
                          >
                            {col.value(dm)}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- 하위 컴포넌트 ---------- */

function DonutCard({
  title,
  value,
  wow,
  slices,
}: {
  title: string;
  value: string;
  wow: React.ReactNode;
  slices: { label: string; value: number; color: string }[];
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-slate-500">{title}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
        </div>
        {wow}
      </div>
      <div className="mt-3">
        <CategoryDonut slices={slices} />
      </div>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-slate-700 text-white"
          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function CategoryBadge({ slug }: { slug: string }) {
  const label = CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
  const color = CATEGORY_COLORS[slug] ?? "#94a3b8";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "amber" | "blue";
  children: React.ReactNode;
}) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}
