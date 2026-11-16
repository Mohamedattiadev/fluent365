// Fluent365 service worker: caches the whole app for offline use and receives files/text shared
// from other Android apps (Web Share Target). Paths are relative to this file, so it works under
// any GitHub Pages sub-path. The build fills in the file list and version below.
const VERSION = "__VERSION__";
const FILES = self.__FILES__;
const CACHE = `fluent365-${VERSION}`;
const scope = new URL(self.registration.scope);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("fluent365-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("fluent365", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of ["kv", "blobs", "inbox"]) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function receiveShare(request) {
  const MAX = 20 * 1024 * 1024;
  try {
    const form = await request.formData();
    const items = [];
    const text = [form.get("title"), form.get("text"), form.get("url")].filter((x) => typeof x === "string" && x.trim()).join("\n");
    if (text) items.push({ kind: "text", name: "Shared text", text: text.slice(0, 200000) });
    for (const file of form.getAll("files")) {
      if (!(file instanceof File) || file.size > MAX) continue;
      const okType = /pdf|text\/plain/.test(file.type) || /\.(pdf|txt)$/i.test(file.name);
      if (!okType) continue;
      items.push({ kind: file.type.includes("pdf") || /\.pdf$/i.test(file.name) ? "pdf" : "textfile", name: file.name, blob: file });
    }
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("inbox", "readwrite");
      for (const it of items) tx.objectStore("inbox").put({ ...it, at: new Date().toISOString() }, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    // Fall through: the import page will show that nothing arrived.
  }
  return Response.redirect(new URL("./#/settings/import", scope).href, 303);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method === "POST" && url.pathname.endsWith("/share-target")) {
    event.respondWith(receiveShare(req));
    return;
  }
  if (req.method !== "GET" || url.origin !== location.origin) return;
  // Network first for navigation (fresh app when online), cache first for everything else.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(new URL("./", scope).href, copy));
        return res;
      }).catch(() => caches.match(new URL("./", scope).href)),
    );
    return;
  }
  event.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit || fetch(req)));
});
