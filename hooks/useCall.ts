"use client";

import { useCallback, useRef, useState, type MutableRefObject } from "react";

// 1-on-1 WebRTC calls. Signaling rides the existing Supabase realtime channel
// (broadcast). Public STUN only (no TURN) — works on most networks; symmetric
// NATs would need a TURN server.
const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];

export type CallState = "idle" | "calling" | "incoming" | "connected";
export type CallType = "audio" | "video";

type Channel = { send: (m: { type: "broadcast"; event: string; payload: unknown }) => unknown } | null;

interface Signal {
  kind: "offer" | "answer" | "ice" | "end";
  from: string;
  callType?: CallType;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export function useCall(channelRef: MutableRefObject<Channel>, meId: string) {
  const [state, setState] = useState<CallState>("idle");
  const [sessionId, setSessionId] = useState(0);
  const [callType, setCallType] = useState<CallType>("audio");
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const pendingOffer = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingType = useRef<CallType>("audio");
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);

  const send = useCallback(
    (payload: Omit<Signal, "from">) => {
      channelRef.current?.send({ type: "broadcast", event: "call", payload: { ...payload, from: meId } });
    },
    [channelRef, meId],
  );

  const cleanup = useCallback(() => {
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    pendingOffer.current = null;
    pendingIce.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setCamOff(false);
    setState("idle");
  }, []);

  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => { if (e.candidate) send({ kind: "ice", candidate: e.candidate.toJSON() }); };
    pc.ontrack = (e) => setRemoteStream(e.streams[0] ?? null);
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") setState("connected");
      else if (s === "failed" || s === "closed" || s === "disconnected") cleanup();
    };
    pcRef.current = pc;
    return pc;
  }, [send, cleanup]);

  const getMedia = useCallback(async (type: CallType) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
    localRef.current = stream;
    setLocalStream(stream);
    stream.getTracks().forEach((t) => pcRef.current?.addTrack(t, stream));
    return stream;
  }, []);

  const flushIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of pendingIce.current) await pc.addIceCandidate(c).catch(() => {});
    pendingIce.current = [];
  }, []);

  const start = useCallback(async (type: CallType) => {
    try {
      setSessionId((n) => n + 1);
      setCallType(type);
      setState("calling");
      const pc = createPC();
      await getMedia(type);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ kind: "offer", callType: type, sdp: offer });
    } catch {
      cleanup();
    }
  }, [createPC, getMedia, send, cleanup]);

  const accept = useCallback(async () => {
    const offer = pendingOffer.current;
    if (!offer) return;
    try {
      const type = pendingType.current;
      setCallType(type);
      const pc = createPC();
      await getMedia(type);
      await pc.setRemoteDescription(offer);
      await flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ kind: "answer", sdp: answer });
      setState("connected");
    } catch {
      cleanup();
    }
  }, [createPC, getMedia, flushIce, send, cleanup]);

  const decline = useCallback(() => { send({ kind: "end" }); cleanup(); }, [send, cleanup]);
  const hangup = useCallback(() => { send({ kind: "end" }); cleanup(); }, [send, cleanup]);

  const toggleMute = useCallback(() => {
    const tracks = localRef.current?.getAudioTracks() ?? [];
    const enabled = !(tracks[0]?.enabled ?? true);
    tracks.forEach((t) => (t.enabled = enabled));
    setMuted(!enabled);
  }, []);

  const toggleCam = useCallback(() => {
    const tracks = localRef.current?.getVideoTracks() ?? [];
    tracks.forEach((t) => (t.enabled = !t.enabled));
    setCamOff(!(tracks[0]?.enabled ?? true));
  }, []);

  // handle inbound signaling (called from the channel's broadcast handler)
  const onSignal = useCallback(async (raw: unknown) => {
    const s = raw as Signal;
    if (!s || s.from === meId) return;
    if (s.kind === "offer" && s.sdp) {
      if (pcRef.current) return; // already in a call
      pendingOffer.current = s.sdp;
      pendingType.current = s.callType ?? "audio";
      setSessionId((n) => n + 1);
      setCallType(s.callType ?? "audio");
      setState("incoming");
    } else if (s.kind === "answer" && s.sdp) {
      await pcRef.current?.setRemoteDescription(s.sdp).catch(() => {});
      await flushIce();
      setState("connected");
    } else if (s.kind === "ice" && s.candidate) {
      if (pcRef.current?.remoteDescription) await pcRef.current.addIceCandidate(s.candidate).catch(() => {});
      else pendingIce.current.push(s.candidate);
    } else if (s.kind === "end") {
      cleanup();
    }
  }, [meId, flushIce, cleanup]);

  return {
    state, sessionId, callType, muted, camOff, localStream, remoteStream,
    start, accept, decline, hangup, toggleMute, toggleCam, onSignal,
  };
}
