"use client";

import { useEffect, useState } from "react";

type PendingUser = {
  id: string;
  email: string | null;
  requestedAt: string | null;
  createdAt: string;
};

type SignupsResponse = {
  pendingUsers?: PendingUser[];
  error?: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export function AdminSignupsClient() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPendingUsers() {
      try {
        const response = await fetch("/api/admin/signups", { cache: "no-store" });
        const payload = (await response.json()) as SignupsResponse;
        if (cancelled) return;

        if (!response.ok || payload.error) {
          setError(payload.error ?? "가입 신청 목록을 불러오지 못했습니다.");
          return;
        }

        setPendingUsers(payload.pendingUsers ?? []);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPendingUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">가입 승인</h1>
          <p className="mt-1 text-sm text-slate-500">
            가입 신청자를 확인하고 사이트 이용 권한을 승인합니다.
          </p>
        </div>
        <div className="text-sm text-slate-500">
          {loading ? "확인 중" : `대기 ${pendingUsers.length}명`}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          가입 신청 목록을 불러오는 중입니다.
        </div>
      ) : pendingUsers.length === 0 ? (
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