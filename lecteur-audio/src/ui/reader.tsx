import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Bookmark, ChevronLeft, Crosshair, ListOrdered, Search, Type } from 'lucide-preact';
import { player } from '../player';
import { saveSettings } from '../settings';
import { estimate } from '../player';
import { fold, remaining } from './format';
import { findDoc, openSheet, usePlayer, useSettings } from './store';

export function Reader({ id }: { id: string }) {
  usePlayer();
  const settings = useSettings();
  const doc = findDoc(id);
  const textRef = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);
  const autoScrolling = useRef(0);

  const chapter = player.doc?.id === id ? player.pos.chapter : (doc?.position.chapter ?? 0);
  const segment = player.doc?.id === id ? player.pos.segment : (doc?.position.segment ?? 0);
  const marks = useMemo(
    () => new Set((doc?.bookmarks ?? []).filter((b) => b.chapter === chapter).map((b) => b.segment)),
    [doc?.bookmarks?.length, chapter],
  );

  // Le texte d'un chapitre n'est rendu qu'une fois ; le surlignage est appliqué directement.
  const body = useMemo(() => {
    if (!doc) return null;
    const c = doc.chapters[chapter];
    const span = (i: number) => (
      <span key={i} class={`seg${marks.has(i) ? ' marked' : ''}`} data-i={i}>
        {c.segments[i]}{' '}
      </span>
    );
    // Le titre est déjà affiché en en-tête : on ne le répète pas (il reste lu à voix haute).
    const hideFirst = fold(c.segments[0] ?? '').replace(/\W/g, '') === fold(c.title).replace(/\W/g, '');
    const breaks = c.breaks?.length ? c.breaks : [0];
    return breaks.map((start, b) => {
      const end = breaks[b + 1] ?? c.segments.length;
      const idx = Array.from({ length: end - start }, (_, k) => start + k).filter((i) => !(hideFirst && i === 0));
      return idx.length ? <p key={start}>{idx.map(span)}</p> : null;
    });
  }, [doc, chapter, marks]);

  useEffect(() => {
    const root = textRef.current;
    if (!root) return;
    root.querySelector('.seg.current')?.classList.remove('current');
    const cur = root.querySelector<HTMLElement>(`.seg[data-i="${segment}"]`);
    if (!cur) return;
    cur.classList.add('current');
    if (settings.follow && !away) {
      const r = cur.getBoundingClientRect();
      if (r.top < 90 || r.bottom > innerHeight - 170) {
        autoScrolling.current = Date.now();
        cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [segment, chapter, body]);

  // Si l'utilisateur fait défiler lui-même, on arrête de suivre jusqu'à ce qu'il revienne.
  useEffect(() => {
    const onScroll = () => {
      if (Date.now() - autoScrolling.current < 900) return;
      const cur = textRef.current?.querySelector<HTMLElement>('.seg.current');
      if (!cur) return;
      const r = cur.getBoundingClientRect();
      setAway(r.bottom < 0 || r.top > innerHeight);
    };
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);

  if (!doc) return null;
  const est = estimate(doc, { chapter, segment });

  return (
    <div class="reader">
      <header class="app-bar reader-bar">
        <button class="icon-btn" aria-label="Retour" onClick={() => history.back()}>
          <ChevronLeft size={24} />
        </button>
        <div class="reader-title">
          <strong>{doc.title}</strong>
          <small>
            Chapitre {chapter + 1}/{doc.chapters.length} · {remaining((est.chapterTotal - est.chapterElapsed) / settings.rate)}
          </small>
        </div>
        <button class="icon-btn" aria-label="Rechercher" onClick={() => openSheet('search')}>
          <Search size={21} />
        </button>
        <button class="icon-btn" aria-label="Chapitres" onClick={() => openSheet('chapters')}>
          <ListOrdered size={21} />
        </button>
        <button class="icon-btn" aria-label="Apparence du texte" onClick={() => openSheet('text')}>
          <Type size={21} />
        </button>
      </header>

      <article
        class="reading"
        style={{ '--scale': settings.fontScale }}
        ref={textRef}
        onClick={(e) => {
          const seg = (e.target as HTMLElement).closest<HTMLElement>('.seg');
          if (!seg) return;
          if (player.doc?.id !== doc.id) player.load(doc);
          setAway(false);
          player.seek({ chapter, segment: Number(seg.dataset.i) }, true);
        }}
      >
        <p class="chapter-kicker">Chapitre {chapter + 1}</p>
        <h1 class="chapter-title">{doc.chapters[chapter].title}</h1>
        <div class="chapter-text">{body}</div>
        <nav class="chapter-nav">
          {chapter > 0 && (
            <button class="btn ghost" onClick={() => player.seek({ chapter: chapter - 1, segment: 0 }, false)}>
              ← Chapitre précédent
            </button>
          )}
          {chapter < doc.chapters.length - 1 && (
            <button class="btn" onClick={() => player.seek({ chapter: chapter + 1, segment: 0 }, player.playing)}>
              Chapitre suivant →
            </button>
          )}
        </nav>
      </article>

      {away && (
        <button
          class="follow-pill"
          onClick={() => {
            setAway(false);
            saveSettings({ follow: true });
            textRef.current?.querySelector('.seg.current')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }}
        >
          <Crosshair size={16} /> Revenir à la lecture
        </button>
      )}

      {marks.has(segment) && (
        <span class="sr-only">
          <Bookmark size={1} /> Passage marqué
        </span>
      )}
    </div>
  );
}
