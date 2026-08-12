"use client";

import { useEffect, useRef } from "react";
import type { PresenceStatus } from "./model";

function initials(name: string) { return name.trim().slice(0, 2).toUpperCase(); }

export function Avatar({ name, color, imageUrl, status = true, presenceStatus = "online", small = false }: { name: string; color: string; imageUrl?: string | null; status?: boolean; presenceStatus?: PresenceStatus; small?: boolean }) {
  return <span className={`avatar ${small ? "avatar-small" : ""} ${imageUrl ? "has-image" : ""}`} style={imageUrl ? { backgroundColor: color, backgroundImage: `url("${imageUrl}")` } : { background: color }}>{imageUrl ? null : initials(name)}{status && <span className={`status-dot status-${presenceStatus}`} />}</span>;
}

export function RemoteAudio({ stream, muted }: { stream?: MediaStream; muted: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => { const audio = ref.current; if (!audio) return; audio.srcObject = stream ?? null; if (stream && !muted) void audio.play().catch(() => undefined); }, [stream, muted]);
  return <audio ref={ref} autoPlay playsInline muted={muted} />;
}

export function ScreenVideo({ stream, muted = false }: { stream: MediaStream; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { const video = ref.current; if (!video) return; video.srcObject = stream; void video.play().catch(() => undefined); return () => { video.srcObject = null; }; }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} />;
}
