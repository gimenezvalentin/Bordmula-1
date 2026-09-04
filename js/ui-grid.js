// ============================================================================
// Grilla de puntuación de una fecha. Una tarjeta por diario.
//   imagen  : subir / pegar / desde URL / arrastrar   (+ click = zoom)
//   nota    : 0–10 con decimales (slider + número)
//   flags   : "Chocó" / "Sin motor"  (0 puntos)
//   nota libre opcional
// Escribe en draft.results[paperId] y llama onChange() en cada cambio.
// ============================================================================

import { openZoom } from "./zoom.js";
import { setDraftImage, getDraftImage, deleteDraftImage } from "./draft.js";
import { fetchImageBlob } from "./img.js";
import { formatScore } from "./scoring.js";
import { publicImageUrl } from "./data.js";

const DEFAULT_SCORE = 7.0;

export async function createGrid(container, { papers, draft, onChange }) {
  container.innerHTML = "";
  const urls = new Map(); // paperId -> objectURL (para revocar)

  // pegar imagen (Ctrl+V) en cualquier lado -> va a la última tarjeta tocada
  if (container._pasteHandler) {
    document.removeEventListener("paste", container._pasteHandler);
  }
  let lastCard = null;
  container.addEventListener("focusin", (e) => {
    const c = e.target.closest(".card");
    if (c) lastCard = c;
  });
  const onPaste = (e) => {
    for (const it of e.clipboardData?.items || []) {
      if (it.type.startsWith("image/")) {
        const blob = it.getAsFile();
        const card = lastCard || container.querySelector(".card");
        if (blob && card && card._useBlob) {
          e.preventDefault();
          card._useBlob(blob);
        }
        return;
      }
    }
  };
  container._pasteHandler = onPaste;
  document.addEventListener("paste", onPaste);

  for (const p of papers) {
    if (p.active === false) continue;
    const r = ensureResult(draft, p.id);
    const card = buildCard(p, r);
    container.appendChild(card);
    wireCard(card, p, draft, onChange, urls);
    paint(card, r);
    // la tapa se carga aparte: si IndexedDB se demora no frena la grilla
    hydrateImage(card, p, draft, r, urls);
  }
}

async function hydrateImage(card, p, draft, r, urls) {
  try {
    const blob = await getDraftImage(draft.eventId, p.id);
    if (blob) return showThumb(card, blob, urls, p.id);
  } catch {
    /* IndexedDB no disponible: se cae al imagePath si hay */
  }
  if (r.imagePath) showThumbUrl(card, publicImageUrl(r.imagePath), urls, p.id);
}

// ---------------------------------------------------------------------------

function ensureResult(draft, paperId) {
  if (!draft.results[paperId]) {
    draft.results[paperId] = {
      kind: "none",
      value: DEFAULT_SCORE,
      comment: "",
      imageName: null,
      imagePath: null,
    };
  }
  return draft.results[paperId];
}

function buildCard(p, r) {
  const el = document.createElement("article");
  el.className = "card";
  el.dataset.paper = p.id;
  el.style.setProperty("--livery", p.color || "#888");
  el.style.setProperty("--livery-ink", p.text_on || "#fff");
  const hasNote = !!(r.comment || "").trim();
  el.innerHTML = `
    <div class="card__livery"></div>
    <div class="card__body">
      <div class="card__top">
        <h3 class="card__name">${escape(p.name)}</h3>
        <span class="card__state" data-role="state"></span>
      </div>

      <button type="button" class="drop" data-role="drop">
        <img class="drop__thumb" data-role="thumb" alt="" hidden>
        <span class="drop__empty">Subí o pegá la tapa</span>
        <input type="file" accept="image/*" hidden data-role="file">
      </button>

      <div class="card__score">
        <input type="range" min="0" max="10" step="0.1" data-role="range" value="${r.value}">
        <input type="number" min="0" max="10" step="0.1" data-role="num"
               inputmode="decimal" value="${r.value}">
      </div>
      <div class="card__flags">
        <button type="button" class="flag flag--choco" data-role="choco">Chocó</button>
        <button type="button" class="flag flag--motor" data-role="sinmotor">Sin motor</button>
        <button type="button" class="flag flag--clear" data-role="clear" hidden>limpiar</button>
      </div>

      <div class="card__extra">
        <button type="button" class="linkbtn" data-role="urlbtn">pegar URL</button>
        <button type="button" class="linkbtn" data-role="notebtn" ${hasNote ? 'hidden' : ''}>+ comentario</button>
        <button type="button" class="linkbtn" data-role="clearimg" hidden>quitar tapa</button>
      </div>
      <input class="card__note" data-role="note" maxlength="140"
             placeholder="Comentario" value="${escape(r.comment)}" ${hasNote ? '' : 'hidden'}>
    </div>`;
  return el;
}

function wireCard(card, p, draft, onChange, urls) {
  const q = (role) => card.querySelector(`[data-role="${role}"]`);
  const r = draft.results[p.id];
  const commit = () => {
    paint(card, r);
    onChange();
  };

  const num = q("num");
  const range = q("range");
  const setScore = (v) => {
    const n = clamp(v);
    r.kind = "score";
    r.value = n;
    num.value = n;
    range.value = n;
    commit();
  };
  num.addEventListener("input", () => setScore(num.value));
  range.addEventListener("input", () => setScore(range.value));

  q("choco").addEventListener("click", () => {
    r.kind = r.kind === "choco" ? "none" : "choco";
    commit();
  });
  q("sinmotor").addEventListener("click", () => {
    r.kind = r.kind === "sin-motor" ? "none" : "sin-motor";
    commit();
  });
  q("clear").addEventListener("click", () => {
    r.kind = "none";
    commit();
  });

  const note = q("note");
  note.addEventListener("input", (e) => {
    r.comment = e.target.value;
    onChange();
  });
  q("notebtn").addEventListener("click", (e) => {
    e.currentTarget.hidden = true;
    note.hidden = false;
    note.focus();
  });

  // --- imagen ---
  const useBlob = async (blob) => {
    if (!blob || !blob.type?.startsWith("image/")) return;
    await setDraftImage(draft.eventId, p.id, blob);
    r.imageName = blob.name || "tapa.jpg";
    if (r.kind === "none") r.kind = "score"; // cargar tapa = "corrió"
    showThumb(card, blob, urls, p.id);
    commit();
  };
  card._useBlob = useBlob; // lo usa el pegado global de createGrid

  q("file").addEventListener("change", (e) => useBlob(e.target.files[0]));

  q("urlbtn").addEventListener("click", async () => {
    const u = prompt("URL de la imagen de la tapa:");
    if (!u) return;
    try {
      await useBlob(await fetchImageBlob(u.trim()));
    } catch (err) {
      toast(card, err.message || "No se pudo cargar");
    }
  });

  q("clearimg").addEventListener("click", async () => {
    await deleteDraftImage(draft.eventId, p.id);
    r.imageName = null;
    r.imagePath = null;
    hideThumb(card, urls, p.id);
    commit();
  });

  const drop = q("drop");
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("is-over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("is-over");
    const f = e.dataTransfer.files[0];
    if (f) useBlob(f);
  });
  drop.addEventListener("click", () => {
    const src = urls.get(p.id);
    if (src) openZoom(src, { alt: p.name });
    else q("file").click();
  });
}

// --- pintado del estado -------------------------------------------------

function paint(card, r) {
  const q = (role) => card.querySelector(`[data-role="${role}"]`);
  const isScore = r.kind === "score";
  const isFlag = r.kind === "choco" || r.kind === "sin-motor";

  q("num").disabled = isFlag;
  q("range").disabled = isFlag;
  card.classList.toggle("is-choco", r.kind === "choco");
  card.classList.toggle("is-motor", r.kind === "sin-motor");
  card.classList.toggle("is-idle", r.kind === "none");
  card.classList.toggle("is-scored", isScore);

  q("choco").classList.toggle("is-on", r.kind === "choco");
  q("sinmotor").classList.toggle("is-on", r.kind === "sin-motor");
  q("clear").hidden = r.kind === "none";

  const state = q("state");
  if (r.kind === "none") state.textContent = "no corrió";
  else if (r.kind === "choco") state.textContent = "CHOCÓ";
  else if (r.kind === "sin-motor") state.textContent = "SE QUEDÓ SIN MOTOR";
  else state.textContent = formatScore(r.value);

  const bucket = isScore
    ? r.value >= 8
      ? "green"
      : r.value >= 5
      ? "yellow"
      : "red"
    : "dnf";
  card.dataset.bucket = bucket;
}

function showThumb(card, blob, urls, paperId) {
  const old = urls.get(paperId);
  if (old && old.startsWith("blob:")) URL.revokeObjectURL(old);
  const url = URL.createObjectURL(blob);
  urls.set(paperId, url);
  const img = card.querySelector('[data-role="thumb"]');
  img.src = url;
  img.hidden = false;
  card.querySelector(".drop__empty").hidden = true;
  card.querySelector('[data-role="clearimg"]').hidden = false;
  card.querySelector('[data-role="drop"]').classList.add("has-img");
}

function showThumbUrl(card, url, urls, paperId) {
  if (!url) return;
  urls.set(paperId, url);
  const img = card.querySelector('[data-role="thumb"]');
  img.src = url;
  img.hidden = false;
  card.querySelector(".drop__empty").hidden = true;
  card.querySelector('[data-role="clearimg"]').hidden = false;
  card.querySelector('[data-role="drop"]').classList.add("has-img");
}

function hideThumb(card, urls, paperId) {
  const url = urls.get(paperId);
  if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
  urls.delete(paperId);
  const img = card.querySelector('[data-role="thumb"]');
  img.hidden = true;
  img.src = "";
  card.querySelector(".drop__empty").hidden = false;
  card.querySelector('[data-role="clearimg"]').hidden = true;
  card.querySelector('[data-role="drop"]').classList.remove("has-img");
}

function toast(card, msg) {
  const t = document.createElement("div");
  t.className = "card__toast";
  t.textContent = msg;
  card.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function clamp(v) {
  const n = Math.round((Number(v) || 0) * 10) / 10;
  return Math.min(10, Math.max(0, n));
}
function escape(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}
