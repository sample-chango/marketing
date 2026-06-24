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

/** 카테고리별 색상 (스마트스토어 그린/블루/퍼플 톤) */
export const CATEGORY_COLORS: Record<string, string> = {
  wallpaper: "#03C75A", // 벽지 - smartstore green
  flooring: "#12C8A8", // 마루 - mint green
  jangpan: "#20B7E8", // 장판 - cyan blue
  film: "#5B8DEF", // 필름 - brand blue
  bestpack: "#6F6AF8", // 베스트팩 - blue violet
  signature: "#8B5CF6", // 시그니처매치 - purple
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
  // 제품 라인 우선 (소재 종류보다 먼저 판별)
  // 시그니처매치 라인: "시그니처" 키워드 또는 "올인원 패키지"로 표기된 제품.
  // (올인원 패키지 = 벽지+마루+필름 등을 묶은 시그니처매치 세트. 괄호 안이 제품명)
  if (t.includes("시그니처")) return "signature";
  if (t.includes("올인원패키지")) return "signature";
  if (t.includes("베스트팩")) return "bestpack";
  // 소재 종류
  if (t.includes("벽지")) return "wallpaper";
  if (t.includes("장판")) return "jangpan";
  if (t.includes("마루")) return "flooring";
  if (t.includes("필름")) return "film";
  return null;
}

/**
 * 시그니처매치(올인원 패키지) 제품의 표시용 이름.
 * 소재 문자열의 첫 괄호 `( )` 안이 제품 이름.
 *   "[샘플창고] 벽지+마루+필름 샘플 세트(우드&크림 무드) │ … 올인원 패키지" → "우드&크림 무드"
 * 괄호가 없으면 원본을 그대로 반환.
 */
export function signatureProductName(text: string | null): string | null {
  if (!text) return text;
  const m = text.match(/\(([^)]+)\)/);
  return m ? m[1].trim() : text;
}

export function isCategorySlug(value: string): value is CategorySlug {
  return CATEGORY_SLUGS.includes(value as CategorySlug);
}
