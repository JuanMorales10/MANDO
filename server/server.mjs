// Servidor de sala MANDO: la notebook proyecta la TV; el celular manda acciones.
// Sin dependencias. Node 18+.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomInt } from "node:crypto";
import { initialState, applyAction } from "../public/tv-state.js";

const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));
const ACCIONES = ["MUTE", "VOL_UP", "VOL_DOWN", "CH_UP", "CH_DOWN", "POWER"];

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

function json(res, status, cuerpo) {
  const raw = JSON.stringify(cuerpo);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(raw);
}

function leerCuerpo(req) {
  return new Promise((resolveBody, reject) => {
    const trozos = [];
    req.on("data", (c) => trozos.push(c));
    req.on("end", () => resolveBody(Buffer.concat(trozos).toString("utf8")));
    req.on("error", reject);
  });
}

export function crearServidor({
  codigo,
  pasoVolumen = 1,
  log = () => {},
} = {}) {
  const sala = {
    codigo: codigo ?? String(randomInt(0, 10000)).padStart(4, "0"),
    state: { ...initialState },
    ultima: null,
  };
  const oyentes = new Set();

  const paquete = () => ({ state: sala.state, ultima: sala.ultima });

  const avisar = () => {
    const data = `data: ${JSON.stringify(paquete())}\n\n`;
    for (const res of oyentes) res.write(data);
  };

  async function ejecutar(accion, origen) {
    let despues = sala.state;
    const veces = accion === "VOL_UP" || accion === "VOL_DOWN" ? pasoVolumen : 1;
    for (let i = 0; i < veces; i += 1) despues = applyAction(despues, accion);
    sala.state = despues;
    sala.ultima = { accion, origen, hora: Date.now() };
    avisar();
    return despues;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    try {
      if (url.pathname === "/api/accion" && req.method === "POST") {
        let datos;
        try {
          datos = JSON.parse(await leerCuerpo(req));
        } catch {
          return json(res, 400, { error: "JSON inválido" });
        }
        if (String(datos?.codigo) !== sala.codigo) {
          return json(res, 403, { error: "Código incorrecto" });
        }
        if (!ACCIONES.includes(datos?.accion)) {
          return json(res, 400, { error: "Acción desconocida" });
        }
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
        if (String(datos?.codigo) !== sala.codigo) {
          return json(res, 403, { error: "Código incorrecto" });
        }
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

      if (url.pathname === "/api/info" && req.method === "GET") {
        // Info de sala: disponible para la pantalla del proyector.
        const puerto = server.address()?.port;
        const urls = direccionesLan().map(
          (ip) => `http://${ip}:${puerto}/celular.html?c=${sala.codigo}`,
        );
        if (urls.length === 0) {
          urls.push(`http://localhost:${puerto}/celular.html?c=${sala.codigo}`);
        }
        return json(res, 200, {
          codigo: sala.codigo,
          urls,
          local: esLocal(req),
          ...paquete(),
        });
      }

      if (req.method !== "GET" && req.method !== "HEAD") {
        return json(res, 405, { error: "Método no permitido" });
      }
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

  return { server, sala, ejecutar };
}

async function servirArchivo(pathname, res) {
  let relativo;
  try {
    relativo = decodeURIComponent(pathname);
  } catch {
    return json(res, 400, { error: "Ruta inválida" });
  }
  if (relativo === "/" || relativo === "") relativo = "/proyector.html";
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

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const puerto = Number(process.env.PORT) || 8080;
  const app = crearServidor({
    codigo: process.env.SALA,
    pasoVolumen: Number(process.env.PASO_VOLUMEN) || 1,
    log: (m) => console.log(`[mando] ${m}`),
  });

  app.server.listen(puerto, "0.0.0.0", () => {
    console.log("\nMANDO · Sala con QR");
    console.log(`Proyector:  http://localhost:${puerto}/proyector.html`);
    for (const ip of direccionesLan()) {
      console.log(
        `Celular:    http://${ip}:${puerto}/celular.html?c=${app.sala.codigo}`,
      );
    }
    console.log(`Código:     ${app.sala.codigo}`);
    console.log("Escaneá el QR en el proyector con el celular (misma WiFi).\n");
  });
}
