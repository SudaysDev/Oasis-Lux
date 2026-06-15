"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { Avatar } from "@/components/profile/Avatar";
import { cn } from "@/lib/utils";
import type { useCall } from "@/hooks/useCall";
import type { MiniProfile } from "@/types";

type Call = ReturnType<typeof useCall>;

export function CallOverlay({ call, peer }: { call: Call; peer: MiniProfile | null }) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const [sec, setSec] = useState(0);

  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = call.localStream;
  }, [call.localStream]);
  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = call.remoteStream;
  }, [call.remoteStream]);

  // in-call duration timer (setState only inside the interval callback)
  useEffect(() => {
    if (call.state !== "connected") return;
    const start = Date.now();
    const t = setInterval(() => setSec(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [call.state]);

  if (call.state === "idle") return null;

  const isVideo = call.callType === "video";
  const name = peer?.fullName || (peer ? `@${peer.username}` : "Contact");
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  const statusText =
    call.state === "calling" ? "Calling…" : call.state === "incoming" ? `Incoming ${call.callType} call` : `${mm}:${ss}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div className="relative flex h-full max-h-[640px] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-[var(--panel-border)] bg-bg-elev">
        {/* remote video / avatar */}
        <div className="relative flex-1 overflow-hidden bg-black">
          <video
            ref={remoteRef}
            autoPlay
            playsInline
            className={cn("h-full w-full object-cover", (!isVideo || !call.remoteStream) && "hidden")}
          />
          {(!isVideo || !call.remoteStream) && (
            <div className="grid h-full place-items-center">
              <div className="text-center">
                <div className="relative mx-auto">
                  <Avatar src={peer?.avatarUrl} name={peer?.username ?? "?"} size={96} />
                  {call.state !== "connected" && (
                    <span className="absolute inset-0 animate-ping rounded-full border-2 border-accent/50" />
                  )}
                </div>
                <p className="mt-4 text-xl font-bold">{name}</p>
                <p className="mt-1 font-mono text-xs uppercase tracking-wider text-fg-muted">{statusText}</p>
              </div>
            </div>
          )}

          {/* local PiP (video only) */}
          {isVideo && (
            <video
              ref={localRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-4 right-4 h-36 w-24 rounded-xl border border-white/20 object-cover shadow-lg"
            />
          )}

          {/* connected header for video */}
          {isVideo && call.state === "connected" && (
            <div className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1.5 font-mono text-xs text-white">
              {name} · {mm}:{ss}
            </div>
          )}
        </div>

        {/* controls */}
        <div className="flex items-center justify-center gap-4 p-5">
          {call.state === "incoming" ? (
            <>
              <button
                type="button"
                onClick={call.decline}
                aria-label="Decline"
                className="grid h-14 w-14 place-items-center rounded-full bg-danger text-white transition hover:brightness-110"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={call.accept}
                aria-label="Accept"
                className="grid h-14 w-14 place-items-center rounded-full bg-success text-white transition hover:brightness-110"
              >
                <Phone className="h-6 w-6" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={call.toggleMute}
                aria-label="Toggle mute"
                className={cn(
                  "grid h-12 w-12 place-items-center rounded-full transition",
                  call.muted ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20",
                )}
              >
                {call.muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              {isVideo && (
                <button
                  type="button"
                  onClick={call.toggleCam}
                  aria-label="Toggle camera"
                  className={cn(
                    "grid h-12 w-12 place-items-center rounded-full transition",
                    call.camOff ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20",
                  )}
                >
                  {call.camOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </button>
              )}
              <button
                type="button"
                onClick={call.hangup}
                aria-label="Hang up"
                className="grid h-14 w-14 place-items-center rounded-full bg-danger text-white transition hover:brightness-110"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
