"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import styles from "./fynex-select.module.css";

export type FynexSelectOption = {
  value: string;
  label: string;
  detail?: string;
  imageUrl?: string | null;
  color?: string;
  initials?: string;
  disabled?: boolean;
};

export function FynexSelect({ name, value, options, placeholder = "Selecione", ariaLabel, onChange }: {
  name?: string;
  value: string;
  options: FynexSelectOption[];
  placeholder?: string;
  ariaLabel: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); window.removeEventListener("keydown", closeEscape); };
  }, [open]);

  return <div className={styles.root} ref={rootRef}>
    {name ? <input type="hidden" name={name} value={value} /> : null}
    <button type="button" className={styles.trigger} role="combobox" aria-label={ariaLabel} aria-expanded={open} aria-controls={listId} onClick={() => setOpen((current) => !current)}><span className={selected ? "" : styles.placeholder}>{selected?.label ?? placeholder}</span><ChevronDown size={14} /></button>
    {open ? <div className={styles.menu} id={listId} role="listbox" aria-label={ariaLabel}>{options.map((option) => <button type="button" role="option" aria-selected={option.value === value} key={option.value} disabled={option.disabled} className={`${styles.option} ${option.value === value ? styles.active : ""}`} onClick={() => { onChange(option.value); setOpen(false); }}>{option.imageUrl || option.color || option.initials !== undefined ? <i style={{ "--option-color": option.color, backgroundImage: option.imageUrl ? `url(${option.imageUrl})` : undefined } as CSSProperties}>{option.imageUrl ? "" : option.initials}</i> : null}<span><strong>{option.label}</strong>{option.detail ? <small>{option.detail}</small> : null}</span>{option.value === value ? <Check className={styles.check} size={13} /> : null}</button>)}</div> : null}
  </div>;
}
