"use client";

import { Mic, MonitorUp, SlidersHorizontal, Waves, X } from "lucide-react";

export type ScreenPreset = "economy" | "standard";

export function MediaSettingsModal({ audioInputs, selectedAudioInput, onAudioInput, noiseSuppression, noiseSuppressionSupported, noiseSuppressionApplied, echoCancellation, autoGainControl, onProcessing, screenPreset, onScreenPreset, onClose }: {
  audioInputs: MediaDeviceInfo[];
  selectedAudioInput: string;
  onAudioInput: (deviceId: string) => void;
  noiseSuppression: boolean;
  noiseSuppressionSupported: boolean;
  noiseSuppressionApplied: boolean | null;
  echoCancellation: boolean;
  autoGainControl: boolean;
  onProcessing: (setting: "noiseSuppression" | "echoCancellation" | "autoGainControl", enabled: boolean) => void;
  screenPreset: ScreenPreset;
  onScreenPreset: (preset: ScreenPreset) => void;
  onClose: () => void;
}) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="media-settings-modal" role="dialog" aria-modal="true" aria-labelledby="media-settings-title">
      <header><div><span className="auth-eyebrow">DISPOSITIVOS</span><h2 id="media-settings-title">Áudio e transmissão</h2><p>Controle como sua voz é capturada e quanto a tela compartilhada consome.</p></div><button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button></header>
      <section><h3><Mic size={16} />Microfone</h3><label className="settings-select">Entrada de áudio<select value={selectedAudioInput} onChange={(event) => onAudioInput(event.target.value)}>{audioInputs.length ? audioInputs.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microfone ${index + 1}`}</option>) : <option value="">Padrão do navegador</option>}</select></label><div className="settings-switches"><label className="noise-cancellation-control"><Waves size={18} /><span><strong>Cancelamento de ruído <em>{!noiseSuppressionSupported ? "INDISPONÍVEL" : !noiseSuppression ? "DESATIVADO" : noiseSuppressionApplied === null ? "PRONTO" : noiseSuppressionApplied ? "ATIVO NO MICROFONE" : "NÃO APLICADO"}</em></strong><small>Força o processamento nativo no desktop e confirma o estado real retornado pelo microfone.</small></span><input aria-label="Ativar cancelamento de ruído" type="checkbox" checked={noiseSuppression} disabled={!noiseSuppressionSupported} onChange={(event) => onProcessing("noiseSuppression", event.target.checked)} /></label><label><span><strong>Cancelamento de eco</strong><small>Evita o retorno do alto-falante no microfone.</small></span><input type="checkbox" checked={echoCancellation} onChange={(event) => onProcessing("echoCancellation", event.target.checked)} /></label><label><span><strong>Ganho automático</strong><small>Equilibra o volume da sua voz.</small></span><input type="checkbox" checked={autoGainControl} onChange={(event) => onProcessing("autoGainControl", event.target.checked)} /></label></div></section>
      <section><h3><MonitorUp size={16} />Transmissão de tela</h3><div className="preset-grid"><button className={screenPreset === "economy" ? "selected" : ""} onClick={() => onScreenPreset("economy")}><SlidersHorizontal size={17} /><span><strong>Econômica</strong><small>540p · 24 FPS</small></span></button><button className={screenPreset === "standard" ? "selected" : ""} onClick={() => onScreenPreset("standard")}><MonitorUp size={17} /><span><strong>Padrão</strong><small>720p · 30 FPS</small></span></button></div></section>
    </section>
  </div>;
}
