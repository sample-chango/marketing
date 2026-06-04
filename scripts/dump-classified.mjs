import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf-8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data } = await db
  .from("ad_metrics")
  .select("category,keyword")
  .order("category");

const byCat = {};
for (const r of data) (byCat[r.category] ??= []).push(r.keyword);

for (const [cat, names] of Object.entries(byCat)) {
  console.log(`\n=== ${cat} (${names.length}) ===`);
  for (const n of names.slice(0, 5)) console.log("  -", (n ?? "").slice(0, 55));
}
