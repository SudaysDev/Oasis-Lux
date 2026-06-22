"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardModerateUser, isOwnerActor } from "@/lib/auth/admin-guard";
import { isOwnerEmail } from "@/lib/auth/admin-accounts";
import { findCommand, parseTerm, tokenize } from "@/lib/admin/commands";
import {
  adminBanUser, adminUnbanUser, adminSetRestriction, adminUpdateUserProfile,
  adminSetUserNote, type RestrictKind,
} from "@/app/(admin)/admin/users/[id]/actions";
import {
  adminUpdateProduct, adminToggleProduct, adminSetProductFlag, type ProductFlag,
} from "@/app/(admin)/admin/products/[id]/actions";
import { createPromo } from "@/app/(admin)/admin/promo/actions";
import { createCategory, createBrand, createTag, createColor } from "@/app/(admin)/admin/catalog/actions";
import { setOrderStatus, markOrderPaid } from "@/app/(admin)/admin/orders/[id]/actions";
import { findField, fieldsFor, type Entity, type FieldSpec } from "@/lib/admin/entities";
import { getAdminProductDossier } from "@/lib/data/admin-product";

export type Tone = "ok" | "err" | "warn" | "info" | "muted" | "accent" | "out";
export type ConsoleLine = { tone: Tone; text: string };
export type PastedImage = { name: string; dataUrl: string };
export type RunResult = { lines: ConsoleLine[] };

const L = (tone: Tone, text: string): ConsoleLine => ({ tone, text });
const ok = (t: string) => L("ok", t);
const err = (t: string) => L("err", t);
const info = (t: string) => L("info", t);
const warn = (t: string) => L("warn", t);
const muted = (t: string) => L("muted", t);

type SB = ReturnType<typeof createAdminClient>;
type Op = { id: string; username: string };

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const untilLabel = (ms?: number) => (ms ? `until ${new Date(Date.now() + ms).toLocaleString("en-GB")}` : "permanently");
const rest = (toks: string[], from: number) => toks.slice(from).join(" ").trim();

async function resolveUser(sb: SB, token: string) {
  const t = token.replace(/^@/, "").trim();
  if (!t) return null;
  const q = isUuid(t)
    ? sb.from("profiles").select("id,username,role,is_banned,plan,is_verified,restrictions").eq("id", t)
    : sb.from("profiles").select("id,username,role,is_banned,plan,is_verified,restrictions").ilike("username", t);
  const { data } = await q.maybeSingle();
  return (data as { id: string; username: string; role: string; is_banned: boolean; plan: string; is_verified: boolean; restrictions: Record<string, string> } | null) ?? null;
}

async function resolveProduct(sb: SB, token: string) {
  if (!isUuid(token)) return null;
  const { data } = await sb.from("products").select("id,title,brand,price,stock,seller_id").eq("id", token).maybeSingle();
  return (data as { id: string; title: string; brand: string; price: number; stock: number; seller_id: string } | null) ?? null;
}

/** Parse the optional [term] token: returns ms (timed) | undefined (permanent) | "bad". */
function termOf(token: string | undefined): number | undefined | "bad" {
  if (token == null) return undefined;
  const p = parseTerm(token);
  if (p == null) return "bad";
  return p.ms;
}

/* ===================================================================== */
export async function runCommand(raw: string, images: PastedImage[] = []): Promise<RunResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return { lines: [err("✗ forbidden — admin session required.")] };
  const op: Op = { id: profile.id, username: profile.username };
  const sb = createAdminClient();

  const line = raw.trim();
  if (!line.startsWith("/")) return { lines: [muted("Commands start with /. Type /help.")] };
  const toks = tokenize(line);
  const name = toks[0].slice(1).toLowerCase();
  const cmd = findCommand(name);
  if (!cmd) {
    return { lines: [err(`bash: ${toks[0]}: command not found`), muted("Type /help to list commands, or /commands for the reference drawer.")] };
  }

  try {
    switch (cmd.name) {
      case "ban": return await cmdBan(sb, toks);
      case "unban": return await cmdUnban(sb, toks);
      case "restrict": return await cmdRestrict(sb, toks, true);
      case "unrestrict": return await cmdRestrict(sb, toks, false);
      case "set_zapret": return await cmdZapret(sb, toks, true);
      case "unzapret": return await cmdZapret(sb, toks, false);
      case "verify": return await cmdProfileFlag(sb, toks, "is_verified");
      case "role": return await cmdProfileSet(sb, toks, "role");
      case "plan": return await cmdProfileSet(sb, toks, "plan");
      case "points": return await cmdProfileNum(sb, toks, "loyalty_points");
      case "cashback": return await cmdProfileNum(sb, toks, "cashback_balance");
      case "boost": return await cmdBoost(sb, toks);
      case "rename_user": return await cmdRenameUser(sb, toks);
      case "note": return await cmdNote(sb, toks);
      case "whois": return await cmdWhois(sb, toks);
      case "delete_user": return await cmdDeleteUser(sb, toks);

      case "set_price": return await cmdProductNum(sb, toks, "price");
      case "set_stock": return await cmdProductNum(sb, toks, "stock");
      case "rename_product": return await cmdProductText(sb, toks, "title");
      case "set_brand": return await cmdProductText(sb, toks, "brand");
      case "set_category": return await cmdProductText(sb, toks, "category");
      case "promote": return await cmdProductFlag(sb, toks, "featured");
      case "hide": return await cmdProductFlag(sb, toks, "hidden");
      case "freeze": return await cmdProductFlag(sb, toks, "frozen");
      case "activate": return await cmdActivate(sb, toks);
      case "delete_product": return await cmdDeleteProduct(sb, toks);

      case "create": return await cmdCreate(sb, toks);
      case "announce": return await cmdAnnounce(sb, toks, images);
      case "send_message": return await cmdSend(sb, toks, op);

      case "edit": return await cmdEdit(sb, toks, images);
      case "add": return await cmdAdd(sb, toks, images);
      case "delete": return await cmdDeleteAny(sb, toks);
      case "gift": return await cmdGift(sb, toks);
      case "notify": return await cmdNotify(sb, toks, images);
      case "wipe": return await cmdWipe(sb, toks);
      case "set_status": return await cmdSetStatus(sb, toks);
      case "mark_paid": return await cmdMarkPaid(sb, toks);
      case "cancel_order": return await cmdCancelOrder(sb, toks);
      case "set_courier": return await cmdSetCourier(sb, toks);
      case "refund": return await cmdRefund(sb, toks);
      case "restock": return await cmdRestock(sb, toks);
      case "promote_scope": return await cmdPromoteScope(sb, toks);
      case "find": return await cmdFind(sb, toks);
      case "recent": return await cmdRecent(sb, toks);
      case "stats": return await cmdStats(sb);
      case "inspect": return await cmdInspect(sb, toks);

      case "process": return await cmdFlow(sb, toks, "processing");
      case "dispatch": return await cmdFlow(sb, toks, "out_for_delivery");
      case "arrive": return await cmdFlow(sb, toks, "arrived");
      case "fulfill": return await cmdFlow(sb, toks, "fulfilled");
      case "feature": return await cmdFeature(sb, toks, true);
      case "unfeature": return await cmdFeature(sb, toks, false);
      case "discount": return await cmdPricePct(sb, toks, -1);
      case "markup": return await cmdPricePct(sb, toks, 1);
      case "duplicate": return await cmdDuplicate(sb, toks);
      case "deactivate_all": return await cmdSellerProducts(sb, toks, false);
      case "activate_all": return await cmdSellerProducts(sb, toks, true);
      case "mute": return await cmdMute(sb, toks, true);
      case "unmute": return await cmdMute(sb, toks, false);
      case "unverify": return await cmdUnverify(sb, toks);
      case "tier": return await cmdTier(sb, toks);
      case "warn": return await cmdWarn(sb, toks);

      case "reviews_of": return await cmdReviewsOf(sb, toks);
      case "favorites_of": return await cmdFavoritesOf(sb, toks);
      case "cart_of": return await cmdCartOf(sb, toks);
      case "blocked_of": return await cmdBlockedOf(sb, toks);
      case "orders_of": return await cmdOrdersOf(sb, toks, "buyer");
      case "orders_by": return await cmdOrdersOf(sb, toks, "seller");
      case "products_of": return await cmdProductsOf(sb, toks);
      case "seller_of": return await cmdSellerOf(sb, toks);

      case "check": return await cmdCheck(sb, toks);
      case "top": return await cmdTop(sb, toks);
      case "revenue": return await cmdRevenue(sb, toks);
      case "count": return await cmdCount(sb, toks);
      case "sales": return await cmdSalesCmd(sb, toks);
      case "region_stats": return await cmdRegionStats(sb);
      case "status_breakdown": return await cmdStatusBreakdown(sb);
      case "conversion": return await cmdConversion(sb);
      case "inventory_health": return await cmdInventoryHealth(sb);
      case "daily": return await cmdDaily(sb, toks);

      case "promote_user": return await cmdBoost(sb, ["boost", toks[1] ?? "", "on"]);
      case "demote_user": return await cmdBoost(sb, ["boost", toks[1] ?? "", "off"]);
      case "nick": return await cmdRenameUser(sb, ["rename_user", toks[1] ?? "", toks[2] ?? ""]);
      case "birthday": return await cmdEdit(sb, ["edit", toks[1] ?? "", "birthday", toks[2] ?? ""], []);
      case "clear_notifications": return await cmdClearNotifs(sb, toks);
      case "welcome": return await cmdWelcome(sb, toks);
      case "block_pair": return await cmdBlockPair(sb, toks, true);
      case "unblock_pair": return await cmdBlockPair(sb, toks, false);
      case "delete_chat": return await cmdDeleteChat(sb, toks);
      case "violations_of": return await cmdViolationsOf(sb, toks);
      case "reports_on": return await cmdReportsOn(sb, toks);
      case "conversations": return await cmdConversations(sb, toks);
      case "promos": return await cmdPromos(sb, toks);
      case "lowstock": return await cmdLowStock(sb, toks);
      case "outofstock": return await cmdOutOfStock(sb, toks);
      case "zero_sales": return await cmdZeroSales(sb, toks);
      case "pending": return await cmdOrdersList(sb, toks, "pending");
      case "unpaid": return await cmdOrdersList(sb, toks, "unpaid");
      case "cancelled": return await cmdOrdersList(sb, toks, "cancelled");
      case "biggest_orders": return await cmdBiggestOrders(sb, toks);
      case "enable_promo": return await cmdPromoToggle(sb, toks, "enable");
      case "disable_promo": return await cmdPromoToggle(sb, toks, "disable");
      case "expire_promo": return await cmdPromoToggle(sb, toks, "expire");
      case "growth": return await cmdGrowth(sb);
      case "aov": return await cmdAov(sb);
      case "repeat_rate": return await cmdRepeatRate(sb);
      case "active_users": return await cmdActiveUsers(sb, toks);
      case "ltv": return await cmdLtv(sb);
      case "churn": return await cmdChurn(sb, toks);
      case "new_today": return await cmdNewToday(sb);
      case "orders_today": return await cmdOrdersToday(sb);
      case "peak_hour": return await cmdPeakHour(sb);
      case "best_day": return await cmdBestDay(sb);
      case "avg_rating": return await cmdAvgRating(sb);
      case "rating_dist": return await cmdRatingDist(sb);
      case "role_dist": return await cmdDist(sb, "role", "role");
      case "plan_dist": return await cmdDist(sb, "plan", "plan");
      case "tier_dist": return await cmdDist(sb, "loyalty_tier", "tier");
      case "verified_rate": return await cmdVerifiedRate(sb);
      case "catalog_value": return await cmdCatalogValue(sb);
      case "stock_total": return await cmdStockTotal(sb);
      case "price_avg": return await cmdPriceAvg(sb, toks);

      case "brands": return await cmdVocabList(sb, "brands");
      case "categories": return await cmdCategoriesList(sb);
      case "tags": return await cmdVocabList(sb, "tags");
      case "colors": return await cmdColorsList(sb);
      case "order_items": return await cmdOrderItems(sb, toks);
      case "track": return await cmdTrack(sb, toks);
      case "find_phone": return await cmdFindContact(sb, toks, "phone");
      case "find_email": return await cmdFindContact(sb, toks, "email");
      case "socials_of": return await cmdSocialsOf(sb, toks);
      case "links_of": return await cmdLinksOf(sb, toks);
      case "tag_search": return await cmdTagSearch(sb, toks);
      case "random_user": return await cmdRandomUser(sb);

      case "unhide": return await cmdProductFlag(sb, ["hide", toks[1] ?? "", "off"], "hidden");
      case "unfreeze": return await cmdProductFlag(sb, ["freeze", toks[1] ?? "", "off"], "frozen");
      case "relist": return await cmdActivate(sb, ["activate", toks[1] ?? "", "on"]);
      case "delist": return await cmdActivate(sb, ["activate", toks[1] ?? "", "off"]);
      case "mute_review": return await cmdRestrict(sb, ["restrict", toks[1] ?? "", "review", toks[2] ?? ""], true);
      case "mute_sell": return await cmdRestrict(sb, ["restrict", toks[1] ?? "", "sell", toks[2] ?? ""], true);
      case "mute_buy": return await cmdRestrict(sb, ["restrict", toks[1] ?? "", "buy", toks[2] ?? ""], true);

      case "broadcast": return await cmdAnnounce(sb, ["announce", "@a", ...toks.slice(1)], images);
      case "announce_sellers": return await cmdAnnounce(sb, ["announce", "@s", ...toks.slice(1)], images);
      case "announce_couriers": return await cmdAnnounce(sb, ["announce", "@p", ...toks.slice(1)], images);
      case "gift_all": return await cmdGift(sb, ["gift", "@a", toks[1] ?? "", toks[2] ?? ""]);

      case "condition_dist": return await cmdDistT(sb, "products", "condition", "condition");
      case "type_dist": return await cmdDistT(sb, "products", "type", "type");
      case "category_dist": return await cmdDistT(sb, "products", "category", "category");
      case "fulfillment_rate": return await cmdRate(sb, "fulfilled");
      case "cancel_rate": return await cmdRate(sb, "cancelled");
      case "paid_rate": return await cmdRate(sb, "paid");
      case "avg_items": return await cmdAvgItems(sb);
      case "discount_total": return await cmdDiscountTotal(sb);
      case "reviews_count": return await cmdTableCount(sb, "product_reviews", "product reviews");
      case "messages_count": return await cmdTableCount(sb, "messages", "messages");
      case "favorites_total": return await cmdTableCount(sb, "favorites", "favorites");
      case "cart_total": return await cmdTableCount(sb, "cart_items", "cart items");
      case "buyers_count": return await cmdBuyersCount(sb);

      case "top_rated": return await cmdProductsSorted(sb, toks, "rating", false);
      case "worst_rated": return await cmdProductsSorted(sb, toks, "rating", true);
      case "priciest": return await cmdProductsSorted(sb, toks, "price", false);
      case "cheapest": return await cmdProductsSorted(sb, toks, "price", true);
      case "banned_list": return await cmdProfilesList(sb, toks, "is_banned");
      case "boosted_list": return await cmdProfilesList(sb, toks, "is_boosted");
      case "verified_list": return await cmdProfilesList(sb, toks, "is_verified");
      case "admins_list": return await cmdProfilesList(sb, toks, "admin");
      case "couriers_list": return await cmdProfilesList(sb, toks, "courier");
      case "sellers_list": return await cmdProfilesList(sb, toks, "seller");
      case "featured_list": return await cmdSanctionList(sb, "featured");
      case "hidden_list": return await cmdSanctionList(sb, "hidden");
      case "open_reports": return await cmdOpenReports(sb, toks);
      case "paid_orders": return await cmdPaidOrders(sb, toks);

      case "make_seller": return await cmdProfileSet(sb, ["role", toks[1] ?? "", "seller"], "role");
      case "make_courier": return await cmdProfileSet(sb, ["role", toks[1] ?? "", "courier"], "role");
      case "make_customer": return await cmdProfileSet(sb, ["role", toks[1] ?? "", "customer"], "role");
      case "upgrade": return await cmdProfileSet(sb, ["plan", toks[1] ?? "", "elite"], "plan");
      case "downgrade": return await cmdProfileSet(sb, ["plan", toks[1] ?? "", "free"], "plan");
      case "add_points": return await cmdGift(sb, ["gift", toks[1] ?? "", "points", toks[2] ?? ""]);
      case "add_cashback": return await cmdGift(sb, ["gift", toks[1] ?? "", "cashback", toks[2] ?? ""]);
      case "reset_points": return await cmdProfileNum(sb, ["points", toks[1] ?? "", "0"], "loyalty_points");
      case "reset_cashback": return await cmdProfileNum(sb, ["cashback", toks[1] ?? "", "0"], "cashback_balance");
      case "bio": return await cmdEdit(sb, ["edit", toks[1] ?? "", "bio", ...toks.slice(2)], []);

      case "sale": return await cmdPricePct(sb, toks, -1);
      case "sold_out": return await cmdProductNum(sb, ["set_stock", toks[1] ?? "", "0"], "stock");
      case "set_color": return await cmdEdit(sb, ["edit", toks[1] ?? "", "color", ...toks.slice(2)], []);
      case "set_size": return await cmdEdit(sb, ["edit", toks[1] ?? "", "size", ...toks.slice(2)], []);
      case "set_condition": return await cmdEdit(sb, ["edit", toks[1] ?? "", "condition", toks[2] ?? ""], []);
      case "set_type": return await cmdEdit(sb, ["edit", toks[1] ?? "", "type", toks[2] ?? ""], []);
      case "set_description": return await cmdEdit(sb, ["edit", toks[1] ?? "", "description", ...toks.slice(2)], []);

      case "announce_buyers": return await cmdAnnounce(sb, ["announce", "@b", ...toks.slice(1)], images);
      case "announce_verified": return await cmdAnnounce(sb, ["announce", "@v", ...toks.slice(1)], images);

      default: return { lines: [warn(`/${cmd.name} is handled in the console — nothing to run on the server.`)] };
    }
  } catch (e) {
    return { lines: [err(`✗ ${(e as Error).message || "command failed."}`)] };
  }
}

/* ============================ USERS ================================== */
async function cmdBan(sb: SB, t: string[]): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user matched "${t[1] ?? ""}".`)] };
  // tokens[2] is a term only if it parses as one; otherwise it's part of the reason.
  let term: number | undefined, reasonFrom = 2;
  if (t[2] != null) {
    const p = parseTerm(t[2]);
    if (p != null) { term = p.ms; reasonFrom = 3; }
  }
  const reason = rest(t, reasonFrom);
  const r = await adminBanUser(u.id, reason, term);
  if (!r.ok) return { lines: [err(`✗ ${r.error}`)] };
  return { lines: [
    ok(`✓ @${u.username} was banned ${untilLabel(term)} by id ${u.id}`),
    reason ? muted(`  reason: ${reason}`) : muted("  no reason given"),
  ] };
}

async function cmdUnban(sb: SB, t: string[]): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user matched "${t[1] ?? ""}".`)] };
  const r = await adminUnbanUser(u.id);
  return r.ok ? { lines: [ok(`✓ @${u.username} reinstated — suspension lifted.`)] } : { lines: [err(`✗ ${r.error}`)] };
}

async function cmdRestrict(sb: SB, t: string[], on: boolean): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user matched "${t[1] ?? ""}".`)] };
  const kind = (t[2] ?? "").toLowerCase() as RestrictKind;
  const tm = on ? termOf(t[3]) : undefined;
  if (tm === "bad") return { lines: [err(`✗ can't read the term "${t[3]}".`)] };
  const r = await adminSetRestriction(u.id, kind, on, tm);
  if (!r.ok) return { lines: [err(`✗ ${r.error}`)] };
  return { lines: [on
    ? ok(`✓ @${u.username} can no longer ${kind} (${untilLabel(tm)}).`)
    : ok(`✓ @${u.username} may ${kind} again.`)] };
}

async function cmdZapret(sb: SB, t: string[], on: boolean): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user matched "${t[1] ?? ""}".`)] };
  const zg = await guardModerateUser(sb, u.id);
  if (zg) return { lines: [warn(`⚠ ${zg}`)] };
  const scopeTok = t.find((x, i) => i >= 2 && x.includes(":"));
  if (!scopeTok) return { lines: [err("✗ give a scope like brand:Dior · category:perfume · color:Black · tag:luxury.")] };
  const [stype, ...vparts] = scopeTok.split(":");
  const scope_type = stype.toLowerCase();
  const scope_value = vparts.join(":").trim();
  if (!["brand", "category", "color", "tag"].includes(scope_type) || !scope_value) {
    return { lines: [err("✗ scope must be brand:· category:· color:· tag:")] };
  }
  if (!on) {
    const { error } = await sb.from("purchase_blocks").delete().eq("user_id", u.id).eq("scope_type", scope_type).ilike("scope_value", scope_value);
    if (error) return { lines: [err(`✗ ${error.message}`)] };
    return { lines: [ok(`✓ @${u.username} may buy ${scope_type} "${scope_value}" again.`)] };
  }
  const termTok = t[t.indexOf(scopeTok) + 1];
  const tm = termOf(termTok);
  if (tm === "bad") return { lines: [err(`✗ can't read the term "${termTok}".`)] };
  const until = tm ? new Date(Date.now() + tm).toISOString() : null;
  const { error } = await sb.from("purchase_blocks").upsert(
    { user_id: u.id, scope_type, scope_value, until },
    { onConflict: "user_id,scope_type,scope_value" },
  );
  if (error) return { lines: [err(error.message.includes("purchase_blocks") ? "✗ run migration 0025_control_center.sql first." : `✗ ${error.message}`)] };
  await sb.from("notifications").insert({
    user_id: u.id, type: "system", title: "Purchase restriction",
    body: `You can no longer buy ${scope_type} “${scope_value}” ${untilLabel(tm)}.`,
  });
  return { lines: [
    ok(`✓ @${u.username} is blocked from buying ${scope_type} "${scope_value}" (${untilLabel(tm)}).`),
    muted("  enforced at checkout by the database."),
  ] };
}

async function cmdProfileFlag(sb: SB, t: string[], field: "is_verified"): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user matched "${t[1] ?? ""}".`)] };
  const on = /^(on|true|yes|1)$/i.test(t[2] ?? "");
  const r = await adminUpdateUserProfile(u.id, { [field]: on });
  return r.ok ? { lines: [ok(`✓ @${u.username} verified badge ${on ? "granted" : "removed"}.`)] } : { lines: [err(`✗ ${r.error}`)] };
}

async function cmdProfileSet(sb: SB, t: string[], field: "role" | "plan"): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user matched "${t[1] ?? ""}".`)] };
  const val = (t[2] ?? "").toLowerCase();
  const r = await adminUpdateUserProfile(u.id, { [field]: val });
  return r.ok ? { lines: [ok(`✓ @${u.username} ${field} → ${val}.`)] } : { lines: [err(`✗ ${r.error}`)] };
}

async function cmdProfileNum(sb: SB, t: string[], field: "loyalty_points" | "cashback_balance"): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user matched "${t[1] ?? ""}".`)] };
  const n = Number(t[2]);
  if (!Number.isFinite(n)) return { lines: [err(`✗ "${t[2]}" is not a number.`)] };
  const r = await adminUpdateUserProfile(u.id, { [field]: n });
  return r.ok ? { lines: [ok(`✓ @${u.username} ${field.replace("_", " ")} = ${n}.`)] } : { lines: [err(`✗ ${r.error}`)] };
}

async function cmdBoost(sb: SB, t: string[]): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user matched "${t[1] ?? ""}".`)] };
  const on = /^(on|true|yes|1)$/i.test(t[2] ?? "");
  const { error } = await sb.from("profiles").update({ is_boosted: on }).eq("id", u.id);
  if (error) return { lines: [err(error.message.includes("is_boosted") ? "✗ run migration 0025_control_center.sql first." : `✗ ${error.message}`)] };
  revalidatePath("/admin/users");
  return { lines: [ok(`✓ @${u.username} promotion ${on ? "ENABLED — surfaces more in feeds." : "disabled."}`)] };
}

async function cmdRenameUser(sb: SB, t: string[]): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user matched "${t[1] ?? ""}".`)] };
  const name = (t[2] ?? "").replace(/^@/, "");
  const r = await adminUpdateUserProfile(u.id, { username: name });
  return r.ok ? { lines: [ok(`✓ @${u.username} → @${name}.`)] } : { lines: [err(`✗ ${r.error}`)] };
}

async function cmdNote(sb: SB, t: string[]): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user matched "${t[1] ?? ""}".`)] };
  const note = rest(t, 2);
  const r = await adminSetUserNote(u.id, note);
  return r.ok ? { lines: [ok(`✓ note saved on @${u.username}.`)] } : { lines: [err(`✗ ${r.error}`)] };
}

async function cmdWhois(sb: SB, t: string[]): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user matched "${t[1] ?? ""}".`)] };
  const [{ count: orders }, { data: blocks }] = await Promise.all([
    sb.from("orders").select("id", { count: "exact", head: true }).eq("user_id", u.id),
    sb.from("purchase_blocks").select("scope_type,scope_value,until").eq("user_id", u.id),
  ]);
  const restr = Object.keys(u.restrictions ?? {});
  const zap = (blocks ?? []) as { scope_type: string; scope_value: string }[];
  return { lines: [
    info(`@${u.username}  ·  ${u.id}`),
    muted(`  role ${u.role} · plan ${u.plan} · ${u.is_verified ? "verified" : "unverified"} · ${u.is_banned ? "BANNED" : "active"} · ${orders ?? 0} orders`),
    muted(`  restrictions: ${restr.length ? restr.join(", ") : "none"}`),
    muted(`  zapret: ${zap.length ? zap.map((z) => `${z.scope_type}:${z.scope_value}`).join(", ") : "none"}`),
  ] };
}

async function cmdDeleteUser(sb: SB, t: string[]): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user matched "${t[1] ?? ""}".`)] };
  if (!/^confirm$/i.test(t[2] ?? "")) return { lines: [warn(`⚠ this is irreversible. Re-run: /delete_user @${u.username} confirm`)] };
  const dg = await guardModerateUser(sb, u.id);
  if (dg) return { lines: [warn(`⚠ ${dg}`)] };
  await sb.auth.admin.deleteUser(u.id);
  revalidatePath("/admin/users");
  return { lines: [ok(`✓ @${u.username} (${u.id}) permanently deleted.`)] };
}

/* ============================ PRODUCTS =============================== */
async function cmdProductNum(sb: SB, t: string[], field: "price" | "stock"): Promise<RunResult> {
  const p = await resolveProduct(sb, t[1] ?? "");
  if (!p) return { lines: [err(`✗ no product with id "${t[1] ?? ""}". Paste the full id.`)] };
  const n = Number(t[2]);
  if (!Number.isFinite(n)) return { lines: [err(`✗ "${t[2]}" is not a number.`)] };
  const r = await adminUpdateProduct(p.id, { [field]: n });
  return r.ok ? { lines: [ok(`✓ "${p.title}" ${field} ${field === "price" ? `${p.price} → ${n} смн` : `${p.stock} → ${n}`}.`)] } : { lines: [err(`✗ ${r.error}`)] };
}

async function cmdProductText(sb: SB, t: string[], field: "title" | "brand" | "category"): Promise<RunResult> {
  const p = await resolveProduct(sb, t[1] ?? "");
  if (!p) return { lines: [err(`✗ no product with id "${t[1] ?? ""}".`)] };
  const val = rest(t, 2);
  if (!val) return { lines: [err("✗ give a value.")] };
  const r = await adminUpdateProduct(p.id, { [field]: val });
  return r.ok ? { lines: [ok(`✓ "${p.title}" ${field} → ${val}.`)] } : { lines: [err(`✗ ${r.error}`)] };
}

async function cmdProductFlag(sb: SB, t: string[], flag: ProductFlag): Promise<RunResult> {
  const p = await resolveProduct(sb, t[1] ?? "");
  if (!p) return { lines: [err(`✗ no product with id "${t[1] ?? ""}".`)] };
  const on = /^(on|true|yes|1)$/i.test(t[2] ?? "");
  const tm = on ? termOf(t[3]) : undefined;
  if (tm === "bad") return { lines: [err(`✗ can't read the term "${t[3]}".`)] };
  const r = await adminSetProductFlag(p.id, flag, on, tm);
  if (!r.ok) return { lines: [err(`✗ ${r.error}`)] };
  const verb = flag === "featured" ? (on ? "promoted" : "un-promoted") : on ? `${flag}` : `not ${flag}`;
  return { lines: [ok(`✓ "${p.title}" is now ${verb}${on && tm ? ` (${untilLabel(tm)})` : ""}.`)] };
}

async function cmdActivate(sb: SB, t: string[]): Promise<RunResult> {
  const p = await resolveProduct(sb, t[1] ?? "");
  if (!p) return { lines: [err(`✗ no product with id "${t[1] ?? ""}".`)] };
  const on = /^(on|true|yes|1)$/i.test(t[2] ?? "");
  const r = await adminToggleProduct(p.id, on);
  return r.ok ? { lines: [ok(`✓ "${p.title}" ${on ? "activated" : "deactivated"}.`)] } : { lines: [err(`✗ ${r.error}`)] };
}

async function cmdDeleteProduct(sb: SB, t: string[]): Promise<RunResult> {
  const p = await resolveProduct(sb, t[1] ?? "");
  if (!p) return { lines: [err(`✗ no product with id "${t[1] ?? ""}".`)] };
  if (!/^confirm$/i.test(t[2] ?? "")) return { lines: [warn(`⚠ irreversible. Re-run: /delete_product ${p.id} confirm`)] };
  await sb.from("products").delete().eq("id", p.id);
  revalidatePath("/admin/products");
  return { lines: [ok(`✓ "${p.title}" (${p.id}) permanently deleted.`)] };
}

/* ============================ CREATE ================================ */
async function cmdCreate(sb: SB, t: string[]): Promise<RunResult> {
  const what = (t[1] ?? "").toLowerCase();
  const name = t[2] ?? "";
  if (!name) return { lines: [err("✗ give a name/code.")] };
  switch (what) {
    case "brand": { const r = await createBrand(name); return r.ok ? { lines: [ok(`✓ brand "${name}" created.`)] } : { lines: [err(`✗ ${r.error}`)] }; }
    case "tag": { const r = await createTag(name); return r.ok ? { lines: [ok(`✓ tag "${name}" created.`)] } : { lines: [err(`✗ ${r.error}`)] }; }
    case "category": { const r = await createCategory(name, null); return r.ok ? { lines: [ok(`✓ category "${name}" created.`)] } : { lines: [err(`✗ ${r.error}`)] }; }
    case "color": {
      const hex = (t[3] ?? "").trim();
      if (!/^#?[0-9a-f]{6}$/i.test(hex)) return { lines: [err("✗ give a hex like #22ff88.")] };
      const r = await createColor(name, hex.startsWith("#") ? hex : `#${hex}`);
      return r.ok ? { lines: [ok(`✓ color "${name}" ${hex} created.`)] } : { lines: [err(`✗ ${r.error}`)] };
    }
    case "promo": return cmdCreatePromo(t, name);
    default: return { lines: [err(`✗ can't create "${what}". Try: promo · category · brand · tag · color.`)] };
  }
}

/**
 * Forgiving promo parser. Accepts ANY mix the AI (or a human) throws at it:
 *   /create promo SUMMER percent 20 category:perfume min 500 7d
 *   /create promo SUMMER type=percent value=20 scope=category:perfume min=500 term=7d
 *   /create promo SUMMER 20% off for 7 days   (bare number = value)
 * Type/value can be positional or key=value; term, min, max, limit, scope all flexible.
 */
function cmdCreatePromo(t: string[], code: string): Promise<RunResult> {
  const params = t.slice(3);
  let type: string | null = null;
  let value: number | null = null;
  let scope = "all", scopeRef: string | null = null, scopeLabel: string | null = null;
  let minOrder: number | null = null, maxDiscount: number | null = null, usageLimit: number | null = null;
  let expiresAt: string | null = null;

  const num = (s: string) => Number(String(s).replace(/[%,смнsmn\s]/gi, ""));
  const setType = (v: string) => {
    const x = v.toLowerCase();
    if (/^perc|^%|^proc|^процент/.test(x)) type = "percent";
    else if (/^fix|^фикс|^сумм|^amount/.test(x)) type = "fixed";
    else if (/^cash|^кэш|^кеш|^бэк/.test(x)) type = "cashback";
    else if (["percent", "fixed", "cashback"].includes(x)) type = x;
  };
  const setScope = (kRaw: string, v: string) => {
    const k = kRaw.toLowerCase();
    const val = v.trim();
    if (!val) return;
    if (k === "brand") { scope = "brand"; scopeRef = val; scopeLabel = val; }
    else if (k === "category" || k === "cat") { scope = "category"; scopeRef = val; scopeLabel = val; }
    else if (k === "product" || k === "prod") { scope = "product"; scopeRef = val; }
  };

  for (let i = 0; i < params.length; i++) {
    let w = params[i];
    if (!w) continue;

    // key=value form (leave URLs and scope colons alone)
    const eq = w.indexOf("=");
    if (eq > 0 && !/^https?:/i.test(w)) {
      const k = w.slice(0, eq).toLowerCase();
      const v = w.slice(eq + 1);
      if (["type", "kind", "тип"].includes(k)) { setType(v); continue; }
      if (["value", "val", "amount", "discount", "percent", "off", "size", "скидка", "значение"].includes(k)) { value = num(v); continue; }
      if (["min", "min_order", "minorder", "minimum", "мин"].includes(k)) { minOrder = num(v); continue; }
      if (["max", "max_discount", "maxdiscount", "cap", "макс"].includes(k)) { maxDiscount = num(v); continue; }
      if (["limit", "usage", "usage_limit", "uses", "max_uses", "лимит"].includes(k)) { usageLimit = num(v); continue; }
      if (["term", "expires", "expiry", "duration", "for", "until", "срок"].includes(k)) { const p = parseTerm(v); if (p?.ms) expiresAt = new Date(Date.now() + p.ms).toISOString(); continue; }
      if (k === "scope") { if (v.includes(":")) { const [sk, ...sv] = v.split(":"); setScope(sk, sv.join(":")); } continue; }
      if (["brand", "category", "cat", "product", "prod"].includes(k)) { setScope(k, v); continue; }
      w = v; // unknown key → reinterpret its value positionally
    }

    // scope prefix  brand:Dior  category:perfume  product:<id>
    if (w.includes(":")) {
      const [sk, ...sv] = w.split(":");
      if (["brand", "category", "cat", "product", "prod"].includes(sk.toLowerCase())) { setScope(sk, sv.join(":")); continue; }
    }

    const lw = w.toLowerCase();
    if (/^(percent|fixed|cashback|%|процент|фикс|кэш|кеш|cash)/.test(lw)) { setType(w); continue; }
    if (/^min$/i.test(w)) { minOrder = num(params[++i] ?? ""); continue; }
    if (/^max$/i.test(w)) { maxDiscount = num(params[++i] ?? ""); continue; }
    if (/^(limit|uses)$/i.test(w)) { usageLimit = num(params[++i] ?? ""); continue; }
    if (/^(off|скидк|на)$/i.test(lw)) continue; // filler words

    const n = num(w);
    if (Number.isFinite(n) && w.replace(/[%,смнsmn\s]/gi, "") !== "" && value == null) { value = n; continue; }
    const p = parseTerm(w);
    if (p?.ms) { expiresAt = new Date(Date.now() + p.ms).toISOString(); continue; }
  }

  if (!type) type = "percent";
  if (value == null || !Number.isFinite(value)) {
    return Promise.resolve({ lines: [
      err("✗ I need a discount value. Syntax: /create promo <CODE> <percent|fixed|cashback> <value> [scope] [min N] [term]"),
      muted("  e.g. /create promo SUMMER percent 20 category:perfume 7d"),
    ] });
  }
  return createPromo({ code, type, value, scope, scopeRef, scopeLabel, minOrder, maxDiscount, usageLimit, expiresAt }).then((r) =>
    r.ok ? { lines: [ok(`✓ promo ${code.toUpperCase()} created — ${value}${type === "percent" ? "%" : " смн"} ${type === "cashback" ? "cashback" : "off"} ${scope}${scopeRef ? ` (${scopeRef})` : ""}${minOrder ? `, min ${minOrder} смн` : ""}${usageLimit ? `, ${usageLimit} uses` : ""}${expiresAt ? `, expires ${new Date(expiresAt).toLocaleString("en-GB")}` : ""}.`)] }
      : { lines: [err(`✗ ${r.error}`)] });
}

/* ============================ BROADCAST ============================= */
async function audience(sb: SB, target: string): Promise<{ ids: string[]; label: string } | null> {
  const sel = sb.from("profiles").select("id");
  switch (target.toLowerCase()) {
    case "@a": { const { data } = await sel; return { ids: (data ?? []).map((r) => r.id), label: "everyone" }; }
    case "@p": { const { data } = await sb.from("profiles").select("id").eq("role", "courier"); return { ids: (data ?? []).map((r) => r.id), label: "couriers" }; }
    case "@e": { const { data } = await sb.from("profiles").select("id").eq("role", "admin"); return { ids: (data ?? []).map((r) => r.id), label: "admins" }; }
    case "@s": { const { data } = await sb.from("profiles").select("id").eq("role", "seller"); return { ids: (data ?? []).map((r) => r.id), label: "sellers" }; }
    case "@b": { const { data } = await sb.from("profiles").select("id").eq("role", "customer"); return { ids: (data ?? []).map((r) => r.id), label: "buyers" }; }
    case "@v": { const { data } = await sb.from("profiles").select("id").eq("is_verified", true); return { ids: (data ?? []).map((r) => r.id), label: "verified users" }; }
    default: {
      const u = await resolveUser(sb, target);
      return u ? { ids: [u.id], label: `@${u.username}` } : null;
    }
  }
}

async function uploadImages(sb: SB, images: PastedImage[]): Promise<string[]> {
  const urls: string[] = [];
  for (const img of images.slice(0, 6)) {
    const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(img.dataUrl);
    if (!m) continue;
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length > 8 * 1024 * 1024) continue;
    const ext = m[1].split("/")[1].replace(/[^a-z0-9]/g, "") || "png";
    const path = `admin/announce/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from("media").upload(path, bytes, { contentType: m[1], upsert: false });
    if (error) continue;
    urls.push(sb.storage.from("media").getPublicUrl(path).data.publicUrl);
  }
  return urls;
}

async function cmdAnnounce(sb: SB, t: string[], images: PastedImage[]): Promise<RunResult> {
  const target = t[1] ?? "";
  const aud = await audience(sb, target);
  if (!aud) return { lines: [err(`✗ unknown audience "${target}". Use @a @p @e @s @b @v or @username.`)] };
  if (!aud.ids.length) return { lines: [warn(`⚠ ${aud.label}: no recipients.`)] };
  const msg = rest(t, 2);
  if (!msg && !images.length) return { lines: [err("✗ give a message (or paste an image).")] };
  const urls = await uploadImages(sb, images);
  const body = `${msg}${urls.length ? `${msg ? " " : ""}${urls.map((_, i) => `[photo-${i + 1}]`).join(" ")}` : ""}`;
  const rows = aud.ids.map((id) => ({ user_id: id, type: "system" as const, title: "📣 Announcement", body, data: { announcement: true, images: urls } }));
  // chunked insert to stay well under limits
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from("notifications").insert(rows.slice(i, i + 500));
    if (error) return { lines: [err(`✗ ${error.message}`)] };
  }
  return { lines: [
    ok(`✓ announcement delivered to ${aud.label} — ${aud.ids.length} inbox${aud.ids.length === 1 ? "" : "es"}.`),
    urls.length ? muted(`  ${urls.length} image(s) attached.`) : muted(`  "${msg}"`),
  ] };
}

async function cmdSend(sb: SB, t: string[], op: Op): Promise<RunResult> {
  let senderTok = `@${op.username}`, recipientTok: string, msgFrom: number;
  if ((t[1] ?? "").toLowerCase() === "by") {
    senderTok = t[2] ?? ""; // by @sender to @recipient "msg"
    if ((t[3] ?? "").toLowerCase() !== "to") return { lines: [err('✗ syntax: /send_message by @sender to @recipient "message"')] };
    recipientTok = t[4] ?? ""; msgFrom = 5;
  } else { recipientTok = t[1] ?? ""; msgFrom = 2; }

  const sender = senderTok === `@${op.username}` ? { id: op.id, username: op.username } : await resolveUser(sb, senderTok);
  const recipient = await resolveUser(sb, recipientTok);
  if (!sender) return { lines: [err(`✗ no sender matched "${senderTok}".`)] };
  if (!recipient) return { lines: [err(`✗ no recipient matched "${recipientTok}".`)] };
  if (sender.id === recipient.id) return { lines: [err("✗ sender and recipient are the same.")] };
  const text = rest(t, msgFrom);
  if (!text) return { lines: [err("✗ give a message.")] };

  const [a, b] = [sender.id, recipient.id].sort();
  let convId: string | null = null;
  const { data: existing } = await sb.from("conversations").select("id").eq("user_a", a).eq("user_b", b).maybeSingle();
  if (existing) convId = existing.id;
  else {
    const { data: created, error } = await sb.from("conversations").insert({ user_a: a, user_b: b, last_message: text, last_sender: sender.id }).select("id").single();
    if (error) return { lines: [err(`✗ ${error.message}`)] };
    convId = created.id;
  }
  const { error: msgErr } = await sb.from("messages").insert({ conversation_id: convId, sender_id: sender.id, recipient_id: recipient.id, text });
  if (msgErr) return { lines: [err(`✗ ${msgErr.message}`)] };
  return { lines: [ok(`✓ message sent from @${sender.username} to @${recipient.username}.`), muted(`  "${text}"`)] };
}

/* ============================ DATA (generic edit / add / delete) ===== */
type AnyTarget =
  | { kind: "users"; ids: string[]; label: string }
  | { kind: "user"; id: string; username: string; role: string }
  | { kind: "product"; id: string; title: string }
  | { kind: "order"; id: string }
  | { kind: "promo"; id: string; code: string };

async function resolveAnyTarget(sb: SB, token: string, opts: { allowPromo?: boolean } = {}): Promise<AnyTarget | null> {
  if (["@a", "@p", "@e", "@s", "@b", "@v"].includes(token.toLowerCase())) {
    const aud = await audience(sb, token);
    return aud ? { kind: "users", ids: aud.ids, label: aud.label } : null;
  }
  if (token.startsWith("@") || !isUuid(token)) {
    const u = await resolveUser(sb, token);
    if (u) return { kind: "user", id: u.id, username: u.username, role: u.role };
    if (opts.allowPromo) {
      const { data } = await sb.from("promo_codes").select("id,code").ilike("code", token.replace(/^@/, "")).maybeSingle();
      if (data) return { kind: "promo", id: String(data.id), code: data.code };
    }
    return null;
  }
  const u = await resolveUser(sb, token);
  if (u) return { kind: "user", id: u.id, username: u.username, role: u.role };
  const { data: p } = await sb.from("products").select("id,title").eq("id", token).maybeSingle();
  if (p) return { kind: "product", id: p.id, title: p.title };
  const { data: o } = await sb.from("orders").select("id").eq("id", token).maybeSingle();
  if (o) return { kind: "order", id: o.id };
  if (opts.allowPromo) {
    const { data: pr } = await sb.from("promo_codes").select("id,code").eq("id", token).maybeSingle();
    if (pr) return { kind: "promo", id: String(pr.id), code: pr.code };
  }
  return null;
}

async function resolveOrder(sb: SB, token: string) {
  if (!isUuid(token)) return null;
  const { data } = await sb.from("orders").select("id,status").eq("id", token).maybeSingle();
  return (data as { id: string; status: string } | null) ?? null;
}

function coerceField(field: FieldSpec, raw: string): { value: unknown } | { error: string } {
  const v = raw.trim();
  switch (field.type) {
    case "text": return { value: raw };
    case "bool":
      if (/^(on|true|yes|1)$/i.test(v)) return { value: true };
      if (/^(off|false|no|0)$/i.test(v)) return { value: false };
      return { error: `use on/off for ${field.key}` };
    case "number": case "money": {
      const n = Number(v);
      if (!Number.isFinite(n)) return { error: `"${v}" is not a number` };
      if (field.min != null && n < field.min) return { error: `${field.key} can't be below ${field.min}` };
      if (field.max != null && n > field.max) return { error: `${field.key} can't be above ${field.max}` };
      if (field.type === "money" && n < 0) return { error: "can't be negative" };
      return { value: n };
    }
    case "date": { const d = new Date(v); return isNaN(d.getTime()) ? { error: `"${v}" isn't a date` } : { value: d.toISOString().slice(0, 10) }; }
    case "datetime": { const d = new Date(v); return isNaN(d.getTime()) ? { error: `"${v}" isn't a date` } : { value: d.toISOString() }; }
    case "enum": {
      const opt = (field.options ?? []).find((o) => o.toLowerCase() === v.toLowerCase());
      return opt ? { value: opt } : { error: `${field.key} must be one of: ${field.options?.join(" · ")}` };
    }
    case "photo": return { error: "photo handled separately" };
  }
}

async function cmdEdit(sb: SB, t: string[], images: PastedImage[]): Promise<RunResult> {
  const tgt = await resolveAnyTarget(sb, t[1] ?? "");
  if (!tgt) return { lines: [err(`✗ no user / product / order matched "${t[1] ?? ""}".`)] };
  if (tgt.kind === "promo") return { lines: [err("✗ edit promos via /create or the promo page.")] };
  const entity: Entity = tgt.kind === "users" ? "user" : tgt.kind;
  const fieldTok = t[2] ?? "";
  const field = findField(entity, fieldTok);
  if (!field) return { lines: [err(`✗ unknown field "${fieldTok}" for ${entity}.`), muted(`  try: ${fieldsFor(entity).slice(0, 10).map((f) => f.key).join(", ")}…`)] };

  let value: unknown; let note = "";
  if (field.type === "photo") {
    if (!images.length) return { lines: [warn("⚠ paste a photo first (Ctrl+V), then run the command.")] };
    const url = (await uploadImages(sb, images.slice(0, 1)))[0];
    if (!url) return { lines: [err("✗ image upload failed.")] };
    value = url; note = "  (image uploaded)";
  } else {
    const raw = rest(t, 3);
    if (!raw) return { lines: [err(`✗ give a value for ${field.key}.`)] };
    const c = coerceField(field, raw);
    if ("error" in c) return { lines: [err(`✗ ${c.error}`)] };
    value = c.value;
  }

  if (tgt.kind === "user" || tgt.kind === "users") {
    const ids = tgt.kind === "users" ? tgt.ids : [tgt.id];
    const viewerOwner = await isOwnerActor(sb);
    let applied = 0, skipped = 0;
    for (const id of ids) {
      const { data } = await sb.from("profiles").select("role,email").eq("id", id).maybeSingle();
      const row = data as { role?: string; email?: string } | null;
      if (row?.role === "admin" && (isOwnerEmail(row.email) || !viewerOwner)) { skipped++; continue; }
      const { error } = await sb.from("profiles").update({ [field.key]: value }).eq("id", id);
      if (!error) applied++;
    }
    revalidatePath("/admin/users");
    const label = tgt.kind === "users" ? `${applied} ${tgt.label}` : `@${tgt.username}`;
    return { lines: [ok(`✓ ${field.key} set on ${label}${skipped ? ` (skipped ${skipped} protected admin)` : ""}.`), note ? muted(note) : muted(`  → ${String(value).slice(0, 80)}`)] };
  }
  if (tgt.kind === "product") {
    if (field.key === "image") {
      const { data } = await sb.from("products").select("images").eq("id", tgt.id).maybeSingle();
      const imgs = [...(((data?.images ?? []) as string[])), value as string];
      const { error } = await sb.from("products").update({ images: imgs }).eq("id", tgt.id);
      if (error) return { lines: [err(`✗ ${error.message}`)] };
    } else {
      const { error } = await sb.from("products").update({ [field.key]: value }).eq("id", tgt.id);
      if (error) return { lines: [err(`✗ ${error.message}`)] };
    }
    revalidatePath(`/admin/products/${tgt.id}`); revalidatePath("/admin/products");
    return { lines: [ok(`✓ "${tgt.title}" ${field.key} updated.${note}`)] };
  }
  // tgt.kind === "order"
  const { error } = await sb.from("orders").update({ [field.key]: value }).eq("id", tgt.id);
  if (error) return { lines: [err(`✗ ${error.message}`)] };
  revalidatePath(`/admin/orders/${tgt.id}`); revalidatePath("/admin/orders");
  return { lines: [ok(`✓ order #${tgt.id.slice(0, 8)} ${field.key} updated.`)] };
}

async function cmdAdd(sb: SB, t: string[], images: PastedImage[]): Promise<RunResult> {
  const what = (t[1] ?? "").toLowerCase();
  if (what === "image") {
    const p = await resolveProduct(sb, t[2] ?? "");
    if (!p) return { lines: [err(`✗ no product "${t[2] ?? ""}".`)] };
    if (!images.length) return { lines: [warn("⚠ paste a photo first (Ctrl+V).")] };
    const url = (await uploadImages(sb, images.slice(0, 1)))[0];
    if (!url) return { lines: [err("✗ upload failed.")] };
    const { data } = await sb.from("products").select("images").eq("id", p.id).maybeSingle();
    const imgs = [...(((data?.images ?? []) as string[])), url];
    const { error } = await sb.from("products").update({ images: imgs }).eq("id", p.id);
    if (error) return { lines: [err(`✗ ${error.message}`)] };
    revalidatePath(`/admin/products/${p.id}`);
    return { lines: [ok(`✓ image added to "${p.title}" (${imgs.length} total).`)] };
  }
  if (what === "tag") {
    const p = await resolveProduct(sb, t[2] ?? "");
    if (!p) return { lines: [err(`✗ no product "${t[2] ?? ""}".`)] };
    const tag = t[3] ?? "";
    if (!tag) return { lines: [err("✗ give a tag.")] };
    const { data } = await sb.from("products").select("tags").eq("id", p.id).maybeSingle();
    const tags = Array.from(new Set([...(((data?.tags ?? []) as string[])), tag]));
    const { error } = await sb.from("products").update({ tags }).eq("id", p.id);
    if (error) return { lines: [err(`✗ ${error.message}`)] };
    revalidatePath(`/admin/products/${p.id}`);
    return { lines: [ok(`✓ tag "${tag}" added to "${p.title}".`)] };
  }
  if (what === "link") {
    const u = await resolveUser(sb, t[2] ?? "");
    if (!u) return { lines: [err(`✗ no user "${t[2] ?? ""}".`)] };
    const label = t[3] ?? "", url = t[4] ?? "";
    if (!label || !url) return { lines: [err("✗ syntax: /add link @user <label> <url>")] };
    const { data } = await sb.from("profiles").select("links").eq("id", u.id).maybeSingle();
    const links = [...(((data?.links ?? []) as unknown[])), { label, url }];
    const { error } = await sb.from("profiles").update({ links }).eq("id", u.id);
    if (error) return { lines: [err(`✗ ${error.message}`)] };
    revalidatePath("/admin/users");
    return { lines: [ok(`✓ link "${label}" added to @${u.username}.`)] };
  }
  if (what === "social") {
    const u = await resolveUser(sb, t[2] ?? "");
    if (!u) return { lines: [err(`✗ no user "${t[2] ?? ""}".`)] };
    const platform = (t[3] ?? "").toLowerCase(), handle = t[4] ?? "";
    if (!platform || !handle) return { lines: [err("✗ syntax: /add social @user <platform> <handle>")] };
    const { data } = await sb.from("profiles").select("socials").eq("id", u.id).maybeSingle();
    const socials = { ...((data?.socials ?? {}) as Record<string, string>), [platform]: handle };
    const { error } = await sb.from("profiles").update({ socials }).eq("id", u.id);
    if (error) return { lines: [err(`✗ ${error.message}`)] };
    revalidatePath("/admin/users");
    return { lines: [ok(`✓ ${platform} → ${handle} set on @${u.username}.`)] };
  }
  return { lines: [err(`✗ can't add "${what}". try: image · tag · link · social.`)] };
}

async function cmdDeleteAny(sb: SB, t: string[]): Promise<RunResult> {
  const tgt = await resolveAnyTarget(sb, t[1] ?? "", { allowPromo: true });
  if (!tgt) return { lines: [err(`✗ nothing matched "${t[1] ?? ""}".`)] };
  if (!/^confirm$/i.test(t[2] ?? "")) return { lines: [warn(`⚠ irreversible. Re-run: /delete ${t[1]} confirm`)] };
  switch (tgt.kind) {
    case "users": return { lines: [warn("⚠ refusing a bulk delete — remove users one at a time.")] };
    case "user": {
      const ag = await guardModerateUser(sb, tgt.id);
      if (ag) return { lines: [warn(`⚠ ${ag}`)] };
      await sb.auth.admin.deleteUser(tgt.id);
      revalidatePath("/admin/users");
      return { lines: [ok(`✓ user @${tgt.username} permanently deleted.`)] };
    }
    case "product":
      await sb.from("products").delete().eq("id", tgt.id);
      revalidatePath("/admin/products");
      return { lines: [ok(`✓ product "${tgt.title}" deleted.`)] };
    case "order":
      await sb.from("orders").delete().eq("id", tgt.id);
      revalidatePath("/admin/orders");
      return { lines: [ok(`✓ order #${tgt.id.slice(0, 8)} deleted.`)] };
    case "promo":
      await sb.from("promo_codes").delete().eq("id", tgt.id);
      revalidatePath("/admin/promo");
      return { lines: [ok(`✓ promo ${tgt.code} deleted.`)] };
  }
}

async function cmdGift(sb: SB, t: string[]): Promise<RunResult> {
  const tgt = await resolveAnyTarget(sb, t[1] ?? "");
  if (!tgt || (tgt.kind !== "user" && tgt.kind !== "users")) return { lines: [err("✗ gift targets a user or an audience (@a/@b/@s…).")] };
  const kind = (t[2] ?? "").toLowerCase();
  const col = kind === "points" ? "loyalty_points" : kind === "cashback" ? "cashback_balance" : null;
  if (!col) return { lines: [err("✗ kind must be points or cashback.")] };
  const amt = Number(t[3]);
  if (!Number.isFinite(amt)) return { lines: [err(`✗ "${t[3]}" is not a number.`)] };
  const ids = tgt.kind === "users" ? tgt.ids : [tgt.id];
  const viewerOwner = await isOwnerActor(sb);
  let applied = 0;
  for (const id of ids) {
    const { data } = await sb.from("profiles").select(`role, email, ${col}`).eq("id", id).maybeSingle();
    const row = data as { role?: string; email?: string } | null;
    if (row?.role === "admin" && (isOwnerEmail(row.email) || !viewerOwner)) continue;
    const cur = Number((data as Record<string, unknown> | null)?.[col] ?? 0);
    const { error } = await sb.from("profiles").update({ [col]: Math.max(0, cur + amt) }).eq("id", id);
    if (!error) applied++;
  }
  revalidatePath("/admin/users");
  const label = tgt.kind === "users" ? `${applied} ${tgt.label}` : `@${tgt.username}`;
  return { lines: [ok(`✓ ${amt >= 0 ? "gave" : "removed"} ${Math.abs(amt)} ${kind} ${amt >= 0 ? "to" : "from"} ${label}.`)] };
}

async function cmdNotify(sb: SB, t: string[], images: PastedImage[]): Promise<RunResult> {
  const aud = await audience(sb, t[1] ?? "");
  if (!aud) return { lines: [err(`✗ unknown audience "${t[1] ?? ""}".`)] };
  if (!aud.ids.length) return { lines: [warn(`⚠ ${aud.label}: no recipients.`)] };
  const title = t[2] ?? "";
  if (!title) return { lines: [err("✗ give a title (quote it).")] };
  const bodyRaw = rest(t, 3);
  const urls = await uploadImages(sb, images);
  const body = `${bodyRaw}${urls.length ? `${bodyRaw ? " " : ""}${urls.map((_, i) => `[photo-${i + 1}]`).join(" ")}` : ""}`;
  const rows = aud.ids.map((id) => ({ user_id: id, type: "system" as const, title, body, data: { images: urls } }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from("notifications").insert(rows.slice(i, i + 500));
    if (error) return { lines: [err(`✗ ${error.message}`)] };
  }
  return { lines: [ok(`✓ notified ${aud.label} — ${aud.ids.length} inbox(es).`)] };
}

async function cmdWipe(sb: SB, t: string[]): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user "${t[1] ?? ""}".`)] };
  const what = (t[2] ?? "").toLowerCase();
  const doCart = what === "cart" || what === "all";
  const doFav = what === "favorites" || what === "fav" || what === "all";
  if (!doCart && !doFav) return { lines: [err("✗ what must be cart · favorites · all.")] };
  const parts: string[] = [];
  if (doCart) { await sb.from("cart_items").delete().eq("user_id", u.id); parts.push("cart"); }
  if (doFav) { await sb.from("favorites").delete().eq("user_id", u.id); parts.push("favorites"); }
  return { lines: [ok(`✓ wiped ${parts.join(" + ")} for @${u.username}.`)] };
}

async function cmdSetStatus(sb: SB, t: string[]): Promise<RunResult> {
  const o = await resolveOrder(sb, t[1] ?? "");
  if (!o) return { lines: [err(`✗ no order "${t[1] ?? ""}".`)] };
  const status = (t[2] ?? "").toLowerCase();
  const r = await setOrderStatus(o.id, status);
  return r.ok ? { lines: [ok(`✓ order #${o.id.slice(0, 8)} ${o.status} → ${status}.`)] } : { lines: [err(`✗ ${r.error}`)] };
}

async function cmdMarkPaid(sb: SB, t: string[]): Promise<RunResult> {
  const o = await resolveOrder(sb, t[1] ?? "");
  if (!o) return { lines: [err(`✗ no order "${t[1] ?? ""}".`)] };
  const r = await markOrderPaid(o.id);
  return r.ok ? { lines: [ok(`✓ order #${o.id.slice(0, 8)} marked paid.`)] } : { lines: [err(`✗ ${r.error}`)] };
}

async function cmdCancelOrder(sb: SB, t: string[]): Promise<RunResult> {
  const o = await resolveOrder(sb, t[1] ?? "");
  if (!o) return { lines: [err(`✗ no order "${t[1] ?? ""}".`)] };
  const r = await setOrderStatus(o.id, "cancelled");
  return r.ok ? { lines: [ok(`✓ order #${o.id.slice(0, 8)} cancelled.`)] } : { lines: [err(`✗ ${r.error}`)] };
}

async function cmdSetCourier(sb: SB, t: string[]): Promise<RunResult> {
  const o = await resolveOrder(sb, t[1] ?? "");
  if (!o) return { lines: [err(`✗ no order "${t[1] ?? ""}".`)] };
  const name = t[2] ?? "";
  if (!name) return { lines: [err("✗ give a courier name.")] };
  const patch: Record<string, string> = { courier_name: name };
  if (t[3]) patch.courier_phone = t[3];
  if (t[4]) patch.courier_vehicle = t[4];
  const { error } = await sb.from("orders").update(patch).eq("id", o.id);
  if (error) return { lines: [err(`✗ ${error.message}`)] };
  revalidatePath(`/admin/orders/${o.id}`);
  return { lines: [ok(`✓ courier on #${o.id.slice(0, 8)} → ${name}.`)] };
}

async function cmdRefund(sb: SB, t: string[]): Promise<RunResult> {
  if (!isUuid(t[1] ?? "")) return { lines: [err(`✗ no order "${t[1] ?? ""}".`)] };
  const { data: o } = await sb.from("orders").select("id,user_id,total,status").eq("id", t[1]).maybeSingle();
  if (!o) return { lines: [err(`✗ no order "${t[1]}".`)] };
  const reason = rest(t, 2);
  const r = await setOrderStatus(o.id, "cancelled");
  if (!r.ok) return { lines: [err(`✗ ${r.error}`)] };
  const amount = Number(o.total) || 0;
  const { data: prof } = await sb.from("profiles").select("cashback_balance").eq("id", o.user_id).maybeSingle();
  const next = Number(prof?.cashback_balance ?? 0) + amount;
  await sb.from("profiles").update({ cashback_balance: next }).eq("id", o.user_id);
  await sb.from("notifications").insert({ user_id: o.user_id, type: "order", title: "Order refunded", body: `Order #${o.id.slice(0, 8)} was cancelled and ${amount} смн credited to your cashback.${reason ? ` Reason: ${reason}.` : ""}` });
  revalidatePath(`/admin/orders/${o.id}`); revalidatePath("/admin/users");
  return { lines: [ok(`✓ order #${o.id.slice(0, 8)} refunded — ${amount} смн → buyer cashback.`)] };
}

async function cmdRestock(sb: SB, t: string[]): Promise<RunResult> {
  const p = await resolveProduct(sb, t[1] ?? "");
  if (!p) return { lines: [err(`✗ no product "${t[1] ?? ""}".`)] };
  const delta = Number(t[2]);
  if (!Number.isFinite(delta)) return { lines: [err(`✗ "${t[2]}" is not a number.`)] };
  const next = Math.max(0, p.stock + delta);
  const r = await adminUpdateProduct(p.id, { stock: next });
  return r.ok ? { lines: [ok(`✓ "${p.title}" stock ${p.stock} → ${next} (${delta >= 0 ? "+" : ""}${delta}).`)] } : { lines: [err(`✗ ${r.error}`)] };
}

async function cmdPromoteScope(sb: SB, t: string[]): Promise<RunResult> {
  const scopeTok = t.find((x, i) => i >= 1 && x.includes(":"));
  if (!scopeTok) return { lines: [err("✗ give a scope like brand:Dior or category:perfume.")] };
  const [stype, ...vp] = scopeTok.split(":");
  const type = stype.toLowerCase(); const value = vp.join(":").trim();
  if (!["brand", "category"].includes(type) || !value) return { lines: [err("✗ scope must be brand: or category:")] };
  const on = /^(on|true|yes|1)$/i.test(t[t.indexOf(scopeTok) + 1] ?? "");
  const { data } = await sb.from("products").select("id").ilike(type, value);
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  if (!ids.length) return { lines: [warn(`⚠ no products with ${type} "${value}".`)] };
  let done = 0;
  for (const id of ids) { const r = await adminSetProductFlag(id, "featured", on); if (r.ok) done++; }
  return { lines: [ok(`✓ ${on ? "promoted" : "un-promoted"} ${done} product(s) in ${type} "${value}".`)] };
}

/* ============================ QUERY ================================= */
async function cmdFind(sb: SB, t: string[]): Promise<RunResult> {
  const type = (t[1] ?? "").toLowerCase();
  const q = rest(t, 2).trim();
  if (!q) return { lines: [err("✗ give a search query.")] };
  if (type === "users") {
    const { data } = await sb.from("profiles").select("id,username,role").or(`username.ilike.%${q}%,full_name.ilike.%${q}%`).limit(12);
    const rows = (data ?? []) as { id: string; username: string; role: string }[];
    if (!rows.length) return { lines: [muted(`no users match "${q}".`)] };
    return { lines: [info(`${rows.length} user(s):`), ...rows.map((r) => muted(`  @${r.username.padEnd(20)} ${r.role.padEnd(9)} ${r.id}`))] };
  }
  if (type === "products") {
    const { data } = await sb.from("products").select("id,title,brand,price,stock").or(`title.ilike.%${q}%,brand.ilike.%${q}%`).limit(12);
    const rows = (data ?? []) as { id: string; title: string; brand: string; price: number; stock: number }[];
    if (!rows.length) return { lines: [muted(`no products match "${q}".`)] };
    return { lines: [info(`${rows.length} product(s):`), ...rows.map((r) => muted(`  ${r.id}  ${r.brand} · ${r.title} — ${r.price} смн, stock ${r.stock}`))] };
  }
  if (type === "orders") {
    const { data } = await sb.from("orders").select("id,status,total,region,full_name").or(`region.ilike.%${q}%,full_name.ilike.%${q}%`).limit(12);
    const rows = (data ?? []) as { id: string; status: string; total: number; region: string; full_name: string }[];
    if (!rows.length) return { lines: [muted(`no orders match "${q}".`)] };
    return { lines: [info(`${rows.length} order(s):`), ...rows.map((r) => muted(`  ${r.id}  ${r.status.padEnd(16)} ${r.total} смн · ${r.region} · ${r.full_name}`))] };
  }
  return { lines: [err("✗ type must be users · products · orders.")] };
}

async function cmdRecent(sb: SB, t: string[]): Promise<RunResult> {
  const type = (t[1] ?? "").toLowerCase();
  const n = Math.min(30, Math.max(1, Number(t[2]) || 8));
  if (type === "users") {
    const { data } = await sb.from("profiles").select("id,username,role,created_at").order("created_at", { ascending: false }).limit(n);
    const rows = (data ?? []) as { id: string; username: string; role: string; created_at: string }[];
    return { lines: [info(`newest ${rows.length} users:`), ...rows.map((r) => muted(`  @${r.username.padEnd(20)} ${r.role.padEnd(9)} ${new Date(r.created_at).toLocaleDateString("en-GB")}  ${r.id}`))] };
  }
  if (type === "products") {
    const { data } = await sb.from("products").select("id,title,brand,created_at").order("created_at", { ascending: false }).limit(n);
    const rows = (data ?? []) as { id: string; title: string; brand: string; created_at: string }[];
    return { lines: [info(`newest ${rows.length} products:`), ...rows.map((r) => muted(`  ${r.id}  ${r.brand} · ${r.title}`))] };
  }
  if (type === "orders") {
    const { data } = await sb.from("orders").select("id,status,total,created_at").order("created_at", { ascending: false }).limit(n);
    const rows = (data ?? []) as { id: string; status: string; total: number; created_at: string }[];
    return { lines: [info(`newest ${rows.length} orders:`), ...rows.map((r) => muted(`  ${r.id}  ${r.status.padEnd(16)} ${r.total} смн · ${new Date(r.created_at).toLocaleString("en-GB")}`))] };
  }
  return { lines: [err("✗ type must be users · products · orders.")] };
}

async function cmdStats(sb: SB): Promise<RunResult> {
  const [u, p, o, rev] = await Promise.all([
    sb.from("profiles").select("id", { count: "exact", head: true }),
    sb.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
    sb.from("orders").select("id", { count: "exact", head: true }),
    sb.from("orders").select("total").neq("status", "cancelled").limit(10000),
  ]);
  const revenue = ((rev.data ?? []) as { total: number }[]).reduce((s, r) => s + Number(r.total ?? 0), 0);
  return { lines: [
    info("OASIS LUX — live snapshot"),
    muted(`  users     ${u.count ?? 0}`),
    muted(`  products  ${p.count ?? 0} active`),
    muted(`  orders    ${o.count ?? 0}`),
    muted(`  revenue   ${Math.round(revenue).toLocaleString("en-US")} смн (non-cancelled)`),
  ] };
}

async function cmdInspect(sb: SB, t: string[]): Promise<RunResult> {
  const tgt = await resolveAnyTarget(sb, t[1] ?? "", { allowPromo: true });
  if (!tgt) return { lines: [err(`✗ nothing matched "${t[1] ?? ""}".`)] };
  if (tgt.kind === "product") {
    const { data } = await sb.from("products").select("*").eq("id", tgt.id).maybeSingle();
    if (!data) return { lines: [err("✗ gone.")] };
    const d = data as Record<string, unknown>;
    return { lines: [info(`product ${tgt.id}`), ...["title", "brand", "type", "category", "price", "stock", "condition", "color", "rating", "is_active"].map((k) => muted(`  ${k.padEnd(12)} ${String(d[k] ?? "—")}`))] };
  }
  if (tgt.kind === "order") {
    const { data } = await sb.from("orders").select("*").eq("id", tgt.id).maybeSingle();
    if (!data) return { lines: [err("✗ gone.")] };
    const d = data as Record<string, unknown>;
    return { lines: [info(`order ${tgt.id}`), ...["status", "total", "region", "full_name", "phone", "courier_name", "eta_min", "paid_at"].map((k) => muted(`  ${k.padEnd(12)} ${String(d[k] ?? "—")}`))] };
  }
  if (tgt.kind === "user") return cmdWhois(sb, ["whois", t[1]]);
  return { lines: [warn("⚠ inspect works on a product, order or user.")] };
}

/* ====================== ORDER FLOW / PRODUCT / USER SHORTCUTS ========= */
async function cmdFlow(sb: SB, t: string[], status: string): Promise<RunResult> {
  const o = await resolveOrder(sb, t[1] ?? "");
  if (!o) return { lines: [err(`✗ no order "${t[1] ?? ""}".`)] };
  const r = await setOrderStatus(o.id, status);
  return r.ok ? { lines: [ok(`✓ order #${o.id.slice(0, 8)} ${o.status} → ${status}.`)] } : { lines: [err(`✗ ${r.error}`)] };
}

async function cmdFeature(sb: SB, t: string[], on: boolean): Promise<RunResult> {
  const p = await resolveProduct(sb, t[1] ?? "");
  if (!p) return { lines: [err(`✗ no product "${t[1] ?? ""}".`)] };
  const tm = on ? termOf(t[2]) : undefined;
  if (tm === "bad") return { lines: [err(`✗ can't read the term "${t[2]}".`)] };
  const r = await adminSetProductFlag(p.id, "featured", on, tm);
  return r.ok ? { lines: [ok(`✓ "${p.title}" ${on ? "featured (promotion on)" : "un-featured"}${on && tm ? ` (${untilLabel(tm)})` : ""}.`)] } : { lines: [err(`✗ ${r.error}`)] };
}

async function cmdPricePct(sb: SB, t: string[], dir: 1 | -1): Promise<RunResult> {
  const p = await resolveProduct(sb, t[1] ?? "");
  if (!p) return { lines: [err(`✗ no product "${t[1] ?? ""}".`)] };
  const pct = Number(t[2]);
  if (!Number.isFinite(pct) || pct < 0) return { lines: [err("✗ give a positive percent.")] };
  const next = Math.max(0, Math.round(p.price * (1 + (dir * pct) / 100)));
  const r = await adminUpdateProduct(p.id, { price: next });
  return r.ok ? { lines: [ok(`✓ "${p.title}" price ${p.price} → ${next} смн (${dir < 0 ? "−" : "+"}${pct}%).`)] } : { lines: [err(`✗ ${r.error}`)] };
}

async function cmdDuplicate(sb: SB, t: string[]): Promise<RunResult> {
  if (!isUuid(t[1] ?? "")) return { lines: [err(`✗ no product "${t[1] ?? ""}".`)] };
  const { data } = await sb.from("products").select("*").eq("id", t[1]).maybeSingle();
  if (!data) return { lines: [err("✗ product not found.")] };
  const d = data as Record<string, unknown>;
  delete d.id; delete d.created_at; delete d.rating;
  d.title = `${d.title} (copy)`; d.is_active = false;
  const { data: ins, error } = await sb.from("products").insert(d).select("id").single();
  if (error) return { lines: [err(`✗ ${error.message}`)] };
  revalidatePath("/admin/products");
  return { lines: [ok(`✓ duplicated → new draft ${ins.id} (inactive).`)] };
}

async function cmdSellerProducts(sb: SB, t: string[], active: boolean): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user "${t[1] ?? ""}".`)] };
  const { data, error } = await sb.from("products").update({ is_active: active }).eq("seller_id", u.id).select("id");
  if (error) return { lines: [err(`✗ ${error.message}`)] };
  revalidatePath("/admin/products");
  return { lines: [ok(`✓ ${active ? "activated" : "deactivated"} ${(data ?? []).length} product(s) for @${u.username}.`)] };
}

async function cmdMute(sb: SB, t: string[], on: boolean): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user "${t[1] ?? ""}".`)] };
  const tm = on ? termOf(t[2]) : undefined;
  if (tm === "bad") return { lines: [err(`✗ can't read the term "${t[2]}".`)] };
  const r = await adminSetRestriction(u.id, "chat", on, tm);
  return r.ok ? { lines: [ok(on ? `✓ @${u.username} muted (${untilLabel(tm)}).` : `✓ @${u.username} unmuted.`)] } : { lines: [err(`✗ ${r.error}`)] };
}

async function cmdUnverify(sb: SB, t: string[]): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user "${t[1] ?? ""}".`)] };
  const r = await adminUpdateUserProfile(u.id, { is_verified: false });
  return r.ok ? { lines: [ok(`✓ @${u.username} verified badge removed.`)] } : { lines: [err(`✗ ${r.error}`)] };
}

async function cmdTier(sb: SB, t: string[]): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user "${t[1] ?? ""}".`)] };
  const tier = (t[2] ?? "").replace(/^\w/, (c) => c.toUpperCase());
  const r = await adminUpdateUserProfile(u.id, { loyalty_tier: tier });
  return r.ok ? { lines: [ok(`✓ @${u.username} tier → ${tier}.`)] } : { lines: [err(`✗ ${r.error}`)] };
}

async function cmdWarn(sb: SB, t: string[]): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user "${t[1] ?? ""}".`)] };
  const reason = rest(t, 2);
  if (!reason) return { lines: [err("✗ give a reason.")] };
  await sb.from("notifications").insert({ user_id: u.id, type: "system", title: "⚠ Official warning", body: reason });
  return { lines: [ok(`✓ warning sent to @${u.username}.`), muted(`  "${reason}"`)] };
}

/* ====================== QUERY LISTS ================================= */
async function cmdReviewsOf(sb: SB, t: string[]): Promise<RunResult> {
  const tgt = await resolveAnyTarget(sb, t[1] ?? "");
  if (!tgt) return { lines: [err(`✗ nothing matched "${t[1] ?? ""}".`)] };
  if (tgt.kind === "product") {
    const { data } = await sb.from("product_reviews").select("rating,body,created_at,author_id").eq("product_id", tgt.id).order("created_at", { ascending: false }).limit(10);
    const rows = (data ?? []) as { rating: number; body: string; author_id: string }[];
    if (!rows.length) return { lines: [muted("no reviews.")] };
    return { lines: [info(`${rows.length} review(s) on "${tgt.title}":`), ...rows.map((r) => muted(`  ${"★".repeat(Math.round(r.rating))} ${(r.body || "—").slice(0, 70)}`))] };
  }
  if (tgt.kind === "user") {
    const { data } = await sb.from("user_reviews").select("rating,body").eq("subject_id", tgt.id).order("created_at", { ascending: false }).limit(10);
    const rows = (data ?? []) as { rating: number; body: string }[];
    if (!rows.length) return { lines: [muted("no reviews.")] };
    return { lines: [info(`${rows.length} review(s) on @${tgt.username}:`), ...rows.map((r) => muted(`  ${"★".repeat(Math.round(r.rating))} ${(r.body || "—").slice(0, 70)}`))] };
  }
  return { lines: [warn("⚠ reviews_of works on a product or a user.")] };
}

async function cmdFavoritesOf(sb: SB, t: string[]): Promise<RunResult> {
  const p = await resolveProduct(sb, t[1] ?? "");
  if (!p) return { lines: [err(`✗ no product "${t[1] ?? ""}".`)] };
  const { data } = await sb.from("favorites").select("user_id").eq("product_id", p.id).limit(50);
  const ids = ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
  if (!ids.length) return { lines: [muted("nobody favorited it yet.")] };
  const names = await usernames(sb, ids);
  return { lines: [info(`${ids.length} favorited "${p.title}":`), muted("  " + names.join(", "))] };
}

async function cmdCartOf(sb: SB, t: string[]): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user "${t[1] ?? ""}".`)] };
  const { data } = await sb.from("cart_items").select("product_id,quantity").eq("user_id", u.id).limit(50);
  const rows = (data ?? []) as { product_id: string; quantity: number }[];
  if (!rows.length) return { lines: [muted(`@${u.username}'s cart is empty.`)] };
  const titles = await productTitles(sb, rows.map((r) => r.product_id));
  return { lines: [info(`@${u.username}'s cart (${rows.length}):`), ...rows.map((r) => muted(`  ${r.quantity}× ${titles[r.product_id] ?? r.product_id}`))] };
}

async function cmdBlockedOf(sb: SB, t: string[]): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user "${t[1] ?? ""}".`)] };
  const { data } = await sb.from("purchase_blocks").select("scope_type,scope_value,until").eq("user_id", u.id);
  const rows = (data ?? []) as { scope_type: string; scope_value: string; until: string | null }[];
  if (!rows.length) return { lines: [muted(`@${u.username} has no purchase bans.`)] };
  return { lines: [info(`@${u.username} purchase bans:`), ...rows.map((r) => muted(`  ${r.scope_type}:${r.scope_value} — ${r.until ? `until ${new Date(r.until).toLocaleDateString("en-GB")}` : "permanent"}`))] };
}

async function cmdOrdersOf(sb: SB, t: string[], side: "buyer" | "seller"): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user "${t[1] ?? ""}".`)] };
  const n = Math.min(30, Math.max(1, Number(t[2]) || 10));
  const col = side === "buyer" ? "user_id" : "seller_id";
  const { data } = await sb.from("orders").select("id,status,total,created_at").eq(col, u.id).order("created_at", { ascending: false }).limit(n);
  const rows = (data ?? []) as { id: string; status: string; total: number; created_at: string }[];
  if (!rows.length) return { lines: [muted(`@${u.username} has no orders as ${side}.`)] };
  return { lines: [info(`@${u.username} — ${rows.length} order(s) as ${side}:`), ...rows.map((r) => muted(`  ${r.id}  ${r.status.padEnd(16)} ${r.total} смн · ${new Date(r.created_at).toLocaleDateString("en-GB")}`))] };
}

async function cmdProductsOf(sb: SB, t: string[]): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user "${t[1] ?? ""}".`)] };
  const n = Math.min(40, Math.max(1, Number(t[2]) || 12));
  const { data } = await sb.from("products").select("id,title,brand,price,stock,is_active").eq("seller_id", u.id).order("created_at", { ascending: false }).limit(n);
  const rows = (data ?? []) as { id: string; title: string; brand: string; price: number; stock: number; is_active: boolean }[];
  if (!rows.length) return { lines: [muted(`@${u.username} has no products.`)] };
  return { lines: [info(`@${u.username} — ${rows.length} product(s):`), ...rows.map((r) => muted(`  ${r.id}  ${r.brand} · ${r.title} — ${r.price} смн, stock ${r.stock}${r.is_active ? "" : " [inactive]"}`))] };
}

async function cmdSellerOf(sb: SB, t: string[]): Promise<RunResult> {
  const p = await resolveProduct(sb, t[1] ?? "");
  if (!p) return { lines: [err(`✗ no product "${t[1] ?? ""}".`)] };
  const { data } = await sb.from("profiles").select("username,role").eq("id", p.seller_id).maybeSingle();
  const u = data as { username: string; role: string } | null;
  return { lines: [info(`"${p.title}" is sold by @${u?.username ?? "unknown"} (${u?.role ?? "?"}) · ${p.seller_id}`)] };
}

/* ====================== STATS ====================================== */
async function cmdCheck(sb: SB, t: string[]): Promise<RunResult> {
  const metric = (t[1] ?? "").toLowerCase();
  const target = (t[2] ?? "").toLowerCase() === "of" ? (t[3] ?? "") : (t[2] ?? "");
  if (!metric) return { lines: [err("✗ give a metric, e.g. product_stats.")] };

  if (metric === "product_stats" || metric === "sales") {
    if (!isUuid(target)) return { lines: [err("✗ give a product id.")] };
    const d = await getAdminProductDossier(target);
    if (!d) return { lines: [err("✗ product not found.")] };
    const s = d.stats, x = d.extra;
    return { lines: [
      info(`"${d.product.title}" — order statistics`),
      muted(`  ordered ${s.timesOrdered}× · ${s.unitsSold} units sold · ${s.revenue} смн revenue`),
      muted(`  ${s.buyers} buyers · ${s.favorites} favorites · ${s.inCarts} carts (${s.cartUnits} units)`),
      muted(`  ${s.reviews} reviews · ★${s.rating.toFixed(2)} · cancelled ${x.cancelled} (${x.cancelRate}%) · repeat ${x.repeatBuyers}`),
      muted(`  avg sale ${x.avgSalePrice} смн · last sale ${x.lastSale ? new Date(x.lastSale).toLocaleDateString("en-GB") : "—"} · stock ${d.product.stock}`),
    ] };
  }
  const tgt = await resolveAnyTarget(sb, target, { allowPromo: true });
  if (!tgt) return { lines: [err(`✗ nothing matched "${target}".`)] };

  if (metric === "order_stats") {
    if (tgt.kind !== "order") return { lines: [err("✗ give an order id.")] };
    const { data } = await sb.from("orders").select("status,total,subtotal,discount,region,created_at,paid_at").eq("id", tgt.id).maybeSingle();
    const { count } = await sb.from("order_items").select("id", { count: "exact", head: true }).eq("order_id", tgt.id);
    const o = data as Record<string, unknown>;
    return { lines: [info(`order #${tgt.id.slice(0, 8)} — statistics`), muted(`  status ${o.status} · ${count ?? 0} items · ${o.total} смн (sub ${o.subtotal}, disc ${o.discount})`), muted(`  ${o.region} · placed ${new Date(String(o.created_at)).toLocaleString("en-GB")} · ${o.paid_at ? "paid" : "unpaid"}`)] };
  }
  if (metric === "user_stats" || metric === "buyer_stats") {
    if (tgt.kind !== "user") return { lines: [err("✗ give a @user.")] };
    return statUser(sb, tgt.id, tgt.username);
  }
  if (metric === "seller_stats") {
    if (tgt.kind !== "user") return { lines: [err("✗ give a @seller.")] };
    return statSeller(sb, tgt.id, tgt.username);
  }
  if (metric === "promo_stats") {
    if (tgt.kind !== "promo") return { lines: [err("✗ give a promo code.")] };
    const { data } = await sb.from("promo_codes").select("*").eq("id", tgt.id).maybeSingle();
    const p = data as Record<string, unknown>;
    return { lines: [info(`promo ${tgt.code} — statistics`), muted(`  ${p.type} ${p.value} · used ${p.used_count}/${p.usage_limit ?? "∞"} · scope ${p.scope}${p.scope_ref ? `:${p.scope_ref}` : ""} · ${p.is_active ? "active" : "disabled"}`)] };
  }
  if (metric === "reviews") return cmdReviewsOf(sb, ["reviews_of", target]);
  if (metric === "revenue") return cmdRevenue(sb, ["revenue", "all"]);
  return { lines: [err(`✗ unknown metric "${metric}". try product_stats · order_stats · user_stats · seller_stats · promo_stats.`)] };
}

async function statUser(sb: SB, id: string, name: string): Promise<RunResult> {
  const [ord, prod] = await Promise.all([
    sb.from("orders").select("total,status").eq("user_id", id).limit(5000),
    sb.from("products").select("id", { count: "exact", head: true }).eq("seller_id", id),
  ]);
  const orders = (ord.data ?? []) as { total: number; status: string }[];
  const spent = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total ?? 0), 0);
  const [fav, cart] = await Promise.all([
    sb.from("favorites").select("product_id", { count: "exact", head: true }).eq("user_id", id),
    sb.from("cart_items").select("product_id", { count: "exact", head: true }).eq("user_id", id),
  ]);
  return { lines: [info(`@${name} — buyer statistics`), muted(`  ${orders.length} orders · ${Math.round(spent)} смн spent · ${prod.count ?? 0} listings`), muted(`  ${fav.count ?? 0} favorites · ${cart.count ?? 0} in cart`)] };
}

async function statSeller(sb: SB, id: string, name: string): Promise<RunResult> {
  const [prodRes, ordRes] = await Promise.all([
    sb.from("products").select("id,is_active,rating").eq("seller_id", id).limit(5000),
    sb.from("orders").select("total,status").eq("seller_id", id).limit(5000),
  ]);
  const products = (prodRes.data ?? []) as { is_active: boolean; rating: number }[];
  const orders = (ordRes.data ?? []) as { total: number; status: string }[];
  const revenue = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total ?? 0), 0);
  const active = products.filter((p) => p.is_active).length;
  const avgRating = products.length ? products.reduce((s, p) => s + Number(p.rating ?? 0), 0) / products.length : 0;
  return { lines: [info(`@${name} — seller statistics`), muted(`  ${products.length} products (${active} active) · ${orders.length} orders · ${Math.round(revenue)} смн revenue`), muted(`  avg product rating ★${avgRating.toFixed(2)}`)] };
}

async function cmdTop(sb: SB, t: string[]): Promise<RunResult> {
  const kind = (t[1] ?? "").toLowerCase();
  const n = Math.min(30, Math.max(1, Number(t[2]) || 10));
  if (kind === "sellers" || kind === "spenders") {
    const col = kind === "sellers" ? "seller_id" : "user_id";
    const { data } = await sb.from("orders").select(`${col},total,status`).neq("status", "cancelled").limit(20000);
    const sums = new Map<string, number>();
    for (const r of (data ?? []) as Record<string, unknown>[]) { const k = r[col] as string; if (k) sums.set(k, (sums.get(k) ?? 0) + Number(r.total ?? 0)); }
    const topIds = [...sums.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
    const names = await usernameMap(sb, topIds.map(([k]) => k));
    return { lines: [info(`top ${kind} by ${kind === "sellers" ? "sales" : "spend"}:`), ...topIds.map(([k, v], i) => muted(`  ${String(i + 1).padStart(2)}. @${names[k] ?? "?"} — ${Math.round(v)} смн`))] };
  }
  if (kind === "products") {
    const { data } = await sb.from("order_items").select("product_id,title,quantity").limit(40000);
    const sums = new Map<string, { title: string; q: number }>();
    for (const r of (data ?? []) as { product_id: string; title: string; quantity: number }[]) { const cur = sums.get(r.product_id) ?? { title: r.title, q: 0 }; cur.q += Number(r.quantity ?? 0); sums.set(r.product_id, cur); }
    const top = [...sums.entries()].sort((a, b) => b[1].q - a[1].q).slice(0, n);
    return { lines: [info("top products by units sold:"), ...top.map(([, v], i) => muted(`  ${String(i + 1).padStart(2)}. ${v.title} — ${v.q} units`))] };
  }
  if (kind === "brands") {
    const { data } = await sb.from("order_items").select("product_id,quantity,unit_price").limit(40000);
    const items = (data ?? []) as { product_id: string; quantity: number; unit_price: number }[];
    const { data: prods } = await sb.from("products").select("id,brand").limit(20000);
    const brandOf = new Map(((prods ?? []) as { id: string; brand: string }[]).map((p) => [p.id, p.brand]));
    const sums = new Map<string, number>();
    for (const it of items) { const b = brandOf.get(it.product_id) || "—"; sums.set(b, (sums.get(b) ?? 0) + Number(it.quantity) * Number(it.unit_price)); }
    const top = [...sums.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
    return { lines: [info("top brands by revenue:"), ...top.map(([b, v], i) => muted(`  ${String(i + 1).padStart(2)}. ${b} — ${Math.round(v)} смн`))] };
  }
  if (kind === "promos") {
    const { data } = await sb.from("promo_codes").select("code,used_count,type,value").order("used_count", { ascending: false }).limit(n);
    const rows = (data ?? []) as { code: string; used_count: number; type: string; value: number }[];
    return { lines: [info("top promos by redemptions:"), ...rows.map((r, i) => muted(`  ${String(i + 1).padStart(2)}. ${r.code} — used ${r.used_count}× (${r.type} ${r.value})`))] };
  }
  return { lines: [err("✗ kind must be sellers · products · spenders · brands · promos.")] };
}

async function cmdRevenue(sb: SB, t: string[]): Promise<RunResult> {
  const win = (t[1] ?? "all").toLowerCase();
  const since = win === "today" ? Date.now() - 86_400_000 : win === "7d" ? Date.now() - 7 * 86_400_000 : win === "30d" ? Date.now() - 30 * 86_400_000 : 0;
  let q = sb.from("orders").select("total,created_at").neq("status", "cancelled").limit(20000);
  if (since) q = q.gte("created_at", new Date(since).toISOString());
  const { data } = await q;
  const rows = (data ?? []) as { total: number }[];
  const sum = rows.reduce((s, r) => s + Number(r.total ?? 0), 0);
  return { lines: [info(`revenue (${win}): ${Math.round(sum).toLocaleString("en-US")} смн across ${rows.length} orders`)] };
}

async function cmdCount(sb: SB, t: string[]): Promise<RunResult> {
  const what = (t[1] ?? "").toLowerCase();
  const head = { count: "exact" as const, head: true };
  const ACTIVE = ["placed", "processing", "out_for_delivery", "arrived"];
  let res: { count: number | null };
  let label = what;
  switch (what) {
    case "users": res = await sb.from("profiles").select("id", head); break;
    case "products": res = await sb.from("products").select("id", head); break;
    case "orders": res = await sb.from("orders").select("id", head); break;
    case "sellers": res = await sb.from("profiles").select("id", head).eq("role", "seller"); break;
    case "couriers": res = await sb.from("profiles").select("id", head).eq("role", "courier"); break;
    case "admins": res = await sb.from("profiles").select("id", head).eq("role", "admin"); break;
    case "banned": res = await sb.from("profiles").select("id", head).eq("is_banned", true); break;
    case "verified": res = await sb.from("profiles").select("id", head).eq("is_verified", true); break;
    case "active_orders": res = await sb.from("orders").select("id", head).in("status", ACTIVE); label = "active orders"; break;
    case "out_of_stock": res = await sb.from("products").select("id", head).eq("stock", 0); label = "out-of-stock products"; break;
    default: return { lines: [err("✗ unknown kind.")] };
  }
  return { lines: [info(`${label}: ${res.count ?? 0}`)] };
}

async function cmdSalesCmd(sb: SB, t: string[]): Promise<RunResult> {
  const tgt = await resolveAnyTarget(sb, t[1] ?? "");
  if (!tgt) return { lines: [err(`✗ nothing matched "${t[1] ?? ""}".`)] };
  if (tgt.kind === "product") return cmdCheck(sb, ["check", "product_stats", tgt.id]);
  if (tgt.kind === "user") {
    const { data } = await sb.from("products").select("id").eq("seller_id", tgt.id).limit(5000);
    const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
    if (!ids.length) return { lines: [muted(`@${tgt.username} has no products.`)] };
    const { data: items } = await sb.from("order_items").select("quantity,unit_price").in("product_id", ids).limit(40000);
    const its = (items ?? []) as { quantity: number; unit_price: number }[];
    const units = its.reduce((s, i) => s + Number(i.quantity), 0);
    const rev = its.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0);
    return { lines: [info(`@${tgt.username} sales: ${units} units · ${Math.round(rev)} смн across ${ids.length} products`)] };
  }
  return { lines: [warn("⚠ sales works on a product or a @seller.")] };
}

async function cmdRegionStats(sb: SB): Promise<RunResult> {
  const { data } = await sb.from("orders").select("region,total,status").neq("status", "cancelled").limit(20000);
  const m = new Map<string, { n: number; rev: number }>();
  for (const r of (data ?? []) as { region: string; total: number }[]) { const c = m.get(r.region) ?? { n: 0, rev: 0 }; c.n++; c.rev += Number(r.total ?? 0); m.set(r.region, c); }
  const rows = [...m.entries()].sort((a, b) => b[1].rev - a[1].rev);
  if (!rows.length) return { lines: [muted("no orders.")] };
  return { lines: [info("orders by region:"), ...rows.map(([r, v]) => muted(`  ${r.padEnd(12)} ${v.n} orders · ${Math.round(v.rev)} смн`))] };
}

async function cmdStatusBreakdown(sb: SB): Promise<RunResult> {
  const { data } = await sb.from("orders").select("status").limit(20000);
  const m = new Map<string, number>();
  for (const r of (data ?? []) as { status: string }[]) m.set(r.status, (m.get(r.status) ?? 0) + 1);
  const rows = [...m.entries()].sort((a, b) => b[1] - a[1]);
  return { lines: [info("orders by status:"), ...rows.map(([s, n]) => muted(`  ${s.padEnd(18)} ${n}`))] };
}

async function cmdConversion(sb: SB): Promise<RunResult> {
  const [f, c, o] = await Promise.all([
    sb.from("favorites").select("product_id", { count: "exact", head: true }),
    sb.from("cart_items").select("product_id", { count: "exact", head: true }),
    sb.from("orders").select("id", { count: "exact", head: true }).neq("status", "cancelled"),
  ]);
  return { lines: [info("platform funnel:"), muted(`  favorites ${f.count ?? 0}  →  in carts ${c.count ?? 0}  →  orders ${o.count ?? 0}`)] };
}

async function cmdInventoryHealth(sb: SB): Promise<RunResult> {
  const { data } = await sb.from("products").select("stock,is_active").limit(20000);
  const rows = (data ?? []) as { stock: number; is_active: boolean }[];
  const out = rows.filter((r) => r.stock === 0).length;
  const low = rows.filter((r) => r.stock > 0 && r.stock <= 3).length;
  const inactive = rows.filter((r) => !r.is_active).length;
  return { lines: [info("inventory health:"), muted(`  ${rows.length} products · ${out} out of stock · ${low} low (≤3) · ${inactive} inactive`)] };
}

async function cmdDaily(sb: SB, t: string[]): Promise<RunResult> {
  const days = Math.min(30, Math.max(1, Number(t[1]) || 7));
  const since = Date.now() - days * 86_400_000;
  const { data } = await sb.from("orders").select("total,status,created_at").gte("created_at", new Date(since).toISOString()).limit(20000);
  const rows = (data ?? []) as { total: number; status: string; created_at: string }[];
  const map = new Map<string, { n: number; rev: number }>();
  for (const r of rows) { const d = r.created_at.slice(0, 10); const c = map.get(d) ?? { n: 0, rev: 0 }; c.n++; if (r.status !== "cancelled") c.rev += Number(r.total ?? 0); map.set(d, c); }
  const out: ConsoleLine[] = [info(`last ${days} days:`)];
  for (let i = days - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10); const v = map.get(d) ?? { n: 0, rev: 0 }; out.push(muted(`  ${d}  ${String(v.n).padStart(3)} orders · ${Math.round(v.rev)} смн`)); }
  return { lines: out };
}

/* ---- small lookup helpers ---- */
async function usernames(sb: SB, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { data } = await sb.from("profiles").select("username").in("id", ids);
  return ((data ?? []) as { username: string }[]).map((r) => `@${r.username}`);
}
async function usernameMap(sb: SB, ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const { data } = await sb.from("profiles").select("id,username").in("id", ids);
  const m: Record<string, string> = {};
  for (const r of (data ?? []) as { id: string; username: string }[]) m[r.id] = r.username;
  return m;
}
async function productTitles(sb: SB, ids: string[]): Promise<Record<string, string>> {
  const uu = ids.filter((x) => isUuid(x));
  if (!uu.length) return {};
  const { data } = await sb.from("products").select("id,title").in("id", uu);
  const m: Record<string, string> = {};
  for (const r of (data ?? []) as { id: string; title: string }[]) m[r.id] = r.title;
  return m;
}
async function resolvePromo(sb: SB, code: string) {
  const { data } = await sb.from("promo_codes").select("id,code,is_active").ilike("code", code.replace(/^@/, "")).maybeSingle();
  return (data as { id: string; code: string; is_active: boolean } | null) ?? null;
}

const ACTIVE_STATUS = ["placed", "processing", "out_for_delivery", "arrived"];

/* ====================== MORE: social / notifications ================ */
async function cmdClearNotifs(sb: SB, t: string[]): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user "${t[1] ?? ""}".`)] };
  await sb.from("notifications").delete().eq("user_id", u.id);
  return { lines: [ok(`✓ cleared @${u.username}'s notification inbox.`)] };
}

async function cmdWelcome(sb: SB, t: string[]): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user "${t[1] ?? ""}".`)] };
  await sb.from("notifications").insert({ user_id: u.id, type: "system", title: "👋 Welcome to OASIS LUX", body: "We're glad you're here. Explore the catalog and enjoy exclusive perks." });
  return { lines: [ok(`✓ welcome sent to @${u.username}.`)] };
}

async function cmdBlockPair(sb: SB, t: string[], on: boolean): Promise<RunResult> {
  const a = await resolveUser(sb, t[1] ?? ""); const b = await resolveUser(sb, t[2] ?? "");
  if (!a || !b) return { lines: [err("✗ resolve both users.")] };
  if (on) {
    await sb.from("blocks").upsert([{ blocker_id: a.id, blocked_id: b.id }, { blocker_id: b.id, blocked_id: a.id }], { onConflict: "blocker_id,blocked_id" });
    return { lines: [ok(`✓ @${a.username} ⊘ @${b.username} blocked (both ways).`)] };
  }
  await sb.from("blocks").delete().or(`and(blocker_id.eq.${a.id},blocked_id.eq.${b.id}),and(blocker_id.eq.${b.id},blocked_id.eq.${a.id})`);
  return { lines: [ok(`✓ block between @${a.username} and @${b.username} removed.`)] };
}

async function cmdDeleteChat(sb: SB, t: string[]): Promise<RunResult> {
  const a = await resolveUser(sb, t[1] ?? ""); const b = await resolveUser(sb, t[2] ?? "");
  if (!a || !b) return { lines: [err("✗ resolve both users.")] };
  const [x, y] = [a.id, b.id].sort();
  const { error } = await sb.from("conversations").delete().eq("user_a", x).eq("user_b", y);
  if (error) return { lines: [err(`✗ ${error.message}`)] };
  return { lines: [ok(`✓ conversation between @${a.username} and @${b.username} deleted.`)] };
}

async function cmdViolationsOf(sb: SB, t: string[]): Promise<RunResult> {
  const tgt = await resolveAnyTarget(sb, t[1] ?? "");
  if (!tgt) return { lines: [err(`✗ nothing matched "${t[1] ?? ""}".`)] };
  const col = tgt.kind === "product" ? "subject_id" : "user_id";
  const id = tgt.kind === "product" ? tgt.id : tgt.kind === "user" ? tgt.id : "";
  if (!id) return { lines: [warn("⚠ works on a user or product.")] };
  const { data } = await sb.from("violations").select("category,severity,action_label,created_at").eq(col, id).order("created_at", { ascending: false }).limit(15);
  const rows = (data ?? []) as { category: string; severity: number; action_label: string; created_at: string }[];
  if (!rows.length) return { lines: [muted("clean record — no violations.")] };
  return { lines: [info(`${rows.length} violation(s):`), ...rows.map((r) => muted(`  ${new Date(r.created_at).toLocaleDateString("en-GB")} · ${r.category} sev${r.severity} → ${r.action_label}`))] };
}

async function cmdReportsOn(sb: SB, t: string[]): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user "${t[1] ?? ""}".`)] };
  const { data } = await sb.from("reports").select("category,status,description,created_at").eq("reported_id", u.id).order("created_at", { ascending: false }).limit(15);
  const rows = (data ?? []) as { category: string; status: string; description: string; created_at: string }[];
  if (!rows.length) return { lines: [muted(`no reports against @${u.username}.`)] };
  return { lines: [info(`${rows.length} report(s) on @${u.username}:`), ...rows.map((r) => muted(`  ${r.status.padEnd(10)} ${r.category} — ${(r.description || "—").slice(0, 50)}`))] };
}

async function cmdConversations(sb: SB, t: string[]): Promise<RunResult> {
  const n = Math.min(40, Math.max(1, Number(t[1]) || 12));
  const { data } = await sb.from("conversations").select("id,user_a,user_b,last_message,last_at").order("last_at", { ascending: false }).limit(n);
  const rows = (data ?? []) as { id: string; user_a: string; user_b: string; last_message: string; last_at: string }[];
  if (!rows.length) return { lines: [muted("no conversations.")] };
  const names = await usernameMap(sb, rows.flatMap((r) => [r.user_a, r.user_b]));
  return { lines: [info(`${rows.length} recent thread(s):`), ...rows.map((r) => muted(`  @${names[r.user_a] ?? "?"} ↔ @${names[r.user_b] ?? "?"} · "${(r.last_message || "").slice(0, 40)}"`))] };
}

async function cmdPromos(sb: SB, t: string[]): Promise<RunResult> {
  const n = Math.min(50, Math.max(1, Number(t[1]) || 20));
  const { data } = await sb.from("promo_codes").select("code,type,value,is_active,used_count,usage_limit,expires_at").order("created_at", { ascending: false }).limit(n);
  const rows = (data ?? []) as { code: string; type: string; value: number; is_active: boolean; used_count: number; usage_limit: number | null; expires_at: string | null }[];
  if (!rows.length) return { lines: [muted("no promo codes.")] };
  return { lines: [info(`${rows.length} promo(s):`), ...rows.map((r) => muted(`  ${r.code.padEnd(14)} ${r.type} ${r.value} · ${r.used_count}/${r.usage_limit ?? "∞"} · ${r.is_active ? "active" : "off"}${r.expires_at ? ` · exp ${new Date(r.expires_at).toLocaleDateString("en-GB")}` : ""}`))] };
}

/* ====================== MORE: inventory / order lists =============== */
async function cmdLowStock(sb: SB, t: string[]): Promise<RunResult> {
  const thr = Math.max(1, Number(t[1]) || 3);
  const { data } = await sb.from("products").select("id,title,brand,stock").gt("stock", 0).lte("stock", thr).order("stock", { ascending: true }).limit(30);
  const rows = (data ?? []) as { id: string; title: string; brand: string; stock: number }[];
  if (!rows.length) return { lines: [muted(`no products at or below ${thr} units.`)] };
  return { lines: [info(`${rows.length} low-stock (≤${thr}):`), ...rows.map((r) => muted(`  ${r.id}  ${r.brand} · ${r.title} — ${r.stock} left`))] };
}

async function cmdOutOfStock(sb: SB, t: string[]): Promise<RunResult> {
  const n = Math.min(50, Math.max(1, Number(t[1]) || 20));
  const { data } = await sb.from("products").select("id,title,brand").eq("stock", 0).limit(n);
  const rows = (data ?? []) as { id: string; title: string; brand: string }[];
  if (!rows.length) return { lines: [muted("nothing is out of stock 🎉")] };
  return { lines: [info(`${rows.length} out of stock:`), ...rows.map((r) => muted(`  ${r.id}  ${r.brand} · ${r.title}`))] };
}

async function cmdZeroSales(sb: SB, t: string[]): Promise<RunResult> {
  const n = Math.min(50, Math.max(1, Number(t[1]) || 20));
  const [pr, it] = await Promise.all([
    sb.from("products").select("id,title,brand").limit(20000),
    sb.from("order_items").select("product_id").limit(40000),
  ]);
  const sold = new Set(((it.data ?? []) as { product_id: string }[]).map((r) => r.product_id));
  const rows = ((pr.data ?? []) as { id: string; title: string; brand: string }[]).filter((p) => !sold.has(p.id)).slice(0, n);
  if (!rows.length) return { lines: [muted("every product has sold at least once.")] };
  return { lines: [info(`${rows.length} never-sold product(s):`), ...rows.map((r) => muted(`  ${r.id}  ${r.brand} · ${r.title}`))] };
}

async function cmdOrdersList(sb: SB, t: string[], kind: "pending" | "unpaid" | "cancelled"): Promise<RunResult> {
  const n = Math.min(40, Math.max(1, Number(t[1]) || 15));
  let q = sb.from("orders").select("id,status,total,created_at,paid_at").order("created_at", { ascending: false }).limit(n);
  if (kind === "pending") q = q.in("status", ACTIVE_STATUS);
  else if (kind === "cancelled") q = q.eq("status", "cancelled");
  else q = q.is("paid_at", null).neq("status", "cancelled");
  const { data } = await q;
  const rows = (data ?? []) as { id: string; status: string; total: number; created_at: string }[];
  if (!rows.length) return { lines: [muted(`no ${kind} orders.`)] };
  return { lines: [info(`${rows.length} ${kind} order(s):`), ...rows.map((r) => muted(`  ${r.id}  ${r.status.padEnd(16)} ${r.total} смн · ${new Date(r.created_at).toLocaleDateString("en-GB")}`))] };
}

async function cmdBiggestOrders(sb: SB, t: string[]): Promise<RunResult> {
  const n = Math.min(30, Math.max(1, Number(t[1]) || 10));
  const { data } = await sb.from("orders").select("id,total,status,region").neq("status", "cancelled").order("total", { ascending: false }).limit(n);
  const rows = (data ?? []) as { id: string; total: number; status: string; region: string }[];
  if (!rows.length) return { lines: [muted("no orders.")] };
  return { lines: [info(`top ${rows.length} orders by total:`), ...rows.map((r, i) => muted(`  ${String(i + 1).padStart(2)}. ${r.id}  ${r.total} смн · ${r.region} · ${r.status}`))] };
}

/* ====================== MORE: promo controls / stats =============== */
async function cmdPromoToggle(sb: SB, t: string[], action: "enable" | "disable" | "expire"): Promise<RunResult> {
  const p = await resolvePromo(sb, t[1] ?? "");
  if (!p) return { lines: [err(`✗ no promo "${t[1] ?? ""}".`)] };
  const patch = action === "expire" ? { expires_at: new Date().toISOString() } : { is_active: action === "enable" };
  const { error } = await sb.from("promo_codes").update(patch).eq("id", p.id);
  if (error) return { lines: [err(`✗ ${error.message}`)] };
  revalidatePath("/admin/promo");
  return { lines: [ok(`✓ promo ${p.code} ${action === "expire" ? "expired now" : action === "enable" ? "activated" : "disabled"}.`)] };
}

async function cmdGrowth(sb: SB): Promise<RunResult> {
  const wk = 7 * 86_400_000;
  const { data } = await sb.from("profiles").select("created_at").gte("created_at", new Date(Date.now() - 2 * wk).toISOString()).limit(20000);
  const rows = (data ?? []) as { created_at: string }[];
  const now = Date.now();
  const last7 = rows.filter((r) => now - new Date(r.created_at).getTime() < wk).length;
  const prev7 = rows.length - last7;
  const delta = prev7 ? Math.round(((last7 - prev7) / prev7) * 100) : 100;
  return { lines: [info("signups:"), muted(`  this week ${last7} · last week ${prev7} · ${delta >= 0 ? "+" : ""}${delta}%`)] };
}

async function cmdAov(sb: SB): Promise<RunResult> {
  const { data } = await sb.from("orders").select("total").neq("status", "cancelled").limit(20000);
  const rows = (data ?? []) as { total: number }[];
  const sum = rows.reduce((s, r) => s + Number(r.total ?? 0), 0);
  return { lines: [info(`average order value: ${rows.length ? Math.round(sum / rows.length) : 0} смн (over ${rows.length} orders)`)] };
}

async function cmdRepeatRate(sb: SB): Promise<RunResult> {
  const { data } = await sb.from("orders").select("user_id,status").neq("status", "cancelled").limit(20000);
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { user_id: string }[]) counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);
  const buyers = counts.size;
  const repeat = [...counts.values()].filter((c) => c >= 2).length;
  return { lines: [info(`repeat buyers: ${repeat}/${buyers} (${buyers ? Math.round((repeat / buyers) * 100) : 0}%)`)] };
}

async function cmdActiveUsers(sb: SB, t: string[]): Promise<RunResult> {
  const days = Math.min(365, Math.max(1, Number(t[1]) || 30));
  const { data } = await sb.from("orders").select("user_id").gte("created_at", new Date(Date.now() - days * 86_400_000).toISOString()).limit(20000);
  const set = new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id));
  return { lines: [info(`active buyers (last ${days}d): ${set.size}`)] };
}

/* ====================== ANALYTICS ================================== */
async function cmdLtv(sb: SB): Promise<RunResult> {
  const { data } = await sb.from("orders").select("user_id,total,status").neq("status", "cancelled").limit(20000);
  const rows = (data ?? []) as { user_id: string; total: number }[];
  const buyers = new Set(rows.map((r) => r.user_id)).size;
  const rev = rows.reduce((s, r) => s + Number(r.total ?? 0), 0);
  return { lines: [info(`lifetime value: ${buyers ? Math.round(rev / buyers) : 0} смн per buyer (${buyers} buyers)`)] };
}

async function cmdChurn(sb: SB, t: string[]): Promise<RunResult> {
  const days = Math.min(365, Math.max(1, Number(t[1]) || 30));
  const { data } = await sb.from("orders").select("user_id,created_at").neq("status", "cancelled").limit(20000);
  const last = new Map<string, number>();
  for (const r of (data ?? []) as { user_id: string; created_at: string }[]) { const ts = new Date(r.created_at).getTime(); if (ts > (last.get(r.user_id) ?? 0)) last.set(r.user_id, ts); }
  const cutoff = Date.now() - days * 86_400_000;
  const churned = [...last.values()].filter((ts) => ts < cutoff).length;
  return { lines: [info(`churned buyers (no order in ${days}d): ${churned}/${last.size}`)] };
}

async function sinceCount(sb: SB, table: string, ms: number): Promise<number> {
  const { count } = await sb.from(table).select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - ms).toISOString());
  return count ?? 0;
}
async function cmdNewToday(sb: SB): Promise<RunResult> { return { lines: [info(`signups (24h): ${await sinceCount(sb, "profiles", 86_400_000)}`)] }; }
async function cmdOrdersToday(sb: SB): Promise<RunResult> { return { lines: [info(`orders (24h): ${await sinceCount(sb, "orders", 86_400_000)}`)] }; }

async function cmdPeakHour(sb: SB): Promise<RunResult> {
  const { data } = await sb.from("orders").select("created_at").limit(20000);
  const hours = new Array(24).fill(0) as number[];
  for (const r of (data ?? []) as { created_at: string }[]) hours[new Date(r.created_at).getHours()]++;
  const peak = hours.indexOf(Math.max(...hours));
  return { lines: [info(`busiest hour: ${String(peak).padStart(2, "0")}:00 (${hours[peak]} orders)`), muted("  " + hours.map((h, i) => (i % 6 === 0 ? `\n  ${String(i).padStart(2, "0")}h ` : "") + "▏".repeat(Math.min(20, h))).join(""))] };
}

async function cmdBestDay(sb: SB): Promise<RunResult> {
  const { data } = await sb.from("orders").select("total,status,created_at").neq("status", "cancelled").gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()).limit(20000);
  const m = new Map<string, number>();
  for (const r of (data ?? []) as { total: number; created_at: string }[]) { const d = r.created_at.slice(0, 10); m.set(d, (m.get(d) ?? 0) + Number(r.total ?? 0)); }
  const best = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  return { lines: [best ? info(`best day (30d): ${best[0]} — ${Math.round(best[1])} смн`) : muted("no orders in 30 days.")] };
}

async function cmdAvgRating(sb: SB): Promise<RunResult> {
  const { data } = await sb.from("products").select("rating").gt("rating", 0).limit(20000);
  const rows = (data ?? []) as { rating: number }[];
  const avg = rows.length ? rows.reduce((s, r) => s + Number(r.rating), 0) / rows.length : 0;
  return { lines: [info(`average product rating: ★${avg.toFixed(2)} (over ${rows.length} rated products)`)] };
}

async function cmdRatingDist(sb: SB): Promise<RunResult> {
  const { data } = await sb.from("products").select("rating").limit(20000);
  const buckets = [0, 0, 0, 0, 0, 0];
  for (const r of (data ?? []) as { rating: number }[]) buckets[Math.min(5, Math.round(Number(r.rating ?? 0)))]++;
  return { lines: [info("rating distribution:"), ...[5, 4, 3, 2, 1, 0].map((s) => muted(`  ${s}★ ${String(buckets[s]).padStart(5)} ${"█".repeat(Math.min(30, Math.round(buckets[s] / Math.max(1, Math.max(...buckets)) * 30)))}`))] };
}

async function cmdDist(sb: SB, col: string, label: string): Promise<RunResult> {
  const { data } = await sb.from("profiles").select(col).limit(20000);
  const m = new Map<string, number>();
  for (const r of (data ?? []) as unknown as Record<string, unknown>[]) { const k = String(r[col] ?? "—"); m.set(k, (m.get(k) ?? 0) + 1); }
  const rows = [...m.entries()].sort((a, b) => b[1] - a[1]);
  return { lines: [info(`accounts by ${label}:`), ...rows.map(([k, v]) => muted(`  ${k.padEnd(12)} ${v}`))] };
}

async function cmdVerifiedRate(sb: SB): Promise<RunResult> {
  const [tot, ver] = await Promise.all([
    sb.from("profiles").select("id", { count: "exact", head: true }),
    sb.from("profiles").select("id", { count: "exact", head: true }).eq("is_verified", true),
  ]);
  const t = tot.count ?? 0, v = ver.count ?? 0;
  return { lines: [info(`verified: ${v}/${t} (${t ? Math.round((v / t) * 100) : 0}%)`)] };
}

async function cmdCatalogValue(sb: SB): Promise<RunResult> {
  const { data } = await sb.from("products").select("price,stock").eq("is_active", true).limit(20000);
  const val = ((data ?? []) as { price: number; stock: number }[]).reduce((s, r) => s + Number(r.price ?? 0) * Number(r.stock ?? 0), 0);
  return { lines: [info(`catalog retail value: ${Math.round(val).toLocaleString("en-US")} смн`)] };
}

async function cmdStockTotal(sb: SB): Promise<RunResult> {
  const { data } = await sb.from("products").select("stock").limit(20000);
  const units = ((data ?? []) as { stock: number }[]).reduce((s, r) => s + Number(r.stock ?? 0), 0);
  return { lines: [info(`total units in stock: ${units.toLocaleString("en-US")}`)] };
}

async function cmdPriceAvg(sb: SB, t: string[]): Promise<RunResult> {
  const scopeTok = t.find((x, i) => i >= 1 && x.includes(":"));
  let q = sb.from("products").select("price").limit(20000);
  let label = "all products";
  if (scopeTok) { const [k, ...v] = scopeTok.split(":"); const val = v.join(":"); if (k === "brand" || k === "category") { q = q.ilike(k, val); label = `${k} ${val}`; } }
  const { data } = await q;
  const rows = (data ?? []) as { price: number }[];
  const avg = rows.length ? rows.reduce((s, r) => s + Number(r.price ?? 0), 0) / rows.length : 0;
  return { lines: [info(`avg price (${label}): ${Math.round(avg)} смн over ${rows.length} products`)] };
}

/* ====================== TAXONOMY + LOOKUPS ========================= */
async function cmdVocabList(sb: SB, table: "brands" | "tags"): Promise<RunResult> {
  const { data } = await sb.from(table).select("name").order("name").limit(500);
  const names = ((data ?? []) as { name: string }[]).map((r) => r.name);
  return { lines: [info(`${names.length} ${table}:`), muted("  " + (names.join(" · ") || "—"))] };
}

async function cmdCategoriesList(sb: SB): Promise<RunResult> {
  const { data } = await sb.from("categories").select("name,slug,parent_id").order("sort").limit(500);
  const rows = (data ?? []) as { name: string; slug: string; parent_id: string | null }[];
  return { lines: [info(`${rows.length} categories:`), ...rows.map((c) => muted(`  ${c.parent_id ? "  ↳ " : ""}${c.name}  (${c.slug})`))] };
}

async function cmdColorsList(sb: SB): Promise<RunResult> {
  const { data } = await sb.from("colors").select("name,hex").order("name").limit(500);
  const rows = (data ?? []) as { name: string; hex: string }[];
  return { lines: [info(`${rows.length} colors:`), ...rows.map((c) => muted(`  ${c.hex}  ${c.name}`))] };
}

async function cmdOrderItems(sb: SB, t: string[]): Promise<RunResult> {
  const o = await resolveOrder(sb, t[1] ?? "");
  if (!o) return { lines: [err(`✗ no order "${t[1] ?? ""}".`)] };
  const { data } = await sb.from("order_items").select("title,quantity,unit_price").eq("order_id", o.id);
  const rows = (data ?? []) as { title: string; quantity: number; unit_price: number }[];
  if (!rows.length) return { lines: [muted("no items.")] };
  return { lines: [info(`order #${o.id.slice(0, 8)} items:`), ...rows.map((r) => muted(`  ${r.quantity}× ${r.title} @ ${r.unit_price} смн`))] };
}

async function cmdTrack(sb: SB, t: string[]): Promise<RunResult> {
  if (!isUuid(t[1] ?? "")) return { lines: [err(`✗ no order "${t[1] ?? ""}".`)] };
  const { data } = await sb.from("orders").select("status,region,courier_name,courier_phone,courier_vehicle,distance_km,eta_min").eq("id", t[1]).maybeSingle();
  if (!data) return { lines: [err("✗ order not found.")] };
  const o = data as Record<string, unknown>;
  return { lines: [info(`#${(t[1] as string).slice(0, 8)} — ${o.status}`), muted(`  ${o.region} · ${o.distance_km}km · ETA ${o.eta_min}min`), muted(`  courier ${o.courier_name || "—"} ${o.courier_phone || ""} (${o.courier_vehicle || "—"})`)] };
}

async function cmdFindContact(sb: SB, t: string[], col: "phone" | "email"): Promise<RunResult> {
  const q = (t[1] ?? "").trim();
  if (!q) return { lines: [err("✗ give a query.")] };
  const { data } = await sb.from("profiles").select("id,username,phone,email").ilike(col, `%${q}%`).limit(15);
  const rows = (data ?? []) as { id: string; username: string; phone: string; email: string }[];
  if (!rows.length) return { lines: [muted(`no account with ${col} ~ "${q}".`)] };
  return { lines: [info(`${rows.length} match(es):`), ...rows.map((r) => muted(`  @${r.username.padEnd(18)} ${r[col] ?? "—"}  ${r.id}`))] };
}

async function cmdSocialsOf(sb: SB, t: string[]): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user "${t[1] ?? ""}".`)] };
  const { data } = await sb.from("profiles").select("socials").eq("id", u.id).maybeSingle();
  const s = (data?.socials ?? {}) as Record<string, string>;
  const keys = Object.keys(s);
  if (!keys.length) return { lines: [muted(`@${u.username} has no socials.`)] };
  return { lines: [info(`@${u.username} socials:`), ...keys.map((k) => muted(`  ${k}: ${s[k]}`))] };
}

async function cmdLinksOf(sb: SB, t: string[]): Promise<RunResult> {
  const u = await resolveUser(sb, t[1] ?? "");
  if (!u) return { lines: [err(`✗ no user "${t[1] ?? ""}".`)] };
  const { data } = await sb.from("profiles").select("links").eq("id", u.id).maybeSingle();
  const links = (data?.links ?? []) as { label: string; url: string }[];
  if (!links.length) return { lines: [muted(`@${u.username} has no links.`)] };
  return { lines: [info(`@${u.username} links:`), ...links.map((l) => muted(`  ${l.label}: ${l.url}`))] };
}

async function cmdTagSearch(sb: SB, t: string[]): Promise<RunResult> {
  const tag = (t[1] ?? "").trim();
  if (!tag) return { lines: [err("✗ give a tag.")] };
  const { data } = await sb.from("products").select("id,title,brand").contains("tags", [tag]).limit(20);
  const rows = (data ?? []) as { id: string; title: string; brand: string }[];
  if (!rows.length) return { lines: [muted(`no products tagged "${tag}".`)] };
  return { lines: [info(`${rows.length} tagged "${tag}":`), ...rows.map((r) => muted(`  ${r.id}  ${r.brand} · ${r.title}`))] };
}

async function cmdRandomUser(sb: SB): Promise<RunResult> {
  const { data } = await sb.from("profiles").select("id,username,role").limit(1000);
  const rows = (data ?? []) as { id: string; username: string; role: string }[];
  if (!rows.length) return { lines: [muted("no users.")] };
  const r = rows[Math.floor(Math.random() * rows.length)];
  return { lines: [info(`🎲 @${r.username} (${r.role}) · ${r.id}`)] };
}

/* ====================== DISTRIBUTIONS / RATES / COUNTS ============== */
async function cmdDistT(sb: SB, table: string, col: string, label: string): Promise<RunResult> {
  const { data } = await sb.from(table).select(col).limit(20000);
  const m = new Map<string, number>();
  for (const r of (data ?? []) as unknown as Record<string, unknown>[]) { const k = String(r[col] ?? "—"); m.set(k, (m.get(k) ?? 0) + 1); }
  const rows = [...m.entries()].sort((a, b) => b[1] - a[1]);
  if (!rows.length) return { lines: [muted("no data.")] };
  return { lines: [info(`${table} by ${label}:`), ...rows.map(([k, v]) => muted(`  ${k.padEnd(14)} ${v}`))] };
}

async function cmdRate(sb: SB, kind: "fulfilled" | "cancelled" | "paid"): Promise<RunResult> {
  const total = (await sb.from("orders").select("id", { count: "exact", head: true })).count ?? 0;
  let hit = 0;
  if (kind === "paid") hit = (await sb.from("orders").select("id", { count: "exact", head: true }).not("paid_at", "is", null)).count ?? 0;
  else hit = (await sb.from("orders").select("id", { count: "exact", head: true }).eq("status", kind)).count ?? 0;
  return { lines: [info(`${kind} rate: ${hit}/${total} (${total ? Math.round((hit / total) * 100) : 0}%)`)] };
}

async function cmdAvgItems(sb: SB): Promise<RunResult> {
  const [o, i] = await Promise.all([
    sb.from("orders").select("id", { count: "exact", head: true }),
    sb.from("order_items").select("id", { count: "exact", head: true }),
  ]);
  const oc = o.count ?? 0, ic = i.count ?? 0;
  return { lines: [info(`average items per order: ${oc ? (ic / oc).toFixed(2) : 0} (${ic} items / ${oc} orders)`)] };
}

async function cmdDiscountTotal(sb: SB): Promise<RunResult> {
  const { data } = await sb.from("orders").select("discount").limit(20000);
  const sum = ((data ?? []) as { discount: number }[]).reduce((s, r) => s + Number(r.discount ?? 0), 0);
  return { lines: [info(`total discount given: ${Math.round(sum).toLocaleString("en-US")} смн`)] };
}

async function cmdTableCount(sb: SB, table: string, label: string): Promise<RunResult> {
  const { count } = await sb.from(table).select("*", { count: "exact", head: true });
  return { lines: [info(`${label}: ${(count ?? 0).toLocaleString("en-US")}`)] };
}

async function cmdBuyersCount(sb: SB): Promise<RunResult> {
  const { data } = await sb.from("orders").select("user_id").limit(20000);
  const set = new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id));
  return { lines: [info(`distinct buyers: ${set.size}`)] };
}

/* ====================== SORTED PRODUCT / PROFILE LISTS ============= */
async function cmdProductsSorted(sb: SB, t: string[], col: "rating" | "price", asc: boolean): Promise<RunResult> {
  const n = Math.min(30, Math.max(1, Number(t[1]) || 10));
  let q = sb.from("products").select("id,title,brand,price,rating");
  if (col === "rating" && asc) q = q.gt("rating", 0);
  const { data } = await q.order(col, { ascending: asc }).limit(n);
  const rows = (data ?? []) as { id: string; title: string; brand: string; price: number; rating: number }[];
  if (!rows.length) return { lines: [muted("no products.")] };
  return { lines: [info(`${asc ? "lowest" : "highest"} ${col}:`), ...rows.map((r) => muted(`  ${r.id}  ${r.brand} · ${r.title} — ${r.price} смн ★${Number(r.rating).toFixed(1)}`))] };
}

async function cmdProfilesList(sb: SB, t: string[], filter: "is_banned" | "is_boosted" | "is_verified" | "admin" | "courier" | "seller"): Promise<RunResult> {
  const n = Math.min(50, Math.max(1, Number(t[1]) || 20));
  let q = sb.from("profiles").select("id,username,role");
  if (filter === "admin" || filter === "courier" || filter === "seller") q = q.eq("role", filter);
  else q = q.eq(filter, true);
  const { data } = await q.limit(n);
  const rows = (data ?? []) as { id: string; username: string; role: string }[];
  if (!rows.length) return { lines: [muted("none found.")] };
  return { lines: [info(`${rows.length} account(s):`), ...rows.map((r) => muted(`  @${r.username.padEnd(20)} ${r.role.padEnd(9)} ${r.id}`))] };
}

async function cmdSanctionList(sb: SB, flag: "featured" | "hidden"): Promise<RunResult> {
  const { data } = await sb.from("products").select("id,title,brand,sanctions").limit(20000);
  const now = Date.now();
  const active = (v: string | undefined) => !!v && (v === "perm" || new Date(v).getTime() > now);
  const rows = ((data ?? []) as { id: string; title: string; brand: string; sanctions: Record<string, string> | null }[])
    .filter((p) => active(p.sanctions?.[flag])).slice(0, 30);
  if (!rows.length) return { lines: [muted(`no ${flag} products.`)] };
  return { lines: [info(`${rows.length} ${flag} product(s):`), ...rows.map((r) => muted(`  ${r.id}  ${r.brand} · ${r.title}`))] };
}

async function cmdOpenReports(sb: SB, t: string[]): Promise<RunResult> {
  const n = Math.min(40, Math.max(1, Number(t[1]) || 15));
  const { data } = await sb.from("reports").select("reported_id,category,description,created_at").eq("status", "open").order("created_at", { ascending: false }).limit(n);
  const rows = (data ?? []) as { reported_id: string; category: string; description: string }[];
  if (!rows.length) return { lines: [muted("no open reports 🎉")] };
  const names = await usernameMap(sb, rows.map((r) => r.reported_id));
  return { lines: [info(`${rows.length} open report(s):`), ...rows.map((r) => muted(`  @${names[r.reported_id] ?? "?"} · ${r.category} — ${(r.description || "—").slice(0, 50)}`))] };
}

async function cmdPaidOrders(sb: SB, t: string[]): Promise<RunResult> {
  const n = Math.min(40, Math.max(1, Number(t[1]) || 15));
  const { data } = await sb.from("orders").select("id,status,total,paid_at").not("paid_at", "is", null).order("paid_at", { ascending: false }).limit(n);
  const rows = (data ?? []) as { id: string; status: string; total: number; paid_at: string }[];
  if (!rows.length) return { lines: [muted("no paid orders.")] };
  return { lines: [info(`${rows.length} paid order(s):`), ...rows.map((r) => muted(`  ${r.id}  ${r.status.padEnd(16)} ${r.total} смн · ${new Date(r.paid_at).toLocaleDateString("en-GB")}`))] };
}
