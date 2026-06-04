import { readFileSync } from "node:fs";
import postgres from "postgres";

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL 환경변수가 없습니다.");
  process.exit(1);
}
const file = process.argv[2] ?? "supabase/migrations/0001_init.sql";
const ddl = readFileSync(file, "utf-8");

const sql = postgres(conn, { ssl: "require", max: 1, idle_timeout: 5 });

try {
  console.log(`적용 중: ${file}`);
  await sql.unsafe(ddl);
  console.log("✅ 마이그레이션 완료");

  // 검증
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name in ('uploads','ad_metrics')
    order by table_name`;
  console.log("생성된 테이블:", tables.map((t) => t.table_name).join(", "));

  // PostgREST 스키마 캐시 새로고침
  await sql`notify pgrst, 'reload schema'`;
  console.log("PostgREST 스키마 캐시 reload 요청 완료");
} catch (e) {
  console.error("❌ 실패:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
