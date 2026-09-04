// ============================================================================
// Editor del roster de diarios (alta / baja lógica / color de librea / orden).
// Solo para la sesión logueada. Online -> tabla "papers". Demo -> localStorage.
// ============================================================================

import { supabase, isOnline } from "./supabase.js";
import { PUBLISHED_KEY } from "./data.js";

export function openPapersEditor({ papers, onSaved }) {
  const dlg = document.createElement("dialog");
  dlg.className = "sheet";
  dlg.innerHTML = `
    <form method="dialog" class="sheet__box">
      <h2>Diarios</h2>
      <div class="roster"></div>
      <button type="button" class="btn btn--ghost" data-add>+ Agregar diario</button>
      <footer class="sheet__foot">
        <button value="cancel" class="btn btn--ghost">Cancelar</button>
        <button type="button" class="btn btn--primary" data-save>Guardar</button>
      </footer>
    </form>`;
  const list = dlg.querySelector(".roster");

  const rows = papers.map((p) => ({ ...p }));
  const draw = () => {
    list.innerHTML = "";
    rows.forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "roster__row";
      row.innerHTML = `
        <input class="roster__name" value="${esc(p.name)}" placeholder="Nombre">
        <input class="roster__color" type="color" value="${toHex(p.color)}">
        <label class="roster__active"><input type="checkbox" ${
          p.active === false ? "" : "checked"
        }> activo</label>
        <button type="button" class="btn btn--sm" data-up>↑</button>
        <button type="button" class="btn btn--sm" data-down>↓</button>`;
      row.querySelector(".roster__name").addEventListener("input", (e) => {
        p.name = e.target.value;
        if (!p.id) p.id = slug(e.target.value);
      });
      row.querySelector(".roster__color").addEventListener("input", (e) => {
        p.color = e.target.value;
        p.text_on = contrast(e.target.value);
      });
      row.querySelector(".roster__active input").addEventListener("change", (e) => {
        p.active = e.target.checked;
      });
      row.querySelector("[data-up]").addEventListener("click", () => {
        if (i > 0) [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]];
        draw();
      });
      row.querySelector("[data-down]").addEventListener("click", () => {
        if (i < rows.length - 1) [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]];
        draw();
      });
      list.appendChild(row);
    });
  };
  draw();

  dlg.querySelector("[data-add]").addEventListener("click", () => {
    rows.push({ id: "", name: "", color: "#888888", text_on: "#ffffff", active: true });
    draw();
  });

  dlg.querySelector("[data-save]").addEventListener("click", async () => {
    const clean = rows
      .filter((p) => p.name.trim())
      .map((p, idx) => ({
        id: p.id || slug(p.name),
        name: p.name.trim(),
        color: p.color || "#888888",
        text_on: p.text_on || contrast(p.color || "#888888"),
        active: p.active !== false,
        sort: (idx + 1) * 10,
      }));
    try {
      await save(clean);
      dlg.close();
      dlg.remove();
      onSaved?.(clean);
    } catch (e) {
      alert("No se pudo guardar: " + (e.message || e));
    }
  });

  dlg.addEventListener("close", () => dlg.remove());
  document.body.appendChild(dlg);
  dlg.showModal();
}

async function save(rows) {
  if (isOnline()) {
    const { error } = await supabase.from("papers").upsert(rows);
    if (error) throw error;
    return;
  }
  let db;
  try {
    db = JSON.parse(localStorage.getItem(PUBLISHED_KEY) || "{}");
  } catch {
    db = {};
  }
  db.papers = rows;
  localStorage.setItem(PUBLISHED_KEY, JSON.stringify(db));
}

// --- utilidades -------------------------------------------------------

function slug(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca tildes/diacríticos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
function toHex(c) {
  return /^#[0-9a-f]{6}$/i.test(c || "") ? c : "#888888";
}
function contrast(hex) {
  const h = toHex(hex).slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#111111" : "#ffffff";
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}
