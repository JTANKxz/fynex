"use client";

import { Mic, MonitorUp, SlidersHorizontal, Waves, X } from "lucide-react";
import { FynexSelect } from "@/components/ui/fynex-select";

export type ScreenPreset = "economy" | "standard";

export function MediaSettingsModal({ audioInputs, selectedAudioInput, onAudioInput, noiseSuppression, noiseSuppressionSupported, noiseSuppressionApplied, echoCancellation, echoCancellationApplied, onProcessing, microphoneVolume, onMicrophoneVolume, micTestActive, micTestLevel, onToggleMicTest, screenPreset, onScreenPreset, onClose }: {
  audioInputs: MediaDeviceInfo[];
  selectedAudioInput: string;
  onAudioInput: (deviceId: string) => void;
  noiseSuppression: boolean;
  noiseSuppressionSupported: boolean;
  noiseSuppressionApplied: boolean | null;
  echoCancellation: boolean;
  echoCancellationApplied: boolean | null;
  onProcessing: (setting: "noiseSuppression" | "echoCancellation" | "autoGainControl", enabled: boolean) => void;
  microphoneVolume: number;
  onMicrophoneVolume: (value: number) => void;
  micTestActive: boolean;
  micTestLevel: number;
  onToggleMicTest: () => void;
  screenPreset: ScreenPreset;
  onScreenPreset: (preset: ScreenPreset) => void;
  onClose: () => void;
}) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="media-settings-modal" role="dialog" aria-modal="true" aria-labelledby="media-settings-title">
      <header><div><span className="auth-eyebrow">DISPOSITIVOS</span><h2 id="media-settings-title">Áudio e transmissão</h2><p>Controle como sua voz é capturada e quanto a tela compartilhada consome.</p></div><button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button></header>
      <section><h3><Mic size={16} />Microfone</h3><label className="settings-select">Entrada de áudio<FynexSelect value={selectedAudioInput} onChange={onAudioInput} ariaLabel="Escolher entrada de áudio" options={audioInputs.length ? audioInputs.map((device, index) => ({ value: device.deviceId, label: device.label || `Microfone ${index + 1}`, detail: "Dispositivo de entrada" })) : [{ value: "", label: "Padrão do navegador", detail: "Usar o dispositivo padrão" }]} /></label><div className="mic-test"><button type="button" className={micTestActive ? "active" : ""} onClick={onToggleMicTest}>{micTestActive ? "Parar teste" : "Testar microfone"}</button><div><i style={{ width: `${micTestLevel}%` }} /></div><small>{micTestActive ? `${micTestLevel}%` : "Fale para conferir o nível de entrada"}</small></div><label className="microphone-volume">Volume manual <strong>{microphoneVolume}%</strong><input type="range" min="0" max="100" step="1" value={microphoneVolume} onChange={(event) => onMicrophoneVolume(Number(event.target.value))} /></label><div className="settings-switches"><label className="noise-cancellation-control"><Waves size={18} /><span><strong>Cancelamento de ruído <em>{!noiseSuppressionSupported ? "INDISPONÍVEL" : !noiseSuppression ? "DESATIVADO" : noiseSuppressionApplied === null ? "PRONTO" : noiseSuppressionApplied ? "ATIVO NO MICROFONE" : "NÃO APLICADO"}</em></strong><small>Força o processamento nativo no desktop e confirma o estado real retornado pelo microfone.</small></span><input aria-label="Ativar cancelamento de ruído" type="checkbox" checked={noiseSuppression} disabled={!noiseSuppressionSupported} onChange={(event) => onProcessing("noiseSuppression", event.target.checked)} /></label><label><span><strong>Cancelamento de eco <em>{!echoCancellation ? "DESATIVADO" : echoCancellationApplied === null ? "PRONTO" : echoCancellationApplied ? "ATIVO" : "NÃO APLICADO"}</em></strong><small>Evita o retorno do alto-falante no microfone e confirma o estado aplicado.</small></span><input type="checkbox" checked={echoCancellation} onChange={(event) => onProcessing("echoCancellation", event.target.checked)} /></label><label className="automatic-gain-disabled"><span><strong>Ganho automático <em>DESATIVADO</em></strong><small>O volume fica em 100% por padrão e é ajustado manualmente acima.</small></span></label></div></section>
      <section><h3><MonitorUp size={16} />Transmissão de tela</h3><div className="preset-grid"><button className={screenPreset === "economy" ? "selected" : ""} onClick={() => onScreenPreset("economy")}><SlidersHorizontal size={17} /><span><strong>Econômica</strong><small>540p · 24 FPS</small></span></button><button className={screenPreset === "standard" ? "selected" : ""} onClick={() => onScreenPreset("standard")}><MonitorUp size={17} /><span><strong>Padrão</strong><small>720p · 30 FPS</small></span></button></div></section>
    </section>
  </div>;
}
