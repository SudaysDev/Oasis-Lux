import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { HUB, REGION_META, haversineKm, type LatLng } from "@/lib/data/orders";
import { TJ } from "@/lib/config";

/* ===================================================================== */
/* LOGISTICS — live fleet / deliveries on the Tajikistan grid             */
/* ===================================================================== */

const IN_FLIGHT = ["placed", "processing", "out_for_delivery", "arrived"] as const;
type FlightStatus = (typeof IN_FLIGHT)[number];

/** Progress of a delivery along its route (0 hub → 1 doorstep). */
const STATUS_BASE: Record<FlightStatus, number> = {
  placed: 0.04,
  processing: 0.16,
  out_for_delivery: 0.55,
  arrived: 0.97,
};

/** Project a lng/lat onto the map frame → normalised 0..1 (x right, y down). */
function project(p: LatLng): { x: number; y: number } {
  const [[minLng, minLat], [maxLng, maxLat]] = TJ.bounds;
  const x = (p.lng - minLng) / (maxLng - minLng);
  const y = 1 - (p.lat - minLat) / (maxLat - minLat);
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
}

function asLatLng(j: Record<string, unknown> | null | undefined): LatLng | null {
  if (!j) return null;
  const lat = (j.lat ?? j.latitude) as number | undefined;
  const lng = (j.lng ?? j.lon ?? j.longitude) as number | undefined;
  return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
}

export type FleetDelivery = {
  id: string;
  buyer: string;
  buyerId: string;
  region: string;
  status: FlightStatus;
  courierName: string;
  courierPhone: string;
  courierVehicle: string;
  distanceKm: number;
  etaMin: number;
  /** minutes left until the (estimated) doorstep, can be negative = overdue */
  etaLeftMin: number;
  total: number;
  paid: boolean;
  createdAt: string;
  /** normalised route geometry for the map */
  ox: number; oy: number; dx: number; dy: number;
  progress: number;
};

export type CourierLoad = {
  name: string;
  phone: string;
  vehicle: string;
  active: number;
  distanceKm: number;
  regions: string[];
  worstEta: number;
};

export type MapNode = { name: string; x: number; y: number };

export type AdminLogistics = {
  summary: {
    inFlight: number;
    outForDelivery: number;
    arrived: number;
    processing: number;
    placed: number;
    couriers: number;
    avgEta: number;
    onRoadKm: number;
    overdue: number;
    fulfilledToday: number;
    inFlightValue: number;
  };
  deliveries: FleetDelivery[];
  couriers: CourierLoad[];
  regions: { region: string; count: number; km: number }[];
  hub: MapNode;
  cities: MapNode[];
};

type OrderRow = {
  id: string; user_id: string; status: string; region: string; total: number;
  courier_name: string; courier_phone: string; courier_vehicle: string;
  distance_km: number | string; eta_min: number; origin: Record<string, unknown> | null;
  destination: Record<string, unknown> | null; paid_at: string | null;
  created_at: string;
};

export async function getAdminLogistics(): Promise<AdminLogistics> {
  const sb = createAdminClient();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [flightRes, doneRes] = await Promise.all([
    sb.from("orders")
      .select("id,user_id,status,region,total,courier_name,courier_phone,courier_vehicle,distance_km,eta_min,origin,destination,paid_at,created_at")
      .in("status", [...IN_FLIGHT])
      .order("created_at", { ascending: false })
      .limit(2000),
    sb.from("orders").select("id").eq("status", "fulfilled").gte("created_at", dayAgo).limit(5000),
  ]);
  const rows = (flightRes.data ?? []) as OrderRow[];

  const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const nameMap = new Map<string, string>();
  if (ids.length) {
    const { data } = await sb.from("profiles").select("id,username").in("id", ids);
    for (const u of (data ?? []) as { id: string; username: string }[]) nameMap.set(u.id, u.username);
  }

  const now = Date.now();
  const deliveries: FleetDelivery[] = rows.map((r) => {
    const status = r.status as FlightStatus;
    const origin = asLatLng(r.origin) ?? HUB;
    const destination = asLatLng(r.destination) ?? REGION_META[r.region]?.dest ?? HUB;
    const o = project(origin);
    const d = project(destination);
    const distanceKm = Number(r.distance_km) || Math.round(haversineKm(origin, destination) * 10) / 10;
    const eta = Number(r.eta_min) || 0;
    // time-aware progress: drift along the leg between status anchors
    const started = new Date(r.paid_at ?? r.created_at).getTime();
    const elapsedMin = (now - started) / 60000;
    const timeFrac = eta > 0 ? Math.min(1, elapsedMin / eta) : 0;
    const base = STATUS_BASE[status] ?? 0.1;
    const progress = Math.max(base, Math.min(0.99, status === "arrived" ? 0.97 : Math.max(base, timeFrac)));
    const etaLeftMin = Math.round(eta - elapsedMin);
    return {
      id: r.id,
      buyer: nameMap.get(r.user_id) ?? "user",
      buyerId: r.user_id,
      region: r.region,
      status,
      courierName: r.courier_name || "Unassigned",
      courierPhone: r.courier_phone || "",
      courierVehicle: r.courier_vehicle || "—",
      distanceKm,
      etaMin: eta,
      etaLeftMin,
      total: Number(r.total) || 0,
      paid: !!r.paid_at,
      createdAt: r.created_at,
      ox: o.x, oy: o.y, dx: d.x, dy: d.y,
      progress,
    };
  });

  // couriers roster
  const cMap = new Map<string, CourierLoad>();
  for (const d of deliveries) {
    if (d.status === "arrived") continue; // arrived = effectively delivered
    const key = d.courierName;
    const c = cMap.get(key) ?? { name: key, phone: d.courierPhone, vehicle: d.courierVehicle, active: 0, distanceKm: 0, regions: [], worstEta: 0 };
    c.active += 1;
    c.distanceKm += d.distanceKm;
    if (!c.regions.includes(d.region)) c.regions.push(d.region);
    c.worstEta = Math.max(c.worstEta, d.etaLeftMin);
    if (!c.phone && d.courierPhone) c.phone = d.courierPhone;
    cMap.set(key, c);
  }
  const couriers = [...cMap.values()].sort((a, b) => b.active - a.active);

  // region distribution
  const rMap = new Map<string, { count: number; km: number }>();
  for (const d of deliveries) {
    const r = rMap.get(d.region) ?? { count: 0, km: 0 };
    r.count += 1; r.km += d.distanceKm;
    rMap.set(d.region, r);
  }
  const regions = [...rMap.entries()]
    .map(([region, v]) => ({ region, count: v.count, km: Math.round(v.km) }))
    .sort((a, b) => b.count - a.count);

  const moving = deliveries.filter((d) => d.status !== "arrived");
  const avgEta = moving.length ? Math.round(moving.reduce((s, d) => s + Math.max(0, d.etaLeftMin), 0) / moving.length) : 0;
  const onRoadKm = Math.round(moving.reduce((s, d) => s + d.distanceKm, 0));
  const overdue = moving.filter((d) => d.etaLeftMin < 0).length;

  const hubP = project(HUB);
  const cities: MapNode[] = TJ.cities.map((c) => {
    const p = project({ lat: c.lat, lng: c.lng });
    return { name: c.name, x: p.x, y: p.y };
  });

  return {
    summary: {
      inFlight: deliveries.length,
      outForDelivery: deliveries.filter((d) => d.status === "out_for_delivery").length,
      arrived: deliveries.filter((d) => d.status === "arrived").length,
      processing: deliveries.filter((d) => d.status === "processing").length,
      placed: deliveries.filter((d) => d.status === "placed").length,
      couriers: couriers.length,
      avgEta,
      onRoadKm,
      overdue,
      fulfilledToday: (doneRes.data ?? []).length,
      inFlightValue: Math.round(deliveries.reduce((s, d) => s + d.total, 0)),
    },
    deliveries,
    couriers,
    regions,
    hub: { name: "Dushanbe Hub", x: hubP.x, y: hubP.y },
    cities,
  };
}
