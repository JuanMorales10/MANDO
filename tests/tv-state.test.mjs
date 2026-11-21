import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState, applyAction } from "../public/tv-state.js";

test("estado inicial acordado", () => {
  assert.deepEqual(initialState, { power: true, volume: 15, muted: false, channel: 1 });
});

test("MUTE silencia y dos pulsaciones vuelven al estado inicial", () => {
  const once = applyAction(initialState, "MUTE");
  assert.equal(once.muted, true);
  assert.deepEqual(applyAction(once, "MUTE"), initialState);
});

test("MUTE preserva el volumen guardado", () => {
  const state = { ...initialState, volume: 42 };
  assert.equal(applyAction(state, "MUTE").volume, 42);
});

test("VOL_UP y VOL_DOWN cambian de a 1", () => {
  assert.equal(applyAction(initialState, "VOL_UP").volume, 16);
  assert.equal(applyAction(initialState, "VOL_DOWN").volume, 14);
});

test("el volumen no supera 100 ni baja de 0", () => {
  assert.equal(applyAction({ ...initialState, volume: 100 }, "VOL_UP").volume, 100);
  assert.equal(applyAction({ ...initialState, volume: 0 }, "VOL_DOWN").volume, 0);
});

test("una acción desconocida no cambia nada", () => {
  const state = { ...initialState };
  assert.deepEqual(applyAction(state, "NOPE"), state);
});

test("no modifica el objeto original", () => {
  const state = Object.freeze({ ...initialState });
  for (const action of ["MUTE", "VOL_UP", "VOL_DOWN", "NOPE"]) {
    applyAction(state, action);
  }
  assert.deepEqual(state, initialState);
});
