// ============================================================================
// "Timing tower" del campeonato. Recibe el array de computeStandings().
// La usan el scorer (panel en vivo) y campeonato.html.
// ============================================================================

import { formatScore } from "./scoring.js";

export function renderStandings(container, standings, { title, compact = false } = {}) {
  container.innerHTML = "";

  if (title) {
    const h = document.createElement("div");
    h.className = "tower__title";
    h.textContent = title;
    container.appendChild(h);
  }

  if (!standings.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Todavía no hay fechas publicadas.";
    container.appendChild(p);
    return;
  }

  const ol = document.createElement("ol");
  ol.className = "tower";

  standings.forEach((row, i) => {
    const li = document.createElement("li");
    li.className = "tower__row" + (i === 0 ? " is-leader" : "");
    li.style.setProperty("--livery", row.paper.color || "#888");
    li.style.setProperty("--livery-ink", row.paper.text_on || "#fff");

    li.innerHTML = `
      <span class="tower__pos">${row.pos}</span>
      ${deltaHtml(row)}
      <span class="tower__name">${escape(row.paper.name)}</span>
      ${compact ? "" : `<span class="tower__meta">${metaHtml(row)}</span>`}
      <span class="tower__pts">${formatScore(row.total)}</span>
    `;
    if (compact) li.classList.add("tower__row--compact");
    ol.appendChild(li);
  });

  container.appendChild(ol);
}

function deltaHtml(row) {
  if (row.delta == null) {
    return `<span class="tower__delta is-new" title="Debut">•</span>`;
  }
  if (row.delta === 0) {
    return `<span class="tower__delta is-flat">–</span>`;
  }
  const up = row.delta > 0;
  return `<span class="tower__delta ${up ? "is-up" : "is-down"}">${
    up ? "▲" : "▼"
  }${Math.abs(row.delta)}</span>`;
}

function metaHtml(row) {
  const bits = [`${row.races} GP`];
  if (row.wins) bits.push(`${row.wins}×1°`);
  if (row.chocos) bits.push(`${row.chocos} ⚑`);
  if (row.sinMotor) bits.push(`${row.sinMotor} ⚙`);
  return escape(bits.join(" · "));
}

function escape(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}
