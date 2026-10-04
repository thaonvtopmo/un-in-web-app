// Chạy các file trong supabase/migrations theo thứ tự, ghi nhớ file nào đã chạy.
//   node scripts/migrate.mjs            chạy các migration chưa chạy
//   node scripts/migrate.mjs --baseline đánh dấu mọi file hiện có là ĐÃ chạy (dùng cho database đã dựng sẵn)
// Cần POSTGRES_URL_NON_POOLING trong .env.local (Vercel tự thêm khi cài Supabase).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = fileURLToPath(new URL("..", import.meta.url));
const envFile = path.join(root, ".env.local");
const env = Object.fromEntries(
  fs.readFileSync(envFile, "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }),
);
const url = (env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL_NON_POOLING || "").split("?")[0];
if (!url) throw new Error("Thiếu POSTGRES_URL_NON_POOLING trong .env.local");

const baseline = process.argv.includes("--baseline");
const dir = path.join(root, "supabase", "migrations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  await client.query("alter table public.schema_migrations enable row level security");
  await client.query("revoke all on public.schema_migrations from anon, authenticated"); // chỉ máy chủ đọc được
  const done = new Set((await client.query("select name from public.schema_migrations")).rows.map((r) => r.name));
  for (const f of files) {
    if (done.has(f)) { console.log("  đã có  ", f); continue; }
    if (baseline) {
      await client.query("insert into public.schema_migrations (name) values ($1)", [f]);
      console.log("  đánh dấu", f);
      continue;
    }
    process.stdout.write(`  chạy    ${f} ... `);
    await client.query("begin");
    try {
      await client.query(fs.readFileSync(path.join(dir, f), "utf8"));
      await client.query("insert into public.schema_migrations (name) values ($1)", [f]);
      await client.query("commit");
      console.log("xong");
    } catch (e) {
      await client.query("rollback");
      console.log("LỖI");
      throw e;
    }
  }
} finally {
  await client.end();
}
