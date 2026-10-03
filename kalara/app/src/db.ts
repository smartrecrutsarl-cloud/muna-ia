// Petit wrapper IndexedDB : bibliothèque de documents.

export interface Chapter {
  title: string;
  /** Segments de texte prêts à être lus (une ou quelques phrases chacun). */
  segments: string[];
  /** Indices des segments qui commencent un paragraphe (mise en page). */
  breaks?: number[];
}

export interface Bookmark {
  chapter: number;
  segment: number;
  excerpt: string;
  createdAt: number;
}

export interface LibraryDoc {
  id: string;
  title: string;
  author?: string;
  format: 'pdf' | 'docx' | 'epub' | 'txt';
  addedAt: number;
  lastOpenedAt?: number;
  chapters: Chapter[];
  /** Position de lecture : chapitre + segment. */
  position: { chapter: number; segment: number };
  totalSegments: number;
  /** Couverture (JPEG en data URL) et couleur dominante. */
  cover?: string;
  color?: string;
  bookmarks?: Bookmark[];
  finishedAt?: number;
}

const DB_NAME = 'lecteur-audio';
const DOCS = 'docs';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DOCS)) db.createObjectStore(DOCS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const docs = {
  all: () => run<LibraryDoc[]>(DOCS, 'readonly', (s) => s.getAll()),
  get: (id: string) => run<LibraryDoc | undefined>(DOCS, 'readonly', (s) => s.get(id)),
  put: (doc: LibraryDoc) => run(DOCS, 'readwrite', (s) => s.put(doc)),
  delete: (id: string) => run(DOCS, 'readwrite', (s) => s.delete(id)),
};
