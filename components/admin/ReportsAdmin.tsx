"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import { Flag, ShieldAlert } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchReports, updateReportStatus, type ReportRecord, type ReportStatus } from "@/lib/data/reports";
import { Avatar } from "@/components/profile/Avatar";
import { cn } from "@/lib/utils";

const STATUSES: ReportStatus[] = ["open", "reviewing", "resolved", "dismissed"];
const STATUS_STYLE: Record<ReportStatus, string> = {
  open: "bg-danger/15 text-danger",
  reviewing: "bg-accent/15 text-accent",
  resolved: "bg-success/15 text-success",
  dismissed: "bg-[var(--panel)] text-fg-muted",
};

export function ReportsAdmin({ initial }: { initial: ReportRecord[] }) {
  const sb = getBrowserClient();
  const [reports, setReports] = useState<ReportRecord[]>(initial);

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
    try {
      await updateReportStatus(sb, id, status);
    } catch {
      toast.error("Couldn’t update status");
      void fetchReports(sb).then(setReports).catch(() => {});
    }
  };

  const openCount = reports.filter((r) => r.status === "open").length;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-danger/10 text-danger">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-black">Reports</h1>
          <p className="text-sm text-fg-muted">{openCount} open · {reports.length} total</p>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-3xl border border-[var(--panel-border)] py-20 text-center">
          <Flag className="h-8 w-8 text-fg-muted/50" />
          <p className="text-sm text-fg-muted">No reports yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="card rounded-2xl p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Link href={`/profile/${r.reporter.id}`} className="flex items-center gap-1.5 hover:text-accent">
                    <Avatar src={r.reporter.avatarUrl} name={r.reporter.username} size={28} />
                    <span className="truncate text-sm font-semibold">@{r.reporter.username}</span>
                  </Link>
                  <span className="text-xs text-fg-muted">reported</span>
                  <Link href={`/profile/${r.reported.id}`} className="flex items-center gap-1.5 hover:text-danger">
                    <Avatar src={r.reported.avatarUrl} name={r.reported.username} size={28} />
                    <span className="truncate text-sm font-semibold">@{r.reported.username}</span>
                  </Link>
                </div>
                <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", STATUS_STYLE[r.status])}>
                  {r.status}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--panel-border)] px-2.5 py-1 text-xs font-medium capitalize">{r.category}</span>
                <span className="font-mono text-[10px] text-fg-muted">{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
                {r.conversationId && (
                  <Link href={`/messages/${r.reported.id}`} className="font-mono text-[10px] uppercase tracking-wider text-accent hover:underline">
                    open chat →
                  </Link>
                )}
              </div>

              {r.description && (
                <p className="mt-2 rounded-xl bg-[var(--panel)] px-3 py-2 text-sm text-fg-muted">{r.description}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void setStatus(r.id, s)}
                    disabled={r.status === s}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition",
                      r.status === s
                        ? "cursor-default bg-accent/15 text-accent"
                        : "border border-[var(--panel-border)] text-fg-muted hover:border-accent/50 hover:text-fg",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
