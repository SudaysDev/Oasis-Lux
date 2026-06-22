"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  ArrowDownUp,
  Ban,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Crown,
  Eye,
  Loader2,
  Pencil,
  Search,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  Trash2,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { CountUp, GREEN, group, LiveStatus } from "./charts";
import { Select } from "./Select";
import { adminBanUser, adminUnbanUser } from "@/app/(admin)/admin/users/[id]/actions";
import type { AdminUsersList, UserListRow } from "@/lib/data/admin-users";

const ROLE_COLOR: Record<string, string> = { customer: "#22ff88", seller: "#38bdf8", courier: "#fbbf24", admin: "#a78bfa" };
const ROLES = ["all", "customer", "seller", "courier", "admin"] as const;
const SORTS = [
  { id: "new", label: "Newest" },
  { id: "old", label: "Oldest" },
  { id: "spent", label: "Top spender" },
  { id: "sales", label: "Top seller" },
  { id: "listings", label: "Most listings" },
  { id: "rating", label: "Highest rated" },
  { id: "az", label: "A–Z" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

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

export function UsersClient({ data }: { data: AdminUsersList }) {
  const router = useRouter();
  const s = data.summary;
  const [q, setQ] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("all");
  const [sort, setSort] = useState<SortId>("new");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlyBuyers, setOnlyBuyers] = useState(false);
  const [onlyBanned, setOnlyBanned] = useState(false);
  const [target, setTarget] = useState<UserListRow | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const quickBan = (u: UserListRow) => {
    setBusy(true);
    startTransition(async () => {
      const r = u.isBanned ? await adminUnbanUser(u.id) : await adminBanUser(u.id, "");
      setBusy(false);
      if (!r.ok) toast.error(r.error);
      else { toast.success(u.isBanned ? "Reinstated" : "Banned"); setTarget(null); router.refresh(); }
    });
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = data.users.filter((u) => {
      if (role !== "all" && u.role !== role) return false;
      if (onlyVerified && !u.isVerified) return false;
      if (onlyBuyers && u.orders === 0) return false;
      if (onlyBanned && !u.isBanned) return false;
      if (needle) {
        const hay = `${u.username} ${u.fullName} ${u.email ?? ""} ${u.id}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const by: Record<SortId, (a: UserListRow, b: UserListRow) => number> = {
      new: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
      old: (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
      spent: (a, b) => b.spent - a.spent,
      sales: (a, b) => b.salesRevenue - a.salesRevenue,
      listings: (a, b) => b.listings - a.listings,
      rating: (a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount,
      az: (a, b) => a.username.localeCompare(b.username),
    };
    list = [...list].sort(by[sort]);
    return list;
  }, [data.users, q, role, sort, onlyVerified, onlyBuyers, onlyBanned]);

  const roleCount = (r: string) => (r === "all" ? data.users.length : data.users.filter((u) => u.role === r).length);

  const PAGE = 12;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);
  const reset = () => setPage(0);

  return (
    <div className="mx-auto max-w-6xl pb-12">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.35em]" style={{ color: GREEN }}>Users</p>
            <LiveStatus />
          </div>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Every account ever</h1>
          <p className="mt-1.5 text-sm text-white/55">Search, filter and inspect every identity on the grid. Click any user for a full dossier.</p>
        </div>
      </div>

      {/* summary tiles */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Total" value={s.total} accent="#38bdf8" />
        <Tile label="Customers" value={s.customers} accent="#22ff88" />
        <Tile label="Sellers" value={s.sellers} accent="#a78bfa" />
        <Tile label="Couriers" value={s.couriers} accent="#fbbf24" />
        <Tile label="Verified" value={s.verified} accent="#34d399" />
        <Tile label="Banned" value={s.banned} accent="#ef4444" />
      </div>

      {/* controls */}
      <div className="sticky top-[68px] z-20 mt-6 rounded-2xl border border-white/10 bg-[#070a10]/85 p-3 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3">
            <Search className="h-4 w-4 text-white/40" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); reset(); }}
              placeholder="Search username, name, email or id…"
              className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-white/35"
            />
            {q && <button onClick={() => { setQ(""); reset(); }} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>}
          </div>
          <Select
            value={sort}
            onChange={(v) => { setSort(v as SortId); reset(); }}
            options={SORTS.map((o) => ({ value: o.id, label: o.label }))}
            Icon={ArrowDownUp}
            className="w-44"
          />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {ROLES.map((r) => {
            const on = role === r;
            return (
              <button
                key={r}
                onClick={() => { setRole(r); reset(); }}
                className="relative rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition"
                style={on ? { color: ROLE_COLOR[r] ?? GREEN } : { color: "rgba(255,255,255,0.55)" }}
              >
                {on && <motion.span layoutId="role-pill" className="absolute inset-0 rounded-lg" style={{ background: `${ROLE_COLOR[r] ?? GREEN}1f`, boxShadow: `inset 0 0 0 1px ${ROLE_COLOR[r] ?? GREEN}55` }} transition={{ type: "spring", stiffness: 350, damping: 30 }} />}
                <span className="relative z-10">{r === "all" ? "All" : r} · {roleCount(r)}</span>
              </button>
            );
          })}
          <span className="mx-1 h-5 w-px bg-white/10" />
          <Toggle on={onlyVerified} onClick={() => { setOnlyVerified((v) => !v); reset(); }} Icon={BadgeCheck} label="Verified" />
          <Toggle on={onlyBuyers} onClick={() => { setOnlyBuyers((v) => !v); reset(); }} Icon={ShoppingBag} label="Buyers" />
          <Toggle on={onlyBanned} onClick={() => { setOnlyBanned((v) => !v); reset(); }} Icon={ShieldBan} label="Banned" danger />
          {s.restricted > 0 && <span className="font-mono text-[11px] text-[#fb7185]/80">· {s.restricted} restricted</span>}
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-white/45">
            <Users className="h-3.5 w-3.5" /> {filtered.length} shown
          </span>
        </div>
      </div>

      {/* list */}
      <div className="mt-4 grid gap-2.5">
        {filtered.length === 0 && <p className="py-16 text-center text-sm text-white/40">No accounts match your filters.</p>}
        {pageItems.map((u, i) => (
          <motion.div
            key={u.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.015, 0.4) }}
          >
            <div className="group flex items-center gap-3 rounded-2xl border p-3 transition hover:bg-white/[0.05]" style={u.isBanned ? { borderColor: "rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.06)" } : { borderColor: "rgba(255,255,255,0.1)" }}>
              <Link href={`/admin/users/${u.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full text-sm font-black" style={{ background: `${ROLE_COLOR[u.role] ?? GREEN}22`, color: ROLE_COLOR[u.role] ?? GREEN, boxShadow: u.isBanned ? "0 0 0 2px #ef4444" : undefined }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" /> : u.username.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 truncate font-semibold text-white">
                    @{u.username}
                    {u.isVerified && <BadgeCheck className="h-3.5 w-3.5 text-[#34d399]" />}
                    {u.isAdmin && <Crown className="h-3.5 w-3.5 text-[#a78bfa]" />}
                    {u.isBanned && <Chip color="#ef4444"><ShieldBan className="h-3 w-3" /> banned</Chip>}
                    {!u.isBanned && u.restrictChat && <Chip color="#fb7185">no chat</Chip>}
                    {!u.isBanned && u.restrictSell && <Chip color="#fb7185">no sell</Chip>}
                    {!u.isBanned && u.restrictBuy && <Chip color="#fb7185">no buy</Chip>}
                  </p>
                  <p className="truncate font-mono text-[11px] text-white/45">
                    <span className="capitalize" style={{ color: ROLE_COLOR[u.role] }}>{u.role}</span>
                    {" · "}{u.plan}{u.email ? ` · ${u.email}` : ""}
                  </p>
                </div>
              </Link>

              <div className="hidden items-center gap-5 md:flex">
                <Metric label="Spent" value={`${group(u.spent)}`} unit="смн" />
                <Metric label="Orders" value={String(u.orders)} />
                <Metric label="Listings" value={String(u.listings)} />
                <Metric label="Rating" value={u.ratingCount ? `${u.ratingAvg}★` : "—"} />
                <div className="text-right">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-white/35">Last seen</p>
                  <p className="text-xs text-white/70">{ago(u.lastSeen)}</p>
                </div>
              </div>

              <button
                onClick={() => setTarget(u)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Actions"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* pagination */}
      {pageCount > 1 && (
        <div className="mt-6 flex items-center justify-center gap-1.5">
          <PageBtn disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </PageBtn>
          {Array.from({ length: pageCount }).map((_, i) => {
            if (pageCount > 7 && Math.abs(i - safePage) > 2 && i !== 0 && i !== pageCount - 1) {
              if (i === safePage - 3 || i === safePage + 3) return <span key={i} className="px-1 text-white/30">…</span>;
              return null;
            }
            return (
              <button
                key={i}
                onClick={() => setPage(i)}
                className="grid h-9 min-w-9 place-items-center rounded-lg border px-2 font-mono text-sm transition"
                style={i === safePage ? { borderColor: `${GREEN}66`, background: `${GREEN}1f`, color: GREEN } : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
              >
                {i + 1}
              </button>
            );
          })}
          <PageBtn disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
            <ChevronRight className="h-4 w-4" />
          </PageBtn>
          <span className="ml-3 font-mono text-[11px] text-white/40">
            Page {safePage + 1} / {pageCount} · {filtered.length} users
          </span>
        </div>
      )}

      {/* action modal */}
      <AnimatePresence>
        {target && (
          <motion.div
            className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setTarget(null)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 12, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-[#0a0e16] p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-full text-sm font-black" style={{ background: `${ROLE_COLOR[target.role] ?? GREEN}1f`, color: ROLE_COLOR[target.role] ?? GREEN }}>
                    {target.username.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <p className="flex items-center gap-1.5 font-bold text-white">@{target.username}{target.isAdmin && <Crown className="h-4 w-4 text-[#a78bfa]" />}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-white/45">{target.role}</p>
                  </div>
                </div>
                <button onClick={() => setTarget(null)} className="text-white/40 transition hover:text-white"><X className="h-5 w-5" /></button>
              </div>

              {target.isAdmin && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed" style={{ borderColor: "rgba(167,139,250,0.35)", background: "rgba(167,139,250,0.08)" }}>
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#a78bfa]" />
                  <span className="text-white/75">Protected <strong className="text-white">admin</strong> — can&apos;t be edited, restricted, banned or removed by another admin.</span>
                </div>
              )}

              {target.isBanned && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed" style={{ borderColor: "rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.08)" }}>
                  <ShieldBan className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <span className="text-white/75">Currently <strong className="text-red-300">suspended</strong>. They can&apos;t sign in or act until reinstated.</span>
                </div>
              )}

              <div className="mt-4 grid gap-2">
                <Link href={`/admin/users/${target.id}`} className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-white/5">
                  <Eye className="h-4 w-4 text-white/70" /> Open dossier
                </Link>
                <Act Icon={Pencil} label="Edit profile" disabled={target.isAdmin} onClick={() => router.push(`/admin/users/${target.id}#control-room`)} />
                <Act Icon={SlidersHorizontal} label="Restrictions (chat / sell / buy)" disabled={target.isAdmin} onClick={() => router.push(`/admin/users/${target.id}#control-room`)} />
                {target.isBanned ? (
                  <Act Icon={ShieldCheck} label={busy ? "Working…" : "Lift suspension"} disabled={busy} onClick={() => quickBan(target)} />
                ) : (
                  <Act Icon={busy ? Loader2 : Ban} label={busy ? "Working…" : "Ban account"} danger disabled={target.isAdmin || busy} onClick={() => quickBan(target)} />
                )}
                <Act Icon={Trash2} label="Delete account" danger disabled={target.isAdmin} onClick={() => router.push(`/admin/users/${target.id}#control-room`)} />
              </div>

              <button onClick={() => { router.push(`/admin/users/${target.id}`); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold uppercase tracking-wider transition" style={{ background: `${GREEN}1f`, color: GREEN }}>
                <UserCog className="h-4 w-4" /> Full dossier
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PageBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30">
      {children}
    </button>
  );
}
function Tile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <motion.div whileHover={{ y: -3 }} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">{label}</p>
      <p className="mt-1 text-2xl font-black text-white"><CountUp value={value} /></p>
      <span className="absolute bottom-0 left-0 h-0.5 w-full" style={{ background: `linear-gradient(90deg,${accent},transparent)` }} />
    </motion.div>
  );
}
function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="text-right">
      <p className="font-mono text-[9px] uppercase tracking-wider text-white/35">{label}</p>
      <p className="font-mono text-sm font-bold text-white">{value}{unit && <span className="ml-0.5 text-[10px] text-white/40">{unit}</span>}</p>
    </div>
  );
}
function Toggle({ on, onClick, Icon, label, danger }: { on: boolean; onClick: () => void; Icon: typeof Star; label: string; danger?: boolean }) {
  const c = danger ? "#ef4444" : GREEN;
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition" style={on ? { borderColor: `${c}66`, background: `${c}1f`, color: c } : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
function Chip({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider" style={{ background: `${color}22`, color }}>{children}</span>;
}
function Act({ Icon, label, onClick, disabled, danger }: { Icon: typeof Ban; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={disabled ? "Admins are protected" : undefined}
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${disabled ? "cursor-not-allowed border-white/5 text-white/30" : danger ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-white/10 text-white hover:bg-white/5"}`}>
      <Icon className="h-4 w-4" /> {label}
      {disabled && <ShieldCheck className="ml-auto h-4 w-4 text-[#a78bfa]" />}
    </button>
  );
}
