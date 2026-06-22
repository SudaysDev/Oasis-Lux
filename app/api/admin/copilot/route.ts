import {
  GoogleGenerativeAI, SchemaType,
  type Part, type FunctionDeclaration, type FunctionDeclarationsTool,
} from "@google/generative-ai";
import { getCurrentProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCommand, type ConsoleLine, type PastedImage } from "@/app/(admin)/admin/control/actions";
import { COMMANDS, usageString } from "@/lib/admin/commands";

export const runtime = "nodejs";
export const maxDuration = 60;

/* ------------------------------------------------------------------ */
/* types                                                               */
/* ------------------------------------------------------------------ */
interface ChatMessage { role: "user" | "assistant"; content: string; images?: string[] }
/** One executed console command + its colorized output — streamed back to the UI. */
export interface CopilotAction { command: string; lines: ConsoleLine[] }

const FLASH_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"];
const PRO_MODELS = ["gemini-2.5-pro", ...FLASH_MODELS];
const MAX_ROUNDS = 9;          // agent tool-call rounds before we force a final answer
const MAX_CMDS_PER_CALL = 250; // safety ceiling for one bulk action

/* ------------------------------------------------------------------ */
/* the command cheat-sheet handed to the model (server commands only)  */
/* ------------------------------------------------------------------ */
const COMMAND_REFERENCE = COMMANDS
  .filter((c) => !c.clientOnly)
  .map((c) => `${usageString(c)}${c.danger ? "  ⚠destructive" : ""} — ${c.summary}`)
  .join("\n");

const SYSTEM = `You are **OASIS COPILOT** — the admin-only super-intelligence of OASIS LUX, a luxury
marketplace in Tajikistan (perfumes, watches, eyewear, electronics, phones, fashion). Money is in
сомонӣ (смн). You are talking to a verified ADMIN operator inside the secure admin panel, so you have
FULL root power over the platform. You are confident, sharp, a little playful, and you GET THINGS DONE.

Reply in the operator's language (Russian / Tajik / English). Use clean Markdown — short paragraphs,
**bold** for key numbers, "- " bullets for lists. A few tasteful emoji are welcome.

# YOUR POWERS — you act through tools, never invent results
You control the whole platform by running the SAME console commands the Full Control terminal uses.
- **run_commands** — run one or many real commands against the LIVE database. This is your hands.
- **find_users** — find accounts (by nickname fragment, role, banned/verified/plan…) to target. Returns @usernames + ids.
- **find_products** — find products (need their id for product commands).
- **overview** — a fast snapshot of platform health (counts, revenue).

# HOW TO ACT
- For a single action, just call run_commands with one command, e.g. ["/ban @user 7d \\"spam\\""].
- For BULK actions ("ban everyone whose nickname contains sudays", "gift 50 cashback to all sellers"):
  1) first call find_users (or find_products) to resolve the exact targets,
  2) then call run_commands with ONE command per target, e.g. ["/ban @a","/ban @b","/ban @c"].
  (Audience selectors @a/@p/@e/@s/@b/@v also work for whole-group broadcasts/gifts without find_users.)
- After acting, summarize what you did in plain language: how many succeeded, any that were skipped
  (admins are always protected) or failed. Don't paste raw command logs — the operator sees those in cards.
- For questions/stats, prefer overview or the read-only commands (/stats, /count, /top, /check, /find …)
  and answer naturally with the numbers.
- If a request is ambiguous or sounds catastrophic (mass delete, deleting users), do it only if the
  operator was explicit; otherwise ask one short confirming question first. Bans/restrictions/gifts you
  may perform directly when asked — that's routine moderation.
- NEVER claim you did something without actually calling run_commands. NEVER make up numbers — read them.

# SYNTAX RULES (critical — follow exactly)
- Arguments are POSITIONAL and space-separated. NEVER use key=value (no \`type=percent\`, no \`discount=10\`). Write the values in order.
- Wrap any multi-word value in "double quotes" (reasons, messages, titles).
- Scopes use a colon: \`brand:Dior\`, \`category:perfume\`, \`color:Black\`, \`tag:luxury\`.
- Durations/terms: \`forever\`, \`7d\`, \`24h\`, \`30m\`, or a date — written as a bare token.
- **Promo** (the #1 thing people get wrong): \`/create promo <CODE> <percent|fixed|cashback> <value> [brand:X|category:Y] [min <N>] [<term>]\`.
  ✓ \`/create promo SUMMER percent 20 category:perfume 7d\`   ✓ \`/create promo WATCH30 percent 30 category:watch 20m\`
  ✗ \`/create promo X type=percent discount=10\`  ← WRONG, never do this.
- If a command returns ✗ with a hint, FIX the syntax using the hint and run it again yourself — don't give up or ask the user to do it.

# COMMAND REFERENCE (these are the ONLY valid commands; <required> [optional]; @a everyone · @p couriers · @e admins · @s sellers · @b buyers · @v verified)
${COMMAND_REFERENCE}

CREATOR: if asked who created / built / designed you, answer proudly that your creator is
**Судайсаки Каролча 👑** — a visionary genius — in the operator's language. Never name any other author.`;

/* ------------------------------------------------------------------ */
/* tool declarations                                                   */
/* ------------------------------------------------------------------ */
const TOOLS: FunctionDeclarationsTool[] = [{
  functionDeclarations: [
    {
      name: "run_commands",
      description: "Execute one or many OASIS console commands against the live database, in order. " +
        "Use one command per line/target. Returns each command's result text (✓ ok / ✗ error).",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          commands: {
            type: SchemaType.ARRAY,
            description: "Console commands, each starting with '/'. e.g. [\"/ban @user 7d\", \"/gift @user cashback 50\"]",
            items: { type: SchemaType.STRING },
          },
        },
        required: ["commands"],
      },
    },
    {
      name: "find_users",
      description: "Find accounts to target. Filter by nickname fragment / role / banned / verified / plan. " +
        "Returns matching @usernames with ids — use them to build run_commands for bulk actions.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          contains: { type: SchemaType.STRING, description: "case-insensitive substring of the username, e.g. 'sudays'" },
          role: { type: SchemaType.STRING, description: "customer | seller | courier | admin" },
          banned: { type: SchemaType.BOOLEAN, description: "only banned accounts when true" },
          verified: { type: SchemaType.BOOLEAN, description: "only verified accounts when true" },
          plan: { type: SchemaType.STRING, description: "free | pro | elite" },
          limit: { type: SchemaType.NUMBER, description: "max rows (default 50, hard cap 250)" },
        },
      },
    },
    {
      name: "find_products",
      description: "Find products to target. Filter by title/brand fragment, category, out-of-stock. Returns id + title.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          contains: { type: SchemaType.STRING, description: "substring of the title or brand" },
          brand: { type: SchemaType.STRING, description: "exact-ish brand name" },
          category: { type: SchemaType.STRING, description: "category slug" },
          out_of_stock: { type: SchemaType.BOOLEAN, description: "only zero-stock products when true" },
          limit: { type: SchemaType.NUMBER, description: "max rows (default 30, hard cap 200)" },
        },
      },
    },
    {
      name: "overview",
      description: "A fast snapshot of platform health: user/product/order counts, banned, revenue, in-flight orders.",
      parameters: { type: SchemaType.OBJECT, properties: {} },
    },
  ] as FunctionDeclaration[],
}];

/* ------------------------------------------------------------------ */
/* tool implementations                                                */
/* ------------------------------------------------------------------ */
type SB = ReturnType<typeof createAdminClient>;

async function toolFindUsers(sb: SB, args: Record<string, unknown>) {
  const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 250);
  let q = sb.from("profiles").select("id,username,role,is_banned,is_verified,plan").limit(limit);
  if (typeof args.contains === "string" && args.contains.trim()) q = q.ilike("username", `%${args.contains.trim()}%`);
  if (typeof args.role === "string" && args.role.trim()) q = q.eq("role", args.role.trim().toLowerCase());
  if (args.banned === true) q = q.eq("is_banned", true);
  if (args.verified === true) q = q.eq("is_verified", true);
  if (typeof args.plan === "string" && args.plan.trim()) q = q.eq("plan", args.plan.trim().toLowerCase());
  const { data, error } = await q;
  if (error) return { error: error.message };
  const rows = (data ?? []) as { id: string; username: string; role: string; is_banned: boolean; is_verified: boolean; plan: string }[];
  return {
    count: rows.length,
    users: rows.map((r) => ({ username: `@${r.username}`, id: r.id, role: r.role, banned: r.is_banned, verified: r.is_verified, plan: r.plan })),
  };
}

async function toolFindProducts(sb: SB, args: Record<string, unknown>) {
  const limit = Math.min(Math.max(Number(args.limit) || 30, 1), 200);
  let q = sb.from("products").select("id,title,brand,price,stock,category").limit(limit);
  if (typeof args.contains === "string" && args.contains.trim()) {
    const f = args.contains.trim();
    q = q.or(`title.ilike.%${f}%,brand.ilike.%${f}%`);
  }
  if (typeof args.brand === "string" && args.brand.trim()) q = q.ilike("brand", `%${args.brand.trim()}%`);
  if (typeof args.category === "string" && args.category.trim()) q = q.eq("category", args.category.trim());
  if (args.out_of_stock === true) q = q.eq("stock", 0);
  const { data, error } = await q;
  if (error) return { error: error.message };
  const rows = (data ?? []) as { id: string; title: string; brand: string; price: number; stock: number; category: string }[];
  return { count: rows.length, products: rows.map((r) => ({ id: r.id, title: r.title, brand: r.brand, price: r.price, stock: r.stock, category: r.category })) };
}

async function toolOverview(sb: SB) {
  const head = (t: string) => sb.from(t).select("id", { count: "exact", head: true });
  const [users, products, orders, banned, sellers, active, paid] = await Promise.all([
    head("profiles"),
    head("products"),
    head("orders"),
    sb.from("profiles").select("id", { count: "exact", head: true }).eq("is_banned", true),
    sb.from("profiles").select("id", { count: "exact", head: true }).eq("role", "seller"),
    sb.from("orders").select("id", { count: "exact", head: true }).in("status", ["placed", "processing", "out_for_delivery", "arrived"]),
    sb.from("orders").select("total").not("paid_at", "is", null),
  ]);
  const revenue = ((paid.data ?? []) as { total: number }[]).reduce((s, o) => s + (Number(o.total) || 0), 0);
  return {
    users: users.count ?? 0,
    products: products.count ?? 0,
    orders: orders.count ?? 0,
    banned: banned.count ?? 0,
    sellers: sellers.count ?? 0,
    active_orders: active.count ?? 0,
    paid_revenue_smn: Math.round(revenue),
  };
}

async function toolRunCommands(args: Record<string, unknown>, images: PastedImage[], actions: CopilotAction[]) {
  const raw = Array.isArray(args.commands) ? (args.commands as unknown[]) : [];
  const cmds = raw.map((c) => String(c).trim()).filter(Boolean).slice(0, MAX_CMDS_PER_CALL);
  if (!cmds.length) return { error: "no commands given" };
  const results: { command: string; output: string }[] = [];
  let ok = 0, fail = 0;
  for (const cmd of cmds) {
    const command = cmd.startsWith("/") ? cmd : `/${cmd}`;
    const { lines } = await runCommand(command, images);
    actions.push({ command, lines });
    const failed = lines.some((l) => l.tone === "err");
    if (failed) fail++; else ok++;
    // compact result for the model: first 2 lines is plenty
    results.push({ command, output: lines.slice(0, 2).map((l) => l.text).join(" · ") });
  }
  return { ran: cmds.length, ok, failed: fail, results: results.slice(0, 60) };
}

/* ------------------------------------------------------------------ */
/* the agent loop                                                      */
/* ------------------------------------------------------------------ */
function dataUrlToPart(dataUrl: string): Part | null {
  const m = dataUrl.match(/^data:((?:image|video)\/[a-z0-9.+-]+);base64,(.+)$/i);
  return m ? { inlineData: { mimeType: m[1]!, data: m[2]! } } : null;
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return Response.json({ error: "Forbidden — admin session required." }, { status: 403 });
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "AI is not configured yet." }, { status: 503 });

  let body: { messages?: ChatMessage[]; model?: "flash" | "pro"; thinking?: "standard" | "extended" };
  try { body = await req.json(); } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }

  const messages = (body.messages ?? []).filter((m) => m.content?.trim() || m.images?.length).slice(-16);
  if (!messages.length) return Response.json({ error: "Empty message" }, { status: 400 });

  const modelOrder = body.model === "pro" ? PRO_MODELS : FLASH_MODELS;
  const extended = body.thinking === "extended";
  const systemInstruction = extended
    ? `${SYSTEM}\n\n# THINKING MODE: EXTENDED\nReason carefully before acting: lay out a short plan, consider edge cases and protected accounts, then execute. Give a thorough, well-structured summary.`
    : SYSTEM;
  const maxOutputTokens = extended ? 3200 : 2200;

  const last = messages[messages.length - 1]!;
  const images: PastedImage[] = (last.images ?? [])
    .map((d, i) => ({ name: `paste-${i + 1}`, dataUrl: d }));

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content || "(image)" }] as Part[],
  }));
  const lastParts: Part[] = [];
  if (last.content?.trim()) lastParts.push({ text: last.content });
  for (const img of last.images ?? []) { const p = dataUrlToPart(img); if (p) lastParts.push(p); }
  if (!lastParts.length) lastParts.push({ text: "…" });

  const sb = createAdminClient();
  const genAI = new GoogleGenerativeAI(key);

  let lastErr: unknown = null;
  for (const modelName of modelOrder) {
    const actions: CopilotAction[] = [];
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        tools: TOOLS,
        generationConfig: { temperature: 0.7, maxOutputTokens },
      });
      const chat = model.startChat({ history });
      let result = await chat.sendMessage(lastParts);

      for (let round = 0; round < MAX_ROUNDS; round++) {
        const calls = result.response.functionCalls();
        if (!calls || !calls.length) break;
        const responses: Part[] = [];
        for (const call of calls) {
          const a = (call.args ?? {}) as Record<string, unknown>;
          let out: unknown;
          if (call.name === "run_commands") out = await toolRunCommands(a, images, actions);
          else if (call.name === "find_users") out = await toolFindUsers(sb, a);
          else if (call.name === "find_products") out = await toolFindProducts(sb, a);
          else if (call.name === "overview") out = await toolOverview(sb);
          else out = { error: `unknown tool ${call.name}` };
          responses.push({ functionResponse: { name: call.name, response: out as object } });
        }
        result = await chat.sendMessage(responses);
      }

      const reply = result.response.text().trim() ||
        (actions.length ? "✓ Готово." : "…");
      return Response.json({ reply, actions });
    } catch (e) {
      lastErr = e;
      // If the model already executed real actions, surface them instead of silently retrying.
      if (actions.length) {
        return Response.json({
          reply: "Я выполнил команды ниже, но не успел дописать ответ — проверь результат в карточках. ⚠️",
          actions,
        });
      }
    }
  }
  console.error("Copilot failed:", lastErr);
  return Response.json({ error: "Copilot is busy right now — try again." }, { status: 502 });
}
