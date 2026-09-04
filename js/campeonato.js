// ============================================================================
// Página pública del campeonato (campeonato.html). Solo lectura.
// ============================================================================

import { loadDb } from "./data.js";
import { computeStandings, cmpEvents, formatScore } from "./scoring.js";
import { renderStandings } from "./ui-standings.js";
import { renderHistory } from "./ui-history.js";

const $ = (s) => document.querySelector(s);

boot();

async function boot() {
  $("#year").textContent = new Date().getFullYear();
  let db;
  try {
    db = await loadDb();
  } catch (e) {
    $("#standings").innerHTML = `<p class="muted">No se pudo cargar el campeonato (${
      e.message || e
    }).</p>`;
    return;
  }

  const standings = computeStandings(db);
  renderStandings($("#standings"), standings, { title: "Campeonato" });

  const events = [...db.events].sort(cmpEvents);
  const leader = standings[0];
  $("#summary").innerHTML = events.length
    ? `<span><strong>${events.length}</strong> ${
        events.length === 1 ? "fecha" : "fechas"
      }</span>
       ${
         leader
           ? `<span>Puntero: <strong>${escape(leader.paper.name)}</strong>
              (${formatScore(leader.total)})</span>`
           : ""
       }`
    : "";

  renderHistory($("#history"), db);
}

function escape(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}
