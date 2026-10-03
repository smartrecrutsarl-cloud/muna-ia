/** « 2 h 14 min », « 14 min », « < 1 min ». */
export function duration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 1) return '< 1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`;
}

/** « 4:05 », « 1:02:09 ». */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Bonne nuit';
  if (h < 18) return 'Bonjour';
  return 'Bonsoir';
}

/** Comparaison insensible à la casse et aux accents. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** « 1 min restante », « 2 h 05 restantes ». */
export function remaining(seconds: number): string {
  const d = duration(seconds);
  return Math.round(seconds / 60) <= 1 ? `${d} restante` : `${d} restantes`;
}
