"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Ban, Flame, ImageIcon, MessageSquare, Search, X } from "lucide-react";
import { CountUp, GREEN, LiveStatus, MiniBars } from "./charts";
import { cn } from "@/lib/utils";
import type { AdminConversations, AdminConvRow } from "@/lib/data/admin-messages";

function ago(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

type Sort = "recent" | "busiest";
type Scope = "all" | "active" | "blocked";

export function AdminMessagesClient({ data }: { data: AdminConversations }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [scope, setScope] = useState<Scope>("all");
  const [today] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); });

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    const rows: AdminConvRow[] = data.conversations.filter((c) => {
      if (scope === "blocked" && !c.blocked) return false;
      if (scope === "active" && new Date(c.lastAt).getTime() < today) return false;
      return !n || `${c.a} ${c.b} ${c.lastMessage}`.toLowerCase().includes(n);
    });
    return [...rows].sort((a, b) =>
      sort === "busiest" ? b.count - a.count : new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
    );
  }, [data.conversations, q, sort, scope, today]);

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <div className="flex items-center gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em]" style={{ color: GREEN }}>Messages</p>
        <LiveStatus />
      </div>
      <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Chat moderation</h1>
      <p className="mt-1.5 text-sm text-white/55">Read, edit, delete or pin any message — post as admin or block a pair. Changes hit the users&apos; real chats instantly.</p>

      {/* KPI grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Conversations" value={data.total} accent="#38bdf8" icon={<MessageSquare className="h-4 w-4" />} />
        <Tile label="Total messages" value={data.messages} accent="#22ff88" />
        <Tile label="Active today" value={data.activeToday} accent="#fbbf24" />
        <Tile label="Blocked pairs" value={data.blockedPairs} accent="#ff5d5d" icon={<Ban className="h-4 w-4" />} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Active · 7 days" value={data.active7d} accent="#34d399" small />
        <Tile label="With media" value={data.withMedia} accent="#a78bfa" small icon={<ImageIcon className="h-3.5 w-3.5" />} />
        <Tile label="Avg / chat" value={data.avgPerConv} accent="#60a5fa" small />
        <Tile label="Busiest chat" value={data.busiest} accent="#fb7185" small icon={<Flame className="h-3.5 w-3.5" />} />
      </div>

      {/* charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 lg:col-span-2">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">14-day message volume</p>
          <MiniBars data={data.trend} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Busiest conversations</p>
          <div className="space-y-2">
            {data.topConversations.map((c) => (
              <Link key={c.id} href={`/admin/messages/${c.id}`} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-2.5 py-2 transition hover:border-[#22ff88]/40">
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white">@{c.a} <span className="text-white/30">↔</span> @{c.b}</span>
                <span className="font-mono text-xs" style={{ color: GREEN }}>{c.count}</span>
              </Link>
            ))}
            {data.topConversations.length === 0 && <p className="py-6 text-center text-xs text-white/40">No chats yet.</p>}
          </div>
        </div>
      </div>

      {/* search + filters */}
      <div className="sticky top-[64px] z-20 mt-6 space-y-2 rounded-2xl border border-white/10 bg-[#070a10]/90 p-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 shrink-0 text-white/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by participant or message…" className="w-full bg-transparent py-1 text-sm text-white outline-none placeholder:text-white/35" />
          {q && <button onClick={() => setQ("")} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={scope === "all"} onClick={() => setScope("all")}>All ({data.total})</Chip>
          <Chip active={scope === "active"} color="#fbbf24" onClick={() => setScope("active")}>Active today ({data.activeToday})</Chip>
          <Chip active={scope === "blocked"} color="#ff5d5d" onClick={() => setScope("blocked")}>Blocked ({data.blockedPairs})</Chip>
          <span className="mx-1 h-6 w-px bg-white/10" />
          <Chip active={sort === "recent"} onClick={() => setSort("recent")}>Recent</Chip>
          <Chip active={sort === "busiest"} onClick={() => setSort("busiest")}>Busiest</Chip>
        </div>
      </div>

      {/* list */}
      <div className="mt-4 grid gap-2.5">
        {list.length === 0 && <p className="py-16 text-center text-sm text-white/40">No conversations match.</p>}
        {list.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.015, 0.25) }}>
            <Link href={`/admin/messages/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/25 hover:bg-white/[0.05]">
              <span className="flex -space-x-2">
                <Initial name={c.a} />
                <Initial name={c.b} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-semibold text-white">
                  @{c.a} <span className="text-white/30">↔</span> @{c.b}
                  {c.blocked && <span className="rounded-full bg-[#ff5d5d]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#ff5d5d]">blocked</span>}
                </p>
                <p className="truncate font-mono text-[11px] text-white/45">{c.lastMessage || "—"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-xs text-white">{c.count} msg</p>
                <p className="font-mono text-[10px] text-white/35">{ago(c.lastAt)} ago</p>
              </div>
              <MessageSquare className="h-4 w-4 shrink-0 text-white/30" />
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Initial({ name }: { name: string }) {
  return <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#070a10] text-xs font-bold" style={{ background: `${GREEN}22`, color: GREEN }}>{name.slice(0, 1).toUpperCase()}</span>;
}

function Tile({ label, value, accent, icon, small }: { label: string; value: number; accent: string; icon?: React.ReactNode; small?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">{label}</p>
        {icon && <span style={{ color: accent }}>{icon}</span>}
      </div>
      <p className={cn("mt-1 font-black text-white", small ? "text-xl" : "text-3xl")}><CountUp value={value} /></p>
      <span className="absolute bottom-0 left-0 h-0.5 w-full" style={{ background: `linear-gradient(90deg,${accent},transparent)` }} />
    </div>
  );
}

function Chip({ active, color, onClick, children }: { active: boolean; color?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition", active ? "text-[#05080c]" : "border border-white/10 text-white/60 hover:text-white")}
      style={active ? { background: color ?? GREEN } : undefined}
    >
      {children}
    </button>
  );
}
