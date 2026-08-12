"use client";

import { useEffect, useRef } from "react";

type SpotifyPlaybackEvent = { data: { isPaused: boolean; isBuffering: boolean; duration: number; position: number } };

type RawSpotifyController = {
  addListener: {
    (event: "ready", listener: () => void): void;
    (event: "playback_update", listener: (event: SpotifyPlaybackEvent) => void): void;
  };
  destroy: () => void;
  pause: () => void;
  play: () => void;
  seek: (seconds: number) => void;
};

export type SpotifyEmbedController = {
  pause: () => void;
  playClip: () => void;
};

type SpotifyIframeApi = {
  createController: (
    element: HTMLElement,
    options: { uri: string; width: string; height: number },
    callback: (controller: RawSpotifyController) => void,
  ) => void;
};

type SpotifyWindow = Window & {
  __fynexSpotifyIframeApi?: SpotifyIframeApi;
  __fynexSpotifyIframeApiPromise?: Promise<SpotifyIframeApi>;
  onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void;
};

let spotifyApiPromise: Promise<SpotifyIframeApi> | null = null;

function resetFailedApi(spotifyWindow: SpotifyWindow) {
  spotifyApiPromise = null;
  delete spotifyWindow.__fynexSpotifyIframeApiPromise;
}

function loadSpotifyIframeApi() {
  const spotifyWindow = window as SpotifyWindow;
  if (spotifyWindow.__fynexSpotifyIframeApi) return Promise.resolve(spotifyWindow.__fynexSpotifyIframeApi);
  if (spotifyWindow.__fynexSpotifyIframeApiPromise) return spotifyWindow.__fynexSpotifyIframeApiPromise;
  if (spotifyApiPromise) return spotifyApiPromise;

  spotifyApiPromise = new Promise<SpotifyIframeApi>((resolve, reject) => {
    const finish = (api: SpotifyIframeApi) => {
      window.clearTimeout(timeout);
      spotifyWindow.__fynexSpotifyIframeApi = api;
      resolve(api);
    };
    const fail = () => {
      window.clearTimeout(timeout);
      resetFailedApi(spotifyWindow);
      reject(new Error("spotify-embed-unavailable"));
    };
    const timeout = window.setTimeout(fail, 10_000);
    spotifyWindow.onSpotifyIframeApiReady = finish;

    const existing = document.querySelector<HTMLScriptElement>('script[src^="https://open.spotify.com/embed/iframe-api/v1"]');
    if (existing && existing.dataset.fynexLoaded !== "true") {
      existing.addEventListener("error", fail, { once: true });
      return;
    }
    existing?.remove();

    const script = document.createElement("script");
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    script.dataset.fynexSpotifyApi = "true";
    script.addEventListener("load", () => { script.dataset.fynexLoaded = "true"; }, { once: true });
    script.addEventListener("error", fail, { once: true });
    document.body.appendChild(script);
  });
  spotifyWindow.__fynexSpotifyIframeApiPromise = spotifyApiPromise;
  return spotifyApiPromise;
}

export function SpotifyEmbedPlayer({ trackId, startSeconds, clipSeconds = 30, controllerRef, onReady, onPlayingChange, onUnavailable }: {
  trackId: string;
  startSeconds: number;
  clipSeconds?: number;
  controllerRef: React.MutableRefObject<SpotifyEmbedController | null>;
  onReady: () => void;
  onPlayingChange: (playing: boolean) => void;
  onUnavailable?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(startSeconds);
  const rawControllerRef = useRef<RawSpotifyController | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = startSeconds;
    rawControllerRef.current?.pause();
    rawControllerRef.current?.seek(startSeconds);
    onPlayingChange(false);
  }, [onPlayingChange, startSeconds]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let rawController: RawSpotifyController | null = null;

    const clearStopTimer = () => {
      if (stopTimerRef.current !== null) window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    };
    const stopAtClipEnd = () => {
      clearStopTimer();
      rawController?.pause();
      rawController?.seek(startRef.current);
      onPlayingChange(false);
    };

    void loadSpotifyIframeApi().then((api) => {
      if (disposed) return;
      api.createController(container, { uri: `spotify:track:${trackId}`, width: "100%", height: 80 }, (createdController) => {
        if (disposed) { createdController.destroy(); return; }
        rawController = createdController;
        rawControllerRef.current = createdController;
        controllerRef.current = {
          pause: () => { clearStopTimer(); createdController.pause(); },
          playClip: () => {
            clearStopTimer();
            createdController.seek(startRef.current);
            createdController.play();
          },
        };
        createdController.addListener("ready", () => {
          createdController.seek(startRef.current);
          onReady();
        });
        createdController.addListener("playback_update", (event) => {
          const playing = !event.data.isPaused && !event.data.isBuffering;
          const clipEndMs = (startRef.current + clipSeconds) * 1000;
          if (playing && event.data.position >= clipEndMs - 150) {
            stopAtClipEnd();
            return;
          }
          if (playing && stopTimerRef.current === null) {
            stopTimerRef.current = window.setTimeout(stopAtClipEnd, Math.max(0, clipEndMs - event.data.position));
          }
          onPlayingChange(playing);
          if (!playing && event.data.isPaused) clearStopTimer();
        });
      });
    }).catch(() => {
      controllerRef.current = null;
      onUnavailable?.();
    });

    return () => {
      disposed = true;
      clearStopTimer();
      onPlayingChange(false);
      if (rawControllerRef.current === rawController) rawControllerRef.current = null;
      controllerRef.current = null;
      rawController?.destroy();
    };
  }, [clipSeconds, controllerRef, onPlayingChange, onReady, onUnavailable, trackId]);

  return <div className="spotify-profile-embed-engine" aria-hidden="true"><div ref={containerRef} /></div>;
}
