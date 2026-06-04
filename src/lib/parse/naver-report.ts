import ExcelJS from "exceljs";
import Papa from "papaparse";
import { classifyCategory, type CategorySlug } from "@/lib/categories";

/**
 * 네이버 검색광고 보고서(다운로드) 파서.
 * - 엑셀(.xlsx) / CSV 지원
 * - 보고서마다 컬럼 구성이 달라질 수 있어 한글 헤더를 "유연하게" 매칭합니다.
 * - 비율 컬럼(CTR/CVR/ROAS 등)은 무시하고 원시값(노출/클릭/비용/전환/매출)만 저장 →
 *   파생 지표는 metrics.ts에서 다시 계산합니다.
 */

export interface ParsedRow {
  reportDate: string | null; // ISO yyyy-mm-dd (없으면 null → 업로드 시 기본일자 사용)
  category: CategorySlug | null; // 소재 내용으로 자동 분류 (null = 미분류)
  campaign: string | null;
  adGroup: string | null;
  keyword: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  qualityScore: number | null;
}

export interface ParseResult {
  rows: ParsedRow[];
  detectedColumns: Partial<Record<CanonicalField, string>>;
  warnings: string[];
  /** 카테고리별 분류 건수 */
  categoryCounts: Record<string, number>;
  /** 미분류 상품명 목록 */
  unclassified: string[];
}

type CanonicalField =
  | "reportDate"
  | "campaign"
  | "adGroup"
  | "keyword"
  | "impressions"
  | "clicks"
  | "cost"
  | "conversions"
  | "conversionValue"
  | "qualityScore";

/** 헤더 문자열 → 표준 필드 매칭. 괄호 주석/공백 제거 후 키워드 규칙 적용 */
function matchField(rawHeader: string): CanonicalField | null {
  const h = rawHeader.replace(/\(.*?\)/g, "").replace(/\s+/g, "");
  if (!h) return null;

  // 차원(텍스트) 컬럼
  if (h.includes("캠페인")) return "campaign";
  if (h.includes("광고그룹")) return "adGroup";
  if (h.includes("키워드") || h.includes("소재")) return "keyword";
  if (h.includes("품질")) return "qualityScore";

  // 날짜
  if (h.includes("일자") || h.includes("날짜") || h === "일" || h.includes("기간"))
    return "reportDate";

  // 매출/전환금액 (전환수보다 먼저 검사)
  if (h.includes("전환매출") || h.includes("전환금액") || (h.includes("매출") && !h.includes("수익")))
    return "conversionValue";

  // 전환수 (전환율/전환매출 제외)
  if (h.includes("전환") && !h.includes("전환율") && !h.includes("전환매출") && !h.includes("전환금액"))
    return "conversions";

  // 노출수 (노출순위 제외)
  if (h.includes("노출") && !h.includes("순위")) return "impressions";

  // 클릭수 (클릭률/클릭비용/클릭단가 제외)
  if (
    h.includes("클릭") &&
    !h.includes("률") &&
    !h.includes("비용") &&
    !h.includes("단가") &&
    !h.includes("당")
  )
    return "clicks";

  // 비용/광고비 (클릭비용 제외)
  if (h.includes("총비용") || h.includes("광고비") || (h.includes("비용") && !h.includes("클릭")))
    return "cost";

  return null;
}

/** "1,234" / "₩1,234" / "12.5%" / "" → number */
function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  const s = String(value).replace(/[,₩원%\s]/g, "").trim();
  if (s === "" || s === "-") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** 다양한 날짜 표기를 ISO(yyyy-mm-dd)로 정규화 */
function toIsoDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value).trim();
  // YYYYMMDD
  const m1 = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  // YYYY[-./]MM[-./]DD
  const m2 = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (m2)
    return `${m2[1]}-${m2[2].padStart(2, "0")}-${m2[3].padStart(2, "0")}`;
  return null;
}

/**
 * 네이버 쇼핑 "소재" 컬럼은 `상품명,가격,카테고리경로,상품URL,...` 형태의
 * 피드 문자열일 수 있음 → 첫 콤마 앞 상품명만 추출.
 */
function cleanCreativeName(value: string | null): string | null {
  if (!value) return value;
  const v = value.trim();
  if (v.includes("http") || v.includes(" > ")) {
    const name = v.split(",")[0].trim();
    return name || v;
  }
  return v;
}

/** 파일명 등에서 YYYYMMDD 추출 → ISO 날짜 */
export function dateFromFileName(name: string): string | null {
  const m = name.match(/(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const mm = Number(mo);
  const dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${y}-${mo}-${d}`;
}

/** 헤더 배열에서 필드→인덱스 맵 생성 */
function buildHeaderMap(headers: string[]) {
  const map = new Map<CanonicalField, number>();
  const detected: Partial<Record<CanonicalField, string>> = {};
  headers.forEach((header, idx) => {
    const field = matchField(String(header ?? ""));
    if (field && !map.has(field)) {
      map.set(field, idx);
      detected[field] = String(header);
    }
  });
  return { map, detected };
}

/** 헤더 행으로 보이는 행인지 (노출/클릭/캠페인 등이 들어있는지) */
function looksLikeHeader(cells: string[]): boolean {
  const joined = cells.join("").replace(/\s/g, "");
  return (
    (joined.includes("노출") || joined.includes("클릭")) &&
    (joined.includes("캠페인") ||
      joined.includes("광고그룹") ||
      joined.includes("키워드") ||
      joined.includes("비용"))
  );
}

function rowsFromMatrix(matrix: string[][]): ParseResult {
  const warnings: string[] = [];

  // 헤더 행 탐색 (상단 제목/요약 행 건너뜀)
  let headerIdx = matrix.findIndex(looksLikeHeader);
  if (headerIdx === -1) headerIdx = 0;

  const headers = matrix[headerIdx] ?? [];
  const { map, detected } = buildHeaderMap(headers);

  if (!map.has("impressions") && !map.has("clicks")) {
    warnings.push(
      "노출수/클릭수 컬럼을 찾지 못했습니다. 보고서 형식을 확인하세요.",
    );
  }

  const get = (cells: string[], f: CanonicalField): string | undefined => {
    const i = map.get(f);
    return i == null ? undefined : cells[i];
  };

  const rows: ParsedRow[] = [];
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const cells = matrix[r] ?? [];
    if (cells.every((c) => String(c ?? "").trim() === "")) continue;

    const campaign = (get(cells, "campaign") ?? "").toString().trim() || null;
    const adGroup = (get(cells, "adGroup") ?? "").toString().trim() || null;
    const rawKeyword = (get(cells, "keyword") ?? "").toString().trim() || null;

    // 합계/총계/요약("소재 46개 결과") 행 스킵
    const firstText = [campaign, adGroup, rawKeyword].find(Boolean) ?? "";
    if (/^(합계|총계|소계|total)/i.test(firstText) || /\d+\s*개\s*결과/.test(firstText))
      continue;

    // 카테고리 자동 분류 (원본 소재 문자열 = 상품명 + 카테고리경로 기반)
    const category = classifyCategory(
      `${rawKeyword ?? ""} ${campaign ?? ""} ${adGroup ?? ""}`,
    );

    // 소재(상품) 피드 형식 "상품명,가격,카테고리경로,URL,..." → 상품명만 추출
    const keyword = cleanCreativeName(rawKeyword);

    const impressions = Math.round(toNumber(get(cells, "impressions")));
    const clicks = Math.round(toNumber(get(cells, "clicks")));
    // 차원/지표가 모두 비면 스킵
    if (!campaign && !adGroup && !keyword && impressions === 0 && clicks === 0)
      continue;

    const qRaw = get(cells, "qualityScore");
    let qualityScore: number | null = null;
    if (qRaw != null && String(qRaw).trim() !== "" && String(qRaw).trim() !== "-") {
      const q = Math.round(toNumber(qRaw));
      qualityScore = q >= 1 && q <= 10 ? q : null;
    }

    rows.push({
      reportDate: toIsoDate(get(cells, "reportDate")),
      category,
      campaign,
      adGroup,
      keyword,
      impressions,
      clicks,
      cost: toNumber(get(cells, "cost")),
      conversions: toNumber(get(cells, "conversions")),
      conversionValue: toNumber(get(cells, "conversionValue")),
      qualityScore,
    });
  }

  // 분류 통계
  const categoryCounts: Record<string, number> = {};
  const unclassified: string[] = [];
  for (const row of rows) {
    if (row.category) {
      categoryCounts[row.category] = (categoryCounts[row.category] ?? 0) + 1;
    } else {
      unclassified.push(row.keyword ?? "(이름없음)");
    }
  }

  return { rows, detectedColumns: detected, warnings, categoryCounts, unclassified };
}

/** 엑셀(.xlsx) 버퍼 파싱 */
async function parseXlsx(buffer: Buffer): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws)
    return {
      rows: [],
      detectedColumns: {},
      warnings: ["워크시트가 없습니다."],
      categoryCounts: {},
      unclassified: [],
    };

  const matrix: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      if (v != null && typeof v === "object" && "text" in v) {
        cells.push(String((v as { text: unknown }).text ?? ""));
      } else if (v instanceof Date) {
        cells.push(v.toISOString().slice(0, 10));
      } else {
        cells.push(v == null ? "" : String(v));
      }
    });
    matrix.push(cells);
  });

  return rowsFromMatrix(matrix);
}

/** CSV 버퍼 파싱 */
function parseCsv(buffer: Buffer): ParseResult {
  const text = buffer.toString("utf-8");
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  return rowsFromMatrix(parsed.data as string[][]);
}

export async function parseNaverReport(
  buffer: Buffer,
  fileName: string,
): Promise<ParseResult> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return parseCsv(buffer);
  return parseXlsx(buffer);
}
