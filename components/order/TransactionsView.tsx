"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Receipt, TrendingUp, Wallet } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchMyOrders, fetchSellerOrders, type OrderRecord } from "@/lib/data/orders";
import { useAuth } from "@/hooks/useAuth";
import { useMoney } from "@/hooks/useMoney";
import { cn } from "@/lib/utils";

type Kind = "purchase" | "sale";
interface Tx { id: string; orderId: string; kind: Kind; amount: number; status: string; createdAt: string; units: number }
type FilterKind = "all" | Kind;

const active = (o: OrderRecord) => o.status !== "cancelled";

export function TransactionsView() {
  const { profile } = useAuth();
  const { money } = useMoney();
  const [buyer, setBuyer] = useState<OrderRecord[]>([]);
  const [seller, setSeller] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKind>("all");

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const sb = getBrowserClient();
    void Promise.all([fetchMyOrders(sb, profile.id), fetchSellerOrders(sb, profile.id)])
      .then(([b, s]) => { if (!cancelled) { setBuyer(b); setSeller(s); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [profile]);

  const txs = useMemo<Tx[]>(() => {
    const units = (o: OrderRecord) => o.items.reduce((n, i) => n + i.quantity, 0);
    const p: Tx[] = buyer.map((o) => ({ id: `p-${o.id}`, orderId: o.id, kind: "purchase", amount: o.total, status: o.status, createdAt: o.createdAt, units: units(o) }));
    const s: Tx[] = seller.map((o) => ({ id: `s-${o.id}`, orderId: o.id, kind: "sale", amount: o.total, status: o.status, createdAt: o.createdAt, units: units(o) }));
    return [...p, ...s].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [buyer, seller]);

  const spent = buyer.filter(active).reduce((s, o) => s + o.total, 0);
  const earned = seller.filter(active).reduce((s, o) => s + o.total, 0);
  const net = earned - spent;

  // last 6 months spent vs earned
  const months = useMemo(() => {
    const now = new Date();
    const keys: { key: string; label: string; spent: number; earned: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: format(d, "MMM"), spent: 0, earned: 0 });
    }
    const idx = (iso: string) => {
      const d = new Date(iso);
      return keys.findIndex((k) => k.key === `${d.getFullYear()}-${d.getMonth()}`);
    };
    buyer.filter(active).forEach((o) => { const i = idx(o.createdAt); if (i >= 0) keys[i].spent += o.total; });
    seller.filter(active).forEach((o) => { const i = idx(o.createdAt); if (i >= 0) keys[i].earned += o.total; });
    return keys;
  }, [buyer, seller]);
  const maxMonth = Math.max(1, ...months.map((m) => Math.max(m.spent, m.earned)));

  const feed = filter === "all" ? txs : txs.filter((t) => t.kind === filter);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-black sm:text-4xl">Transactions</h1>
      <p className="mt-1 text-sm text-fg-muted">Everything you&apos;ve spent and earned on OASIS LUX.</p>

      {/* stat cards */}
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={ArrowUpRight} label="Total spent" value={money(spent)} tone="danger" />
        <Stat icon={ArrowDownLeft} label="Total earned" value={money(earned)} tone="success" />
        <Stat icon={Wallet} label="Net balance" value={`${net < 0 ? "−" : ""}${money(Math.abs(net))}`} tone={net < 0 ? "danger" : "accent"} />
        <Stat icon={Receipt} label="Transactions" value={String(txs.length)} tone="accent" />
      </div>

      {/* monthly chart */}
      <section className="card mt-6 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold"><TrendingUp className="h-5 w-5 text-accent" /> Last 6 months</h2>
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-danger" /> Spent</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" /> Earned</span>
          </div>
        </div>
        <div className="mt-5 flex h-40 items-end justify-between gap-3">
          {months.map((m) => (
            <div key={m.key} className="group relative flex flex-1 flex-col items-center gap-2">
              {/* styled hover tooltip — replaces the browser's default title bubble */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 -translate-y-1 whitespace-nowrap rounded-xl border border-[var(--panel-border)] bg-bg-elev/95 px-3 py-2 text-xs opacity-0 shadow-[0_18px_40px_-16px_var(--accent-glow)] backdrop-blur-md transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-fg-muted">{m.label}</p>
                <p className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-danger" /> Spent
                  <span className="ml-auto pl-3 font-semibold tabular-nums">{money(m.spent)}</span>
                </p>
                <p className="mt-0.5 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-success" /> Earned
                  <span className="ml-auto pl-3 font-semibold tabular-nums">{money(m.earned)}</span>
                </p>
              </div>
              <div className="flex h-32 w-full items-end justify-center gap-1">
                <motion.div
                  className="w-3 rounded-t bg-danger/70 transition-colors group-hover:bg-danger"
                  initial={{ height: 0 }}
                  animate={{ height: `${(m.spent / maxMonth) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
                <motion.div
                  className="w-3 rounded-t bg-success/70 transition-colors group-hover:bg-success"
                  initial={{ height: 0 }}
                  animate={{ height: `${(m.earned / maxMonth) * 100}%` }}
                  transition={{ duration: 0.5, delay: 0.05 }}
                />
              </div>
              <span className="font-mono text-[10px] uppercase text-fg-muted transition-colors group-hover:text-accent">{m.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* filter tabs */}
      <div className="mt-6 flex gap-2">
        {([["all", "All"], ["purchase", "Purchases"], ["sale", "Sales"]] as [FilterKind, string][]).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
              filter === k ? "neon-border text-accent" : "card text-fg-muted hover:text-fg",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* feed */}
      {loading ? (
        <div className="mt-6 flex flex-col gap-3">{[0, 1, 2].map((i) => <div key={i} className="card h-16 animate-pulse rounded-2xl" />)}</div>
      ) : feed.length === 0 ? (
        <p className="glass mt-6 rounded-2xl px-6 py-12 text-center text-sm text-fg-muted">No transactions yet.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-2.5">
          {feed.map((t) => {
            const sale = t.kind === "sale";
            const cancelled = t.status === "cancelled";
            return (
              <Link
                key={t.id}
                href={`/order/${t.orderId}/track`}
                className="card flex items-center gap-3 rounded-2xl p-3.5 transition hover:neon-border"
              >
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", sale ? "bg-success/15 text-success" : "bg-danger/15 text-danger")}>
                  {sale ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {sale ? "Sale" : "Purchase"} <span className="font-mono text-fg-muted">#{t.orderId.slice(0, 8)}</span>
                  </p>
                  <p className="font-mono text-[11px] text-fg-muted">
                    {t.units} item{t.units > 1 ? "s" : ""} · {format(new Date(t.createdAt), "d MMM yyyy, HH:mm")}
                    {cancelled ? " · cancelled" : ""}
                  </p>
                </div>
                <span className={cn("shrink-0 text-base font-black tabular-nums", cancelled ? "text-fg-muted line-through" : sale ? "text-success" : "text-fg")}>
                  {sale ? "+" : "−"}{money(t.amount)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Wallet; label: string; value: string; tone: "danger" | "success" | "accent" }) {
  const cls = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-accent";
  return (
    <div className="card rounded-2xl p-4">
      <div className={cn("grid h-9 w-9 place-items-center rounded-xl bg-[var(--panel)]", cls)}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-fg-muted">{label}</p>
      <p className={cn("mt-0.5 text-xl font-black", cls)}>{value}</p>
    </div>
  );
}
