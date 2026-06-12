// ============================================================================
// OASIS LUX :: apply SQL migrations + seed to Supabase via the Management API.
//   node supabase/apply.mjs                 -> all migrations/*.sql then seed.sql
//   node supabase/apply.mjs migrations/0001_schema.sql   -> just that file
// Reads SUPABASE_ACCESS_TOKEN from env or my-app/.env.local.
// ============================================================================
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const PROJECT_REF = "onobgfvujbjrqavovgkm";

function loadEnv() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  try {
    const raw = readFileSync(join(root, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/);
      if (m) return m[1].trim();
    }
  } catch {}
  return null;
}

const TOKEN = loadEnv();
if (!TOKEN) {
  console.error("✗ SUPABASE_ACCESS_TOKEN not found (env or .env.local).");
  process.exit(1);
}

async function runSql(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return text;
}

function fileList() {
  const args = process.argv.slice(2);
  if (args.length) return args;
  const migDir = join(root, "supabase", "migrations");
  const migs = readdirSync(migDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join("migrations", f));
  return [...migs, "seed.sql"];
}

for (const rel of fileList()) {
  const path = join(root, "supabase", rel);
  const sql = readFileSync(path, "utf8");
  process.stdout.write(`→ applying ${rel} ... `);
  try {
    await runSql(sql);
    console.log("ok");
  } catch (e) {
    console.log("FAILED");
    console.error(String(e.message || e));
    process.exit(1);
  }
}
console.log("✓ done");
