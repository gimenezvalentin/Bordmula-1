// ============================================================================
// Cálculo del campeonato — función PURA, sin I/O.
// La usan tanto el scorer (panel en vivo) como campeonato.html.
//
//   Campeonato = SUMA TOTAL estilo F1.
//   Un diario "participó" en una fecha si tiene una fila de resultado.
//   'choco' y 'sin-motor' = 0 puntos, pero cuentan como participación y se
//   llevan aparte como estadística.
// ============================================================================

/**
 * @param {{papers:Array, events:Array, results:Array}} db
 * @param {{upToEventId?:string}} [opts]
 * @returns {Array} standings ordenadas con posición, delta y estadísticas
 */
export function computeStandings(db, opts = {}) {
  const { papers = [], events = [], results = [] } = db;
  const { upToEventId = null } = opts;

  const sortedEvents = [...events].sort(cmpEvents);

  let horizon = sortedEvents;
  if (upToEventId) {
    const idx = sortedEvents.findIndex((e) => e.id === upToEventId);
    horizon = idx >= 0 ? sortedEvents.slice(0, idx + 1) : sortedEvents;
  }

  const byEvent = new Map();
  for (const r of results) {
    if (!byEvent.has(r.event_id)) byEvent.set(r.event_id, []);
    byEvent.get(r.event_id).push(r);
  }

  const full = accumulate(horizon, byEvent, papers);
  const prev =
    horizon.length > 1 ? accumulate(horizon.slice(0, -1), byEvent, papers) : null;
  const prevPos = new Map(prev ? prev.map((row, i) => [row.paperId, i + 1]) : []);

  return full.map((row, i) => {
    const pos = i + 1;
    const pp = prevPos.has(row.paperId) ? prevPos.get(row.paperId) : null;
    return {
      ...row,
      pos,
      prevPos: pp,
      delta: pp == null ? null : pp - pos, // > 0 = subió puestos
      isNew: pp == null && prev != null,
    };
  });
}

export function cmpEvents(a, b) {
  if (a.date < b.date) return -1;
  if (a.date > b.date) return 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// verde / amarillo / rojo para el "semáforo" de nota
export function scoreBucket(value) {
  if (value >= 8) return "green";
  if (value >= 5) return "yellow";
  return "red";
}

export function resultLabel(kind, value) {
  if (kind === "choco") return "Chocó";
  if (kind === "sin-motor") return "Sin motor";
  return formatScore(value);
}

// Muestra la nota con coma decimal, como la usa Tomás (8,4)
export function formatScore(value) {
  const n = Number(value) || 0;
  return n.toFixed(1).replace(".", ",");
}

// ---------------------------------------------------------------------------
// internos
// ---------------------------------------------------------------------------

function accumulate(eventsSubset, byEvent, papers) {
  const paperById = new Map(papers.map((p) => [p.id, p]));
  const acc = new Map();

  const ensure = (paperId) => {
    if (!acc.has(paperId)) {
      acc.set(paperId, {
        paperId,
        paper:
          paperById.get(paperId) ||
          { id: paperId, name: paperId, color: "#888888", text_on: "#ffffff" },
        total: 0,
        races: 0,
        wins: 0,
        podiums: 0,
        chocos: 0,
        sinMotor: 0,
        best: null,
        worst: null,
        scores: [],
        history: [],
      });
    }
    return acc.get(paperId);
  };

  for (const ev of eventsSubset) {
    const rows = byEvent.get(ev.id) || [];
    for (const { row, pos } of rankEvent(rows)) {
      const s = ensure(row.paper_id);
      s.races += 1;
      if (row.kind === "score") {
        const v = Number(row.value) || 0;
        s.total += v;
        s.scores.push(v);
        s.best = s.best == null ? v : Math.max(s.best, v);
        s.worst = s.worst == null ? v : Math.min(s.worst, v);
        if (pos === 1) s.wins += 1;
        if (pos <= 3) s.podiums += 1;
      } else if (row.kind === "choco") {
        s.chocos += 1;
      } else if (row.kind === "sin-motor") {
        s.sinMotor += 1;
      }
      s.history.push({
        eventId: ev.id,
        kind: row.kind,
        value: Number(row.value) || 0,
        pos: row.kind === "score" ? pos : null,
      });
    }
  }

  const list = [...acc.values()].map((s) => ({
    ...s,
    avg: s.scores.length ? s.total / s.scores.length : 0,
  }));

  list.sort(
    (a, b) =>
      b.total - a.total ||
      b.wins - a.wins ||
      b.podiums - a.podiums ||
      b.avg - a.avg ||
      a.paper.name.localeCompare(b.paper.name, "es")
  );
  return list;
}

// Ranking dentro de una fecha (competition ranking: 9, 9, 8 -> 1, 1, 3).
function rankEvent(rows) {
  const out = [];
  const scored = rows
    .filter((r) => r.kind === "score")
    .map((r) => ({ row: r, v: Number(r.value) || 0 }))
    .sort((a, b) => b.v - a.v);

  let pos = 0;
  let seen = 0;
  let lastV = null;
  for (const item of scored) {
    seen += 1;
    if (lastV === null || item.v < lastV) {
      pos = seen;
      lastV = item.v;
    }
    out.push({ row: item.row, pos });
  }
  for (const r of rows) {
    if (r.kind !== "score") out.push({ row: r, pos: 999 });
  }
  return out;
}
