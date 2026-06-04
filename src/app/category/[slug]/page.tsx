import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryDetail } from "@/lib/data";
import { FunnelView } from "@/components/FunnelView";
import { MetricCard } from "@/components/MetricCard";
import { categoryLabel, isCategorySlug } from "@/lib/categories";
import {
  fmtInt,
  fmtWon,
  fmtPct,
  fmtRoas,
  fmtQuality,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isCategorySlug(slug)) notFound();

  const detail = await getCategoryDetail(slug);
  const m = detail.metrics;
  const label = categoryLabel(slug);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <div className="text-sm text-slate-400">카테고리</div>
        <h1 className="text-2xl font-bold">{label}</h1>
      </header>

      {!detail.hasData && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          이 카테고리에 업로드된 데이터가 없습니다.{" "}
          <Link href="/upload" className="font-semibold underline">
            데이터 업로드
          </Link>
        </div>
      )}

      {/* 요약 지표 */}
      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <MetricCard label="노출수" value={fmtInt(m.impressions)} accent="blue" />
        <MetricCard label="CTR" value={fmtPct(m.ctr)} accent="emerald" />
        <MetricCard label="CPC" value={fmtWon(m.cpc)} accent="amber" />
        <MetricCard label="CVR" value={fmtPct(m.cvr)} accent="emerald" />
        <MetricCard label="CPA" value={fmtWon(m.cpa)} accent="amber" />
        <MetricCard label="ROAS" value={fmtRoas(m.roas)} accent="violet" />
        <MetricCard
          label="품질지수"
          value={fmtQuality(m.qualityScore)}
          accent="slate"
        />
      </section>

      {/* 마케팅 퍼널 */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">마케팅 퍼널</h2>
        <FunnelView metrics={m} />
      </section>

      {/* 세부 행 (캠페인/광고그룹/키워드) */}
      {detail.rows.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">
            세부 항목{" "}
            <span className="text-sm font-normal text-slate-400">
              (광고비 상위)
            </span>
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="text-right">
                  <th className="px-3 py-2 text-left font-medium">
                    캠페인 / 그룹 / 키워드
                  </th>
                  <th className="px-3 py-2 font-medium">노출</th>
                  <th className="px-3 py-2 font-medium">클릭</th>
                  <th className="px-3 py-2 font-medium">광고비</th>
                  <th className="px-3 py-2 font-medium">전환</th>
                  <th className="px-3 py-2 font-medium">매출</th>
                  <th className="px-3 py-2 font-medium">품질</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.rows.slice(0, 100).map((r, i) => (
                  <tr key={i} className="text-right hover:bg-slate-50">
                    <td className="px-3 py-2 text-left">
                      {r.keyword ?? r.ad_group ?? r.campaign ?? "-"}
                      {r.campaign && (r.keyword || r.ad_group) && (
                        <span className="ml-1 text-xs text-slate-400">
                          / {r.campaign}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{fmtInt(r.impressions)}</td>
                    <td className="px-3 py-2">{fmtInt(r.clicks)}</td>
                    <td className="px-3 py-2">{fmtWon(r.cost)}</td>
                    <td className="px-3 py-2">{fmtInt(r.conversions)}</td>
                    <td className="px-3 py-2">{fmtWon(r.conversionValue)}</td>
                    <td className="px-3 py-2">
                      {fmtQuality(r.qualityScore)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
