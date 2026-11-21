import { test } from "node:test";
import assert from "node:assert/strict";
import { interpretar, planEnergia, energiasPermitidas, TECLAS, ENERGIAS } from "../server/puntero/ordenes.mjs";

// Solo el módulo puro de órdenes: acá no se lanza el ayudante, no se abre ninguna puerta
// y no se ejecuta ninguna orden de energía.

const linea = (m, capacidades) => {
  const r = interpretar(m, capacidades);
  return r && "linea" in r ? r.linea : r;
};

// ---------- Órdenes de siempre ----------

test("mover: dos decimales y tope de 400 por eje", () => {
  assert.deepEqual(interpretar({ t: "m", x: 1, y: -2 }), { linea: "m 1.00 -2.00" });
  assert.equal(linea({ t: "m", x: 1.239, y: 0.5 }), "m 1.24 0.50");
  assert.equal(linea({ t: "m", x: 0, y: 0 }), "m 0.00 0.00");
  assert.equal(linea({ t: "m", x: 400, y: -400 }), "m 400.00 -400.00");
  assert.equal(interpretar({ t: "m", x: 400.01, y: 0 }), null);
  assert.equal(interpretar({ t: "m", x: 0, y: -400.01 }), null);
  assert.equal(interpretar({ t: "m", x: 1e9, y: 1e9 }), null);
});

test("mover: rechaza lo que no son números de verdad", () => {
  for (const malo of ["1", null, undefined, NaN, Infinity, -Infinity, true, [1], { valueOf: () => 1 }, 1n]) {
    assert.equal(interpretar({ t: "m", x: malo, y: 0 }), null, `x = ${String(malo)}`);
    assert.equal(interpretar({ t: "m", x: 0, y: malo }), null, `y = ${String(malo)}`);
  }
  assert.equal(interpretar({ t: "m" }), null);
  assert.equal(interpretar({ t: "m", x: 1 }), null);
});

test("clic, clic derecho y centrar: sin argumentos, lo que sobra no pasa", () => {
  assert.deepEqual(interpretar({ t: "c" }), { linea: "c" });
  assert.deepEqual(interpretar({ t: "r" }), { linea: "r" });
  assert.deepEqual(interpretar({ t: "z" }), { linea: "z" });
  assert.equal(linea({ t: "c", x: "; rm -rf /", n: "apagar" }), "c");
  assert.equal(linea({ t: "z", v: 1 }), "z");
});

test("rueda: un decimal y tope de 300", () => {
  assert.equal(linea({ t: "s", y: 12.34 }), "s 12.3");
  assert.equal(linea({ t: "s", y: -300 }), "s -300.0");
  assert.equal(linea({ t: "s", y: 300 }), "s 300.0");
  assert.equal(interpretar({ t: "s", y: 300.1 }), null);
  assert.equal(interpretar({ t: "s", y: "3" }), null);
  assert.equal(interpretar({ t: "s", y: NaN }), null);
  assert.equal(interpretar({ t: "s" }), null);
  assert.equal(interpretar({ t: "s", x: 5 }), null);
});

test("teclas: solo las siete de la lista", () => {
  assert.equal(TECLAS.size, 7);
  for (const n of ["izq", "der", "arr", "aba", "espacio", "esc", "enter"]) {
    assert.deepEqual(interpretar({ t: "k", n }), { linea: `k ${n}` });
  }
  for (const n of ["q", "cmd", "IZQ", "izq ", " izq", "esc\nq", "enter q", "", "constructor", "has", 36, null, ["izq"], {}]) {
    assert.equal(interpretar({ t: "k", n }), null, `tecla ${JSON.stringify(n)}`);
  }
  assert.equal(interpretar({ t: "k" }), null);
});

// ---------- Láser y dibujo ----------

test("láser: prender y apagar, solo con 1 o 0", () => {
  assert.deepEqual(interpretar({ t: "l", v: 1 }), { linea: "l 1" });
  assert.deepEqual(interpretar({ t: "l", v: 0 }), { linea: "l 0" });
  for (const v of [2, -1, 0.5, "1", "0", true, false, null, undefined, NaN, [1], {}]) {
    assert.equal(interpretar({ t: "l", v }), null, `v = ${JSON.stringify(v)}`);
  }
  assert.equal(interpretar({ t: "l" }), null);
});

test("dibujo: empezar y terminar un trazo, solo con 1 o 0", () => {
  assert.deepEqual(interpretar({ t: "d", v: 1 }), { linea: "d 1" });
  assert.deepEqual(interpretar({ t: "d", v: 0 }), { linea: "d 0" });
  for (const v of [2, -1, 0.5, "1", "0", true, false, null, undefined, NaN, [0], {}]) {
    assert.equal(interpretar({ t: "d", v }), null, `v = ${JSON.stringify(v)}`);
  }
  assert.equal(interpretar({ t: "d" }), null);
});

test("borrar: sin argumentos", () => {
  assert.deepEqual(interpretar({ t: "b" }), { linea: "b" });
  assert.equal(linea({ t: "b", v: "lock" }), "b");
});

// ---------- Energía ----------

test("energía: bloquear y suspender siempre están permitidas", () => {
  for (const capacidades of [undefined, {}, { apagar: false }, { apagar: true }]) {
    assert.deepEqual(interpretar({ t: "e", n: "bloquear" }, capacidades), { energia: "bloquear", permitida: true });
    assert.deepEqual(interpretar({ t: "e", n: "suspender" }, capacidades), { energia: "suspender", permitida: true });
  }
});

test("energía: apagar solo si se habilitó al arrancar", () => {
  assert.deepEqual(interpretar({ t: "e", n: "apagar" }), { energia: "apagar", permitida: false });
  assert.deepEqual(interpretar({ t: "e", n: "apagar" }, {}), { energia: "apagar", permitida: false });
  assert.deepEqual(interpretar({ t: "e", n: "apagar" }, { apagar: false }), { energia: "apagar", permitida: false });
  assert.deepEqual(interpretar({ t: "e", n: "apagar" }, { apagar: true }), { energia: "apagar", permitida: true });
  // Solo vale un true de verdad: "si", 1 o "true" no habilitan nada.
  for (const apagar of ["si", "true", 1, {}, [], null]) {
    assert.equal(interpretar({ t: "e", n: "apagar" }, { apagar }).permitida, false, `apagar = ${JSON.stringify(apagar)}`);
  }
  // El teléfono no puede habilitarse el apagado a sí mismo.
  assert.equal(interpretar({ t: "e", n: "apagar", apagar: true, permitida: true }).permitida, false);
});

test("energía: nombres fuera de la lista se ignoran", () => {
  assert.deepEqual(ENERGIAS, ["bloquear", "suspender", "apagar"]);
  for (const n of ["reiniciar", "lock", "sleepnow", "Bloquear", "bloquear ", "apagar; reboot", "", "length", "0", 0, 1, null, undefined, true, ["bloquear"], { n: "bloquear" }]) {
    assert.equal(interpretar({ t: "e", n }, { apagar: true }), null, `n = ${JSON.stringify(n)}`);
  }
  assert.equal(interpretar({ t: "e" }, { apagar: true }), null);
});

test("energía: una orden de energía nunca es una línea para el ayudante", () => {
  for (const n of ENERGIAS) {
    const r = interpretar({ t: "e", n }, { apagar: true });
    assert.equal("linea" in r, false);
    assert.deepEqual(Object.keys(r).sort(), ["energia", "permitida"]);
  }
});

test("energiasPermitidas: lo que se le ofrece al teléfono", () => {
  assert.deepEqual(energiasPermitidas(), ["bloquear", "suspender"]);
  assert.deepEqual(energiasPermitidas({}), ["bloquear", "suspender"]);
  assert.deepEqual(energiasPermitidas({ apagar: false }), ["bloquear", "suspender"]);
  assert.deepEqual(energiasPermitidas({ apagar: "si" }), ["bloquear", "suspender"]);
  assert.deepEqual(energiasPermitidas({ apagar: true }), ["bloquear", "suspender", "apagar"]);
});

// ---------- Lo que no está en la lista ----------

test("órdenes desconocidas se ignoran", () => {
  for (const t of ["x", "q", "pedir", "lock", "e ", "M", "mm", "", "hola", "energia", "toString", "__proto__", 0, 1, null, undefined, true, ["m"], { t: "m" }]) {
    assert.equal(interpretar({ t, x: 1, y: 1, v: 1, n: "bloquear" }, { apagar: true }), null, `t = ${JSON.stringify(t)}`);
  }
  assert.equal(interpretar({}), null);
  assert.equal(interpretar({ x: 1, y: 2 }), null);
});

test("mensajes que no son objetos se ignoran", () => {
  for (const m of [null, undefined, 0, 1, "", "m", "l 1", true, false, NaN, Symbol("m"), () => ({ t: "c" })]) {
    assert.equal(interpretar(m), null, `mensaje ${String(m)}`);
  }
  assert.equal(interpretar([]), null);
  assert.equal(interpretar([{ t: "c" }]), null);
  assert.equal(interpretar(Object.assign([], { t: "c" })), null);
});

test("objetos raros: herencia, JSON tramposo y capacidades inválidas", () => {
  // Lo que llega del teléfono pasa por JSON.parse: "__proto__" queda como propiedad propia.
  assert.equal(interpretar(JSON.parse('{"__proto__":{"t":"e","n":"apagar"}}'), { apagar: true }), null);
  assert.equal(interpretar(JSON.parse('{"t":{"t":"c"}}')), null);
  assert.equal(interpretar(JSON.parse('{"t":"e","n":{"toString":"apagar"}}'), { apagar: true }), null);
  assert.equal(interpretar(JSON.parse('{"t":"m","x":"1e2","y":0}')), null);
  // Sin prototipo también anda.
  assert.deepEqual(interpretar(Object.assign(Object.create(null), { t: "l", v: 1 })), { linea: "l 1" });
  // Capacidades raras no rompen ni habilitan nada.
  assert.deepEqual(interpretar({ t: "c" }, undefined), { linea: "c" });
  assert.equal(interpretar({ t: "e", n: "apagar" }, undefined).permitida, false);
  assert.equal(interpretar({ t: "e", n: "apagar" }, { apagar: undefined }).permitida, false);
});

test("ninguna línea para el ayudante lleva saltos de línea ni texto del teléfono", () => {
  const mensajes = [
    { t: "m", x: 3.14159, y: -2.5 }, { t: "c" }, { t: "r" }, { t: "z" }, { t: "s", y: 7 },
    ...[...TECLAS].map((n) => ({ t: "k", n })),
    { t: "l", v: 1 }, { t: "l", v: 0 }, { t: "d", v: 1 }, { t: "d", v: 0 }, { t: "b" },
  ];
  for (const m of mensajes) {
    const r = interpretar({ ...m, extra: "\nlock\n", linea: "lock" });
    assert.match(r.linea, /^(m -?\d+\.\d\d -?\d+\.\d\d|[crzb]|s -?\d+\.\d|k [a-z]+|[ld] [01])$/, JSON.stringify(m));
    assert.notEqual(r.linea, "lock");
  }
});

test("interpretar no modifica el mensaje ni las capacidades", () => {
  const m = Object.freeze({ t: "e", n: "apagar" });
  const capacidades = Object.freeze({ apagar: true });
  assert.deepEqual(interpretar(m, capacidades), { energia: "apagar", permitida: true });
  assert.deepEqual(m, { t: "e", n: "apagar" });
});

// ---------- Plan de energía (qué se haría; acá no se ejecuta nada) ----------

test("plan: bloquear usa «lock» solo con clics y con el ayudante que anunció laser=si", () => {
  assert.deepEqual(planEnergia("bloquear", { clics: true, laser: true }), { linea: "lock" });
  const pantalla = { comando: "/usr/bin/pmset", args: ["displaysleepnow"] };
  assert.deepEqual(planEnergia("bloquear", { clics: false, laser: true }), pantalla);
  assert.deepEqual(planEnergia("bloquear", { clics: true, laser: false }), pantalla); // plan B con clics
  assert.deepEqual(planEnergia("bloquear", { clics: false, laser: false }), pantalla);
  assert.deepEqual(planEnergia("bloquear", {}), pantalla);
  assert.deepEqual(planEnergia("bloquear"), pantalla);
});

test("plan: suspender es siempre pmset sleepnow", () => {
  for (const estado of [undefined, {}, { clics: true, laser: true, apagar: true }]) {
    assert.deepEqual(planEnergia("suspender", estado), { comando: "/usr/bin/pmset", args: ["sleepnow"] });
  }
});

test("plan: apagar solo existe si está habilitado", () => {
  assert.equal(planEnergia("apagar"), null);
  assert.equal(planEnergia("apagar", { clics: true, laser: true }), null);
  assert.equal(planEnergia("apagar", { apagar: "si" }), null);
  assert.deepEqual(planEnergia("apagar", { apagar: true }), {
    comando: "/usr/bin/osascript",
    args: ["-e", 'tell application "System Events" to shut down'],
  });
});

test("plan: acciones desconocidas no hacen nada", () => {
  for (const accion of ["reiniciar", "lock", "", "Apagar", null, undefined, 0, {}, ["apagar"]]) {
    assert.equal(planEnergia(accion, { clics: true, laser: true, apagar: true }), null, `acción ${JSON.stringify(accion)}`);
  }
});
