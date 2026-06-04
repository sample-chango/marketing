import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const DEFAULT_DAILY_BUDGET = 40000;

/** 일 예산 조회 */
export async function GET() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return NextResponse.json({ dailyBudget: DEFAULT_DAILY_BUDGET });
  }
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "daily_budget")
    .maybeSingle();
  const n = data ? Number(data.value) : NaN;
  return NextResponse.json({
    dailyBudget: Number.isFinite(n) ? n : DEFAULT_DAILY_BUDGET,
  });
}

/** 일 예산 저장 */
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

  let body: { dailyBudget?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  const amount = Number(body.dailyBudget);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json(
      { error: "일 예산은 0 이상의 숫자여야 합니다." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("settings")
    .upsert(
      { key: "daily_budget", value: String(amount), updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) {
    return NextResponse.json(
      { error: "예산 저장 실패: " + error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, dailyBudget: amount });
}
