// ============================================================================
// Histórico de fechas: cada Gran Premio con sus tapas y puntajes.
// Click en una tapa -> visor con zoom.
// ============================================================================

import { cmpEvents, resultLabel, scoreBucket } from "./scoring.js";
import { publicImageUrl } from "./data.js";
import { openZoom } from "./zoom.js";

export function renderHistory(container, db) {
  container.innerHTML = "";
  const papers = new Map(db.papers.map((p) => [p.id, p]));
  const byEvent = new Map();
  for (const r of db.results) {
    if (!byEvent.has(r.event_id)) byEvent.set(r.event_id, []);
    byEvent.get(r.event_id).push(r);
  }

  const events = [...db.events].sort(cmpEvents).reverse();
  if (!events.length) {
    container.innerHTML = `<p class="muted">Sin fechas publicadas todavía.</p>`;
    return;
  }

  for (const ev of events) {
    const rows = (byEvent.get(ev.id) || [])
      .slice()
      .sort((a, b) => scoreOf(b) - scoreOf(a));

    const section = document.createElement("section");
    section.className = "gp";
    section.innerHTML = `
      <header class="gp__head">
        <h3>${escape(ev.label || "Gran Premio")}</h3>
        <time>${formatDate(ev.date)}</time>
      </header>
      <div class="gp__grid"></div>`;
    const grid = section.querySelector(".gp__grid");

    for (const r of rows) {
      const p = papers.get(r.paper_id) || { name: r.paper_id, color: "#888", text_on: "#fff" };
      const url = publicImageUrl(r.image_path);
      const card = document.createElement("figure");
      card.className = "tapa";
      card.style.setProperty("--livery", p.color || "#888");
      card.style.setProperty("--livery-ink", p.text_on || "#fff");
      card.innerHTML = `
        <div class="tapa__imgwrap">${
          url
            ? `<img class="tapa__img" loading="lazy" alt="Tapa de ${escape(p.name)}" src="${url}">`
            : `<div class="tapa__noimg">sin imagen</div>`
        }</div>
        <figcaption class="tapa__cap">
          <span class="tapa__name">${escape(p.name)}</span>
          <span class="score score--${r.kind === "score" ? scoreBucket(r.value) : "dnf"}">
            ${escape(resultLabel(r.kind, r.value))}
          </span>
        </figcaption>
        ${r.comment ? `<p class="tapa__note">${escape(r.comment)}</p>` : ""}`;

      if (url) {
        const img = card.querySelector(".tapa__img");
        img.addEventListener("click", () => openZoom(url, { alt: p.name }));
      }
      grid.appendChild(card);
    }
    container.appendChild(section);
  }
}

function scoreOf(r) {
  return r.kind === "score" ? Number(r.value) || 0 : -1;
}
function formatDate(d) {
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return d;
  }
}
function escape(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}
