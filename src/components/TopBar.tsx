"use client";

/**
 * 페이지 상단 고정 바.
 * 좌측: 제목, 우측: 컨트롤(children) — 우측 여백은 본문 컨테이너(maxWidth)와 정렬된다.
 */
export function TopBar({
  title,
  children,
  maxWidth = "max-w-6xl",
}: {
  title: string;
  children?: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white">
      <div
        className={`mx-auto flex ${maxWidth} flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8`}
      >
        <h1 className="text-xl font-semibold text-green-600">{title}</h1>
        {children && (
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        )}
      </div>
    </header>
  );
}
