import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function guard() {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

interface Row {
  period_start: string | null;
  period_end: string | null;
  report_date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversion_value: number;
}

/** 기간별 데이터 요약 목록 */
export async function GET() {
  if (!guard()) return NextResponse.json({ periods: [] });
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ad_metrics")
    .select(
      "period_start,period_end,report_date,impressions,clicks,cost,conversions,conversion_value",
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const map = new Map<
    string,
    {
      start: string;
      end: string;
      rowCount: number;
      impressions: number;
      clicks: number;
      cost: number;
      conversions: number;
      conversionValue: number;
    }
  >();
  for (const r of (data ?? []) as Row[]) {
    const start = r.period_start ?? r.report_date;
    const end = r.period_end ?? r.report_date;
    const key = `${start}~${end}`;
    const cur =
      map.get(key) ??
      {
        start,
        end,
        rowCount: 0,
        impressions: 0,
        clicks: 0,
        cost: 0,
        conversions: 0,
        conversionValue: 0,
      };
    cur.rowCount += 1;
    cur.impressions += Number(r.impressions) || 0;
    cur.clicks += Number(r.clicks) || 0;
    cur.cost += Number(r.cost) || 0;
    cur.conversions += Number(r.conversions) || 0;
    cur.conversionValue += Number(r.conversion_value) || 0;
    map.set(key, cur);
  }

  const periods = [...map.values()].sort((a, b) =>
    a.end === b.end ? b.start.localeCompare(a.start) : b.end.localeCompare(a.end),
  );
  return NextResponse.json({ periods });
}

/** 한 기간 전체 삭제 */
export async function DELETE(req: Request) {
  if (!guard()) {
    return NextResponse.json({ error: "환경변수 미설정" }, { status: 503 });
  }
  const url = new URL(req.url);
  const start = url.searchParams.get("start") ?? "";
  const end = url.searchParams.get("end") ?? "";
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!isDate(start) || !isDate(end)) {
    return NextResponse.json({ error: "기간 형식 오류" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("ad_metrics")
    .delete()
    .eq("period_start", start)
    .eq("period_end", end);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await supabase
    .from("uploads")
    .delete()
    .eq("period_start", start)
    .eq("period_end", end);

  return NextResponse.json({ ok: true });
}
