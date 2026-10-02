import { useState } from 'preact/hooks';
import { Clock, EllipsisVertical, Flame, Library, Play, Plus, Settings, Trash2, WifiOff } from 'lucide-preact';
import type { LibraryDoc } from '../db';
import { estimate, player, progressOf } from '../player';
import { settings } from '../settings';
import { streak, todaySeconds } from '../stats';
import { Cover, Logo, pickFiles } from './common';
import { greeting, remaining } from './format';
import { deleteDoc, importing, library, online, openBook, openSheet, usePlayer } from './store';

export function Home() {
  usePlayer();
  const docs = library.value;
  const recent = docs.find((d) => d.lastOpenedAt && !d.finishedAt) ?? null;
  return (
    <div class="home">
      <header class="app-bar">
        <div class="brand">
          <Logo />
          <span>Muna Audio</span>
        </div>
        <div class="row gap-s">
          {!online.value && (
            <span class="pill">
              <WifiOff size={14} /> Hors ligne
            </span>
          )}
          <button class="icon-btn" aria-label="Réglages" onClick={() => openSheet('settings')}>
            <Settings size={22} />
          </button>
        </div>
      </header>

      <main class="page">
        <section class="hello">
          <h1>{greeting()}</h1>
          <p>{docs.length ? 'Que voulez-vous écouter aujourd’hui ?' : 'Transformez vos documents en livres audio.'}</p>
        </section>

        {recent && <ContinueCard doc={recent} />}

        {docs.length > 0 && <StatsRow count={docs.length} />}

        <section class="section">
          <div class="section-head">
            <h2>Ma bibliothèque</h2>
            {docs.length > 0 && (
              <button class="btn ghost" onClick={() => pickFiles()}>
                <Plus size={18} /> Ajouter
              </button>
            )}
          </div>
          {importing.value && (
            <div class="import-card">
              <div class="spinner" />
              <div class="grow">
                <strong>Préparation de « {importing.value.name} »</strong>
                <div class="bar">
                  <span style={{ width: `${Math.round(importing.value.progress * 100)}%` }} />
                </div>
              </div>
            </div>
          )}
          {docs.length ? (
            <div class="grid">
              {docs.map((d) => (
                <BookTile key={d.id} doc={d} />
              ))}
              <article class="tile">
                <button class="tile-add" onClick={() => pickFiles()}>
                  <span>
                    <Plus size={24} />
                  </span>
                  Ajouter
                </button>
              </article>
            </div>
          ) : (
            !importing.value && <EmptyState />
          )}
        </section>
      </main>

    </div>
  );
}

function ContinueCard({ doc }: { doc: LibraryDoc }) {
  const d = player.doc?.id === doc.id ? player.doc : doc;
  const p = progressOf(d);
  const left = estimate(d).remaining / settings.rate;
  const isPlaying = player.playing && player.doc?.id === doc.id;
  return (
    <section class="continue" style={{ '--tint': doc.color ?? '#2B2D42' }} onClick={() => openBook(doc.id)}>
      <Cover doc={doc} class="continue-cover" />
      <div class="continue-info">
        <span class="eyebrow">Reprendre</span>
        <h3>{doc.title}</h3>
        <p class="continue-chapter">{d.chapters[d.position.chapter]?.title}</p>
        <div class="bar light">
          <span style={{ width: `${p * 100}%` }} />
        </div>
        <p class="continue-meta">
          {Math.round(p * 100)} % · {remaining(left)}
        </p>
      </div>
      <button
        class="continue-play"
        aria-label={isPlaying ? 'Pause' : 'Lecture'}
        onClick={(e) => {
          e.stopPropagation();
          if (player.doc?.id !== doc.id) player.load(doc);
          player.toggle();
        }}
      >
        {isPlaying ? <span class="eq"><i /><i /><i /></span> : <Play size={24} fill="currentColor" />}
      </button>
    </section>
  );
}

function StatsRow({ count }: { count: number }) {
  const s = streak();
  return (
    <div class="stats">
      <div class="stat">
        <Flame size={18} />
        <div>
          <strong>{s}</strong>
          <small>{s > 1 ? 'jours d’affilée' : 'jour d’affilée'}</small>
        </div>
      </div>
      <div class="stat">
        <Clock size={18} />
        <div>
          <strong>{Math.round(todaySeconds() / 60)} min</strong>
          <small>aujourd’hui</small>
        </div>
      </div>
      <div class="stat">
        <Library size={18} />
        <div>
          <strong>{count}</strong>
          <small>{count > 1 ? 'documents' : 'document'}</small>
        </div>
      </div>
    </div>
  );
}

function BookTile({ doc }: { doc: LibraryDoc }) {
  const [menu, setMenu] = useState(false);
  const p = progressOf(doc);
  const nowPlaying = player.doc?.id === doc.id && player.playing;
  return (
    <article class="tile">
      <button class="tile-cover" onClick={() => openBook(doc.id)} aria-label={`Ouvrir ${doc.title}`}>
        <Cover doc={doc} />
        {nowPlaying && (
          <span class="tile-live">
            <span class="eq"><i /><i /><i /></span>
          </span>
        )}
        {doc.finishedAt ? <span class="tile-badge">Terminé</span> : p > 0 && <span class="tile-progress" style={{ width: `${p * 100}%` }} />}
      </button>
      <div class="tile-text">
        <div class="grow" onClick={() => openBook(doc.id)}>
          <h3>{doc.title}</h3>
          <p>{doc.author ?? doc.format.toUpperCase()}</p>
        </div>
        <button class="icon-btn small" aria-label="Options" onClick={() => setMenu(!menu)}>
          <EllipsisVertical size={18} />
        </button>
      </div>
      {menu && (
        <div class="menu" onMouseLeave={() => setMenu(false)}>
          <button
            class="danger"
            onClick={async () => {
              setMenu(false);
              if (confirm(`Supprimer « ${doc.title} » de la bibliothèque ?`)) await deleteDoc(doc);
            }}
          >
            <Trash2 size={16} /> Supprimer
          </button>
        </div>
      )}
    </article>
  );
}

function EmptyState() {
  return (
    <div class="empty">
      <div class="empty-art" aria-hidden="true">
        <span class="book b1" />
        <span class="book b2" />
        <span class="book b3" />
        <span class="wave" />
      </div>
      <h3>Votre bibliothèque est vide</h3>
      <p>Ajoutez un PDF, un document Word ou un livre EPUB : il sera lu avec une voix naturelle, même sans connexion.</p>
      <button class="btn primary big" onClick={() => pickFiles((id) => id && openBook(id))}>
        <Plus size={20} /> Ajouter un document
      </button>
      <p class="hint">Astuce : depuis WhatsApp ou vos fichiers, utilisez « Partager » → Muna Audio.</p>
    </div>
  );
}
