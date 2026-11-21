const STORAGE_KEY = "mando-layout-v1";
const COLS = 3;
const ROWS = 4;

const ACTIONS = {
  MUTE: {
    id: "MUTE",
    label: "Silencio",
    icon: "🔇",
  },
  VOL_UP: {
    id: "VOL_UP",
    label: "Volumen +",
    icon: "🔊",
  },
  VOL_DOWN: {
    id: "VOL_DOWN",
    label: "Volumen −",
    icon: "🔉",
  },
};

const DEFAULT_LAYOUT = {
  MUTE: { row: 1, col: 1, size: "normal" },
  VOL_UP: { row: 0, col: 2, size: "normal" },
  VOL_DOWN: { row: 0, col: 0, size: "normal" },
};

function cloneLayout(layout) {
  return {
    MUTE: { ...layout.MUTE },
    VOL_UP: { ...layout.VOL_UP },
    VOL_DOWN: { ...layout.VOL_DOWN },
  };
}

function loadLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneLayout(DEFAULT_LAYOUT);
    const parsed = JSON.parse(raw);
    const next = {};
    for (const id of Object.keys(ACTIONS)) {
      const item = parsed?.[id];
      if (!item) continue;
      const row = Number(item.row);
      const col = Number(item.col);
      const size = item.size === "large" ? "large" : "normal";
      if (
        Number.isInteger(row) &&
        Number.isInteger(col) &&
        canPlace(next, id, row, col, size)
      ) {
        next[id] = { row, col, size };
      }
    }
    for (const id of Object.keys(ACTIONS)) {
      if (next[id]) continue;
      const fallback = DEFAULT_LAYOUT[id];
      let size = fallback.size;
      let fitted = nearestFreeCell(next, id, fallback.row, fallback.col, size);
      if (!fitted && size === "large") {
        size = "normal";
        fitted = nearestFreeCell(next, id, fallback.row, fallback.col, size);
      }
      if (!fitted) return cloneLayout(DEFAULT_LAYOUT);
      next[id] = { row: fitted.row, col: fitted.col, size };
    }
    return {
      MUTE: { ...next.MUTE },
      VOL_UP: { ...next.VOL_UP },
      VOL_DOWN: { ...next.VOL_DOWN },
    };
  } catch {
    return cloneLayout(DEFAULT_LAYOUT);
  }
}

function saveLayout(layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    return true;
  } catch {
    return false;
  }
}

function cellIndex(row, col) {
  return row * COLS + col;
}

function spanFor(size) {
  return size === "large" ? 2 : 1;
}

function cellsFor(row, col, span) {
  const cells = [];
  for (let r = row; r < row + span; r += 1) {
    for (let c = col; c < col + span; c += 1) {
      cells.push([r, c]);
    }
  }
  return cells;
}

function occupiedMap(layout, skipId = null) {
  const map = new Map();
  for (const [id, pos] of Object.entries(layout)) {
    if (id === skipId) continue;
    const span = spanFor(pos.size);
    for (const [r, c] of cellsFor(pos.row, pos.col, span)) {
      map.set(cellIndex(r, c), id);
    }
  }
  return map;
}

function canPlace(layout, id, row, col, size) {
  const span = spanFor(size);
  if (row < 0 || col < 0 || row + span > ROWS || col + span > COLS) {
    return false;
  }
  const occupied = occupiedMap(layout, id);
  for (const [r, c] of cellsFor(row, col, span)) {
    if (occupied.has(cellIndex(r, c))) return false;
  }
  return true;
}

function nearestFreeCell(layout, id, row, col, size) {
  if (canPlace(layout, id, row, col, size)) {
    return { row, col };
  }
  let best = null;
  let bestDist = Infinity;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (!canPlace(layout, id, r, c, size)) continue;
      const dist = Math.abs(r - row) + Math.abs(c - col);
      if (dist < bestDist) {
        bestDist = dist;
        best = { row: r, col: c };
      }
    }
  }
  return best;
}

/**
 * Monta el mando configurable.
 * En modo Usar llama a dispatch con MUTE | VOL_UP | VOL_DOWN.
 * En modo Editar nunca emite acciones.
 */
export function mountRemote(el, dispatch) {
  if (!el) throw new Error("mountRemote: falta el elemento contenedor");
  if (typeof dispatch !== "function") {
    throw new Error("mountRemote: dispatch debe ser una función");
  }

  const state = {
    mode: "usar",
    layout: loadLayout(),
    selectedId: null,
    draggingId: null,
  };

  el.replaceChildren();
  el.classList.add("mando-remote", "is-use");

  const header = document.createElement("div");
  header.className = "mando-remote__header";

  const title = document.createElement("h2");
  title.className = "mando-remote__title";
  title.textContent = "MANDO";

  const modes = document.createElement("div");
  modes.className = "mando-remote__modes";
  modes.setAttribute("role", "group");
  modes.setAttribute("aria-label", "Modo del mando");

  const useBtn = document.createElement("button");
  useBtn.type = "button";
  useBtn.className = "mando-remote__mode is-active";
  useBtn.dataset.mode = "usar";
  useBtn.textContent = "Usar";
  useBtn.setAttribute("aria-pressed", "true");

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "mando-remote__mode";
  editBtn.dataset.mode = "editar";
  editBtn.textContent = "Editar";
  editBtn.setAttribute("aria-pressed", "false");

  modes.append(useBtn, editBtn);
  header.append(title, modes);

  const hint = document.createElement("p");
  hint.className = "mando-remote__hint";

  const toolbar = document.createElement("div");
  toolbar.className = "mando-remote__toolbar";

  const sizeNormal = document.createElement("button");
  sizeNormal.type = "button";
  sizeNormal.className = "mando-remote__tool";
  sizeNormal.dataset.size = "normal";
  sizeNormal.textContent = "Normal";
  sizeNormal.setAttribute("aria-label", "Tamaño normal");

  const sizeLarge = document.createElement("button");
  sizeLarge.type = "button";
  sizeLarge.className = "mando-remote__tool";
  sizeLarge.dataset.size = "large";
  sizeLarge.textContent = "Grande";
  sizeLarge.setAttribute("aria-label", "Tamaño grande");

  toolbar.append(sizeNormal, sizeLarge);

  const grid = document.createElement("div");
  grid.className = "mando-remote__grid";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", "Botones del mando");

  const cells = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = document.createElement("div");
      cell.className = "mando-remote__cell";
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.style.gridRow = String(row + 1);
      cell.style.gridColumn = String(col + 1);
      cell.setAttribute("role", "gridcell");
      cells.push(cell);
      grid.append(cell);
    }
  }

  const buttons = {};
  for (const action of Object.values(ACTIONS)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mando-remote__btn";
    btn.dataset.action = action.id;
    btn.setAttribute("aria-label", action.label);

    const icon = document.createElement("span");
    icon.className = "mando-remote__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = action.icon;

    const label = document.createElement("span");
    label.className = "mando-remote__label";
    label.textContent = action.label;

    btn.append(icon, label);
    buttons[action.id] = btn;
    grid.append(btn);
  }

  el.append(header, hint, toolbar, grid);

  function setHint(text, isEdit = false) {
    hint.textContent = text;
    hint.classList.toggle("is-edit", isEdit);
  }

  function updateModeUI() {
    const isEdit = state.mode === "editar";
    el.classList.toggle("is-edit", isEdit);
    el.classList.toggle("is-use", !isEdit);
    useBtn.classList.toggle("is-active", !isEdit);
    editBtn.classList.toggle("is-active", isEdit);
    useBtn.setAttribute("aria-pressed", String(!isEdit));
    editBtn.setAttribute("aria-pressed", String(isEdit));
    if (isEdit) {
      setHint(
        state.selectedId
          ? "Arrastrá o tocá una casilla vacía."
          : "Elegí un botón y movelo.",
        true,
      );
    } else {
      state.selectedId = null;
      setHint("Tocá para controlar la TV.");
    }
  }

  function placeButtons() {
    for (const cell of cells) {
      cell.classList.remove("is-drop-target");
    }

    for (const [id, pos] of Object.entries(state.layout)) {
      const btn = buttons[id];
      const span = spanFor(pos.size);
      btn.classList.toggle("mando-remote__btn--large", pos.size === "large");
      btn.classList.toggle("is-selected", state.selectedId === id);
      btn.classList.toggle("is-dragging", state.draggingId === id);
      btn.style.gridRow = `${pos.row + 1} / span ${span}`;
      btn.style.gridColumn = `${pos.col + 1} / span ${span}`;
    }

    sizeNormal.disabled = !state.selectedId;
    sizeLarge.disabled = !state.selectedId;
    sizeNormal.classList.toggle(
      "is-active",
      Boolean(state.selectedId) &&
        state.layout[state.selectedId]?.size === "normal",
    );
    sizeLarge.classList.toggle(
      "is-active",
      Boolean(state.selectedId) &&
        state.layout[state.selectedId]?.size === "large",
    );
  }

  function cancelDrag() {
    const id = state.draggingId;
    if (!id) return;
    const btn = buttons[id];
    state.draggingId = null;
    if (btn) btn.style.pointerEvents = "";
    clearDropTargets();
  }

  function moveButton(id, row, col) {
    const current = state.layout[id];
    const target = nearestFreeCell(state.layout, id, row, col, current.size);
    if (!target) return false;
    if (target.row === current.row && target.col === current.col) return false;
    state.layout[id] = { ...current, row: target.row, col: target.col };
    const saved = saveLayout(state.layout);
    placeButtons();
    return saved ? true : "unsaved";
  }

  function setSize(id, size) {
    const current = state.layout[id];
    if (!current || current.size === size) return;
    const fitted = nearestFreeCell(state.layout, id, current.row, current.col, size);
    if (!fitted) {
      setHint("Sin espacio. Mové el botón antes.", true);
      return;
    }
    state.layout[id] = { row: fitted.row, col: fitted.col, size };
    if (!saveLayout(state.layout)) {
      setHint("No se pudo guardar.", true);
    }
    placeButtons();
  }

  function cellFromPoint(clientX, clientY) {
    const target = document.elementFromPoint(clientX, clientY);
    if (!target) return null;
    const cell = target.closest(".mando-remote__cell");
    if (!cell || !grid.contains(cell)) return null;
    return {
      row: Number(cell.dataset.row),
      col: Number(cell.dataset.col),
      el: cell,
    };
  }

  function clearDropTargets() {
    for (const cell of cells) cell.classList.remove("is-drop-target");
  }

  modes.addEventListener("click", (event) => {
    const button = event.target.closest(".mando-remote__mode");
    if (!button) return;
    cancelDrag();
    state.mode = button.dataset.mode;
    updateModeUI();
    placeButtons();
  });

  toolbar.addEventListener("click", (event) => {
    const tool = event.target.closest(".mando-remote__tool");
    if (!tool || !state.selectedId || state.mode !== "editar") return;
    setSize(state.selectedId, tool.dataset.size);
  });

  grid.addEventListener("click", (event) => {
    if (state.mode !== "editar") return;
    if (state.draggingId) return;

    const btn = event.target.closest(".mando-remote__btn");
    if (btn) {
      state.selectedId = btn.dataset.action;
      updateModeUI();
      placeButtons();
      return;
    }

    const cell = event.target.closest(".mando-remote__cell");
    if (!cell || !state.selectedId) return;
    const moved = moveButton(
      state.selectedId,
      Number(cell.dataset.row),
      Number(cell.dataset.col),
    );
    if (moved === true) {
      setHint("Guardado. Seguí o pasá a Usar.", true);
    } else if (moved === "unsaved") {
      setHint("No se pudo guardar.", true);
    }
  });

  for (const [id, btn] of Object.entries(buttons)) {
    let dragOrigin = null;
    let dragActive = false;

    btn.addEventListener("click", (event) => {
      if (state.mode !== "usar") {
        event.preventDefault();
        return;
      }
      dispatch(id);
    });

    btn.addEventListener("pointerdown", (event) => {
      if (state.mode !== "editar") return;
      if (event.button !== undefined && event.button !== 0) return;

      state.selectedId = id;
      state.draggingId = id;
      dragActive = false;
      dragOrigin = { x: event.clientX, y: event.clientY };
      btn.setPointerCapture(event.pointerId);
      updateModeUI();
      placeButtons();
      event.preventDefault();
    });

    btn.addEventListener("pointermove", (event) => {
      if (state.draggingId !== id || !dragOrigin) return;
      const dx = event.clientX - dragOrigin.x;
      const dy = event.clientY - dragOrigin.y;
      if (!dragActive && dx * dx + dy * dy < 36) return;
      if (!dragActive) {
        dragActive = true;
        btn.style.pointerEvents = "none";
      }
      clearDropTargets();
      const cell = cellFromPoint(event.clientX, event.clientY);
      if (cell) cell.el.classList.add("is-drop-target");
    });

    const endDrag = (event) => {
      if (state.draggingId !== id) return;
      const cell = dragActive ? cellFromPoint(event.clientX, event.clientY) : null;
      state.draggingId = null;
      dragOrigin = null;
      dragActive = false;
      btn.style.pointerEvents = "";
      clearDropTargets();
      if (cell) {
        const moved = moveButton(id, cell.row, cell.col);
        if (moved === true) {
          setHint("Guardado.", true);
        } else if (moved === "unsaved") {
          setHint("No se pudo guardar.", true);
        } else {
          placeButtons();
        }
      } else {
        placeButtons();
      }
      try {
        btn.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    };

    btn.addEventListener("pointerup", endDrag);
    btn.addEventListener("pointercancel", endDrag);
  }

  updateModeUI();
  placeButtons();

  return {
    getLayout: () => cloneLayout(state.layout),
    getMode: () => state.mode,
  };
}
