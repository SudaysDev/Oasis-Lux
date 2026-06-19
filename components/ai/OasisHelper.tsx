"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ArrowUp, Bot, History, ImagePlus, MessageSquare, MessageSquarePlus, Minus, MoreHorizontal, Pin, PinOff, Sparkles, Trash2, User, X } from "lucide-react";
import { Markdown } from "./Markdown";
import { loadChats, saveChats, sortChats, titleFrom, type AiChat, type AiChatMessage } from "@/lib/ai-history";
import { AnchoredMenu, AnchoredItem } from "@/components/ui/AnchoredMenu";
import { cn } from "@/lib/utils";
import type { AiAction, Profile } from "@/types";

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const QUICK = ["Где мой профиль?", "Есть iPhone 16 до 5000 сомонӣ?", "Покажи самый популярный товар", "Как оформить заказ?"];

/** Floating, site-wide AI helper (bottom-right). Own multi-chat history, no plan. */
export function OasisHelper({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "history">("chat");
  const [chats, setChats] = useState<AiChat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [menu, setMenu] = useState<{ id: string; rect: DOMRect } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find((c) => c.id === activeId) ?? null;
  const messages = useMemo(() => activeChat?.messages ?? [], [activeChat]);

  useEffect(() => setChats(loadChats(profile.id)), [profile.id]);
  useEffect(() => {
    if (chats.length) saveChats(profile.id, chats);
  }, [chats, profile.id]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking, open]);

  const runAction = (action: AiAction | null | undefined) => {
    if (!action) return;
    if (action.kind === "navigate") setTimeout(() => router.push(action.page), 400);
    else if (action.kind === "search") setTimeout(() => router.push(`/catalog?q=${encodeURIComponent(action.query)}`), 400);
  };

  const newChat = () => { setActiveId(null); setInput(""); setPendingImages([]); setTab("chat"); };

  const send = async (text: string, imgs = pendingImages) => {
    const q = text.trim();
    if ((!q && imgs.length === 0) || thinking) return;
    const userMsg: AiChatMessage = { id: uid(), role: "user", content: q, images: imgs };
    const history = activeChat?.messages ?? [];
    const chatId = activeId ?? uid();
    const isNew = !activeId;
    setChats((prev) => {
      const base = isNew ? [{ id: chatId, title: titleFrom(q || "Фото"), messages: [], updatedAt: Date.now() }, ...prev] : prev;
      return base.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, userMsg], updatedAt: Date.now() } : c));
    });
    setActiveId(chatId);
    setInput("");
    setPendingImages([]);
    setTab("chat");
    setThinking(true);
    try {
      const payload = [...history, userMsg].map((m) => ({ role: m.role, content: m.content, images: m.images }));
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: payload }) });
      const data = await res.json();
      setThinking(false);
      if (!res.ok) throw new Error(data.error);
      const aiId = uid();
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, { id: aiId, role: "assistant", content: data.reply || "…" }], updatedAt: Date.now() } : c)));
      runAction(data.action);
    } catch (e) {
      setThinking(false);
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, { id: uid(), role: "assistant", content: e instanceof Error ? e.message : "Ошибка." }] } : c)));
    }
  };

  const addImages = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 2 - pendingImages.length).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => setPendingImages((p) => [...p, reader.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const deleteChat = (id: string) => {
    setMenu(null);
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveChats(profile.id, next);
      return next;
    });
    if (activeId === id) newChat();
  };

  const togglePin = (id: string) => {
    setMenu(null);
    setChats((prev) => {
      const next = sortChats(prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)));
      saveChats(profile.id, next);
      return next;
    });
  };

  return (
    <>
      {/* launcher */}
      <motion.button
        onClick={() => setOpen((o) => !o)}
        aria-label="Oasis Helper"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-5 right-5 z-[60] grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-[0_12px_40px_-8px_var(--accent-glow)]"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={open ? "x" : "bot"} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
            {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
          </motion.span>
        </AnimatePresence>
        {!open && <span className="ripple-ring" />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="popover fixed bottom-24 right-5 z-[60] flex h-[34rem] max-h-[80vh] w-[24rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-3xl"
          >
            {/* header */}
            <div className="flex items-center gap-3 border-b border-[var(--panel-border)] px-4 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent/30 to-accent-2/30 text-accent">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold">Oasis Helper</p>
                <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" /> AI-напарник · онлайн
                </p>
              </div>
              <button onClick={newChat} aria-label="New chat" className="grid h-8 w-8 place-items-center rounded-lg text-fg-muted transition hover:text-accent">
                <MessageSquarePlus className="h-4 w-4" />
              </button>
              <button onClick={() => setOpen(false)} aria-label="Minimize" className="grid h-8 w-8 place-items-center rounded-lg text-fg-muted transition hover:text-fg">
                <Minus className="h-4 w-4" />
              </button>
            </div>

            {/* tabs */}
            <div className="flex gap-1 px-3 pt-2">
              {([["chat", "Чат"], ["history", "История"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition", tab === k ? "neon-border text-accent" : "text-fg-muted hover:text-fg")}>
                  {k === "chat" ? <Bot className="h-3.5 w-3.5" /> : <History className="h-3.5 w-3.5" />} {label}
                </button>
              ))}
            </div>

            {/* body */}
            {tab === "history" ? (
              <div className="flex-1 overflow-y-auto p-2">
                {chats.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-fg-muted">Пока нет сохранённых чатов.</p>
                ) : (
                  chats.map((c) => {
                    const last = c.messages[c.messages.length - 1];
                    const preview = last ? `${last.role === "user" ? "You: " : ""}${last.content}` : "Empty chat";
                    return (
                      <div
                        key={c.id}
                        className="group flex w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2.5 transition hover:bg-[var(--panel)]"
                        onClick={() => { setOpen(false); router.push(`/ai?chat=${c.id}`); }}
                      >
                        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", c.pinned ? "bg-accent/15 text-accent" : "bg-[var(--panel)] text-fg-muted")}>
                          {c.pinned ? <Pin className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="flex-1 truncate text-[15px] font-semibold leading-tight">{c.title}</p>
                            <span className="shrink-0 font-mono text-[10px] text-fg-muted">
                              {formatDistanceToNow(new Date(c.updatedAt), { addSuffix: false })}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-fg-muted">{preview}</p>
                        </div>
                        <button
                          type="button"
                          aria-label="Chat options"
                          onClick={(e) => { e.stopPropagation(); setMenu({ id: c.id, rect: e.currentTarget.getBoundingClientRect() }); }}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fg-muted opacity-100 transition hover:bg-bg-elev hover:text-accent lg:opacity-0 lg:group-hover:opacity-100"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
                {messages.length === 0 ? (
                  <div className="grid h-full place-items-center text-center">
                    <div>
                      <p className="text-sm">Привет, <strong className="text-accent">{profile.fullName?.split(" ")[0] || profile.username}</strong>! Чем могу помочь?</p>
                      <div className="mt-4 flex flex-col gap-2">
                        {QUICK.map((q) => (
                          <button key={q} onClick={() => send(q)} className="glass rounded-xl px-3 py-2 text-left text-xs text-fg-muted transition hover:text-accent hover:neon-border">{q}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((m) => (
                      <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-2", m.role === "user" && "flex-row-reverse")}>
                        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", m.role === "user" ? "bg-accent-2/20 text-accent-2" : "bg-accent/15 text-accent")}>
                          {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                        </span>
                        <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-[13px]", m.role === "user" ? "bg-accent-2/15" : "card-strong")}>
                          {m.images?.map((src, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={src} alt="" className="mb-1.5 max-h-32 rounded-lg object-cover" />
                          ))}
                          {m.role === "assistant" ? <Markdown content={m.content} /> : <span className="whitespace-pre-wrap">{m.content}</span>}
                        </div>
                      </motion.div>
                    ))}
                    {thinking && (
                      <div className="flex gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent"><Bot className="h-3.5 w-3.5" /></span>
                        <div className="card-strong flex items-center gap-1.5 rounded-2xl px-3 py-2.5">
                          {[0, 1, 2].map((i) => (
                            <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-accent" animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                          ))}
                          <span className="ml-1 font-mono text-[10px] text-fg-muted">Thinking…</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* composer */}
            {tab === "chat" && (
              <div className="border-t border-[var(--panel-border)] p-2.5">
                {pendingImages.length > 0 && (
                  <div className="mb-2 flex gap-2">
                    {pendingImages.map((src, i) => (
                      <div key={i} className="relative h-12 w-12 overflow-hidden rounded-lg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-full w-full object-cover" />
                        <button onClick={() => setPendingImages((p) => p.filter((_, j) => j !== i))} className="absolute right-0 top-0 grid h-4 w-4 place-items-center rounded-full bg-black/60 text-white"><X className="h-2.5 w-2.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-1.5">
                  <label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl text-fg-muted transition hover:text-accent" aria-label="Attach">
                    <ImagePlus className="h-4 w-4" />
                    <input type="file" accept="image/*" multiple hidden onChange={(e) => addImages(e.target.files)} />
                  </label>
                  <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Спроси Oasis Helper…" className="field w-full rounded-xl px-3 py-2 text-sm outline-none" />
                  <button type="submit" disabled={thinking} aria-label="Send" className="neon-border grid h-9 w-9 shrink-0 place-items-center rounded-xl text-accent transition hover:bg-accent/10 disabled:opacity-50">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* history-item menu — minimalist, same feel as the chat message menu */}
      <AnchoredMenu open={!!menu} anchor={menu?.rect ?? null} onClose={() => setMenu(null)} width={190}>
        {menu && (() => {
          const chat = chats.find((c) => c.id === menu.id);
          return (
            <>
              <AnchoredItem
                icon={chat?.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                label={chat?.pinned ? "Unpin" : "Pin to top"}
                onClick={() => togglePin(menu.id)}
              />
              <AnchoredItem icon={<Trash2 className="h-4 w-4" />} label="Delete" danger onClick={() => deleteChat(menu.id)} />
            </>
          );
        })()}
      </AnchoredMenu>
    </>
  );
}
