// Favorite GIFs / stickers, per user, in localStorage (Telegram-style "saved").
const gifKey = (u: string) => `oasis_saved_gifs_${u}`;
const stickerKey = (u: string) => `oasis_saved_stickers_${u}`;

function read(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
function write(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list.slice(0, 60)));
  } catch {}
}

export const loadSavedGifs = (u: string) => read(gifKey(u));
export const loadSavedStickers = (u: string) => read(stickerKey(u));

/** Toggle an item in a saved list; returns the new list (most-recent first). */
export function toggleSaved(key: string, item: string): string[] {
  const cur = read(key);
  const next = cur.includes(item) ? cur.filter((x) => x !== item) : [item, ...cur];
  write(key, next);
  return next;
}

export const toggleSavedGif = (u: string, url: string) => toggleSaved(gifKey(u), url);
export const toggleSavedSticker = (u: string, emoji: string) => toggleSaved(stickerKey(u), emoji);

// --- muted peers (per user) -------------------------------------------------
// Telegram-style timed mute: peerId -> "until" epoch ms (0 = forever).
type MuteMap = Record<string, number>;
const muteKey = (u: string) => `oasis_mute_${u}`;

function readMute(u: string): MuteMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(muteKey(u));
    return raw ? (JSON.parse(raw) as MuteMap) : {};
  } catch {
    return {};
  }
}
function writeMute(u: string, m: MuteMap) {
  try { localStorage.setItem(muteKey(u), JSON.stringify(m)); } catch {}
}

/** True while a peer is muted (forever, or until its timestamp passes). */
export function isMuted(u: string, peerId: string): boolean {
  const until = readMute(u)[peerId];
  if (until === undefined) return false;
  return until === 0 || until > Date.now();
}

/** The active mute's "until" (0 = forever) or null when not muted. */
export function muteUntil(u: string, peerId: string): number | null {
  return isMuted(u, peerId) ? readMute(u)[peerId]! : null;
}

/** Mute for `durationMs` (null = forever). */
export function setMuted(u: string, peerId: string, durationMs: number | null): void {
  const m = readMute(u);
  m[peerId] = durationMs === null ? 0 : Date.now() + durationMs;
  writeMute(u, m);
}

export function unmute(u: string, peerId: string): void {
  const m = readMute(u);
  delete m[peerId];
  writeMute(u, m);
}

// --- pinned chats (per user) ------------------------------------------------
const pinKey = (u: string) => `oasis_pinned_chats_${u}`;
export const loadPinnedChats = (u: string) => read(pinKey(u));
export const isChatPinned = (u: string, convId: string) => read(pinKey(u)).includes(convId);
export const toggleChatPin = (u: string, convId: string) => toggleSaved(pinKey(u), convId);
