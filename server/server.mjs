// Servidor de MANDO para el modo celular.
// La notebook conectada al proyector lo corre. El celular manda acciones por wifi,
// el motor (applyAction) calcula el estado y los conectores lo aplican a los aparatos reales.
// Sin dependencias: solo módulos de Node (18 o más nuevo).

import http from "node:http";
import { readFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomInt } from "node:crypto";
import { initialState, applyAction } from "../public/tv-state.js";

export const ACCIONES = ["POWER", "MUTE", "VOL_UP", "VOL_DOWN", "CH_UP", "CH_DOWN"];

const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));
const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const esLocal = (req) => {
  const ip = req.socket.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
};

export function direccionesLan() {
  const ips = [];
  for (const lista of Object.values(networkInterfaces())) {
    for (const red of lista || []) {
      if (red.family === "IPv4" && !red.internal) ips.push(red.address);
    }
  }
  return ips;
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": TIPOS[".json"], "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function leerCuerpo(req, limite = 4096) {
  return new Promise((resolve, reject) => {
    let datos = "";
    req.setEncoding("utf8");
    req.on("data", (parte) => {
      datos += parte;
      if (datos.length > limite) {
        reject(new Error("cuerpo demasiado grande"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(datos));
    req.on("error", reject);
  });
}

/**
 * Crea el servidor sin empezar a escuchar.
 * @param {object} opciones
 * @param {string} [opciones.codigo] código de 4 dígitos que pide el celular.
 * @param {Array}  [opciones.conectores] aparatos reales: { nombre, iniciar?(sala), aplicar(antes, despues, accion), estado() }.
 * @param {number} [opciones.pasoVolumen] cuántas veces aplica VOL_UP/VOL_DOWN por toque (1 = contrato del motor).
 */
export function crearServidor({ codigo, conectores = [], pasoVolumen = 1, log = () => {} } = {}) {
  const sala = {
    codigo: codigo ?? String(randomInt(0, 10000)).padStart(4, "0"),
    state: initialState,
    ultima: null,
  };
  const oyentes = new Set();

  const resumenConectores = () => conectores.map((c) => ({ nombre: c.nombre, ...c.estado() }));
  const paquete = () => ({ state: sala.state, ultima: sala.ultima, conectores: resumenConectores() });

  function avisar() {
    const mensaje = `data: ${JSON.stringify(paquete())}\n\n`;
    for (const res of oyentes) res.write(mensaje);
  }

  async function ejecutar(accion, origen) {
    const antes = sala.state;
    const veces = accion === "VOL_UP" || accion === "VOL_DOWN" ? pasoVolumen : 1;
    let despues = antes;
    for (let i = 0; i < veces; i += 1) despues = applyAction(despues, accion);
    sala.state = despues;
    sala.ultima = { accion, origen, hora: Date.now() };
    avisar();
    // Los aparatos reales se actualizan en paralelo; si uno falla, los demás siguen.
    await Promise.allSettled(conectores.map((c) => c.aplicar(antes, despues, accion)));
    avisar();
    return despues;
  }

  // Permite que un conector (por ejemplo, la computadora) informe el estado real al arrancar.
  function sincronizar(parcial) {
    sala.state = { ...sala.state, ...parcial };
    avisar();
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    try {
      if (url.pathname === "/api/accion" && req.method === "POST") {
        let datos;
        try {
          datos = JSON.parse(await leerCuerpo(req));
        } catch {
          return json(res, 400, { error: "JSON inválido" });
        }
        if (String(datos?.codigo) !== sala.codigo) return json(res, 403, { error: "Código incorrecto" });
        if (!ACCIONES.includes(datos?.accion)) return json(res, 400, { error: "Acción desconocida" });
        const origen = esLocal(req) ? "notebook" : "celular";
        log(`${origen}: ${datos.accion}`);
        const state = await ejecutar(datos.accion, origen);
        return json(res, 200, { state });
      }

      if (url.pathname === "/api/entrar" && req.method === "POST") {
        let datos;
        try {
          datos = JSON.parse(await leerCuerpo(req));
        } catch {
          return json(res, 400, { error: "JSON inválido" });
        }
        if (String(datos?.codigo) !== sala.codigo) return json(res, 403, { error: "Código incorrecto" });
        return json(res, 200, paquete());
      }

      if (url.pathname === "/api/eventos" && req.method === "GET") {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-store",
          connection: "keep-alive",
        });
        res.write(`data: ${JSON.stringify(paquete())}\n\n`);
        oyentes.add(res);
        const latido = setInterval(() => res.write(": latido\n\n"), 15000);
        req.on("close", () => {
          clearInterval(latido);
          oyentes.delete(res);
        });
        return;
      }

      // Solo la notebook ve el código y las direcciones para mostrarlos en el proyector.
      if (url.pathname === "/api/info" && req.method === "GET") {
        if (!esLocal(req)) return json(res, 403, { error: "Solo desde la notebook" });
        const puerto = server.address()?.port;
        return json(res, 200, {
          codigo: sala.codigo,
          urls: direccionesLan().map((ip) => `http://${ip}:${puerto}/celular.html`),
          ...paquete(),
        });
      }

      if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "Método no permitido" });
      return servirArchivo(url.pathname, res);
    } catch (error) {
      log(`error: ${error.message}`);
      if (!res.headersSent) json(res, 500, { error: "Error interno" });
      else res.end();
    }
  });

  server.on("close", () => {
    for (const res of oyentes) res.end();
    oyentes.clear();
  });

  return { server, sala, ejecutar, sincronizar };
}

async function servirArchivo(pathname, res) {
  let relativo;
  try {
    relativo = decodeURIComponent(pathname);
  } catch {
    return json(res, 400, { error: "Ruta inválida" });
  }
  if (relativo.endsWith("/")) relativo += "index.html";
  const ruta = normalize(join(PUBLIC_DIR, relativo));
  if (!ruta.startsWith(PUBLIC_DIR) || ruta.split(sep).includes("..")) {
    return json(res, 404, { error: "No encontrado" });
  }
  try {
    const contenido = await readFile(ruta);
    res.writeHead(200, {
      "content-type": TIPOS[extname(ruta)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(contenido);
  } catch {
    json(res, 404, { error: "No encontrado" });
  }
}

// Arranque: node server/server.mjs
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const { crearConectorComputadora } = await import("./conectores/computadora.mjs");
  const { crearConectorPjlink } = await import("./conectores/pjlink.mjs");

  const conectores = [];
  if (process.env.COMPUTADORA !== "no") conectores.push(crearConectorComputadora());
  if (process.env.PJLINK_HOST) {
    conectores.push(
      crearConectorPjlink({
        host: process.env.PJLINK_HOST,
        port: Number(process.env.PJLINK_PORT) || 4352,
        password: process.env.PJLINK_PASS || "",
      }),
    );
  }

  const puerto = Number(process.env.PORT) || 8080;
  const app = crearServidor({
    codigo: process.env.SALA,
    conectores,
    pasoVolumen: Number(process.env.PASO_VOLUMEN) || 5,
    log: (m) => console.log(`[mando] ${m}`),
  });

  for (const c of conectores) await c.iniciar?.(app);

  app.server.listen(puerto, "0.0.0.0", () => {
    console.log("\nMANDO · Tu control, a tu manera");
    console.log(`Proyector:  http://localhost:${puerto}/proyector.html`);
    for (const ip of direccionesLan()) console.log(`Celular:    http://${ip}:${puerto}/celular.html`);
    console.log(`Código:     ${app.sala.codigo}`);
    console.log(`Conectores: ${conectores.map((c) => c.nombre).join(", ") || "ninguno (solo TV simulada)"}\n`);
  });
}
