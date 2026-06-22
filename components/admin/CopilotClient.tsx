"use client";
/* eslint-disable @next/next/no-img-element -- data-URL previews of pasted uploads */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp, Bot, Brain, ChevronDown, ImagePlus, Plus, Sparkles, Terminal, X, Zap,
} from "lucide-react";
import { Markdown } from "@/components/ai/Markdown";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";
import type { CopilotAction } from "@/app/api/admin/copilot/route";

/* same palette as the Full Control terminal */
type Tone = "ok" | "err" | "warn" | "info" | "muted" | "accent" | "out";
const TONE_COLOR: Record<Tone, string> = {
  ok: "#22ff88", err: "#ff5d5d", warn: "#fbbf24", info: "#38bdf8",
  muted: "rgba(255,255,255,0.45)", accent: "#a78bfa", out: "#dfe7ef",
};
const GREEN = "#22ff88";

type Model = "flash" | "pro";
type Thinking = "standard" | "extended";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
  actions?: CopilotAction[];
}

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const SUGGESTIONS = [
  "Забань всех, у кого в нике есть sudays",
  "Создай промокод -30% на часы на 7 дней",
  "Топ-5 продавцов и сегодняшняя выручка",
  "Сколько товаров без остатка? Скрой их все",
];

const STORAGE = "oasis_copilot_thread_v1";

export function CopilotClient({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [model, setModel] = useState<Model>("flash");
  const [think, setThink] = useState<Thinking>("standard");
  const [menu, setMenu] = useState<null | "plus" | "model" | "think">(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const name = profile.fullName?.split(" ")[0] || profile.username;
  const empty = messages.length === 0;

  /* lock the page — the whole window must NOT scroll; only the chat lane scrolls inside */
  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const prevHtml = html.style.overflow, prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => { html.style.overflow = prevHtml; body.style.overflow = prevBody; };
  }, []);

  /* persist the thread locally so a refresh keeps context */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE}_${profile.id}`);
      if (raw) setMessages(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [profile.id]);
  useEffect(() => {
    try { localStorage.setItem(`${STORAGE}_${profile.id}`, JSON.stringify(messages.slice(-40))); } catch { /* ignore */ }
  }, [messages, profile.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const grow = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, []);
  useEffect(grow, [input, grow]);

  /* paste screenshots / images straight from the clipboard (Ctrl+V) */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.items ?? [])
        .filter((i) => i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter(Boolean) as File[];
      if (!files.length) return;
      e.preventDefault();
      files.forEach((f) => {
        const r = new FileReader();
        r.onload = () => setImages((m) => (m.length < 4 ? [...m, r.result as string] : m));
        r.readAsDataURL(f);
      });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const streamIn = useCallback((id: string, full: string) =>
    new Promise<void>((resolve) => {
      const setContent = (content: string) => setMessages((m) => m.map((x) => (x.id === id ? { ...x, content } : x)));
      let i = 0;
      const step = () => {
        i += Math.max(2, Math.round(full.length / 70));
        setContent(full.slice(0, i));
        if (i < full.length) setTimeout(step, 14);
        else { setContent(full); resolve(); }
      };
      step();
    }), []);

  const send = useCallback(async (text: string, imgs: string[]) => {
    const q = text.trim();
    if ((!q && imgs.length === 0) || busy) return;
    const userMsg: Msg = { id: uid(), role: "user", content: q, images: imgs };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setImages([]);
    setBusy(true);
    const phases = think === "extended"
      ? ["Рассуждаю глубже…", "Анализирую запрос…", "Подбираю команды…", "Выполняю в системе…", "Свожу результат…"]
      : ["Думаю…", "Подбираю команды…", "Выполняю в системе…", "Свожу результат…"];
    setPhase(phases[0]!);
    let pi = 0;
    const ticker = setInterval(() => { pi = (pi + 1) % phases.length; setPhase(phases[pi]!); }, 1400);
    try {
      const payload = next.slice(-16).map((m) => ({ role: m.role, content: m.content, images: m.images }));
      const res = await fetch("/api/admin/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload, model, thinking: think }),
      });
      const data = await res.json();
      clearInterval(ticker);
      setBusy(false);
      if (!res.ok) throw new Error(data.error || "Ошибка");
      const aiId = uid();
      const actions: CopilotAction[] = data.actions ?? [];
      setMessages((p) => [...p, { id: aiId, role: "assistant", content: "", actions }]);
      await streamIn(aiId, data.reply || "…");
      if (actions.length) router.refresh();
    } catch (e) {
      clearInterval(ticker);
      setBusy(false);
      setMessages((p) => [...p, { id: uid(), role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Что-то пошло не так."}` }]);
    }
  }, [busy, messages, model, think, router, streamIn]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setMenu(null);
    Array.from(files).slice(0, 4 - images.length).forEach((f) => {
      if (!f.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => setImages((p) => (p.length >= 4 ? p : [...p, reader.result as string]));
      reader.readAsDataURL(f);
    });
  };

  const canSend = (input.trim().length > 0 || images.length > 0) && !busy;

  return (
    <div className="relative isolate -mb-24 flex h-[calc(100dvh-5.6rem)] w-full flex-col">
      {/* ambient backdrop (kept — the pretty part) */}
      <CopilotBackdrop active={busy} />

      {/* slim header — no card, no border box */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#22ff88]/25 to-[#38bdf8]/15" style={{ color: GREEN }}>
            <Bot className="h-[18px] w-[18px]" />
            <motion.span className="absolute -inset-1 rounded-2xl border" style={{ borderColor: "rgba(34,255,136,0.18)" }} animate={{ opacity: [0.2, 0.6, 0.2], scale: [1, 1.06, 1] }} transition={{ duration: 2.4, repeat: Infinity }} />
          </span>
          <div>
            <p className="flex items-center gap-2 text-[15px] font-black tracking-tight text-white">
              OASIS COPILOT
              <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest" style={{ background: "rgba(34,255,136,0.15)", color: GREEN }}>root</span>
            </p>
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
              <motion.span className="h-1.5 w-1.5 rounded-full" style={{ background: GREEN }} animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
              живая система · естественный язык
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); try { localStorage.removeItem(`${STORAGE}_${profile.id}`); } catch { /* ignore */ } }}
            className="font-mono text-[10px] uppercase tracking-wider text-fg-muted transition hover:text-danger"
          >
            New chat
          </button>
        )}
      </div>

      {/* conversation — plain Gemini flow, AI answers have NO borders/bubbles, scrollbar hidden */}
      <div ref={scrollRef} className="no-scrollbar relative flex-1 overflow-y-auto">
        {empty ? (
          <div className="grid h-full place-items-center text-center">
            <div className="max-w-xl px-4">
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#22ff88]/20 to-[#38bdf8]/10" style={{ color: GREEN }}>
                <Sparkles className="h-8 w-8" />
              </motion.div>
              <h2 className="mt-5 text-3xl font-black text-white">Привет, {name} 👑</h2>
              <p className="mt-2.5 text-[15px] text-fg-muted">
                Я понимаю обычный язык и управляю всей платформой за тебя — баны, промокоды, статистика, рассылки, инвентарь.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s, [])} className="glass rounded-full px-4 py-2 text-sm text-fg-muted transition hover:text-white hover:neon-border">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-6xl space-y-7 px-2 pb-4 sm:px-4">
            {messages.map((m) =>
              m.role === "user" ? (
                <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                  <div className="max-w-[78%] rounded-2xl rounded-br-md bg-[var(--panel)] px-4 py-3 text-[15px] text-white">
                    {m.images && m.images.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {m.images.map((src, i) => <img key={i} src={src} alt="" className="max-h-44 rounded-xl object-cover" />)}
                      </div>
                    )}
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3.5 text-[16px] leading-relaxed text-fg">
                  {m.content && <Markdown content={m.content} />}
                  {m.actions && m.actions.length > 0 && <ActionLog actions={m.actions} />}
                </motion.div>
              ),
            )}
            {busy && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5 text-fg-muted">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: GREEN }} animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                ))}
                <span className="font-mono text-[13px]">{phase}</span>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* composer */}
      <div className="mx-auto mt-3 w-full max-w-6xl px-2 sm:px-4">
        <AnimatePresence>
          {images.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-2 flex gap-2">
              {images.map((src, i) => (
                <div key={i} className="relative h-14 w-14 overflow-hidden rounded-lg">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => setImages((p) => p.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="field rounded-3xl px-3 py-2.5">
          <form onSubmit={(e) => { e.preventDefault(); send(input, images); }} className="flex items-end gap-1.5">
            {/* "+" tools menu */}
            <div className="relative">
              <button type="button" onClick={() => setMenu((x) => (x === "plus" ? null : "plus"))} aria-label="Инструменты" className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl transition", menu === "plus" ? "neon-border text-white" : "text-fg-muted hover:text-white")}>
                <Plus className={cn("h-5 w-5 transition-transform", menu === "plus" && "rotate-45")} />
              </button>
              <AnimatePresence>
                {menu === "plus" && (
                  <>
                    <button aria-label="close" onClick={() => setMenu(null)} className="fixed inset-0 z-40 cursor-default" />
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }} className="popover absolute bottom-12 left-0 z-50 w-60 rounded-2xl p-1.5">
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-[var(--panel)]">
                        <ImagePlus className="h-4 w-4" style={{ color: GREEN }} /> Прикрепить фото
                        <input type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
                      </label>
                      <div className="my-1 border-t border-[var(--panel-border)]" />
                      <p className="px-3 pb-1 pt-1 font-mono text-[10px] uppercase tracking-wider text-fg-muted">Thinking</p>
                      <button type="button" onClick={() => { setThink("standard"); setMenu(null); }} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-[var(--panel)]", think === "standard" && "text-white")}>
                        <Zap className="h-4 w-4" style={{ color: think === "standard" ? GREEN : undefined }} />
                        <span><span className="block font-medium">Standard</span><span className="block text-[11px] text-fg-muted">Быстрые, краткие ответы</span></span>
                      </button>
                      <button type="button" onClick={() => { setThink("extended"); setMenu(null); }} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-[var(--panel)]", think === "extended" && "text-white")}>
                        <Brain className="h-4 w-4" style={{ color: think === "extended" ? GREEN : undefined }} />
                        <span><span className="block font-medium">Extended</span><span className="block text-[11px] text-fg-muted">Рассуждает глубже и подробнее</span></span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <textarea
              ref={taRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input, images); } }}
              placeholder="Скажи Copilot, что сделать… (Shift+Enter — новая строка)"
              className="no-scrollbar max-h-[180px] w-full resize-none bg-transparent px-1.5 py-2 text-[15px] text-white outline-none placeholder:text-fg-muted"
            />
            <button type="submit" disabled={!canSend} aria-label="Отправить" className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl transition", canSend ? "text-[#05080c] hover:brightness-110" : "bg-[var(--panel)] text-fg-muted/50")} style={canSend ? { background: GREEN } : undefined}>
              <ArrowUp className="h-[18px] w-[18px]" />
            </button>
          </form>

          {/* model + thinking selectors */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-t border-[var(--panel-border)] pt-2">
            <div className="relative">
              <button onClick={() => setMenu((x) => (x === "model" ? null : "model"))} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-fg-muted transition hover:text-white">
                {model === "pro" ? <Sparkles className="h-3.5 w-3.5" style={{ color: GREEN }} /> : <Zap className="h-3.5 w-3.5" />}
                {model === "pro" ? "Copilot Pro" : "Copilot Flash"}<ChevronDown className="h-3 w-3" />
              </button>
              <AnimatePresence>
                {menu === "model" && (
                  <>
                    <button aria-label="close" onClick={() => setMenu(null)} className="fixed inset-0 z-40 cursor-default" />
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="popover absolute bottom-9 left-0 z-50 w-60 rounded-2xl p-1.5">
                      <button onClick={() => { setModel("flash"); setMenu(null); }} className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-[var(--panel)]", model === "flash" && "text-white")}>
                        <Zap className="h-4 w-4" style={{ color: model === "flash" ? GREEN : undefined }} /><span><span className="block text-sm font-medium">Copilot Flash</span><span className="block text-[11px] text-fg-muted">Быстрый · мгновенные действия</span></span>
                      </button>
                      <button onClick={() => { setModel("pro"); setMenu(null); }} className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-[var(--panel)]", model === "pro" && "text-white")}>
                        <Sparkles className="h-4 w-4" style={{ color: model === "pro" ? GREEN : undefined }} /><span><span className="block text-sm font-medium">Copilot Pro</span><span className="block text-[11px] text-fg-muted">Умнее · сложные планы</span></span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <span className="h-4 w-px bg-[var(--panel-border)]" />
            <div className="relative">
              <button onClick={() => setMenu((x) => (x === "think" ? null : "think"))} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-fg-muted transition hover:text-white">
                <Brain className="h-3.5 w-3.5" />{think === "extended" ? "Extended" : "Standard"}<ChevronDown className="h-3 w-3" />
              </button>
              <AnimatePresence>
                {menu === "think" && (
                  <>
                    <button aria-label="close" onClick={() => setMenu(null)} className="fixed inset-0 z-40 cursor-default" />
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="popover absolute bottom-9 left-0 z-50 w-64 rounded-2xl p-1.5">
                      <button onClick={() => { setThink("standard"); setMenu(null); }} className={cn("w-full rounded-xl px-3 py-2 text-left transition hover:bg-[var(--panel)]", think === "standard" && "text-white")}>
                        <span className="block text-sm font-medium">Standard</span><span className="block text-[11px] text-fg-muted">Быстрые, краткие ответы</span>
                      </button>
                      <button onClick={() => { setThink("extended"); setMenu(null); }} className={cn("w-full rounded-xl px-3 py-2 text-left transition hover:bg-[var(--panel)]", think === "extended" && "text-white")}>
                        <span className="block text-sm font-medium">Extended</span><span className="block text-[11px] text-fg-muted">Рассуждает глубже и подробнее</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-fg-muted">
          Copilot выполняет команды по-настоящему в живой базе. Операторы-админы защищены от любых санкций.
        </p>
      </div>
    </div>
  );
}

/* ---- executed-command cards (terminal look — deliberately framed) ---- */
function ActionLog({ actions }: { actions: CopilotAction[] }) {
  const okCount = actions.filter((a) => !a.lines.some((l) => l.tone === "err")).length;
  const failCount = actions.length - okCount;
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-[#04060a]">
      <div className="flex items-center gap-2 border-b border-[var(--panel-border)] bg-[#070b11] px-3.5 py-2.5">
        <Terminal className="h-4 w-4" style={{ color: GREEN }} />
        <span className="font-mono text-[12px] text-fg-muted">
          выполнено {actions.length} {actions.length === 1 ? "команда" : "команд"}
        </span>
        <span className="ml-auto flex items-center gap-2 font-mono text-[11px]">
          <span style={{ color: GREEN }}>✓ {okCount}</span>
          {failCount > 0 && <span style={{ color: "#ff5d5d" }}>✗ {failCount}</span>}
        </span>
      </div>
      <div className="no-scrollbar max-h-80 space-y-2 overflow-y-auto p-3.5">
        {actions.map((a, i) => (
          <div key={i}>
            <div className="font-mono text-[12.5px] text-[#dfe7ef]">
              <span style={{ color: GREEN }}>oasis@copilot</span>
              <span className="text-fg-muted">:~$ </span>
              {a.command}
            </div>
            {a.lines.map((l, j) => (
              <div key={j} className="whitespace-pre-wrap break-words pl-2 font-mono text-[12.5px] leading-relaxed" style={{ color: TONE_COLOR[l.tone as Tone] ?? TONE_COLOR.out }}>
                {l.text}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- ambient grid + scan backdrop (fixed, behind everything) -------- */
function CopilotBackdrop({ active }: { active: boolean }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      animate={{ opacity: active ? [0.5, 0.85, 0.5] : 0.5 }}
      transition={{ duration: 2.4, repeat: active ? Infinity : 0 }}
    >
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,255,136,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,255,136,0.04) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="absolute -left-1/4 top-0 h-72 w-[150%] bg-[radial-gradient(ellipse_at_center,rgba(34,255,136,0.07),transparent_60%)]" />
      <motion.div
        className="absolute inset-x-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(34,255,136,0.3), transparent)" }}
        animate={{ top: ["-5%", "105%"] }}
        transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
      />
    </motion.div>
  );
}
