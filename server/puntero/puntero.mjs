// Puntero para el modo celular: el teléfono mueve el cursor de la notebook.
// Se suma al servidor de MANDO sin modificarlo:
//   - abre una puerta HTTPS (los sensores de movimiento del teléfono la exigen) que atiende
//     todo lo que ya atiende el servidor, más el puntero y un QR para entrar;
//   - reutiliza el mismo código de 4 dígitos de la sala.
// Sin dependencias de npm. Solo macOS (usa un ayudante en Swift para mover el cursor).

import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import { createRequire } from "node:module";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(AQUI, "..", "..", "public");
const requerir = createRequire(import.meta.url);
const QRCode = requerir("./vendor/qrcode/index.js");
const NivelQR = requerir("./vendor/qrcode/QRErrorCorrectLevel.js");

// ---------- Red ----------

const limpiarIp = (ip) => String(ip || "").replace(/^::ffff:/, "");

function esPrivada(ipCruda) {
  const ip = limpiarIp(ipCruda);
  if (ip === "127.0.0.1" || ip === "::1") return true;
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n))) return false;
  return (
    p[0] === 10 ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 169 && p[1] === 254)
  );
}

const esLocal = (req) => ["127.0.0.1", "::1"].includes(limpiarIp(req.socket.remoteAddress));

function interfazPrincipal() {
  try {
    const salida = execFileSync("route", ["-n", "get", "default"], { encoding: "utf8" });
    return (salida.match(/interface:\s*(\S+)/) || [])[1] || "";
  } catch {
    return "";
  }
}

// La red por la que la notebook sale a internet va primero: es la que comparte con el teléfono.
function ipsLan() {
  const principal = interfazPrincipal();
  return Object.entries(networkInterfaces())
    .flatMap(([nombre, lista]) => (lista || []).map((i) => ({ ...i, nombre })))
    .filter((i) => i.family === "IPv4" && !i.internal && esPrivada(i.address))
    .sort((x, y) => (y.nombre === principal) - (x.nombre === principal))
    .map((i) => i.address);
}

// ---------- Certificado propio ----------

function certificado(ips) {
  const dir = path.join(AQUI, ".cert");
  const clave = path.join(dir, "clave.pem");
  const cert = path.join(dir, "cert.pem");
  const marca = path.join(dir, "ips.txt");
  const firma = ips.join(",");
  const vigente = existsSync(clave) && existsSync(cert) && existsSync(marca) && readFileSync(marca, "utf8") === firma;
  if (!vigente) {
    mkdirSync(dir, { recursive: true });
    const san = ["DNS:localhost", "IP:127.0.0.1", ...ips.map((ip) => `IP:${ip}`)].join(",");
    execFileSync(
      "openssl",
      ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "30", "-keyout", clave, "-out", cert,
        "-subj", "/CN=MANDO", "-addext", `subjectAltName=${san}`],
      { stdio: "ignore" },
    );
    writeFileSync(marca, firma);
  }
  return { key: readFileSync(clave), cert: readFileSync(cert) };
}

// ---------- QR ----------

function qrSvg(texto) {
  const qr = new QRCode(-1, NivelQR.M);
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  let d = "";
  for (let f = 0; f < n; f += 1) {
    for (let c = 0; c < n; c += 1) if (qr.modules[f][c]) d += `M${c + 2} ${f + 2}h1v1h-1z`;
  }
  const lado = n + 4;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" shape-rendering="crispEdges"><rect width="${lado}" height="${lado}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

// ---------- WebSocket mínimo (texto, mensajes cortos) ----------

function aceptarWebSocket(req, socket) {
  const llave = req.headers["sec-websocket-key"];
  if (!llave || String(req.headers.upgrade).toLowerCase() !== "websocket") return null;
  const acepta = createHash("sha1").update(`${llave}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${acepta}\r\n\r\n`,
  );
  socket.setNoDelay(true);

  let pendiente = Buffer.alloc(0);
  let abierto = true;
  const ws = {
    alMensaje: () => {},
    alCerrar: () => {},
    get abierto() {
      return abierto;
    },
    enviar(texto) {
      if (!abierto) return;
      const datos = Buffer.from(texto);
      const cabeza = datos.length < 126
        ? Buffer.from([0x81, datos.length])
        : Buffer.from([0x81, 126, datos.length >> 8, datos.length & 255]);
      socket.write(Buffer.concat([cabeza, datos]));
    },
    cerrar(codigo = 1000) {
      if (!abierto) return;
      abierto = false;
      socket.end(Buffer.from([0x88, 2, codigo >> 8, codigo & 255]));
      ws.alCerrar();
    },
  };

  const terminar = () => {
    if (!abierto) return;
    abierto = false;
    socket.destroy();
    ws.alCerrar();
  };

  socket.on("data", (parte) => {
    pendiente = Buffer.concat([pendiente, parte]);
    if (pendiente.length > 8192) return terminar();
    while (pendiente.length >= 2) {
      const codigoOp = pendiente[0] & 0x0f;
      const enmascarado = (pendiente[1] & 0x80) !== 0;
      let largo = pendiente[1] & 0x7f;
      let inicio = 2;
      if (largo === 126) {
        if (pendiente.length < 4) return;
        largo = pendiente.readUInt16BE(2);
        inicio = 4;
      } else if (largo === 127) {
        return terminar(); // mensajes enormes: no los esperamos
      }
      if (!enmascarado || largo > 512) return terminar();
      if (pendiente.length < inicio + 4 + largo) return;
      const mascara = pendiente.subarray(inicio, inicio + 4);
      const cuerpo = Buffer.from(pendiente.subarray(inicio + 4, inicio + 4 + largo));
      for (let i = 0; i < cuerpo.length; i += 1) cuerpo[i] ^= mascara[i & 3];
      pendiente = pendiente.subarray(inicio + 4 + largo);

      if (codigoOp === 0x8) return terminar();
      if (codigoOp === 0x9) socket.write(Buffer.concat([Buffer.from([0x8a, cuerpo.length]), cuerpo]));
      else if (codigoOp === 0x1) ws.alMensaje(cuerpo.toString("utf8"));
    }
  });
  socket.on("close", terminar);
  socket.on("error", terminar);
  return ws;
}

// ---------- Puntero ----------

const num = (n) => typeof n === "number" && Number.isFinite(n);
const TECLAS = new Set(["izq", "der", "arr", "aba", "espacio", "esc", "enter"]);
const SIN_SENAL = 6000;

/**
 * Suma el puntero y la puerta HTTPS a un servidor creado con crearServidor().
 * @param {object} app lo que devuelve crearServidor(): { server, sala }
 * @param {object} [opciones]
 * @param {number} [opciones.puertoHttps] puerta para los teléfonos (HTTPS).
 * @param {number} [opciones.puertoPantalla] puerta solo local para el proyector (HTTP).
 */
export async function sumarPuntero(app, { puertoHttps = 8443, puertoPantalla = 8090, log = () => {} } = {}) {
  const ips = ipsLan();
  const urlCelular = () => (ips[0] ? `https://${ips[0]}:${puertoHttps}/celular.html?c=${app.sala.codigo}` : "");

  // ----- Ayudante que mueve el cursor -----
  const binario = path.join(AQUI, "cursor");
  let disponible = process.platform === "darwin";
  if (disponible && !existsSync(binario)) {
    try {
      log("compilando el ayudante del cursor (solo la primera vez)…");
      execFileSync("swiftc", ["-O", path.join(AQUI, "cursor.swift"), "-o", binario], { stdio: "inherit" });
    } catch {
      disponible = false;
      log("no pude compilar el ayudante del cursor: el puntero queda apagado");
    }
  }

  let ayudante = null;
  let clics = false;
  let cerrando = false;
  let cliente = null; // teléfono conectado por WebSocket
  let porPost = null; // teléfono conectado por el camino de respaldo: { id, visto }

  function arrancarAyudante() {
    if (!disponible || cerrando) return;
    ayudante = spawn(binario, [], { stdio: ["pipe", "pipe", "inherit"] });
    ayudante.stdout.setEncoding("utf8");
    ayudante.stdout.on("data", (t) => {
      const antes = clics;
      if (t.includes("accesibilidad=si")) clics = true;
      if (t.includes("accesibilidad=no")) clics = false;
      if (clics !== antes) {
        log(clics ? "puntero: clics habilitados" : "puntero: clics deshabilitados (falta el permiso de Accesibilidad)");
        if (cliente) cliente.enviar(JSON.stringify({ t: "hola", clics }));
      }
    });
    ayudante.on("exit", () => {
      ayudante = null;
      if (!cerrando) setTimeout(arrancarAyudante, 300);
    });
  }
  const alCursor = (linea) => {
    if (ayudante && ayudante.stdin.writable) ayudante.stdin.write(`${linea}\n`);
  };
  arrancarAyudante();
  if (disponible) alCursor("pedir"); // macOS muestra su aviso para habilitar Accesibilidad
  const revisar = setInterval(() => alCursor("e"), 2500);
  revisar.unref();

  // ----- Órdenes: lista cerrada, todo lo demás se ignora -----
  let ventana = Date.now();
  let cuenta = 0;
  function procesar(m) {
    const ahora = Date.now();
    if (ahora - ventana > 1000) {
      ventana = ahora;
      cuenta = 0;
    }
    if (++cuenta > 240) return;
    if (!m || typeof m !== "object" || Array.isArray(m)) return;
    switch (m.t) {
      case "m":
        if (num(m.x) && num(m.y) && Math.abs(m.x) <= 400 && Math.abs(m.y) <= 400) {
          alCursor(`m ${m.x.toFixed(2)} ${m.y.toFixed(2)}`);
        }
        break;
      case "c":
        alCursor("c");
        break;
      case "r":
        alCursor("r");
        break;
      case "z":
        alCursor("z");
        break;
      case "s":
        if (num(m.y) && Math.abs(m.y) <= 300) alCursor(`s ${m.y.toFixed(1)}`);
        break;
      case "k":
        if (typeof m.n === "string" && TECLAS.has(m.n)) alCursor(`k ${m.n}`);
        break;
      default:
        break;
    }
  }

  // ----- Código de la sala, con freno a quien prueba muchos -----
  const fallos = new Map(); // ip -> { cuenta, hasta }
  function codigoValido(req, codigo) {
    const ip = limpiarIp(req.socket.remoteAddress);
    const f = fallos.get(ip) || { cuenta: 0, hasta: 0 };
    if (Date.now() < f.hasta) return false;
    if (typeof codigo === "string" && codigo === app.sala.codigo) {
      fallos.delete(ip);
      return true;
    }
    f.cuenta += 1;
    if (f.cuenta >= 8) {
      f.cuenta = 0;
      f.hasta = Date.now() + 60000;
      log(`puntero: demasiados códigos incorrectos desde ${ip}; bloqueado un minuto`);
    }
    fallos.set(ip, f);
    return false;
  }

  const mismoOrigen = (req) => {
    try {
      return new URL(req.headers.origin || "").host === req.headers.host;
    } catch {
      return false;
    }
  };

  // ----- Camino de respaldo por POST -----
  function atenderPost(req, res, ruta) {
    const id = String(req.headers["x-id"] || "");
    if (!mismoOrigen(req) || !/^[a-z0-9]{8,32}$/.test(id) || !codigoValido(req, String(req.headers["x-token"] || ""))) {
      res.writeHead(401).end();
      return;
    }
    if (ruta === "/puntero/chau") {
      if (porPost && porPost.id === id) porPost = null;
      res.writeHead(204).end();
      return;
    }
    const ahora = Date.now();
    if (cliente || (porPost && porPost.id !== id && ahora - porPost.visto < SIN_SENAL)) {
      res.writeHead(409).end();
      return;
    }
    if (!porPost || porPost.id !== id) log(`puntero: teléfono conectado (${limpiarIp(req.socket.remoteAddress)}, respaldo)`);
    porPost = { id, visto: ahora };
    let cuerpo = "";
    req.on("data", (c) => {
      cuerpo += c;
      if (cuerpo.length > 4096) req.destroy();
    });
    req.on("end", () => {
      let lista;
      try {
        lista = JSON.parse(cuerpo);
      } catch {
        lista = null;
      }
      if (!Array.isArray(lista) || lista.length > 32) {
        res.writeHead(400).end();
        return;
      }
      for (const m of lista) procesar(m);
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ clics }));
    });
  }

  // ----- Páginas: las del servidor de siempre, con un agregado para el puntero -----
  const AGREGADOS = {
    "/celular.html": '<script type="module" src="/puntero/extra-celular.js"></script>',
    "/proyector.html": '<script type="module" src="/puntero/extra-proyector.js"></script>',
  };

  async function atender(req, res) {
    if (!esPrivada(req.socket.remoteAddress)) {
      res.writeHead(403).end();
      return;
    }
    const ruta = new URL(req.url, "http://x").pathname;

    if (req.method === "POST" && (ruta === "/puntero/m" || ruta === "/puntero/chau")) {
      atenderPost(req, res, ruta);
      return;
    }
    if (req.method === "GET" && ruta === "/puntero/info") {
      // El QR y el código solo se le entregan a la propia notebook, para mostrarlos en el proyector.
      if (!esLocal(req)) {
        res.writeHead(403).end();
        return;
      }
      const url = urlCelular();
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify({ url, qr: url ? qrSvg(url) : "", puntero: disponible, clics }));
      return;
    }
    if (req.method === "GET" && ruta === "/puntero/estado") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify({ puntero: disponible, seguro: Boolean(req.socket.encrypted) || esLocal(req) }));
      return;
    }
    if (req.method === "GET" && AGREGADOS[ruta]) {
      try {
        const html = await readFile(path.join(PUBLIC_DIR, ruta), "utf8");
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        res.end(html.replace("</body>", `  ${AGREGADOS[ruta]}\n</body>`));
        return;
      } catch {
        // Si no se puede leer, que responda el servidor de siempre.
      }
    }
    app.server.emit("request", req, res);
  }

  function atenderUpgrade(req, socket) {
    const url = new URL(req.url, "http://x");
    const permitido =
      disponible &&
      url.pathname === "/puntero/ws" &&
      esPrivada(req.socket.remoteAddress) &&
      mismoOrigen(req) &&
      codigoValido(req, url.searchParams.get("t") || "");
    const ws = permitido ? aceptarWebSocket(req, socket) : null;
    if (!ws) {
      socket.end("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      return;
    }
    // Un solo teléfono maneja el cursor: el nuevo reemplaza al anterior.
    if (cliente) cliente.cerrar(4000);
    cliente = ws;
    porPost = null;
    log(`puntero: teléfono conectado (${limpiarIp(req.socket.remoteAddress)})`);
    ws.enviar(JSON.stringify({ t: "hola", clics }));
    ws.alMensaje = (texto) => {
      try {
        procesar(JSON.parse(texto));
      } catch {
        // mensaje raro: se ignora
      }
    };
    ws.alCerrar = () => {
      if (cliente === ws) {
        cliente = null;
        log("puntero: teléfono desconectado");
      }
    };
  }

  const seguro = https.createServer(certificado(ips), atender);
  seguro.on("upgrade", atenderUpgrade);
  const pantalla = http.createServer(atender);
  pantalla.on("upgrade", atenderUpgrade);

  await new Promise((ok, mal) => {
    seguro.once("error", mal);
    seguro.listen(puertoHttps, "0.0.0.0", ok);
  });
  await new Promise((ok, mal) => {
    pantalla.once("error", mal);
    pantalla.listen(puertoPantalla, "127.0.0.1", ok);
  });

  function cerrar() {
    cerrando = true;
    clearInterval(revisar);
    if (cliente) cliente.cerrar(4001);
    if (ayudante) ayudante.kill();
    seguro.close();
    pantalla.close();
  }

  return {
    disponible,
    cerrar,
    urlCelular,
    urlProyector: `http://localhost:${puertoPantalla}/proyector.html`,
    puertoHttps,
  };
}
