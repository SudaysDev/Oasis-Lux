/**
 * Full Control — shared command registry.
 *
 * This file is imported by BOTH the terminal client (autocomplete, argument
 * hints, the Commands drawer) and the server dispatcher (validation), so it
 * must stay free of "use server" / "server-only" and of any server imports.
 */

export const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;

/* --------------------------------------------------------------------- */
/* term parsing (shared with the dossier sanction UI)                     */
/* --------------------------------------------------------------------- */
function unitMs(w: string): number | null {
  if (/^(mo|month|мес)/.test(w)) return 30 * DAY;
  if (/^(w|wk|week|нед)/.test(w)) return 7 * DAY;
  if (/^(d|day|дн|день|дня|дней|сут)/.test(w)) return DAY;
  if (/^(h|hr|hour|час|ч)/.test(w)) return HOUR;
  if (/^(m|min|мин|м)/.test(w)) return MIN;
  return null;
}

/** `{}` = permanent · `{ ms }` = timed · null = unparseable. */
export function parseTerm(raw: string): { ms?: number } | null {
  const s = (raw ?? "").trim();
  if (!s) return {};
  if (/^(perm|permanent|forever|навсегда|перм|нав)/i.test(s)) return {};
  if (/^\d+(?:[.,]\d+)?$/.test(s)) return { ms: parseFloat(s.replace(",", ".")) * DAY };
  let ms = 0, matched = false;
  const re = /(\d+(?:[.,]\d+)?)\s*([a-zа-яё]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const mult = unitMs(m[2].toLowerCase());
    if (mult) { ms += parseFloat(m[1].replace(",", ".")) * mult; matched = true; }
  }
  if (matched && ms > 0) return { ms };
  const d = new Date(s);
  if (!isNaN(d.getTime())) { const diff = d.getTime() - Date.now(); if (diff > 0) return { ms: diff }; }
  return null;
}

export function humanizeMs(ms: number): string {
  if (ms >= 30 * DAY) return `${Math.round(ms / DAY)}d`;
  if (ms >= DAY) return `${+(ms / DAY).toFixed(ms % DAY ? 1 : 0)}d`;
  if (ms >= HOUR) return `${+(ms / HOUR).toFixed(ms % HOUR ? 1 : 0)}h`;
  if (ms >= MIN) return `${Math.round(ms / MIN)}m`;
  return `${Math.round(ms / 1000)}s`;
}

/** Quote-aware splitter: `say "hi there" now` → ["say","hi there","now"]. */
export function tokenize(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

/* --------------------------------------------------------------------- */
/* command spec                                                           */
/* --------------------------------------------------------------------- */
export type ArgType =
  | "user" | "users" | "target" | "product" | "term" | "text" | "message"
  | "number" | "money" | "enum" | "scope" | "hex" | "onoff" | "what"
  | "anytarget" | "field" | "value" | "order";

export type CmdArg = {
  name: string;
  type: ArgType;
  required?: boolean;
  hint: string;
  options?: readonly string[];
};

export type CmdSpec = {
  name: string;
  category: string;
  summary: string;
  args: CmdArg[];
  examples: string[];
  aliases?: readonly string[];
  danger?: boolean;
  clientOnly?: boolean;
};

/** Selector tokens (Minecraft-style). */
export const TARGETS = [
  { token: "@a", label: "everyone on the site" },
  { token: "@p", label: "all couriers" },
  { token: "@e", label: "all admins" },
  { token: "@s", label: "all sellers" },
  { token: "@b", label: "all buyers / customers" },
  { token: "@v", label: "all verified accounts" },
] as const;

export const SCOPE_PREFIXES = ["brand:", "category:", "color:", "tag:"] as const;
const ONOFF = ["on", "off"] as const;

export const COMMANDS: CmdSpec[] = [
  // ---- Users ----------------------------------------------------------
  { name: "ban", category: "Users", danger: true, summary: "Suspend an account — permanent, for a term, or until a date.",
    args: [
      { name: "user", type: "user", required: true, hint: "@username or user id" },
      { name: "term", type: "term", hint: "forever · 4 days · 24h · 23/06/2026 (default: forever)" },
      { name: "reason", type: "message", hint: "shown to the user in their notification" },
    ],
    examples: [`/ban @oasis_4667noqy 7d "spam in chat"`, `/ban @user forever`, `/ban <id> 23/06/2026`] },
  { name: "unban", category: "Users", summary: "Lift a suspension and reinstate the account.",
    args: [{ name: "user", type: "user", required: true, hint: "@username or user id" }],
    examples: [`/unban @oasis_4667noqy`] },
  { name: "restrict", category: "Users", summary: "Revoke one ability — they stay logged in but can't do it.",
    args: [
      { name: "user", type: "user", required: true, hint: "@username or id" },
      { name: "ability", type: "enum", required: true, hint: "what to revoke", options: ["chat", "sell", "buy", "review", "report", "favorite", "cart"] },
      { name: "term", type: "term", hint: "forever · 2h · 7d (default: forever)" },
    ],
    examples: [`/restrict @user chat 2h`, `/restrict @user review forever`] },
  { name: "unrestrict", category: "Users", summary: "Give a revoked ability back.",
    args: [
      { name: "user", type: "user", required: true, hint: "@username or id" },
      { name: "ability", type: "enum", required: true, hint: "ability to restore", options: ["chat", "sell", "buy", "review", "report", "favorite", "cart"] },
    ],
    examples: [`/unrestrict @user chat`] },
  { name: "set_zapret", category: "Users", aliases: ["block_buy"], summary: "Forbid buying a whole brand / category / color / tag (DB-enforced at checkout).",
    args: [
      { name: "user", type: "user", required: true, hint: "@username or id" },
      { name: "for", type: "what", required: true, hint: "type the word: for" },
      { name: "scope", type: "scope", required: true, hint: "brand:Dior · category:perfume · color:Black · tag:luxury" },
      { name: "term", type: "term", hint: "forever · 30d · a date (default: forever)" },
    ],
    examples: [`/set_zapret @user for brand:Dior`, `/set_zapret @user for color:Black 30d`] },
  { name: "unzapret", category: "Users", aliases: ["allow_buy"], summary: "Remove a scoped buying ban.",
    args: [
      { name: "user", type: "user", required: true, hint: "@username or id" },
      { name: "for", type: "what", required: true, hint: "type the word: for" },
      { name: "scope", type: "scope", required: true, hint: "brand:Dior · category:perfume · …" },
    ],
    examples: [`/unzapret @user for brand:Dior`] },
  { name: "verify", category: "Users", summary: "Grant or remove the verified badge.",
    args: [{ name: "user", type: "user", required: true, hint: "@username or id" }, { name: "state", type: "onoff", required: true, hint: "on / off", options: ONOFF }],
    examples: [`/verify @user on`] },
  { name: "role", category: "Users", summary: "Change an account's role.",
    args: [{ name: "user", type: "user", required: true, hint: "@username or id" }, { name: "role", type: "enum", required: true, hint: "customer · seller · courier", options: ["customer", "seller", "courier"] }],
    examples: [`/role @user courier`] },
  { name: "plan", category: "Users", summary: "Set the subscription plan.",
    args: [{ name: "user", type: "user", required: true, hint: "@username or id" }, { name: "plan", type: "enum", required: true, hint: "free · pro · elite", options: ["free", "pro", "elite"] }],
    examples: [`/plan @user elite`] },
  { name: "points", category: "Users", summary: "Set loyalty points.",
    args: [{ name: "user", type: "user", required: true, hint: "@username or id" }, { name: "value", type: "number", required: true, hint: "new points total" }],
    examples: [`/points @user 1500`] },
  { name: "cashback", category: "Users", summary: "Set the cashback balance (смн).",
    args: [{ name: "user", type: "user", required: true, hint: "@username or id" }, { name: "value", type: "money", required: true, hint: "new balance in смн" }],
    examples: [`/cashback @user 250`] },
  { name: "boost", category: "Users", summary: "Toggle seller promotion — boosted sellers surface more in feeds.",
    args: [{ name: "user", type: "user", required: true, hint: "seller @username or id" }, { name: "state", type: "onoff", required: true, hint: "on / off", options: ONOFF }],
    examples: [`/boost @seller on`] },
  { name: "rename_user", category: "Users", summary: "Force a new username.",
    args: [{ name: "user", type: "user", required: true, hint: "@username or id" }, { name: "name", type: "text", required: true, hint: "the new @username" }],
    examples: [`/rename_user @old newname`] },
  { name: "note", category: "Users", summary: "Attach a private admin note to a user.",
    args: [{ name: "user", type: "user", required: true, hint: "@username or id" }, { name: "text", type: "message", required: true, hint: "note (only admins see it)" }],
    examples: [`/note @user "called support twice"`] },
  { name: "whois", category: "Users", summary: "Print a compact dossier of an account.",
    args: [{ name: "user", type: "user", required: true, hint: "@username or id" }],
    examples: [`/whois @user`] },
  { name: "delete_user", category: "Users", danger: true, summary: "Permanently delete an account (irreversible).",
    args: [{ name: "user", type: "user", required: true, hint: "@username or id" }, { name: "confirm", type: "what", required: true, hint: "type: confirm" }],
    examples: [`/delete_user @user confirm`] },

  // ---- Products -------------------------------------------------------
  { name: "set_price", category: "Products", summary: "Change a product's price.",
    args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "value", type: "money", required: true, hint: "new price in смн" }],
    examples: [`/set_price <id> 499`] },
  { name: "set_stock", category: "Products", summary: "Set available stock.",
    args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "value", type: "number", required: true, hint: "units in stock" }],
    examples: [`/set_stock <id> 12`] },
  { name: "rename_product", category: "Products", summary: "Rename a product.",
    args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "title", type: "message", required: true, hint: "new title" }],
    examples: [`/rename_product <id> "Dior Sauvage 100ml"`] },
  { name: "set_brand", category: "Products", summary: "Change a product's brand.",
    args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "brand", type: "text", required: true, hint: "brand name" }],
    examples: [`/set_brand <id> Dior`] },
  { name: "set_category", category: "Products", summary: "Change a product's category slug.",
    args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "category", type: "text", required: true, hint: "category slug" }],
    examples: [`/set_category <id> perfume`] },
  { name: "promote", category: "Products", summary: "Toggle product promotion (featured — surfaces more in algorithms).",
    args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "state", type: "onoff", required: true, hint: "on / off", options: ONOFF }, { name: "term", type: "term", hint: "forever · 7d (default: forever)" }],
    examples: [`/promote <id> on 7d`] },
  { name: "hide", category: "Products", summary: "Shadow-hide a product from the storefront.",
    args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "state", type: "onoff", required: true, hint: "on / off", options: ONOFF }, { name: "term", type: "term", hint: "forever · 24h (default: forever)" }],
    examples: [`/hide <id> on`] },
  { name: "freeze", category: "Products", summary: "Freeze a listing — the seller can't edit or delete it.",
    args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "state", type: "onoff", required: true, hint: "on / off", options: ONOFF }, { name: "term", type: "term", hint: "forever · 24h" }],
    examples: [`/freeze <id> on`] },
  { name: "activate", category: "Products", summary: "Activate or deactivate a listing.",
    args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "state", type: "onoff", required: true, hint: "on / off", options: ONOFF }],
    examples: [`/activate <id> off`] },
  { name: "delete_product", category: "Products", danger: true, summary: "Permanently delete a product.",
    args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "confirm", type: "what", required: true, hint: "type: confirm" }],
    examples: [`/delete_product <id> confirm`] },

  // ---- Create / Catalog ----------------------------------------------
  { name: "create", category: "Create", summary: "Create anything: a promo, category, brand, tag or color.",
    args: [
      { name: "what", type: "enum", required: true, hint: "promo · category · brand · tag · color", options: ["promo", "category", "brand", "tag", "color"] },
      { name: "name", type: "text", required: true, hint: "code / name" },
      { name: "params", type: "message", hint: "promo: <percent|fixed|cashback> <value> [brand:X|category:Y] [min N] [term] · color: <#hex>" },
    ],
    examples: [`/create promo SUMMER percent 20 category:perfume min 500 friday`, `/create brand "Tom Ford"`, `/create color Emerald #22ff88`] },

  // ---- Broadcast ------------------------------------------------------
  { name: "announce", category: "Broadcast", summary: "Push a notification to a whole audience (paste images with Ctrl+V).",
    args: [
      { name: "target", type: "target", required: true, hint: "@a everyone · @p couriers · @e admins · @s sellers · @b buyers · @v verified · @user" },
      { name: "message", type: "message", required: true, hint: "the announcement text" },
    ],
    examples: [`/announce @a "🎉 Mid-season sale — up to 40% off!"`, `/announce @p "New courier rates from Monday"`] },
  { name: "send_message", category: "Broadcast", aliases: ["dm"], summary: "Send a real chat DM. Simple form: to @recipient. Spoof form: by @sender to @recipient.",
    args: [
      { name: "@recipient", type: "user", required: true, hint: "who receives it — or type 'by' to spoof a sender" },
      { name: "message", type: "message", required: true, hint: 'the message text in quotes — e.g. "hello"' },
    ],
    examples: [`/send_message @user "your order shipped"`, `/send_message by @seller to @buyer "thanks for your order!"`] },

  // ---- Data (generic deep edit) --------------------------------------
  { name: "edit", category: "Data", summary: "Change ANY field on a user, product or order — even avatar (paste a photo), birthday, registration date.",
    args: [
      { name: "target", type: "anytarget", required: true, hint: "@user · @a/@s/… (bulk) · product id · order id" },
      { name: "field", type: "field", required: true, hint: "the field to change — autocompletes" },
      { name: "value", type: "value", required: true, hint: "new value · on/off · a date · or <photo> for image fields" },
    ],
    examples: [`/edit @sudays_1xml avatar <photo>`, `/edit @user birthday 2001-04-12`, `/edit @user created_at 2023-01-01`, `/edit <productId> price 499`, `/edit @s plan pro`] },
  { name: "add", category: "Data", summary: "Append something: a product image/tag, or a user link/social.",
    args: [
      { name: "what", type: "enum", required: true, hint: "image · tag · link · social", options: ["image", "tag", "link", "social"] },
      { name: "target", type: "anytarget", required: true, hint: "product id (image/tag) · @user (link/social)" },
      { name: "params", type: "message", hint: "image: <photo> · tag: <tag> · link: <label> <url> · social: <platform> <handle>" },
    ],
    examples: [`/add image <productId> <photo>`, `/add tag <productId> luxury`, `/add link @user Website https://oasis.app`, `/add social @user instagram oasislux`] },
  { name: "delete", category: "Data", danger: true, summary: "Delete anything by id/@user — auto-detects user · product · order · promo.",
    args: [
      { name: "target", type: "anytarget", required: true, hint: "@user · product id · order id · promo code" },
      { name: "confirm", type: "what", required: true, hint: "type: confirm" },
    ],
    examples: [`/delete @user confirm`, `/delete <productId> confirm`, `/delete <orderId> confirm`] },
  { name: "gift", category: "Data", summary: "ADD loyalty points or cashback to a user or a whole audience (incremental).",
    args: [
      { name: "target", type: "anytarget", required: true, hint: "@user · @a/@b/@s/… for bulk" },
      { name: "kind", type: "enum", required: true, hint: "points · cashback", options: ["points", "cashback"] },
      { name: "amount", type: "number", required: true, hint: "how much to add (can be negative)" },
    ],
    examples: [`/gift @user points 500`, `/gift @a cashback 50`] },
  { name: "notify", category: "Data", summary: "Drop a custom notification into one inbox or an audience.",
    args: [
      { name: "target", type: "target", required: true, hint: "@a/@p/@e/@s/@b/@v · @user" },
      { name: "title", type: "text", required: true, hint: "notification title (quote it)" },
      { name: "body", type: "message", hint: "notification body" },
    ],
    examples: [`/notify @user "Order update" "Your parcel is out for delivery"`] },
  { name: "wipe", category: "Data", danger: true, summary: "Empty a user's cart and/or favorites.",
    args: [
      { name: "user", type: "user", required: true, hint: "@username or id" },
      { name: "what", type: "enum", required: true, hint: "cart · favorites · all", options: ["cart", "favorites", "all"] },
    ],
    examples: [`/wipe @user cart`, `/wipe @user all`] },

  // ---- Orders ---------------------------------------------------------
  { name: "set_status", category: "Orders", summary: "Move an order along the fulfilment flow.",
    args: [{ name: "order", type: "order", required: true, hint: "order id" }, { name: "status", type: "enum", required: true, hint: "placed · processing · out_for_delivery · arrived · fulfilled · cancelled", options: ["placed", "processing", "out_for_delivery", "arrived", "fulfilled", "cancelled"] }],
    examples: [`/set_status <orderId> out_for_delivery`] },
  { name: "mark_paid", category: "Orders", summary: "Mark an order as paid (stamps paid_at now).",
    args: [{ name: "order", type: "order", required: true, hint: "order id" }],
    examples: [`/mark_paid <orderId>`] },
  { name: "cancel_order", category: "Orders", summary: "Cancel an order.",
    args: [{ name: "order", type: "order", required: true, hint: "order id" }, { name: "reason", type: "message", hint: "optional reason" }],
    examples: [`/cancel_order <orderId> "buyer request"`] },
  { name: "set_courier", category: "Orders", summary: "Assign / change the courier on an order.",
    args: [{ name: "order", type: "order", required: true, hint: "order id" }, { name: "name", type: "text", required: true, hint: "courier name" }, { name: "phone", type: "text", hint: "phone" }, { name: "vehicle", type: "text", hint: "vehicle" }],
    examples: [`/set_courier <orderId> "Anvar Rahimov" +992900000000 "Opel Astra"`] },
  { name: "refund", category: "Orders", summary: "Cancel an order AND credit its total back to the buyer's cashback.",
    args: [{ name: "order", type: "order", required: true, hint: "order id" }, { name: "reason", type: "message", hint: "optional reason (shown to the buyer)" }],
    examples: [`/refund <orderId> "out of stock"`] },
  { name: "restock", category: "Products", summary: "Add (or subtract) units from a product's stock.",
    args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "amount", type: "number", required: true, hint: "+units (or a negative number)" }],
    examples: [`/restock <productId> 20`, `/restock <productId> -5`] },
  { name: "promote_scope", category: "Products", summary: "Feature/un-feature EVERY product of a brand or category at once.",
    args: [{ name: "scope", type: "scope", required: true, hint: "brand:Dior · category:perfume" }, { name: "state", type: "onoff", required: true, hint: "on / off", options: ONOFF }],
    examples: [`/promote_scope brand:Dior on`, `/promote_scope category:watch off`] },

  // ---- Query ----------------------------------------------------------
  { name: "find", category: "Query", summary: "Search users / products / orders and print matches with their ids.",
    args: [{ name: "type", type: "enum", required: true, hint: "users · products · orders", options: ["users", "products", "orders"] }, { name: "query", type: "message", required: true, hint: "name, brand, region…" }],
    examples: [`/find products dior`, `/find users sud`] },
  { name: "recent", category: "Query", summary: "List the newest users / products / orders.",
    args: [{ name: "type", type: "enum", required: true, hint: "users · products · orders", options: ["users", "products", "orders"] }, { name: "count", type: "number", hint: "how many (default 8)" }],
    examples: [`/recent orders`, `/recent users 15`] },
  { name: "stats", category: "Query", summary: "Print a live snapshot of the platform (users, products, orders, revenue).",
    args: [], examples: [`/stats`] },
  { name: "inspect", category: "Query", summary: "Dump a product or order's key fields into the console.",
    args: [{ name: "target", type: "anytarget", required: true, hint: "product id · order id · @user" }],
    examples: [`/inspect <productId>`, `/inspect <orderId>`] },
  { name: "reviews_of", category: "Query", summary: "List the latest reviews left on a product or a user.",
    args: [{ name: "target", type: "anytarget", required: true, hint: "product id · @user" }], examples: [`/reviews_of <productId>`] },
  { name: "favorites_of", category: "Query", summary: "Who favorited a product.",
    args: [{ name: "product", type: "product", required: true, hint: "product id" }], examples: [`/favorites_of <productId>`] },
  { name: "cart_of", category: "Query", summary: "What's in a user's cart right now.",
    args: [{ name: "user", type: "user", required: true, hint: "@username or id" }], examples: [`/cart_of @user`] },
  { name: "blocked_of", category: "Query", summary: "List a user's active scoped purchase bans.",
    args: [{ name: "user", type: "user", required: true, hint: "@username or id" }], examples: [`/blocked_of @user`] },
  { name: "orders_of", category: "Query", summary: "List a buyer's recent orders.",
    args: [{ name: "user", type: "user", required: true, hint: "@buyer" }, { name: "count", type: "number", hint: "default 10" }], examples: [`/orders_of @user`] },
  { name: "orders_by", category: "Query", summary: "List a seller's recent orders.",
    args: [{ name: "seller", type: "user", required: true, hint: "@seller" }, { name: "count", type: "number", hint: "default 10" }], examples: [`/orders_by @seller`] },
  { name: "products_of", category: "Query", summary: "List a seller's products.",
    args: [{ name: "seller", type: "user", required: true, hint: "@seller" }, { name: "count", type: "number", hint: "default 12" }], examples: [`/products_of @seller`] },
  { name: "seller_of", category: "Query", summary: "Who sells a given product.",
    args: [{ name: "product", type: "product", required: true, hint: "product id" }], examples: [`/seller_of <productId>`] },

  // ---- Stats ----------------------------------------------------------
  { name: "check", category: "Stats", summary: "Pull statistics for anything — product/order/user/seller. e.g. order stats of a product.",
    args: [
      { name: "metric", type: "enum", required: true, hint: "what to measure", options: ["product_stats", "order_stats", "user_stats", "seller_stats", "buyer_stats", "promo_stats", "reviews", "sales", "revenue"] },
      { name: "of", type: "what", hint: "optional connector word: of" },
      { name: "target", type: "anytarget", required: true, hint: "@user · product id · order id · promo code" },
    ],
    examples: [`/check product_stats of <productId>`, `/check seller_stats @seller`, `/check order_stats <orderId>`] },
  { name: "top", category: "Stats", summary: "Leaderboards — top sellers / products / spenders / brands / promos.",
    args: [{ name: "kind", type: "enum", required: true, hint: "sellers · products · spenders · brands · promos", options: ["sellers", "products", "spenders", "brands", "promos"] }, { name: "count", type: "number", hint: "default 10" }],
    examples: [`/top sellers`, `/top products 15`] },
  { name: "revenue", category: "Stats", summary: "Total revenue over a window.",
    args: [{ name: "window", type: "enum", hint: "today · 7d · 30d · all (default all)", options: ["today", "7d", "30d", "all"] }],
    examples: [`/revenue 30d`, `/revenue today`] },
  { name: "count", category: "Stats", summary: "Count records of a kind (with built-in filters).",
    args: [{ name: "what", type: "enum", required: true, hint: "users · products · orders · sellers · couriers · admins · banned · verified · active_orders · out_of_stock", options: ["users", "products", "orders", "sellers", "couriers", "admins", "banned", "verified", "active_orders", "out_of_stock"] }],
    examples: [`/count users`, `/count out_of_stock`] },
  { name: "sales", category: "Stats", summary: "Units sold + revenue for a product or a seller.",
    args: [{ name: "target", type: "anytarget", required: true, hint: "product id · @seller" }], examples: [`/sales <productId>`, `/sales @seller`] },
  { name: "region_stats", category: "Stats", summary: "Orders & revenue per region.", args: [], examples: [`/region_stats`] },
  { name: "status_breakdown", category: "Stats", summary: "How many orders sit in each status.", args: [], examples: [`/status_breakdown`] },
  { name: "conversion", category: "Stats", summary: "Platform funnel: favorites → carts → orders.", args: [], examples: [`/conversion`] },
  { name: "inventory_health", category: "Stats", summary: "Out-of-stock, low-stock and hidden product counts.", args: [], examples: [`/inventory_health`] },
  { name: "daily", category: "Stats", summary: "Orders & revenue for the last N days.",
    args: [{ name: "days", type: "number", hint: "default 7" }], examples: [`/daily 14`] },

  // ---- Orders (flow shortcuts) ---------------------------------------
  { name: "process", category: "Orders", summary: "Set an order to processing.", args: [{ name: "order", type: "order", required: true, hint: "order id" }], examples: [`/process <orderId>`] },
  { name: "dispatch", category: "Orders", summary: "Set an order out for delivery.", args: [{ name: "order", type: "order", required: true, hint: "order id" }], examples: [`/dispatch <orderId>`] },
  { name: "arrive", category: "Orders", summary: "Mark an order as arrived.", args: [{ name: "order", type: "order", required: true, hint: "order id" }], examples: [`/arrive <orderId>`] },
  { name: "fulfill", category: "Orders", summary: "Mark an order fulfilled (delivered).", args: [{ name: "order", type: "order", required: true, hint: "order id" }], examples: [`/fulfill <orderId>`] },

  // ---- Products (shortcuts) ------------------------------------------
  { name: "feature", category: "Products", summary: "Feature a product (promotion on).", args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "term", type: "term", hint: "forever · 7d" }], examples: [`/feature <productId> 7d`] },
  { name: "unfeature", category: "Products", summary: "Remove a product's promotion.", args: [{ name: "product", type: "product", required: true, hint: "product id" }], examples: [`/unfeature <productId>`] },
  { name: "discount", category: "Products", summary: "Drop a product's price by a percentage.", args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "percent", type: "number", required: true, hint: "e.g. 20" }], examples: [`/discount <productId> 20`] },
  { name: "markup", category: "Products", summary: "Raise a product's price by a percentage.", args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "percent", type: "number", required: true, hint: "e.g. 15" }], examples: [`/markup <productId> 15`] },
  { name: "duplicate", category: "Products", summary: "Clone a product into a new draft listing.", args: [{ name: "product", type: "product", required: true, hint: "product id" }], examples: [`/duplicate <productId>`] },
  { name: "deactivate_all", category: "Products", danger: true, summary: "Hide ALL of a seller's products.", args: [{ name: "seller", type: "user", required: true, hint: "@seller" }], examples: [`/deactivate_all @seller`] },
  { name: "activate_all", category: "Products", summary: "Re-list ALL of a seller's products.", args: [{ name: "seller", type: "user", required: true, hint: "@seller" }], examples: [`/activate_all @seller`] },

  // ---- Users (shortcuts) ---------------------------------------------
  { name: "mute", category: "Users", summary: "Mute a user's chat (alias of restrict chat).", args: [{ name: "user", type: "user", required: true, hint: "@user" }, { name: "term", type: "term", hint: "forever · 2h" }], examples: [`/mute @user 2h`] },
  { name: "unmute", category: "Users", summary: "Let a user chat again.", args: [{ name: "user", type: "user", required: true, hint: "@user" }], examples: [`/unmute @user`] },
  { name: "unverify", category: "Users", summary: "Remove a user's verified badge.", args: [{ name: "user", type: "user", required: true, hint: "@user" }], examples: [`/unverify @user`] },
  { name: "tier", category: "Users", summary: "Set a user's loyalty tier.", args: [{ name: "user", type: "user", required: true, hint: "@user" }, { name: "tier", type: "enum", required: true, hint: "Bronze · Silver · Gold · Platinum", options: ["Bronze", "Silver", "Gold", "Platinum"] }], examples: [`/tier @user Gold`] },
  { name: "warn", category: "Users", summary: "Send a formal warning notification to a user.", args: [{ name: "user", type: "user", required: true, hint: "@user" }, { name: "reason", type: "message", required: true, hint: "what they did" }], examples: [`/warn @user "spamming reviews"`] },
  { name: "promote_user", category: "Users", summary: "Turn ON seller promotion (boost).", args: [{ name: "user", type: "user", required: true, hint: "@seller" }], examples: [`/promote_user @seller`] },
  { name: "demote_user", category: "Users", summary: "Turn OFF seller promotion.", args: [{ name: "user", type: "user", required: true, hint: "@seller" }], examples: [`/demote_user @seller`] },
  { name: "nick", category: "Users", summary: "Rename a user (alias of rename_user).", args: [{ name: "user", type: "user", required: true, hint: "@user" }, { name: "name", type: "text", required: true, hint: "new @username" }], examples: [`/nick @old new`] },
  { name: "birthday", category: "Users", summary: "Set a user's birthday.", args: [{ name: "user", type: "user", required: true, hint: "@user" }, { name: "date", type: "text", required: true, hint: "YYYY-MM-DD" }], examples: [`/birthday @user 2000-05-01`] },
  { name: "clear_notifications", category: "Users", summary: "Wipe a user's notification inbox.", args: [{ name: "user", type: "user", required: true, hint: "@user" }], examples: [`/clear_notifications @user`] },
  { name: "welcome", category: "Users", summary: "Send a friendly welcome notification.", args: [{ name: "user", type: "user", required: true, hint: "@user" }], examples: [`/welcome @user`] },

  // ---- Social / moderation lists -------------------------------------
  { name: "block_pair", category: "Data", summary: "Block two users from chatting (both directions).", args: [{ name: "a", type: "user", required: true, hint: "@user a" }, { name: "b", type: "user", required: true, hint: "@user b" }], examples: [`/block_pair @a @b`] },
  { name: "unblock_pair", category: "Data", summary: "Remove a chat block between two users.", args: [{ name: "a", type: "user", required: true, hint: "@user a" }, { name: "b", type: "user", required: true, hint: "@user b" }], examples: [`/unblock_pair @a @b`] },
  { name: "delete_chat", category: "Data", danger: true, summary: "Delete the conversation between two users.", args: [{ name: "a", type: "user", required: true, hint: "@user a" }, { name: "b", type: "user", required: true, hint: "@user b" }], examples: [`/delete_chat @a @b`] },
  { name: "violations_of", category: "Query", summary: "List the discipline record of a user or product.", args: [{ name: "target", type: "anytarget", required: true, hint: "@user · product id" }], examples: [`/violations_of @user`] },
  { name: "reports_on", category: "Query", summary: "List abuse reports filed against a user.", args: [{ name: "user", type: "user", required: true, hint: "@user" }], examples: [`/reports_on @user`] },
  { name: "conversations", category: "Query", summary: "List the most recent chat threads.", args: [{ name: "count", type: "number", hint: "default 12" }], examples: [`/conversations`] },
  { name: "promos", category: "Query", summary: "List promo codes and their usage.", args: [{ name: "count", type: "number", hint: "default 20" }], examples: [`/promos`] },

  // ---- Inventory queries ---------------------------------------------
  { name: "lowstock", category: "Query", summary: "Products running low on stock.", args: [{ name: "threshold", type: "number", hint: "≤ this many units (default 3)" }], examples: [`/lowstock 5`] },
  { name: "outofstock", category: "Query", summary: "Products with zero stock.", args: [{ name: "count", type: "number", hint: "default 20" }], examples: [`/outofstock`] },
  { name: "zero_sales", category: "Query", summary: "Products that have never been ordered.", args: [{ name: "count", type: "number", hint: "default 20" }], examples: [`/zero_sales`] },
  { name: "pending", category: "Query", summary: "Orders currently in flight.", args: [{ name: "count", type: "number", hint: "default 15" }], examples: [`/pending`] },
  { name: "unpaid", category: "Query", summary: "Orders that were never paid.", args: [{ name: "count", type: "number", hint: "default 15" }], examples: [`/unpaid`] },
  { name: "cancelled", category: "Query", summary: "Recently cancelled orders.", args: [{ name: "count", type: "number", hint: "default 15" }], examples: [`/cancelled`] },
  { name: "biggest_orders", category: "Stats", summary: "The largest orders by total.", args: [{ name: "count", type: "number", hint: "default 10" }], examples: [`/biggest_orders`] },

  // ---- Promo controls -------------------------------------------------
  { name: "enable_promo", category: "Create", summary: "Activate a promo code.", args: [{ name: "code", type: "text", required: true, hint: "promo code" }], examples: [`/enable_promo SUMMER`] },
  { name: "disable_promo", category: "Create", summary: "Deactivate a promo code.", args: [{ name: "code", type: "text", required: true, hint: "promo code" }], examples: [`/disable_promo SUMMER`] },
  { name: "expire_promo", category: "Create", summary: "Force a promo to expire right now.", args: [{ name: "code", type: "text", required: true, hint: "promo code" }], examples: [`/expire_promo SUMMER`] },

  // ---- More stats -----------------------------------------------------
  { name: "growth", category: "Stats", summary: "Signups this week vs last week.", args: [], examples: [`/growth`] },
  { name: "aov", category: "Stats", summary: "Average order value.", args: [], examples: [`/aov`] },
  { name: "repeat_rate", category: "Stats", summary: "Share of buyers who ordered more than once.", args: [], examples: [`/repeat_rate`] },
  { name: "active_users", category: "Stats", summary: "Distinct buyers active in the last N days.", args: [{ name: "days", type: "number", hint: "default 30" }], examples: [`/active_users 7`] },
  { name: "ltv", category: "Stats", summary: "Average lifetime value per buyer.", args: [], examples: [`/ltv`] },
  { name: "churn", category: "Stats", summary: "Buyers whose last order was over 30 days ago.", args: [{ name: "days", type: "number", hint: "default 30" }], examples: [`/churn`] },
  { name: "new_today", category: "Stats", summary: "Signups in the last 24h.", args: [], examples: [`/new_today`] },
  { name: "orders_today", category: "Stats", summary: "Orders placed in the last 24h.", args: [], examples: [`/orders_today`] },
  { name: "peak_hour", category: "Stats", summary: "Which hour of day sees the most orders.", args: [], examples: [`/peak_hour`] },
  { name: "best_day", category: "Stats", summary: "Highest-revenue day in the last 30.", args: [], examples: [`/best_day`] },
  { name: "avg_rating", category: "Stats", summary: "Average product rating across the catalog.", args: [], examples: [`/avg_rating`] },
  { name: "rating_dist", category: "Stats", summary: "How product ratings are distributed (1–5★).", args: [], examples: [`/rating_dist`] },
  { name: "role_dist", category: "Stats", summary: "Accounts per role.", args: [], examples: [`/role_dist`] },
  { name: "plan_dist", category: "Stats", summary: "Accounts per subscription plan.", args: [], examples: [`/plan_dist`] },
  { name: "tier_dist", category: "Stats", summary: "Accounts per loyalty tier.", args: [], examples: [`/tier_dist`] },
  { name: "verified_rate", category: "Stats", summary: "Share of verified accounts.", args: [], examples: [`/verified_rate`] },
  { name: "catalog_value", category: "Stats", summary: "Total retail value of all stock (price × stock).", args: [], examples: [`/catalog_value`] },
  { name: "stock_total", category: "Stats", summary: "Total units in stock across the catalog.", args: [], examples: [`/stock_total`] },
  { name: "price_avg", category: "Stats", summary: "Average price, optionally within a brand/category.", args: [{ name: "scope", type: "scope", hint: "brand:Dior · category:perfume (optional)" }], examples: [`/price_avg`, `/price_avg brand:Dior`] },

  // ---- Query (taxonomy + lookups) ------------------------------------
  { name: "brands", category: "Query", summary: "List every brand in the taxonomy.", args: [], examples: [`/brands`] },
  { name: "categories", category: "Query", summary: "List every category.", args: [], examples: [`/categories`] },
  { name: "tags", category: "Query", summary: "List every tag.", args: [], examples: [`/tags`] },
  { name: "colors", category: "Query", summary: "List every color swatch.", args: [], examples: [`/colors`] },
  { name: "order_items", category: "Query", summary: "List the line items of an order.", args: [{ name: "order", type: "order", required: true, hint: "order id" }], examples: [`/order_items <orderId>`] },
  { name: "track", category: "Query", summary: "Show an order's live delivery status.", args: [{ name: "order", type: "order", required: true, hint: "order id" }], examples: [`/track <orderId>`] },
  { name: "find_phone", category: "Query", summary: "Find an account by phone number.", args: [{ name: "phone", type: "text", required: true, hint: "any part of the phone" }], examples: [`/find_phone 992900`] },
  { name: "find_email", category: "Query", summary: "Find an account by email.", args: [{ name: "email", type: "text", required: true, hint: "any part of the email" }], examples: [`/find_email gmail`] },
  { name: "socials_of", category: "Query", summary: "Show a user's linked socials.", args: [{ name: "user", type: "user", required: true, hint: "@user" }], examples: [`/socials_of @user`] },
  { name: "links_of", category: "Query", summary: "Show a user's custom links.", args: [{ name: "user", type: "user", required: true, hint: "@user" }], examples: [`/links_of @user`] },
  { name: "tag_search", category: "Query", summary: "Find products carrying a tag.", args: [{ name: "tag", type: "text", required: true, hint: "tag name" }], examples: [`/tag_search luxury`] },
  { name: "random_user", category: "Query", summary: "Pick a random account.", args: [], examples: [`/random_user`] },

  // ---- Product / order variations (aliases & shortcuts) --------------
  { name: "unhide", category: "Products", summary: "Un-hide a product (hide off).", args: [{ name: "product", type: "product", required: true, hint: "product id" }], examples: [`/unhide <productId>`] },
  { name: "unfreeze", category: "Products", summary: "Unfreeze a product (freeze off).", args: [{ name: "product", type: "product", required: true, hint: "product id" }], examples: [`/unfreeze <productId>`] },
  { name: "relist", category: "Products", summary: "Activate a product (back on the storefront).", args: [{ name: "product", type: "product", required: true, hint: "product id" }], examples: [`/relist <productId>`] },
  { name: "delist", category: "Products", summary: "Deactivate a product (off the storefront).", args: [{ name: "product", type: "product", required: true, hint: "product id" }], examples: [`/delist <productId>`] },
  { name: "mute_review", category: "Users", summary: "Stop a user leaving reviews.", args: [{ name: "user", type: "user", required: true, hint: "@user" }, { name: "term", type: "term", hint: "forever · 7d" }], examples: [`/mute_review @user`] },
  { name: "mute_sell", category: "Users", summary: "Stop a user from selling.", args: [{ name: "user", type: "user", required: true, hint: "@user" }, { name: "term", type: "term", hint: "forever · 7d" }], examples: [`/mute_sell @user`] },
  { name: "mute_buy", category: "Users", summary: "Stop a user from buying.", args: [{ name: "user", type: "user", required: true, hint: "@user" }, { name: "term", type: "term", hint: "forever · 7d" }], examples: [`/mute_buy @user`] },

  // ---- Broadcast variations ------------------------------------------
  { name: "broadcast", category: "Broadcast", summary: "Announce to everyone (alias of announce @a).", args: [{ name: "message", type: "message", required: true, hint: "the announcement" }], examples: [`/broadcast "Flash sale tonight!"`] },
  { name: "announce_sellers", category: "Broadcast", summary: "Announce to all sellers.", args: [{ name: "message", type: "message", required: true, hint: "the announcement" }], examples: [`/announce_sellers "New payout schedule"`] },
  { name: "announce_couriers", category: "Broadcast", summary: "Announce to all couriers.", args: [{ name: "message", type: "message", required: true, hint: "the announcement" }], examples: [`/announce_couriers "Shift change"`] },
  { name: "gift_all", category: "Data", summary: "Give points/cashback to EVERYONE.", args: [{ name: "kind", type: "enum", required: true, hint: "points · cashback", options: ["points", "cashback"] }, { name: "amount", type: "number", required: true, hint: "how much" }], examples: [`/gift_all cashback 25`] },

  // ---- Console --------------------------------------------------------
  { name: "flip", category: "Console", clientOnly: true, summary: "Flip a coin.", args: [], examples: [`/flip`] },
  { name: "roll", category: "Console", clientOnly: true, summary: "Roll a die.", args: [{ name: "sides", type: "number", hint: "default 6" }], examples: [`/roll 20`] },
  { name: "uuid", category: "Console", clientOnly: true, summary: "Generate a random UUID.", args: [], examples: [`/uuid`] },
  { name: "motd", category: "Console", clientOnly: true, summary: "Message of the day.", args: [], examples: [`/motd`] },

  // ---- Distributions & rates -----------------------------------------
  { name: "condition_dist", category: "Stats", summary: "Products by condition (new/used…).", args: [], examples: [`/condition_dist`] },
  { name: "type_dist", category: "Stats", summary: "Products by type (perfume/watch/glasses).", args: [], examples: [`/type_dist`] },
  { name: "category_dist", category: "Stats", summary: "Products per category slug.", args: [], examples: [`/category_dist`] },
  { name: "fulfillment_rate", category: "Stats", summary: "Share of orders fulfilled.", args: [], examples: [`/fulfillment_rate`] },
  { name: "cancel_rate", category: "Stats", summary: "Share of orders cancelled.", args: [], examples: [`/cancel_rate`] },
  { name: "paid_rate", category: "Stats", summary: "Share of orders actually paid.", args: [], examples: [`/paid_rate`] },
  { name: "avg_items", category: "Stats", summary: "Average line items per order.", args: [], examples: [`/avg_items`] },
  { name: "discount_total", category: "Stats", summary: "Total discount given across orders.", args: [], examples: [`/discount_total`] },
  { name: "reviews_count", category: "Stats", summary: "Total product reviews.", args: [], examples: [`/reviews_count`] },
  { name: "messages_count", category: "Stats", summary: "Total chat messages sent.", args: [], examples: [`/messages_count`] },
  { name: "favorites_total", category: "Stats", summary: "Total favorites across the platform.", args: [], examples: [`/favorites_total`] },
  { name: "cart_total", category: "Stats", summary: "Total items sitting in carts.", args: [], examples: [`/cart_total`] },
  { name: "buyers_count", category: "Stats", summary: "Distinct accounts that ever ordered.", args: [], examples: [`/buyers_count`] },

  // ---- Lists ----------------------------------------------------------
  { name: "top_rated", category: "Query", summary: "Highest-rated products.", args: [{ name: "count", type: "number", hint: "default 10" }], examples: [`/top_rated`] },
  { name: "worst_rated", category: "Query", summary: "Lowest-rated products.", args: [{ name: "count", type: "number", hint: "default 10" }], examples: [`/worst_rated`] },
  { name: "priciest", category: "Query", summary: "Most expensive products.", args: [{ name: "count", type: "number", hint: "default 10" }], examples: [`/priciest`] },
  { name: "cheapest", category: "Query", summary: "Cheapest products.", args: [{ name: "count", type: "number", hint: "default 10" }], examples: [`/cheapest`] },
  { name: "banned_list", category: "Query", summary: "Currently banned accounts.", args: [{ name: "count", type: "number", hint: "default 20" }], examples: [`/banned_list`] },
  { name: "boosted_list", category: "Query", summary: "Promoted (boosted) sellers.", args: [], examples: [`/boosted_list`] },
  { name: "admins_list", category: "Query", summary: "All admin accounts.", args: [], examples: [`/admins_list`] },
  { name: "couriers_list", category: "Query", summary: "All courier accounts.", args: [], examples: [`/couriers_list`] },
  { name: "sellers_list", category: "Query", summary: "Seller accounts.", args: [{ name: "count", type: "number", hint: "default 20" }], examples: [`/sellers_list`] },
  { name: "verified_list", category: "Query", summary: "Verified accounts.", args: [{ name: "count", type: "number", hint: "default 20" }], examples: [`/verified_list`] },
  { name: "featured_list", category: "Query", summary: "Products currently featured.", args: [], examples: [`/featured_list`] },
  { name: "hidden_list", category: "Query", summary: "Products currently shadow-hidden.", args: [], examples: [`/hidden_list`] },
  { name: "open_reports", category: "Query", summary: "Abuse reports still open.", args: [{ name: "count", type: "number", hint: "default 15" }], examples: [`/open_reports`] },
  { name: "paid_orders", category: "Query", summary: "Recently paid orders.", args: [{ name: "count", type: "number", hint: "default 15" }], examples: [`/paid_orders`] },

  // ---- User role / plan / balance shortcuts --------------------------
  { name: "make_seller", category: "Users", summary: "Set a user's role to seller.", args: [{ name: "user", type: "user", required: true, hint: "@user" }], examples: [`/make_seller @user`] },
  { name: "make_courier", category: "Users", summary: "Set a user's role to courier.", args: [{ name: "user", type: "user", required: true, hint: "@user" }], examples: [`/make_courier @user`] },
  { name: "make_customer", category: "Users", summary: "Set a user's role to customer.", args: [{ name: "user", type: "user", required: true, hint: "@user" }], examples: [`/make_customer @user`] },
  { name: "upgrade", category: "Users", summary: "Bump a user to the elite plan.", args: [{ name: "user", type: "user", required: true, hint: "@user" }], examples: [`/upgrade @user`] },
  { name: "downgrade", category: "Users", summary: "Drop a user to the free plan.", args: [{ name: "user", type: "user", required: true, hint: "@user" }], examples: [`/downgrade @user`] },
  { name: "add_points", category: "Users", summary: "Add loyalty points (alias of gift points).", args: [{ name: "user", type: "user", required: true, hint: "@user" }, { name: "amount", type: "number", required: true, hint: "points" }], examples: [`/add_points @user 100`] },
  { name: "add_cashback", category: "Users", summary: "Add cashback (alias of gift cashback).", args: [{ name: "user", type: "user", required: true, hint: "@user" }, { name: "amount", type: "number", required: true, hint: "смн" }], examples: [`/add_cashback @user 50`] },
  { name: "reset_points", category: "Users", summary: "Zero out a user's loyalty points.", args: [{ name: "user", type: "user", required: true, hint: "@user" }], examples: [`/reset_points @user`] },
  { name: "reset_cashback", category: "Users", summary: "Zero out a user's cashback.", args: [{ name: "user", type: "user", required: true, hint: "@user" }], examples: [`/reset_cashback @user`] },
  { name: "bio", category: "Users", summary: "Set a user's bio.", args: [{ name: "user", type: "user", required: true, hint: "@user" }, { name: "text", type: "message", required: true, hint: "the bio" }], examples: [`/bio @user "luxury reseller"`] },

  // ---- Product field shortcuts ---------------------------------------
  { name: "sale", category: "Products", summary: "Discount a product by a percentage (alias).", args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "percent", type: "number", required: true, hint: "e.g. 25" }], examples: [`/sale <productId> 25`] },
  { name: "sold_out", category: "Products", summary: "Set a product's stock to zero.", args: [{ name: "product", type: "product", required: true, hint: "product id" }], examples: [`/sold_out <productId>`] },
  { name: "set_color", category: "Products", summary: "Set a product's color.", args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "color", type: "text", required: true, hint: "color name" }], examples: [`/set_color <id> Black`] },
  { name: "set_size", category: "Products", summary: "Set a product's size.", args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "size", type: "text", required: true, hint: "size" }], examples: [`/set_size <id> 100ml`] },
  { name: "set_condition", category: "Products", summary: "Set a product's condition.", args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "condition", type: "enum", required: true, hint: "new · like_new · used", options: ["new", "like_new", "used"] }], examples: [`/set_condition <id> new`] },
  { name: "set_type", category: "Products", summary: "Set a product's type.", args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "type", type: "enum", required: true, hint: "perfume · watch · glasses", options: ["perfume", "watch", "glasses"] }], examples: [`/set_type <id> watch`] },
  { name: "set_description", category: "Products", summary: "Set a product's description.", args: [{ name: "product", type: "product", required: true, hint: "product id" }, { name: "text", type: "message", required: true, hint: "the description" }], examples: [`/set_description <id> "..."`] },

  // ---- Broadcast (more) ----------------------------------------------
  { name: "announce_buyers", category: "Broadcast", summary: "Announce to all buyers.", args: [{ name: "message", type: "message", required: true, hint: "the announcement" }], examples: [`/announce_buyers "..."`] },
  { name: "announce_verified", category: "Broadcast", summary: "Announce to verified accounts.", args: [{ name: "message", type: "message", required: true, hint: "the announcement" }], examples: [`/announce_verified "..."`] },

  // ---- Console (text utils) ------------------------------------------
  { name: "sessions", category: "Console", clientOnly: true, summary: "List open terminals.", args: [], examples: [`/sessions`] },
  { name: "reverse", category: "Console", clientOnly: true, summary: "Reverse text.", args: [{ name: "text", type: "message", required: true, hint: "any text" }], examples: [`/reverse hello`] },
  { name: "upper", category: "Console", clientOnly: true, summary: "UPPERCASE text.", args: [{ name: "text", type: "message", required: true, hint: "any text" }], examples: [`/upper hi`] },
  { name: "lower", category: "Console", clientOnly: true, summary: "lowercase text.", args: [{ name: "text", type: "message", required: true, hint: "any text" }], examples: [`/lower HI`] },
  { name: "len", category: "Console", clientOnly: true, summary: "Count characters.", args: [{ name: "text", type: "message", required: true, hint: "any text" }], examples: [`/len hello`] },
  { name: "pick", category: "Console", clientOnly: true, summary: "Randomly pick one of the given options.", args: [{ name: "options", type: "message", required: true, hint: "a b c …" }], examples: [`/pick red green blue`] },
  { name: "date", category: "Console", clientOnly: true, summary: "Print the current date & time.", args: [], examples: [`/date`] },
  { name: "calc", category: "Console", clientOnly: true, summary: "Quick calculator.", args: [{ name: "expr", type: "message", required: true, hint: "e.g. 1500*0.2" }], examples: [`/calc 1500*0.2`] },
  { name: "history", category: "Console", clientOnly: true, summary: "Show this terminal's command history.", args: [], examples: [`/history`] },
  { name: "banner", category: "Console", clientOnly: true, summary: "Reprint the welcome banner.", args: [], examples: [`/banner`] },
  { name: "ping", category: "Console", clientOnly: true, summary: "pong.", args: [], examples: [`/ping`] },
  { name: "help", category: "Console", clientOnly: true, summary: "List commands, or explain one in detail.",
    args: [{ name: "command", type: "text", hint: "a command name (optional)" }], examples: [`/help`, `/help ban`] },
  { name: "commands", category: "Console", clientOnly: true, summary: "Open the commands reference drawer.", args: [], examples: [`/commands`] },
  { name: "clear", category: "Console", clientOnly: true, aliases: ["cls"], summary: "Clear the console.", args: [], examples: [`/clear`] },
  { name: "echo", category: "Console", clientOnly: true, summary: "Print text back.", args: [{ name: "text", type: "message", hint: "anything" }], examples: [`/echo hello`] },
  { name: "color", category: "Console", clientOnly: true, summary: "Recolor the console theme.", args: [{ name: "name", type: "enum", hint: "green · amber · cyan · magenta · white", options: ["green", "amber", "cyan", "magenta", "white"] }], examples: [`/color amber`] },
  { name: "whoami", category: "Console", clientOnly: true, summary: "Print the current operator.", args: [], examples: [`/whoami`] },
];

export const CATEGORIES = ["Users", "Products", "Orders", "Data", "Query", "Stats", "Create", "Broadcast", "Console"] as const;

const BY_NAME = new Map<string, CmdSpec>();
for (const c of COMMANDS) {
  BY_NAME.set(c.name, c);
  for (const a of c.aliases ?? []) BY_NAME.set(a, c);
}

export function findCommand(name: string): CmdSpec | undefined {
  return BY_NAME.get(name.replace(/^\//, "").toLowerCase());
}

/** Commands whose name/alias contains `frag` (Minecraft "contains" match), best-first. */
export function matchCommands(frag: string): CmdSpec[] {
  const f = frag.replace(/^\//, "").toLowerCase();
  const seen = new Set<string>();
  const scored = COMMANDS
    .map((c) => {
      const hit = [c.name, ...(c.aliases ?? [])].find((n) => n.includes(f));
      if (f && !hit) return null;
      const idx = hit ? hit.indexOf(f) : 99;
      return { c, score: idx === 0 ? 0 : 1 + idx };
    })
    .filter(Boolean) as { c: CmdSpec; score: number }[];
  return scored
    .sort((a, b) => a.score - b.score || a.c.name.localeCompare(b.c.name))
    .filter(({ c }) => (seen.has(c.name) ? false : (seen.add(c.name), true)))
    .map(({ c }) => c);
}

export function usageString(c: CmdSpec): string {
  const parts = c.args.map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`));
  return `/${c.name} ${parts.join(" ")}`.trim();
}
