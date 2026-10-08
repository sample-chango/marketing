"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TopBar } from "@/components/TopBar";

/** Match the heading to the section occupying most of the scrollport. */
export function DashboardSections({ controls, children }: { controls: ReactNode; children: ReactNode }) {
  const scrollport = useRef<HTMLElement>(null);
  const [title, setTitle] = useState("성과 요약");

  useEffect(() => {
    const root = scrollport.current;
    if (!root) return;
    const sections = [...root.querySelectorAll<HTMLElement>("[data-dashboard-title]")];
    const observer = new IntersectionObserver(() => {
      const viewport = root.getBoundingClientRect();
      let visibleHeight = 0;
      let active: HTMLElement | undefined;
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        const overlap = Math.max(0, Math.min(viewport.bottom, rect.bottom) - Math.max(viewport.top, rect.top));
        if (rect.height > 0 && overlap > visibleHeight) {
          visibleHeight = overlap;
          active = section;
        }
      }
      if (active?.dataset.dashboardTitle) setTitle(active.dataset.dashboardTitle);
    }, { root, threshold: Array.from({ length: 21 }, (_, index) => index / 20) });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [children]);

  return <div className="dashboard-viewport">
    <TopBar title={title} titleClassName="dashboard-title" titleLive contentClassName="px-4 py-[18px] md:px-8">{controls}</TopBar>
    <main ref={scrollport} className="dashboard-scroll" aria-label="대시보드 섹션" tabIndex={0}>{children}</main>
  </div>;
}
