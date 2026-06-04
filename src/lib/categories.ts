/** 광고 제품 카테고리 정의 */
export const CATEGORIES = [
  { slug: "wallpaper", label: "벽지" },
  { slug: "flooring", label: "마루" },
  { slug: "jangpan", label: "장판" },
  { slug: "film", label: "필름" },
  { slug: "bestpack", label: "베스트팩" },
  { slug: "signature", label: "시그니처매치" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as CategorySlug[];

/** 카테고리별 색상 (도넛/범례 공통) */
export const CATEGORY_COLORS: Record<string, string> = {
  wallpaper: "#10b981", // 벽지 - emerald
  flooring: "#3b82f6", // 마루 - blue
  jangpan: "#f59e0b", // 장판 - amber
  film: "#8b5cf6", // 필름 - violet
  bestpack: "#ec4899", // 베스트팩 - pink
  signature: "#64748b", // 시그니처매치 - slate
};

export function categoryLabel(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

export function isCategorySlug(value: string): value is CategorySlug {
  return CATEGORY_SLUGS.includes(value as CategorySlug);
}
