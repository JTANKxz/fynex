"use client";

import { useEffect, useRef } from "react";

function initials(name: string) { return name.trim().slice(0, 2).toUpperCase(); }

export function Avatar({ name, color, status = true, small = false }: { name: string; color: string; status?: boolean; small?: boolean }) {
  return <span className={`avatar ${small ? "avatar-small" : ""}`} style={{ background: color }}>{initials(name)}{status && <span className="status-dot" />}</span>;
}

export function RemoteAudio({ stream, muted }: { stream?: MediaStream; muted: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => { const audio = ref.current; if (!audio) return; audio.srcObject = stream ?? null; if (stream && !muted) void audio.play().catch(() => undefined); }, [stream, muted]);
  return <audio ref={ref} autoPlay playsInline muted={muted} />;
}

export function ScreenVideo({ stream, muted = true }: { stream: MediaStream; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { const video = ref.current; if (!video) return; video.srcObject = stream; void video.play().catch(() => undefined); return () => { video.srcObject = null; }; }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} />;
}
