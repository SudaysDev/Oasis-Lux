/**
 * Full Control — editable-field registry for the generic /edit · /add · /delete
 * commands. Pure data (no server imports) so the terminal client can offer
 * field autocomplete and the server can validate/coerce against the same list.
 */

export type Entity = "user" | "product" | "order";
export type FieldType =
  | "text" | "number" | "money" | "bool" | "date" | "datetime" | "enum" | "photo";

export type FieldSpec = {
  key: string;            // the real DB column
  aliases: string[];      // friendly names accepted on the command line
  type: FieldType;
  label: string;
  options?: readonly string[];
  min?: number;
  max?: number;
};

/* --------------------------------------------------------------------- */
export const USER_FIELDS: FieldSpec[] = [
  { key: "username", aliases: ["name", "nick", "nickname"], type: "text", label: "@username" },
  { key: "full_name", aliases: ["fullname", "real_name", "fio"], type: "text", label: "full name" },
  { key: "bio", aliases: ["about", "status"], type: "text", label: "bio" },
  { key: "avatar_url", aliases: ["avatar", "profile_avatar", "photo", "pfp"], type: "photo", label: "avatar (paste a photo)" },
  { key: "banner_url", aliases: ["banner", "profile_banner", "cover"], type: "photo", label: "banner (paste a photo)" },
  { key: "phone", aliases: ["tel", "number"], type: "text", label: "phone" },
  { key: "email", aliases: ["mail"], type: "text", label: "email" },
  { key: "role", aliases: [], type: "enum", label: "role", options: ["customer", "seller", "courier"] },
  { key: "plan", aliases: ["subscription", "sub"], type: "enum", label: "plan", options: ["free", "pro", "elite"] },
  { key: "loyalty_tier", aliases: ["tier"], type: "enum", label: "loyalty tier", options: ["Bronze", "Silver", "Gold", "Platinum"] },
  { key: "loyalty_points", aliases: ["points", "xp"], type: "number", label: "loyalty points", min: 0 },
  { key: "cashback_balance", aliases: ["cashback", "balance"], type: "money", label: "cashback (смн)", min: 0 },
  { key: "is_verified", aliases: ["verified", "verify"], type: "bool", label: "verified badge" },
  { key: "is_boosted", aliases: ["boost", "boosted", "promoted"], type: "bool", label: "seller promotion" },
  { key: "show_phone", aliases: ["phone_visible"], type: "bool", label: "show phone publicly" },
  { key: "locale", aliases: ["lang", "language"], type: "enum", label: "locale", options: ["en", "ru", "tg"] },
  { key: "theme", aliases: [], type: "enum", label: "theme", options: ["dark", "light"] },
  { key: "telegram_chat_id", aliases: ["telegram", "tg"], type: "text", label: "telegram chat id" },
  { key: "birthday", aliases: ["bday", "dob", "born"], type: "date", label: "birthday (date)" },
  { key: "created_at", aliases: ["registered", "joined", "signup", "reg_date"], type: "datetime", label: "registration date" },
  { key: "admin_note", aliases: ["note"], type: "text", label: "private admin note" },
];

export const PRODUCT_FIELDS: FieldSpec[] = [
  { key: "title", aliases: ["name"], type: "text", label: "title" },
  { key: "brand", aliases: [], type: "text", label: "brand" },
  { key: "description", aliases: ["desc", "about"], type: "text", label: "description" },
  { key: "price", aliases: [], type: "money", label: "price (смн)", min: 0 },
  { key: "stock", aliases: ["qty", "quantity"], type: "number", label: "stock", min: 0 },
  { key: "color", aliases: [], type: "text", label: "color" },
  { key: "size", aliases: [], type: "text", label: "size" },
  { key: "condition", aliases: ["cond"], type: "enum", label: "condition", options: ["new", "like_new", "used"] },
  { key: "type", aliases: ["kind"], type: "enum", label: "type", options: ["perfume", "watch", "glasses"] },
  { key: "category", aliases: ["cat"], type: "text", label: "category slug" },
  { key: "hue", aliases: ["color_hue"], type: "number", label: "hue (0-360)", min: 0, max: 360 },
  { key: "rating", aliases: ["stars"], type: "number", label: "rating (0-5)", min: 0, max: 5 },
  { key: "is_active", aliases: ["active", "live"], type: "bool", label: "active / listed" },
  { key: "created_at", aliases: ["listed", "added"], type: "datetime", label: "listed date" },
  { key: "image", aliases: ["photo", "img", "picture"], type: "photo", label: "add image (paste a photo)" },
];

export const ORDER_FIELDS: FieldSpec[] = [
  { key: "status", aliases: ["state"], type: "enum", label: "status", options: ["placed", "processing", "out_for_delivery", "arrived", "fulfilled", "cancelled"] },
  { key: "total", aliases: [], type: "money", label: "total (смн)", min: 0 },
  { key: "subtotal", aliases: [], type: "money", label: "subtotal", min: 0 },
  { key: "discount", aliases: [], type: "money", label: "discount", min: 0 },
  { key: "delivery_fee", aliases: ["delivery", "fee"], type: "money", label: "delivery fee", min: 0 },
  { key: "promo_code", aliases: ["promo", "code"], type: "text", label: "promo code" },
  { key: "region", aliases: ["city"], type: "text", label: "region" },
  { key: "address", aliases: ["addr"], type: "text", label: "address" },
  { key: "full_name", aliases: ["recipient", "name"], type: "text", label: "recipient name" },
  { key: "phone", aliases: ["tel"], type: "text", label: "recipient phone" },
  { key: "card_last4", aliases: ["card"], type: "text", label: "card ••last4" },
  { key: "card_brand", aliases: [], type: "text", label: "card brand" },
  { key: "courier_name", aliases: ["courier"], type: "text", label: "courier name" },
  { key: "courier_phone", aliases: [], type: "text", label: "courier phone" },
  { key: "courier_vehicle", aliases: ["vehicle", "car"], type: "text", label: "courier vehicle" },
  { key: "distance_km", aliases: ["distance", "km"], type: "number", label: "distance (km)", min: 0 },
  { key: "eta_min", aliases: ["eta"], type: "number", label: "ETA (min)", min: 0 },
  { key: "stock_settled", aliases: ["settled"], type: "bool", label: "stock settled" },
];

export const FIELDS_BY_ENTITY: Record<Entity, FieldSpec[]> = {
  user: USER_FIELDS, product: PRODUCT_FIELDS, order: ORDER_FIELDS,
};

export function fieldsFor(entity: Entity): FieldSpec[] {
  return FIELDS_BY_ENTITY[entity];
}

/** Resolve a field token (column or alias, case-insensitive) for an entity. */
export function findField(entity: Entity, token: string): FieldSpec | undefined {
  const t = token.toLowerCase().replace(/^(profile_|product_|order_)/, "");
  return fieldsFor(entity).find((f) => f.key.toLowerCase() === token.toLowerCase() || f.key.toLowerCase() === t || f.aliases.some((a) => a.toLowerCase() === token.toLowerCase() || a.toLowerCase() === t));
}

/** Every field token (keys + aliases) across all entities — for client autocomplete. */
export function allFieldTokens(): { token: string; entity: Entity; label: string; type: FieldType }[] {
  const out: { token: string; entity: Entity; label: string; type: FieldType }[] = [];
  for (const entity of ["user", "product", "order"] as Entity[])
    for (const f of fieldsFor(entity)) out.push({ token: f.key, entity, label: f.label, type: f.type });
  return out;
}
