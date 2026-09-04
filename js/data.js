// ============================================================================
// Lecturas de datos. Online -> Supabase. Sin credenciales -> localStorage
// (clave "bordmula.published"), para poder probar toda la UI sin backend.
// ============================================================================

import { supabase, isOnline } from "./supabase.js";
import { TAPAS_BUCKET } from "./config.js";

export const PUBLISHED_KEY = "bordmula.published";

// Roster por defecto (mismo que supabase/schema.sql). Se usa si la tabla
// "papers" está vacía o en modo demo. Editable desde el botón "Diarios".
export const SEED_PAPERS = [
  { id: "clarin", name: "Clarín", color: "#D6001C", text_on: "#ffffff", active: true, sort: 10 },
  { id: "la-nacion", name: "La Nación", color: "#0A2A66", text_on: "#ffffff", active: true, sort: 20 },
  { id: "ole", name: "Olé", color: "#111111", text_on: "#ffffff", active: true, sort: 30 },
  { id: "cronica", name: "Crónica", color: "#FFD200", text_on: "#14140f", active: true, sort: 40 },
];

/** Devuelve { papers, events, results } de lo YA publicado. */
export async function loadDb() {
  if (!isOnline()) return readLocalPublished();

  const [papers, events, results] = await Promise.all([
    supabase.from("papers").select("*").order("sort", { ascending: true }),
    supabase.from("events").select("*"),
    supabase.from("results").select("*"),
  ]);
  const err = papers.error || events.error || results.error;
  if (err) throw err;

  return {
    papers: papers.data?.length ? papers.data : SEED_PAPERS,
    events: events.data || [],
    results: results.data || [],
  };
}

/** Solo el roster (para armar la grilla del scorer). */
export async function loadPapers() {
  if (!isOnline()) {
    const local = readLocalPublished();
    return local.papers.length ? local.papers : SEED_PAPERS;
  }
  const { data, error } = await supabase
    .from("papers")
    .select("*")
    .order("sort", { ascending: true });
  if (error) throw error;
  return data?.length ? data : SEED_PAPERS;
}

/** URL pública de una tapa a partir de su image_path. */
export function publicImageUrl(path) {
  if (!path) return null;
  if (/^(data:|blob:|https?:)/.test(path)) return path; // demo o URL directa
  if (!isOnline()) return null;
  return supabase.storage.from(TAPAS_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ---------------------------------------------------------------------------

function readLocalPublished() {
  try {
    const raw = localStorage.getItem(PUBLISHED_KEY);
    if (!raw) return { papers: SEED_PAPERS, events: [], results: [] };
    const db = JSON.parse(raw);
    return {
      papers: db.papers?.length ? db.papers : SEED_PAPERS,
      events: db.events || [],
      results: db.results || [],
    };
  } catch {
    return { papers: SEED_PAPERS, events: [], results: [] };
  }
}
