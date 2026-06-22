"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  AlertTriangle, ArrowLeft, Ban, BadgeCheck, Clock, CreditCard, Crown, Database, Fingerprint, Flag, Heart, History, Loader2,
  MapPin, MessageSquare, MessagesSquare, Package, Pencil, Phone, Save, ShieldAlert, ShieldBan, ShieldCheck,
  ShoppingBag, ShoppingCart, Slash, Star, Store, UserCog, Wallet,
} from "lucide-react";
import { AreaChart, CountUp, GREEN, group, HBars, LiveStatus, RadialGauge, StatusBars } from "./charts";
import { ModerationPanel } from "./ModerationPanel";
import { Select } from "./Select";
import {
  adminBanUser, adminDeleteUser, adminSetRestriction, adminSetUserNote, adminUnbanUser, adminUpdateUserProfile,
  type ActionResult, type RestrictKind,
} from "@/app/(admin)/admin/users/[id]/actions";
import type { AdminUserDossier } from "@/lib/data/admin-users";

const ROLE_COLOR: Record<string, string> = { customer: "#22ff88", seller: "#38bdf8", courier: "#fbbf24", admin: "#a78bfa" };
const STATUS_COLOR: Record<string, string> = { placed: "#22ff88", processing: "#38bdf8", out_for_delivery: "#a78bfa", arrived: "#fbbf24", fulfilled: "#22c55e", cancelled: "#ef4444" };
const REPORT_COLOR: Record<string, string> = { open: "#ef4444", reviewing: "#fbbf24", resolved: "#22c55e", dismissed: "#64748b" };
const TONE: Record<string, string> = { green: "#22ff88", cyan: "#38bdf8", amber: "#fbbf24", red: "#ef4444", violet: "#a78bfa" };

function ago(iso: string | null): string {
  if (!iso) return "never";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const daysOld = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
function unitMs(w: string): number | null {
  if (/^(mo|month|мес)/.test(w)) return 30 * DAY;
  if (/^(w|wk|week|нед)/.test(w)) return 7 * DAY;
  if (/^(d|day|дн|день|дня|дней|сут)/.test(w)) return DAY;
  if (/^(h|hr|hour|час|ч)/.test(w)) return HOUR;
  if (/^(m|min|мин|м)/.test(w)) return MIN;
  return null;
}
/** Parse a free-text ban term. `{}` = permanent · `{ms}` = timed · null = unparseable.
 *  Accepts durations ("4 days", "2h 30m", "4 дня", bare "4"=days) OR an absolute date. */
function parseBanTerm(raw: string): { ms?: number } | null {
  const s = raw.trim();
  if (!s) return {};
  if (/^(perm|permanent|forever|навсегда|перм|нав)/i.test(s)) return {};
  if (/^\d+(?:[.,]\d+)?$/.test(s)) return { ms: parseFloat(s.replace(",", ".")) * DAY }; // bare number → days
  let ms = 0, matched = false;
  const re = /(\d+(?:[.,]\d+)?)\s*([a-zа-яё]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const mult = unitMs(m[2].toLowerCase());
    if (mult) { ms += parseFloat(m[1].replace(",", ".")) * mult; matched = true; }
  }
  if (matched && ms > 0) return { ms };
  const d = new Date(s); // absolute date/datetime fallback
  if (!isNaN(d.getTime())) { const diff = d.getTime() - Date.now(); if (diff > 0) return { ms: diff }; }
  return null;
}
function humanizeMs(ms: number): string {
  if (ms >= 30 * DAY) return `${Math.round(ms / DAY)}d`;
  if (ms >= DAY) return `${+(ms / DAY).toFixed(ms % DAY ? 1 : 0)}d`;
  if (ms >= HOUR) return `${+(ms / HOUR).toFixed(ms % HOUR ? 1 : 0)}h`;
  return `${Math.round(ms / MIN)}m`;
}
function banPreview(term: string): { ok: boolean; text: string } | null {
  if (!term.trim()) return null;
  const pv = parseBanTerm(term);
  if (!pv) return { ok: false, text: "can't read that term" };
  if (pv.ms === undefined) return { ok: true, text: "permanent ban" };
  return { ok: true, text: `lifts ${fmtDateTime(new Date(Date.now() + pv.ms).toISOString())} (${humanizeMs(pv.ms)})` };
}
/** A restriction value ('perm' | ISO until) is active when permanent or not yet expired. */
const rActive = (v?: string) => !!v && (v === "perm" || new Date(v) > new Date());
const rUntilLabel = (v?: string) => (!rActive(v) ? "" : v === "perm" ? "perm" : `until ${fmtDateTime(v!)}`);
const RESTRICTIONS: { kind: RestrictKind; label: string; short: string; desc: string; Icon: typeof Ban }[] = [
  { kind: "chat", label: "Mute chat", short: "no chat", desc: "Can't send messages", Icon: MessagesSquare },
  { kind: "sell", label: "Block selling", short: "no sell", desc: "Can't publish listings", Icon: Store },
  { kind: "buy", label: "Block buying", short: "no buy", desc: "Can't place orders", Icon: ShoppingBag },
  { kind: "cart", label: "Block cart", short: "no cart", desc: "Can't add to cart", Icon: ShoppingCart },
  { kind: "review", label: "Mute reviews", short: "no review", desc: "Can't post reviews", Icon: Star },
  { kind: "report", label: "Block reports", short: "no report", desc: "Can't file reports", Icon: Flag },
  { kind: "favorite", label: "Block favorites", short: "no fav", desc: "Can't favorite", Icon: Heart },
];

export function UserDossierClient({ d }: { d: AdminUserDossier }) {
  const router = useRouter();
  const p = d.profile;
  const tempActive = !!p.banUntil && new Date(p.banUntil) > new Date();
  const banned = p.isBanned || tempActive;
  const accent = ROLE_COLOR[p.role] ?? GREEN;
  const socials = Object.entries(p.socials).filter(([, v]) => v);
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  // editable profile state
  const [fullName, setFullName] = useState(p.fullName);
  const [username, setUsername] = useState(p.username);
  const [bio, setBio] = useState(p.bio);
  const [role, setRole] = useState(p.role);
  const [plan, setPlan] = useState(p.plan);
  const [tier, setTier] = useState(p.loyaltyTier);
  const [points, setPoints] = useState(String(p.loyaltyPoints));
  const [cashback, setCashback] = useState(String(p.cashbackBalance));
  const [verified, setVerified] = useState(p.isVerified);
  const [note, setNote] = useState(p.adminNote);
  const [banReason, setBanReason] = useState("");
  const [banTerm, setBanTerm] = useState("");
  const [restrTerm, setRestrTerm] = useState("");

  const run = (fn: () => Promise<ActionResult>, ok = "Done") => {
    setBusy(true);
    startTransition(async () => {
      const r = await fn();
      setBusy(false);
      if (!r.ok) toast.error(r.error);
      else { toast.success(ok); router.refresh(); }
    });
  };

  const toggleRestriction = (kind: RestrictKind) => {
    if (rActive(p.restrictions[kind])) { run(() => adminSetRestriction(p.id, kind, false), "Lifted"); return; }
    const pv = parseBanTerm(restrTerm);
    if (!pv) { toast.error("Couldn't read the duration. Try \"2h\", \"7 days\", a date, or leave empty for permanent."); return; }
    run(() => adminSetRestriction(p.id, kind, true, pv.ms), pv.ms === undefined ? "Restricted" : `Restricted · ${humanizeMs(pv.ms)}`);
  };

  const applyBan = () => {
    const parsed = parseBanTerm(banTerm);
    if (!parsed) { toast.error("Couldn't read that term. Try \"4 days\", \"2h 30m\", a date, or leave empty for permanent."); return; }
    if (parsed.ms === undefined) { run(() => adminBanUser(p.id, banReason), "Permanently banned"); return; }
    run(() => adminBanUser(p.id, banReason, parsed.ms), `Banned · ${humanizeMs(parsed.ms)}`);
  };

  const saveProfile = () => run(() => adminUpdateUserProfile(p.id, {
    full_name: fullName.trim(), username: username.trim(), bio, role, plan, loyalty_tier: tier,
    loyalty_points: Number(points) || 0, cashback_balance: Number(cashback) || 0, is_verified: verified,
  }), "Profile saved");

  const protectedAdmin = p.isAdmin;

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/admin/users" className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to users
        </Link>
        <LiveStatus />
      </div>

      {/* suspended banner */}
      {banned && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3">
          <ShieldBan className="h-5 w-5 text-red-400" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-red-300">{tempActive ? "Temporarily suspended" : "Account suspended"} {p.bannedAt ? `· ${ago(p.bannedAt)}` : ""}</p>
            {tempActive && <p className="text-sm text-white/70">Auto-lifts {fmtDateTime(p.banUntil!)} · {ago(p.banUntil!).replace(" ago", "")} left</p>}
            {p.banReason && <p className="text-sm text-white/70">Reason: {p.banReason}</p>}
          </div>
          <button onClick={() => run(() => adminUnbanUser(p.id), "Reinstated")} disabled={busy} className="rounded-xl border border-[#22ff88]/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#22ff88] transition hover:bg-[#22ff88]/10 disabled:opacity-50">Lift ban</button>
        </div>
      )}

      {/* identity banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10">
        <div className="h-32 w-full sm:h-40" style={p.bannerUrl ? { backgroundImage: `url(${p.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: `linear-gradient(120deg,${accent}33,#0a0e16)` }} />
        <div className="relative -mt-12 flex flex-wrap items-end gap-4 px-5 pb-5 sm:px-7">
          <span className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-[#070a10] text-3xl font-black" style={{ background: `${accent}22`, color: accent }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" /> : p.username.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-black text-white sm:text-3xl">
              {p.fullName || `@${p.username}`}
              {p.isVerified && <BadgeCheck className="h-5 w-5 text-[#34d399]" />}
              {p.isAdmin && <Crown className="h-5 w-5 text-[#a78bfa]" />}
            </h1>
            <p className="mt-0.5 font-mono text-sm text-white/55">@{p.username}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge color={accent}>{p.role}</Badge>
              <Badge color="#38bdf8">{p.plan}</Badge>
              <Badge color="#fbbf24">{p.loyaltyTier}</Badge>
              {p.isBanned && <Badge color="#ef4444">banned</Badge>}
              {tempActive && <Badge color="#ef4444">temp-ban</Badge>}
              {RESTRICTIONS.filter((r) => rActive(p.restrictions[r.kind])).map((r) => (
                <Badge key={r.kind} color="#fb7185">{r.short}{p.restrictions[r.kind] !== "perm" ? " ⏱" : ""}</Badge>
              ))}
              <span className="font-mono text-[11px] text-white/40">Joined {fmtDate(p.createdAt)} · last seen {ago(d.auth.lastSignIn)}</span>
            </div>
          </div>
          <a href="#control-room" className="mb-1 flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white/80 transition hover:bg-white/5">
            <UserCog className="h-4 w-4" /> Control room
          </a>
        </div>
      </div>

      {/* ============ IDENTITY & ACCESS ============ */}
      <SectionTitle>Identity &amp; access</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="User ID" value={p.id} mono />
        <Field label="Email" value={p.email ?? d.auth.authEmail ?? "—"} />
        <Field label="Phone" value={p.phone ?? d.auth.authPhone ?? "—"} />
        <Field label="Phone shown publicly" value={p.showPhone ? "Yes" : "No (private)"} />
        <Field label="Birthday" value={p.birthday ? fmtDate(p.birthday) : "—"} />
        <Field label="Telegram chat ID" value={p.telegramChatId ?? "—"} mono />
        <Field label="Locale / theme" value={`${p.locale} · ${p.theme}`} />
        <Field label="Loyalty points" value={String(p.loyaltyPoints)} />
        <Field label="Cashback balance" value={`${group(p.cashbackBalance)} смн`} />
        <Field label="Auth providers" value={d.auth.providers.length ? d.auth.providers.join(", ") : "—"} />
        <Field label="Email confirmed" value={d.auth.emailConfirmed ? "Yes" : "No"} />
        <Field label="Phone confirmed" value={d.auth.phoneConfirmed ? "Yes" : "No"} />
        <Field label="Auth created" value={fmtDate(d.auth.authCreatedAt)} />
        <Field label="Last sign-in" value={d.auth.lastSignIn ? `${fmtDate(d.auth.lastSignIn)} · ${ago(d.auth.lastSignIn)}` : "never"} />
        <Field label="Metadata role" value={d.auth.metaRole ?? "—"} />
        <Field label="Account age" value={`${daysOld(p.createdAt)} days`} />
      </div>

      {socials.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {socials.map(([k, v]) => (
            <span key={k} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/80">
              <span className="font-mono uppercase text-white/40">{k}</span> {v}
            </span>
          ))}
        </div>
      )}
      {p.links.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {p.links.map((l, i) => (
            <a key={i} href={l.url} target="_blank" rel="noreferrer" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-[#38bdf8] transition hover:bg-white/5">
              {l.label || l.url}
            </a>
          ))}
        </div>
      )}
      {p.bio && <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/70">{p.bio}</p>}

      {/* username history */}
      <div className="mt-3">
        <Card glow="rgba(56,189,248,0.1)">
          <Heading kicker={`${d.usernameHistory.length} change${d.usernameHistory.length === 1 ? "" : "s"}`} title="Username history" Icon={History} />
          <div className="relative ml-1 space-y-3 border-l border-white/10 pl-5">
            {d.usernameHistory.map((h, i) => (
              <div key={i} className="relative">
                <span className="absolute -left-[23px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#070a10]" style={{ background: i === 0 ? GREEN : "#38bdf8" }} />
                <p className="text-sm text-white">
                  <span className="font-semibold text-white">@{h.current}</span>
                  {h.old && <span className="text-white/45"> — was <span className="text-white/70">@{h.old}</span></span>}
                  {i === 0 && <span className="ml-2 rounded-full bg-[#22ff88]/15 px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#22ff88]">current</span>}
                </p>
                <p className="font-mono text-[10px] text-white/35">{fmtDateTime(h.at)} · {ago(h.at)}</p>
              </div>
            ))}
            {/* original handle at signup */}
            <div className="relative">
              <span className="absolute -left-[23px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#070a10] bg-white/40" />
              <p className="text-sm text-white/80">
                Joined as <span className="font-semibold text-white">@{d.usernameHistory.length ? (d.usernameHistory[d.usernameHistory.length - 1].old ?? p.username) : p.username}</span>
              </p>
              <p className="font-mono text-[10px] text-white/35">{fmtDateTime(p.createdAt)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ============ PERSONAL DATA (harvested from real orders) ============ */}
      <SectionTitle>Personal data · order intel</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card glow="rgba(34,255,136,0.1)">
          <Heading kicker="Where they ship" title="Delivery addresses" Icon={MapPin} />
          <TallyList items={d.personal.addresses} empty="No addresses on file." />
        </Card>
        <Card glow="rgba(56,189,248,0.1)">
          <Heading kicker="Reachable at" title="Phone numbers used" Icon={Phone} />
          <TallyList items={d.personal.phones} empty="No phone numbers used." />
        </Card>
        <Card glow="rgba(167,139,250,0.1)">
          <Heading kicker="Goes by" title="Names on orders" Icon={Fingerprint} />
          <TallyList items={d.personal.names} empty="No names on file." />
        </Card>
        <Card glow="rgba(251,191,36,0.1)">
          <Heading kicker="Pays with" title="Cards used" Icon={CreditCard} />
          <TallyList items={d.personal.cards} empty="No card payments recorded." />
        </Card>
      </div>

      {/* ============ LIVE INTENT (cart + favorites itemized) ============ */}
      <SectionTitle>Live intent</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card glow="rgba(251,191,36,0.1)">
          <Heading kicker={`${d.cart.length} item${d.cart.length === 1 ? "" : "s"}`} title="In cart right now" Icon={ShoppingCart} />
          <div className="no-scrollbar max-h-[260px] space-y-2 overflow-y-auto">
            {d.cart.length === 0 && <Empty text="Cart is empty." />}
            {d.cart.map((c) => (
              <Link key={c.id} href={`/admin/products/${c.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 transition hover:border-white/20">
                <span className="min-w-0 truncate text-sm text-white">{c.title}</span>
                <span className="shrink-0 font-mono text-xs text-white/55">×{c.qty}</span>
              </Link>
            ))}
          </div>
        </Card>
        <Card glow="rgba(251,113,133,0.1)">
          <Heading kicker={`${d.favorites.length} saved`} title="Favorited" Icon={Heart} />
          <div className="no-scrollbar max-h-[260px] space-y-2 overflow-y-auto">
            {d.favorites.length === 0 && <Empty text="No favorites." />}
            {d.favorites.map((f) => (
              <Link key={f.id} href={`/admin/products/${f.id}`} className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 transition hover:border-white/20">
                <Heart className="h-3.5 w-3.5 shrink-0 text-[#fb7185]" />
                <span className="min-w-0 truncate text-sm text-white">{f.title}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* ============ AS BUYER ============ */}
      <SectionTitle>As buyer</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total spent" value={d.buyer.spent} unit="смн" Icon={Wallet} />
        <Stat label="Orders" value={d.buyer.orders} accent="#38bdf8" Icon={ShoppingBag} />
        <Stat label="Avg order" value={d.buyer.avgOrder} unit="смн" accent="#a78bfa" />
        <Stat label="Cancelled" value={d.buyer.cancelled} accent="#ef4444" />
        <Stat label="Cancel rate" value={d.buyer.cancelRate} unit="%" accent={d.buyer.cancelRate >= 40 ? "#ef4444" : "#fbbf24"} />
        <Stat label="Repeat rate" value={d.buyer.repeatRate} unit="%" accent="#34d399" />
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" glow="rgba(34,255,136,0.12)">
          <Heading kicker="30-day" title="Spending" Icon={Wallet} />
          <AreaChart data={d.buyer.spend30d} unit=" смн" />
        </Card>
        <Card glow="rgba(56,189,248,0.12)">
          <Heading kicker="Pipeline" title="Order status" Icon={ShoppingBag} />
          <StatusBars data={d.buyer.byStatus} />
        </Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card glow="rgba(34,255,136,0.1)">
          <Heading kicker="Geography" title="Spend by region" Icon={MapPin} />
          <HBars data={d.buyer.regions} suffix=" смн" />
        </Card>
        <Card glow="rgba(34,197,94,0.1)">
          <Heading kicker="History" title="Recent orders" Icon={ShoppingBag} />
          <div className="no-scrollbar max-h-[300px] divide-y divide-white/5 overflow-y-auto">
            {d.buyer.recent.length === 0 && <Empty text="No orders." />}
            {d.buyer.recent.map((o) => (
              <Row key={o.id} left={`#${o.id.slice(0, 8)}`} sub={fmtDate(o.created_at)} right={`${group(o.total)} смн`} tag={o.status} tagColor={STATUS_COLOR[o.status]} />
            ))}
          </div>
        </Card>
      </div>

      {/* ============ AS SELLER ============ */}
      <SectionTitle>As seller</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Sales revenue" value={d.seller.revenue} unit="смн" />
        <Stat label="Sales" value={d.seller.sales} accent="#38bdf8" />
        <Stat label="Listings" value={d.seller.listings} accent="#a78bfa" />
        <Stat label="Units stock" value={d.seller.totalStock} accent="#fbbf24" />
        <Stat label="Listed value" value={d.seller.listedValue} unit="смн" accent="#34d399" />
        <Stat label="Avg rating" value={d.seller.avgRating} unit="★" accent="#fbbf24" />
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <Card glow="rgba(167,139,250,0.1)">
          <Heading kicker="Catalog" title="Listings" Icon={Package} />
          <div className="no-scrollbar max-h-[320px] space-y-2 overflow-y-auto">
            {d.seller.recentListings.length === 0 && <Empty text="No listings." />}
            {d.seller.recentListings.map((l) => (
              <Link key={l.id} href={`/admin/products/${l.id}`} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 transition hover:border-white/20">
                <span className="rounded-lg px-2 py-0.5 font-mono text-[9px] uppercase" style={{ background: `${GREEN}1f`, color: GREEN }}>{l.type}</span>
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{l.title}</p>
                <span className="font-mono text-[10px] text-white/45">stock {l.stock}</span>
                <span className="font-mono text-sm font-bold text-white">{group(l.price)} смн</span>
                {!l.is_active && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] uppercase text-red-400">off</span>}
              </Link>
            ))}
          </div>
        </Card>
        <Card glow="rgba(34,197,94,0.1)">
          <Heading kicker="Fulfilment" title="Recent sales" Icon={Store} />
          <div className="no-scrollbar max-h-[320px] divide-y divide-white/5 overflow-y-auto">
            {d.seller.recentSales.length === 0 && <Empty text="No sales." />}
            {d.seller.recentSales.map((o) => (
              <Row key={o.id} left={`#${o.id.slice(0, 8)}`} sub={fmtDate(o.created_at)} right={`${group(o.total)} смн`} tag={o.status} tagColor={STATUS_COLOR[o.status]} />
            ))}
          </div>
        </Card>
      </div>

      {/* ============ REPUTATION ============ */}
      <SectionTitle>Reputation</SectionTitle>
      <Card glow="rgba(251,191,36,0.1)">
        <Heading kicker="Reviews received" title={`${d.reviews.avg || "—"}★ · ${d.reviews.count} reviews`} Icon={Star} />
        <div className="no-scrollbar grid max-h-[340px] gap-2.5 overflow-y-auto sm:grid-cols-2">
          {d.reviews.items.length === 0 && <Empty text="No reviews yet." />}
          {d.reviews.items.map((r) => (
            <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">@{r.author}</span>
                <span className="font-mono text-sm" style={{ color: "#fbbf24" }}>{"★".repeat(r.rating)}</span>
              </div>
              {r.body && <p className="mt-1 text-sm text-white/65">{r.body}</p>}
              <p className="mt-1 font-mono text-[10px] text-white/35">{ago(r.created_at)}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ============ COMMUNICATIONS ============ */}
      <SectionTitle>Communications</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Conversations" value={d.chats.conversations} accent="#38bdf8" Icon={MessageSquare} />
        <Stat label="Messages sent" value={d.chats.messagesSent} accent="#22ff88" />
        <Stat label="Notifications" value={d.counts.notifications} accent="#a78bfa" />
        <Stat label="Favorites" value={d.counts.favorites} accent="#fb7185" Icon={Heart} />
        <Stat label="Cart items" value={d.counts.cart} accent="#fbbf24" Icon={ShoppingCart} />
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <Card glow="rgba(56,189,248,0.1)">
          <Heading kicker="Threads" title="Conversations" Icon={MessageSquare} />
          <div className="no-scrollbar max-h-[340px] space-y-2 overflow-y-auto">
            {d.chats.threads.length === 0 && <Empty text="No conversations." />}
            {d.chats.threads.map((t) => (
              <Link key={t.id} href={`/admin/messages/${t.id}`} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 transition hover:border-white/20">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold" style={{ background: `${GREEN}1f`, color: GREEN }}>{t.other.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">@{t.other}</p>
                  <p className="truncate font-mono text-[11px] text-white/45">{t.lastMessage || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[11px] text-white">{t.count} msg</p>
                  <p className="font-mono text-[9px] text-white/35">{ago(t.lastAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
        <Card glow="rgba(34,255,136,0.1)">
          <Heading kicker="Stream" title="Recent messages" Icon={MessageSquare} />
          <div className="no-scrollbar max-h-[340px] space-y-2 overflow-y-auto">
            {d.chats.recent.length === 0 && <Empty text="No messages." />}
            {d.chats.recent.map((m) => (
              <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%] rounded-2xl px-3 py-2" style={m.mine ? { background: `${GREEN}1f`, border: `1px solid ${GREEN}44` } : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-white/40">@{m.from} · {ago(m.created_at)}</p>
                  <p className="text-sm text-white/85">{m.text || "📎 attachment"}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ============ MODERATION FOOTPRINT ============ */}
      <SectionTitle>Moderation footprint</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Card glow={d.moderation.riskScore >= 60 ? "rgba(239,68,68,0.18)" : "rgba(34,255,136,0.1)"}>
          <div className="flex flex-col items-center">
            <RadialGauge value={d.moderation.riskScore} label="risk score" needle color={d.moderation.riskScore >= 60 ? "#ef4444" : d.moderation.riskScore >= 30 ? "#fbbf24" : GREEN} />
            <div className="mt-2 space-y-1">
              {d.moderation.riskFactors.map((f, i) => (
                <p key={i} className="flex items-center gap-1.5 text-center text-[11px] text-white/55"><AlertTriangle className="h-3 w-3 shrink-0 text-white/35" /> {f}</p>
              ))}
            </div>
          </div>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card glow="rgba(239,68,68,0.1)">
            <Heading kicker={`${d.moderation.reportsAgainst.length}`} title="Reports against" Icon={Flag} />
            <ReportList items={d.moderation.reportsAgainst} who="from" empty="Never reported." />
          </Card>
          <Card glow="rgba(56,189,248,0.1)">
            <Heading kicker={`${d.moderation.reportsFiled.length}`} title="Reports filed" Icon={Flag} />
            <ReportList items={d.moderation.reportsFiled} who="on" empty="Filed none." />
          </Card>
          <Card glow="rgba(251,113,133,0.1)">
            <Heading kicker={`${d.moderation.blockedBy.length}`} title="Blocked by" Icon={Slash} />
            <BlockList items={d.moderation.blockedBy} empty="Nobody blocked them." />
          </Card>
          <Card glow="rgba(167,139,250,0.1)">
            <Heading kicker={`${d.moderation.blocking.length}`} title="They blocked" Icon={Ban} />
            <BlockList items={d.moderation.blocking} empty="They blocked nobody." />
          </Card>
        </div>
      </div>

      {/* ============ DISCIPLINE (moderation) ============ */}
      {!p.isAdmin && (
        <>
          <SectionTitle>Discipline</SectionTitle>
          <ModerationPanel subjectType="user" subjectId={p.id} revalidateId={p.id} violations={d.violations} />
        </>
      )}

      {/* ============ RAW PROFILE DUMP ============ */}
      <SectionTitle>Raw record</SectionTitle>
      <Card glow="rgba(56,189,248,0.08)">
        <button onClick={() => setShowRaw((s) => !s)} className="flex w-full items-center justify-between gap-2 text-left">
          <span className="flex items-center gap-2 font-bold text-white"><Database className="h-4 w-4 text-[#38bdf8]" /> Full database row ({d.raw.length} columns)</span>
          <span className="font-mono text-xs text-white/45">{showRaw ? "hide" : "show"}</span>
        </button>
        {showRaw && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {d.raw.map((r) => (
              <div key={r.key} className="flex items-baseline gap-2 rounded-lg border border-white/5 bg-black/30 px-3 py-2">
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-white/40">{r.key}</span>
                <span className="ml-auto truncate text-right font-mono text-xs text-white/80">{r.value}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ============ ACTIVITY TIMELINE ============ */}
      <SectionTitle>Activity timeline</SectionTitle>
      <Card glow="rgba(34,255,136,0.1)">
        <div className="relative ml-2 space-y-4 border-l border-white/10 pl-6">
          {d.timeline.map((e, i) => (
            <motion.div key={e.id} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: Math.min(i * 0.04, 0.6) }} className="relative">
              <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-[#070a10]" style={{ background: TONE[e.tone] ?? GREEN, boxShadow: `0 0 8px ${TONE[e.tone] ?? GREEN}` }} />
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider" style={{ background: `${TONE[e.tone] ?? GREEN}22`, color: TONE[e.tone] ?? GREEN }}>{e.kind}</span>
                <span className="text-sm text-white/80">{e.text}</span>
                <span className="font-mono text-[10px] text-white/35">{ago(e.at)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>

      {/* ============ CONTROL ROOM (real power) ============ */}
      <SectionTitle>Control room</SectionTitle>
      <div id="control-room" className="scroll-mt-4">
        {protectedAdmin ? (
          <Card glow="rgba(167,139,250,0.12)">
            <div className="flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: "rgba(167,139,250,0.35)", background: "rgba(167,139,250,0.08)" }}>
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#a78bfa]" />
              <div>
                <p className="font-bold text-white">Protected admin</p>
                <p className="text-sm text-white/65">This is one of the grid operators. Another admin can&apos;t edit, restrict, ban or delete this account.</p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* sanctions */}
            <Card glow="rgba(239,68,68,0.1)">
              <Heading kicker="Sanctions" title="Restrictions" Icon={ShieldBan} />
              {/* shared duration: applies to whichever restriction you switch ON */}
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-white/45">New restriction lasts</span>
                <input value={restrTerm} onChange={(e) => setRestrTerm(e.target.value)} placeholder={'empty = permanent · "2h" · "7 days" · "2026-07-01"'} className={`${inputCls} flex-1`} />
                {(() => { const pv = banPreview(restrTerm); return pv ? <span className={`shrink-0 font-mono text-[11px] ${pv.ok ? "text-amber-300/80" : "text-red-400/80"}`}>{pv.ok && restrTerm.trim() ? `⏱ ${pv.text.replace("ban", "restriction")}` : pv.text}</span> : <span className="shrink-0 font-mono text-[11px] text-white/35">permanent</span>; })()}
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {RESTRICTIONS.map((r) => {
                  const active = rActive(p.restrictions[r.kind]);
                  return <Toggle key={r.kind} on={active} label={r.label} desc={active ? rUntilLabel(p.restrictions[r.kind]) : r.desc} onClick={() => toggleRestriction(r.kind)} disabled={busy} Icon={r.Icon} />;
                })}
                <Toggle on={banned} label="Full lockout" desc="The ban below" onClick={() => { if (banned) run(() => adminUnbanUser(p.id), "Reinstated"); else document.getElementById("ban-row")?.scrollIntoView({ behavior: "smooth" }); }} disabled={busy} Icon={ShieldBan} />
              </div>

              {/* ban / temp-ban row */}
              <div id="ban-row" className="mt-5 border-t border-white/10 pt-4">
                {banned ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-white/70">{tempActive ? `Temp-banned, auto-lifts ${fmtDateTime(p.banUntil!)}.` : "Permanently banned."}</p>
                    <button onClick={() => run(() => adminUnbanUser(p.id), "Reinstated")} disabled={busy} className="flex items-center gap-2 rounded-xl border border-[#22ff88]/40 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-[#22ff88] transition hover:bg-[#22ff88]/10 disabled:opacity-50">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Lift suspension
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Ban reason (shown to the user)…" className={inputCls} />
                    {/* free-text term: a duration OR a date — empty = permanent */}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={banTerm}
                        onChange={(e) => setBanTerm(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") applyBan(); }}
                        placeholder={'Term: "4 days" · "2h 30m" · "2026-07-01" · empty = permanent'}
                        className={`${inputCls} flex-1`}
                      />
                      <button onClick={applyBan} disabled={busy}
                        className="flex items-center justify-center gap-2 rounded-xl border border-red-500/50 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-red-300 transition hover:bg-red-500/10 disabled:opacity-50">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} {banTerm.trim() ? "Ban" : "Ban forever"}
                      </button>
                    </div>
                    {(() => { const pv = banPreview(banTerm); return pv ? <p className={`font-mono text-[11px] ${pv.ok ? "text-amber-300/80" : "text-red-400/80"}`}>→ {pv.text}</p> : null; })()}
                    {/* quick presets */}
                    <div className="flex flex-wrap gap-2">
                      {(["15 min", "1 hour", "24 hours", "7 days", "30 days"]).map((label) => (
                        <button key={label} onClick={() => setBanTerm(label)} disabled={busy}
                          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/65 transition hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-50">
                          <Clock className="h-3 w-3" /> {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* edit profile */}
            <Card glow="rgba(34,255,136,0.1)">
              <Heading kicker="Override" title="Edit profile" Icon={Pencil} />
              <div className="grid gap-4 lg:grid-cols-2">
                <Editable label="Full name"><input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} /></Editable>
                <Editable label="Username"><input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} /></Editable>
                <Editable label="Role"><Select value={role} onChange={setRole} options={[{ value: "customer", label: "Customer" }, { value: "seller", label: "Seller" }, { value: "courier", label: "Courier" }]} className="w-full" align="left" /></Editable>
                <Editable label="Plan"><Select value={plan} onChange={setPlan} options={[{ value: "free", label: "Free" }, { value: "pro", label: "Pro" }, { value: "elite", label: "Elite" }]} className="w-full" align="left" /></Editable>
                <Editable label="Loyalty tier"><Select value={tier} onChange={setTier} options={[{ value: "Bronze", label: "Bronze" }, { value: "Silver", label: "Silver" }, { value: "Gold", label: "Gold" }, { value: "Platinum", label: "Platinum" }]} className="w-full" align="left" /></Editable>
                <Editable label="Verified"><Select value={verified ? "yes" : "no"} onChange={(v) => setVerified(v === "yes")} options={[{ value: "no", label: "Not verified" }, { value: "yes", label: "Verified ✓" }]} className="w-full" align="left" /></Editable>
                <Editable label="Loyalty points"><input value={points} onChange={(e) => setPoints(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputCls} /></Editable>
                <Editable label="Cashback · TJS"><input value={cashback} onChange={(e) => setCashback(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className={inputCls} /></Editable>
              </div>
              <Editable label="Bio" className="mt-4"><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className={`${inputCls} resize-y`} /></Editable>
              <div className="mt-4 flex justify-end gap-3">
                <button onClick={() => router.refresh()} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/5">Reset</button>
                <button onClick={saveProfile} disabled={busy} className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition disabled:opacity-50" style={{ background: `${GREEN}1f`, color: GREEN, boxShadow: `inset 0 0 0 1px ${GREEN}55` }}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save profile
                </button>
              </div>
            </Card>

            {/* admin note */}
            <Card glow="rgba(251,191,36,0.1)">
              <Heading kicker="Internal" title="Admin note (private)" Icon={ShieldCheck} />
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Private memo — only admins ever see this…" className={`${inputCls} resize-y`} />
              <div className="mt-3 flex justify-end">
                <button onClick={() => run(() => adminSetUserNote(p.id, note), "Note saved")} disabled={busy} className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:bg-white/5 disabled:opacity-50">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save note
                </button>
              </div>
            </Card>

            {/* delete */}
            <Card glow="rgba(239,68,68,0.12)">
              <Heading kicker="Irreversible" title="Delete account" Icon={AlertTriangle} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-white/60">Permanently removes the auth user and every owned row (orders, listings, messages…). Cannot be undone.</p>
                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 rounded-xl border border-red-500/40 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-red-300 transition hover:bg-red-500/10"><AlertTriangle className="h-4 w-4" /> Delete forever</button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* delete confirm */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmDelete(false)}>
            <motion.div onClick={(e) => e.stopPropagation()} initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 12, opacity: 0 }} className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-[#0a0e16] p-5">
              <p className="flex items-center gap-2 font-bold text-white"><AlertTriangle className="h-5 w-5 text-red-400" /> Delete @{p.username}?</p>
              <p className="mt-2 text-sm text-white/60">This wipes the account and all owned data permanently. Consider a ban instead if you might reverse it.</p>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setConfirmDelete(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5">Cancel</button>
                <button onClick={() => startTransition(() => adminDeleteUser(p.id))} className="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/30">Delete forever</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------- helpers */
const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25";

function Card({ children, className = "", glow = "rgba(34,255,136,0)" }: { children: React.ReactNode; className?: string; glow?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl ${className}`}>
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full blur-3xl" style={{ background: glow }} />
      <div className="relative">{children}</div>
    </div>
  );
}
function Heading({ kicker, title, Icon, right }: { kicker: string; title: string; Icon?: typeof Wallet; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className="h-4 w-4" style={{ color: GREEN }} />}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">{kicker}</p>
          <h2 className="mt-0.5 text-lg font-bold text-white">{title}</h2>
        </div>
      </div>
      {right}
    </div>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-9 flex items-center gap-3">
      <span className="h-px flex-1" style={{ background: "linear-gradient(90deg,transparent,rgba(34,255,136,0.4))" }} />
      <span className="font-mono text-[11px] uppercase tracking-[0.35em]" style={{ color: GREEN }}>{children}</span>
      <span className="h-px flex-1" style={{ background: "linear-gradient(90deg,rgba(34,255,136,0.4),transparent)" }} />
    </div>
  );
}
function Stat({ label, value, unit, accent = GREEN, Icon }: { label: string; value: number; unit?: string; accent?: string; Icon?: typeof Wallet }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">{label}</p>
        {Icon && <Icon className="h-4 w-4" style={{ color: accent }} />}
      </div>
      <p className="mt-1 text-2xl font-black text-white"><CountUp value={value} />{unit && <span className="ml-1 text-sm font-bold" style={{ color: accent }}>{unit}</span>}</p>
      <span className="absolute bottom-0 left-0 h-0.5 w-full" style={{ background: `linear-gradient(90deg,${accent},transparent)` }} />
    </div>
  );
}
function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{label}</p>
      <p className={`mt-0.5 truncate text-sm text-white ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</p>
    </div>
  );
}
function Editable({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-white/45">{label}</span>
      {children}
    </label>
  );
}
function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className="rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider" style={{ background: `${color}22`, color }}>{children}</span>;
}
function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-white/40">{text}</p>;
}
function Row({ left, sub, right, tag, tagColor }: { left: string; sub: string; right: string; tag: string; tagColor?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate font-mono text-sm text-white">{left}</p>
        <p className="font-mono text-[10px] text-white/40">{sub}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-white">{right}</span>
        <span className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase" style={{ background: `${tagColor ?? "#888"}1f`, color: tagColor ?? "#888" }}>{tag.replace(/_/g, " ")}</span>
      </div>
    </div>
  );
}
function TallyList({ items, empty }: { items: { value: string; count: number }[]; empty: string }) {
  if (items.length === 0) return <Empty text={empty} />;
  return (
    <div className="space-y-2">
      {items.map((t, i) => (
        <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
          <span className="min-w-0 truncate text-sm text-white/85">{t.value}</span>
          <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/60">×{t.count}</span>
        </div>
      ))}
    </div>
  );
}
function BlockList({ items, empty }: { items: { id: string; username: string; at: string }[]; empty: string }) {
  if (items.length === 0) return <Empty text={empty} />;
  return (
    <div className="no-scrollbar max-h-[180px] space-y-1.5 overflow-y-auto">
      {items.map((b) => (
        <Link key={b.id + b.at} href={`/admin/users/${b.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 transition hover:border-white/20">
          <span className="truncate text-sm text-white">@{b.username}</span>
          <span className="shrink-0 font-mono text-[10px] text-white/40">{ago(b.at)}</span>
        </Link>
      ))}
    </div>
  );
}
function ReportList({ items, who, empty }: { items: { id: string; other: string; otherId: string; category: string; description: string; status: string; created_at: string }[]; who: string; empty: string }) {
  if (items.length === 0) return <Empty text={empty} />;
  return (
    <div className="no-scrollbar max-h-[220px] space-y-2 overflow-y-auto">
      {items.map((r) => (
        <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-white/80"><span className="text-white/40">{who}</span> <Link href={`/admin/users/${r.otherId}`} className="text-white hover:underline">@{r.other}</Link></span>
            <span className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase" style={{ background: `${REPORT_COLOR[r.status] ?? "#888"}1f`, color: REPORT_COLOR[r.status] ?? "#888" }}>{r.status}</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-white">{r.category}</p>
          {r.description && <p className="mt-0.5 text-xs text-white/55">{r.description}</p>}
          <p className="mt-1 font-mono text-[9px] text-white/30">{ago(r.created_at)}</p>
        </div>
      ))}
    </div>
  );
}
function Toggle({ on, label, desc, onClick, disabled, Icon }: { on: boolean; label: string; desc: string; onClick: () => void; disabled: boolean; Icon: typeof Ban }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex items-start gap-3 rounded-xl border p-3 text-left transition disabled:opacity-50" style={on ? { borderColor: "rgba(239,68,68,0.45)", background: "rgba(239,68,68,0.08)" } : { borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: on ? "#ef4444" : "rgba(255,255,255,0.5)" }} />
      <div className="min-w-0">
        <p className="text-sm font-bold" style={{ color: on ? "#fca5a5" : "#fff" }}>{label}{on && " · ON"}</p>
        <p className="text-[11px] text-white/45">{desc}</p>
      </div>
    </button>
  );
}
