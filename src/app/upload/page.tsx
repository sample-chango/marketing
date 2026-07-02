"use client";

import { useState } from "react";
import Link from "next/link";
import { DataManagePanel } from "@/components/DataManagePanel";
import { TopBar } from "@/components/TopBar";
import { categoryLabel } from "@/lib/categories";
import { periodFromFileName } from "@/lib/date-filename";

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
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const uploadYear = new Date().getFullYear();
  const detectedFilePeriod = file ? periodFromFileName(file.name, uploadYear) : null;
  const detectedPeriodLabel = detectedFilePeriod
    ? detectedFilePeriod.start === detectedFilePeriod.end
      ? detectedFilePeriod.start
      : `${detectedFilePeriod.start} ~ ${detectedFilePeriod.end}`
    : "";
  const canUpload = !!file && !!detectedFilePeriod && !busy;

  function selectFile(nextFile: File | null) {
    setFile(nextFile);
    setResult(null);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    selectFile(e.dataTransfer.files?.[0] ?? null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !detectedFilePeriod) return;
    setBusy(true);
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("periodStart", detectedFilePeriod.start);
    fd.append("periodEnd", detectedFilePeriod.end);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      setResult((await res.json()) as UploadResult);
    } catch (err) {
      setResult({ error: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title="데이터 업로드" maxWidth="max-w-5xl" />
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <p className="mb-6 max-w-2xl text-sm text-slate-500">
          네이버 소재 목록 보고서를 올리면 파일명 기간을 기준으로 저장하고,
          카테고리를 자동 분류합니다.
        </p>

        <form
          onSubmit={handleSubmit}
          className="max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">
              보고서 파일 (.xlsx / .csv)
            </div>
            <label
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={handleDrop}
              className={`flex min-h-[148px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center transition ${
                isDragging
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/60"
              }`}
            >
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
              <span className="text-sm font-semibold text-slate-800">
                {file ? file.name : "파일을 끌어오거나 클릭해서 선택"}
              </span>
              <span className="mt-1 text-xs text-slate-400">
                파일명 예시: 0601.xlsx, 0601~0603.xlsx, 20260601~20260603.xlsx
              </span>
              {detectedFilePeriod && (
                <span className="mt-3 rounded-full bg-white px-3 py-1 text-xs font-medium text-emerald-700 shadow-sm">
                  인식된 기간: {detectedPeriodLabel}
                </span>
              )}
              {file && !detectedFilePeriod && (
                <span className="mt-3 rounded-full bg-white px-3 py-1 text-xs font-medium text-red-600 shadow-sm">
                  파일명에서 날짜 또는 기간을 인식할 수 없습니다.
                </span>
              )}
            </label>
          </div>

          <button
            type="submit"
            disabled={!canUpload}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? "업로드 중..." : "업로드"}
          </button>
          {file && !detectedFilePeriod && (
            <p className="text-xs text-red-500">
              파일명에 0601 또는 0601~0603처럼 날짜나 기간을 넣어주세요.
            </p>
          )}
        </form>

        {result && (
          <div
            className={`mt-5 max-w-2xl rounded-2xl border p-5 text-sm ${
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

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <button
            type="button"
            onClick={() => setManageOpen((value) => !value)}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <h2 className="text-base font-semibold text-slate-800">데이터 관리</h2>
              <p className="mt-1 text-sm text-slate-400">
                업로드한 데이터를 기간별로 수정하거나 삭제합니다.
              </p>
            </div>
            <span className="text-[11px] font-medium text-emerald-600">
              {manageOpen ? "닫기 ▲" : "열기 ▼"}
            </span>
          </button>
          {manageOpen && (
            <div className="mt-5">
              <DataManagePanel />
            </div>
          )}
        </section>
      </div>
    </>
  );
}
