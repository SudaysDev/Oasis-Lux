"use client";

import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCheck, CornerUpLeft, FileText, Forward, MoreHorizontal, Plus, SmilePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { isCircle, isGallery, isVoice, mediaKind } from "@/lib/media-kind";
import type { ChatMessage } from "@/lib/data/messages";
import type { MiniProfile } from "@/types";

export const isEmojiOnly = (t: string) =>
  t.length > 0 && /^[\p{Extended_Pictographic}‍️\s]+$/u.test(t) && [...t.replace(/\s/g, "")].length <= 6;

// Telegram-style rich text: URLs, @mentions and phone numbers are tinted blue.
// Links open through a confirm modal (onOpenLink); @mentions open the profile
// mini-modal (onOpenMention); phones are tel: links.
const TOKEN_RE = /(https?:\/\/[^\s]+|www\.[^\s]+|@\w{2,}|\+?\d[\d\s\-()]{6,}\d)/g;
export function renderRich(
  text: string,
  onOpenLink?: (url: string) => void,
  onOpenMention?: (username: string) => void,
): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  const linkCls = "break-all font-medium text-sky-300 underline underline-offset-2";
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("@")) {
      out.push(
        <button key={key++} type="button" onClick={(e) => { e.stopPropagation(); onOpenMention?.(tok.slice(1)); }} className="font-medium text-sky-300 hover:underline">
          {tok}
        </button>,
      );
    } else {
      const isPhone = /^\+?[\d\s\-()]+$/.test(tok);
      const href = isPhone ? `tel:${tok.replace(/[^\d+]/g, "")}` : tok.startsWith("http") ? tok : `https://${tok}`;
      if (isPhone) {
        out.push(<a key={key++} href={href} onClick={(e) => e.stopPropagation()} className={linkCls}>{tok}</a>);
      } else {
        out.push(
          <button key={key++} type="button" onClick={(e) => { e.stopPropagation(); onOpenLink?.(href); }} className={linkCls}>
            {tok}
          </button>,
        );
      }
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export const QUICK_REACTIONS = ["❤️", "😂", "🔥", "👍", "😮", "🙏"];

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Quoted preview of the message being replied to (rendered inside a bubble). */
function ReplyQuote({
  reply,
  mine,
  label,
  onJump,
}: {
  reply: ChatMessage;
  mine: boolean;
  label: string;
  onJump?: () => void;
}) {
  const preview = reply.text || (reply.attachments.length ? "📎 Attachment" : "Message");
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onJump?.(); }}
      className={cn(
        "mb-1.5 flex w-full items-stretch gap-2 overflow-hidden rounded-lg border-l-2 px-2 py-1 text-left",
        mine ? "border-on-accent/60 bg-on-accent/10" : "border-accent bg-accent/10",
      )}
    >
      <span className="min-w-0">
        <span className={cn("block text-[11px] font-bold", mine ? "text-on-accent/90" : "text-accent")}>{label}</span>
        <span className={cn("block truncate text-xs", mine ? "text-on-accent/70" : "text-fg-muted")}>{preview}</span>
      </span>
    </button>
  );
}

export interface MessageItemProps {
  m: ChatMessage;
  mine: boolean;
  me: string;
  /** reactions for this message: emoji -> userIds */
  reactions?: Record<string, string[]>;
  /** the resolved message this one replies to (if any) */
  replyTo?: ChatMessage | null;
  replyToMine?: boolean;
  peerName: string;
  isTouch: boolean;
  /** selection (Telegram-style multi-select) */
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  /** forwarded-message attribution */
  forwardedFromProfile?: MiniProfile | null;
  onOpenForwarded?: (mini: MiniProfile) => void;
  onReply: (m: ChatMessage) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onOpenActions: (m: ChatMessage, anchor: DOMRect) => void;
  onOpenImage: (src: string) => void;
  onOpenGif?: (src: string) => void;
  onJumpTo?: (id: string) => void;
  onOpenLink?: (url: string) => void;
  onOpenMention?: (username: string) => void;
}

export function MessageItem({
  m,
  mine,
  me,
  reactions,
  replyTo,
  replyToMine,
  peerName,
  isTouch,
  selectMode,
  selected,
  onToggleSelect,
  forwardedFromProfile,
  onOpenForwarded,
  onReply,
  onToggleReaction,
  onOpenActions,
  onOpenImage,
  onOpenGif,
  onJumpTo,
  onOpenLink,
  onOpenMention,
}: MessageItemProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const select = () => onToggleSelect?.(m.id);
  const sticker = m.attachments.length === 0 && isEmojiOnly(m.text);
  const reactionEntries = Object.entries(reactions ?? {}).filter(([, ids]) => ids.length > 0);

  const meta = (
    <div className={cn("mt-0.5 flex items-center gap-1 px-1 text-[10px] text-fg-muted", mine ? "justify-end" : "justify-start")}>
      <span className="font-mono">{timeLabel(m.createdAt)}</span>
      {mine &&
        (m.read ? (
          <CheckCheck className="h-3.5 w-3.5 text-accent" aria-label="Read" />
        ) : (
          <Check className="h-3.5 w-3.5" aria-label="Sent" />
        ))}
    </div>
  );

  // hover toolbar (desktop only — touch uses the long-press / tap sheet)
  const toolbar = !isTouch && !selectMode && (
    <div
      className={cn(
        "relative z-10 mb-6 flex shrink-0 items-center gap-0.5 self-end opacity-0 transition-opacity duration-150 group-hover:opacity-100",
        mine ? "order-first" : "order-last",
      )}
    >
      <button
        type="button"
        aria-label="React"
        onClick={() => setPickerOpen((v) => !v)}
        className="grid h-8 w-8 place-items-center rounded-full text-fg-muted transition hover:bg-[var(--panel)] hover:text-accent"
      >
        <SmilePlus className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Reply"
        onClick={() => onReply(m)}
        className="grid h-8 w-8 place-items-center rounded-full text-fg-muted transition hover:bg-[var(--panel)] hover:text-accent"
      >
        <CornerUpLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="More"
        onClick={(e) => onOpenActions(m, e.currentTarget.getBoundingClientRect())}
        className="grid h-8 w-8 place-items-center rounded-full text-fg-muted transition hover:bg-[var(--panel)] hover:text-accent"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {/* inline reaction picker (desktop) */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="popover absolute bottom-full left-1/2 z-20 mb-2 flex -translate-x-1/2 items-center gap-0.5 rounded-full p-1"
            onMouseLeave={() => setPickerOpen(false)}
          >
            {QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onToggleReaction(m.id, e);
                  setPickerOpen(false);
                }}
                className="grid h-8 w-8 place-items-center rounded-full text-lg transition hover:scale-125 hover:bg-[var(--panel)]"
              >
                {e}
              </button>
            ))}
            <button
              type="button"
              aria-label="More emoji"
              onClick={(e) => {
                setPickerOpen(false);
                onOpenActions(m, e.currentTarget.getBoundingClientRect());
              }}
              className="grid h-8 w-8 place-items-center rounded-full text-fg-muted transition hover:bg-[var(--panel)] hover:text-accent"
            >
              <Plus className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const fwdName = forwardedFromProfile?.fullName || (forwardedFromProfile ? `@${forwardedFromProfile.username}` : "User");
  const bubbleInner = (
    <>
      {m.forwardedFrom && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (selectMode) { select(); return; }
            if (forwardedFromProfile) onOpenForwarded?.(forwardedFromProfile);
          }}
          className={cn(
            "mb-1.5 flex items-center gap-1 text-left text-[11px] font-semibold transition hover:underline",
            mine ? "text-on-accent/80" : "text-accent",
          )}
        >
          <Forward className="h-3 w-3" />
          <span className="opacity-70">Forwarded from</span> {fwdName}
        </button>
      )}
      {replyTo && (
        <ReplyQuote
          reply={replyTo}
          mine={mine}
          label={replyToMine ? "You" : peerName}
          onJump={onJumpTo ? () => onJumpTo(replyTo.id) : undefined}
        />
      )}
      <Attachments urls={m.attachments} onOpenImage={onOpenImage} onOpenGif={onOpenGif} />
      {m.text && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{renderRich(m.text, onOpenLink, onOpenMention)}</p>}
    </>
  );

  return (
    <motion.div
      id={`m-${m.id}`}
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={selectMode ? select : undefined}
      className={cn(
        "group flex w-full scroll-mt-4 items-center gap-1.5",
        mine ? "justify-end" : "justify-start",
        selectMode && "-mx-2 cursor-pointer rounded-xl px-2 py-1 transition",
        selectMode && selected && "bg-accent/10",
      )}
    >
      {/* selection checkbox (leading edge, like Telegram) */}
      {selectMode && !mine && (
        <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border transition", selected ? "border-accent bg-accent text-on-accent" : "border-fg-muted/50")}>
          {selected && <Check className="h-4 w-4" />}
        </span>
      )}

      {toolbar}

      <div className={cn("flex min-w-0 max-w-[82%] flex-col", mine ? "items-end" : "items-start")}>
        {/* bubble (or bare sticker) */}
        {sticker ? (
          <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
            {m.forwardedFrom && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); if (selectMode) { select(); return; } if (forwardedFromProfile) onOpenForwarded?.(forwardedFromProfile); }}
                className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-accent transition hover:underline"
              >
                <Forward className="h-3 w-3" /> <span className="opacity-70">Forwarded from</span> {fwdName}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { if (selectMode) { select(); return; } if (isTouch) onOpenActions(m, e.currentTarget.getBoundingClientRect()); }}
              className="text-5xl leading-none"
            >
              {m.text}
            </button>
          </div>
        ) : (
          <div
            onClick={(e) => { if (selectMode) { select(); return; } if (isTouch) onOpenActions(m, (e.currentTarget as HTMLElement).getBoundingClientRect()); }}
            className={cn(
              "rounded-2xl px-3.5 py-2.5",
              mine ? "rounded-br-md bg-gradient-to-br from-accent to-accent-2 text-on-accent" : "card rounded-bl-md",
            )}
          >
            {bubbleInner}
          </div>
        )}

        {/* reactions */}
        {reactionEntries.length > 0 && (
          <div className={cn("mt-1 flex flex-wrap gap-1", mine ? "justify-end" : "justify-start")}>
            {reactionEntries.map(([emoji, ids]) => {
              const reacted = ids.includes(me);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onToggleReaction(m.id, emoji)}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition",
                    reacted
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-[var(--panel-border)] bg-[var(--panel)] text-fg-muted hover:border-accent/50",
                  )}
                >
                  <span className="text-sm leading-none">{emoji}</span>
                  <span className="font-mono text-[10px]">{ids.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* meta — time + delivery ticks live OUTSIDE the bubble */}
        {meta}
      </div>

      {/* selection checkbox for own messages (trailing edge) */}
      {selectMode && mine && (
        <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border transition", selected ? "border-accent bg-accent text-on-accent" : "border-fg-muted/50")}>
          {selected && <Check className="h-4 w-4" />}
        </span>
      )}
    </motion.div>
  );
}

// ---- attachment rendering --------------------------------------------------
function Attachments({
  urls,
  onOpenImage,
  onOpenGif,
}: {
  urls: string[];
  onOpenImage: (s: string) => void;
  onOpenGif?: (s: string) => void;
}) {
  const circles = urls.filter(isCircle);
  const voices = urls.filter(isVoice);
  const files = urls.filter((u) => mediaKind(u) === "file");
  const gallery = urls.filter(isGallery);
  return (
    <>
      {circles.map((src) => <CircleVideo key={src} src={src} />)}
      {voices.map((src) => (
        <audio key={src} controls src={src} onClick={(e) => e.stopPropagation()} className="my-1 h-10 w-60 max-w-full" />
      ))}
      {files.map((src) => (
        <a
          key={src}
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="my-1 flex w-56 max-w-full items-center gap-2.5 rounded-xl bg-black/10 px-3 py-2.5 transition hover:bg-black/20"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/20 text-accent">
            <FileText className="h-4 w-4" />
          </span>
          <span className="truncate text-sm font-medium">{decodeURIComponent(src.split("/").pop() || "Document").replace(/^doc-\d+\./, "file.")}</span>
        </a>
      ))}
      {gallery.length > 0 && <Gallery urls={gallery} onOpenImage={onOpenImage} onOpenGif={onOpenGif} />}
    </>
  );
}

function Gallery({
  urls,
  onOpenImage,
  onOpenGif,
}: {
  urls: string[];
  onOpenImage: (s: string) => void;
  onOpenGif?: (s: string) => void;
}) {
  if (urls.length === 1) return <div className="mb-1"><Tile src={urls[0]!} single onOpenImage={onOpenImage} onOpenGif={onOpenGif} /></div>;
  const shown = urls.slice(0, 4);
  const extra = urls.length - shown.length;
  return (
    <div className="mb-1 grid w-64 max-w-full grid-cols-2 gap-1 overflow-hidden rounded-xl">
      {shown.map((src, i) => (
        <div key={src} className={cn("relative", urls.length === 3 && i === 0 && "col-span-2")}>
          <Tile src={src} onOpenImage={onOpenImage} onOpenGif={onOpenGif} />
          {i === 3 && extra > 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/55 text-xl font-bold text-white">
              +{extra}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Tile({
  src,
  single,
  onOpenImage,
  onOpenGif,
}: {
  src: string;
  single?: boolean;
  onOpenImage: (s: string) => void;
  onOpenGif?: (s: string) => void;
}) {
  const kind = mediaKind(src);
  if (kind === "video") {
    return (
      <video
        src={src}
        controls
        playsInline
        onClick={(e) => e.stopPropagation()}
        className={cn("rounded-lg object-cover", single ? "max-h-60 w-full" : "aspect-square h-full w-full")}
      />
    );
  }
  const open = kind === "gif" && onOpenGif ? onOpenGif : onOpenImage;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      onClick={(e) => { e.stopPropagation(); open(src); }}
      className={cn(
        "cursor-zoom-in rounded-lg object-cover transition hover:opacity-90",
        single ? (kind === "gif" ? "max-h-52" : "max-h-60") : "aspect-square h-full w-full",
      )}
    />
  );
}

/** Telegram-style round video note: autoplays muted, tap to toggle sound. */
function CircleVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  return (
    <div className="my-1">
      <video
        ref={ref}
        src={src}
        autoPlay
        loop
        muted={muted}
        playsInline
        onClick={(e) => {
          e.stopPropagation();
          const v = ref.current;
          if (!v) return;
          v.muted = !v.muted;
          setMuted(v.muted);
          void v.play().catch(() => {});
        }}
        className="h-44 w-44 cursor-pointer rounded-full object-cover shadow-lg"
      />
    </div>
  );
}
