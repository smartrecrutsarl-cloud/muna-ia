import { BookmarkPlus, ChevronDown, ListOrdered, LoaderCircle, Mic, Moon, Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward } from 'lucide-preact';
import { docs } from '../db';
import { resolveVoice } from '../engines/piper';
import { chapterProgress, estimate, player, textAt } from '../player';
import { clock, remaining } from './format';
import { chaptersTab, closeNowPlaying, openBookFromSheet, openNowPlaying, openSheet, route, toast, usePlayer, usePlayerTime, useSettings } from './store';

function PlayIcon({ size }: { size: number }) {
  if (player.loading && player.playing) return <LoaderCircle size={size} class="spin" />;
  return player.playing ? <Pause size={size} fill="currentColor" /> : <Play size={size} fill="currentColor" />;
}

export function MiniPlayer() {
  usePlayer();
  usePlayerTime();
  const doc = player.doc;
  if (!doc) return null;
  const { chapter, segment } = player.pos;
  const n = doc.chapters[chapter].segments.length;
  const p = n ? (segment + player.segmentFraction) / n : 0;
  const status = player.error || player.notice;
  return (
    <div class="mini" style={{ '--tint': doc.color ?? '#2B2D42' }} onClick={openNowPlaying} role="button" aria-label="Ouvrir le lecteur">
      <img class="mini-cover" src={doc.cover} alt="" />
      <div class="mini-text">
        <strong>{doc.title}</strong>
        <small class={player.error ? 'error' : ''}>{status || doc.chapters[chapter].title}</small>
      </div>
      <button
        class="mini-btn"
        aria-label="Reculer d'un passage"
        onClick={(e) => {
          e.stopPropagation();
          player.skip(-1);
        }}
      >
        <RotateCcw size={20} />
      </button>
      <button
        class="mini-play"
        aria-label={player.playing ? 'Pause' : 'Lecture'}
        onClick={(e) => {
          e.stopPropagation();
          player.toggle();
        }}
      >
        <PlayIcon size={22} />
      </button>
      <span class="mini-progress" style={{ width: `${p * 100}%` }} />
    </div>
  );
}

const SPEEDS = [0.75, 0.9, 1, 1.15, 1.25, 1.5, 1.75, 2];

export function NowPlaying() {
  usePlayer();
  usePlayerTime();
  const settings = useSettings();
  const doc = player.doc;
  if (!doc) return null;
  const { chapter, segment } = player.pos;
  const n = doc.chapters[chapter].segments.length;
  const est = estimate(doc, player.pos);
  const segDur = n ? est.chapterTotal / n : 0;
  const elapsed = (est.chapterElapsed + segDur * player.segmentFraction) / settings.rate;
  const total = est.chapterTotal / settings.rate;
  const sleepLeft = player.sleep.kind === 'time' ? Math.max(0, (player.sleep.endsAt - Date.now()) / 1000) : 0;
  const voice = settings.engine === 'piper' ? resolveVoice(settings.piperVoice).label : 'Appareil';

  const addBookmark = async () => {
    const excerpt = (textAt(doc, player.pos) ?? '').slice(0, 140);
    doc.bookmarks = [...(doc.bookmarks ?? []), { chapter, segment, excerpt, createdAt: Date.now() }];
    await docs.put(doc);
    toast('Signet ajouté', 'ok');
  };

  return (
    <div class="np" style={{ '--tint': doc.color ?? '#2B2D42' }} role="dialog" aria-modal="true" aria-label="Lecture en cours">
      <div class="np-bg" />
      <header class="np-head">
        <button class="icon-btn on-dark" aria-label="Réduire" onClick={closeNowPlaying}>
          <ChevronDown size={26} />
        </button>
        <span class="np-eyebrow">Lecture en cours</span>
        <button
          class="icon-btn on-dark"
          aria-label="Voir le texte"
          onClick={() => {
            if (route.value.name === 'book' && route.value.id === doc.id) closeNowPlaying();
            else openBookFromSheet(doc.id);
          }}
        >
          <ListOrdered size={22} />
        </button>
      </header>

      <div class="np-main">
        <img class="np-cover" src={doc.cover} alt="" />
        <div class="np-titles">
          <h2>{doc.title}</h2>
          <p>{doc.chapters[chapter].title}</p>
        </div>

        <div class="np-scrub">
          <input
            type="range"
            min={0}
            max={Math.max(0, n - 1)}
            step={1}
            value={segment}
            aria-label="Position dans le chapitre"
            style={{ '--p': `${n > 1 ? ((segment + player.segmentFraction) / n) * 100 : 0}%` }}
            onChange={(e) => player.seek({ chapter, segment: Number((e.target as HTMLInputElement).value) })}
          />
          <div class="np-times">
            <span>{clock(elapsed)}</span>
            <span>{remaining((est.remaining - segDur * player.segmentFraction) / settings.rate)} dans le livre</span>
            <span>-{clock(Math.max(0, total - elapsed))}</span>
          </div>
        </div>

        <div class="np-controls">
          <button class="icon-btn on-dark" aria-label="Chapitre précédent" onClick={() => player.skipChapter(-1)}>
            <SkipBack size={26} fill="currentColor" />
          </button>
          <button class="icon-btn on-dark big" aria-label="Passage précédent" onClick={() => player.skip(-1)}>
            <RotateCcw size={28} />
          </button>
          <button class="np-play" aria-label={player.playing ? 'Pause' : 'Lecture'} onClick={() => player.toggle()}>
            <PlayIcon size={34} />
          </button>
          <button class="icon-btn on-dark big" aria-label="Passage suivant" onClick={() => player.skip(1)}>
            <RotateCw size={28} />
          </button>
          <button class="icon-btn on-dark" aria-label="Chapitre suivant" onClick={() => player.skipChapter(1)}>
            <SkipForward size={26} fill="currentColor" />
          </button>
        </div>

        {(player.notice || player.error) && <p class={`np-status ${player.error ? 'error' : ''}`}>{player.error || player.notice}</p>}

        <div class="np-chips">
          <button class="chip" onClick={() => openSheet('speed')}>
            <span class="chip-strong">{settings.rate.toLocaleString('fr-FR')}×</span> Vitesse
          </button>
          <button class={`chip ${player.sleep.kind !== 'off' ? 'on' : ''}`} onClick={() => openSheet('sleep')}>
            <Moon size={16} />
            {player.sleep.kind === 'time' ? clock(sleepLeft) : player.sleep.kind === 'chapter' ? 'Fin du chapitre' : 'Minuterie'}
          </button>
          <button class="chip" onClick={() => openSheet('settings')}>
            <Mic size={16} /> {voice}
          </button>
          <button
            class="chip"
            onClick={() => {
              chaptersTab.value = 'chapters';
              openSheet('chapters');
            }}
          >
            <ListOrdered size={16} /> {Math.round(chapterProgress(doc, chapter, player.pos) * 100)} %
          </button>
          <button class="chip" onClick={addBookmark} aria-label="Ajouter un signet">
            <BookmarkPlus size={16} /> Signet
          </button>
        </div>
      </div>
    </div>
  );
}

export { SPEEDS };
