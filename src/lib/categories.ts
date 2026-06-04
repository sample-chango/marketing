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

/**
 * 소재(상품) 텍스트 → 카테고리 자동 분류.
 * 네이버 소재 피드는 `상품명,가격,카테고리경로,URL,...` 형태이므로
 * 카테고리 경로/상품명에 포함된 키워드로 판별합니다.
 *
 * 우선순위: 제품 라인(시그니처매치/베스트팩) > 소재 종류(벽지/장판/마루/필름)
 * 분류 규칙은 실제 데이터에 맞춰 자유롭게 조정하세요.
 */
export function classifyCategory(text: string): CategorySlug | null {
  const t = (text ?? "").replace(/\s/g, "");
  if (!t) return null;
  // 제품 라인 우선
  if (t.includes("시그니처")) return "signature";
  if (t.includes("베스트팩")) return "bestpack";
  // 소재 종류
  if (t.includes("벽지")) return "wallpaper";
  if (t.includes("장판")) return "jangpan";
  if (t.includes("마루")) return "flooring";
  if (t.includes("필름")) return "film";
  return null;
}

export function isCategorySlug(value: string): value is CategorySlug {
  return CATEGORY_SLUGS.includes(value as CategorySlug);
}
