import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf-8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = env.SUPABASE_SERVICE_ROLE_KEY;

async function raw(label, key) {
  const res = await fetch(`${url}/rest/v1/ad_metrics?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await res.text();
  console.log(`\n[${label}] HTTP ${res.status}`);
  console.log("body:", body.slice(0, 300));
}

await raw("anon/publishable", anon);
await raw("secret", secret);
