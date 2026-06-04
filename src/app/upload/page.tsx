"use client";

import { useState } from "react";
import Link from "next/link";
import { categoryLabel } from "@/lib/categories";

interface UploadResult {
  ok?: boolean;
  inserted?: number;
  period?: { start: string; end: string };
  categoryCounts?: Record<string, number>;
  unclassifiedCount?: number;
  unclassified?: string[];
  error?: string;
  warnings?: string[];
  detectedColumns?: Record<string, string>;
}

export default function UploadPage() {
  const [mode, setMode] = useState<"single" | "range">("single");
  const [reportDate, setReportDate] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);
    if (mode === "single") {
      if (reportDate) fd.append("reportDate", reportDate);
    } else {
      fd.append("periodStart", periodStart);
      fd.append("periodEnd", periodEnd);
    }

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      setResult((await res.json()) as UploadResult);
    } catch (err) {
      setResult({ error: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const rangeInvalid =
    mode === "range" && (!periodStart || !periodEnd || periodStart > periodEnd);

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">데이터 업로드</h1>
          <p className="text-sm text-slate-500">
            네이버 소재 목록 보고서를 올리면 카테고리가 자동 분류됩니다.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
        >
          ← 대시보드
        </Link>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            보고서 파일 (.xlsx / .csv)
          </label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-700"
          />
          <p className="mt-1 text-xs text-slate-400">
            전체 데이터를 한 파일로 올리면 행마다 카테고리를 자동 분류합니다.
          </p>
        </div>

        {/* 기간 모드 선택 */}
        <div>
          <div className="mb-2 inline-flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                mode === "single"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              단일 일자
            </button>
            <button
              type="button"
              onClick={() => setMode("range")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                mode === "range"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              기간
            </button>
          </div>

          {mode === "single" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                기준일자{" "}
                <span className="text-xs font-normal text-slate-400">
                  (비우면 파일명의 날짜 자동 인식)
                </span>
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  시작일
                </label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <span className="pb-2.5 text-slate-400">~</span>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  종료일
                </label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!file || busy || rangeInvalid}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "업로드 중…" : "업로드"}
        </button>
        {rangeInvalid && (
          <p className="text-xs text-red-500">
            시작일과 종료일을 올바르게 입력하세요.
          </p>
        )}
      </form>

      {result && (
        <div
          className={`mt-5 rounded-2xl border p-5 text-sm ${
            result.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {result.ok ? (
            <>
              <div className="text-base font-semibold">
                ✅ {result.inserted}건 저장 완료
              </div>
              {result.period && (
                <div className="mt-1 text-xs text-emerald-700">
                  기간: {result.period.start}
                  {result.period.start !== result.period.end &&
                    ` ~ ${result.period.end}`}
                </div>
              )}

              {result.categoryCounts && (
                <div className="mt-3">
                  <div className="mb-1 text-xs font-semibold text-emerald-800">
                    카테고리 분류
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(result.categoryCounts).map(([slug, n]) => (
                      <span
                        key={slug}
                        className="rounded-full bg-white px-3 py-1 text-xs font-medium text-emerald-700 shadow-sm"
                      >
                        {categoryLabel(slug)} {n}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.unclassifiedCount ? (
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer font-medium text-amber-700">
                    ⚠️ 미분류 {result.unclassifiedCount}건 (저장 안 됨)
                  </summary>
                  <ul className="mt-1 list-inside list-disc text-slate-600">
                    {result.unclassified?.map((name, i) => (
                      <li key={i} className="truncate">
                        {name}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              <Link
                href="/"
                className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                대시보드에서 보기 →
              </Link>
            </>
          ) : (
            <>
              <div className="font-semibold">⚠️ {result.error}</div>
              {result.unclassified && result.unclassified.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs">
                  {result.unclassified.map((name, i) => (
                    <li key={i} className="truncate">
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {result.detectedColumns && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-slate-500">
                인식된 컬럼 보기
              </summary>
              <pre className="mt-1 overflow-x-auto rounded bg-white/60 p-2">
                {JSON.stringify(result.detectedColumns, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
