"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, Check, CheckCheck, ImagePlus, Loader2, Mic, Phone, Search,
  Send, Smile, Sticker, Trash2, Video,
} from "lucide-react";
import toast from "react-hot-toast";
import { getBrowserClient } from "@/lib/supabase/client";
import { uploadMedia } from "@/lib/data/profile-mutations";
import {
  fetchMessages, fetchPeerMini, getOrCreateConversation, markRead, mapMessage, sendMessage,
  type ChatMessage,
} from "@/lib/data/messages";
import { useCall } from "@/hooks/useCall";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/profile/Avatar";
import { PlanBadge, VerifiedBadge } from "@/components/profile/Badges";
import { CallOverlay } from "@/components/messages/CallOverlay";
import type { MiniProfile } from "@/types";

const EMOJIS = ["😀", "😍", "👍", "🙏", "🔥", "❤️", "😂", "🤝", "💯", "👀", "✅", "🎁", "💸", "📦", "⌚", "🧴"];
const STICKERS = ["🔥", "😂", "😍", "👍", "🙏", "🎉", "💯", "👀", "🤝", "❤️", "😎", "🤑", "🥳", "🫶", "💎", "⌚", "🧴", "🚀", "👑", "✨"];
const QUICK_REPLIES = ["Is this item authentic?", "Is it still available?", "When can you deliver?", "Can you do a better price?"];

const AUDIO_RE = /\.(webm|ogg|mp3|m4a|wav|aac|mp4)(\?|$)/i;
const GIF_RE = /\.gif(\?|$)/i;
const isEmojiOnly = (t: string) => t.length > 0 && /^[\p{Extended_Pictographic}‍️\s]+$/u.test(t) && [...t.replace(/\s/g, "")].length <= 6;

type Gif = { id: string; url: string; preview: string };
type Panel = "none" | "emoji" | "sticker" | "gif";

export function ChatPane({ meId, peerId, peer: peerInitial }: { meId: string; peerId: string; peer?: MiniProfile }) {
  const sb = getBrowserClient();
  const [peer, setPeer] = useState<MiniProfile | null>(peerInitial ?? null);
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(meId !== peerId);
  const [notFound, setNotFound] = useState(false);
  const [online, setOnline] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [panel, setPanel] = useState<Panel>("none");

  // voice recording
  const [recording, setRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recCancelRef = useRef(false);

  // gif picker
  const [gifQuery, setGifQuery] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [gifLoading, setGifLoading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);
  const selfChat = meId === peerId;

  const call = useCall(channelRef, meId);
  const onSignalRef = useRef(call.onSignal);
  useEffect(() => { onSignalRef.current = call.onSignal; }, [call.onSignal]);

  // resolve peer + conversation + history
  useEffect(() => {
    if (selfChat) return;
    let cancelled = false;
    void (async () => {
      try {
        let resolved = peerInitial ?? null;
        if (!peerInitial) {
          resolved = await fetchPeerMini(sb, peerId);
          if (!cancelled) setPeer(resolved);
        }
        if (!resolved) { if (!cancelled) setNotFound(true); return; }
        const id = await getOrCreateConversation(sb, meId, peerId);
        if (cancelled) return;
        setConvId(id);
        const msgs = await fetchMessages(sb, id);
        if (cancelled) return;
        setMessages(msgs);
        void markRead(sb, id, meId);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, peerId]);

  // realtime: messages + presence + call signaling (shared channel)
  useEffect(() => {
    if (!convId) return;
    const ch = sb.channel(`chat:${convId}`, { config: { presence: { key: meId } } });
    channelRef.current = ch;
    ch.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
      (payload) => {
        const m = mapMessage(payload.new as Parameters<typeof mapMessage>[0]);
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (m.recipientId === meId) void markRead(sb, convId, meId);
      },
    )
      .on("presence", { event: "sync" }, () => {
        setOnline(Object.keys(ch.presenceState()).includes(peerId));
      })
      .on("broadcast", { event: "call" }, ({ payload }) => { void onSignalRef.current(payload); })
      .subscribe((status) => { if (status === "SUBSCRIBED") void ch.track({ at: Date.now() }); });
    return () => { channelRef.current = null; void sb.removeChannel(ch); };
  }, [convId, meId, peerId, sb]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // recording timer
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const pushMessage = (m: ChatMessage | null) =>
    m && setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));

  const send = async (body: string, attachments: string[] = []) => {
    const t = body.trim();
    if ((!t && attachments.length === 0) || !convId || sending) return;
    setSending(true);
    setText("");
    setPanel("none");
    try {
      pushMessage(await sendMessage(sb, convId, meId, peerId, t, attachments));
    } catch {
      toast.error("Message not sent");
      setText(t);
    } finally {
      setSending(false);
    }
  };

  const uploadAndSend = async (file: File, kind: string) => {
    if (!convId) return;
    setUploading(true);
    try {
      const url = await uploadMedia(sb, meId, file, kind);
      await send("", [url]);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ---- voice recording -----------------------------------------------------
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      recCancelRef.current = false;
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recCancelRef.current) return;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const ext = (rec.mimeType || "audio/webm").includes("ogg") ? "ogg" : (rec.mimeType || "").includes("mp4") ? "mp4" : "webm";
        void uploadAndSend(new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type }), "voice");
      };
      recorderRef.current = rec;
      rec.start();
      setRecSec(0);
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };
  const stopRec = (cancel: boolean) => {
    recCancelRef.current = cancel;
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  // ---- gif picker ----------------------------------------------------------
  const loadGifs = async (q: string) => {
    setGifLoading(true);
    try {
      const res = await fetch(`/api/gifs?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as { gifs: Gif[] };
      setGifs(json.gifs ?? []);
    } catch { setGifs([]); } finally { setGifLoading(false); }
  };
  const openGifs = () => {
    setPanel((p) => (p === "gif" ? "none" : "gif"));
    if (gifs.length === 0) void loadGifs("");
  };

  if (selfChat) {
    return <div className="grid h-full place-items-center p-8 text-center text-sm text-fg-muted">That’s you — pick another seller to start a chat.</div>;
  }
  if (notFound) {
    return (
      <div className="grid h-full place-items-center p-8 text-center text-sm text-fg-muted">
        <div>
          <p className="text-lg font-bold text-fg">User not found</p>
          <Link href="/messages" className="mt-3 inline-block font-mono text-xs uppercase tracking-wider text-accent hover:underline">Back to messages</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-[var(--panel-border)] px-4 py-3">
        <Link href="/messages" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full text-fg-muted transition hover:text-accent lg:hidden">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {peer ? (
          <Link href={`/profile/${peer.id}`} className="flex min-w-0 items-center gap-3">
            <div className="relative">
              <Avatar src={peer.avatarUrl} name={peer.username} size={40} />
              <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bg-elev", online ? "bg-success" : "bg-fg-muted")} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold">{peer.fullName || `@${peer.username}`}</span>
                {peer.isVerified && <VerifiedBadge className="h-3.5 w-3.5" />}
                <PlanBadge plan={peer.plan} />
              </div>
              <p className="font-mono text-[10px] text-fg-muted">{online ? "Online now" : "Offline · usually replies within a few hours"}</p>
            </div>
          </Link>
        ) : (
          <div className="h-10 w-40 animate-pulse rounded bg-[var(--panel-border)]" />
        )}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => void call.start("audio")} disabled={!convId} aria-label="Audio call" className="grid h-9 w-9 place-items-center rounded-full text-fg-muted transition hover:text-accent disabled:opacity-40">
            <Phone className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => void call.start("video")} disabled={!convId} aria-label="Video call" className="grid h-9 w-9 place-items-center rounded-full text-fg-muted transition hover:text-accent disabled:opacity-40">
            <Video className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto p-4">
        {loading ? (
          <div className="grid h-full place-items-center"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
        ) : messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-sm text-fg-muted">No messages yet. Say hello 👋</div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} m={m} mine={m.senderId === meId} />)
        )}
      </div>

      {/* quick replies */}
      {!loading && messages.length === 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {QUICK_REPLIES.map((q) => (
            <button key={q} type="button" onClick={() => void send(q)} className="rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-xs text-fg-muted transition hover:neon-border hover:text-accent">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* panels */}
      <AnimatePresence>
        {panel === "emoji" && (
          <PanelWrap key="emoji">
            <div className="grid grid-cols-8 gap-1">
              {EMOJIS.map((e) => (
                <button key={e} type="button" onClick={() => setText((t) => t + e)} className="grid h-9 w-9 place-items-center rounded-lg text-lg transition hover:bg-[var(--panel)]">{e}</button>
              ))}
            </div>
          </PanelWrap>
        )}
        {panel === "sticker" && (
          <PanelWrap key="sticker">
            <div className="grid grid-cols-6 gap-1.5">
              {STICKERS.map((e) => (
                <button key={e} type="button" onClick={() => void send(e)} className="grid h-12 w-12 place-items-center rounded-xl text-3xl transition hover:scale-110 hover:bg-[var(--panel)]">{e}</button>
              ))}
            </div>
          </PanelWrap>
        )}
        {panel === "gif" && (
          <PanelWrap key="gif">
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-[var(--panel)] px-2.5 py-1.5">
              <Search className="h-4 w-4 text-fg-muted" />
              <input
                value={gifQuery}
                onChange={(e) => setGifQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void loadGifs(gifQuery)}
                placeholder="Search GIFs (Enter)"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <div className="grid max-h-52 grid-cols-3 gap-1.5 overflow-y-auto">
              {gifLoading ? (
                <div className="col-span-3 grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>
              ) : gifs.length === 0 ? (
                <p className="col-span-3 py-8 text-center text-xs text-fg-muted">No GIFs found.</p>
              ) : (
                gifs.map((g) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={g.id} src={g.preview} alt="gif" onClick={() => void send("", [g.url])} className="h-24 w-full cursor-pointer rounded-lg object-cover transition hover:opacity-80" />
                ))
              )}
            </div>
          </PanelWrap>
        )}
      </AnimatePresence>

      {/* composer */}
      <div className="border-t border-[var(--panel-border)] p-3">
        {recording ? (
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => stopRec(true)} aria-label="Cancel recording" className="grid h-10 w-10 place-items-center rounded-xl text-danger transition hover:bg-danger/10">
              <Trash2 className="h-5 w-5" />
            </button>
            <div className="flex flex-1 items-center gap-2 rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
              Recording… {String(Math.floor(recSec / 60)).padStart(2, "0")}:{String(recSec % 60).padStart(2, "0")}
            </div>
            <button type="button" onClick={() => stopRec(false)} aria-label="Send voice" className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-r from-accent to-accent-2 text-on-accent transition hover:brightness-110">
              <Send className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-1.5">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAndSend(f, "chat"); }} />
            <ComposerBtn label="Attach image" onClick={() => fileRef.current?.click()} disabled={uploading || !convId} active={false}>
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            </ComposerBtn>
            <ComposerBtn label="Stickers" onClick={() => setPanel((p) => (p === "sticker" ? "none" : "sticker"))} active={panel === "sticker"}>
              <Sticker className="h-5 w-5" />
            </ComposerBtn>
            <ComposerBtn label="GIFs" onClick={openGifs} active={panel === "gif"}>
              <span className="text-[11px] font-black tracking-tight">GIF</span>
            </ComposerBtn>
            <ComposerBtn label="Emoji" onClick={() => setPanel((p) => (p === "emoji" ? "none" : "emoji"))} active={panel === "emoji"}>
              <Smile className="h-5 w-5" />
            </ComposerBtn>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }}
              rows={1}
              placeholder="Write a message…"
              className="field max-h-32 min-h-[40px] flex-1 resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
            />
            {text.trim() ? (
              <button type="button" onClick={() => void send(text)} disabled={sending} aria-label="Send" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-r from-accent to-accent-2 text-on-accent transition hover:brightness-110 disabled:opacity-50">
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            ) : (
              <button type="button" onClick={startRec} disabled={uploading || !convId} aria-label="Record voice" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-fg-muted transition hover:text-accent disabled:opacity-50">
                <Mic className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </div>

      <CallOverlay key={call.sessionId} call={call} peer={peer} />
    </div>
  );
}

function ComposerBtn({ label, onClick, disabled, active, children }: { label: string; onClick: () => void; disabled?: boolean; active: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl transition hover:text-accent disabled:opacity-50", active ? "text-accent" : "text-fg-muted")}
    >
      {children}
    </button>
  );
}

function PanelWrap({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-[var(--panel-border)]">
      <div className="p-3">{children}</div>
    </motion.div>
  );
}

function MessageBubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  const sticker = m.attachments.length === 0 && isEmojiOnly(m.text);
  if (sticker) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} className={cn("flex", mine ? "justify-end" : "justify-start")}>
        <div className="text-5xl">{m.text}</div>
      </motion.div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2.5", mine ? "bg-gradient-to-br from-accent to-accent-2 text-on-accent" : "card")}>
        {m.attachments.map((src) =>
          AUDIO_RE.test(src) ? (
            <audio key={src} controls src={src} className="my-1 h-9 w-56 max-w-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className={cn("mb-1.5 rounded-lg object-cover", GIF_RE.test(src) ? "max-h-52" : "max-h-60")} />
          ),
        )}
        {m.text && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.text}</p>}
        <div className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", mine ? "text-on-accent/60" : "text-fg-muted")}>
          {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
          {mine && (m.read ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />)}
        </div>
      </div>
    </motion.div>
  );
}
