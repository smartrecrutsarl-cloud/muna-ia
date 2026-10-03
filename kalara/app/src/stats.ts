// Statistiques d'écoute, stockées localement.

const KEY = 'lecteur-audio:stats';

interface Stats {
  days: Record<string, number>;
}

function load(): Stats {
  try {
    return { days: {}, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { days: {} };
  }
}

const stats = load();
let dirty = 0;

const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export function addListening(seconds: number) {
  if (!(seconds > 0 && seconds < 30)) return;
  const k = dayKey();
  stats.days[k] = (stats.days[k] ?? 0) + seconds;
  if (++dirty >= 10) flush();
}

export function flush() {
  dirty = 0;
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    /* stockage indisponible */
  }
}
addEventListener('pagehide', flush);

export function todaySeconds() {
  return stats.days[dayKey()] ?? 0;
}

export function totalSeconds() {
  return Object.values(stats.days).reduce((a, b) => a + b, 0);
}

/** Nombre de jours consécutifs avec au moins une minute d'écoute (aujourd'hui ou hier inclus). */
export function streak() {
  let n = 0;
  const d = new Date();
  if ((stats.days[dayKey(d)] ?? 0) < 60) d.setDate(d.getDate() - 1);
  while ((stats.days[dayKey(d)] ?? 0) >= 60) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
