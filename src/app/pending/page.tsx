import Link from "next/link";

export default function PendingPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-5 rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-slate-900">승인 대기 중</h1>
          <p className="text-sm leading-6 text-slate-600">
            가입 신청은 접수됐지만 아직 관리자가 승인하지 않았습니다. 승인 후 사이트를 이용할 수 있습니다.
          </p>
        </div>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            다른 계정으로 로그인
          </button>
        </form>

        <p className="text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-slate-900 underline-offset-4 hover:underline">
            로그인 화면으로 이동
          </Link>
        </p>
      </div>
    </div>
  );
}
