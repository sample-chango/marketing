/**
 * 시그니처매치(올인원 패키지) 행의 keyword를 괄호 안 제품명으로 정리.
 *   "[샘플창고] … 샘플 세트(우드&크림 무드) │ … 올인원 패키지" → "우드&크림 무드"
 *
 *   node scripts/fix-signature-names.mjs          # dry-run
 *   node scripts/fix-signature-names.mjs --apply  # 적용
 */
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf-8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const APPLY = process.argv.includes("--apply");

// categories.ts의 signatureProductName과 동일 규칙
const productName = (text) => {
  if (!text) return text;
  const m = String(text).match(/\(([^)]+)\)/);
  return m ? m[1].trim() : text;
};

async function fetchSignature() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(
      `${url}/rest/v1/ad_metrics?select=id,keyword&category=eq.signature`,
      { headers: { ...headers, Range: `${from}-${from + 999}` } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const b = await res.json();
    out.push(...b);
    if (b.length < 1000) break;
  }
  return out;
}

const rows = await fetchSignature();
// 변경이 필요한 행만 (이미 짧은 이름이면 스킵)
const updates = rows
  .map((r) => ({ id: r.id, from: r.keyword, to: productName(r.keyword) }))
  .filter((u) => u.to && u.to !== u.from);

console.log(`signature 행: ${rows.length}건, 변경 대상: ${updates.length}건\n`);
const preview = {};
for (const u of updates) preview[`${u.to}`] = (preview[`${u.to}`] ?? 0) + 1;
for (const [name, n] of Object.entries(preview)) console.log(`  ${String(n).padStart(4)}  → "${name}"`);

if (updates.length === 0) process.exit(0);
if (!APPLY) {
  console.log("\n[dry-run] 적용하려면 --apply 를 붙여 실행하세요.");
  process.exit(0);
}

let done = 0;
for (const u of updates) {
  const res = await fetch(`${url}/rest/v1/ad_metrics?id=eq.${u.id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ keyword: u.to }),
  });
  if (!res.ok) throw new Error(`업데이트 실패 HTTP ${res.status}: ${await res.text()}`);
  done++;
}
console.log(`\n✅ ${done}건 keyword 정리 완료`);
process.exit(0);
