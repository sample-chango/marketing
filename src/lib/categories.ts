/** 광고 제품 카테고리 정의 */
export const CATEGORIES = [
  { slug: "wallpaper", label: "벽지" },
  { slug: "film", label: "필름" },
  { slug: "flooring", label: "마루" },
  { slug: "bestpack", label: "베스트팩" },
  { slug: "signature", label: "시그니처 매치" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as CategorySlug[];

export function categoryLabel(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

export function isCategorySlug(value: string): value is CategorySlug {
  return CATEGORY_SLUGS.includes(value as CategorySlug);
}
