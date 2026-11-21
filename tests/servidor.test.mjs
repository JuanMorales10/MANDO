import { test, after } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { crearServidor } from "../server/server.mjs";
import { enviarPjlink, comandosPara, crearConectorPjlink } from "../server/conectores/pjlink.mjs";
import { crearConectorComputadora } from "../server/conectores/computadora.mjs";
import { initialState } from "../public/tv-state.js";

// ---------- Servidor ----------

const llamadas = [];
const conectorFalso = {
  nombre: "Falso",
  estado: () => ({ ok: true, detalle: "ok" }),
  aplicar: async (antes, despues, accion) => llamadas.push({ antes, despues, accion }),
};
const app = crearServidor({ codigo: "1234", conectores: [conectorFalso], pasoVolumen: 5 });
await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${app.server.address().port}`;
after(() => app.server.close());

const accion = (cuerpo) =>
  fetch(`${base}/api/accion`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });

test("rechaza un código incorrecto", async () => {
  const res = await accion({ codigo: "0000", accion: "MUTE" });
  assert.equal(res.status, 403);
  assert.equal(app.sala.state, initialState);
});

test("rechaza acciones que no existen", async () => {
  const res = await accion({ codigo: "1234", accion: "BORRAR_TODO" });
  assert.equal(res.status, 400);
});

test("rechaza JSON inválido", async () => {
  const res = await fetch(`${base}/api/accion`, { method: "POST", body: "{no" });
  assert.equal(res.status, 400);
});

test("MUTE desde el celular silencia y avisa al conector", async () => {
  const res = await accion({ codigo: "1234", accion: "MUTE" });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).state.muted, true);
  assert.deepEqual(llamadas.at(-1).accion, "MUTE");
  assert.equal(llamadas.at(-1).despues.muted, true);
  await accion({ codigo: "1234", accion: "MUTE" });
  assert.equal(app.sala.state.muted, false);
});

test("VOL_UP aplica el paso configurado y respeta el tope", async () => {
  const res = await accion({ codigo: "1234", accion: "VOL_UP" });
  assert.equal((await res.json()).state.volume, 20);
  for (let i = 0; i < 30; i += 1) await accion({ codigo: "1234", accion: "VOL_UP" });
  assert.equal(app.sala.state.volume, 100);
});

test("entrar valida el código y devuelve el estado", async () => {
  const mal = await fetch(`${base}/api/entrar`, { method: "POST", body: JSON.stringify({ codigo: "9" }) });
  assert.equal(mal.status, 403);
  const bien = await fetch(`${base}/api/entrar`, { method: "POST", body: JSON.stringify({ codigo: "1234" }) });
  assert.equal(bien.status, 200);
  assert.equal((await bien.json()).conectores[0].nombre, "Falso");
});

test("la notebook ve el código en /api/info", async () => {
  const info = await (await fetch(`${base}/api/info`)).json();
  assert.equal(info.codigo, "1234");
  assert.ok(Array.isArray(info.urls));
});

test("los eventos en vivo mandan el estado al conectarse", async () => {
  const controlador = new AbortController();
  const res = await fetch(`${base}/api/eventos`, { signal: controlador.signal });
  assert.equal(res.headers.get("content-type"), "text/event-stream");
  const lector = res.body.getReader();
  const { value } = await lector.read();
  const texto = new TextDecoder().decode(value);
  assert.match(texto, /^data: /);
  assert.equal(JSON.parse(texto.slice(6)).state.volume, app.sala.state.volume);
  controlador.abort();
});

test("sirve las páginas de public/", async () => {
  for (const ruta of ["/", "/celular.html", "/proyector.html", "/tv-state.js"]) {
    const res = await fetch(base + ruta);
    assert.equal(res.status, 200, ruta);
  }
  assert.match((await fetch(`${base}/celular.js`)).headers.get("content-type"), /javascript/);
});

test("no deja salir de public/", async () => {
  for (const ruta of ["/../server/server.mjs", "/%2e%2e/server/server.mjs", "/..%2fpackage.json"]) {
    const res = await fetch(base + ruta);
    assert.equal(res.status, 404, ruta);
  }
});

// ---------- PJLink ----------

function proyectorFalso({ semilla = null, password = "", respuestas = {} } = {}) {
  const recibidos = [];
  const servidor = net.createServer((socket) => {
    socket.write(semilla ? `PJLINK 1 ${semilla}\r` : "PJLINK 0\r");
    let buffer = "";
    socket.on("data", (parte) => {
      buffer += parte.toString("latin1");
      const fin = buffer.indexOf("\r");
      if (fin === -1) return;
      const linea = buffer.slice(0, fin);
      recibidos.push(linea);
      if (semilla) {
        const esperado = require_md5(semilla + password);
        if (!linea.startsWith(esperado)) return socket.end("PJLINK ERRA\r");
      }
      const comando = linea.slice(semilla ? 32 : 0);
      const clave = comando.split(" ")[0];
      socket.end(`${clave}=${respuestas[clave] ?? "OK"}\r`);
    });
  });
  return new Promise((r) => servidor.listen(0, "127.0.0.1", () => r({ servidor, recibidos, port: servidor.address().port })));
}

import { createHash } from "node:crypto";
const require_md5 = (texto) => createHash("md5").update(texto).digest("hex");

test("PJLink sin contraseña envía el comando y lee OK", async () => {
  const { servidor, recibidos, port } = await proyectorFalso();
  const respuesta = await enviarPjlink({ host: "127.0.0.1", port }, "%1AVMT 31");
  assert.equal(respuesta, "%1AVMT=OK");
  assert.deepEqual(recibidos, ["%1AVMT 31"]);
  servidor.close();
});

test("PJLink con contraseña usa el hash del ejemplo oficial", async () => {
  // Ejemplo de la especificación PJLink: semilla 498e4a67 + contraseña JBMIAProjectorLink.
  assert.equal(require_md5("498e4a67JBMIAProjectorLink"), "5d8409bc1c3fa39749434aa3a5c38682");
  const { servidor, recibidos, port } = await proyectorFalso({ semilla: "498e4a67", password: "JBMIAProjectorLink" });
  await enviarPjlink({ host: "127.0.0.1", port, password: "JBMIAProjectorLink" }, "%1POWR 1");
  assert.equal(recibidos[0], "5d8409bc1c3fa39749434aa3a5c38682%1POWR 1");
  servidor.close();
});

test("PJLink informa contraseña incorrecta y errores del proyector", async () => {
  const conClave = await proyectorFalso({ semilla: "abcd1234", password: "bien" });
  await assert.rejects(enviarPjlink({ host: "127.0.0.1", port: conClave.port, password: "mal" }, "%1POWR 1"), /Contraseña PJLink incorrecta/);
  await assert.rejects(enviarPjlink({ host: "127.0.0.1", port: conClave.port }, "%1POWR 1"), /pide contraseña/);
  conClave.servidor.close();

  const sinVolumen = await proyectorFalso({ respuestas: { "%2SVOL": "ERR1" } });
  await assert.rejects(enviarPjlink({ host: "127.0.0.1", port: sinVolumen.port }, "%2SVOL 1"), /no reconoce/);
  sinVolumen.servidor.close();
});

test("PJLink avisa si no hay proyector en esa dirección", async () => {
  const libre = net.createServer();
  await new Promise((r) => libre.listen(0, "127.0.0.1", r));
  const port = libre.address().port;
  libre.close();
  await assert.rejects(enviarPjlink({ host: "127.0.0.1", port, timeout: 1000 }, "%1POWR ?"), /No me pude conectar/);
});

test("PJLink traduce cada acción al comando correcto", () => {
  const s = initialState;
  assert.deepEqual(comandosPara(s, { ...s, muted: true }, "MUTE"), ["%1AVMT 31"]);
  assert.deepEqual(comandosPara({ ...s, muted: true }, s, "MUTE"), ["%1AVMT 30"]);
  assert.deepEqual(comandosPara(s, { ...s, power: false }, "POWER"), ["%1POWR 0"]);
  assert.deepEqual(comandosPara(s, { ...s, volume: 20 }, "VOL_UP"), ["%2SVOL 1"]);
  assert.deepEqual(comandosPara(s, { ...s, volume: 10 }, "VOL_DOWN"), ["%2SVOL 0"]);
  assert.deepEqual(comandosPara({ ...s, volume: 100 }, { ...s, volume: 100 }, "VOL_UP"), []);
  assert.deepEqual(comandosPara(s, s, "CH_UP"), []);
});

test("el conector PJLink muestra el nombre del proyector y sigue si falla el volumen", async () => {
  const { servidor, recibidos, port } = await proyectorFalso({ respuestas: { "%1NAME": "Epson Sala 1", "%2SVOL": "ERR1" } });
  const conector = crearConectorPjlink({ host: "127.0.0.1", port });
  await conector.iniciar();
  assert.equal(conector.estado().detalle, "Conectado: Epson Sala 1");
  await conector.aplicar(initialState, { ...initialState, volume: 20 }, "VOL_UP");
  assert.equal(conector.estado().ok, false);
  assert.match(conector.estado().detalle, /no permite cambiar el volumen/);
  await conector.aplicar(initialState, { ...initialState, muted: true }, "MUTE");
  assert.equal(conector.estado().ok, true);
  assert.deepEqual(recibidos, ["%1NAME ?", "%2SVOL 1", "%1AVMT 31"]);
  servidor.close();
});

// ---------- Computadora ----------

test("la computadora sincroniza el volumen real al arrancar y reporta fallas", async () => {
  const aplicadas = [];
  const conector = crearConectorComputadora({
    driver: {
      leer: async () => ({ volume: 42, muted: false }),
      aplicar: async (antes, despues, accion) => {
        if (accion === "CH_UP") throw new Error("not allowed assistive access (-1719)");
        aplicadas.push(accion);
      },
    },
  });
  const sincronizado = [];
  await conector.iniciar({ sincronizar: (parcial) => sincronizado.push(parcial) });
  assert.deepEqual(sincronizado, [{ volume: 42, muted: false }]);
  await conector.aplicar(initialState, { ...initialState, muted: true }, "MUTE");
  assert.deepEqual(aplicadas, ["MUTE"]);
  await conector.aplicar(initialState, { ...initialState, channel: 2 }, "CH_UP");
  assert.equal(conector.estado().ok, false);
  assert.match(conector.estado().detalle, /Accesibilidad/);
});

test("la computadora en un sistema no soportado no rompe nada", async () => {
  const conector = crearConectorComputadora({ sistema: "linux" });
  assert.equal(conector.estado().ok, false);
  await conector.aplicar(initialState, initialState, "MUTE");
});
