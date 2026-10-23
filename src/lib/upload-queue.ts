import type { FileNamePeriod } from "./date-filename";

export interface UploadResult {
  ok?: boolean;
  inserted?: number;
  period?: FileNamePeriod;
  categoryCounts?: Record<string, number>;
  unclassifiedCount?: number;
  unclassified?: string[];
  error?: string;
  warnings?: string[];
  detectedColumns?: Record<string, string>;
}

export interface UploadItem {
  id: string;
  file: File;
  period: FileNamePeriod | null;
  validationError?: string;
  status: "ready" | "uploading" | "success" | "error";
  result?: UploadResult;
}

export function pendingUploads(items: UploadItem[]) {
  return items.filter((item) => item.period && !item.validationError && (item.status === "ready" || item.status === "error"));
}

/** The API replaces period data and updates shared bid settings, so never upload concurrently. */
export async function uploadFilesSequentially(
  items: UploadItem[],
  onUpdate: (id: string, update: Pick<UploadItem, "status" | "result">) => void,
  send: typeof fetch = fetch,
) {
  for (const item of pendingUploads(items)) {
    onUpdate(item.id, { status: "uploading", result: undefined });
    const form = new FormData();
    form.append("file", item.file);
    form.append("periodStart", item.period!.start);
    form.append("periodEnd", item.period!.end);

    let result: UploadResult;
    try {
      const response = await send("/api/upload", { method: "POST", body: form });
      try {
        const body = await response.json();
        result = body && typeof body === "object" ? body : {};
      } catch {
        result = { error: "서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." };
      }
      const ok = response.ok && result.ok === true;
      result = { ...result, ok, error: ok ? undefined : result.error || "업로드에 실패했습니다. 파일을 확인하고 다시 시도해 주세요." };
    } catch {
      result = { ok: false, error: "파일 전송에 실패했습니다. 네트워크 연결을 확인하고 다시 시도해 주세요." };
    }
    onUpdate(item.id, { status: result.ok ? "success" : "error", result });
  }
}
