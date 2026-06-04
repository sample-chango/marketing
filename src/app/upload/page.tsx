"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";

interface UploadResult {
  ok?: boolean;
  inserted?: number;
  dates?: string[];
  error?: string;
  warnings?: string[];
  detectedColumns?: Record<string, string>;
}

export default function UploadPage() {
  const [category, setCategory] = useState(CATEGORIES[0].slug);
  const [reportDate, setReportDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setResult(null);

    const fd = new FormData();
    fd.append("category", category);
    fd.append("file", file);
    if (reportDate) fd.append("reportDate", reportDate);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = (await res.json()) as UploadResult;
      setResult(json);
    } catch (err) {
      setResult({ error: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">데이터 업로드</h1>
        <p className="text-sm text-slate-500">
          네이버 검색광고 보고서(.xlsx / .csv)를 카테고리별로 업로드하세요.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            카테고리
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            기준일자{" "}
            <span className="text-xs font-normal text-slate-400">
              (보고서에 일자 컬럼이 없을 때 사용)
            </span>
          </label>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            보고서 파일
          </label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-700"
          />
        </div>

        <button
          type="submit"
          disabled={!file || busy}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "업로드 중…" : "업로드"}
        </button>
      </form>

      {result && (
        <div
          className={`mt-5 rounded-xl border p-4 text-sm ${
            result.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {result.ok ? (
            <>
              <div className="font-semibold">
                ✅ {result.inserted}건 저장 완료
              </div>
              {result.dates && (
                <div className="mt-1 text-xs">
                  기간: {result.dates[0]} ~ {result.dates[result.dates.length - 1]}
                </div>
              )}
            </>
          ) : (
            <div className="font-semibold">⚠️ {result.error}</div>
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
          {result.warnings && result.warnings.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
