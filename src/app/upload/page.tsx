"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { DataManagePanel } from "@/components/DataManagePanel";
import { TopBar } from "@/components/TopBar";
import { categoryLabel } from "@/lib/categories";
import { periodFromFileName } from "@/lib/date-filename";
import { pendingUploads, uploadFilesSequentially, type UploadItem, type UploadResult } from "@/lib/upload-queue";

export default function UploadPage() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const uploading = useRef(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const pending = pendingUploads(items);
  const successCount = items.filter((item) => item.status === "success").length;
  const failedCount = items.filter((item) => item.status === "error").length;
  const completedCount = successCount + failedCount;

  function selectFiles(files: File[]) {
    if (uploading.current) return;
    const uploadYear = new Date().getFullYear();
    setItems((previous) => {
      const next = [...previous];
      for (const file of files) {
        const id = `${file.name}:${file.size}:${file.lastModified}`;
        if (next.some((item) => item.id === id)) continue;
        const period = periodFromFileName(file.name, uploadYear);
        const validationError = !/\.(xlsx|csv)$/i.test(file.name)
          ? ".xlsx 또는 .csv 파일을 선택해 주세요."
          : !period ? "파일명에 0601 또는 0601~0603처럼 날짜나 기간을 넣어주세요." : undefined;
        next.push({ id, file, period, validationError, status: "ready" });
      }
      return next;
    });
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    selectFiles(Array.from(e.dataTransfer.files));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (uploading.current || pending.length === 0) return;
    uploading.current = true;
    setBusy(true);
    setProgress({ completed: 0, total: pending.length });
    try {
      await uploadFilesSequentially(items, (id, update) => {
        setItems((previous) => previous.map((item) => item.id === id ? { ...item, ...update } : item));
        if (update.result) setProgress((previous) => ({ ...previous, completed: previous.completed + 1 }));
      });
    } finally {
      uploading.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title="데이터 업로드" maxWidth="max-w-5xl" />
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <p className="mb-6 max-w-2xl text-sm text-slate-500">
          네이버 소재 목록 보고서를 여러 개 선택하거나 끌어오세요.
          각 파일의 이름에서 기간을 인식하고 카테고리를 자동 분류합니다.
        </p>

        <form
          onSubmit={handleSubmit}
          className="max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">
              보고서 파일 (.xlsx / .csv · 여러 개 선택 가능)
            </div>
            <label
              onDragEnter={(e) => {
                e.preventDefault();
                if (!uploading.current) setIsDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!uploading.current) setIsDragging(true);
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
                accept=".xlsx,.csv"
                multiple
                disabled={busy}
                aria-label="보고서 파일 선택"
                onChange={(e) => {
                  selectFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
                className="sr-only"
              />
              <span className="text-sm font-semibold text-slate-800">
                {items.length ? "클릭하거나 끌어와 파일 추가" : "파일 여러 개를 끌어오거나 클릭해서 선택"}
              </span>
              <span className="mt-1 text-xs text-slate-400">
                파일명 예시: 0601.xlsx, 0601~0603.xlsx, 20260601~20260603.xlsx
              </span>
            </label>
          </div>

          {items.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-slate-600">선택한 파일 {items.length}개</span>
                <button type="button" disabled={busy} onClick={() => setItems([])} className="text-slate-400 hover:text-slate-700 disabled:opacity-50">전체 비우기</button>
              </div>
              <ul className="max-h-80 space-y-2 overflow-y-auto" aria-label="선택한 보고서 파일">
                {items.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-all text-sm font-medium text-slate-800">{item.file.name}</p>
                      <p className={`mt-1 text-xs ${item.validationError ? "text-red-600" : "text-slate-400"}`}>
                        {item.validationError ?? (item.period && (item.period.start === item.period.end ? item.period.start : `${item.period.start} ~ ${item.period.end}`))}
                      </p>
                      <p className={`mt-1 text-xs font-medium ${item.status === "success" ? "text-emerald-700" : item.status === "error" ? "text-red-600" : "text-slate-500"}`}>
                        {item.validationError ? "확인 필요" : item.status === "uploading" ? "업로드 중…" : item.status === "success" ? `${item.result?.inserted ?? 0}건 반영 완료` : item.status === "error" ? "업로드 실패 · 재시도 가능" : "업로드 대기"}
                      </p>
                    </div>
                    <button type="button" disabled={busy} aria-label={`${item.file.name} 선택에서 제거`}
                      onClick={() => setItems((previous) => previous.filter((entry) => entry.id !== item.id))}
                      className="shrink-0 rounded px-1 text-lg text-slate-400 hover:text-slate-700 disabled:opacity-40">×</button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-400">같은 기간의 데이터는 나중에 업로드한 파일로 교체됩니다.</p>
            </div>
          )}
          <button
            type="submit"
            disabled={busy || pending.length === 0}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? `업로드 중… ${progress.completed}/${progress.total}` : pending.length ? `${pending.length}개 파일 ${failedCount ? "업로드 / 재시도" : "업로드"}` : successCount ? "업로드 완료" : "업로드"}
          </button>
          {items.some((item) => item.validationError) && <p className="text-xs text-red-500">확인 필요한 파일은 제외하고 업로드합니다. 파일명이나 형식을 수정한 뒤 다시 추가해 주세요.</p>}
          <p role="status" aria-live="polite" className="text-xs text-slate-500">
            {busy ? `파일을 순서대로 처리하고 있습니다. ${progress.completed}개 처리 완료` : completedCount > 0 ? `성공 ${successCount}개 · 실패 ${failedCount}개` : ""}
          </p>
        </form>

        {items.some((item) => item.result) && <section className="mt-5 max-w-2xl space-y-3" aria-label="파일별 업로드 결과">
          {items.filter((item) => item.result).map((item) => <details key={item.id} open={item.status === "error"}
            className={`rounded-xl border p-4 text-sm ${item.result?.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}>
            <summary className="cursor-pointer break-all font-medium">{item.file.name} · {item.result?.ok ? `${item.result.inserted ?? 0}건 완료` : "업로드 실패"}</summary>
            <UploadFeedback result={item.result!} />
          </details>)}
          {successCount > 0 && <Link href="/" className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700">대시보드에서 보기 →</Link>}
        </section>}

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
              <DataManagePanel key={successCount} />
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function UploadFeedback({ result }: { result: UploadResult }) {
  return <div className="mt-3">
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
    {result.warnings && result.warnings.length > 0 && <ul className="mt-2 list-inside list-disc text-xs text-amber-700">
      {result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
    </ul>}
  </div>;
}
