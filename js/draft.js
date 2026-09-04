// ============================================================================
// Borrador local — lo que Tomás va cargando ANTES de tocar "Publicar".
//   · metadata + notas          -> localStorage  ("bordmula.draft.<id>")
//   · imágenes de las tapas     -> IndexedDB      (blobs, pueden pesar)
// Nada de esto viaja al servidor hasta publicar.
// ============================================================================

const DRAFT_PREFIX = "bordmula.draft.";
const INDEX_KEY = "bordmula.drafts";

// --- IndexedDB mínimo para blobs -------------------------------------------
let dbp = null;
function idb() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open("bordmula", 1);
    } catch (e) {
      return reject(e);
    }
    // Chrome puede dejar open() sin resolver ni errar si hay un delete pendiente.
    const t = setTimeout(() => reject(new Error("IndexedDB no respondió")), 4000);
    req.onupgradeneeded = () => req.result.createObjectStore("tapas");
    req.onsuccess = () => {
      clearTimeout(t);
      const db = req.result;
      db.onversionchange = () => db.close(); // no bloquear un delete futuro
      resolve(db);
    };
    req.onerror = () => {
      clearTimeout(t);
      reject(req.error);
    };
    req.onblocked = () => {
      clearTimeout(t);
      reject(new Error("IndexedDB bloqueada"));
    };
  }).catch((e) => {
    dbp = null; // permitir reintento en la próxima llamada
    throw e;
  });
  return dbp;
}
async function idbPut(key, val) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction("tapas", "readwrite");
    tx.objectStore("tapas").put(val, key);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}
async function idbGet(key) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction("tapas", "readonly");
    const r = tx.objectStore("tapas").get(key);
    r.onsuccess = () => res(r.result || null);
    r.onerror = () => rej(r.error);
  });
}
async function idbDel(key) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction("tapas", "readwrite");
    tx.objectStore("tapas").delete(key);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

// --- API de borradores ----------------------------------------------------

export function newDraft(eventId, { date, label = "" } = {}) {
  return {
    eventId,
    date: date || eventId,
    label,
    notes: "",
    published: false,
    updatedAt: new Date().toISOString(),
    results: {}, // paperId -> { kind, value, comment, imageName }
  };
}

export function loadDraft(eventId) {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + eventId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft) {
  draft.updatedAt = new Date().toISOString();
  localStorage.setItem(DRAFT_PREFIX + draft.eventId, JSON.stringify(draft));
  const idx = new Set(listDraftIds());
  idx.add(draft.eventId);
  localStorage.setItem(INDEX_KEY, JSON.stringify([...idx]));
}

export function listDraftIds() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) || "[]");
  } catch {
    return [];
  }
}

export function listDrafts() {
  return listDraftIds()
    .map(loadDraft)
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function deleteDraft(eventId) {
  const d = loadDraft(eventId);
  if (d) {
    for (const paperId of Object.keys(d.results)) {
      await idbDel(imgKey(eventId, paperId)).catch(() => {});
    }
  }
  localStorage.removeItem(DRAFT_PREFIX + eventId);
  localStorage.setItem(
    INDEX_KEY,
    JSON.stringify(listDraftIds().filter((id) => id !== eventId))
  );
}

export function markPublished(eventId) {
  const d = loadDraft(eventId);
  if (d) {
    d.published = true;
    saveDraft(d);
  }
}

// --- imágenes -----------------------------------------------------------

const imgKey = (eventId, paperId) => `draft:${eventId}:${paperId}`;

export async function setDraftImage(eventId, paperId, blob) {
  await idbPut(imgKey(eventId, paperId), blob);
}
export async function getDraftImage(eventId, paperId) {
  return idbGet(imgKey(eventId, paperId));
}
export async function deleteDraftImage(eventId, paperId) {
  await idbDel(imgKey(eventId, paperId)).catch(() => {});
}
