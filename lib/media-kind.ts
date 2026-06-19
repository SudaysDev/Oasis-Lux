// Classify a chat attachment URL. We encode the kind in the storage path
// (`<user>/<kind>-<ts>.<ext>` via uploadMedia), so voice notes, video circles,
// videos, images and GIFs are all distinguishable from the URL alone.
export type MediaKind = "circle" | "voice" | "gif" | "video" | "file" | "image";

export function mediaKind(url: string): MediaKind {
  if (/\/circle-/.test(url)) return "circle";
  if (/\/voice-/.test(url)) return "voice";
  if (/\/doc-/.test(url)) return "file";
  if (/\.gif(\?|$)/i.test(url)) return "gif";
  if (/\/video-/.test(url) || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) return "video";
  return "image";
}

export const isVoice = (u: string) => mediaKind(u) === "voice";
export const isCircle = (u: string) => mediaKind(u) === "circle";
/** A "gallery" item is anything shown as a tile in an album (img / video / gif). */
export const isGallery = (u: string) => {
  const k = mediaKind(u);
  return k === "image" || k === "video" || k === "gif";
};
