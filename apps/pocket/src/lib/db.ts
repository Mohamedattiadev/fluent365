// Tiny IndexedDB wrapper. Stores: kv (app state slices), blobs (recordings, imported files),
// inbox (items shared from other apps by the service worker). Falls back to memory when
// IndexedDB is unavailable (private mode, tests), so the app still runs.
const DB_NAME = "fluent365";
const STORES = ["kv", "blobs", "inbox"] as const;
type Store = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory: Record<Store, Map<string, unknown>> = { kv: new Map(), blobs: new Map(), inbox: new Map() };

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        if (!db) return reject(new Error("no-idb"));
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve((req ? (req as IDBRequest).result : undefined) as T);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export async function get<T>(store: Store, key: string): Promise<T | undefined> {
  try {
    return await run<T>(store, "readonly", (s) => s.get(key));
  } catch {
    return memory[store].get(key) as T | undefined;
  }
}

export async function set(store: Store, key: string, value: unknown): Promise<void> {
  try {
    await run(store, "readwrite", (s) => s.put(value, key));
  } catch {
    memory[store].set(key, value);
  }
}

export async function del(store: Store, key: string): Promise<void> {
  try {
    await run(store, "readwrite", (s) => s.delete(key));
  } catch {
    memory[store].delete(key);
  }
}

export async function entries<T>(store: Store): Promise<[string, T][]> {
  try {
    const db = await open();
    if (!db) throw new Error("no-idb");
    return await new Promise((resolve, reject) => {
      const out: [string, T][] = [];
      const req = db.transaction(store, "readonly").objectStore(store).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return resolve(out);
        out.push([String(c.key), c.value as T]);
        c.continue();
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [...memory[store].entries()] as [string, T][];
  }
}

export async function clear(store: Store): Promise<void> {
  try {
    await run(store, "readwrite", (s) => s.clear());
  } catch {
    memory[store].clear();
  }
}

/** Ask the browser not to clear our data under storage pressure (best effort). */
export async function persist(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
