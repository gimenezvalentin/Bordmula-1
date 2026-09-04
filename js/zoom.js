// ============================================================================
// Visor de imágenes con zoom/pan — sin dependencias.
//
//   rueda            -> zoom hacia el puntero
//   arrastrar        -> pan
//   doble click      -> alterna "ajustar" <-> 100%
//   pinch (touch)    -> zoom
//   + / - / Ajustar / 100% / ✕   (botones)
//   Esc / click en el fondo      -> cerrar
// ============================================================================

let el = null; // { root, stage, img, hint } (se crea una sola vez)
let view = null; // estado del zoom actual

export function openZoom(src, { alt = "" } = {}) {
  ensureDom();
  el.img.src = src;
  el.img.alt = alt;
  el.root.hidden = false;
  document.body.style.overflow = "hidden";

  if (el.img.complete && el.img.naturalWidth) {
    initView();
  } else {
    el.img.onload = initView;
  }
}

export function closeZoom() {
  if (!el) return;
  el.root.hidden = true;
  el.img.src = "";
  document.body.style.overflow = "";
}

// ---------------------------------------------------------------------------

function ensureDom() {
  if (el) return;
  const root = document.createElement("div");
  root.className = "zoom";
  root.hidden = true;
  root.innerHTML = `
    <div class="zoom__bar">
      <button data-z="out"  title="Alejar (-)">−</button>
      <button data-z="in"   title="Acercar (+)">+</button>
      <button data-z="fit"  title="Ajustar a pantalla">Ajustar</button>
      <button data-z="full" title="Tamaño real">100%</button>
      <button data-z="close" title="Cerrar (Esc)" class="zoom__close">✕</button>
    </div>
    <div class="zoom__stage"><img class="zoom__img" alt="" draggable="false"></div>
    <div class="zoom__hint">Rueda para zoom · arrastrá para mover · doble click alterna</div>`;
  document.body.appendChild(root);

  el = {
    root,
    stage: root.querySelector(".zoom__stage"),
    img: root.querySelector(".zoom__img"),
  };

  root.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-z]");
    if (!b && e.target === el.stage) return closeZoom();
    if (!b) return;
    const a = b.dataset.z;
    if (a === "close") closeZoom();
    if (a === "in") zoomBy(1.25);
    if (a === "out") zoomBy(1 / 1.25);
    if (a === "fit") resetView(false);
    if (a === "full") resetView(true);
  });

  window.addEventListener("keydown", (e) => {
    if (el.root.hidden) return;
    if (e.key === "Escape") closeZoom();
    if (e.key === "+" || e.key === "=") zoomBy(1.25);
    if (e.key === "-") zoomBy(1 / 1.25);
  });

  el.stage.addEventListener("wheel", onWheel, { passive: false });
  el.stage.addEventListener("dblclick", (e) => {
    const at100 = view && view.scale > view.baseScale * 1.5;
    resetView(!at100, e);
  });
  addPointerPanZoom(el.stage);
}

function initView() {
  const r = el.stage.getBoundingClientRect();
  const iw = el.img.naturalWidth;
  const ih = el.img.naturalHeight;
  const baseScale = Math.min(r.width / iw, r.height / ih, 1);
  view = {
    iw,
    ih,
    stageW: r.width,
    stageH: r.height,
    baseScale,
    minScale: baseScale,
    maxScale: Math.max(baseScale * 8, 8),
    scale: baseScale,
    tx: 0,
    ty: 0,
  };
  centerImage();
  apply();
}

function centerImage() {
  view.tx = (view.stageW - view.iw * view.scale) / 2;
  view.ty = (view.stageH - view.ih * view.scale) / 2;
}

function clampPan() {
  const w = view.iw * view.scale;
  const h = view.ih * view.scale;
  view.tx =
    w <= view.stageW
      ? (view.stageW - w) / 2
      : Math.min(0, Math.max(view.stageW - w, view.tx));
  view.ty =
    h <= view.stageH
      ? (view.stageH - h) / 2
      : Math.min(0, Math.max(view.stageH - h, view.ty));
}

function apply() {
  if (!view) return;
  el.img.style.transformOrigin = "0 0";
  el.img.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`;
  el.stage.classList.toggle("is-zoomed", view.scale > view.baseScale + 0.001);
}

function zoomAt(factor, px, py) {
  if (!view) return;
  const rect = el.stage.getBoundingClientRect();
  const x = px == null ? rect.width / 2 : px - rect.left;
  const y = py == null ? rect.height / 2 : py - rect.top;
  const next = Math.min(view.maxScale, Math.max(view.minScale, view.scale * factor));
  const imgX = (x - view.tx) / view.scale;
  const imgY = (y - view.ty) / view.scale;
  view.scale = next;
  view.tx = x - imgX * next;
  view.ty = y - imgY * next;
  clampPan();
  apply();
}

function zoomBy(factor) {
  zoomAt(factor, null, null);
}

function resetView(full, evt) {
  if (!view) return;
  if (full) {
    const px = evt ? evt.clientX : null;
    const py = evt ? evt.clientY : null;
    view.scale = view.baseScale; // arranco de fit y escalo al punto
    centerImage();
    apply();
    zoomAt(1 / view.baseScale, px, py); // -> scale = 1 (100%)
  } else {
    view.scale = view.baseScale;
    centerImage();
    apply();
  }
}

function onWheel(e) {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  zoomAt(factor, e.clientX, e.clientY);
}

function addPointerPanZoom(stage) {
  const pts = new Map();
  let last = null; // pan: {x,y}
  let pinch = null; // {dist, cx, cy}

  stage.addEventListener("pointerdown", (e) => {
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) last = { x: e.clientX, y: e.clientY };
    if (pts.size === 2) pinch = pinchState(pts);
  });

  stage.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId) || !view) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pts.size >= 2) {
      const now = pinchState(pts);
      if (pinch) {
        zoomAt(now.dist / pinch.dist, now.cx, now.cy);
      }
      pinch = now;
      return;
    }
    if (last) {
      view.tx += e.clientX - last.x;
      view.ty += e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      clampPan();
      apply();
    }
  });

  const end = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 0) last = null;
    else last = { ...pts.values().next().value };
  };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
}

function pinchState(pts) {
  const [a, b] = [...pts.values()];
  return {
    dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
    cx: (a.x + b.x) / 2,
    cy: (a.y + b.y) / 2,
  };
}
