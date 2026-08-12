"use client";

import { useCallback, useRef } from "react";
import type { CSSProperties, PointerEvent } from "react";
import styles from "./fynex-color-picker.module.css";

const PALETTE = ["#6f63d9", "#8b5cf6", "#a855f7", "#6366f1", "#3b82f6", "#06b6d4", "#14b8a6", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899", "#b2b7c2", "#f5f3ff", "#4b5563", "#161a22"];
const clamp = (value: number) => Math.min(255, Math.max(0, Math.round(value)));
const hex = (value: number) => value.toString(16).padStart(2, "0");
function rgbFromHex(value: string) { const color = /^#([\da-f]{6})$/i.exec(value)?.[1] ?? "6f63d9"; return [parseInt(color.slice(0, 2), 16), parseInt(color.slice(2, 4), 16), parseInt(color.slice(4, 6), 16)] as const; }
function hexFromRgb(red: number, green: number, blue: number) { return `#${hex(clamp(red))}${hex(clamp(green))}${hex(clamp(blue))}`; }
function hsvFromRgb(red: number, green: number, blue: number) { const r=red/255,g=green/255,b=blue/255,max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min; let h=0; if(delta){if(max===r)h=60*(((g-b)/delta)%6); else if(max===g)h=60*((b-r)/delta+2); else h=60*((r-g)/delta+4);} return [h<0?h+360:h, max?delta/max:0, max] as const; }
function rgbFromHsv(h:number,s:number,v:number){const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c; const [r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x]; return [255*(r+m),255*(g+m),255*(b+m)] as const;}

export function FynexColorPicker({ name, value, onChange, compact = false }: { name: string; value: string; onChange: (color: string) => void; compact?: boolean }) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [red, green, blue] = rgbFromHex(value); const [hue, saturation, brightness] = hsvFromRgb(red, green, blue);
  const setFromPoint = useCallback((event: PointerEvent<HTMLDivElement>) => { const box=fieldRef.current?.getBoundingClientRect(); if(!box) return; const s=Math.min(1,Math.max(0,(event.clientX-box.left)/box.width)); const v=1-Math.min(1,Math.max(0,(event.clientY-box.top)/box.height)); const [r,g,b]=rgbFromHsv(hue,s,v); onChange(hexFromRgb(r,g,b)); },[hue,onChange]);
  return <div className={`${styles.picker} ${compact ? styles.compact : ""}`} style={{ "--fynex-color": value, "--picker-hue": `hsl(${hue} 100% 50%)` } as CSSProperties}>
    <div className={styles.preview} style={{ backgroundColor: value }} aria-hidden="true" />
    <div className={styles.controls}><div ref={fieldRef} className={styles.field} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setFromPoint(event); }} onPointerMove={(event) => event.currentTarget.hasPointerCapture(event.pointerId) && setFromPoint(event)}><i style={{ left: `${saturation*100}%`, top: `${(1-brightness)*100}%` }} /></div><input className={styles.hue} type="range" min="0" max="359" value={Math.round(hue)} onChange={(event) => { const [r,g,b]=rgbFromHsv(Number(event.target.value),saturation||1,brightness||1); onChange(hexFromRgb(r,g,b)); }} aria-label="Ajustar matiz" /></div>
    <div className={styles.rgb}><label>R<input inputMode="numeric" value={red} onChange={(event) => onChange(hexFromRgb(Number(event.target.value),green,blue))}/></label><label>G<input inputMode="numeric" value={green} onChange={(event) => onChange(hexFromRgb(red,Number(event.target.value),blue))}/></label><label>B<input inputMode="numeric" value={blue} onChange={(event) => onChange(hexFromRgb(red,green,Number(event.target.value)))}/></label><code>{value.toUpperCase()}</code></div>
    {!compact && <div className={styles.swatches}>{PALETTE.map((color) => <button type="button" key={color} className={value.toLowerCase() === color ? styles.selected : ""} style={{ backgroundColor: color }} onClick={() => onChange(color)} aria-label={`Escolher cor ${color}`} />)}</div>}
    <input type="hidden" name={name} value={value} />
  </div>;
}
