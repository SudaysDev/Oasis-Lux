// Orders data layer (browser reads/cancel) + pure helpers shared with the API route.
import type { SupabaseClient } from "@supabase/supabase-js";

export type OrderStatus =
  | "placed" | "processing" | "out_for_delivery" | "arrived" | "fulfilled" | "cancelled";

export const ORDER_FLOW: OrderStatus[] = ["placed", "processing", "out_for_delivery", "arrived", "fulfilled"];
export const CANCEL_WINDOW_MIN = 15;

export interface LatLng { lat: number; lng: number }

export interface OrderLine {
  productId: string;
  title: string;
  image: string;
  variantLabel?: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderRecord {
  id: string;
  userId: string;
  sellerId: string | null;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  currency: string;
  promoCode?: string;
  region: string;
  address: string;
  fullName: string;
  phone: string;
  cardLast4?: string;
  cardBrand?: string;
  courierName: string;
  courierPhone: string;
  courierVehicle: string;
  distanceKm: number;
  etaMin: number;
  origin: LatLng;
  destination: LatLng;
  paidAt?: string;
  cancelDeadline?: string;
  cancelledAt?: string;
  stockSettled: boolean;
  createdAt: string;
  items: OrderLine[];
}

// ---------------------------------------------------------------------------
// Tajikistan delivery regions (hub = Dushanbe)
// ---------------------------------------------------------------------------
export const HUB: LatLng = { lat: 38.5598, lng: 68.787 }; // Dushanbe warehouse

// Real city coordinates; the courier route + distances are computed from these.
export const REGION_META: Record<string, { fee: number; dest: LatLng }> = {
  Dushanbe: { fee: 15, dest: { lat: 38.535, lng: 68.802 } }, // a delivery point in-city
  Bokhtar: { fee: 30, dest: { lat: 37.8364, lng: 68.78 } },
  Kulob: { fee: 35, dest: { lat: 37.9111, lng: 69.779 } },
  Khujand: { fee: 40, dest: { lat: 40.2833, lng: 69.622 } },
  Khorog: { fee: 60, dest: { lat: 37.4897, lng: 71.556 } },
};
export const REGIONS = Object.keys(REGION_META);

export function regionFee(region: string): number {
  return REGION_META[region]?.fee ?? 25;
}

/** Great-circle distance in km between two coordinates (haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Linear interpolation between two coordinates (0..1). */
export function lerpLatLng(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/** REAL distance + ETA estimate from the Dushanbe hub to a region (from coordinates). */
export function regionLogistics(region: string): { distanceKm: number; etaMin: number; dest: LatLng } {
  const m = REGION_META[region] ?? REGION_META.Dushanbe;
  const distanceKm = Math.max(2, Math.round(haversineKm(HUB, m.dest) * 10) / 10);
  const speedKmh = region === "Dushanbe" ? 22 : 52; // city vs intercity avg
  const etaMin = Math.max(15, Math.round((distanceKm / speedKmh) * 60));
  return { distanceKm, etaMin, dest: m.dest };
}

const COURIERS: { name: string; vehicle: string }[] = [
  { name: "Daler Qodirov", vehicle: "Chevrolet Cobalt · 1234 AT" },
  { name: "Firuz Saidov", vehicle: "Honda PCX · 7788 BT" },
  { name: "Anvar Rahimov", vehicle: "Opel Astra · 4521 AT" },
  { name: "Jamshed Karimov", vehicle: "Yamaha NMAX · 9090 CT" },
  { name: "Sherali Nazarov", vehicle: "Hyundai Accent · 3030 AT" },
];

export function makeCourier(): { name: string; phone: string; vehicle: string } {
  const c = COURIERS[Math.floor(Math.random() * COURIERS.length)];
  const tail = String(Math.floor(100000 + Math.random() * 900000));
  return { name: c.name, phone: `+992 90 ${tail.slice(0, 3)} ${tail.slice(3)}`, vehicle: c.vehicle };
}

export function cancelDeadlineMs(order: Pick<OrderRecord, "createdAt" | "cancelDeadline">): number {
  if (order.cancelDeadline) return new Date(order.cancelDeadline).getTime();
  return new Date(order.createdAt).getTime() + CANCEL_WINDOW_MIN * 60_000;
}

export function canCancel(order: OrderRecord): boolean {
  return order.status !== "cancelled" && order.status !== "fulfilled" && Date.now() < cancelDeadlineMs(order);
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------
interface OrderRow {
  id: string; user_id: string; seller_id: string | null; status: OrderStatus;
  subtotal: number | string; discount: number | string; delivery_fee: number | string; total: number | string;
  currency: string; promo_code: string | null; region: string; address: string;
  full_name: string; phone: string; card_last4: string | null; card_brand: string | null;
  courier_name: string; courier_phone: string; courier_vehicle: string;
  distance_km: number | string; eta_min: number; origin: LatLng; destination: LatLng;
  paid_at: string | null; cancel_deadline: string | null; cancelled_at: string | null;
  stock_settled: boolean; created_at: string;
  items?: OrderItemRow[] | null;
}
interface OrderItemRow {
  product_id: string; title: string; image: string; variant_label: string | null;
  quantity: number; unit_price: number | string;
}

function mapItem(r: OrderItemRow): OrderLine {
  return {
    productId: r.product_id,
    title: r.title,
    image: r.image,
    variantLabel: r.variant_label ?? undefined,
    quantity: r.quantity,
    unitPrice: Number(r.unit_price),
  };
}

export function mapOrder(r: OrderRow): OrderRecord {
  return {
    id: r.id,
    userId: r.user_id,
    sellerId: r.seller_id,
    status: r.status,
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    deliveryFee: Number(r.delivery_fee),
    total: Number(r.total),
    currency: r.currency,
    promoCode: r.promo_code ?? undefined,
    region: r.region,
    address: r.address,
    fullName: r.full_name,
    phone: r.phone,
    cardLast4: r.card_last4 ?? undefined,
    cardBrand: r.card_brand ?? undefined,
    courierName: r.courier_name,
    courierPhone: r.courier_phone,
    courierVehicle: r.courier_vehicle,
    distanceKm: Number(r.distance_km),
    etaMin: r.eta_min,
    origin: (r.origin ?? HUB) as LatLng,
    destination: (r.destination ?? HUB) as LatLng,
    paidAt: r.paid_at ?? undefined,
    cancelDeadline: r.cancel_deadline ?? undefined,
    cancelledAt: r.cancelled_at ?? undefined,
    stockSettled: r.stock_settled,
    createdAt: r.created_at,
    items: (r.items ?? []).map(mapItem),
  };
}

const ORDER_SELECT =
  "*, items:order_items(product_id,title,image,variant_label,quantity,unit_price)";

export async function fetchOrder(sb: SupabaseClient, id: string): Promise<OrderRecord | null> {
  const { data } = await sb.from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
  return data ? mapOrder(data as OrderRow) : null;
}

export async function fetchMyOrders(sb: SupabaseClient, userId: string): Promise<OrderRecord[]> {
  const { data } = await sb
    .from("orders")
    .select(ORDER_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as OrderRow[]).map(mapOrder);
}

/** Orders where the signed-in user is the SELLER (their sales). */
export async function fetchSellerOrders(sb: SupabaseClient, sellerId: string): Promise<OrderRecord[]> {
  const { data } = await sb
    .from("orders")
    .select(ORDER_SELECT)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as OrderRow[]).map(mapOrder);
}

/** Cancel within the window (RLS scopes the update to the owner). */
export async function cancelOrder(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb
    .from("orders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
