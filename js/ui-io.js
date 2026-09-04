// ============================================================================
// Respaldo manual extra (JSON). Sirve sobre todo en modo demo y como red de
// seguridad. NO reemplaza a Supabase: importar solo restaura el estado LOCAL.
// ============================================================================

import { loadDb, PUBLISHED_KEY } from "./data.js";
import { listDrafts, saveDraft } from "./draft.js";

export async function exportBackup() {
  const payload = {
    kind: "bordmula-backup",
    exportedAt: new Date().toISOString(),
    published: await loadDb(),
    drafts: listDrafts(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `bordmula-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importBackup(file) {
  const data = JSON.parse(await file.text());
  if (data.kind !== "bordmula-backup") throw new Error("Archivo no reconocido");

  if (data.published) {
    localStorage.setItem(PUBLISHED_KEY, JSON.stringify(data.published));
  }
  let drafts = 0;
  for (const d of data.drafts || []) {
    saveDraft(d);
    drafts++;
  }
  return { events: data.published?.events?.length || 0, drafts };
}
