"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ImageIcon, Maximize2, Minimize2, Plus, Terminal, X, Zap } from "lucide-react";
import {
  COMMANDS, CATEGORIES, TARGETS, SCOPE_PREFIXES, findCommand, matchCommands,
  tokenize, usageString, type CmdSpec,
} from "@/lib/admin/commands";
import { fieldsFor, allFieldTokens, type Entity } from "@/lib/admin/entities";
import { runCommand, type ConsoleLine, type Tone, type PastedImage } from "@/app/(admin)/admin/control/actions";

const THEMES: Record<string, string> = { green: "#22ff88", amber: "#fbbf24", cyan: "#38bdf8", magenta: "#ff6ad5", white: "#e8f0ff" };
const TONE_COLOR: Record<Tone, string> = {
  ok: "#22ff88", err: "#ff5d5d", warn: "#fbbf24", info: "#38bdf8", muted: "rgba(255,255,255,0.45)", accent: "#a78bfa", out: "#dfe7ef",
};

type Suggestion = { insert: string; primary: string; secondary?: string; space: boolean; danger?: boolean };
type PastedItem = { id: string; url: string; raw: PastedImage };
type Session = { id: string; name: string; lines: ConsoleLine[]; input: string; history: string[]; theme: string; images: PastedItem[] };

const BANNER = (op: string): ConsoleLine[] => [
  { tone: "ok", text: "OASIS LUX // FULL CONTROL  —  root shell" },
  { tone: "muted", text: `operator @${op} · ${COMMANDS.length} commands armed · type /help or hit Commands →` },
  { tone: "muted", text: "every command runs for real against the live database. handle with care." },
];

export function FullControlClient({ operator }: { operator: string }) {
  const makeSession = (n: number): Session => ({
    id: crypto.randomUUID(), name: `control-${n}`,
    lines: BANNER(operator), input: "", history: [], theme: THEMES.green, images: [],
  });
  const [sessions, setSessions] = useState<Session[]>(() => [makeSession(1)]);
  const [activeId, setActiveId] = useState("");
  const [nextN, setNextN] = useState(2);
  const [caret, setCaret] = useState(0);
  const [scrollX, setScrollX] = useState(0);
  const [chW, setChW] = useState(7.83);
  const [selIdx, setSelIdx] = useState(0);
  const [histIdx, setHistIdx] = useState(-1);
  const [drawer, setDrawer] = useState(false);
  const [termsPanel, setTermsPanel] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pending, start] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0];
  const { lines, input, history, theme, images } = active;

  /* ---- per-session mutators ---- */
  const mutate = (patch: Partial<Session> | ((s: Session) => Partial<Session>)) =>
    setSessions((prev) => prev.map((s) => (s.id === active.id ? { ...s, ...(typeof patch === "function" ? patch(s) : patch) } : s)));
  const pushTo = (id: string, more: ConsoleLine[]) =>
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, lines: [...s.lines, ...more] } : s)));
  const push = (more: ConsoleLine[]) => pushTo(active.id, more);
  const setInput = (v: string) => mutate({ input: v });

  /* ---- caret tracking (block cursor that follows the real cursor) ---- */
  const measure = (node: HTMLSpanElement | null) => { if (node) { const w = node.getBoundingClientRect().width; if (w) setChW(w / 40); } };
  const syncCaret = () => { const el = inputRef.current; if (!el) return; setCaret(el.selectionStart ?? el.value.length); setScrollX(el.scrollLeft); };
  const setInputEnd = (v: string) => {
    setInput(v);
    requestAnimationFrame(() => { const el = inputRef.current; if (!el) return; el.focus(); el.setSelectionRange(v.length, v.length); setCaret(v.length); setScrollX(el.scrollLeft); });
  };

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [lines, pending, activeId]);

  /* ---- tabs ---- */
  const resetCaret = () => { setCaret(0); setScrollX(0); };
  const addSession = () => { const s = makeSession(nextN); setNextN((n) => n + 1); setSessions((p) => [...p, s]); setActiveId(s.id); setSelIdx(0); setHistIdx(-1); resetCaret(); setTimeout(() => inputRef.current?.focus(), 40); };
  const switchTo = (id: string) => { const s = sessions.find((x) => x.id === id); setActiveId(id); setSelIdx(0); setHistIdx(-1); setCaret(s ? s.input.length : 0); setScrollX(0); setTimeout(() => inputRef.current?.focus(), 40); };
  const closeSession = (id: string) => {
    if (sessions.length === 1) return;
    const idx = sessions.findIndex((s) => s.id === id);
    const next = sessions.filter((s) => s.id !== id);
    setSessions(next);
    if (id === active.id) setActiveId(next[Math.max(0, idx - 1)].id);
  };

  /* ---------------- suggestions (Minecraft-style) ----------------- */
  const completingCmd = input.startsWith("/") && tokenize(input).length <= 1 && !input.endsWith(" ");
  const { suggestions, activeCmd, argIndex } = useMemo(() => {
    if (!input.startsWith("/")) return { suggestions: [] as Suggestion[], activeCmd: undefined as CmdSpec | undefined, argIndex: -1 };
    const toks = tokenize(input);
    const trailing = input.endsWith(" ");
    if (toks.length <= 1 && !trailing) {
      const sg = matchCommands(toks[0]).slice(0, 8).map((c): Suggestion => ({ insert: `/${c.name}`, primary: `/${c.name}`, secondary: c.summary, space: true, danger: c.danger }));
      return { suggestions: sg, activeCmd: findCommand(toks[0]), argIndex: -1 };
    }
    const cmd = findCommand(toks[0]);
    if (!cmd) return { suggestions: [], activeCmd: undefined, argIndex: -1 };
    const ai = trailing ? toks.length - 1 : toks.length - 2;
    const partial = trailing ? "" : toks[toks.length - 1] ?? "";
    const arg = cmd.args[ai];
    let sg: Suggestion[] = [];
    if (arg) {
      const pl = partial.toLowerCase();
      if (arg.type === "target" || arg.type === "anytarget") {
        sg = TARGETS.filter((t) => t.token.startsWith(pl) || !pl).map((t) => ({ insert: t.token, primary: t.token, secondary: t.label, space: true }));
      } else if (arg.type === "field") {
        const targetTok = toks[1] ?? "";
        const isSel = TARGETS.some((t) => t.token === targetTok);
        const ent: Entity | null = isSel || targetTok.startsWith("@") ? "user" : null;
        const pool = ent
          ? fieldsFor(ent).map((f) => ({ token: f.key, label: f.label }))
          : dedupe(allFieldTokens().map((f) => ({ token: f.token, label: f.label })));
        sg = pool.filter(({ token }) => token.toLowerCase().includes(pl)).slice(0, 10).map(({ token, label }) => ({ insert: token, primary: token, secondary: label, space: true }));
      } else if (arg.type === "scope") {
        if (!partial.includes(":")) sg = SCOPE_PREFIXES.filter((s) => s.startsWith(pl)).map((s) => ({ insert: s, primary: s, secondary: "then the value, e.g. Dior", space: false }));
      } else if (arg.type === "enum" || arg.type === "onoff") {
        sg = (arg.options ?? []).filter((o) => o.startsWith(pl)).map((o) => ({ insert: o, primary: o, secondary: arg.name, space: true }));
      } else if (arg.type === "term") {
        sg = ["forever", "1h", "24h", "7d", "30d"].filter((o) => o.startsWith(pl)).map((o) => ({ insert: o, primary: o, secondary: "duration", space: true }));
      } else if (arg.type === "what") {
        sg = [arg.name].filter((o) => o.startsWith(pl)).map((o) => ({ insert: o, primary: o, secondary: arg.hint, space: true }));
      }
    }
    return { suggestions: sg, activeCmd: cmd, argIndex: ai };
  }, [input]);

  /* ---------------- accept a suggestion --------------------------- */
  const accept = (s: Suggestion | undefined) => {
    if (!s) return;
    if (completingCmd) { setInputEnd(s.insert + (s.space ? " " : "")); return; }
    const trailing = input.endsWith(" ");
    const toks = tokenize(input);
    const partial = trailing ? "" : toks[toks.length - 1] ?? "";
    const base = input.slice(0, input.length - partial.length);
    setInputEnd(base + s.insert + (s.space ? " " : ""));
  };

  const handleClient = (name: string, toks: string[], raw: string) => {
    switch (name) {
      case "clear": mutate({ lines: [] }); break;
      case "commands": setDrawer(true); break;
      case "whoami": push([{ tone: "info", text: `@${operator} · role admin · root access · session ${active.name}` }]); break;
      case "echo": push([{ tone: "out", text: raw.slice(raw.indexOf(" ") + 1) || "" }]); break;
      case "date": push([{ tone: "info", text: new Date().toLocaleString("en-GB", { dateStyle: "full", timeStyle: "medium" }) }]); break;
      case "ping": push([{ tone: "ok", text: "pong 🏓" }]); break;
      case "flip": push([{ tone: "ok", text: `🪙 ${coinFlip()}` }]); break;
      case "roll": { const sides = Math.max(2, Number(toks[1]) || 6); push([{ tone: "ok", text: `🎲 ${rollDie(sides)} (d${sides})` }]); break; }
      case "uuid": push([{ tone: "info", text: genUuid() }]); break;
      case "motd": push([{ tone: "accent", text: "“With great root access comes great responsibility.” — handle the grid with care." }]); break;
      case "sessions": push([{ tone: "info", text: `${sessions.length} terminal(s):` }, ...sessions.map((s) => ({ tone: "muted" as Tone, text: `  ${s.id === active.id ? "▸" : " "} ${s.name} · ${s.lines.length} lines` }))]); break;
      case "reverse": push([{ tone: "out", text: [...raw.slice(raw.indexOf(" ") + 1)].reverse().join("") }]); break;
      case "upper": push([{ tone: "out", text: raw.slice(raw.indexOf(" ") + 1).toUpperCase() }]); break;
      case "lower": push([{ tone: "out", text: raw.slice(raw.indexOf(" ") + 1).toLowerCase() }]); break;
      case "len": { const s = raw.slice(raw.indexOf(" ") + 1); push([{ tone: "info", text: `${[...s].length} characters` }]); break; }
      case "pick": { const opts = toks.slice(1); push([{ tone: opts.length ? "ok" : "err", text: opts.length ? `🎯 ${pickOne(opts)}` : "✗ give at least one option." }]); break; }
      case "banner": push(BANNER(operator)); break;
      case "history": push(active.history.length ? active.history.slice(0, 30).reverse().map((h, i) => ({ tone: "muted" as Tone, text: `  ${String(i + 1).padStart(3)}  ${h}` })) : [{ tone: "muted", text: "no history yet." }]); break;
      case "calc": {
        const expr = raw.slice(raw.indexOf(" ") + 1).trim();
        if (!/^[-+*/%.()\d\s]+$/.test(expr)) { push([{ tone: "err", text: "✗ only numbers and + - * / % ( ) allowed." }]); break; }
        try { const v = Function(`"use strict";return(${expr})`)(); push([{ tone: "ok", text: `= ${v}` }]); }
        catch { push([{ tone: "err", text: "✗ bad expression." }]); }
        break;
      }
      case "color": {
        const key = (toks[1] ?? "green").toLowerCase();
        if (THEMES[key]) { mutate({ theme: THEMES[key] }); push([{ tone: "ok", text: `✓ console theme → ${key}` }]); }
        else push([{ tone: "err", text: `✗ unknown color "${toks[1]}". try: ${Object.keys(THEMES).join(", ")}` }]);
        break;
      }
      case "help": {
        const target = toks[1] && findCommand(toks[1]);
        if (target) {
          push([
            { tone: "ok", text: usageString(target) },
            { tone: "muted", text: `  ${target.summary}` },
            ...target.args.map((a) => ({ tone: "muted" as Tone, text: `    ${a.required ? "<" : "["}${a.name}${a.required ? ">" : "]"}  — ${a.hint}` })),
            ...target.examples.map((e) => ({ tone: "info" as Tone, text: `  e.g. ${e}` })),
          ]);
        } else {
          push([{ tone: "ok", text: "Commands — /help <name> for detail, or open the Commands drawer." }]);
          for (const cat of CATEGORIES) {
            push([{ tone: "accent", text: `  ${cat}` }]);
            push(COMMANDS.filter((c) => c.category === cat).map((c) => ({ tone: "muted" as Tone, text: `    /${c.name.padEnd(16)} ${c.summary}` })));
          }
        }
        break;
      }
    }
  };

  /* ---------------- run ------------------------------------------- */
  const execute = (raw: string) => {
    const cmdLine = raw.trim();
    if (!cmdLine) return;
    const sid = active.id;
    push([{ tone: "out", text: `oasis@control:~$ ${cmdLine}` }]);
    mutate((s) => ({ history: [cmdLine, ...s.history].slice(0, 100) }));
    setHistIdx(-1);

    const toks = tokenize(cmdLine);
    const spec = findCommand(toks[0].replace(/^\//, "").toLowerCase());
    if (spec?.clientOnly) { handleClient(spec.name, toks, cmdLine); setInputEnd(""); return; }

    const imgs = images.map((i) => i.raw);
    mutate({ input: "", images: [] });
    setCaret(0); setScrollX(0);
    start(async () => {
      const res = await runCommand(cmdLine, imgs);
      pushTo(sid, res.lines);
    });
  };

  /* ---------------- keyboard -------------------------------------- */
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const open = suggestions.length > 0;
    if (e.key === "ArrowDown" && open) { e.preventDefault(); setSelIdx((i) => (i + 1) % suggestions.length); return; }
    if (e.key === "ArrowUp" && open) { e.preventDefault(); setSelIdx((i) => (i - 1 + suggestions.length) % suggestions.length); return; }
    if (e.key === "Tab") { e.preventDefault(); if (open) accept(suggestions[selIdx]); return; }
    if (e.key === "Escape") { if (fullscreen) setFullscreen(false); else inputRef.current?.blur(); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && completingCmd) { accept(suggestions[selIdx]); return; }
      execute(input);
      return;
    }
    if (e.key === "ArrowUp" && !open) {
      e.preventDefault();
      const ni = Math.min(histIdx + 1, history.length - 1);
      if (history[ni] != null) { setInputEnd(history[ni]); setHistIdx(ni); }
    }
    if (e.key === "ArrowDown" && !open) {
      e.preventDefault();
      const ni = Math.max(histIdx - 1, -1);
      setInputEnd(ni === -1 ? "" : history[ni] ?? ""); setHistIdx(ni);
    }
  };

  /* ---------------- image paste ----------------------------------- */
  const onPaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items).filter((it) => it.type.startsWith("image/"));
    if (!items.length) return;
    e.preventDefault();
    for (const it of items) {
      const file = it.getAsFile();
      if (!file) continue;
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result);
        mutate((s) => ({ images: [...s.images, { id: `photo-${s.images.length + 1}`, url, raw: { name: file.name || "pasted.png", dataUrl: url } }] }));
      };
      reader.readAsDataURL(file);
    }
  };

  /* ---------------- shell ----------------------------------------- */
  const shell = (
    <div
      className={fullscreen ? "fixed inset-0 z-[120] flex flex-col bg-[#04070b]" : "relative mt-4 flex flex-col overflow-hidden rounded-2xl border bg-[#04070b]"}
      style={fullscreen ? undefined : { borderColor: `${theme}33`, boxShadow: `0 0 60px ${theme}14, inset 0 0 80px rgba(0,0,0,0.6)` }}
    >
      {/* scanlines + grid bg */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.5]" style={{ backgroundImage: `linear-gradient(${theme}0a 1px, transparent 1px), linear-gradient(90deg, ${theme}0a 1px, transparent 1px)`, backgroundSize: "26px 26px" }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px)" }} />

      {/* titlebar + tabs */}
      <div className="relative flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: `${theme}22` }}>
        <span className="h-3 w-3 rounded-full" style={{ background: "#ff5f57" }} />
        <span className="h-3 w-3 rounded-full" style={{ background: "#febc2e" }} />
        <span className="h-3 w-3 rounded-full" style={{ background: "#28c840" }} />
        <div className="no-scrollbar ml-2 flex items-center gap-1 overflow-x-auto">
          {sessions.map((s) => {
            const on = s.id === active.id;
            return (
              <div key={s.id} onClick={() => switchTo(s.id)}
                className="group flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-[12px] transition"
                style={{ background: on ? `${s.theme}26` : "rgba(255,255,255,0.04)", color: on ? s.theme : "rgba(255,255,255,0.6)", boxShadow: on ? `inset 0 0 0 1px ${s.theme}66` : "inset 0 0 0 1px rgba(255,255,255,0.06)" }}>
                <Terminal className="h-3.5 w-3.5" />{s.name}
                {sessions.length > 1 && (
                  <button onClick={(e) => { e.stopPropagation(); closeSession(s.id); }} className="-mr-1 ml-0.5 rounded p-0.5 opacity-50 transition hover:bg-white/15 hover:opacity-100"><X className="h-3 w-3" /></button>
                )}
              </div>
            );
          })}
          <button onClick={addSession} title="New terminal (open another console)" className="grid h-7 w-7 place-items-center rounded-md border border-dashed transition hover:bg-white/10" style={{ borderColor: `${theme}55`, color: theme }}><Plus className="h-4 w-4" /></button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 font-mono text-[10px] sm:inline-flex" style={{ color: theme }}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: theme }} /> {pending ? "executing…" : "ready"}
          </span>
          <button onClick={() => setTermsPanel(true)} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[11px] font-bold transition" style={{ borderColor: `${theme}44`, color: theme }}>
            <Terminal className="h-3.5 w-3.5" /> Terminals <span className="rounded bg-white/10 px-1">{sessions.length}</span>
          </button>
          <button onClick={() => setDrawer(true)} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[11px] font-bold transition" style={{ borderColor: `${theme}44`, color: theme }}>
            <Zap className="h-3.5 w-3.5" /> Commands
          </button>
          <button onClick={() => { setFullscreen((f) => !f); setTimeout(() => inputRef.current?.focus(), 40); }} title="Toggle fullscreen" className="grid h-7 w-7 place-items-center rounded-md text-white/50 transition hover:bg-white/10 hover:text-white">
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* scrollback — history only */}
      <div ref={scrollRef} onClick={() => inputRef.current?.focus()} className={`no-scrollbar relative cursor-text overflow-y-auto px-4 py-3 font-mono text-[13px] leading-relaxed ${fullscreen ? "flex-1" : "h-[420px]"}`}>
        {lines.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap break-words" style={{ color: TONE_COLOR[l.tone] }}>{l.text}</div>
        ))}
        {pending && <div className="whitespace-pre-wrap" style={{ color: theme }}>▌ working…</div>}
      </div>

      {/* input dock — prompt at the bottom; suggestions FLOAT ABOVE it */}
      <div className="relative border-t" style={{ borderColor: `${theme}22` }}>
        <AnimatePresence>
          {suggestions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.12 }}
              className="absolute bottom-full left-0 right-0 z-20 mb-px max-h-56 overflow-hidden">
              <div className="no-scrollbar mx-3 max-h-56 overflow-y-auto rounded-t-lg border-x border-t p-1 shadow-2xl backdrop-blur-xl"
                style={{ borderColor: `${theme}33`, background: "rgba(4,7,13,0.96)", boxShadow: `0 -10px 40px ${theme}1a` }}>
                {suggestions.map((s, i) => (
                  <button key={s.primary + i} onMouseEnter={() => setSelIdx(i)} onMouseDown={(e) => { e.preventDefault(); accept(s); inputRef.current?.focus(); }}
                    className="flex w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-left font-mono text-[12px] transition"
                    style={{ background: i === selIdx ? `${theme}24` : "transparent", boxShadow: i === selIdx ? `inset 0 0 0 1px ${theme}44` : undefined }}>
                    <ChevronRight className="h-3 w-3 shrink-0" style={{ color: i === selIdx ? theme : "transparent" }} />
                    <span style={{ color: s.danger ? "#ff5d5d" : theme }}>{highlightMatch(s.primary, currentPartial(input))}</span>
                    {s.secondary && <span className="truncate text-white/40">{s.secondary}</span>}
                    {i === selIdx && <kbd className="ml-auto shrink-0 rounded bg-white/10 px-1.5 text-[9px] text-white/50">tab ⮐</kbd>}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeCmd && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-1.5 font-mono text-[11px]" style={{ borderColor: `${theme}14` }}>
            <span className="text-white/30">usage</span>
            <span>
              <span style={{ color: theme }}>/{activeCmd.name}</span>
              {activeCmd.args.map((a, i) => (
                <span key={a.name} className="ml-1.5" style={{ color: i === argIndex ? theme : "rgba(255,255,255,0.35)", fontWeight: i === argIndex ? 700 : 400, textShadow: i === argIndex ? `0 0 8px ${theme}88` : undefined }}>
                  {a.required ? `<${a.name}>` : `[${a.name}]`}
                </span>
              ))}
            </span>
            {activeCmd.args[argIndex] && <span className="text-white/50">— {activeCmd.args[argIndex].hint}</span>}
          </div>
        )}

        {/* prompt row — custom BLOCK caret that follows the real cursor */}
        <div className="flex items-start gap-2 px-4 py-3">
          <span className="select-none whitespace-nowrap font-mono text-[13px]" style={{ color: theme }}>oasis@control:~$</span>
          <div className="relative flex-1 overflow-hidden">
            <span ref={measure} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 whitespace-pre font-mono text-[13px]">0000000000000000000000000000000000000000</span>
            <div aria-hidden className="pointer-events-none relative whitespace-pre font-mono text-[13px] leading-[1.5]" style={{ transform: `translateX(${-scrollX}px)` }}>
              {input ? <span style={{ color: theme }}>{input}</span> : <span className="text-white/25">type a / command…</span>}
              <span className="term-caret" style={{ left: caret * chW, width: Math.max(2, chW), background: theme }} />
              {input[caret] && input[caret] !== " " && (
                <span className="term-caret-char font-mono text-[13px] leading-[1.5]" style={{ left: caret * chW, color: "#04070b" }}>{input[caret]}</span>
              )}
            </div>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); setSelIdx(0); syncCaret(); }}
              onKeyDown={onKeyDown}
              onKeyUp={syncCaret}
              onClick={syncCaret}
              onSelect={syncCaret}
              onScroll={syncCaret}
              onPaste={onPaste}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              className="absolute inset-0 w-full bg-transparent font-mono text-[13px] leading-[1.5] text-transparent caret-transparent outline-none"
            />
          </div>
        </div>

        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {images.map((im) => (
              <span key={im.id} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]" style={{ borderColor: `${theme}55`, color: theme }}>
                <ImageIcon className="h-3 w-3" />[{im.id}]
                <button onClick={() => mutate((s) => ({ images: s.images.filter((y) => y.id !== im.id) }))} className="text-white/40 hover:text-white"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  /* ---------------- render ---------------------------------------- */
  return (
    <div className={fullscreen ? "" : "mx-auto max-w-6xl pb-12"}>
      {!fullscreen && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.35em]" style={{ color: theme }}>Full Control</p>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Command console</h1>
              <p className="mt-1.5 text-sm text-white/55">Run the entire platform from one prompt — bans, prices, promos, broadcasts. Slash to summon the grid&apos;s full power.</p>
            </div>
            <button onClick={() => { setFullscreen(true); setTimeout(() => inputRef.current?.focus(), 40); }} className="group inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-sm font-bold transition" style={{ borderColor: `${theme}55`, color: theme, background: `${theme}12` }}>
              <Maximize2 className="h-4 w-4" /> Fullscreen
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {["/ban ", "/edit ", "/set_zapret ", "/set_price ", "/promote ", "/find products ", "/announce @a ", "/stats", "/send_message "].map((q) => (
              <button key={q} onClick={() => setInputEnd(q)} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-white/55 transition hover:border-white/25 hover:text-white">{q.trim()}</button>
            ))}
          </div>
        </>
      )}

      {/* fullscreen escapes the admin stacking context via a body portal */}
      {fullscreen ? (typeof document !== "undefined" ? createPortal(shell, document.body) : null) : shell}

      {!fullscreen && (
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-white/35">
          <span><kbd className="rounded bg-white/10 px-1">Tab</kbd> complete</span>
          <span><kbd className="rounded bg-white/10 px-1">↑↓</kbd> history / suggestions</span>
          <span><kbd className="rounded bg-white/10 px-1">Enter</kbd> run</span>
          <span><kbd className="rounded bg-white/10 px-1">Ctrl+V</kbd> paste image → announce</span>
          <span><kbd className="rounded bg-white/10 px-1">+</kbd> new terminal</span>
          <span><kbd className="rounded bg-white/10 px-1">Esc</kbd> exit fullscreen</span>
        </p>
      )}

      {/* ---------------- Terminals panel (portaled) ---------------- */}
      {typeof document !== "undefined" && createPortal(
      <AnimatePresence>
        {termsPanel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setTermsPanel(false)} className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm" />
            <motion.aside initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 30, stiffness: 280 }}
              className="fixed left-0 top-0 z-[131] flex h-full w-full max-w-sm flex-col border-r bg-[#05080d]" style={{ borderColor: `${theme}33` }}>
              <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: `${theme}22` }}>
                <div className="flex items-center gap-2 font-mono">
                  <Terminal className="h-4 w-4" style={{ color: theme }} />
                  <span className="text-sm font-bold text-white">TERMINALS</span>
                  <span className="text-[11px] text-white/40">{sessions.length} open</span>
                </div>
                <button onClick={() => setTermsPanel(false)} className="text-white/40 transition hover:text-white"><X className="h-5 w-5" /></button>
              </div>

              <div className="p-3">
                <button onClick={addSession} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-2.5 font-mono text-[12px] font-bold transition hover:bg-white/[0.04]" style={{ borderColor: `${theme}66`, color: theme }}>
                  <Plus className="h-4 w-4" /> New terminal
                </button>
              </div>

              <div className="no-scrollbar flex-1 overflow-y-auto px-3 pb-3 font-mono">
                {sessions.map((s) => {
                  const on = s.id === active.id;
                  return (
                    <div key={s.id} onClick={() => { switchTo(s.id); setTermsPanel(false); }}
                      className="group mb-1.5 flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition"
                      style={{ borderColor: on ? `${s.theme}66` : "rgba(255,255,255,0.08)", background: on ? `${s.theme}14` : "rgba(255,255,255,0.02)" }}>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md" style={{ background: `${s.theme}1f`, color: s.theme }}><Terminal className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-[12px] font-bold text-white">{s.name}{on && <span className="rounded px-1.5 text-[9px] uppercase" style={{ background: `${s.theme}26`, color: s.theme }}>active</span>}</p>
                        <p className="text-[10px] text-white/40">{s.lines.length} lines · {s.history.length} run</p>
                      </div>
                      {sessions.length > 1 && (
                        <button onClick={(e) => { e.stopPropagation(); closeSession(s.id); }} title="Close terminal" className="rounded p-1 text-white/40 opacity-0 transition hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"><X className="h-4 w-4" /></button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="border-t px-5 py-3 text-[10px] text-white/35" style={{ borderColor: `${theme}22` }}>
                Each terminal keeps its own scrollback, history & theme. Click to switch.
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>, document.body)}

      {/* ---------------- Commands drawer (portaled above the terminal) ---------------- */}
      {typeof document !== "undefined" && createPortal(
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm" />
            <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 280 }}
              className="fixed right-0 top-0 z-[131] flex h-full w-full max-w-md flex-col border-l bg-[#05080d]" style={{ borderColor: `${theme}33` }}>
              <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: `${theme}22` }}>
                <div className="flex items-center gap-2 font-mono">
                  <Zap className="h-4 w-4" style={{ color: theme }} />
                  <span className="text-sm font-bold text-white">COMMANDS</span>
                  <span className="text-[11px] text-white/40">{COMMANDS.length}</span>
                </div>
                <button onClick={() => setDrawer(false)} className="text-white/40 transition hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <div className="no-scrollbar flex-1 overflow-y-auto px-3 py-3 font-mono text-[12px]">
                {CATEGORIES.map((cat) => (
                  <div key={cat} className="mb-4">
                    <p className="mb-1.5 px-2 text-[10px] uppercase tracking-[0.25em]" style={{ color: theme }}>{cat}</p>
                    {COMMANDS.filter((c) => c.category === cat).map((c) => (
                      <button key={c.name} onClick={() => { setInputEnd(`/${c.name} `); setDrawer(false); }}
                        className="group block w-full rounded-md px-2 py-1.5 text-left transition hover:bg-white/[0.05]">
                        <span className="flex flex-wrap items-baseline gap-x-1.5">
                          <span style={{ color: c.danger ? "#ff5d5d" : theme }}>/{c.name}</span>
                          {c.args.map((a) => <span key={a.name} className="text-white/30">{a.required ? `<${a.name}>` : `[${a.name}]`}</span>)}
                        </span>
                        <span className="block text-[11px] text-white/45">{c.summary}</span>
                        {c.examples[0] && <span className="block text-[10px] text-white/25 transition group-hover:text-white/40">e.g. {c.examples[0]}</span>}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <div className="border-t px-5 py-3 text-[10px] text-white/35" style={{ borderColor: `${theme}22` }}>
                Click any command to drop it into the prompt. Selectors: <span style={{ color: theme }}>@a @p @e @s @b @v</span>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>, document.body)}

      <style>{`
        .term-caret { position:absolute; top:0.25em; height:1em; animation: termblink 1.05s steps(1) infinite; }
        .term-caret-char { position:absolute; top:0; animation: termblink 1.05s steps(1) infinite; }
        @keyframes termblink { 0%,50% { opacity:1; } 50.01%,100% { opacity:0; } }
      `}</style>
    </div>
  );
}

/* random utilities live at module scope so the purity lint doesn't flag them */
function coinFlip(): string { return Math.random() < 0.5 ? "heads" : "tails"; }
function rollDie(sides: number): number { return 1 + Math.floor(Math.random() * sides); }
function genUuid(): string { return crypto.randomUUID(); }
function pickOne(arr: string[]): string { return arr[Math.floor(Math.random() * arr.length)]; }

function dedupe(arr: { token: string; label: string }[]): { token: string; label: string }[] {
  const seen = new Set<string>();
  return arr.filter(({ token }) => (seen.has(token) ? false : (seen.add(token), true)));
}

function currentPartial(input: string): string {
  if (!input.startsWith("/")) return "";
  if (input.endsWith(" ")) return "";
  const toks = tokenize(input);
  return toks.length <= 1 ? toks[0] : toks[toks.length - 1] ?? "";
}

function highlightMatch(text: string, frag: string): React.ReactNode {
  const f = frag.replace(/^\//, "");
  if (!f) return text;
  const i = text.toLowerCase().indexOf(f.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span style={{ textDecoration: "underline", filter: "brightness(1.4)" }}>{text.slice(i, i + f.length)}</span>
      {text.slice(i + f.length)}
    </>
  );
}
