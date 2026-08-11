"use client";

import { useEffect, useRef } from "react";

type SpotifyEmbedController = {
  addListener: (event: "playback_update", listener: (event: { data: { isPaused: boolean } }) => void) => void;
  destroy: () => void;
  togglePlay: () => void;
};

type SpotifyIframeApi = {
  createController: (
    element: HTMLElement,
    options: { uri: string; width: string; height: number },
    callback: (controller: SpotifyEmbedController) => void,
  ) => void;
};

let spotifyApiPromise: Promise<SpotifyIframeApi> | null = null;

function loadSpotifyIframeApi() {
  if (spotifyApiPromise) return spotifyApiPromise;

  const spotifyWindow = window as Window & {
    __fynexSpotifyIframeApi?: SpotifyIframeApi;
    onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void;
  };
  if (spotifyWindow.__fynexSpotifyIframeApi) return Promise.resolve(spotifyWindow.__fynexSpotifyIframeApi);

  spotifyApiPromise = new Promise<SpotifyIframeApi>((resolve, reject) => {
    spotifyWindow.onSpotifyIframeApiReady = (api) => {
      spotifyWindow.__fynexSpotifyIframeApi = api;
      resolve(api);
    };

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://open.spotify.com/embed/iframe-api/v1"]');
    if (existing) {
      existing.addEventListener("error", () => reject(new Error("spotify-embed-unavailable")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    script.addEventListener("error", () => reject(new Error("spotify-embed-unavailable")), { once: true });
    document.body.appendChild(script);
  });

  return spotifyApiPromise;
}

export function SpotifyEmbedPlayer({
  trackId,
  controllerRef,
  onReady,
  onPlayingChange,
}: {
  trackId: string;
  controllerRef: React.MutableRefObject<SpotifyEmbedController | null>;
  onReady: () => void;
  onPlayingChange: (playing: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let controller: SpotifyEmbedController | null = null;

    void loadSpotifyIframeApi().then((api) => {
      if (disposed) return;
      api.createController(container, {
        uri: `spotify:track:${trackId}`,
        width: "100%",
        height: 80,
      }, (createdController) => {
        if (disposed) {
          createdController.destroy();
          return;
        }
        controller = createdController;
        controllerRef.current = createdController;
        createdController.addListener("playback_update", (event) => onPlayingChange(!event.data.isPaused));
        onReady();
      });
    }).catch(() => {
      controllerRef.current = null;
    });

    return () => {
      disposed = true;
      onPlayingChange(false);
      if (controllerRef.current === controller) controllerRef.current = null;
      controller?.destroy();
    };
  }, [controllerRef, onPlayingChange, onReady, trackId]);

  return <div className="spotify-profile-embed-engine" aria-hidden="true"><div ref={containerRef} /></div>;
}

export type { SpotifyEmbedController };
