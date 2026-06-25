import { DataManagePanel } from "@/components/DataManagePanel";
import { TopBar } from "@/components/TopBar";

export default function ManagePage() {
  return (
    <>
      <TopBar title="데이터 관리" maxWidth="max-w-5xl" />
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <p className="mb-6 text-sm text-slate-500">
          업로드한 데이터를 기간별로 수정·삭제할 수 있습니다.
        </p>
        <DataManagePanel />
      </div>
    </>
  );
}