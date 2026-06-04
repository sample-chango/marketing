import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCategorySlug } from "@/lib/categories";

export const runtime = "nodejs";

/** 특정 월의 카테고리별 예산 조회 */
export async function GET(req: Request) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return NextResponse.json({ budgets: {} });
  }
  const month = new URL(req.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month 형식 오류" }, { status: 400 });
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("category,amount")
    .eq("month", month);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const budgets: Record<string, number> = {};
  for (const b of (data ?? []) as { category: string; amount: number }[]) {
    budgets[b.category] = Number(b.amount) || 0;
  }
  return NextResponse.json({ budgets });
}

/** 카테고리별 월 예산 저장 (upsert) */
export async function POST(req: Request) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return NextResponse.json(
      { error: "Supabase 환경변수가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  let body: { month?: string; budgets?: Record<string, number> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const month = String(body.month ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month 형식은 YYYY-MM 이어야 합니다." },
      { status: 400 },
    );
  }

  const rows = Object.entries(body.budgets ?? {})
    .filter(([slug]) => isCategorySlug(slug))
    .map(([category, amount]) => ({
      category,
      month,
      amount: Number(amount) || 0,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) {
    return NextResponse.json({ error: "저장할 예산이 없습니다." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("budgets")
    .upsert(rows, { onConflict: "category,month" });
  if (error) {
    return NextResponse.json(
      { error: "예산 저장 실패: " + error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, saved: rows.length, month });
}
