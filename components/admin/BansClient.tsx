"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  AlertTriangle, Ban, Boxes, Clock, Flag, Gavel, Hand, Search, Shield, ShieldOff,
  Slash, Trash2, X,
} from "lucide-react";
import { CountUp, GREEN, LiveStatus } from "./charts";
import { Select } from "./Select";
import { parseTerm, humanizeMs } from "@/lib/admin/commands";
import type { AdminBans, BannedUser, RestrictedUser, PurchaseBlock, SanctionedProduct, ViolationRow, ReportRow } from "@/lib/data/admin-bans";
import {
  createBan, liftBan, createRestriction, liftRestriction, createPurchaseBlock, liftPurchaseBlock,
  liftSanction, deleteViolation, setReportStatus, type ActionResult,
} from "@/app/(admin)/admin/bans/actions";

type ProductFlag = "hidden" | "frozen" | "no_reviews" | "no_orders";
type RestrictKind = "chat" | "sell" | "buy" | "review" | "report" | "favorite" | "cart";

const KIND_COLOR: Record<string, string> = { chat: "#38bdf8", sell: "#fbbf24", buy: "#ef4444", review: "#a78bfa", report: "#f472b6", favorite: "#34d399", cart: "#22d3ee" };
const FLAG_COLOR: Record<string, string> = { hidden: "#94a3b8", frozen: "#38bdf8", no_reviews: "#a78bfa", no_orders: "#fbbf24" };
const SCOPE_COLOR: Record<string, string> = { brand: "#fbbf24", category: "#38bdf8", color: "#a78bfa", tag: "#34d399" };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const untilLabel = (iso: string | null, perm: boolean) => (perm ? "permanent" : iso ? `until ${fmt(iso)}` : "permanent");

const TABS = [
  { id: "banned", label: "Bans", Icon: Ban, color: "#ef4444" },
  { id: "restricted", label: "Restrictions", Icon: ShieldOff, color: "#fbbf24" },
  { id: "blocks", label: "Purchase blocks", Icon: Slash, color: "#a78bfa" },
  { id: "products", label: "Product sanctions", Icon: Boxes, color: "#38bdf8" },
  { id: "violations", label: "Violations", Icon: Gavel, color: "#f472b6" },
  { id: "reports", label: "Reports", Icon: Flag, color: "#34d399" },
] as const;
type TabId = (typeof TABS)[number]["id"];

type Modal =
  | { type: "newban" }
  | { type: "newrestrict" }
  | { type: "newblock" }
  | { type: "confirm"; title: string; body: string; okLabel: string; danger?: boolean; run: () => Promise<ActionResult> }
  | { type: "violation"; v: ViolationRow }
  | { type: "report"; r: ReportRow }
  | null;

export function BansClient({ data }: { data: AdminBans }) {
  const router = useRouter();
  const s = data.summary;
  const [tab, setTab] = useState<TabId>("banned");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [busy, start] = useTransition();

  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) { toast.success(r.msg ?? "Done."); router.refresh(); after?.(); }
      else toast.error(r.error);
    });

  const needle = q.trim().toLowerCase();
  const f = <T,>(arr: T[], txt: (x: T) => string) => (needle ? arr.filter((x) => txt(x).toLowerCase().includes(needle)) : arr);

  const banned = f(data.banned, (b) => `${b.username} ${b.reason ?? ""}`);
  const restricted = f(data.restricted, (r) => `${r.username} ${r.kinds.map((k) => k.kind).join(" ")}`);
  const blocks = f(data.blocks, (b) => `${b.username} ${b.scopeType} ${b.scopeValue}`);
  const products = f(data.products, (p) => `${p.title} ${p.brand} ${p.sellerName}`);
  const violations = f(data.violations, (v) => `${v.offender} ${v.category} ${v.detail} ${v.subjectLabel}`);
  const reports = f(data.reports, (r) => `${r.reported} ${r.reporter} ${r.category} ${r.description}`);

  const counts: Record<TabId, number> = { banned: data.banned.length, restricted: data.restricted.length, blocks: data.blocks.length, products: data.products.length, violations: data.violations.length, reports: data.reports.length };

  return (
    <div className="mx-auto max-w-6xl pb-16">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3"><p className="font-mono text-[11px] uppercase tracking-[0.35em]" style={{ color: GREEN }}>Black List</p><LiveStatus /></div>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Bans & restrictions</h1>
          <p className="mt-1.5 text-sm text-white/55">Every sanction on the grid — bans, ability restrictions, scoped purchase blocks, product freezes, the violation ledger and open reports.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HeaderBtn onClick={() => setModal({ type: "newban" })} color="#ef4444" Icon={Ban}>New ban</HeaderBtn>
          <HeaderBtn onClick={() => setModal({ type: "newrestrict" })} color="#fbbf24" Icon={ShieldOff}>Restrict</HeaderBtn>
          <HeaderBtn onClick={() => setModal({ type: "newblock" })} color="#a78bfa" Icon={Slash}>Block purchase</HeaderBtn>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Banned" value={s.banned} sub={`${s.timedBans} timed`} accent="#ef4444" Icon={Ban} />
        <Tile label="Restricted" value={s.restricted} sub={`${s.restrictions} rules`} accent="#fbbf24" Icon={ShieldOff} />
        <Tile label="Buy blocks" value={s.blocks} accent="#a78bfa" Icon={Slash} />
        <Tile label="Products" value={s.products} accent="#38bdf8" Icon={Boxes} />
        <Tile label="Violations" value={s.violations} accent="#f472b6" Icon={Gavel} />
        <Tile label="Open reports" value={s.openReports} accent="#34d399" Icon={Flag} />
      </div>

      {/* tabs */}
      <div className="no-scrollbar mt-6 flex gap-1.5 overflow-x-auto border-b border-white/10 pb-px">
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => { setTab(t.id); setQ(""); }} className="relative flex items-center gap-2 whitespace-nowrap rounded-t-lg px-3.5 py-2.5 text-sm font-semibold transition" style={{ color: on ? t.color : "rgba(255,255,255,0.5)" }}>
              <t.Icon className="h-4 w-4" /> {t.label}
              <span className="rounded-full px-1.5 text-[10px]" style={{ background: `${on ? t.color : "#ffffff"}1f`, color: on ? t.color : "rgba(255,255,255,0.5)" }}>{counts[t.id]}</span>
              {on && <motion.span layoutId="bl-underline" className="absolute -bottom-px left-0 h-0.5 w-full" style={{ background: t.color }} />}
            </button>
          );
        })}
      </div>

      {/* search */}
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3">
        <Search className="h-4 w-4 text-white/40" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${tab}…`} className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-white/35" />
        {q && <button onClick={() => setQ("")} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>}
      </div>

      {/* content */}
      <div className="mt-4">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="grid gap-2.5">
            {tab === "banned" && <BannedList rows={banned} busy={busy} onLift={(b) => setModal({ type: "confirm", title: `Lift ban on @${b.username}?`, body: "The account will be reinstated immediately and notified.", okLabel: "Lift ban", run: () => liftBan(b.id) })} />}
            {tab === "restricted" && <RestrictedList rows={restricted} onLift={(u, k) => run(() => liftRestriction(u.id, k))} />}
            {tab === "blocks" && <BlocksList rows={blocks} onLift={(b) => setModal({ type: "confirm", title: `Lift purchase block?`, body: `@${b.username} will be able to buy ${b.scopeType} “${b.scopeValue}” again.`, okLabel: "Lift block", run: () => liftPurchaseBlock(b.id) })} />}
            {tab === "products" && <ProductsList rows={products} onLift={(p, fl) => run(() => liftSanction(p.id, fl))} />}
            {tab === "violations" && <ViolationsList rows={violations} onOpen={(v) => setModal({ type: "violation", v })} />}
            {tab === "reports" && <ReportsList rows={reports} onOpen={(r) => setModal({ type: "report", r })} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* modals */}
      <AnimatePresence>
        {modal && (
          <Overlay onClose={() => setModal(null)}>
            {modal.type === "newban" && <NewBanModal busy={busy} onClose={() => setModal(null)} onSubmit={(id, reason, ms) => run(() => createBan(id, reason, ms), () => setModal(null))} />}
            {modal.type === "newrestrict" && <NewRestrictModal busy={busy} onClose={() => setModal(null)} onSubmit={(id, kind, ms) => run(() => createRestriction(id, kind, ms), () => setModal(null))} />}
            {modal.type === "newblock" && <NewBlockModal busy={busy} onClose={() => setModal(null)} onSubmit={(id, st, sv, ms) => run(() => createPurchaseBlock(id, st, sv, ms), () => setModal(null))} />}
            {modal.type === "confirm" && <ConfirmModal busy={busy} {...modal} onClose={() => setModal(null)} onConfirm={() => run(modal.run, () => setModal(null))} />}
            {modal.type === "violation" && <ViolationModal v={modal.v} busy={busy} onClose={() => setModal(null)} onDelete={() => run(() => deleteViolation(modal.v.id), () => setModal(null))} />}
            {modal.type === "report" && <ReportModal r={modal.r} busy={busy} onClose={() => setModal(null)} onStatus={(st) => run(() => setReportStatus(modal.r.id, st), () => setModal(null))} onBan={() => setModal({ type: "newban" })} />}
          </Overlay>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ===================== LISTS ======================================== */
function Empty({ icon: Icon, text }: { icon: typeof Ban; text: string }) {
  return <div className="flex flex-col items-center gap-2 py-16 text-white/35"><Icon className="h-8 w-8" /><p className="text-sm">{text}</p></div>;
}

function BannedList({ rows, onLift, busy }: { rows: BannedUser[]; onLift: (b: BannedUser) => void; busy: boolean }) {
  if (!rows.length) return <Empty icon={Ban} text="No active bans." />;
  return <>{rows.map((b, i) => (
    <Row key={b.id} i={i} accent="#ef4444">
      <Avatar url={b.avatarUrl} name={b.username} />
      <div className="min-w-0 flex-1">
        <Link href={`/admin/users/${b.id}`} className="truncate font-semibold text-white hover:underline">@{b.username}</Link>
        <p className="truncate text-[12px] text-white/50">{b.reason || "No reason given"}</p>
      </div>
      <div className="hidden text-right sm:block">
        <Pill color={b.perm ? "#ef4444" : "#fbbf24"}>{b.perm ? "permanent" : "timed"}</Pill>
        <p className="mt-1 font-mono text-[10px] text-white/40">{b.perm ? `since ${fmtDate(b.bannedAt)}` : untilLabel(b.until, false)}</p>
      </div>
      <ActionBtn color="#22c55e" disabled={busy} onClick={() => onLift(b)} Icon={Hand}>Lift</ActionBtn>
    </Row>
  ))}</>;
}

function RestrictedList({ rows, onLift }: { rows: RestrictedUser[]; onLift: (u: RestrictedUser, k: RestrictKind) => void }) {
  if (!rows.length) return <Empty icon={ShieldOff} text="No active restrictions." />;
  return <>{rows.map((u, i) => (
    <Row key={u.id} i={i} accent="#fbbf24">
      <Avatar url={u.avatarUrl} name={u.username} />
      <div className="min-w-0 flex-1">
        <Link href={`/admin/users/${u.id}`} className="truncate font-semibold text-white hover:underline">@{u.username}</Link>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {u.kinds.map((k) => (
            <button key={k.kind} onClick={() => onLift(u, k.kind as RestrictKind)} title={`lift ${k.kind} · ${untilLabel(k.until, k.perm)}`}
              className="group inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] transition hover:brightness-125" style={{ background: `${KIND_COLOR[k.kind]}1f`, color: KIND_COLOR[k.kind] }}>
              {k.kind}{!k.perm && <Clock className="h-2.5 w-2.5" />}<X className="h-2.5 w-2.5 opacity-0 transition group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </div>
      <span className="font-mono text-[10px] text-white/35">click a chip to lift</span>
    </Row>
  ))}</>;
}

function BlocksList({ rows, onLift }: { rows: PurchaseBlock[]; onLift: (b: PurchaseBlock) => void }) {
  if (!rows.length) return <Empty icon={Slash} text="No scoped purchase blocks." />;
  return <>{rows.map((b, i) => (
    <Row key={b.id} i={i} accent={SCOPE_COLOR[b.scopeType] ?? "#a78bfa"}>
      <Avatar url={b.avatarUrl} name={b.username} />
      <div className="min-w-0 flex-1">
        <Link href={`/admin/users/${b.userId}`} className="truncate font-semibold text-white hover:underline">@{b.username}</Link>
        <p className="truncate text-[12px] text-white/50">can&apos;t buy <span style={{ color: SCOPE_COLOR[b.scopeType] }}>{b.scopeType}:{b.scopeValue}</span></p>
      </div>
      <div className="hidden text-right sm:block"><p className="font-mono text-[10px] text-white/40">{untilLabel(b.until, b.perm)}</p></div>
      <ActionBtn color="#22c55e" onClick={() => onLift(b)} Icon={Hand}>Lift</ActionBtn>
    </Row>
  ))}</>;
}

function ProductsList({ rows, onLift }: { rows: SanctionedProduct[]; onLift: (p: SanctionedProduct, f: ProductFlag) => void }) {
  if (!rows.length) return <Empty icon={Boxes} text="No sanctioned products." />;
  return <>{rows.map((p, i) => (
    <Row key={p.id} i={i} accent="#38bdf8">
      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white/5">{p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : <Boxes className="m-3 h-5 w-5 text-white/30" />}</span>
      <div className="min-w-0 flex-1">
        <Link href={`/admin/products/${p.id}`} className="truncate font-semibold text-white hover:underline">{p.brand} · {p.title}</Link>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {p.flags.map((fl) => (
            <button key={fl.kind} onClick={() => onLift(p, fl.kind as ProductFlag)} title={`lift ${fl.kind} · ${untilLabel(fl.until, fl.perm)}`}
              className="group inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] transition hover:brightness-125" style={{ background: `${FLAG_COLOR[fl.kind]}1f`, color: FLAG_COLOR[fl.kind] }}>
              {fl.kind.replace("_", " ")}{!fl.perm && <Clock className="h-2.5 w-2.5" />}<X className="h-2.5 w-2.5 opacity-0 transition group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </div>
      <span className="hidden font-mono text-[10px] text-white/35 sm:block">@{p.sellerName}</span>
    </Row>
  ))}</>;
}

function ViolationsList({ rows, onOpen }: { rows: ViolationRow[]; onOpen: (v: ViolationRow) => void }) {
  if (!rows.length) return <Empty icon={Gavel} text="No violations logged." />;
  return <>{rows.map((v, i) => (
    <Row key={v.id} i={i} accent="#f472b6" onClick={() => onOpen(v)}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg" style={{ background: `${sevColor(v.severity)}1f`, color: sevColor(v.severity) }}><Gavel className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-white">@{v.offender} <span className="font-normal text-white/45">· {v.category} · sev {v.severity}</span></p>
        <p className="truncate text-[12px] text-white/50">{v.detail || v.subjectLabel}</p>
      </div>
      <div className="hidden text-right sm:block"><Pill color={sevColor(v.severity)}>{v.actionLabel || v.action}</Pill><p className="mt-1 font-mono text-[10px] text-white/40">{fmtDate(v.createdAt)}</p></div>
    </Row>
  ))}</>;
}

function ReportsList({ rows, onOpen }: { rows: ReportRow[]; onOpen: (r: ReportRow) => void }) {
  if (!rows.length) return <Empty icon={Flag} text="No open reports." />;
  return <>{rows.map((r, i) => (
    <Row key={r.id} i={i} accent="#34d399" onClick={() => onOpen(r)}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg" style={{ background: "#34d3991f", color: "#34d399" }}><Flag className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-white">@{r.reported} <span className="font-normal text-white/45">· {r.category}</span></p>
        <p className="truncate text-[12px] text-white/50">{r.description || "—"} <span className="text-white/35">— by @{r.reporter}</span></p>
      </div>
      <div className="hidden text-right sm:block"><Pill color={r.status === "open" ? "#fbbf24" : "#38bdf8"}>{r.status}</Pill><p className="mt-1 font-mono text-[10px] text-white/40">{fmtDate(r.createdAt)}</p></div>
    </Row>
  ))}</>;
}

const sevColor = (n: number) => (n >= 4 ? "#ef4444" : n >= 3 ? "#fbbf24" : "#38bdf8");

/* ===================== MODALS ====================================== */
function NewBanModal({ onClose, onSubmit, busy }: { onClose: () => void; onSubmit: (id: string, reason: string, ms?: number) => void; busy: boolean }) {
  const [id, setId] = useState(""); const [reason, setReason] = useState(""); const [term, setTerm] = useState("");
  const ms = termMs(term);
  return (
    <Card title="Ban an account" Icon={Ban} color="#ef4444" onClose={onClose}>
      <Field label="User"><TextInput value={id} onChange={setId} placeholder="@username or id" /></Field>
      <Field label="Reason"><TextInput value={reason} onChange={setReason} placeholder="why are they banned" /></Field>
      <Field label="Duration"><TermInput term={term} setTerm={setTerm} /></Field>
      <ModalActions>
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-white/60 hover:text-white">Cancel</button>
        <SubmitBtn disabled={!id.trim() || busy} color="#ef4444" onClick={() => onSubmit(id.trim(), reason.trim(), ms)}>{term.trim() ? `Ban ${humanizeOr(ms)}` : "Ban permanently"}</SubmitBtn>
      </ModalActions>
    </Card>
  );
}

const RKINDS = ["chat", "sell", "buy", "review", "report", "favorite", "cart"];
function NewRestrictModal({ onClose, onSubmit, busy }: { onClose: () => void; onSubmit: (id: string, kind: RestrictKind, ms?: number) => void; busy: boolean }) {
  const [id, setId] = useState(""); const [kind, setKind] = useState<RestrictKind>("chat"); const [term, setTerm] = useState("");
  return (
    <Card title="Restrict an ability" Icon={ShieldOff} color="#fbbf24" onClose={onClose}>
      <Field label="User"><TextInput value={id} onChange={setId} placeholder="@username or id" /></Field>
      <Field label="Ability"><Select value={kind} onChange={(v) => setKind(v as RestrictKind)} options={RKINDS.map((k) => ({ value: k, label: k }))} Icon={Shield} className="w-full" align="left" /></Field>
      <Field label="Duration"><TermInput term={term} setTerm={setTerm} /></Field>
      <ModalActions>
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-white/60 hover:text-white">Cancel</button>
        <SubmitBtn disabled={!id.trim() || busy} color="#fbbf24" onClick={() => onSubmit(id.trim(), kind, termMs(term))}>Apply restriction</SubmitBtn>
      </ModalActions>
    </Card>
  );
}

const SCOPES = ["brand", "category", "color", "tag"];
function NewBlockModal({ onClose, onSubmit, busy }: { onClose: () => void; onSubmit: (id: string, st: string, sv: string, ms?: number) => void; busy: boolean }) {
  const [id, setId] = useState(""); const [scope, setScope] = useState("brand"); const [val, setVal] = useState(""); const [term, setTerm] = useState("");
  return (
    <Card title="Block a purchase scope" Icon={Slash} color="#a78bfa" onClose={onClose}>
      <Field label="User"><TextInput value={id} onChange={setId} placeholder="@username or id" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Scope"><Select value={scope} onChange={setScope} options={SCOPES.map((k) => ({ value: k, label: k }))} className="w-full" align="left" /></Field>
        <Field label="Value"><TextInput value={val} onChange={setVal} placeholder="e.g. Dior" /></Field>
      </div>
      <Field label="Duration"><TermInput term={term} setTerm={setTerm} /></Field>
      <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/45">DB-enforced at checkout — they physically can&apos;t buy this {scope}.</p>
      <ModalActions>
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-white/60 hover:text-white">Cancel</button>
        <SubmitBtn disabled={!id.trim() || !val.trim() || busy} color="#a78bfa" onClick={() => onSubmit(id.trim(), scope, val.trim(), termMs(term))}>Block purchase</SubmitBtn>
      </ModalActions>
    </Card>
  );
}

function ConfirmModal({ title, body, okLabel, danger, onClose, onConfirm, busy }: { title: string; body: string; okLabel: string; danger?: boolean; onClose: () => void; onConfirm: () => void; busy: boolean }) {
  return (
    <Card title={title} Icon={danger ? AlertTriangle : Hand} color={danger ? "#ef4444" : "#22c55e"} onClose={onClose}>
      <p className="text-sm text-white/65">{body}</p>
      <ModalActions>
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-white/60 hover:text-white">Cancel</button>
        <SubmitBtn disabled={busy} color={danger ? "#ef4444" : "#22c55e"} onClick={onConfirm}>{okLabel}</SubmitBtn>
      </ModalActions>
    </Card>
  );
}

function ViolationModal({ v, onClose, onDelete, busy }: { v: ViolationRow; onClose: () => void; onDelete: () => void; busy: boolean }) {
  return (
    <Card title="Violation record" Icon={Gavel} color={sevColor(v.severity)} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Info label="Offender" value={`@${v.offender}`} />
        <Info label="Subject" value={`${v.subjectType} · ${v.subjectLabel}`} />
        <Info label="Category" value={v.category} />
        <Info label="Severity" value={`${v.severity}/5`} />
        <Info label="Action" value={v.actionLabel || v.action} />
        <Info label="Until" value={fmt(v.actionUntil)} />
      </div>
      {v.detail && <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white/70">{v.detail}</p>}
      <p className="mt-2 font-mono text-[10px] text-white/35">Logged {fmt(v.createdAt)}</p>
      <ModalActions>
        {v.offenderId && <Link href={`/admin/users/${v.offenderId}`} className="rounded-lg px-4 py-2 text-sm text-white/60 hover:text-white">Open dossier</Link>}
        <SubmitBtn disabled={busy} color="#ef4444" onClick={onDelete}><Trash2 className="h-4 w-4" /> Delete case</SubmitBtn>
      </ModalActions>
    </Card>
  );
}

function ReportModal({ r, onClose, onStatus, onBan, busy }: { r: ReportRow; onClose: () => void; onStatus: (s: string) => void; onBan: () => void; busy: boolean }) {
  return (
    <Card title="Abuse report" Icon={Flag} color="#34d399" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Info label="Reported" value={`@${r.reported}`} link={`/admin/users/${r.reportedId}`} />
        <Info label="By" value={`@${r.reporter}`} link={`/admin/users/${r.reporterId}`} />
        <Info label="Category" value={r.category} />
        <Info label="Status" value={r.status} />
      </div>
      {r.description && <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white/70">{r.description}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip color="#38bdf8" disabled={busy} onClick={() => onStatus("reviewing")}>Mark reviewing</Chip>
        <Chip color="#22c55e" disabled={busy} onClick={() => onStatus("resolved")}>Resolve</Chip>
        <Chip color="#94a3b8" disabled={busy} onClick={() => onStatus("dismissed")}>Dismiss</Chip>
        <Chip color="#ef4444" disabled={busy} onClick={onBan}>Ban reported →</Chip>
      </div>
    </Card>
  );
}

/* ===================== PRIMITIVES ================================== */
function Tile({ label, value, sub, accent, Icon }: { label: string; value: number; sub?: string; accent: string; Icon: typeof Ban }) {
  return (
    <motion.div whileHover={{ y: -3 }} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <div className="flex items-center justify-between"><p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">{label}</p><Icon className="h-3.5 w-3.5" style={{ color: accent }} /></div>
      <p className="mt-1 text-2xl font-black text-white"><CountUp value={value} /></p>
      {sub && <p className="font-mono text-[10px] text-white/40">{sub}</p>}
      <span className="absolute bottom-0 left-0 h-0.5 w-full" style={{ background: `linear-gradient(90deg,${accent},transparent)` }} />
    </motion.div>
  );
}

function Row({ children, i, accent, onClick }: { children: React.ReactNode; i: number; accent: string; onClick?: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.015, 0.3) }}
      onClick={onClick} className={`group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/25 hover:bg-white/[0.05] ${onClick ? "cursor-pointer" : ""}`}>
      <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: accent }} />
      {children}
    </motion.div>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  return <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 text-sm font-bold text-white/70">{url ? <img src={url} alt="" className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}</span>;
}
function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase" style={{ background: `${color}1f`, color }}>{children}</span>;
}
function ActionBtn({ children, color, onClick, Icon, disabled }: { children: React.ReactNode; color: string; onClick: () => void; Icon: typeof Ban; disabled?: boolean }) {
  return <button disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick(); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition hover:brightness-125 disabled:opacity-40" style={{ borderColor: `${color}55`, color, background: `${color}12` }}><Icon className="h-3.5 w-3.5" />{children}</button>;
}
function HeaderBtn({ children, color, onClick, Icon }: { children: React.ReactNode; color: string; onClick: () => void; Icon: typeof Ban }) {
  return <button onClick={onClick} className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-bold transition hover:brightness-125" style={{ borderColor: `${color}55`, color, background: `${color}12` }}><Icon className="h-4 w-4" />{children}</button>;
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm" />
      <div className="fixed inset-0 z-[81] grid place-items-center p-4" onClick={onClose}>
        <motion.div initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }} transition={{ type: "spring", damping: 26, stiffness: 320 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
          {children}
        </motion.div>
      </div>
    </>
  );
}
function Card({ title, Icon, color, onClose, children }: { title: string; Icon: typeof Ban; color: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-[#080b11] shadow-2xl" style={{ borderColor: `${color}44`, boxShadow: `0 0 60px ${color}22` }}>
      <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: `${color}22`, background: `${color}10` }}>
        <div className="flex items-center gap-2.5 font-bold text-white"><span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${color}1f`, color }}><Icon className="h-4 w-4" /></span>{title}</div>
        <button onClick={onClose} className="text-white/40 transition hover:text-white"><X className="h-5 w-5" /></button>
      </div>
      <div className="space-y-3 p-5">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-white/40">{label}</p>{children}</div>;
}
function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/30 placeholder:text-white/30" />;
}
function TermInput({ term, setTerm }: { term: string; setTerm: (v: string) => void }) {
  const ms = termMs(term);
  const valid = term.trim() === "" || ms !== undefined || /^(perm|forever|навсегда)/i.test(term.trim());
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="forever · 7d · 2h · a date" className="min-w-[140px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 placeholder:text-white/30" />
        {["1h", "24h", "7d", "30d", "forever"].map((p) => <button key={p} onClick={() => setTerm(p === "forever" ? "" : p)} className="rounded-md border border-white/10 px-2 py-1 font-mono text-[11px] text-white/50 transition hover:border-white/30 hover:text-white">{p}</button>)}
      </div>
      <p className="mt-1 font-mono text-[10px]" style={{ color: valid ? "rgba(255,255,255,0.4)" : "#ef4444" }}>
        {!valid ? "can't read that term" : ms ? `→ lifts ${liftAt(ms)}` : "→ permanent"}
      </p>
    </div>
  );
}
function ModalActions({ children }: { children: React.ReactNode }) { return <div className="flex items-center justify-end gap-2 pt-1">{children}</div>; }
function SubmitBtn({ children, color, onClick, disabled }: { children: React.ReactNode; color: string; onClick: () => void; disabled?: boolean }) {
  return <button disabled={disabled} onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40" style={{ background: color }}>{children}</button>;
}
function Chip({ children, color, onClick, disabled }: { children: React.ReactNode; color: string; onClick: () => void; disabled?: boolean }) {
  return <button disabled={disabled} onClick={onClick} className="rounded-lg border px-3 py-1.5 text-xs font-bold transition hover:brightness-125 disabled:opacity-40" style={{ borderColor: `${color}55`, color, background: `${color}12` }}>{children}</button>;
}
function Info({ label, value, link }: { label: string; value: string; link?: string }) {
  return <div><p className="font-mono text-[9px] uppercase tracking-wider text-white/35">{label}</p>{link ? <Link href={link} className="text-white hover:underline">{value}</Link> : <p className="truncate text-white">{value}</p>}</div>;
}

/* ---- term helpers ---- */
function termMs(term: string): number | undefined { const p = parseTerm(term); return p?.ms; }
function humanizeOr(ms?: number): string { return ms ? humanizeMs(ms) : "permanently"; }
function liftAt(ms: number): string { return new Date(Date.now() + ms).toLocaleString("en-GB"); }
