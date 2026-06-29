import { NextResponse } from "next/server";
import { getApprovalStatus, isAdminUser } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function redirectBack(request: Request) {
  return NextResponse.redirect(new URL("/admin/signups", request.url), {
    status: 303,
  });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pendingUsers = (data.users ?? [])
    .filter((candidate) => getApprovalStatus(candidate) === "pending")
    .map((candidate) => ({
      id: candidate.id,
      email: candidate.email ?? null,
      requestedAt:
        typeof candidate.app_metadata?.requested_at === "string"
          ? candidate.app_metadata.requested_at
          : null,
      createdAt: candidate.created_at,
    }))
    .sort((a, b) => {
      const aTime = a.requestedAt ?? a.createdAt;
      const bTime = b.requestedAt ?? b.createdAt;
      return bTime.localeCompare(aTime);
    });

  return NextResponse.json({ pendingUsers });
}
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const formData = await request.formData();
  const userId = String(formData.get("userId") ?? "");
  const action = String(formData.get("action") ?? "");

  if (!userId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json(
      { error: "요청 값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error: getError } = await admin.auth.admin.getUserById(userId);

  if (getError || !data.user) {
    return NextResponse.json(
      { error: getError?.message ?? "사용자를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const approved = action === "approve";
  const { error } = await admin.auth.admin.updateUserById(userId, {
    email_confirm: true,
    app_metadata: {
      ...data.user.app_metadata,
      approval_status: approved ? "approved" : "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.email ?? user.id,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return redirectBack(request);
}
