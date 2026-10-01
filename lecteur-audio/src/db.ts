// Petit wrapper IndexedDB : bibliothèque de documents.

export interface Chapter {
  title: string;
  /** Segments de texte prêts à être lus (quelques phrases chacun). */
  segments: string[];
}

export interface LibraryDoc {
  id: string;
  title: string;
  format: 'pdf' | 'docx' | 'epub' | 'txt';
  addedAt: number;
  chapters: Chapter[];
  /** Position de lecture : chapitre + segment. */
  position: { chapter: number; segment: number };
  totalSegments: number;
}

const DB_NAME = 'lecteur-audio';
const DOCS = 'docs';
const AUDIO = 'audio';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore(DOCS, { keyPath: 'id' });
      db.createObjectStore(AUDIO);
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
