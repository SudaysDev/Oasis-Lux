"use client";
/* eslint-disable @next/next/no-img-element -- data-URL previews of user uploads / AI output */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Bot, Brain, ChevronDown, Film, ImagePlus, Lock, Mic, Plus, Sparkles, Wand2, X, Zap } from "lucide-react";
import toast from "react-hot-toast";
import { Markdown } from "./Markdown";
import { ProGate } from "./ProGate";
import { isPaidPlan } from "@/lib/plans";
import { makePoster } from "@/lib/poster";
import { loadChats, saveChats, titleFrom } from "@/lib/ai-history";
import { cn } from "@/lib/utils";
import type { AiAction, Profile } from "@/types";

type Msg = { id: string; role: "user" | "assistant"; content: string; media?: string[] };
type Model = "flash" | "pro";
type Thinking = "standard" | "extended";

const SUGGESTIONS = [
  "Найди древесный парфюм до 100 сомонӣ",
  "Какие часы сейчас популярны?",
  "Сгенерируй обложку для духов",
  "Подскажи подарок другу",
];
const GEN_RE = /\b(generate|сгенерир|нарисуй|draw)/i;
const isVideo = (url: string) => url.startsWith("data:video");
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export function AiAssistant({ profile, initialChatId }: { profile: Profile; initialChatId?: string }) {
  const router = useRouter();
  const paid = isPaidPlan(profile.plan);
  const name = profile.fullName?.split(" ")[0] || `@${profile.username}`;

  // chat id for this thread — opens an existing chat from history (?chat=) or a new one.
  const [chatId, setChatId] = useState(() => initialChatId || uid());
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (typeof window === "undefined" || !initialChatId) return [];
    const ch = loadChats(profile.id).find((c) => c.id === initialChatId);
    return ch ? ch.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, media: m.images })) : [];
  });
  const [input, setInput] = useState("");
  const [media, setMedia] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [busyImage, setBusyImage] = useState(false);
  const [listening, setListening] = useState(false);
  const [model, setModel] = useState<Model>("flash");
  const [think, setThink] = useState<Thinking>("standard");
  const [genMode, setGenMode] = useState(false);
  const [menu, setMenu] = useState<null | "model" | "think" | "plus">(null);
  const [gate, setGate] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<{ stop: () => void } | null>(null);

  const canSend = (input.trim().length > 0 || media.length > 0) && !thinking && !busyImage;

  // hide ALL scrollbars while the AI page is mounted (Gemini-clean look)
  useEffect(() => {
    document.documentElement.classList.add("hide-scrollbars");
    return () => document.documentElement.classList.remove("hide-scrollbars");
  }, []);

  // mirror this thread into the shared chat history (so the Oasis Helper lists it too)
  useEffect(() => {
    if (!messages.length) return;
    const chats = loadChats(profile.id);
    const title = titleFrom(messages.find((m) => m.role === "user")?.content || "Чат");
    const entry = { id: chatId, title, messages: messages.map((m) => ({ id: m.id, role: m.role, content: m.content, images: m.media })), updatedAt: Date.now() };
    saveChats(profile.id, [entry, ...chats.filter((c) => c.id !== chatId)]);
  }, [messages, chatId, profile.id]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking, busyImage]);

  // paste screenshots / images straight from the clipboard (Ctrl+V)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.items ?? [])
        .filter((i) => i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter(Boolean) as File[];
      if (files.length) {
        e.preventDefault();
        files.forEach((f) => {
          const r = new FileReader();
          r.onload = () => setMedia((m) => (m.length < 4 ? [...m, r.result as string] : m));
          r.readAsDataURL(f);
        });
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const setMsg = (id: string, content: string) => setMessages((m) => m.map((x) => (x.id === id ? { ...x, content } : x)));
  const streamIn = (id: string, full: string) =>
    new Promise<void>((resolve) => {
      let i = 0;
      const step = () => {
        i += Math.max(2, Math.round(full.length / 70));
        setMsg(id, full.slice(0, i));
        if (i < full.length) setTimeout(step, 14);
        else resolve();
      };
      step();
    });

  const runAction = (action: AiAction | null | undefined) => {
    if (!action) return;
    if (action.kind === "navigate") setTimeout(() => router.push(action.page), 500);
    else if (action.kind === "search") setTimeout(() => router.push(`/catalog?q=${encodeURIComponent(action.query)}`), 500);
  };

  const generateImage = async (prompt: string) => {
    setMessages((m) => [...m, { id: uid(), role: "user", content: `🎨 ${prompt}` }]);
    setInput("");
    setBusyImage(true);
    try {
      const res = await fetch("/api/ai/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const data = await res.json();
      setBusyImage(false);
      if (res.ok && data.image) {
        setMessages((m) => [...m, { id: uid(), role: "assistant", content: "", media: [data.image] }]);
        return;
      }
      // free Gemini tier blocks photoreal generation → stylized local render so it still works
      if (data.quota) {
        const poster = makePoster(prompt);
        setMessages((m) => [...m, { id: uid(), role: "assistant", content: "_Стилизованный рендер (фотореализм — на платном плане Gemini)_", media: poster ? [poster] : undefined }]);
        return;
      }
      throw new Error(data.error);
    } catch {
      setBusyImage(false);
      const poster = makePoster(prompt);
      setMessages((m) => [...m, { id: uid(), role: "assistant", content: "_Стилизованный рендер_", media: poster ? [poster] : undefined }]);
    }
  };

  const send = async (text: string, atts = media) => {
    const q = text.trim();
    if ((!q && atts.length === 0) || thinking || busyImage) return;
    if (q && (genMode || GEN_RE.test(q))) {
      setGenMode(false);
      return generateImage(q.replace(GEN_RE, "").trim() || q);
    }
    const userMsg: Msg = { id: uid(), role: "user", content: q, media: atts };
    const history = messages;
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setMedia([]);
    setThinking(true);
    try {
      const payload = [...history, userMsg].map((m) => ({ role: m.role, content: m.content, images: m.media }));
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: payload, model, thinking: think }) });
      const data = await res.json();
      setThinking(false);
      if (res.status === 402) { setGate(true); return; }
      if (!res.ok) throw new Error(data.error);
      const aiId = uid();
      setMessages((m) => [...m, { id: aiId, role: "assistant", content: "" }]);
      await streamIn(aiId, data.reply || "…");
      runAction(data.action);
    } catch (e) {
      setThinking(false);
      setMessages((m) => [...m, { id: uid(), role: "assistant", content: e instanceof Error ? e.message : "Что-то пошло не так." }]);
    }
  };

  const pickModel = (m: Model) => {
    setMenu(null);
    if (m === "pro" && !paid) { setGate(true); return; }
    setModel(m);
  };

  const addFiles = (files: FileList | null, max = 4) => {
    if (!files) return;
    setMenu(null);
    Array.from(files).slice(0, max - media.length).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => setMedia((p) => [...p, reader.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const toggleVoice = () => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return toast.error("Голосовой ввод не поддерживается в этом браузере");
    if (listening) return recogRef.current?.stop();
    const r = new SR();
    r.lang = "ru-RU";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => setInput(Array.from(e.results).map((x) => x[0]!.transcript).join(""));
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r;
    setListening(true);
    r.start();
  };

  const clearThread = () => { setMessages([]); setChatId(uid()); if (initialChatId) router.replace("/ai"); };

  return (
    <div className="mx-auto flex h-[calc(100vh-8.5rem)] w-full max-w-4xl flex-col">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent/25 to-accent-2/25 text-accent"><Sparkles className="h-4 w-4" /></span>
          <span className="text-sm font-black">OASIS AI</span>
        </div>
        {messages.length > 0 && <button onClick={clearThread} className="font-mono text-[10px] uppercase tracking-wider text-fg-muted transition hover:text-danger">New chat</button>}
      </div>

      {/* conversation — plain Gemini flow, no bubbles for AI, scrollbar hidden */}
      <div ref={scrollRef} className="no-scrollbar relative flex-1 overflow-y-auto">
        <motion.div aria-hidden className="pointer-events-none fixed inset-0 -z-10 opacity-40" style={{ background: "radial-gradient(50% 40% at 30% 12%, var(--accent-glow), transparent 60%), radial-gradient(45% 45% at 82% 88%, color-mix(in oklab, var(--accent-2) 30%, transparent), transparent 60%)" }} animate={{ opacity: thinking || busyImage ? [0.35, 0.7, 0.35] : 0.35 }} transition={{ duration: 2.2, repeat: thinking || busyImage ? Infinity : 0 }} />
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center">
            <div className="text-center">
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-accent/25 to-accent-2/25 text-accent"><Bot className="h-7 w-7" /></motion.div>
              <h2 className="mt-4 bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-2xl font-black text-transparent">Привет, {name} 👋</h2>
              <p className="mt-1 text-[13px] text-fg-muted">Чем могу помочь сегодня?</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (<button key={s} onClick={() => send(s)} className="glass rounded-full px-3 py-1.5 text-xs text-fg-muted transition hover:text-accent hover:neon-border">{s}</button>))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 pb-4">
            {messages.map((m) =>
              m.role === "user" ? (
                <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--panel)] px-4 py-2.5 text-[13px]">
                    {m.media?.map((src, i) => <MediaThumb key={i} src={src} onOpen={() => setLightbox(src)} />)}
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-[14px] leading-relaxed">
                  {m.media?.map((src, i) => <MediaThumb key={i} src={src} large onOpen={() => setLightbox(src)} />)}
                  {m.content && <Markdown content={m.content} />}
                </motion.div>
              ),
            )}
            {(thinking || busyImage) && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-[13px] text-fg-muted">
                {[0, 1, 2].map((i) => (<motion.span key={i} className="h-2 w-2 rounded-full bg-accent" animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />))}
                <span className="font-mono text-[11px]">{busyImage ? "Generating image…" : think === "extended" ? "Thinking deeply…" : "Thinking…"}</span>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* composer */}
      <div className="mx-auto mt-3 w-full max-w-3xl">
        <AnimatePresence>
          {media.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-2 flex gap-2">
              {media.map((src, i) => (
                <div key={i} className="relative h-14 w-14 overflow-hidden rounded-lg">
                  {isVideo(src) ? <video src={src} className="h-full w-full object-cover" /> : <img src={src} alt="" className="h-full w-full object-cover" />}
                  <button onClick={() => setMedia((p) => p.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="field rounded-3xl px-2.5 py-2">
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-1">
            {/* "+" tools menu */}
            <div className="relative">
              <button type="button" onClick={() => setMenu((x) => (x === "plus" ? null : "plus"))} aria-label="Tools" className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl transition", menu === "plus" ? "text-accent neon-border" : "text-fg-muted hover:text-accent")}>
                <Plus className={cn("h-5 w-5 transition-transform", menu === "plus" && "rotate-45")} />
              </button>
              <AnimatePresence>
                {menu === "plus" && (
                  <>
                    <button aria-label="close" onClick={() => setMenu(null)} className="fixed inset-0 z-40 cursor-default" />
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }} className="popover absolute bottom-12 left-0 z-50 w-56 rounded-2xl p-1.5">
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-[var(--panel)]">
                        <ImagePlus className="h-4 w-4 text-accent" /> Фото
                        <input type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
                      </label>
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-[var(--panel)]">
                        <Film className="h-4 w-4 text-accent" /> Видео
                        <input type="file" accept="video/*" hidden onChange={(e) => addFiles(e.target.files, media.length + 1)} />
                      </label>
                      <button type="button" onClick={() => { setGenMode(true); setMenu(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-[var(--panel)]">
                        <Wand2 className="h-4 w-4 text-accent-2" /> Сгенерировать картинку
                      </button>
                      <button type="button" onClick={() => { setThink(think === "extended" ? "standard" : "extended"); setMenu(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-[var(--panel)]">
                        <Brain className="h-4 w-4 text-accent" /> Thinking: {think === "extended" ? "Extended" : "Standard"}
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <button type="button" onClick={toggleVoice} aria-label="Voice" className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl transition", listening ? "text-danger" : "text-fg-muted hover:text-accent")}>
              <Mic className={cn("h-4 w-4", listening && "animate-pulse")} />
            </button>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={genMode ? "Опиши картинку для генерации…" : listening ? "Слушаю…" : "Сообщение для OASIS AI…"} className="w-full bg-transparent px-1 py-2 text-[13px] outline-none" />
            <button type="submit" disabled={!canSend} aria-label="Send" className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl transition", canSend ? "neon-border bg-gradient-to-br from-accent/30 to-accent-2/30 text-accent hover:from-accent/45 hover:to-accent-2/45" : "bg-[var(--panel)] text-fg-muted/50")}>
              <ArrowUp className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-t border-[var(--panel-border)] pt-2">
            <div className="relative">
              <button onClick={() => setMenu((x) => (x === "model" ? null : "model"))} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-fg-muted transition hover:text-accent">
                {model === "pro" ? <Sparkles className="h-3.5 w-3.5 text-accent" /> : <Zap className="h-3.5 w-3.5" />}
                {model === "pro" ? "OASIS Pro" : "OASIS Flash"}<ChevronDown className="h-3 w-3" />
              </button>
              <AnimatePresence>
                {menu === "model" && (
                  <>
                    <button aria-label="close" onClick={() => setMenu(null)} className="fixed inset-0 z-40 cursor-default" />
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="popover absolute bottom-9 left-0 z-50 w-56 rounded-2xl p-1.5">
                      <button onClick={() => pickModel("flash")} className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-[var(--panel)]", model === "flash" && "text-accent")}>
                        <Zap className="h-4 w-4" /><span><span className="block text-sm font-medium">OASIS Flash</span><span className="block text-[11px] text-fg-muted">Быстрый · бесплатно</span></span>
                      </button>
                      <button onClick={() => pickModel("pro")} className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-[var(--panel)]", model === "pro" && "text-accent")}>
                        {paid ? <Sparkles className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        <span><span className="block text-sm font-medium">OASIS Pro {!paid && "🔒"}</span><span className="block text-[11px] text-fg-muted">Умнее · нужен Pro план</span></span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <span className="h-4 w-px bg-[var(--panel-border)]" />
            <div className="relative">
              <button onClick={() => setMenu((x) => (x === "think" ? null : "think"))} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-fg-muted transition hover:text-accent">
                <Brain className="h-3.5 w-3.5" />{think === "extended" ? "Extended" : "Standard"}<ChevronDown className="h-3 w-3" />
              </button>
              <AnimatePresence>
                {menu === "think" && (
                  <>
                    <button aria-label="close" onClick={() => setMenu(null)} className="fixed inset-0 z-40 cursor-default" />
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="popover absolute bottom-9 left-0 z-50 w-64 rounded-2xl p-1.5">
                      <button onClick={() => { setThink("standard"); setMenu(null); }} className={cn("w-full rounded-xl px-3 py-2 text-left transition hover:bg-[var(--panel)]", think === "standard" && "text-accent")}>
                        <span className="block text-sm font-medium">Standard</span><span className="block text-[11px] text-fg-muted">Быстрые, краткие ответы</span>
                      </button>
                      <button onClick={() => { setThink("extended"); setMenu(null); }} className={cn("w-full rounded-xl px-3 py-2 text-left transition hover:bg-[var(--panel)]", think === "extended" && "text-accent")}>
                        <span className="block text-sm font-medium">Extended</span><span className="block text-[11px] text-fg-muted">ИИ рассуждает глубже и подробнее</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <span className="h-4 w-px bg-[var(--panel-border)]" />
            <button onClick={() => setGenMode((g) => !g)} className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition", genMode ? "neon-border text-accent" : "text-fg-muted hover:text-accent")}>
              <Wand2 className="h-3.5 w-3.5" /> Генерация {genMode ? "вкл" : ""}
            </button>
            {genMode && <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-accent">Режим генерации включён ✦</span>}
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-fg-muted">OASIS AI может ошибаться — проверяйте важную информацию.</p>
      </div>

      {/* lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLightbox(null)} className="fixed inset-0 z-[80] grid place-items-center bg-black/85 p-6 backdrop-blur-sm">
            <button aria-label="Close" className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"><X className="h-5 w-5" /></button>
            {isVideo(lightbox) ? (
              <video src={lightbox} controls autoPlay className="max-h-[90vh] max-w-[90vw] rounded-2xl" onClick={(e) => e.stopPropagation()} />
            ) : (
              <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} src={lightbox} alt="" className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ProGate open={gate} onClose={() => setGate(false)} feature="OASIS Pro AI" />
    </div>
  );
}

function MediaThumb({ src, large, onOpen }: { src: string; large?: boolean; onOpen: () => void }) {
  const cls = cn("mb-2 cursor-zoom-in rounded-xl object-cover transition hover:opacity-90", large ? "max-h-80" : "max-h-48");
  return isVideo(src) ? (
    <video src={src} onClick={onOpen} className={cls} />
  ) : (
    <img src={src} alt="" onClick={onOpen} className={cls} />
  );
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
}
