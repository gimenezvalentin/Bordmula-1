// ============================================================================
// "Publicar": manda el borrador al servidor.
//   online  -> Supabase (Storage.upload + upsert events/results)
//   demo    -> localStorage "bordmula.published" (imágenes como data URL)
//
// Idempotente: paths fijos + upsert. Si algo falla, se puede reintentar sin
// duplicar y el borrador se conserva.
// ============================================================================

import { supabase, isOnline } from "./supabase.js";
import { TAPAS_BUCKET } from "./config.js";
import { getDraftImage } from "./draft.js";
import { resizeToJpeg } from "./img.js";
import { PUBLISHED_KEY } from "./data.js";

const ACTIVE = new Set(["score", "choco", "sin-motor"]);

/**
 * @param {object} draft  (de draft.js)
 * @returns {Promise<{ok:boolean, count:number, failed:Array<{paperId:string,error:string}>}>}
 */
export async function publishDraft(draft) {
  const entries = Object.entries(draft.results).filter(([, r]) => ACTIVE.has(r.kind));
  const failed = [];
  const rows = [];

  for (const [paperId, r] of entries) {
    try {
      let imagePath = r.imagePath || null;
      const blob = await getDraftImage(draft.eventId, paperId);
      if (blob) {
        imagePath = await putImage(draft.eventId, paperId, blob);
      }
      rows.push({
        event_id: draft.eventId,
        paper_id: paperId,
        kind: r.kind,
        value: r.kind === "score" ? clampScore(r.value) : 0,
        comment: (r.comment || "").trim(),
        image_path: imagePath,
      });
    } catch (e) {
      failed.push({ paperId, error: e.message || String(e) });
    }
  }

  const eventRow = {
    id: draft.eventId,
    date: draft.date,
    label: (draft.label || "").trim(),
    notes: (draft.notes || "").trim(),
    published_at: new Date().toISOString(),
  };

  if (isOnline()) {
    await saveOnline(eventRow, rows);
  } else {
    saveLocal(eventRow, rows);
  }

  return { ok: failed.length === 0, count: rows.length, failed };
}

// ---------------------------------------------------------------------------

async function putImage(eventId, paperId, blob) {
  const jpeg = await resizeToJpeg(blob);
  if (isOnline()) {
    const path = `${eventId}/${paperId}.jpg`;
    const { error } = await supabase.storage
      .from(TAPAS_BUCKET)
      .upload(path, jpeg, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
    if (error) throw error;
    return path;
  }
  return blobToDataUrl(jpeg); // demo
}

async function saveOnline(eventRow, rows) {
  const ev = await supabase.from("events").upsert(eventRow);
  if (ev.error) throw ev.error;

  if (rows.length) {
    const res = await supabase
      .from("results")
      .upsert(rows, { onConflict: "event_id,paper_id" });
    if (res.error) throw res.error;
  }

  // borrar filas de diarios que se sacaron de esta fecha
  const keep = rows.map((r) => r.paper_id);
  let del = supabase.from("results").delete().eq("event_id", eventRow.id);
  if (keep.length) del = del.not("paper_id", "in", `(${keep.join(",")})`);
  const d = await del;
  if (d.error) throw d.error;
}

function saveLocal(eventRow, rows) {
  let db;
  try {
    db = JSON.parse(localStorage.getItem(PUBLISHED_KEY) || "{}");
  } catch {
    db = {};
  }
  db.papers = db.papers || [];
  db.events = (db.events || []).filter((e) => e.id !== eventRow.id).concat(eventRow);
  db.results = (db.results || [])
    .filter((r) => r.event_id !== eventRow.id)
    .concat(rows);
  localStorage.setItem(PUBLISHED_KEY, JSON.stringify(db));
}

function clampScore(v) {
  const n = Math.round((Number(v) || 0) * 10) / 10;
  return Math.min(10, Math.max(0, n));
}

function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
}
