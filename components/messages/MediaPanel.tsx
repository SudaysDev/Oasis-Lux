"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Lock, Search, Send, Star, Crown } from "lucide-react";
import { loadSavedGifs, loadSavedStickers, toggleSavedGif, toggleSavedSticker } from "@/lib/saved-media";
import { Modal } from "./overlays";
import { cn } from "@/lib/utils";

const EMOJIS = (
  "😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😋 😜 🤪 🤨 🧐 🤓 😎 🥳 🤩 😏 😴 😪 " +
  "😔 😟 🙁 😣 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 🤗 🤔 🫡 🤭 🙄 😬 🤥 🤤 🥴 🤢 " +
  "🤮 🤧 😷 🤒 🤑 🤠 😈 👍 👎 👏 🙏 🙌 🤝 💪 🔥 ❤️ 🧡 💛 💚 💙 💜 🖤 💯 🎉 ✨ 👀 💸 🎁 💎 👑"
).split(" ");

const FREE_STICKERS = ["🔥", "😂", "😍", "👍", "🙏", "🎉", "💯", "👀", "🤝", "❤️", "😎", "🥳", "🫶", "💎", "🚀", "👑", "✨", "😭", "🤡", "💀"];
const PREMIUM_STICKERS = ["🦄", "🐉", "👽", "🤖", "🧠", "🦾", "🕶️", "🏆", "💰", "🎯", "🪩", "🧨", "🌟", "⚡", "🦋", "🪙", "🛸", "🧬", "🩷", "🫧"];

type Tab = "emoji" | "sticker" | "gif";
type Gif = { id: string; url: string; preview: string };
type PressTarget = { kind: "sticker" | "gif"; value: string; preview?: string; saved: boolean };

/** Telegram-style press: tap = primary action, long-press / right-click = menu. */
function PressButton({
  onTap,
  onHold,
  className,
  children,
}: {
  onTap: () => void;
  onHold: () => void;
  className?: string;
  children: ReactNode;
}) {
  const timer = useRef<number | undefined>(undefined);
  const held = useRef(false);
  const start = () => {
    held.current = false;
    timer.current = window.setTimeout(() => { held.current = true; onHold(); }, 430);
  };
  const end = (fire: boolean) => {
    window.clearTimeout(timer.current);
    if (fire && !held.current) onTap();
  };
  return (
    <button
      type="button"
      onContextMenu={(e) => { e.preventDefault(); onHold(); }}
      onPointerDown={start}
      onPointerUp={() => end(true)}
      onPointerLeave={() => end(false)}
      className={className}
    >
      {children}
    </button>
  );
}

export function MediaPanel({
  userId,
  isPaid,
  onInsertEmoji,
  onSendSticker,
  onSendGif,
  onPremiumBlocked,
}: {
  userId: string;
  isPaid: boolean;
  onInsertEmoji: (e: string) => void;
  onSendSticker: (e: string) => void;
  onSendGif: (url: string) => void;
  onPremiumBlocked: () => void;
}) {
  const [tab, setTab] = useState<Tab>("emoji");
  const [gifQuery, setGifQuery] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [savedGifs, setSavedGifs] = useState<string[]>([]);
  const [savedStickers, setSavedStickers] = useState<string[]>([]);
  const [press, setPress] = useState<PressTarget | null>(null);

  useEffect(() => {
    setSavedGifs(loadSavedGifs(userId));
    setSavedStickers(loadSavedStickers(userId));
  }, [userId]);

  const loadGifs = async (q: string) => {
    setGifLoading(true);
    try {
      const res = await fetch(`/api/gifs?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as { gifs: Gif[] };
      setGifs(json.gifs ?? []);
    } catch {
      setGifs([]);
    } finally {
      setGifLoading(false);
    }
  };

  const openGifTab = () => {
    setTab("gif");
    if (gifs.length === 0) void loadGifs("");
  };

  const sticker = (e: string, premium: boolean) => {
    if (premium && !isPaid) { onPremiumBlocked(); return; }
    onSendSticker(e);
  };

  const saveSticker = (e: string) => setSavedStickers(toggleSavedSticker(userId, e));
  const saveGif = (url: string) => setSavedGifs(toggleSavedGif(userId, url));

  const TABS: { key: Tab; label: string }[] = [
    { key: "emoji", label: "Emoji" },
    { key: "sticker", label: "Stickers" },
    { key: "gif", label: "GIF" },
  ];

  return (
    <div className="shrink-0 border-t border-[var(--panel-border)]">
      {/* tabs */}
      <div className="flex items-center gap-1 px-3 pt-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => (t.key === "gif" ? openGifTab() : setTab(t.key))}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              tab === t.key ? "neon-border text-accent" : "text-fg-muted hover:text-fg",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "gif" && (
        <div className="px-3 pt-2">
          <div className="flex items-center gap-2 rounded-lg bg-[var(--panel)] px-2.5 py-1.5">
            <Search className="h-4 w-4 text-fg-muted" />
            <input
              value={gifQuery}
              onChange={(e) => setGifQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void loadGifs(gifQuery)}
              placeholder="Search Tenor (Enter)"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>
      )}

      <div className="no-scrollbar max-h-64 overflow-y-auto p-3">
        {tab === "emoji" && (
          <div className="grid grid-cols-8 gap-0.5">
            {EMOJIS.map((e, i) => (
              <button
                key={`${e}-${i}`}
                type="button"
                onClick={() => onInsertEmoji(e)}
                className="grid h-9 w-9 place-items-center rounded-lg text-xl transition hover:bg-[var(--panel)]"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {tab === "sticker" && (
          <div className="space-y-3">
            {savedStickers.length > 0 && (
              <StickerRow title="Favorites" icon={<Star className="h-3 w-3" />}>
                {savedStickers.map((e) => (
                  <PressButton
                    key={`fav-${e}`}
                    onTap={() => onSendSticker(e)}
                    onHold={() => setPress({ kind: "sticker", value: e, saved: true })}
                    className="grid h-14 w-14 place-items-center rounded-xl text-4xl transition hover:scale-110 hover:bg-[var(--panel)]"
                  >
                    {e}
                  </PressButton>
                ))}
              </StickerRow>
            )}

            <StickerRow title="Classic">
              {FREE_STICKERS.map((e) => (
                <PressButton
                  key={e}
                  onTap={() => onSendSticker(e)}
                  onHold={() => setPress({ kind: "sticker", value: e, saved: savedStickers.includes(e) })}
                  className="grid h-14 w-14 place-items-center rounded-xl text-4xl transition hover:scale-110 hover:bg-[var(--panel)]"
                >
                  {e}
                </PressButton>
              ))}
            </StickerRow>

            <StickerRow title="Premium" icon={<Crown className="h-3 w-3 text-amber-400" />}>
              {PREMIUM_STICKERS.map((e) => {
                const locked = !isPaid;
                return (
                  <PressButton
                    key={e}
                    onTap={() => sticker(e, true)}
                    onHold={() => (locked ? onPremiumBlocked() : setPress({ kind: "sticker", value: e, saved: savedStickers.includes(e) }))}
                    className="relative grid h-14 w-14 place-items-center rounded-xl text-4xl transition hover:scale-110 hover:bg-[var(--panel)]"
                  >
                    <span className={cn(locked && "opacity-40 blur-[1px]")}>{e}</span>
                    {locked && (
                      <span className="absolute inset-0 grid place-items-center">
                        <Lock className="h-4 w-4 text-amber-400" />
                      </span>
                    )}
                  </PressButton>
                );
              })}
            </StickerRow>
            {!isPaid && (
              <p className="px-1 text-center text-[11px] text-fg-muted">
                <Crown className="mr-1 inline h-3 w-3 text-amber-400" />
                Premium stickers need a Pro plan.
              </p>
            )}
          </div>
        )}

        {tab === "gif" && (
          <div className="space-y-3">
            {savedGifs.length > 0 && !gifQuery && (
              <div>
                <p className="mb-1.5 flex items-center gap-1 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                  <Star className="h-3 w-3" /> Saved
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {savedGifs.map((url) => (
                    <PressButton
                      key={`sg-${url}`}
                      onTap={() => onSendGif(url)}
                      onHold={() => setPress({ kind: "gif", value: url, preview: url, saved: true })}
                      className="overflow-hidden rounded-lg"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="gif" className="h-24 w-full object-cover transition hover:opacity-80" />
                    </PressButton>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-1.5">
              {gifLoading ? (
                <div className="col-span-3 grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>
              ) : gifs.length === 0 ? (
                <p className="col-span-3 py-8 text-center text-xs text-fg-muted">No GIFs found.</p>
              ) : (
                gifs.map((g) => (
                  <PressButton
                    key={g.id}
                    onTap={() => onSendGif(g.url)}
                    onHold={() => setPress({ kind: "gif", value: g.url, preview: g.preview, saved: savedGifs.includes(g.url) })}
                    className="overflow-hidden rounded-lg"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.preview} alt="gif" className="h-24 w-full object-cover transition hover:opacity-80" />
                  </PressButton>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* long-press / right-click menu */}
      <Modal open={!!press} onClose={() => setPress(null)} className="max-w-xs">
        {press && (
          <div className="text-center">
            {press.kind === "sticker" ? (
              <div className="mx-auto mb-3 text-7xl">{press.value}</div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={press.preview || press.value} alt="" className="mx-auto mb-3 max-h-44 rounded-xl object-contain" />
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  if (press.kind === "sticker") onSendSticker(press.value);
                  else onSendGif(press.value);
                  setPress(null);
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:brightness-110"
              >
                <Send className="h-4 w-4" /> Send
              </button>
              <button
                type="button"
                onClick={() => {
                  if (press.kind === "sticker") saveSticker(press.value);
                  else saveGif(press.value);
                  setPress(null);
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--panel)]"
              >
                <Star className={cn("h-4 w-4", press.saved && "fill-amber-400 text-amber-400")} />
                {press.saved ? "Remove from saved" : "Save to favorites"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StickerRow({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
        {icon} {title}
      </p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}
