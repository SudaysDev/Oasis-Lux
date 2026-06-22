"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { AlertTriangle, Ban, EyeOff, Gavel, Loader2, MessageSquareOff, ShieldAlert, Trash2 } from "lucide-react";
import { Select } from "./Select";
import { GREEN } from "./charts";
import { adminDeleteViolation, adminFileViolation } from "@/app/(admin)/admin/moderation/actions";
import { PRODUCT_CATEGORIES, USER_CATEGORIES, type ModSubject, type ViolationCategory } from "@/lib/moderation/policy";

export type ViolationRow = {
  id: string; category: string; severity: number; detail: string; evidence: string | null;
  action: string; actionLabel: string; actionUntil: string | null; createdAt: string;
};

const ACTION_COLOR: Record<string, string> = {
  warn: "#fbbf24", mute_chat: "#fb7185", mute_review: "#fb7185", block_sell: "#fb7185",
  ban: "#ef4444", hide_product: "#fbbf24", delete_product: "#ef4444",
};
const ACTION_ICON: Record<string, typeof Ban> = {
  warn: AlertTriangle, mute_chat: MessageSquareOff, mute_review: MessageSquareOff, block_sell: Ban,
  ban: Ban, hide_product: EyeOff, delete_product: Trash2,
};
const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const active = (until: string | null, action: string) =>
  action !== "warn" && action !== "delete_product" && (until === null || new Date(until) > new Date());

const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25";

export function ModerationPanel({ subjectType, subjectId, revalidateId, violations }: {
  subjectType: ModSubject; subjectId: string; revalidateId: string; violations: ViolationRow[];
}) {
  const router = useRouter();
  const cats = subjectType === "user" ? USER_CATEGORIES : PRODUCT_CATEGORIES;
  const [category, setCategory] = useState<ViolationCategory>(cats[0].id);
  const [severity, setSeverity] = useState(cats[0].severity);
  const [detail, setDetail] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const onCategory = (id: string) => { setCategory(id as ViolationCategory); setSeverity(cats.find((c) => c.id === id)?.severity ?? 2); };

  const file = () => {
    setBusy(true);
    startTransition(async () => {
      const r = await adminFileViolation({ subjectType, subjectId, category, severity, detail, evidence });
      setBusy(false);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(`Auto-punish → ${r.decision.label}`, { icon: "⚖️", duration: 5000 });
      setDetail(""); setEvidence("");
      router.refresh();
    });
  };

  const removeCase = (id: string) => startTransition(async () => { await adminDeleteViolation(id, revalidateId, subjectType); router.refresh(); });

  const activeCount = violations.filter((v) => active(v.actionUntil, v.action)).length;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full blur-3xl" style={{ background: "rgba(239,68,68,0.14)" }} />
      <div className="relative">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Gavel className="h-4 w-4" style={{ color: GREEN }} />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">Auto-moderation</p>
              <h2 className="mt-0.5 text-lg font-bold text-white">Violations &amp; punishments</h2>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">Cases</p>
            <p className="text-lg font-black text-white">{violations.length}{activeCount > 0 && <span className="ml-1 text-xs font-bold text-red-400">· {activeCount} active</span>}</p>
          </div>
        </div>

        {/* composer */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="grid gap-2.5 sm:grid-cols-[1fr_140px]">
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-white/45">Violation</span>
              <Select value={category} onChange={onCategory} options={cats.map((c) => ({ value: c.id, label: c.label }))} className="w-full" align="left" />
            </label>
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-white/45">Severity</span>
              <Select value={String(severity)} onChange={(v) => setSeverity(Number(v))} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} · ${["minor", "low", "medium", "high", "critical"][n - 1]}` }))} className="w-full" align="left" />
            </label>
          </div>
          <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="What happened (shown in the case log)…" className={`${inputCls} mt-2.5`} />
          <input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Evidence — link or quoted text (optional)" className={`${inputCls} mt-2`} />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 font-mono text-[10px] text-white/40"><ShieldAlert className="h-3.5 w-3.5" /> Engine escalates on repeat offences</p>
            <button onClick={file} disabled={busy} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold uppercase tracking-wider transition disabled:opacity-50" style={{ background: "rgba(239,68,68,0.16)", color: "#fca5a5", boxShadow: "inset 0 0 0 1px rgba(239,68,68,0.4)" }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />} File &amp; auto-punish
            </button>
          </div>
        </div>

        {/* history */}
        <div className="no-scrollbar mt-3 max-h-[360px] space-y-2 overflow-y-auto">
          {violations.length === 0 && <p className="py-6 text-center text-sm text-white/40">Clean record — no violations.</p>}
          {violations.map((v, i) => {
            const ac = ACTION_COLOR[v.action] ?? "#888";
            const Icon = ACTION_ICON[v.action] ?? AlertTriangle;
            const isActive = active(v.actionUntil, v.action);
            return (
              <motion.div key={v.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }}
                className="group rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>{v.category}</span>
                      <span className="flex gap-0.5">{Array.from({ length: 5 }).map((_, n) => <span key={n} className="h-1.5 w-1.5 rounded-full" style={{ background: n < v.severity ? "#ef4444" : "rgba(255,255,255,0.15)" }} />)}</span>
                      {isActive && <span className="rounded-full px-1.5 py-0.5 font-mono text-[8px] uppercase" style={{ background: `${ac}22`, color: ac }}>active</span>}
                    </div>
                    {v.detail && <p className="mt-1 text-sm text-white/80">{v.detail}</p>}
                    {v.evidence && (/^https?:\/\//.test(v.evidence)
                      ? <a href={v.evidence} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-xs text-[#38bdf8] hover:underline">{v.evidence}</a>
                      : <p className="mt-0.5 truncate text-xs italic text-white/45">“{v.evidence}”</p>)}
                    <div className="mt-1.5 flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: ac }} />
                      <span className="text-sm font-bold" style={{ color: ac }}>{v.actionLabel}</span>
                      {v.actionUntil && <span className="font-mono text-[10px] text-white/40">→ lifts {fmt(v.actionUntil)}</span>}
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-white/30">{fmt(v.createdAt)}</p>
                  </div>
                  <button onClick={() => removeCase(v.id)} title="Remove case" className="shrink-0 rounded-lg p-1.5 text-white/30 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
