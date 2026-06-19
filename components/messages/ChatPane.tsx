"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Ban, Bell, BellOff, Camera, CheckCircle2, Copy, CornerUpLeft, Eraser, FileText, Flag, Forward,
  Image as ImageIcon, ImagePlus, Link2, Loader2, Mic, MoreVertical, Phone, Pin, PinOff, Send, ShieldOff, Smile, Sparkles, Star,
  Trash2, UserRound, Video, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { getBrowserClient } from "@/lib/supabase/client";
import { uploadMedia } from "@/lib/data/profile-mutations";
import { isMuted, muteUntil, setMuted as persistMute, unmute, toggleSavedGif } from "@/lib/saved-media";
import { mediaKind } from "@/lib/media-kind";
import { useAuth } from "@/hooks/useAuth";
import { isPaidPlan } from "@/lib/plans";
import {
  blockUser, clearHistoryForMe, clearMyReaction, deleteMessage, fetchBlockState, fetchConversations, fetchMessages, fetchMyClearedAt,
  fetchPeerMini, fetchPinnedMessageIds, fetchReactions, getOrCreateConversation, markRead, mapMessage, pinMessage,
  sendMessage, setMyReaction, unblockUser, unpinMessage, type BlockState, type ChatMessage, type ReactionMap,
} from "@/lib/data/messages";
import { useCall } from "@/hooks/useCall";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/profile/Avatar";
import { PlanBadge, VerifiedBadge } from "@/components/profile/Badges";
import { CallOverlay } from "@/components/messages/CallOverlay";
import { MessageItem } from "@/components/messages/MessageItem";
import { MessageMenu, MenuRow } from "@/components/messages/MessageMenu";
import { MediaPanel } from "@/components/messages/MediaPanel";
import { Lightbox, Modal } from "@/components/messages/overlays";
import { ForwardModal } from "@/components/messages/ForwardModal";
import { ReportModal } from "@/components/messages/ReportModal";
import { ComposeMediaModal } from "@/components/messages/ComposeMediaModal";
import { ProfilePreviewModal } from "@/components/messages/ProfilePreviewModal";
import { MuteModal } from "@/components/messages/MuteModal";
import { AnchoredMenu, AnchoredItem } from "@/components/ui/AnchoredMenu";
import type { MiniProfile } from "@/types";

const QUICK_REPLIES = ["Is this item authentic?", "Is it still available?", "When can you deliver?", "Can you do a better price?"];

const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();
/** Telegram-style day divider: Today / Yesterday / localized date. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

export function ChatPane({ meId, peerId, peer: peerInitial }: { meId: string; peerId: string; peer?: MiniProfile }) {
  const sb = getBrowserClient();
  const { profile: myProfile } = useAuth();
  const isPaid = isPaidPlan(myProfile?.plan ?? "free");
  const [peer, setPeer] = useState<MiniProfile | null>(peerInitial ?? null);
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<ReactionMap>({});
  const [block, setBlock] = useState<BlockState>({ iBlocked: false, blockedMe: false });
  const [loading, setLoading] = useState(meId !== peerId);
  const [notFound, setNotFound] = useState(false);
  const [online, setOnline] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);

  // composer reply state + overlays
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [actionTarget, setActionTarget] = useState<ChatMessage | null>(null);
  const [actionAnchor, setActionAnchor] = useState<DOMRect | null>(null);
  const [forwardMsgs, setForwardMsgs] = useState<ChatMessage[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [gifView, setGifView] = useState<string | null>(null);

  // Telegram-style multi-select
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // forwarded-message attribution: resolved minis + the mini-profile modal target
  const [fwdProfiles, setFwdProfiles] = useState<Record<string, MiniProfile>>({});
  const [forwardedPeer, setForwardedPeer] = useState<MiniProfile | null>(null);
  // forwarded-author preview shows ONLY a "Profile" button; @mention shows the full modal
  const [fwdProfileOnly, setFwdProfileOnly] = useState(false);

  // @mention autocomplete (from your chats)
  const [convPeers, setConvPeers] = useState<MiniProfile[]>([]);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);

  // pinned messages (Telegram-style banner; cycle through multiple pins)
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [pinIndex, setPinIndex] = useState(0);

  // tapping a link in a message asks first; tapping @username opens the mini profile
  const [linkConfirm, setLinkConfirm] = useState<string | null>(null);

  // attachments / compose / profile preview / mute
  const [attachAnchor, setAttachAnchor] = useState<DOMRect | null>(null);
  const [composeFiles, setComposeFiles] = useState<File[]>([]);
  const [composeSending, setComposeSending] = useState(false);
  const [profilePreview, setProfilePreview] = useState(false);
  const [muted, setMuted] = useState(false);

  // video circle (round video note) recording
  const [circleRec, setCircleRec] = useState(false);
  const [circleSec, setCircleSec] = useState(0);
  const circleStreamRef = useRef<MediaStream | null>(null);
  const circleRecorderRef = useRef<MediaRecorder | null>(null);
  const circleChunksRef = useRef<Blob[]>([]);
  const circleCancelRef = useRef(false);
  const circleVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [headerAnchor, setHeaderAnchor] = useState<DOMRect | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reportTarget, setReportTarget] = useState<MiniProfile | null>(null);
  const [muteOpen, setMuteOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // voice recording
  const [recording, setRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recCancelRef = useRef(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);
  const selfChat = meId === peerId;
  // resolve after mount so SSR and first client render agree (no hydration drift)
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => { setIsTouch(window.matchMedia("(hover: none)").matches); }, []);
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  // shared media (actual URLs) for the profile preview's browsable tabs
  const sharedMedia = useMemo(() => {
    const m: { photos: string[]; videos: string[]; voice: string[]; gifs: string[] } = { photos: [], videos: [], voice: [], gifs: [] };
    for (const msg of messages) {
      for (const a of msg.attachments) {
        const k = mediaKind(a);
        if (k === "image") m.photos.push(a);
        else if (k === "video" || k === "circle") m.videos.push(a);
        else if (k === "voice") m.voice.push(a);
        else if (k === "gif") m.gifs.push(a);
      }
    }
    return m;
  }, [messages]);

  useEffect(() => { setMuted(isMuted(meId, peerId)); }, [meId, peerId]);

  // resolve the original authors of forwarded messages (skipping me & the peer)
  useEffect(() => {
    const ids = Array.from(new Set(messages.map((m) => m.forwardedFrom).filter(Boolean) as string[]));
    const missing = ids.filter((id) => id !== meId && id !== peerId && !fwdProfiles[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    void Promise.all(missing.map((id) => fetchPeerMini(sb, id))).then((minis) => {
      if (cancelled) return;
      setFwdProfiles((prev) => {
        const next = { ...prev };
        minis.forEach((mp, i) => { if (mp) next[missing[i]!] = mp; });
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [messages, meId, peerId, sb, fwdProfiles]);

  // load my chats once → @mention candidates
  useEffect(() => {
    let cancelled = false;
    void fetchConversations(sb, meId).then((cs) => { if (!cancelled) setConvPeers(cs.map((c) => c.peer)); }).catch(() => {});
    return () => { cancelled = true; };
  }, [meId, sb]);

  const call = useCall(channelRef, meId);
  const onSignalRef = useRef(call.onSignal);
  useEffect(() => { onSignalRef.current = call.onSignal; }, [call.onSignal]);

  // resolve peer + conversation + history + reactions + block state
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
        const cleared = await fetchMyClearedAt(sb, id, meId);
        const [msgs, reacts, blk, pins] = await Promise.all([
          fetchMessages(sb, id, cleared),
          fetchReactions(sb, id),
          fetchBlockState(sb, meId, peerId),
          fetchPinnedMessageIds(sb, id),
        ]);
        if (cancelled) return;
        setMessages(msgs);
        setReactions(reacts);
        setBlock(blk);
        setPinnedIds(pins);
        void markRead(sb, id, meId);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, peerId]);

  // realtime: messages (insert/update/delete) + reactions + presence + calls + blocks
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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
        (payload) => {
          const m = mapMessage(payload.new as Parameters<typeof mapMessage>[0]);
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (id) setMessages((prev) => prev.filter((x) => x.id !== id));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reactions", filter: `conversation_id=eq.${convId}` },
        (payload) => {
          const r = payload.new as { message_id: string; emoji: string; user_id: string };
          setReaction(setReactions, r.message_id, r.emoji, r.user_id, true);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "message_reactions" },
        (payload) => {
          const r = payload.old as { message_id: string; emoji: string; user_id: string };
          if (r.message_id) setReaction(setReactions, r.message_id, r.emoji, r.user_id, false);
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "blocks" }, () => {
        void fetchBlockState(sb, meId, peerId).then(setBlock).catch(() => {});
      })
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${convId}` },
        (payload) => {
          const row = payload.new as { pinned_message_ids: string[] | null };
          setPinnedIds(row.pinned_message_ids ?? []);
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

  // recording timers
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);
  useEffect(() => {
    if (!circleRec) return;
    const t = setInterval(() => setCircleSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [circleRec]);

  const blocked = block.iBlocked || block.blockedMe;

  const pushMessage = (m: ChatMessage | null) =>
    m && setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));

  const send = async (body: string, attachments: string[] = []) => {
    const t = body.trim();
    if ((!t && attachments.length === 0) || !convId || sending) return;
    if (blocked) { toast.error(block.iBlocked ? "Unblock to send a message" : "You can't message this user"); return; }
    const replyId = replyingTo?.id ?? null;
    setSending(true);
    setText("");
    setReplyingTo(null);
    try {
      pushMessage(await sendMessage(sb, convId, meId, peerId, t, attachments, replyId));
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

  // ---- attachments: pick → compose → send as one album ---------------------
  const onPickedFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (list) setComposeFiles((prev) => [...prev, ...Array.from(list)].slice(0, 10));
    e.target.value = "";
  };
  const sendCompose = async (caption: string) => {
    if (!convId || composeFiles.length === 0 || composeSending) return;
    setComposeSending(true);
    try {
      const urls: string[] = [];
      for (const f of composeFiles) {
        const kind = f.type.startsWith("video") ? "video" : f.type.startsWith("image") ? "chat" : "doc";
        urls.push(await uploadMedia(sb, meId, f, kind));
      }
      await send(caption, urls);
      setComposeFiles([]);
    } catch {
      toast.error("Upload failed");
    } finally {
      setComposeSending(false);
    }
  };

  // ---- mute (Telegram-style timed options) ---------------------------------
  const applyMute = (durationMs: number | null) => {
    persistMute(meId, peerId, durationMs);
    setMuted(true);
    const until = muteUntil(meId, peerId);
    toast(`Muted ${peerName}${until ? ` until ${new Date(until).toLocaleString()}` : " forever"}`, { icon: <BellOff className="h-5 w-5 text-accent" /> });
  };
  const applyUnmute = () => {
    unmute(meId, peerId);
    setMuted(false);
    toast(`Unmuted ${peerName}`, { icon: <Bell className="h-5 w-5 text-accent" /> });
  };

  // ---- clear history ("delete for me") -------------------------------------
  const doClearHistory = async () => {
    setConfirmClear(false);
    if (!convId) return;
    const prev = messages;
    setMessages([]); // optimistic
    try {
      await clearHistoryForMe(sb, convId, meId);
      toast.success("History cleared");
    } catch {
      setMessages(prev);
      toast.error("Couldn't clear history");
    }
  };

  // ---- video circle (round video note) -------------------------------------
  const startCircle = async () => {
    if (blocked) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 480, facingMode: "user" },
        audio: true,
      });
      circleStreamRef.current = stream;
      const rec = new MediaRecorder(stream);
      circleChunksRef.current = [];
      circleCancelRef.current = false;
      rec.ondataavailable = (e) => e.data.size > 0 && circleChunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        circleStreamRef.current = null;
        if (circleCancelRef.current) return;
        const blob = new Blob(circleChunksRef.current, { type: rec.mimeType || "video/webm" });
        const ext = (rec.mimeType || "").includes("mp4") ? "mp4" : "webm";
        void uploadAndSend(new File([blob], `circle-${Date.now()}.${ext}`, { type: blob.type }), "circle");
      };
      circleRecorderRef.current = rec;
      rec.start();
      setCircleSec(0);
      setCircleRec(true);
      setTimeout(() => {
        if (circleVideoRef.current) {
          circleVideoRef.current.srcObject = stream;
          void circleVideoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch {
      toast.error("Camera access denied");
    }
  };
  const stopCircle = (cancel: boolean) => {
    circleCancelRef.current = cancel;
    circleRecorderRef.current?.stop();
    circleRecorderRef.current = null;
    setCircleRec(false);
  };

  // ---- reactions (one per user per message, Telegram-style) ----------------
  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!convId) return;
    const hadThis = reactions[messageId]?.[emoji]?.includes(meId) ?? false;
    setMyReactionLocal(setReactions, messageId, meId, hadThis ? null : emoji); // optimistic
    try {
      if (hadThis) await clearMyReaction(sb, messageId, meId);
      else await setMyReaction(sb, { messageId, conversationId: convId, userId: meId, emoji });
    } catch {
      void fetchReactions(sb, convId).then(setReactions).catch(() => {}); // resync on error
      toast.error("Couldn't update reaction");
    }
  };

  const removeMessage = async (m: ChatMessage) => {
    setActionTarget(null);
    const prev = messages;
    setMessages((cur) => cur.filter((x) => x.id !== m.id)); // optimistic
    try {
      await deleteMessage(sb, m.id);
    } catch {
      setMessages(prev);
      toast.error("Couldn't delete message");
    }
  };

  const copyText = (m: ChatMessage) => {
    if (!m.text) return;
    void navigator.clipboard?.writeText(m.text).then(
      () => toast.success("Copied"),
      () => toast.error("Copy failed"),
    );
    setActionTarget(null);
  };

  const copyMessageLink = (m: ChatMessage) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    void navigator.clipboard?.writeText(`${origin}/messages/${peerId}#m-${m.id}`).then(
      () => toast.success("Link copied"),
      () => toast.error("Copy failed"),
    );
    setActionTarget(null);
  };

  // ---- pin / unpin ---------------------------------------------------------
  const myName = myProfile?.fullName || (myProfile ? `@${myProfile.username}` : "Someone");
  const doPin = async (m: ChatMessage) => {
    setActionTarget(null);
    if (!convId) return;
    setPinnedIds((prev) => (prev.includes(m.id) ? prev : [...prev, m.id])); // optimistic
    try {
      pushMessage(await pinMessage(sb, { conversationId: convId, messageId: m.id, meId, recipientId: peerId, byName: myName }));
      toast.success("Pinned");
    } catch {
      toast.error("Couldn't pin");
    }
  };
  const doUnpin = async (messageId: string) => {
    if (!convId) return;
    const prev = pinnedIds;
    setPinnedIds((p) => p.filter((id) => id !== messageId)); // optimistic
    try { await unpinMessage(sb, convId, messageId); } catch { setPinnedIds(prev); toast.error("Couldn't unpin"); }
  };
  // jump to the currently shown pin, then advance to the next (Telegram-style cycle)
  const cyclePin = () => {
    if (pinnedIds.length === 0) return;
    const idx = pinIndex % pinnedIds.length;
    jumpTo(pinnedIds[idx]!);
    setPinIndex((i) => (i + 1) % pinnedIds.length);
  };

  // tap @username in a message → open the same mini profile modal
  const openMention = (username: string) => {
    const u = username.toLowerCase();
    const local = convPeers.find((p) => p.username.toLowerCase() === u) || (peer && peer.username.toLowerCase() === u ? peer : null);
    if (local) { setFwdProfileOnly(false); setForwardedPeer(local); return; }
    void sb.from("profiles").select("id, username, full_name, avatar_url, plan, is_verified").eq("username", username).maybeSingle().then(({ data }) => {
      if (!data) { toast(`@${username} not found`); return; }
      const d = data as { id: string; username: string; full_name: string | null; avatar_url: string | null; plan: MiniProfile["plan"] | null; is_verified: boolean | null };
      setFwdProfileOnly(false);
      setForwardedPeer({ id: d.id, username: d.username, fullName: d.full_name ?? "", avatarUrl: d.avatar_url ?? undefined, plan: d.plan ?? "free", isVerified: d.is_verified ?? false });
    });
  };

  // ---- multi-select (Telegram-style) ---------------------------------------
  const selectedMsgs = messages.filter((m) => selectedIds.has(m.id));
  const allMine = selectedMsgs.length > 0 && selectedMsgs.every((m) => m.senderId === meId);
  const enterSelect = (id: string) => { setActionTarget(null); setSelectMode(true); setSelectedIds(new Set([id])); };
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const exitSelect = () => { setSelectMode(false); setSelectedIds(new Set()); };
  const copySelected = () => {
    const text = selectedMsgs
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((m) => m.text)
      .filter(Boolean)
      .join("\n");
    if (!text) { toast.error("Nothing to copy"); return; }
    void navigator.clipboard?.writeText(text).then(() => toast.success("Copied"), () => toast.error("Copy failed"));
    exitSelect();
  };
  const forwardSelected = () => { if (selectedMsgs.length) { setForwardMsgs(selectedMsgs); exitSelect(); } };
  const removeSelected = async () => {
    if (!allMine) return;
    const ids = selectedMsgs.map((m) => m.id);
    const prev = messages;
    exitSelect();
    setMessages((cur) => cur.filter((x) => !ids.includes(x.id))); // optimistic
    try {
      await Promise.all(ids.map((id) => deleteMessage(sb, id)));
    } catch {
      setMessages(prev);
      toast.error("Couldn't delete messages");
    }
  };

  const jumpTo = (id: string) => {
    const el = document.getElementById(`m-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.animate(
      [{ filter: "brightness(1)" }, { filter: "brightness(1.6)" }, { filter: "brightness(1)" }],
      { duration: 1100, easing: "ease-in-out" },
    );
  };

  // ---- block / unblock -----------------------------------------------------
  const doBlock = async () => {
    setConfirmBlock(false);
    setBlock((b) => ({ ...b, iBlocked: true })); // optimistic
    try { await blockUser(sb, meId, peerId); } catch { setBlock((b) => ({ ...b, iBlocked: false })); toast.error("Couldn't block"); }
  };
  const doUnblock = async () => {
    setHeaderAnchor(null);
    setBlock((b) => ({ ...b, iBlocked: false })); // optimistic
    try { await unblockUser(sb, meId, peerId); } catch { setBlock((b) => ({ ...b, iBlocked: true })); toast.error("Couldn't unblock"); }
  };

  // ---- voice recording -----------------------------------------------------
  const startRec = async () => {
    if (blocked) return;
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

  const peerName = peer?.fullName || (peer ? `@${peer.username}` : "User");
  const lastMsg = messages[messages.length - 1];
  const showSeen = !!lastMsg && lastMsg.senderId === meId && lastMsg.read;

  // resolve a forwarded message's original author into a MiniProfile (for the chip + mini modal)
  const meMini: MiniProfile | null = myProfile
    ? { id: meId, username: myProfile.username, fullName: myProfile.fullName, avatarUrl: myProfile.avatarUrl, plan: myProfile.plan, isVerified: myProfile.isVerified }
    : null;
  const miniFor = (id: string): MiniProfile | null =>
    id === meId ? meMini : id === peerId ? peer : (fwdProfiles[id] ?? null);

  // @mention autocomplete
  const onComposerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    const caret = e.target.selectionStart ?? val.length;
    const m = val.slice(0, caret).match(/(?:^|\s)@(\w{0,20})$/);
    setMention(m ? { query: m[1] ?? "", start: caret - (m[1]?.length ?? 0) - 1 } : null);
  };
  const mentionList = mention
    ? convPeers
        .filter((p) => {
          const qq = mention.query.toLowerCase();
          return p.username.toLowerCase().includes(qq) || p.fullName.toLowerCase().includes(qq);
        })
        .slice(0, 6)
    : [];
  const applyMention = (p: MiniProfile) => {
    if (!mention) return;
    const before = text.slice(0, mention.start);
    const after = text.slice(mention.start + 1 + mention.query.length);
    setText(`${before}@${p.username} ${after}`);
    setMention(null);
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* selection top bar (Telegram-style multi-select) */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            className="absolute inset-x-0 top-0 z-30 flex items-center gap-3 border-b border-[var(--panel-border)] bg-bg-elev px-4 py-3"
          >
            <button type="button" onClick={exitSelect} aria-label="Cancel selection" className="grid h-9 w-9 place-items-center rounded-full text-fg-muted transition hover:text-accent">
              <X className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold">{selectedMsgs.length} selected</span>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-fg-muted">
              {allMine ? "your messages" : "tap to select"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--panel-border)] px-4 py-3">
        <Link href="/messages" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full text-fg-muted transition hover:text-accent lg:hidden">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {peer ? (
          <button type="button" onClick={() => setProfilePreview(true)} className="flex min-w-0 items-center gap-3 text-left">
            <div className="relative">
              <Avatar src={peer.avatarUrl} name={peer.username} size={40} />
              <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bg-elev", online ? "bg-success" : "bg-fg-muted")} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold">{peer.fullName || `@${peer.username}`}</span>
                {peer.isVerified && <VerifiedBadge className="h-3.5 w-3.5" />}
                <PlanBadge plan={peer.plan} />
                {muted && <BellOff className="h-3.5 w-3.5 text-fg-muted" />}
              </div>
              <p className="font-mono text-[10px] text-fg-muted">
                {block.iBlocked ? "Blocked" : online ? "Online now" : "Offline · usually replies within a few hours"}
              </p>
            </div>
          </button>
        ) : (
          <div className="h-10 w-40 animate-pulse rounded bg-[var(--panel-border)]" />
        )}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => void call.start("audio")} disabled={!convId || blocked} aria-label="Audio call" className="grid h-9 w-9 place-items-center rounded-full text-fg-muted transition hover:text-accent disabled:opacity-40">
            <Phone className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => void call.start("video")} disabled={!convId || blocked} aria-label="Video call" className="grid h-9 w-9 place-items-center rounded-full text-fg-muted transition hover:text-accent disabled:opacity-40">
            <Video className="h-4 w-4" />
          </button>
          <button type="button" onClick={(e) => setHeaderAnchor(e.currentTarget.getBoundingClientRect())} aria-label="Conversation options" className="grid h-9 w-9 place-items-center rounded-full text-fg-muted transition hover:text-accent">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* pinned messages banner (Telegram-style: tap to cycle, shows position) */}
      {pinnedIds.length > 0 && (() => {
        const idx = pinIndex % pinnedIds.length;
        const cur = pinnedIds[idx]!;
        const pm = byId.get(cur);
        return (
          <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--panel-border)] bg-[var(--panel)]/40 px-4 py-2">
            {/* pin position rail (one tick per pin, current highlighted) */}
            {pinnedIds.length > 1 && (
              <div className="flex h-9 w-0.5 shrink-0 flex-col gap-0.5">
                {pinnedIds.map((id, i) => (
                  <span key={id} className={cn("flex-1 rounded-full", i === idx ? "bg-accent" : "bg-accent/30")} />
                ))}
              </div>
            )}
            <button type="button" onClick={cyclePin} className="min-w-0 flex-1 border-l-2 border-accent pl-2 text-left">
              <p className="flex items-center gap-1 text-[11px] font-bold text-accent">
                <Pin className="h-3 w-3" /> Pinned message{pinnedIds.length > 1 ? ` ${idx + 1}/${pinnedIds.length}` : ""}
              </p>
              <p className="truncate text-xs text-fg-muted">
                {pm?.text || (pm?.attachments.length ? "📎 Attachment" : "Message")}
              </p>
            </button>
            <button type="button" onClick={() => void doUnpin(cur)} aria-label="Unpin" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-fg-muted transition hover:text-danger">
              <PinOff className="h-4 w-4" />
            </button>
          </div>
        );
      })()}

      {/* messages — the only scroll area in this pane */}
      <div ref={scrollRef} className="no-scrollbar min-h-0 flex-1 space-y-2.5 overflow-y-auto overflow-x-hidden p-4">
        {loading ? (
          <div className="grid h-full place-items-center"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
        ) : messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-sm text-fg-muted">No messages yet. Say hello 👋</div>
        ) : (
          <>
            {messages.map((m, i) => {
              const replyTo = m.replyTo ? byId.get(m.replyTo) ?? null : null;
              const prev = messages[i - 1];
              const showDay = !prev || !sameDay(prev.createdAt, m.createdAt);
              return (
                <Fragment key={m.id}>
                {showDay && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-[var(--panel)] px-3 py-1 text-[11px] font-medium text-fg-muted">{dayLabel(m.createdAt)}</span>
                  </div>
                )}
                {m.kind === "service" ? (
                  <div className="flex justify-center py-0.5">
                    <span className="rounded-full bg-[var(--panel)] px-3 py-1 text-center text-[11px] text-fg-muted">{m.text}</span>
                  </div>
                ) : (
                <MessageItem
                  m={m}
                  mine={m.senderId === meId}
                  me={meId}
                  reactions={reactions[m.id]}
                  replyTo={replyTo}
                  replyToMine={replyTo ? replyTo.senderId === meId : false}
                  peerName={peerName}
                  isTouch={isTouch}
                  selectMode={selectMode}
                  selected={selectedIds.has(m.id)}
                  onToggleSelect={toggleSelect}
                  forwardedFromProfile={m.forwardedFrom ? miniFor(m.forwardedFrom) : null}
                  onOpenForwarded={(mini) => { setFwdProfileOnly(true); setForwardedPeer(mini); }}
                  onReply={setReplyingTo}
                  onToggleReaction={(id, e) => void toggleReaction(id, e)}
                  onOpenActions={(msg, rect) => { setActionTarget(msg); setActionAnchor(rect); }}
                  onOpenImage={setLightbox}
                  onOpenGif={setGifView}
                  onJumpTo={jumpTo}
                  onOpenLink={setLinkConfirm}
                  onOpenMention={openMention}
                />
                )}
                </Fragment>
              );
            })}
            {showSeen && (
              <p className="pr-1 pt-0.5 text-right font-mono text-[10px] uppercase tracking-wider text-accent">
                Seen
              </p>
            )}
          </>
        )}
      </div>

      {/* quick replies (empty chat) */}
      {!loading && messages.length === 0 && !blocked && (
        <div className="flex shrink-0 flex-wrap gap-2 px-4 pb-2">
          {QUICK_REPLIES.map((q) => (
            <button key={q} type="button" onClick={() => void send(q)} className="rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-xs text-fg-muted transition hover:neon-border hover:text-accent">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* reply banner */}
      <AnimatePresence>
        {replyingTo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 overflow-hidden border-t border-[var(--panel-border)]"
          >
            <div className="flex items-center gap-3 px-4 py-2">
              <CornerUpLeft className="h-4 w-4 shrink-0 text-accent" />
              <div className="min-w-0 flex-1 border-l-2 border-accent pl-2">
                <p className="text-[11px] font-bold text-accent">
                  Reply to {replyingTo.senderId === meId ? "yourself" : peerName}
                </p>
                <p className="truncate text-xs text-fg-muted">
                  {replyingTo.text || (replyingTo.attachments.length ? "📎 Attachment" : "Message")}
                </p>
              </div>
              <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-fg-muted transition hover:text-danger">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* emoji / stickers / gif — unified Telegram-style panel */}
      <AnimatePresence>
        {mediaOpen && !blocked && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 overflow-hidden"
          >
            <MediaPanel
              userId={meId}
              isPaid={isPaid}
              onInsertEmoji={(e) => setText((t) => t + e)}
              onSendSticker={(e) => void send(e)}
              onSendGif={(url) => void send("", [url])}
              onPremiumBlocked={() => toast("Premium stickers need a Pro plan", { icon: <Sparkles className="h-5 w-5 text-accent" /> })}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* composer (or block banner) */}
      {blocked ? (
        <div className="flex shrink-0 items-center justify-center gap-3 border-t border-[var(--panel-border)] px-4 py-4 text-sm text-fg-muted">
          {block.iBlocked ? (
            <>
              <Ban className="h-4 w-4 text-danger" />
              <span>You blocked {peerName}.</span>
              <button type="button" onClick={() => void doUnblock()} className="font-semibold text-accent hover:underline">Unblock</button>
            </>
          ) : (
            <><ShieldOff className="h-4 w-4" /><span>You can’t send messages to this user.</span></>
          )}
        </div>
      ) : (
        <div className="relative shrink-0 border-t border-[var(--panel-border)] p-3">
          {/* @mention autocomplete (known chats) */}
          {mentionList.length > 0 && (
            <div className="popover absolute inset-x-3 bottom-full mb-2 max-h-56 overflow-y-auto rounded-2xl p-1.5">
              {mentionList.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyMention(p)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-[var(--panel)]"
                >
                  <Avatar src={p.avatarUrl} name={p.username} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{p.fullName || `@${p.username}`}</span>
                    <span className="block truncate text-xs text-fg-muted">@{p.username}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
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
          ) : circleRec ? (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => stopCircle(true)} aria-label="Cancel" className="grid h-10 w-10 place-items-center rounded-xl text-danger transition hover:bg-danger/10">
                <Trash2 className="h-5 w-5" />
              </button>
              <div className="flex flex-1 items-center gap-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                <video ref={circleVideoRef} muted playsInline className="h-11 w-11 rounded-full object-cover" />
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
                Recording circle… {String(Math.floor(circleSec / 60)).padStart(2, "0")}:{String(circleSec % 60).padStart(2, "0")}
              </div>
              <button type="button" onClick={() => stopCircle(false)} aria-label="Send circle" className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-r from-accent to-accent-2 text-on-accent transition hover:brightness-110">
                <Send className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-1.5">
              <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple hidden onChange={onPickedFiles} />
              <input ref={docInputRef} type="file" multiple hidden onChange={onPickedFiles} />
              <button
                type="button"
                aria-label="Attach"
                disabled={uploading || !convId}
                onClick={(e) => setAttachAnchor(e.currentTarget.getBoundingClientRect())}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-fg-muted transition hover:text-accent disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              </button>
              <ComposerBtn label="Emoji, stickers & GIF" onClick={() => setMediaOpen((v) => !v)} active={mediaOpen}>
                <Smile className="h-5 w-5" />
              </ComposerBtn>
              <textarea
                value={text}
                onChange={onComposerChange}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); setMention(null); void send(text); } }}
                rows={1}
                placeholder="Write a message…"
                className="field max-h-32 min-h-[40px] flex-1 resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
              />
              {text.trim() ? (
                <button type="button" onClick={() => void send(text)} disabled={sending} aria-label="Send" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-r from-accent to-accent-2 text-on-accent transition hover:brightness-110 disabled:opacity-50">
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => void startCircle()} disabled={uploading || !convId} aria-label="Record video circle" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-fg-muted transition hover:text-accent disabled:opacity-50">
                    <Camera className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={startRec} disabled={uploading || !convId} aria-label="Record voice" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-fg-muted transition hover:text-accent disabled:opacity-50">
                    <Mic className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <CallOverlay key={call.sessionId} call={call} peer={peer} />

      {/* per-message actions — compact Telegram-style menu anchored at the bubble */}
      <MessageMenu
        open={!!actionTarget}
        anchor={actionAnchor}
        mine={actionTarget?.senderId === meId}
        reactedSet={new Set(
          actionTarget
            ? Object.entries(reactions[actionTarget.id] ?? {}).filter(([, ids]) => ids.includes(meId)).map(([e]) => e)
            : [],
        )}
        onClose={() => setActionTarget(null)}
        onReact={(e) => { if (actionTarget) void toggleReaction(actionTarget.id, e); setActionTarget(null); }}
      >
        {actionTarget && (
          <>
            <MenuRow icon={<CornerUpLeft className="h-4 w-4" />} label="Reply" onClick={() => { setReplyingTo(actionTarget); setActionTarget(null); }} />
            <MenuRow icon={<Forward className="h-4 w-4" />} label="Forward" onClick={() => { setForwardMsgs([actionTarget]); setActionTarget(null); }} />
            <MenuRow icon={<CheckCircle2 className="h-4 w-4" />} label="Select" onClick={() => enterSelect(actionTarget.id)} />
            {pinnedIds.includes(actionTarget.id) ? (
              <MenuRow icon={<PinOff className="h-4 w-4" />} label="Unpin" onClick={() => { const id = actionTarget.id; setActionTarget(null); void doUnpin(id); }} />
            ) : (
              <MenuRow icon={<Pin className="h-4 w-4" />} label="Pin" onClick={() => void doPin(actionTarget)} />
            )}
            {actionTarget.text && <MenuRow icon={<Copy className="h-4 w-4" />} label="Copy text" onClick={() => copyText(actionTarget)} />}
            <MenuRow icon={<Link2 className="h-4 w-4" />} label="Copy link" onClick={() => copyMessageLink(actionTarget)} />
            {actionTarget.senderId !== meId && peer && (
              <MenuRow icon={<Flag className="h-4 w-4" />} label="Report" onClick={() => { const p = peer; setActionTarget(null); setReportTarget(p); }} />
            )}
            {actionTarget.senderId === meId && (
              <MenuRow icon={<Trash2 className="h-4 w-4" />} label="Delete" danger onClick={() => void removeMessage(actionTarget)} />
            )}
          </>
        )}
      </MessageMenu>

      {/* header conversation menu — anchored to the ⋮ button (Telegram-style, no blur) */}
      <AnchoredMenu open={!!headerAnchor} anchor={headerAnchor} onClose={() => setHeaderAnchor(null)} align="right" width={200}>
        <AnchoredItem icon={<UserRound className="h-4 w-4" />} label="View profile" onClick={() => { setHeaderAnchor(null); window.location.href = `/profile/${peerId}`; }} />
        <AnchoredItem icon={muted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />} label={muted ? "Unmute" : "Mute"} onClick={() => { setHeaderAnchor(null); setMuteOpen(true); }} />
        <AnchoredItem icon={<Eraser className="h-4 w-4" />} label="Clear history" onClick={() => { setHeaderAnchor(null); setConfirmClear(true); }} />
        <AnchoredItem icon={<Flag className="h-4 w-4" />} label="Report" onClick={() => { setHeaderAnchor(null); if (peer) setReportTarget(peer); }} />
        {block.iBlocked ? (
          <AnchoredItem icon={<ShieldOff className="h-4 w-4" />} label="Unblock user" onClick={() => void doUnblock()} />
        ) : (
          <AnchoredItem icon={<Ban className="h-4 w-4" />} label="Block user" danger onClick={() => { setHeaderAnchor(null); setConfirmBlock(true); }} />
        )}
      </AnchoredMenu>

      {/* block confirmation */}
      <Modal open={confirmBlock} onClose={() => setConfirmBlock(false)}>
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-danger/10 text-danger">
            <Ban className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-lg font-bold">Block {peerName}?</h3>
          <p className="mt-1 text-sm text-fg-muted">They won’t be able to message you, and you won’t be able to message them until you unblock.</p>
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setConfirmBlock(false)} className="flex-1 rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--panel)]">Cancel</button>
            <button type="button" onClick={() => void doBlock()} className="flex-1 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">Block</button>
          </div>
        </div>
      </Modal>

      {/* forward picker */}
      <ForwardModal open={forwardMsgs.length > 0} onClose={() => setForwardMsgs([])} meId={meId} messages={forwardMsgs} />

      {/* report (chat peer or a forwarded author) */}
      {reportTarget && (
        <ReportModal open={!!reportTarget} onClose={() => setReportTarget(null)} meId={meId} peer={reportTarget} conversationId={reportTarget.id === peerId ? convId : null} />
      )}

      {/* mute options (Telegram-style) */}
      <MuteModal
        open={muteOpen}
        onClose={() => setMuteOpen(false)}
        peerName={peerName}
        muted={muted}
        onMute={applyMute}
        onUnmute={applyUnmute}
      />

      {/* open external link confirmation (Telegram-style) */}
      <Modal open={!!linkConfirm} onClose={() => setLinkConfirm(null)} className="max-w-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent"><Link2 className="h-5 w-5" /></span>
          <h3 className="text-lg font-bold leading-tight">Open this link?</h3>
        </div>
        <p className="mt-3 break-all rounded-xl bg-[var(--panel)] px-3 py-2 text-xs text-fg-muted">{linkConfirm}</p>
        <p className="mt-2 text-[11px] text-fg-muted">This link leads outside OASIS LUX. Only open links you trust.</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => setLinkConfirm(null)} className="flex-1 rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--panel)]">Cancel</button>
          <button type="button" onClick={() => { if (linkConfirm) window.open(linkConfirm, "_blank", "noopener,noreferrer"); setLinkConfirm(null); }} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">
            <Link2 className="h-4 w-4" /> Open
          </button>
        </div>
      </Modal>

      {/* clear history confirmation */}
      <Modal open={confirmClear} onClose={() => setConfirmClear(false)}>
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-danger/10 text-danger"><Eraser className="h-6 w-6" /></div>
          <h3 className="mt-3 text-lg font-bold">Clear history?</h3>
          <p className="mt-1 text-sm text-fg-muted">This hides the conversation for you. It stays visible for {peerName} until they write again.</p>
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setConfirmClear(false)} className="flex-1 rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--panel)]">Cancel</button>
            <button type="button" onClick={() => void doClearHistory()} className="flex-1 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">Clear</button>
          </div>
        </div>
      </Modal>

      {/* gif viewer — save / forward (like Telegram) */}
      <Modal open={!!gifView} onClose={() => setGifView(null)} className="max-w-sm">
        {gifView && (
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gifView} alt="" className="mx-auto mb-3 max-h-72 rounded-xl object-contain" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { toggleSavedGif(meId, gifView); toast.success("Saved to your GIFs"); setGifView(null); }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--panel)]"
              >
                <Star className="h-4 w-4" /> Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setForwardMsgs([{
                    id: "gif", conversationId: convId ?? "", senderId: meId, recipientId: peerId,
                    text: "", attachments: [gifView], read: false, createdAt: new Date().toISOString(), replyTo: null, forwardedFrom: null, kind: "normal",
                  }]);
                  setGifView(null);
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:brightness-110"
              >
                <Forward className="h-4 w-4" /> Forward
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* attach menu (Photo/Video · Document) */}
      <AnchoredMenu open={!!attachAnchor} anchor={attachAnchor} onClose={() => setAttachAnchor(null)} align="left" width={200}>
        <AnchoredItem icon={<ImageIcon className="h-4 w-4" />} label="Photo or video" onClick={() => { setAttachAnchor(null); mediaInputRef.current?.click(); }} />
        <AnchoredItem icon={<FileText className="h-4 w-4" />} label="Document" onClick={() => { setAttachAnchor(null); docInputRef.current?.click(); }} />
      </AnchoredMenu>

      {/* compose album (multi-photo/video + caption) */}
      <ComposeMediaModal
        open={composeFiles.length > 0}
        files={composeFiles}
        sending={composeSending}
        onAddMore={() => mediaInputRef.current?.click()}
        onRemove={(i) => setComposeFiles((prev) => prev.filter((_, j) => j !== i))}
        onClose={() => setComposeFiles([])}
        onSend={(caption) => void sendCompose(caption)}
      />

      {/* profile preview (tap header) */}
      {peer && (
        <ProfilePreviewModal
          open={profilePreview}
          onClose={() => setProfilePreview(false)}
          meId={meId}
          peer={peer}
          online={online}
          media={sharedMedia}
          onOpenFull={() => { window.location.href = `/profile/${peerId}`; }}
          onCall={(t) => { setProfilePreview(false); void call.start(t); }}
          onBlockChange={(b) => setBlock((s) => ({ ...s, iBlocked: b }))}
          onMuteChange={setMuted}
        />
      )}

      {/* forwarded author → same modal, but ONLY a "Profile" button (no chat actions).
          @mention clicks reuse this with the full action set (fwdProfileOnly=false). */}
      {forwardedPeer && (
        <ProfilePreviewModal
          open={!!forwardedPeer}
          onClose={() => setForwardedPeer(null)}
          meId={meId}
          peer={forwardedPeer}
          profileOnly={fwdProfileOnly}
          onOpenFull={() => { window.location.href = `/profile/${forwardedPeer.id}`; }}
        />
      )}

      {/* image lightbox */}
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />

      {/* selection action bar (Telegram-style) — own msgs can be deleted, others only copied/forwarded */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-around gap-1 border-t border-[var(--panel-border)] bg-bg-elev px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
          >
            <SelectAction icon={<Copy className="h-5 w-5" />} label="Copy" onClick={copySelected} disabled={selectedMsgs.length === 0} />
            <SelectAction icon={<Forward className="h-5 w-5" />} label="Forward" onClick={forwardSelected} disabled={selectedMsgs.length === 0} />
            <SelectAction icon={<Trash2 className="h-5 w-5" />} label="Delete" danger onClick={() => void removeSelected()} disabled={!allMine} title={!allMine ? "You can only delete your own messages" : undefined} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Set a user's single reaction on a message locally (removes their others). */
function setMyReactionLocal(
  setReactions: React.Dispatch<React.SetStateAction<ReactionMap>>,
  messageId: string,
  userId: string,
  emoji: string | null,
) {
  setReactions((prev) => {
    const msg: Record<string, string[]> = {};
    // keep everyone else's reactions, drop mine
    for (const [e, ids] of Object.entries(prev[messageId] ?? {})) {
      const kept = ids.filter((id) => id !== userId);
      if (kept.length) msg[e] = kept;
    }
    if (emoji) msg[emoji] = [...(msg[emoji] ?? []), userId];
    const next = { ...prev };
    if (Object.keys(msg).length === 0) delete next[messageId];
    else next[messageId] = msg;
    return next;
  });
}

/** Idempotently add/remove a user's reaction in the reaction map. */
function setReaction(
  setReactions: React.Dispatch<React.SetStateAction<ReactionMap>>,
  messageId: string,
  emoji: string,
  userId: string,
  add: boolean,
) {
  setReactions((prev) => {
    const msg = { ...(prev[messageId] ?? {}) };
    const ids = new Set(msg[emoji] ?? []);
    if (add) ids.add(userId);
    else ids.delete(userId);
    if (ids.size === 0) delete msg[emoji];
    else msg[emoji] = [...ids];
    const next = { ...prev };
    if (Object.keys(msg).length === 0) delete next[messageId];
    else next[messageId] = msg;
    return next;
  });
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

function SelectAction({ icon, label, onClick, disabled, danger, title }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition disabled:opacity-30",
        danger ? "text-danger hover:bg-danger/10" : "text-fg-muted hover:bg-[var(--panel)] hover:text-accent",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
