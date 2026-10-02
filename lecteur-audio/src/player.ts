import { docs, type LibraryDoc } from './db';
import { downloadModel, isModelDownloaded, resolveVoice, synthesize, warmUp } from './engines/piper';
import { settings, voiceSignature } from './settings';
import { addListening } from './stats';
import { canUseVoice } from './premium';

export interface Pos {
  chapter: number;
  segment: number;
}

export function textAt(doc: LibraryDoc, p: Pos): string | undefined {
  return doc.chapters[p.chapter]?.segments[p.segment];
}

export function step(doc: LibraryDoc, p: Pos, delta: 1 | -1): Pos | null {
  let { chapter, segment } = p;
  segment += delta;
  while (chapter >= 0 && chapter < doc.chapters.length) {
    if (segment >= 0 && segment < doc.chapters[chapter].segments.length) return { chapter, segment };
    chapter += delta;
    if (chapter < 0 || chapter >= doc.chapters.length) return null;
    segment = delta > 0 ? 0 : doc.chapters[chapter].segments.length - 1;
  }
  return null;
}

/** Débit moyen des voix à vitesse 1× (caractères par seconde), pour estimer les durées. */
const CHARS_PER_SECOND = 17;

/** Index de caractères cumulés, pour la progression et le temps restant. */
const charIndex = new WeakMap<LibraryDoc, { chapterStart: number[]; segStart: number[][]; total: number }>();

function index(doc: LibraryDoc) {
  let idx = charIndex.get(doc);
  if (!idx) {
    let total = 0;
    const chapterStart: number[] = [];
    const segStart: number[][] = [];
    for (const c of doc.chapters) {
      chapterStart.push(total);
      const starts: number[] = [];
      for (const s of c.segments) {
        starts.push(total);
        total += s.length + 1;
      }
      segStart.push(starts);
    }
    idx = { chapterStart, segStart, total };
    charIndex.set(doc, idx);
  }
  return idx;
}

/** Progression globale (0–1) d'un document à une position donnée. */
export function progressOf(doc: LibraryDoc, p: Pos = doc.position): number {
  const idx = index(doc);
  return idx.total ? (idx.segStart[p.chapter]?.[p.segment] ?? 0) / idx.total : 0;
}

/** Durées estimées (en secondes, à vitesse 1×). */
export function estimate(doc: LibraryDoc, p: Pos = doc.position) {
  const idx = index(doc);
  const here = idx.segStart[p.chapter]?.[p.segment] ?? 0;
  const chapStart = idx.chapterStart[p.chapter] ?? 0;
  const chapEnd = idx.chapterStart[p.chapter + 1] ?? idx.total;
  return {
    total: idx.total / CHARS_PER_SECOND,
    remaining: (idx.total - here) / CHARS_PER_SECOND,
    chapterTotal: (chapEnd - chapStart) / CHARS_PER_SECOND,
    chapterElapsed: (here - chapStart) / CHARS_PER_SECOND,
  };
}

export function chapterProgress(doc: LibraryDoc, chapter: number, p: Pos = doc.position): number {
  if (p.chapter > chapter) return 1;
  if (p.chapter < chapter) return 0;
  const n = doc.chapters[chapter].segments.length;
  return n ? p.segment / n : 0;
}

/** Produit l'audio d'un passage avec la voix choisie (synthèse sur l'appareil). */
export function synthesizeAt(doc: LibraryDoc, p: Pos): Promise<Blob> {
  return synthesize(textAt(doc, p)!, settings.piperVoice);
}

type Listener = () => void;
export type SleepMode = { kind: 'off' } | { kind: 'time'; endsAt: number } | { kind: 'chapter' };

export class Player {
  doc: LibraryDoc | null = null;
  pos: Pos = { chapter: 0, segment: 0 };
  playing = false;
  loading = false;
  error = '';
  /** Message d'information temporaire (ex. téléchargement de la voix). */
  notice = '';
  sleep: SleepMode = { kind: 'off' };
  /** Appelé quand la voix choisie demande Kalara Premium (l'interface ouvre l'offre). */
  onPremiumRequired: () => void = () => {};
  /** Avancement (0–1) dans le passage en cours. */
  segmentFraction = 0;

  private audio = new Audio();
  private token = 0;
  private prefetch = new Map<string, Promise<Blob>>();
  private objectUrl = '';
  private listeners = new Set<Listener>();
  private timeListeners = new Set<Listener>();
  private saveTimer = 0;
  private sleepTimer = 0;
  private lastTime = 0;

  constructor() {
    this.audio.preload = 'auto';
    this.audio.addEventListener('ended', () => this.advance());
    this.audio.addEventListener('error', () => {
      if (this.playing && this.audio.src) this.fail('Lecture audio impossible pour ce passage.');
    });
    this.audio.addEventListener('timeupdate', () => {
      const t = this.audio.currentTime;
      if (this.playing && t > this.lastTime) addListening((t - this.lastTime) / settings.rate);
      this.lastTime = t;
      this.segmentFraction = this.audio.duration ? t / this.audio.duration : 0;
      this.timeListeners.forEach((fn) => fn());
    });
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.skipChapter(1));
      navigator.mediaSession.setActionHandler('previoustrack', () => this.skipChapter(-1));
      try {
        navigator.mediaSession.setActionHandler('seekforward', () => this.skip(1));
        navigator.mediaSession.setActionHandler('seekbackward', () => this.skip(-1));
      } catch {
        /* non pris en charge */
      }
    }
  }

  /** Abonnement aux changements d'état (lecture, position, erreurs). */
  onChange(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Abonnement à l'avancement fin dans le passage (≈ 4 fois par seconde). */
  onTime(fn: Listener) {
    this.timeListeners.add(fn);
    return () => this.timeListeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  load(doc: LibraryDoc) {
    if (this.doc?.id === doc.id) return;
    this.stop();
    this.doc = doc;
    this.pos = { ...doc.position };
    this.prefetch.clear();
    this.error = '';
    this.updateMediaSession();
    this.emit();
    if (settings.engine === 'piper') void warmUp(settings.piperVoice);
  }

  /** Vitesse modifiée : l'audio déjà généré reste valable, on ajuste seulement la lecture. */
  rateChanged() {
    this.audio.playbackRate = settings.rate;
    if (this.playing && settings.engine === 'system') this.start();
    else this.emit();
  }

  /** À appeler quand le moteur ou la voix changent. */
  settingsChanged() {
    this.prefetch.clear();
    this.audio.playbackRate = settings.rate;
    if (settings.engine === 'piper') void warmUp(settings.piperVoice);
    if (this.playing) this.start();
    else this.emit();
  }

  play() {
    if (!this.doc) return;
    this.playing = true;
    this.error = '';
    if (settings.engine !== 'system' && this.audio.src && this.audio.paused && this.audio.currentTime > 0 && !this.audio.ended) {
      this.audio.playbackRate = settings.rate;
      this.audio.volume = 1;
      void this.audio.play();
      this.updateMediaSession();
      this.emit();
      return;
    }
    this.start();
  }

  pause() {
    this.playing = false;
    this.token++;
    this.audio.pause();
    speechSynthesis.cancel();
    this.loading = false;
    this.updateMediaSession();
    this.emit();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  stop() {
    this.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  seek(p: Pos, autoplay = this.playing) {
    this.pos = p;
    this.segmentFraction = 0;
    this.audio.removeAttribute('src');
    this.persist();
    if (autoplay) {
      this.playing = true;
      this.start();
    } else {
      this.pause();
    }
  }

  skip(delta: 1 | -1) {
    if (!this.doc) return;
    const p = step(this.doc, this.pos, delta);
    if (p) this.seek(p);
  }

  skipChapter(delta: 1 | -1) {
    if (!this.doc) return;
    // « Précédent » au milieu d'un chapitre revient d'abord à son début.
    if (delta < 0 && this.pos.segment > 2) return this.seek({ chapter: this.pos.chapter, segment: 0 });
    const chapter = this.pos.chapter + delta;
    if (chapter >= 0 && chapter < this.doc.chapters.length) this.seek({ chapter, segment: 0 });
  }

  // ——— Minuterie de sommeil ———

  setSleep(mode: SleepMode) {
    clearTimeout(this.sleepTimer);
    this.audio.volume = 1;
    this.sleep = mode;
    if (mode.kind === 'time') {
      const tick = () => {
        const left = mode.endsAt - Date.now();
        if (left <= 0) {
          this.sleep = { kind: 'off' };
          this.pause();
          this.audio.volume = 1;
          return;
        }
        // Fondu sur les 10 dernières secondes.
        this.audio.volume = Math.min(1, left / 10_000);
        this.sleepTimer = window.setTimeout(tick, left > 12_000 ? left - 11_000 : 250);
      };
      tick();
    }
    this.emit();
  }

  private fail(message: string) {
    this.error = message;
    this.playing = false;
    this.loading = false;
    this.notice = '';
    this.updateMediaSession();
    this.emit();
  }

  private advance() {
    if (!this.doc || !this.playing) return;
    const p = step(this.doc, this.pos, 1);
    if (!p) {
      this.playing = false;
      this.doc.finishedAt = Date.now();
      this.persist();
      this.emit();
      return;
    }
    if (this.sleep.kind === 'chapter' && p.chapter !== this.pos.chapter) {
      this.pos = p;
      this.sleep = { kind: 'off' };
      this.persist();
      this.pause();
      return;
    }
    this.pos = p;
    this.persist();
    this.start();
  }

  private persist() {
    if (!this.doc) return;
    this.doc.position = { ...this.pos };
    this.doc.lastOpenedAt = Date.now();
    clearTimeout(this.saveTimer);
    const doc = this.doc;
    this.saveTimer = window.setTimeout(() => void docs.put(doc), 400);
  }

  private updateMediaSession() {
    if (!('mediaSession' in navigator) || !this.doc) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: this.doc.chapters[this.pos.chapter]?.title ?? this.doc.title,
      artist: this.doc.author ?? '',
      album: this.doc.title,
      artwork: this.doc.cover ? [{ src: this.doc.cover, sizes: '360x540', type: 'image/jpeg' }] : [],
    });
    navigator.mediaSession.playbackState = this.playing ? 'playing' : 'paused';
  }

  private start() {
    const token = ++this.token;
    this.audio.pause();
    speechSynthesis.cancel();
    this.lastTime = 0;
    this.segmentFraction = 0;
    this.updateMediaSession();
    this.emit();
    if (settings.engine === 'system') this.speakSystem(token);
    else void this.playAudio(token);
  }

  private speakSystem(token: number) {
    const text = textAt(this.doc!, this.pos);
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    const voice = speechSynthesis.getVoices().find((v) => v.voiceURI === settings.systemVoice);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = 'fr-FR';
    }
    u.rate = settings.rate;
    const started = Date.now();
    u.onend = () => {
      addListening(Math.min(29, (Date.now() - started) / 1000));
      if (token === this.token) this.advance();
    };
    u.onerror = (e) => {
      if (token === this.token && e.error !== 'canceled' && e.error !== 'interrupted') this.fail(`Voix de l'appareil : ${e.error}`);
    };
    speechSynthesis.speak(u);
  }

  private getAudio(p: Pos): Promise<Blob> {
    const key = `${voiceSignature()}|${p.chapter}|${p.segment}`;
    let promise = this.prefetch.get(key);
    if (!promise) {
      promise = synthesizeAt(this.doc!, p);
      promise.catch(() => this.prefetch.delete(key));
      this.prefetch.set(key, promise);
      if (this.prefetch.size > 10) this.prefetch.delete(this.prefetch.keys().next().value!);
    }
    return promise;
  }

  /** Télécharge la voix choisie si elle n'est pas encore sur l'appareil. */
  private async ensureVoice(token: number) {
    const voice = resolveVoice(settings.piperVoice);
    if (!canUseVoice(settings.piperVoice)) {
      this.onPremiumRequired();
      throw new Error(`La voix ${voice.label} fait partie de Kalara Premium. Choisissez Jessica ou Pierre (gratuites) ou activez un pass.`);
    }
    if (await isModelDownloaded(voice.model)) return;
    if (!navigator.onLine) {
      throw new Error(`La voix ${voice.label} n'est pas encore sur l'appareil : connectez-vous une fois à Internet pour la télécharger.`);
    }
    try {
      this.notice = `Téléchargement de la voix ${voice.label}…`;
      this.emit();
      await downloadModel(voice.model, (r) => {
        if (token !== this.token) return;
        this.notice = `Téléchargement de la voix ${voice.label} · ${Math.round(r * 100)} %`;
        this.emit();
      });
    } finally {
      this.notice = '';
    }
  }

  private async playAudio(token: number) {
    const doc = this.doc!;
    const pos = { ...this.pos };
    this.loading = true;
    this.emit();
    try {
      await this.ensureVoice(token);
      if (token !== this.token) return;
      const blob = await this.getAudio(pos);
      if (token !== this.token) return;
      // On prépare les passages suivants pendant la lecture.
      let n: Pos | null = pos;
      for (let i = 0; i < 3 && n; i++) {
        n = step(doc, n, 1);
        if (n) this.getAudio(n).catch(() => {});
      }
      if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = URL.createObjectURL(blob);
      this.audio.src = this.objectUrl;
      this.audio.playbackRate = settings.rate;
      this.loading = false;
      this.emit();
      await this.audio.play();
    } catch (err) {
      if (token === this.token) this.fail(err instanceof Error ? err.message : String(err));
    }
  }
}

export const player = new Player();
