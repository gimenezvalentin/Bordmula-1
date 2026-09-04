// ============================================================================
// Scorer (index.html). Login -> elegir fecha -> puntuar -> Publicar.
// ============================================================================

import { isOnline } from "./supabase.js";
import { getSession, signIn, signOut } from "./auth.js";
import { loadDb, loadPapers } from "./data.js";
import {
  newDraft,
  loadDraft,
  saveDraft,
  listDrafts,
  deleteDraft,
  markPublished,
} from "./draft.js";
import { createGrid } from "./ui-grid.js";
import { renderStandings } from "./ui-standings.js";
import { computeStandings, cmpEvents } from "./scoring.js";
import { publishDraft } from "./publish.js";
import { openPapersEditor } from "./papers.js";
import { exportBackup, importBackup } from "./ui-io.js";

const $ = (sel) => document.querySelector(sel);

const state = {
  papers: [],
  published: { papers: [], events: [], results: [] },
  draft: null,
};

let saveTimer = null;
let standingsTimer = null;

boot();

async function boot() {
  wireChrome();
  const session = await getSession();
  if (!session && isOnline()) return showLogin();
  await startScorer();
}

// --- login ---------------------------------------------------------------

function showLogin() {
  $("#login").hidden = false;
  $("#scorer").hidden = true;
  const form = $("#login-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button");
    btn.disabled = true;
    $("#login-error").textContent = "";
    try {
      await signIn($("#email").value.trim(), $("#password").value);
      location.reload();
    } catch (err) {
      $("#login-error").textContent = err.message || "No se pudo entrar";
      btn.disabled = false;
    }
  };
}

// --- arranque del scorer ----------------------------------------------

async function startScorer() {
  $("#login").hidden = true;
  $("#scorer").hidden = false;
  $("#topbar-actions").hidden = false;

  state.papers = await loadPapers();
  state.published = await loadDb().catch(() => state.published);

  const drafts = listDrafts();
  const today = new Date().toISOString().slice(0, 10);
  const pending = drafts.find((d) => !d.published);
  state.draft = pending || loadDraft(today) || makeTodayDraft();
  if (!loadDraft(state.draft.eventId)) saveDraft(state.draft);

  renderEventBar();
  await renderGrid();
  refreshStandings();
}

function makeTodayDraft() {
  const today = new Date().toISOString().slice(0, 10);
  return newDraft(today, { date: today, label: "" });
}

// --- barra de fecha / Gran Premio ------------------------------------

function renderEventBar() {
  const bar = $("#eventbar");
  const drafts = listDrafts();
  bar.innerHTML = `
    <input type="date" id="ev-date" aria-label="Fecha" value="${state.draft.date}">
    <input type="text" id="ev-label" placeholder="Nombre del Gran Premio"
           value="${escapeAttr(state.draft.label)}">
    <div class="eventbar__aux">
      <button class="btn btn--ghost btn--sm" id="ev-new">+ Fecha</button>
      ${
        drafts.length > 1
          ? `<select id="ev-switch" title="Cambiar de fecha">
               ${drafts
                 .map(
                   (d) =>
                     `<option value="${d.eventId}" ${
                       d.eventId === state.draft.eventId ? "selected" : ""
                     }>${d.date} ${d.published ? "✓" : "·"} ${escapeHtml(
                       d.label || ""
                     )}</option>`
                 )
                 .join("")}
             </select>`
          : ""
      }
    </div>
    <p class="eventbar__hint">Se guarda solo. Publicá cuando la fecha esté lista.</p>`;

  $("#ev-date").onchange = (e) => {
    const v = e.target.value;
    // renombra el borrador al nuevo id = fecha
    const old = state.draft.eventId;
    state.draft.date = v;
    state.draft.eventId = v;
    saveDraft(state.draft);
    if (old !== v) deleteDraft(old);
    startOverWith(v);
  };
  $("#ev-label").oninput = (e) => {
    state.draft.label = e.target.value;
    scheduleSave();
  };
  $("#ev-new").onclick = () => {
    const d = makeTodayDraft();
    let id = d.eventId;
    let n = 2;
    while (loadDraft(id)) id = `${d.eventId}-${n++}`;
    d.eventId = id;
    saveDraft(d);
    startOverWith(id);
  };
  const sw = $("#ev-switch");
  if (sw) sw.onchange = (e) => e.target.value && startOverWith(e.target.value);
}

async function startOverWith(eventId) {
  state.draft = loadDraft(eventId) || newDraft(eventId, { date: eventId });
  saveDraft(state.draft);
  renderEventBar();
  await renderGrid();
  refreshStandings();
}

// --- grilla ------------------------------------------------------------

async function renderGrid() {
  await createGrid($("#grid"), {
    papers: state.papers,
    draft: state.draft,
    onChange: () => {
      scheduleSave();
      scheduleStandings();
    },
  });
}

function scheduleSave() {
  setStatus("guardando…");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveDraft(state.draft);
    setStatus("borrador guardado");
  }, 400);
}
function scheduleStandings() {
  clearTimeout(standingsTimer);
  standingsTimer = setTimeout(refreshStandings, 250);
}

// --- campeonato en vivo (publicado + borrador actual) ---------------

function refreshStandings() {
  const merged = mergeDraft(state.published, state.draft);
  const standings = computeStandings(merged);
  renderStandings($("#standings"), standings, { title: "Campeonato", compact: true });
}

function mergeDraft(published, draft) {
  const rows = Object.entries(draft.results)
    .filter(([, r]) => r.kind !== "none")
    .map(([paperId, r]) => ({
      event_id: draft.eventId,
      paper_id: paperId,
      kind: r.kind,
      value: r.kind === "score" ? Number(r.value) || 0 : 0,
      comment: r.comment || "",
      image_path: r.imagePath || null,
    }));
  return {
    papers: state.papers,
    events: [
      ...published.events.filter((e) => e.id !== draft.eventId),
      { id: draft.eventId, date: draft.date, label: draft.label },
    ].sort(cmpEvents),
    results: [
      ...published.results.filter((r) => r.event_id !== draft.eventId),
      ...rows,
    ],
  };
}

// --- publicar --------------------------------------------------------

async function doPublish() {
  const btn = $("#publish");
  const has = Object.values(state.draft.results).some((r) => r.kind !== "none");
  if (!has) return setStatus("no hay nada que publicar");
  if (!state.draft.date) return setStatus("falta la fecha");

  btn.disabled = true;
  setStatus("publicando…", { sticky: true });
  try {
    const res = await publishDraft(state.draft);
    state.published = await loadDb();
    if (res.ok) markPublished(state.draft.eventId);
    renderEventBar();
    refreshStandings();
    setStatus(
      res.ok
        ? `publicado ✓ (${res.count} ${res.count === 1 ? "diario" : "diarios"})`
        : `publicado parcial: fallaron ${res.failed
            .map((f) => f.paperId)
            .join(", ")} — reintentá`
    );
  } catch (err) {
    setStatus("error al publicar: " + (err.message || err));
  } finally {
    btn.disabled = false;
  }
}

// --- chrome (header, acciones) --------------------------------------

function wireChrome() {
  $("#publish").onclick = doPublish;
  $("#year").textContent = new Date().getFullYear();
  wireMenu();

  $("#btn-papers").onclick = () =>
    openPapersEditor({
      papers: state.papers,
      onSaved: async (rows) => {
        state.papers = rows;
        await renderGrid();
        refreshStandings();
      },
    });

  $("#btn-logout").onclick = async () => {
    await signOut();
    location.reload();
  };

  $("#btn-export").onclick = () => exportBackup();
  $("#btn-import").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const r = await importBackup(f);
      alert(`Importado: ${r.events} fechas, ${r.drafts} borradores`);
      location.reload();
    } catch (err) {
      alert("No se pudo importar: " + (err.message || err));
    }
  };

  if (!isOnline()) {
    document.body.classList.add("is-demo");
    $("#demo-note").hidden = false;
  }
}

function wireMenu() {
  const btn = $("#menu-btn");
  const list = $("#menu-list");
  const close = () => {
    list.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  };
  btn.onclick = (e) => {
    e.stopPropagation();
    const open = list.hidden;
    list.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  };
  list.onclick = (e) => {
    // dejar que <label> de importar abra el file picker sin cerrar antes de tiempo
    if (e.target.closest("label")) return;
    close();
  };
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".menu")) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

let statusTimer = null;
function setStatus(txt, { sticky = false } = {}) {
  const s = $("#savechip");
  if (!s) return;
  s.textContent = txt;
  s.hidden = !txt;
  clearTimeout(statusTimer);
  if (txt && !sticky) {
    statusTimer = setTimeout(() => {
      s.hidden = true;
    }, 3500);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
