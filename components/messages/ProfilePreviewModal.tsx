"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { Ban, Bell, BellOff, Check, Copy, Film, Flag, Image as ImageIcon, Link as LinkIcon, MessageSquare, Mic, Phone, ShieldOff, UserRound, Video, X } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { blockUser, fetchBlockState, unblockUser } from "@/lib/data/messages";
import { isMuted as readMuted, setMuted as persistMute, unmute, muteUntil } from "@/lib/saved-media";
import { Avatar } from "@/components/profile/Avatar";
import { PlanBadge, VerifiedBadge } from "@/components/profile/Badges";
import { Modal } from "./overlays";
import { MuteModal } from "./MuteModal";
import { ReportModal } from "./ReportModal";
import { cn, formatTjPhone } from "@/lib/utils";
import type { MiniProfile } from "@/types";

export interface SharedMedia {
  photos: string[];
  videos: string[];
  voice: string[];
  gifs: string[];
}

type Tab = "photos" | "videos" | "voice" | "gifs";

interface FullCard {
  fullName: string;
  bio: string;
  phone?: string;
  showPhone: boolean;
  createdAt?: string;
  birthday?: string;
  links: { label: string; url: string }[];
}

/**
 * Self-contained profile preview — identical everywhere it's used (chat header,
 * forwarded-message author, …). It manages its own block/mute/report relative to
 * `peer`, so callers only pass `meId` + `peer`. `onCall` is supplied only by an
 * active chat (which owns the signalling channel); elsewhere Call/Video open the
 * chat. `onBlockChange`/`onMuteChange` let an active chat mirror the new state.
 */
export function ProfilePreviewModal({
  open,
  onClose,
  meId,
  peer,
  online,
  media,
  onCall,
  onOpenFull,
  onBlockChange,
  onMuteChange,
  profileOnly,
}: {
  open: boolean;
  onClose: () => void;
  meId: string;
  peer: MiniProfile;
  online?: boolean;
  media?: SharedMedia;
  onCall?: (type: "audio" | "video") => void;
  onOpenFull?: () => void;
  onBlockChange?: (iBlocked: boolean) => void;
  onMuteChange?: (muted: boolean) => void;
  /** forwarded-author preview: show ONLY the "Profile" button (no chat actions). */
  profileOnly?: boolean;
}) {
  const [card, setCard] = useState<FullCard | null>(null);
  const [listings, setListings] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("photos");
  const [viewer, setViewer] = useState<string | null>(null);
  const [iBlocked, setIBlocked] = useState(false);
  const [muteTick, setMuteTick] = useState(0); // bump to re-read mute state after a change
  const [muteOpen, setMuteOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const isSelf = peer.id === meId;
  // derived during render (localStorage is client-only & guarded) — no effect needed
  const muted = !isSelf && open && readMuted(meId, peer.id);
  void muteTick;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const sb = getBrowserClient();
    void sb
      .from("profiles")
      .select("full_name, bio, created_at, phone, show_phone, birthday, links")
      .eq("id", peer.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const d = data as { full_name: string | null; bio: string | null; created_at: string; phone: string | null; show_phone: boolean | null; birthday: string | null; links: { label: string; url: string }[] | null };
        setCard({ fullName: d.full_name ?? "", bio: d.bio ?? "", createdAt: d.created_at, phone: d.phone ?? undefined, showPhone: !!d.show_phone, birthday: d.birthday ?? undefined, links: Array.isArray(d.links) ? d.links : [] });
      });
    void sb.from("products").select("id", { count: "exact", head: true }).eq("seller_id", peer.id)
      .then(({ count }) => { if (!cancelled) setListings(count ?? 0); });
    if (!isSelf) {
      void fetchBlockState(sb, meId, peer.id).then((b) => { if (!cancelled) setIBlocked(b.iBlocked); });
    }
    return () => { cancelled = true; };
  }, [open, peer.id, meId, isSelf]);

  const close = () => { setViewer(null); setTab("photos"); onClose(); };
  const go = (href: string) => { window.location.href = href; };

  const applyMute = (durationMs: number | null) => {
    persistMute(meId, peer.id, durationMs);
    setMuteTick((t) => t + 1);
    onMuteChange?.(true);
    const until = muteUntil(meId, peer.id);
    toast(`Muted${until ? ` until ${new Date(until).toLocaleString()}` : " forever"}`, { icon: <BellOff className="h-5 w-5 text-accent" /> });
  };
  const applyUnmute = () => {
    unmute(meId, peer.id);
    setMuteTick((t) => t + 1);
    onMuteChange?.(false);
    toast("Unmuted", { icon: <Bell className="h-5 w-5 text-accent" /> });
  };

  const doBlock = async () => {
    setConfirmBlock(false);
    setIBlocked(true);
    onBlockChange?.(true);
    try { await blockUser(getBrowserClient(), meId, peer.id); }
    catch { setIBlocked(false); onBlockChange?.(false); toast.error("Couldn't block"); }
  };
  const doUnblock = async () => {
    setIBlocked(false);
    onBlockChange?.(false);
    try { await unblockUser(getBrowserClient(), meId, peer.id); }
    catch { setIBlocked(true); onBlockChange?.(true); toast.error("Couldn't unblock"); }
  };

  const name = peer.fullName || card?.fullName || `@${peer.username}`;
  const joined = card?.createdAt
    ? new Date(card.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;
  const phone = card?.showPhone && card.phone ? formatTjPhone(card.phone) : null;
  const birthdayLabel = card?.birthday
    ? new Date(card.birthday).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : null;
  const cardLinks = card?.links ?? [];

  const sm = media ?? { photos: [], videos: [], voice: [], gifs: [] };
  const TABS: { key: Tab; label: string; icon: React.ReactNode; items: string[] }[] = [
    { key: "photos", label: "Photos", icon: <ImageIcon className="h-4 w-4" />, items: sm.photos },
    { key: "videos", label: "Videos", icon: <Video className="h-4 w-4" />, items: sm.videos },
    { key: "voice", label: "Voice", icon: <Mic className="h-4 w-4" />, items: sm.voice },
    { key: "gifs", label: "GIFs", icon: <Film className="h-4 w-4" />, items: sm.gifs },
  ];
  const active = TABS.find((t) => t.key === tab) ?? TABS[0]!;

  return (
    <>
      <Modal open={open} onClose={close} className="no-scrollbar max-h-[88vh] w-full max-w-md overflow-y-auto">
        <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full text-fg-muted transition hover:bg-[var(--panel)] hover:text-fg">
          <X className="h-5 w-5" />
        </button>

        {/* clean header — avatar, name and status */}
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <button type="button" onClick={() => peer.avatarUrl && setViewer(peer.avatarUrl)} className="rounded-full transition hover:opacity-90">
            <Avatar src={peer.avatarUrl} name={peer.username} size={96} />
          </button>
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <h3 className="text-xl font-black">{name}</h3>
              {peer.isVerified && <VerifiedBadge className="h-5 w-5" />}
              <PlanBadge plan={peer.plan} />
            </div>
            <p className={cn("mt-0.5 text-sm", online ? "text-success" : "text-fg-muted")}>
              {online ? "online" : "last seen recently"}
            </p>
          </div>
        </div>

        {/* actions — Telegram-style row that scrolls if it overflows (never cramped) */}
        <div className="no-scrollbar mt-5 flex justify-center gap-1.5 overflow-x-auto pb-1">
          <CircleAction icon={<UserRound className="h-5 w-5" />} label="Profile" onClick={() => (onOpenFull ? onOpenFull() : go(`/profile/${peer.id}`))} />
          {!profileOnly && !isSelf && <CircleAction icon={<MessageSquare className="h-5 w-5" />} label="Message" onClick={() => go(`/messages/${peer.id}`)} />}
          {!profileOnly && !isSelf && <CircleAction icon={<Phone className="h-5 w-5" />} label="Call" onClick={() => (onCall ? onCall("audio") : go(`/messages/${peer.id}`))} disabled={iBlocked} />}
          {!profileOnly && !isSelf && <CircleAction icon={<Video className="h-5 w-5" />} label="Video" onClick={() => (onCall ? onCall("video") : go(`/messages/${peer.id}`))} disabled={iBlocked} />}
          {!profileOnly && !isSelf && <CircleAction icon={muted ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />} label={muted ? "Unmute" : "Mute"} onClick={() => setMuteOpen(true)} />}
          {!profileOnly && !isSelf && <CircleAction icon={<Flag className="h-5 w-5" />} label="Report" onClick={() => setReportOpen(true)} danger />}
          {!profileOnly && !isSelf && <CircleAction icon={iBlocked ? <ShieldOff className="h-5 w-5" /> : <Ban className="h-5 w-5" />} label={iBlocked ? "Unblock" : "Block"} onClick={() => { if (iBlocked) void doUnblock(); else setConfirmBlock(true); }} danger />}
        </div>

        {/* identity card */}
        <div className="mt-5 overflow-hidden rounded-2xl bg-[var(--panel)]">
          <InfoRow label="Username" value={`@${peer.username}`} accent copyable />
          {phone && <InfoRow label="Phone" value={phone} />}
          {birthdayLabel && <InfoRow label="Birthday" value={birthdayLabel} />}
          {card?.bio && <InfoRow label="Bio" value={card.bio} />}
          {joined && <InfoRow label="Joined" value={joined} />}
          <InfoRow label="Listings" value={`${listings ?? 0} active`} />
        </div>

        {/* custom links */}
        {cardLinks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {cardLinks.map((l, i) => (
              <a
                key={i}
                href={/^https?:\/\//.test(l.url) ? l.url : `https://${l.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20"
              >
                <LinkIcon className="h-3.5 w-3.5" />
                {l.label || l.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            ))}
          </div>
        )}

        {/* shared media */}
        <p className="mb-2.5 mt-5 text-[11px] font-bold uppercase tracking-wider text-fg-muted">Shared media</p>
        <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition",
                tab === t.key ? "bg-accent text-on-accent" : "bg-[var(--panel)] text-fg-muted hover:text-fg",
              )}
            >
              {t.icon} {t.label}
              <span className={cn("rounded-full px-1.5 text-[10px]", tab === t.key ? "bg-black/15" : "bg-fg-muted/15")}>{t.items.length}</span>
            </button>
          ))}
        </div>

        {active.items.length === 0 ? (
          <div className="grid place-items-center gap-2 rounded-2xl bg-[var(--panel)] py-10 text-center">
            <span className="text-fg-muted/60">{active.icon}</span>
            <p className="text-sm text-fg-muted">No {active.label.toLowerCase()} shared yet.</p>
          </div>
        ) : tab === "voice" ? (
          <div className="space-y-2">
            {active.items.map((src, i) => <audio key={`${src}-${i}`} controls src={src} className="h-10 w-full" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {active.items.map((src, i) =>
              tab === "videos" ? (
                <video key={`${src}-${i}`} src={src} controls playsInline className="aspect-square w-full rounded-xl object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`${src}-${i}`} src={src} alt="" onClick={() => setViewer(src)} className="aspect-square w-full cursor-zoom-in rounded-xl object-cover transition hover:opacity-90" />
              ),
            )}
          </div>
        )}

        {/* inline full-screen viewer */}
        <AnimatePresence>
          {viewer && (
            <motion.div
              className="fixed inset-0 z-[95] grid place-items-center bg-black/90 p-4"
              onClick={() => setViewer(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.img src={viewer} alt="" className="max-h-[88vh] max-w-full rounded-2xl object-contain" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }} />
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>

      {/* mute options */}
      <MuteModal open={muteOpen} onClose={() => setMuteOpen(false)} peerName={name} muted={muted} onMute={applyMute} onUnmute={applyUnmute} />

      {/* report */}
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} meId={meId} peer={peer} />

      {/* block confirmation */}
      <Modal open={confirmBlock} onClose={() => setConfirmBlock(false)}>
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-danger/10 text-danger"><Ban className="h-6 w-6" /></div>
          <h3 className="mt-3 text-lg font-bold">Block {name}?</h3>
          <p className="mt-1 text-sm text-fg-muted">They won’t be able to message you, and you won’t be able to message them until you unblock.</p>
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setConfirmBlock(false)} className="flex-1 rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--panel)]">Cancel</button>
            <button type="button" onClick={() => void doBlock()} className="flex-1 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">Block</button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function InfoRow({ label, value, accent, copyable }: { label: string; value: string; accent?: boolean; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        toast.success("Username copied");
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error("Copy failed"));
  };

  if (copyable) {
    return (
      <button type="button" onClick={copy} className="group flex w-full items-center justify-between gap-2 border-b border-[var(--panel-border)]/60 px-4 py-3 text-left transition last:border-0 hover:bg-[var(--panel-border)]/20">
        <span className="min-w-0">
          <span className="block text-[11px] uppercase tracking-wider text-fg-muted">{label}</span>
          <span className={cn("mt-0.5 block break-words text-sm font-medium", accent && "text-accent")}>{value}</span>
        </span>
        <span className="shrink-0 text-fg-muted transition group-hover:text-accent">
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </span>
      </button>
    );
  }

  return (
    <div className="border-b border-[var(--panel-border)]/60 px-4 py-3 last:border-0">
      <p className="text-[11px] uppercase tracking-wider text-fg-muted">{label}</p>
      <p className={cn("mt-0.5 break-words text-sm font-medium", accent && "text-accent")}>{value}</p>
    </div>
  );
}

function CircleAction({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="group flex w-[60px] shrink-0 flex-col items-center gap-1.5 disabled:pointer-events-none disabled:opacity-40">
      <span className={cn("grid h-12 w-12 place-items-center rounded-full transition duration-150 group-hover:-translate-y-0.5 group-hover:brightness-125 group-active:scale-90", danger ? "bg-danger/15 text-danger group-hover:bg-danger/25" : "bg-accent/15 text-accent group-hover:bg-accent/25")}>
        {icon}
      </span>
      <span className="text-[11px] font-medium text-fg-muted transition group-hover:text-fg">{label}</span>
    </button>
  );
}
