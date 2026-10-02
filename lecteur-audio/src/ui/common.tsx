import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { X } from 'lucide-preact';
import type { LibraryDoc } from '../db';
import { closeSheet, importFiles, toasts } from './store';

export const ACCEPT = '.pdf,.docx,.epub,.txt,application/pdf,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

/** Ouvre le sélecteur de fichiers et importe les documents choisis. */
export function pickFiles(onDone?: (id: string | null) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = ACCEPT;
  input.multiple = true;
  input.onchange = async () => {
    if (!input.files?.length) return;
    const doc = await importFiles(input.files);
    onDone?.(doc?.id ?? null);
  };
  input.click();
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="var(--accent)" />
          <stop offset="1" stop-color="var(--accent-2)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#lg)" />
      <path d="M17 20c6-2 11-1.5 15 2v23c-4-3.2-9-3.8-15-2z" fill="#fff" opacity=".95" />
      <path d="M47 20c-6-2-11-1.5-15 2v23c4-3.2 9-3.8 15-2z" fill="#fff" opacity=".7" />
      <path d="M37 30.5a4.5 4.5 0 0 1 0 6.5M40.5 27.5a9 9 0 0 1 0 12.5" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" />
    </svg>
  );
}

export function Cover({ doc, class: cls = '' }: { doc: LibraryDoc; class?: string }) {
  return doc.cover ? (
    <img class={`cover ${cls}`} src={doc.cover} alt="" loading="lazy" decoding="async" />
  ) : (
    <div class={`cover cover-empty ${cls}`} />
  );
}

export function ProgressRing({ value, size = 36, stroke = 3, children }: { value: number; size?: number; stroke?: number; children?: ComponentChildren }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span class="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" stroke-width={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          stroke-width={stroke}
          stroke-dasharray={c}
          stroke-dashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
          stroke-linecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children && <span class="ring-content">{children}</span>}
    </span>
  );
}

/** Feuille qui monte du bas de l'écran (plein écran sur mobile pour `full`). */
export function Sheet({ title, children, full = false, onClose, class: cls = '' }: { title?: ComponentChildren; children: ComponentChildren; full?: boolean; onClose?: () => void; class?: string }) {
  const close = onClose ?? closeSheet;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => removeEventListener('keydown', onKey);
  }, []);
  return (
    <div class="sheet-layer" onClick={(e) => e.target === e.currentTarget && close()}>
      <div ref={ref} tabIndex={-1} class={`sheet ${full ? 'sheet-full' : ''} ${cls}`} role="dialog" aria-modal="true">
        {!full && <div class="sheet-handle" />}
        {title !== undefined && (
          <header class="sheet-head">
            <h2>{title}</h2>
            <button class="icon-btn" onClick={close} aria-label="Fermer">
              <X size={20} />
            </button>
          </header>
        )}
        <div class="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Toasts() {
  return (
    <div class="toasts" aria-live="polite">
      {toasts.value.map((t) => (
        <div key={t.id} class={`toast ${t.kind ?? ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ComponentChildren }[]; onChange: (v: T) => void }) {
  return (
    <div class="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} class={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
