import Link from "next/link";
import { getDashboardData } from "@/lib/data";
import { MetricCard } from "@/components/MetricCard";
import {
  fmtInt,
  fmtWon,
  fmtPct,
  fmtRoas,
  fmtQuality,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();
  const m = data.overall;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">종합 대시보드</h1>
        <p className="text-sm text-slate-500">전체 제품 광고 성과 종합 지수</p>
      </header>

      {!data.configured && (
        <Banner tone="amber">
          Supabase 환경변수가 설정되지 않았습니다. <code>.env.local</code>에
          연결 정보를 입력하세요.
        </Banner>
      )}
      {data.configured && !data.hasData && (
        <Banner tone="blue">
          아직 데이터가 없습니다. 네이버 보고서를{" "}
          <Link href="/upload" className="font-semibold underline">
            업로드
          </Link>
          하면 지표가 표시됩니다.
        </Banner>
      )}

      {/* 종합 지수 */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
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

      {/* 카테고리별 요약 테이블 */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">카테고리별 성과</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-right">
                <th className="px-4 py-3 text-left font-medium">카테고리</th>
                <th className="px-4 py-3 font-medium">노출수</th>
                <th className="px-4 py-3 font-medium">CTR</th>
                <th className="px-4 py-3 font-medium">CPC</th>
                <th className="px-4 py-3 font-medium">CVR</th>
                <th className="px-4 py-3 font-medium">CPA</th>
                <th className="px-4 py-3 font-medium">ROAS</th>
                <th className="px-4 py-3 font-medium">품질지수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.byCategory.map((c) => (
                <tr key={c.slug} className="text-right hover:bg-slate-50">
                  <td className="px-4 py-3 text-left">
                    <Link
                      href={`/category/${c.slug}`}
                      className="font-medium text-emerald-700 hover:underline"
                    >
                      {c.label}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{fmtInt(c.metrics.impressions)}</td>
                  <td className="px-4 py-3">{fmtPct(c.metrics.ctr)}</td>
                  <td className="px-4 py-3">{fmtWon(c.metrics.cpc)}</td>
                  <td className="px-4 py-3">{fmtPct(c.metrics.cvr)}</td>
                  <td className="px-4 py-3">{fmtWon(c.metrics.cpa)}</td>
                  <td className="px-4 py-3">{fmtRoas(c.metrics.roas)}</td>
                  <td className="px-4 py-3">
                    {fmtQuality(c.metrics.qualityScore)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
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
    <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}
