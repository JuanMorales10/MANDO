import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState, applyAction } from "../public/tv-state.js";

test("estado inicial acordado", () => {
  assert.deepEqual(initialState, { power: true, volume: 55, muted: false, channel: 1 });
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
  assert.equal(applyAction(initialState, "VOL_UP").volume, 56);
  assert.equal(applyAction(initialState, "VOL_DOWN").volume, 54);
});

test("el volumen no supera 100 ni baja de 0", () => {
  assert.equal(applyAction({ ...initialState, volume: 100 }, "VOL_UP").volume, 100);
  assert.equal(applyAction({ ...initialState, volume: 0 }, "VOL_DOWN").volume, 0);
});

test("una acción desconocida no cambia nada", () => {
  const state = { ...initialState };
  assert.deepEqual(applyAction(state, "NOPE"), state);
});

test("CH_UP y CH_DOWN cambian de canal y dan la vuelta", () => {
  assert.equal(applyAction(initialState, "CH_UP").channel, 2);
  assert.equal(applyAction({ ...initialState, channel: 5 }, "CH_DOWN").channel, 4);
  assert.equal(applyAction({ ...initialState, channel: 99 }, "CH_UP").channel, 1);
  assert.equal(applyAction({ ...initialState, channel: 1 }, "CH_DOWN").channel, 99);
});

test("POWER apaga y enciende sin perder volumen, silencio ni canal", () => {
  const state = { ...initialState, volume: 30, muted: true, channel: 7 };
  const off = applyAction(state, "POWER");
  assert.equal(off.power, false);
  assert.deepEqual(applyAction(off, "POWER"), state);
});

test("con la TV apagada, las demás acciones no hacen nada", () => {
  const off = { ...initialState, power: false };
  for (const action of ["MUTE", "VOL_UP", "VOL_DOWN", "CH_UP", "CH_DOWN"]) {
    assert.deepEqual(applyAction(off, action), off);
  }
});

test("el recorrido de la demo: silenciar y volver", () => {
  let state = initialState;
  for (const action of ["VOL_UP", "VOL_UP", "MUTE"]) state = applyAction(state, action);
  assert.deepEqual(state, { ...initialState, volume: 57, muted: true });
  state = applyAction(state, "MUTE");
  assert.equal(state.muted, false);
  assert.equal(state.volume, 57);
});

test("CH_SET salta de canal y enciende la TV", () => {
  const off = { ...initialState, power: false, channel: 1 };
  const next = applyAction(off, "CH_SET:14");
  assert.equal(next.power, true);
  assert.equal(next.channel, 14);
});

test("no modifica el objeto original", () => {
  const state = Object.freeze({ ...initialState });
  for (const action of ["MUTE", "VOL_UP", "VOL_DOWN", "CH_UP", "CH_DOWN", "POWER", "NOPE"]) {
    applyAction(state, action);
  }
  assert.deepEqual(state, initialState);
});
