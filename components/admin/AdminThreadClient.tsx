"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  ArrowLeft, Ban, Check, Gavel, ImagePlus, Loader2, Pencil, Pin, PinOff,
  Search, Send, ShieldCheck, Smile, Trash2, UserCog, X,
} from "lucide-react";
import { GREEN } from "./charts";
import { MediaPanel } from "@/components/messages/MediaPanel";
import { getBrowserClient } from "@/lib/supabase/client";
import { mediaKind } from "@/lib/media-kind";
import {
  adminDeleteMessage, adminEditMessage, adminSendMessage, adminToggleBlock, adminTogglePin,
} from "@/app/(admin)/admin/messages/actions";
import { adminBanUser } from "@/app/(admin)/admin/users/[id]/actions";
import type { AdminThread, AdminThreadMsg } from "@/lib/data/admin-messages";

const DAY = 86_400_000;
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
function stamp(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function AdminThreadClient({ t, me }: { t: AdminThread; me: { id: string; username: string } }) {
  const sb = getBrowserClient();
  const [messages, setMessages] = useState<AdminThreadMsg[]>(t.messages);
  const [blocked, setBlocked] = useState(t.blocked);
  const [pinnedIds, setPinnedIds] = useState<string[]>(t.pinnedIds);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const [panel, setPanel] = useState(false);
  const [q, setQ] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [banMenu, setBanMenu] = useState<null | "a" | "b">(null);
  const laneRef = useRef<HTMLDivElement>(null);

  const nameOf = useCallback((id: string) =>
    id === t.aId ? t.a : id === t.bId ? t.b : id === me.id ? me.username : "admin", [t.aId, t.bId, t.a, t.b, me.id, me.username]);

  /* live: new / edited / deleted messages stream in without a refresh */
  useEffect(() => {
    const ch = sb.channel(`admin:thread:${t.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${t.id}` }, (p) => {
        const r = p.new as { id: string; sender_id: string; text: string; attachments: string[] | null; created_at: string; kind: string };
        setMessages((prev) => {
          if (prev.some((m) => m.id === r.id)) return prev;
          const cleaned = prev.filter((m) => !(m.id.startsWith("temp-") && m.senderId === r.sender_id && m.text === r.text));
          return [...cleaned, { id: r.id, senderId: r.sender_id, sender: nameOf(r.sender_id), text: r.text, attachments: r.attachments ?? [], createdAt: r.created_at, kind: r.kind, pinned: false }];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${t.id}` }, (p) => {
        const r = p.new as { id: string; text: string };
        setMessages((prev) => prev.map((m) => (m.id === r.id ? { ...m, text: r.text } : m)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${t.id}` }, (p) => {
        const r = p.old as { id: string };
        setMessages((prev) => prev.filter((m) => m.id !== r.id));
      })
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [sb, t.id, nameOf]);

  useEffect(() => { laneRef.current?.scrollTo({ top: laneRef.current.scrollHeight, behavior: "smooth" }); }, [messages.length]);

  /* ---- derived stats ----------------------------------------------- */
  const stats = useMemo(() => {
    let aN = 0, bN = 0, adminN = 0, media = 0;
    for (const m of messages) {
      if (m.senderId === t.aId) aN++;
      else if (m.senderId === t.bId) bN++;
      else adminN++;
      if (m.attachments.length) media++;
    }
    const first = messages[0]?.createdAt;
    return { aN, bN, adminN, media, first };
  }, [messages, t.aId, t.bId]);

  const pinned = useMemo(() => messages.filter((m) => pinnedIds.includes(m.id)), [messages, pinnedIds]);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? messages.filter((m) => `${m.sender} ${m.text}`.toLowerCase().includes(n)) : messages;
  }, [messages, q]);

  /* ---- mutations (optimistic) -------------------------------------- */
  const toggleBlock = async () => {
    const nextBlocked = !blocked;
    setBlocked(nextBlocked);
    const r = await adminToggleBlock(t.id);
    if (!r.ok) { setBlocked(!nextBlocked); toast.error(r.error); }
    else toast.success(nextBlocked ? "Pair blocked" : "Pair unblocked");
  };

  const togglePin = async (m: AdminThreadMsg) => {
    const willPin = !pinnedIds.includes(m.id);
    setPinnedIds((p) => (willPin ? [...p, m.id] : p.filter((x) => x !== m.id)));
    const r = await adminTogglePin(t.id, m.id);
    if (!r.ok) { setPinnedIds((p) => (willPin ? p.filter((x) => x !== m.id) : [...p, m.id])); toast.error(r.error); }
  };

  const del = async (m: AdminThreadMsg) => {
    const snapshot = messages;
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    setPinnedIds((p) => p.filter((x) => x !== m.id));
    const r = await adminDeleteMessage(t.id, m.id);
    if (!r.ok) { setMessages(snapshot); toast.error(r.error); } else toast.success("Deleted");
  };

  const saveEdit = async (m: AdminThreadMsg) => {
    const text = editText;
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, text } : x)));
    setEditing(null);
    const r = await adminEditMessage(t.id, m.id, text);
    if (!r.ok) toast.error(r.error); else toast.success("Edited");
  };

  const post = useCallback(async (text: string, attachments: string[] = []) => {
    const clean = text.trim();
    if (!clean && attachments.length === 0) return;
    const tempId = `temp-${uid()}`;
    setMessages((prev) => [...prev, { id: tempId, senderId: me.id, sender: me.username, text: clean, attachments, createdAt: new Date().toISOString(), kind: "normal", pinned: false }]);
    setBusy(true);
    const r = await adminSendMessage(t.id, clean, attachments);
    setBusy(false);
    if (!r.ok) { setMessages((prev) => prev.filter((m) => m.id !== tempId)); toast.error(r.error); }
  }, [me.id, me.username, t.id]);

  const send = () => {
    if (!draft.trim() && pending.length === 0) return;
    const text = draft, atts = pending;
    setDraft(""); setPending([]); setPanel(false);
    void post(text, atts);
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 6 - pending.length).forEach((f) => {
      if (!f.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => setPending((p) => (p.length >= 6 ? p : [...p, reader.result as string]));
      reader.readAsDataURL(f);
    });
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const imgs = Array.from(e.clipboardData.items).filter((i) => i.type.startsWith("image/"));
    if (!imgs.length) return;
    e.preventDefault();
    imgs.forEach((it) => { const f = it.getAsFile(); if (f) { const r = new FileReader(); r.onload = () => setPending((p) => (p.length >= 6 ? p : [...p, r.result as string])); r.readAsDataURL(f); } });
  };

  const banParticipant = async (which: "a" | "b", durationMs?: number) => {
    setBanMenu(null);
    const id = which === "a" ? t.aId : t.bId;
    const name = which === "a" ? t.a : t.b;
    const r = await adminBanUser(id, "Banned from chat moderation", durationMs);
    if (r.ok) toast.success(`@${name} banned ${durationMs ? "7d" : "forever"}`); else toast.error(r.error);
  };

  const jumpTo = (id: string) => document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <div className="mx-auto flex h-[calc(100dvh-5.6rem)] max-w-5xl flex-col">
      {/* top bar */}
      <div className="flex items-center justify-between gap-3">
        <Link href="/admin/messages" className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> All chats</Link>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => void toggleBlock()} disabled={busy}
          className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-wider transition"
          style={blocked ? { borderColor: "rgba(34,255,136,0.5)", color: GREEN, background: "rgba(34,255,136,0.1)" } : { borderColor: "rgba(239,68,68,0.4)", color: "#ff8080" }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={blocked ? "y" : "n"} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
              {blocked ? <Check className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
            </motion.span>
          </AnimatePresence>
          {blocked ? "Blocked — tap to unblock" : "Block pair"}
        </motion.button>
      </div>

      {/* participants + stats */}
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-3">
          <span className="flex -space-x-2">
            <Bubble name={t.a} color="#38bdf8" />
            <Bubble name={t.b} color="#a78bfa" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-white">
              <Link href={`/admin/users/${t.aId}`} className="hover:text-[#38bdf8]">@{t.a}</Link>
              <span className="text-white/30"> ↔ </span>
              <Link href={`/admin/users/${t.bId}`} className="hover:text-[#a78bfa]">@{t.b}</Link>
            </p>
            <p className="font-mono text-[11px] text-white/40">{messages.length} messages · {pinned.length} pinned · {stats.media} media{stats.first ? ` · since ${new Date(stats.first).toLocaleDateString("en-GB")}` : ""}</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider" style={{ borderColor: `${GREEN}44`, color: GREEN }}><ShieldCheck className="h-3 w-3" /> god mode</span>
        </div>

        {/* per-side counters + quick moderation */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Counter label={`@${t.a}`} value={stats.aN} color="#38bdf8" />
          <Counter label={`@${t.b}`} value={stats.bN} color="#a78bfa" />
          <Counter label="admin posts" value={stats.adminN} color={GREEN} />
          <Counter label="attachments" value={stats.media} color="#fbbf24" />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(["a", "b"] as const).map((w) => (
            <div key={w} className="relative">
              <button onClick={() => setBanMenu(banMenu === w ? null : w)} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/70 transition hover:text-white">
                <Gavel className="h-3 w-3" /> Moderate @{w === "a" ? t.a : t.b}
              </button>
              <AnimatePresence>
                {banMenu === w && (
                  <>
                    <button aria-label="close" onClick={() => setBanMenu(null)} className="fixed inset-0 z-30 cursor-default" />
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute left-0 top-full z-40 mt-1 w-44 rounded-xl border border-white/10 bg-[#0a0e16] p-1 shadow-xl">
                      <Link href={`/admin/users/${w === "a" ? t.aId : t.bId}`} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition hover:bg-white/5"><UserCog className="h-3.5 w-3.5" /> Open dossier</Link>
                      <button onClick={() => void banParticipant(w, 7 * DAY)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[#fbbf24] transition hover:bg-white/5"><Gavel className="h-3.5 w-3.5" /> Ban 7 days</button>
                      <button onClick={() => void banParticipant(w)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[#ff5d5d] transition hover:bg-white/5"><Ban className="h-3.5 w-3.5" /> Ban forever</button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2 rounded-lg border border-white/10 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-white/40" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search in chat…" className="w-32 bg-transparent text-xs text-white outline-none placeholder:text-white/35 sm:w-44" />
            {q && <button onClick={() => setQ("")}><X className="h-3 w-3 text-white/40" /></button>}
          </div>
        </div>
      </div>

      {/* pinned */}
      {pinned.length > 0 && (
        <div className="mt-2 space-y-1 rounded-xl border border-amber-400/25 bg-amber-400/5 p-2.5">
          {pinned.map((m) => (
            <button key={m.id} onClick={() => jumpTo(m.id)} className="flex w-full items-center gap-2 text-left text-xs text-white/70 transition hover:text-white">
              <Pin className="h-3 w-3 shrink-0 text-amber-400" /> <span className="truncate">@{m.sender}: {m.text || "📎 attachment"}</span>
            </button>
          ))}
        </div>
      )}

      {/* messages */}
      <div ref={laneRef} className="no-scrollbar mt-3 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-4">
        {shown.length === 0 && <p className="py-10 text-center text-sm text-white/40">{messages.length === 0 ? "No messages in this conversation." : "No messages match your search."}</p>}
        {shown.map((m) => {
          const s = m.senderId === t.aId ? "a" : m.senderId === t.bId ? "b" : "admin";
          const align = s === "a" ? "items-start" : s === "b" ? "items-end" : "items-center";
          const bg = s === "a" ? "rgba(56,189,248,0.12)" : s === "b" ? "rgba(167,139,250,0.12)" : `${GREEN}1f`;
          const bd = s === "a" ? "rgba(56,189,248,0.3)" : s === "b" ? "rgba(167,139,250,0.3)" : `${GREEN}55`;
          const isPinned = pinnedIds.includes(m.id);
          return (
            <div key={m.id} id={`msg-${m.id}`} className={`flex flex-col ${align}`}>
              <div className="group relative max-w-[78%] rounded-2xl px-3 py-2" style={{ background: bg, border: `1px solid ${bd}` }}>
                <p className="mb-0.5 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-white/45">
                  @{m.sender}{s === "admin" && <span style={{ color: GREEN }}>· admin</span>}{isPinned && <Pin className="h-2.5 w-2.5 text-amber-400" />} · {stamp(m.createdAt)}
                </p>

                {m.attachments.length > 0 && (
                  <div className="mb-1 flex flex-wrap gap-1.5">
                    {m.attachments.map((url, i) => <Attachment key={i} url={url} onOpen={() => setLightbox(url)} />)}
                  </div>
                )}

                {editing === m.id ? (
                  <div className="flex items-center gap-2">
                    <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void saveEdit(m); if (e.key === "Escape") setEditing(null); }} className="w-64 rounded-lg border border-white/20 bg-black/40 px-2 py-1 text-sm text-white outline-none" />
                    <button onClick={() => void saveEdit(m)} style={{ color: GREEN }}><Check className="h-4 w-4" /></button>
                    <button onClick={() => setEditing(null)} className="text-white/40"><X className="h-4 w-4" /></button>
                  </div>
                ) : m.text ? (
                  <p className="whitespace-pre-wrap text-sm text-white/90">{m.text}</p>
                ) : null}

                {editing !== m.id && (
                  <div className="absolute -top-3 right-2 hidden gap-1 rounded-lg border border-white/10 bg-[#0a0e16] p-0.5 shadow-lg group-hover:flex">
                    <Tool onClick={() => void togglePin(m)} title={isPinned ? "Unpin" : "Pin"}>{isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}</Tool>
                    {m.text && <Tool onClick={() => { setEditing(m.id); setEditText(m.text); }} title="Edit"><Pencil className="h-3.5 w-3.5" /></Tool>}
                    <Tool onClick={() => void del(m)} title="Delete" danger><Trash2 className="h-3.5 w-3.5" /></Tool>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* composer */}
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03]">
        {pending.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-white/10 p-2.5">
            {pending.map((src, i) => (
              <div key={i} className="relative h-14 w-14 overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button onClick={() => setPending((p) => p.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/70 text-white"><X className="h-2.5 w-2.5" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 p-2">
          <span className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-mono text-[10px] uppercase" style={{ background: `${GREEN}1f`, color: GREEN }}><ShieldCheck className="h-3.5 w-3.5" /> as admin</span>
          <button onClick={() => setPanel((p) => !p)} className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${panel ? "text-[#22ff88]" : "text-white/55 hover:text-white"}`}><Smile className="h-[18px] w-[18px]" /></button>
          <label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl text-white/55 transition hover:text-white" aria-label="Attach photo">
            <ImagePlus className="h-[18px] w-[18px]" />
            <input type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          </label>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onPaste={onPaste} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="Write into this chat as admin…" className="flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/35" />
          <motion.button whileTap={{ scale: 0.9 }} onClick={send} disabled={busy || (!draft.trim() && pending.length === 0)} className="grid h-10 w-10 place-items-center rounded-xl transition disabled:opacity-40" style={{ background: GREEN, color: "#05080c" }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </motion.button>
        </div>
        {panel && (
          <MediaPanel
            userId={me.id}
            isPaid
            onInsertEmoji={(e) => setDraft((d) => d + e)}
            onSendSticker={(e) => void post(e, [])}
            onSendGif={(url) => { void post("", [url]); setPanel(false); }}
            onPremiumBlocked={() => {}}
          />
        )}
      </div>

      {/* lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLightbox(null)} className="fixed inset-0 z-[90] grid place-items-center bg-black/85 p-6 backdrop-blur-sm">
            <button aria-label="Close" className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"><X className="h-5 w-5" /></button>
            {mediaKind(lightbox) === "video" ? (
              <video src={lightbox} controls autoPlay className="max-h-[90vh] max-w-[90vw] rounded-2xl" onClick={(e) => e.stopPropagation()} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightbox} alt="" className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Attachment({ url, onOpen }: { url: string; onOpen: () => void }) {
  const kind = mediaKind(url);
  if (kind === "video") return <video src={url} onClick={onOpen} className="max-h-44 cursor-zoom-in rounded-xl object-cover" />;
  // image / gif
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" onClick={onOpen} className="max-h-44 cursor-zoom-in rounded-xl object-cover transition hover:opacity-90" />;
}

function Bubble({ name, color }: { name: string; color: string }) {
  return <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#070a10] text-sm font-bold" style={{ background: `${color}22`, color }}>{name.slice(0, 1).toUpperCase()}</span>;
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-2.5 py-2">
      <p className="truncate font-mono text-[9px] uppercase tracking-wider text-white/40">{label}</p>
      <p className="text-lg font-black" style={{ color }}>{value}</p>
    </div>
  );
}

function Tool({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return <button onClick={onClick} title={title} className={`grid h-7 w-7 place-items-center rounded transition ${danger ? "text-red-400 hover:bg-red-500/20" : "text-white/60 hover:bg-white/10 hover:text-white"}`}>{children}</button>;
}
