import { NextResponse } from "next/server";
import { areSignupRequestsEnabled, getApprovalStatus } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function isSupabaseAdminConfigured() {
  return (
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizePassword(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function findUserByEmail(email: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) throw error;
  return (data.users ?? []).find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  );
}

export async function POST(request: Request) {
  if (!areSignupRequestsEnabled()) {
    return NextResponse.json(
      { error: "현재 가입 신청을 받지 않고 있습니다." },
      { status: 403 },
    );
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Supabase 관리자 설정이 필요합니다." },
      { status: 503 },
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const email = normalizeEmail(body.email);
  const password = normalizePassword(body.password);

  if (!isEmail(email)) {
    return NextResponse.json(
      { error: "이메일 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (password.length < 4) {
    return NextResponse.json(
      { error: "비밀번호는 4자 이상이어야 합니다." },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminClient();
    const requestedAt = new Date().toISOString();
    const existing = await findUserByEmail(email);

    if (existing) {
      const status = getApprovalStatus(existing);
      if (status === "approved" || status === null) {
        return NextResponse.json(
          { error: "이미 가입된 이메일입니다." },
          { status: 409 },
        );
      }

      if (status === "pending") {
        return NextResponse.json({ ok: true, status: "pending" });
      }

      const { error } = await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        app_metadata: {
          ...existing.app_metadata,
          approval_status: "pending",
          requested_at: requestedAt,
        },
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, status: "pending" });
    }

    const { error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        approval_status: "pending",
        requested_at: requestedAt,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: "pending" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "가입 신청 처리에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
