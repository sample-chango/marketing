"use client";

import Link from "next/link";
import { useState } from "react";

type SignupResponse = {
  error?: string;
  ok?: boolean;
  status?: "pending";
};

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    const result = (await response.json().catch(() => ({}))) as SignupResponse;

    if (!response.ok) {
      setError(result.error ?? "가입 신청에 실패했습니다.");
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setPassword("");
    setLoading(false);
  }

  if (submitted) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-5 rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-slate-900">가입 신청 완료</h1>
            <p className="text-sm leading-6 text-slate-600">
              관리자 승인 대기 중입니다. 승인 후 같은 이메일과 비밀번호로 로그인할 수 있습니다.
            </p>
          </div>

          <Link
            href="/login"
            className="block w-full rounded-md bg-slate-900 px-3 py-2 text-center text-sm font-medium text-white transition hover:bg-slate-700"
          >
            로그인 화면으로 이동
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-lg border border-slate-200 bg-white p-8 shadow-sm"
      >
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-slate-900">가입 신청</h1>
          <p className="text-sm text-slate-500">이메일과 비밀번호만 입력하면 관리자가 확인합니다.</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            이메일
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={4}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "신청 중..." : "가입 신청"}
        </button>

        <p className="text-center text-sm text-slate-500">
          이미 계정이 있나요?{" "}
          <Link href="/login" className="font-medium text-slate-900 underline-offset-4 hover:underline">
            로그인
          </Link>
        </p>
      </form>
    </div>
  );
}
