import { test } from "node:test";
import assert from "node:assert/strict";
import {
  interpretarPedido,
  buscarCatalogo,
  guiaPorGenero,
} from "../public/catalogo.js";

test("deportes encuentra el canal Deportes", () => {
  const r = interpretarPedido("quiero ver deportes");
  assert.equal(r.ok, true);
  assert.match(r.accion, /^CH_SET:/);
  assert.match(r.mensaje.toLowerCase(), /deporte/);
});

test("charla / hablada prioriza TED", () => {
  const r = interpretarPedido("quiero una charla de gente hablando");
  assert.equal(r.ok, true);
  assert.ok(r.canal.hablada || /ted|charla|hablar/i.test(r.mensaje));
});

test("radio jazz encuentra Jazz", () => {
  const r = interpretarPedido("poné radio jazz");
  assert.equal(r.ok, true);
  assert.ok(r.canal.name.toLowerCase().includes("jazz"));
});

test("silencio manda MUTE", () => {
  const r = interpretarPedido("silenciá la tele");
  assert.equal(r.ok, true);
  assert.equal(r.accion, "MUTE");
});

test("guiaPorGenero agrupa como cable", () => {
  const guia = guiaPorGenero();
  assert.ok(guia.some((g) => g.id === "radio-hablada" && g.canales.length >= 3));
  assert.ok(guia.some((g) => g.id === "radio-musica"));
});

test("buscarCatalogo rankea por keywords", () => {
  const hits = buscarCatalogo("lofi chill");
  assert.ok(hits.length >= 1);
  assert.ok(hits[0].score > 0);
});
