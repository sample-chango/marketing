import { readFileSync } from "node:fs";
import { parseNaverReport, dateFromFileName } from "../src/lib/parse/naver-report.ts";
import { sumTotals, deriveMetrics, addToTotals, EMPTY_TOTALS } from "../src/lib/metrics.ts";

const path = process.argv[2];
const buf = readFileSync(path);
const fileName = path.split(/[\\/]/).pop()!;

const result = await parseNaverReport(buf, fileName);

console.log("파일명 추출 날짜:", dateFromFileName(fileName));
console.log("인식된 컬럼:", result.detectedColumns);
console.log("경고:", result.warnings);
console.log("파싱 행 수:", result.rows.length);

console.log("\n=== 첫 3행 ===");
for (const r of result.rows.slice(0, 3)) {
  console.log({
    keyword: r.keyword?.slice(0, 40),
    impressions: r.impressions,
    clicks: r.clicks,
    cost: r.cost,
    conversions: r.conversions,
    conversionValue: r.conversionValue,
    quality: r.qualityScore,
  });
}

const totals = result.rows.reduce(addToTotals, { ...EMPTY_TOTALS });
const m = deriveMetrics(totals);
console.log("\n=== 합계/파생지표 ===");
console.log("노출:", m.impressions, "클릭:", m.clicks, "비용:", m.cost);
console.log("전환:", m.conversions, "매출:", m.conversionValue);
console.log("CTR:", (m.ctr * 100).toFixed(2) + "%", "CPC:", Math.round(m.cpc));
console.log("CVR:", (m.cvr * 100).toFixed(2) + "%", "CPA:", Math.round(m.cpa));
console.log("ROAS:", (m.roas * 100).toFixed(0) + "%", "품질:", m.qualityScore?.toFixed(2));
void sumTotals;
