"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Ban,
  BadgeCheck,
  Crown,
  Heart,
  MapPin,
  MessageSquare,
  Package,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  Store,
  Trash2,
  Wallet,
} from "lucide-react";
import { AreaChart, CountUp, GREEN, group, HBars, StatusBars } from "./charts";
import type { AdminUserDossier } from "@/lib/data/admin-users";

const ROLE_COLOR: Record<string, string> = { customer: "#22ff88", seller: "#38bdf8", courier: "#fbbf24", admin: "#a78bfa" };
const STATUS_COLOR: Record<string, string> = { placed: "#22ff88", processing: "#38bdf8", out_for_delivery: "#a78bfa", arrived: "#fbbf24", fulfilled: "#22c55e", cancelled: "#ef4444" };
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
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{label}</p>
      <p className="mt-0.5 truncate text-sm text-white">{value || "—"}</p>
    </div>
  );
}

export function UserDossierClient({ d }: { d: AdminUserDossier }) {
  const [confirm, setConfirm] = useState(false);
  const p = d.profile;
  const accent = ROLE_COLOR[p.role] ?? GREEN;
  const socials = Object.entries(p.socials).filter(([, v]) => v);

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <Link href="/admin/users" className="mb-4 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>

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
              <span className="font-mono text-[11px] text-white/40">Joined {fmtDate(p.createdAt)} · last seen {ago(d.auth.lastSignIn)}</span>
            </div>
          </div>
          <button onClick={() => setConfirm(true)} className="mb-1 flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white/80 transition hover:bg-white/5">
            <SlidersHorizontal className="h-4 w-4" /> Actions
          </button>
        </div>
      </div>

      {/* identity fields */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="User ID" value={p.id} />
        <Field label="Email" value={p.email ?? "—"} />
        <Field label="Phone" value={p.phone ?? "—"} />
        <Field label="Birthday" value={p.birthday ? fmtDate(p.birthday) : "—"} />
        <Field label="Locale" value={p.locale} />
        <Field label="Theme" value={p.theme} />
        <Field label="Loyalty points" value={String(p.loyaltyPoints)} />
        <Field label="Cashback" value={`${group(p.cashbackBalance)} смн`} />
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
      {p.bio && <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/70">{p.bio}</p>}

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Auth created" value={fmtDate(d.auth.authCreatedAt)} />
        <Field label="Email confirmed" value={d.auth.emailConfirmed ? "Yes" : "No"} />
        <Field label="Last sign-in" value={d.auth.lastSignIn ? `${fmtDate(d.auth.lastSignIn)} · ${ago(d.auth.lastSignIn)}` : "never"} />
      </div>

      {/* ============ AS BUYER ============ */}
      <SectionTitle>As buyer</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total spent" value={d.buyer.spent} unit="смн" Icon={Wallet} />
        <Stat label="Orders" value={d.buyer.orders} accent="#38bdf8" Icon={ShoppingBag} />
        <Stat label="Avg order" value={d.buyer.avgOrder} unit="смн" accent="#a78bfa" />
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
              <div key={l.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                <span className="rounded-lg px-2 py-0.5 font-mono text-[9px] uppercase" style={{ background: `${GREEN}1f`, color: GREEN }}>{l.type}</span>
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{l.title}</p>
                <span className="font-mono text-[10px] text-white/45">stock {l.stock}</span>
                <span className="font-mono text-sm font-bold text-white">{group(l.price)} смн</span>
                {!l.is_active && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] uppercase text-red-400">off</span>}
              </div>
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
              <Link key={t.id} href={`/admin/users/${t.otherId}`} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 transition hover:border-white/20">
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

      {/* ============ TIMELINE ============ */}
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

      {/* ============ DANGER ZONE ============ */}
      <SectionTitle>Danger zone</SectionTitle>
      <Card glow="rgba(239,68,68,0.12)">
        {p.isAdmin ? (
          <div className="flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: "rgba(167,139,250,0.35)", background: "rgba(167,139,250,0.08)" }}>
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#a78bfa]" />
            <div>
              <p className="font-bold text-white">Protected admin</p>
              <p className="text-sm text-white/65">This is one of the two grid admins. Another admin can&apos;t edit, restrict, ban or delete this account.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Danger Icon={Pencil} label="Edit profile" onClick={() => toast("Profile editor arrives with the Users module.", { icon: "✏️" })} />
            <Danger Icon={SlidersHorizontal} label="Restrict" onClick={() => toast("Restriction tools land in Black List.", { icon: "🛡️" })} />
            <Danger Icon={Ban} label="Ban" onClick={() => toast("Ban goes live with Full Control.", { icon: "⛔" })} />
            <Danger Icon={Trash2} label="Delete" onClick={() => toast("Deletion wires up with Full Control.", { icon: "🗑️" })} />
          </div>
        )}
      </Card>

      {/* quick action sheet */}
      <AnimatePresence>
        {confirm && (
          <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirm(false)}>
            <motion.div onClick={(e) => e.stopPropagation()} initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 12, opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 26 }} className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0a0e16] p-5">
              <p className="mb-3 flex items-center gap-2 font-bold text-white"><ShieldCheck className="h-4 w-4" style={{ color: GREEN }} /> Admin actions</p>
              {p.isAdmin ? (
                <p className="rounded-xl border p-3 text-sm text-white/70" style={{ borderColor: "rgba(167,139,250,0.35)", background: "rgba(167,139,250,0.08)" }}>Protected admin — no actions available.</p>
              ) : (
                <div className="grid gap-2">
                  <Danger Icon={Pencil} label="Edit profile" onClick={() => { setConfirm(false); toast("Profile editor arrives with the Users module.", { icon: "✏️" }); }} />
                  <Danger Icon={SlidersHorizontal} label="Restrict" onClick={() => { setConfirm(false); toast("Restriction tools land in Black List.", { icon: "🛡️" }); }} />
                  <Danger Icon={Ban} label="Ban" onClick={() => { setConfirm(false); toast("Ban goes live with Full Control.", { icon: "⛔" }); }} />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
function Danger({ Icon, label, onClick }: { Icon: typeof Ban; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-xl border border-red-500/25 px-3 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/10">
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
