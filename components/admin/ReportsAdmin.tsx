"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import {
  Ban, Flag, Gavel, MessageSquare, Search, ShieldAlert, ShieldCheck, UserCog, X,
} from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import {
  fetchReports, updateReportStatus, REPORT_CATEGORIES,
  type ReportRecord, type ReportStatus,
} from "@/lib/data/reports";
import { adminBanUser } from "@/app/(admin)/admin/users/[id]/actions";
import { Avatar } from "@/components/profile/Avatar";
import { CountUp, Donut, HBars, LiveStatus, MiniBars, GREEN } from "./charts";
import { cn } from "@/lib/utils";

const STATUSES: ReportStatus[] = ["open", "reviewing", "resolved", "dismissed"];
const STATUS_COLOR: Record<ReportStatus, string> = {
  open: "#ff5d5d", reviewing: "#38bdf8", resolved: "#22ff88", dismissed: "#8aa0b8",
};
const CAT_LABEL = Object.fromEntries(REPORT_CATEGORIES.map((c) => [c.key, c.label])) as Record<string, string>;
const DAY = 86_400_000;

function ago(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ""; }
}

export function ReportsAdmin({ initial }: { initial: ReportRecord[] }) {
  const sb = getBrowserClient();
  const [reports, setReports] = useState<ReportRecord[]>(initial);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  // live: new reports appear without a refresh
  useEffect(() => {
    const ch = sb
      .channel("admin:reports")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => {
        void fetchReports(sb).then(setReports).catch(() => {});
      })
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [sb]);

  const setStatus = async (id: string, status: ReportStatus) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    try { await updateReportStatus(sb, id, status); }
    catch { toast.error("Couldn’t update status"); void fetchReports(sb).then(setReports).catch(() => {}); }
  };

  const setManyStatus = async (ids: string[], status: ReportStatus) => {
    if (!ids.length) return;
    setReports((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, status } : r)));
    await Promise.allSettled(ids.map((id) => updateReportStatus(sb, id, status)));
    toast.success(`${ids.length} → ${status}`);
  };

  const banReported = async (r: ReportRecord, durationMs?: number) => {
    setBusy(r.id);
    try {
      const res = await adminBanUser(r.reported.id, `Report: ${CAT_LABEL[r.category] ?? r.category}`, durationMs);
      if (res.ok) { toast.success(`@${r.reported.username} banned`); void setStatus(r.id, "resolved"); }
      else toast.error(res.error);
    } finally { setBusy(null); }
  };

  /* ---- derived analytics ------------------------------------------- */
  const stats = useMemo(() => {
    const byStatus: Record<string, number> = { open: 0, reviewing: 0, resolved: 0, dismissed: 0 };
    const byCat = new Map<string, number>();
    const byReported = new Map<string, { user: ReportRecord["reported"]; n: number; open: number }>();
    const byReporter = new Map<string, { user: ReportRecord["reporter"]; n: number }>();
    let today = 0, week = 0;
    const days: number[] = Array(14).fill(0);
    const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);

    for (const r of reports) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      byCat.set(r.category, (byCat.get(r.category) ?? 0) + 1);
      const tg = byReported.get(r.reported.id) ?? { user: r.reported, n: 0, open: 0 };
      tg.n++; if (r.status === "open" || r.status === "reviewing") tg.open++;
      byReported.set(r.reported.id, tg);
      const rp = byReporter.get(r.reporter.id) ?? { user: r.reporter, n: 0 };
      rp.n++; byReporter.set(r.reporter.id, rp);
      const t = new Date(r.createdAt).getTime();
      if (t >= startToday.getTime()) today++;
      if (t >= now - 7 * DAY) week++;
      const idx = 13 - Math.floor((startToday.getTime() - new Date(t).setHours(0, 0, 0, 0)) / DAY);
      if (idx >= 0 && idx < 14) days[idx]++;
    }
    const trend = days.map((value, i) => ({ label: `${13 - i}d`, value }));
    const catBars = REPORT_CATEGORIES
      .map((c) => ({ label: c.label, value: byCat.get(c.key) ?? 0 }))
      .filter((b) => b.value > 0)
      .sort((a, b) => b.value - a.value);
    const offenders = [...byReported.values()].filter((o) => o.n > 1).sort((a, b) => b.n - a.n).slice(0, 6);
    const topReporters = [...byReporter.values()].sort((a, b) => b.n - a.n).slice(0, 5);
    const donut = STATUSES.map((s) => ({ label: s, value: byStatus[s] ?? 0, color: STATUS_COLOR[s] }));
    const resolved = (byStatus.resolved ?? 0) + (byStatus.dismissed ?? 0);
    const resolutionRate = reports.length ? Math.round((resolved / reports.length) * 100) : 0;
    return { byStatus, trend, catBars, offenders, topReporters, donut, today, week, resolutionRate };
  }, [reports, now]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return reports.filter((r) =>
      (statusFilter === "all" || r.status === statusFilter) &&
      (catFilter === "all" || r.category === catFilter) &&
      (!n || `${r.reporter.username} ${r.reported.username} ${r.description} ${r.category}`.toLowerCase().includes(n)),
    );
  }, [reports, statusFilter, catFilter, q]);

  const openIds = reports.filter((r) => r.status === "open").map((r) => r.id);

  return (
    <div>
      {/* header */}
      <div className="flex items-center gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em]" style={{ color: GREEN }}>Reports</p>
        <LiveStatus />
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white">Abuse & moderation</h1>
          <p className="mt-1.5 text-sm text-white/55">Triage every report, spot repeat offenders, and act — ban, resolve or open the chat — without leaving the page.</p>
        </div>
        {openIds.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => void setManyStatus(openIds, "reviewing")} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:border-[#38bdf8]/50">
              Review all ({openIds.length})
            </button>
            <button onClick={() => void setManyStatus(openIds, "dismissed")} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:border-white/30">
              Dismiss all
            </button>
          </div>
        )}
      </div>

      {/* KPI tiles */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Open" value={stats.byStatus.open ?? 0} accent="#ff5d5d" icon={<ShieldAlert className="h-4 w-4" />} />
        <Tile label="Reviewing" value={stats.byStatus.reviewing ?? 0} accent="#38bdf8" icon={<UserCog className="h-4 w-4" />} />
        <Tile label="Resolved" value={stats.byStatus.resolved ?? 0} accent="#22ff88" icon={<ShieldCheck className="h-4 w-4" />} />
        <Tile label="Total" value={reports.length} accent="#a78bfa" icon={<Flag className="h-4 w-4" />} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Today" value={stats.today} accent="#fbbf24" small />
        <Tile label="Last 7 days" value={stats.week} accent="#34d399" small />
        <Tile label="Repeat offenders" value={stats.offenders.length} accent="#fb7185" small />
        <Tile label="Resolution rate" value={stats.resolutionRate} suffix="%" accent="#22ff88" small />
      </div>

      {/* charts */}
      {reports.length > 0 && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Panel title="14-day trend" className="lg:col-span-2">
            <MiniBars data={stats.trend} />
          </Panel>
          <Panel title="By status">
            <div className="grid place-items-center py-1"><Donut data={stats.donut} size={150} /></div>
          </Panel>
          {stats.catBars.length > 0 && (
            <Panel title="By category" className="lg:col-span-2">
              <HBars data={stats.catBars} />
            </Panel>
          )}
          <Panel title="Repeat offenders">
            {stats.offenders.length === 0 ? (
              <p className="py-6 text-center text-xs text-white/40">No repeat offenders 🎉</p>
            ) : (
              <div className="space-y-2">
                {stats.offenders.map((o) => (
                  <Link key={o.user.id} href={`/admin/users/${o.user.id}`} className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-2.5 py-2 transition hover:border-[#ff5d5d]/40">
                    <Avatar src={o.user.avatarUrl} name={o.user.username} size={28} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">@{o.user.username}</span>
                    {o.open > 0 && <span className="rounded-full bg-[#ff5d5d]/15 px-2 py-0.5 text-[10px] font-bold text-[#ff5d5d]">{o.open} open</span>}
                    <span className="font-mono text-xs text-white/55">{o.n}×</span>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* filters */}
      <div className="sticky top-[64px] z-20 mt-6 space-y-2 rounded-2xl border border-white/10 bg-[#070a10]/90 p-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 shrink-0 text-white/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reporter, reported, reason…" className="w-full bg-transparent py-1 text-sm text-white outline-none placeholder:text-white/35" />
          {q && <button onClick={() => setQ("")} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>All ({reports.length})</Chip>
          {STATUSES.map((s) => (
            <Chip key={s} active={statusFilter === s} color={STATUS_COLOR[s]} onClick={() => setStatusFilter(s)}>
              {s} ({stats.byStatus[s] ?? 0})
            </Chip>
          ))}
          <span className="mx-1 h-6 w-px bg-white/10" />
          <Chip active={catFilter === "all"} onClick={() => setCatFilter("all")}>All types</Chip>
          {REPORT_CATEGORIES.filter((c) => stats.catBars.some((b) => b.label === c.label)).map((c) => (
            <Chip key={c.key} active={catFilter === c.key} onClick={() => setCatFilter(c.key)}>{c.label}</Chip>
          ))}
        </div>
      </div>

      {/* list */}
      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="grid place-items-center gap-2 rounded-3xl border border-white/10 py-20 text-center">
            <Flag className="h-8 w-8 text-white/30" />
            <p className="text-sm text-white/45">{reports.length === 0 ? "No reports yet." : "Nothing matches these filters."}</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((r) => (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Link href={`/profile/${r.reporter.id}`} className="flex items-center gap-1.5 text-white hover:text-[#38bdf8]">
                      <Avatar src={r.reporter.avatarUrl} name={r.reporter.username} size={28} />
                      <span className="truncate text-sm font-semibold">@{r.reporter.username}</span>
                    </Link>
                    <span className="text-xs text-white/40">reported</span>
                    <Link href={`/admin/users/${r.reported.id}`} className="flex items-center gap-1.5 text-white hover:text-[#ff5d5d]">
                      <Avatar src={r.reported.avatarUrl} name={r.reported.username} size={28} />
                      <span className="truncate text-sm font-semibold">@{r.reported.username}</span>
                    </Link>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: `${STATUS_COLOR[r.status]}22`, color: STATUS_COLOR[r.status] }}>
                    {r.status}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-medium text-white/80">{CAT_LABEL[r.category] ?? r.category}</span>
                  <span className="font-mono text-[10px] text-white/40">{ago(r.createdAt)}</span>
                  {r.conversationId && (
                    <Link href={`/admin/messages/${r.conversationId}`} className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[#38bdf8] hover:underline">
                      <MessageSquare className="h-3 w-3" /> open chat →
                    </Link>
                  )}
                </div>

                {r.description && (
                  <p className="mt-2 rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-white/70">{r.description}</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void setStatus(r.id, s)}
                      disabled={r.status === s}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition",
                        r.status === s ? "cursor-default" : "border border-white/10 text-white/60 hover:text-white",
                      )}
                      style={r.status === s ? { background: `${STATUS_COLOR[s]}22`, color: STATUS_COLOR[s] } : undefined}
                    >
                      {s}
                    </button>
                  ))}
                  <span className="mx-1 h-5 w-px bg-white/10" />
                  <button onClick={() => void banReported(r, 7 * DAY)} disabled={busy === r.id} className="flex items-center gap-1.5 rounded-lg border border-[#fbbf24]/30 px-3 py-1.5 text-xs font-semibold text-[#fbbf24] transition hover:bg-[#fbbf24]/10 disabled:opacity-40">
                    <Gavel className="h-3.5 w-3.5" /> Ban 7d
                  </button>
                  <button onClick={() => void banReported(r)} disabled={busy === r.id} className="flex items-center gap-1.5 rounded-lg border border-[#ff5d5d]/30 px-3 py-1.5 text-xs font-semibold text-[#ff5d5d] transition hover:bg-[#ff5d5d]/10 disabled:opacity-40">
                    <Ban className="h-3.5 w-3.5" /> Ban forever
                  </button>
                  <Link href={`/admin/users/${r.reported.id}`} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:text-white">
                    <UserCog className="h-3.5 w-3.5" /> Dossier
                  </Link>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

/* ---- small presentational helpers -------------------------------- */
function Tile({ label, value, accent, icon, suffix, small }: { label: string; value: number; accent: string; icon?: React.ReactNode; suffix?: string; small?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">{label}</p>
        {icon && <span style={{ color: accent }}>{icon}</span>}
      </div>
      <p className={cn("mt-1 font-black text-white", small ? "text-xl" : "text-3xl")}>
        <CountUp value={value} />{suffix}
      </p>
      <span className="absolute bottom-0 left-0 h-0.5 w-full" style={{ background: `linear-gradient(90deg,${accent},transparent)` }} />
    </div>
  );
}

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/[0.02] p-4", className)}>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">{title}</p>
      {children}
    </div>
  );
}

function Chip({ active, color, onClick, children }: { active: boolean; color?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn("rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition", active ? "text-[#05080c]" : "border border-white/10 text-white/60 hover:text-white")}
      style={active ? { background: color ?? GREEN } : undefined}
    >
      {children}
    </button>
  );
}
