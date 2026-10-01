import { audioCache, docs, type LibraryDoc } from './db';
import { elevenSynthesize } from './engines/elevenlabs';
import { piperSynthesize } from './engines/piper';
import { settings, voiceSignature } from './settings';

export interface Pos {
  chapter: number;
  segment: number;
}

export function cacheKey(docId: string, sig: string, p: Pos) {
  return `${docId}|${sig}|${String(p.chapter).padStart(5, '0')}|${String(p.segment).padStart(6, '0')}`;
}

export function cachePrefix(docId: string, sig?: string) {
  return sig ? `${docId}|${sig}|` : `${docId}|`;
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

/** Produit (ou relit depuis le cache) l'audio d'un segment pour le moteur courant. */
export async function synthesizeAt(doc: LibraryDoc, p: Pos, opts: { store: boolean }): Promise<Blob> {
  const sig = voiceSignature();
  const key = cacheKey(doc.id, sig, p);
  const cached = await audioCache.get(key);
  if (cached) return cached;

  const text = textAt(doc, p)!;
  let blob: Blob;
  if (settings.engine === 'elevenlabs') {
    if (!navigator.onLine) throw new Error("Ce passage n'a pas été préparé pour l'écoute hors ligne avec ElevenLabs.");
    if (!settings.elevenKey || !settings.elevenVoice) throw new Error('Configurez votre clé et votre voix ElevenLabs dans les réglages.');
    const prev = step(doc, p, -1);
    const next = step(doc, p, 1);
    blob = await elevenSynthesize(text, {
      apiKey: settings.elevenKey,
      voiceId: settings.elevenVoice,
      modelId: settings.elevenModel,
      previousText: prev ? textAt(doc, prev) : undefined,
      nextText: next ? textAt(doc, next) : undefined,
    });
  } else {
    blob = await piperSynthesize(text, settings.piperVoice);
  }
  if (opts.store) await audioCache.put(key, blob);
  return blob;
}

type Listener = () => void;

export class Player {
  doc: LibraryDoc | null = null;
  pos: Pos = { chapter: 0, segment: 0 };
  playing = false;
  loading = false;
  error = '';

  private audio = new Audio();
  private token = 0;
  private prefetch = new Map<string, Promise<Blob>>();
  private objectUrl = '';
  private listeners = new Set<Listener>();
  private saveTimer = 0;

  constructor() {
    this.audio.preload = 'auto';
    this.audio.addEventListener('ended', () => this.advance());
    this.audio.addEventListener('error', () => {
      if (this.playing && this.audio.src) this.fail('Lecture audio impossible pour ce passage.');
    });
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.skip(1));
      navigator.mediaSession.setActionHandler('previoustrack', () => this.skip(-1));
    }
  }

  onChange(fn: Listener) {
    this.listeners.add(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  load(doc: LibraryDoc) {
    this.stop();
    this.doc = doc;
    this.pos = { ...doc.position };
    this.prefetch.clear();
    this.emit();
  }

  /** À appeler quand le moteur, la voix ou la vitesse changent. */
  settingsChanged() {
    this.prefetch.clear();
    this.audio.playbackRate = settings.rate;
    if (this.playing) this.start();
  }

  play() {
    if (!this.doc) return;
    this.playing = true;
    this.error = '';
    if (settings.engine !== 'system' && this.audio.src && this.audio.paused && this.audio.currentTime > 0 && !this.audio.ended) {
      this.audio.playbackRate = settings.rate;
      void this.audio.play();
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
    const chapter = this.pos.chapter + delta;
    if (chapter >= 0 && chapter < this.doc.chapters.length) this.seek({ chapter, segment: 0 });
  }

  private fail(message: string) {
    this.error = message;
    this.playing = false;
    this.loading = false;
    this.emit();
  }

  private advance() {
    if (!this.doc || !this.playing) return;
    const p = step(this.doc, this.pos, 1);
    if (!p) {
      this.playing = false;
      this.emit();
      return;
    }
    this.pos = p;
    this.persist();
    this.start();
  }

  private persist() {
    if (!this.doc) return;
    this.doc.position = { ...this.pos };
    clearTimeout(this.saveTimer);
    const doc = this.doc;
    this.saveTimer = window.setTimeout(() => void docs.put(doc), 500);
  }

  private updateMediaSession() {
    if (!('mediaSession' in navigator) || !this.doc) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: this.doc.title,
      artist: this.doc.chapters[this.pos.chapter]?.title ?? '',
      album: 'Lecteur Audio',
    });
    navigator.mediaSession.playbackState = this.playing ? 'playing' : 'paused';
  }

  private start() {
    const token = ++this.token;
    this.audio.pause();
    speechSynthesis.cancel();
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
    u.onend = () => token === this.token && this.advance();
    u.onerror = (e) => {
      if (token === this.token && e.error !== 'canceled' && e.error !== 'interrupted') this.fail(`Voix système : ${e.error}`);
    };
    speechSynthesis.speak(u);
  }

  private getAudio(p: Pos): Promise<Blob> {
    const key = `${voiceSignature()}|${p.chapter}|${p.segment}`;
    let promise = this.prefetch.get(key);
    if (!promise) {
      // ElevenLabs : on garde toujours l'audio (il est payant) ; Piper : régénéré à la volée.
      promise = synthesizeAt(this.doc!, p, { store: settings.engine === 'elevenlabs' });
      promise.catch(() => this.prefetch.delete(key));
      this.prefetch.set(key, promise);
      if (this.prefetch.size > 8) this.prefetch.delete(this.prefetch.keys().next().value!);
    }
    return promise;
  }

  private async playAudio(token: number) {
    const doc = this.doc!;
    const pos = { ...this.pos };
    this.loading = true;
    this.emit();
    try {
      const blob = await this.getAudio(pos);
      if (token !== this.token) return;
      // On prépare les deux segments suivants pendant la lecture.
      let n: Pos | null = pos;
      for (let i = 0; i < 2 && n; i++) {
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
