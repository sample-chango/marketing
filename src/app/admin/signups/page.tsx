import { redirect } from "next/navigation";
import { getApprovalStatus, isAdminUser } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PendingUser = {
  id: string;
  email: string | null;
  requestedAt: string | null;
  createdAt: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export default async function AdminSignupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminUser(user)) {
    redirect("/");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw new Error(error.message);
  }

  const pendingUsers: PendingUser[] = (data.users ?? [])
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

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">가입 승인</h1>
          <p className="mt-1 text-sm text-slate-500">가입 신청자를 확인하고 사이트 이용 권한을 승인합니다.</p>
        </div>
        <div className="text-sm text-slate-500">대기 {pendingUsers.length}명</div>
      </div>

      {pendingUsers.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          승인 대기 중인 가입 신청이 없습니다.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">이메일</th>
                <th className="px-4 py-3">신청 시간</th>
                <th className="px-4 py-3 text-right">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingUsers.map((pendingUser) => (
                <tr key={pendingUser.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {pendingUser.email ?? "이메일 없음"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDate(pendingUser.requestedAt ?? pendingUser.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <form action="/api/admin/signups" method="post">
                        <input type="hidden" name="userId" value={pendingUser.id} />
                        <input type="hidden" name="action" value="reject" />
                        <button
                          type="submit"
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          거절
                        </button>
                      </form>
                      <form action="/api/admin/signups" method="post">
                        <input type="hidden" name="userId" value={pendingUser.id} />
                        <input type="hidden" name="action" value="approve" />
                        <button
                          type="submit"
                          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700"
                        >
                          승인
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
