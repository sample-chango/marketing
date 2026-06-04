import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCategorySlug } from "@/lib/categories";

export const runtime = "nodejs";

function guard() {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** 한 기간의 행 목록 (수정용, id 포함) */
export async function GET(req: Request) {
  if (!guard()) return NextResponse.json({ rows: [] });
  const url = new URL(req.url);
  const start = url.searchParams.get("start") ?? "";
  const end = url.searchParams.get("end") ?? "";
  if (!isDate(start) || !isDate(end)) {
    return NextResponse.json({ error: "기간 형식 오류" }, { status: 400 });
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ad_metrics")
    .select(
      "id,category,keyword,impressions,clicks,cost,conversions,conversion_value,quality_score",
    )
    .eq("period_start", start)
    .eq("period_end", end)
    .order("cost", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rows: data ?? [] });
}

/** 행 1건 수정 */
export async function PATCH(req: Request) {
  if (!guard())
    return NextResponse.json({ error: "환경변수 미설정" }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "본문 오류" }, { status: 400 });
  }
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "id 누락" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.keyword === "string") patch.keyword = body.keyword;
  if (typeof body.category === "string") {
    if (!isCategorySlug(body.category))
      return NextResponse.json({ error: "카테고리 오류" }, { status: 400 });
    patch.category = body.category;
  }
  const numFields: [string, string][] = [
    ["impressions", "impressions"],
    ["clicks", "clicks"],
    ["cost", "cost"],
    ["conversions", "conversions"],
    ["conversionValue", "conversion_value"],
  ];
  for (const [from, col] of numFields) {
    if (body[from] != null && body[from] !== "") {
      const n = Number(body[from]);
      if (Number.isFinite(n) && n >= 0) patch[col] = n;
    }
  }
  if (body.qualityScore === null || body.qualityScore === "") {
    patch.quality_score = null;
  } else if (body.qualityScore != null) {
    const q = Math.round(Number(body.qualityScore));
    patch.quality_score = q >= 1 && q <= 10 ? q : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "변경 내용 없음" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("ad_metrics").update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** 행 1건 삭제 */
export async function DELETE(req: Request) {
  if (!guard())
    return NextResponse.json({ error: "환경변수 미설정" }, { status: 503 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "id 누락" }, { status: 400 });
  const supabase = createAdminClient();
  const { error } = await supabase.from("ad_metrics").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
