// Lokaler Speicher für eigene Grafik-Pakete (IndexedDB). Pakete bleiben im Browser des Nutzers – sie werden nie
// exportiert oder ins Repo übernommen (Lizenzen wie „Cute Fantasy Free“ verbieten die Weitergabe).
// Datensatz: { id, name, created, license: { name, text }, files: [{ path, blob }] }
const DB = 'drift-assets', STORE = 'packs';
let dbP = null;

function open() {
  if (dbP) return dbP;
  dbP = new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') { rej(new Error('IndexedDB nicht verfügbar')); return; }
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error || new Error('IndexedDB lässt sich nicht öffnen'));
  });
  dbP.catch(() => { dbP = null; });
  return dbP;
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode), s = t.objectStore(STORE);
    let out;
    Promise.resolve(fn(s)).then((v) => { out = v; });
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('abgebrochen'));
  });
}
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const putPack = (pack) => tx('readwrite', (s) => req(s.put(pack)));
export const getPack = (id) => tx('readonly', (s) => req(s.get(id)));
export const deletePack = (id) => tx('readwrite', (s) => req(s.delete(id)));
export async function listPacks() {
  const all = await tx('readonly', (s) => req(s.getAll()));
  return (all || []).map((p) => ({ id: p.id, name: p.name, created: p.created, license: p.license, files: p.files.length }));
}

/** eindeutige Paket-ID aus einem Namen */
export async function freePackId(name) {
  const base = String(name || 'paket').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\.zip$/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'paket';
  const have = new Set((await listPacks().catch(() => [])).map((p) => p.id));
  let id = base, i = 2;
  while (have.has(id)) id = `${base}${i++}`;
  return id;
}
