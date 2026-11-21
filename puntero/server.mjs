// Puente del puntero: sirve la página del teléfono por HTTPS y traduce
// sus mensajes a movimientos del cursor y volumen de esta Mac.
// Arrancar: npm start   ·   Cortar: Ctrl+C

import { spawn, execFile, execFileSync } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import qrcode from "qrcode-terminal";
import { WebSocketServer } from "ws";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
let PUERTO = Number(process.env.PUERTO) || 8443;
// PUNTERO_TOKEN permite reutilizar el código al reiniciar (32 hexadecimales); si no, se genera uno nuevo.
const TOKEN = /^[0-9a-f]{32}$/.test(process.env.PUNTERO_TOKEN || "")
  ? process.env.PUNTERO_TOKEN
  : randomBytes(16).toString("hex");

// ---------- Red ----------

function esPrivada(ip) {
  const v4 = ip.replace(/^::ffff:/, "");
  if (v4 === "127.0.0.1" || ip === "::1") return true;
  const p = v4.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n))) return false;
  return (
    p[0] === 10 ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 169 && p[1] === 254)
  );
}

function interfazPrincipal() {
  try {
    const salida = execFileSync("route", ["-n", "get", "default"], { encoding: "utf8" });
    return (salida.match(/interface:\s*(\S+)/) || [])[1] || "";
  } catch {
    return "";
  }
}

// La red por la que la Mac sale a internet va primero: es la que comparte con el teléfono.
function ipsLocales() {
  const principal = interfazPrincipal();
  return Object.entries(os.networkInterfaces())
    .flatMap(([nombre, lista]) => (lista || []).map((i) => ({ ...i, nombre })))
    .filter((i) => i.family === "IPv4" && !i.internal && esPrivada(i.address))
    .sort((x, y) => (y.nombre === principal) - (x.nombre === principal))
    .map((i) => i.address);
}

const IPS = ipsLocales();

// Las direcciones se recalculan solas: si la Mac cambia de red (por ejemplo al hotspot), el QR se actualiza.
let ipsCache = { t: Date.now(), ips: IPS };
function ipsAhora() {
  if (Date.now() - ipsCache.t > 3000) ipsCache = { t: Date.now(), ips: ipsLocales() };
  return ipsCache.ips;
}
const enlaces = () => ipsAhora().map((ip) => `https://${ip}:${PUERTO}/#t=${TOKEN}`);

// ---------- Certificado autofirmado (los sensores del teléfono exigen HTTPS) ----------

function certificado() {
  const dir = path.join(AQUI, ".cert");
  const clave = path.join(dir, "clave.pem");
  const cert = path.join(dir, "cert.pem");
  const marca = path.join(dir, "ips.txt");
  const firma = IPS.join(",");
  const vigente = existsSync(clave) && existsSync(cert) && existsSync(marca) &&
    readFileSync(marca, "utf8") === firma;
  if (!vigente) {
    mkdirSync(dir, { recursive: true });
    const san = ["DNS:localhost", "IP:127.0.0.1", ...IPS.map((ip) => `IP:${ip}`)].join(",");
    execFileSync("openssl", [
      "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "30",
      "-keyout", clave, "-out", cert,
      "-subj", "/CN=MANDO puntero",
      "-addext", `subjectAltName=${san}`,
    ], { stdio: "ignore" });
    execFileSync("sh", ["-c", 'printf %s "$1" > "$2"', "sh", firma, marca]);
  }
  return { key: readFileSync(clave), cert: readFileSync(cert) };
}

// ---------- Archivos que se sirven (lista cerrada) ----------

const MANDO = path.join(AQUI, "..", "public");
const ARCHIVOS = {
  "/": [path.join(AQUI, "public", "index.html"), "text/html; charset=utf-8"],
  "/puntero.js": [path.join(AQUI, "public", "puntero.js"), "text/javascript; charset=utf-8"],
  "/puntero.css": [path.join(AQUI, "public", "puntero.css"), "text/css; charset=utf-8"],
  "/mando/remote.js": [path.join(MANDO, "remote.js"), "text/javascript; charset=utf-8"],
  "/mando/remote.css": [path.join(MANDO, "remote.css"), "text/css; charset=utf-8"],
  "/mando/identidad.css": [path.join(MANDO, "identidad.css"), "text/css; charset=utf-8"],
};

function atender(req, res) {
  const ip = String(req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  res.on("finish", () => {
    const ruta = new URL(req.url, "https://x").pathname;
    console.log(`  [pedido] ${ip} ${req.method} ${ruta} -> ${res.statusCode}`);
  });
  if (!esPrivada(req.socket.remoteAddress || "")) {
    res.writeHead(403).end();
    return;
  }
  const ruta = new URL(req.url, "https://x").pathname;
  if (req.method === "POST" && (ruta === "/m" || ruta === "/chau")) {
    atenderPost(req, res, ruta);
    return;
  }
  const archivo = ARCHIVOS[ruta];
  if (req.method !== "GET" || !archivo) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("No existe");
    return;
  }
  try {
    res.writeHead(200, {
      "content-type": archivo[1],
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    });
    res.end(readFileSync(archivo[0]));
  } catch {
    res.writeHead(500).end();
  }
}

// ---------- Cursor (ayudante en Swift) ----------

let ayudante = null;
let accesibilidad = false;
let cerrando = false;
let arrancado = false;

function arrancarAyudante() {
  ayudante = spawn(path.join(AQUI, "cursor"), [], { stdio: ["pipe", "pipe", "inherit"] });
  ayudante.stdout.setEncoding("utf8");
  ayudante.stdout.on("data", (t) => {
    const antes = accesibilidad;
    if (t.includes("accesibilidad=si")) accesibilidad = true;
    if (t.includes("accesibilidad=no")) accesibilidad = false;
    if (accesibilidad && !antes && arrancado) {
      console.log("  Clics: habilitados. ✔");
      if (cliente) cliente.send(JSON.stringify({ t: "hola", clics: true }));
    }
    arrancado = true;
  });
  ayudante.on("exit", () => {
    ayudante = null;
    if (!cerrando) setTimeout(arrancarAyudante, 300);
  });
}

// Se vuelve a preguntar cada tanto: si el usuario da el permiso, los clics arrancan sin reiniciar.
setInterval(() => alCursor("e"), 2500).unref();

function alCursor(linea) {
  if (ayudante && ayudante.stdin.writable) ayudante.stdin.write(linea + "\n");
}

// ---------- Volumen de la Mac (lista cerrada de acciones) ----------

const ACCIONES = {
  VOL_UP: [
    "set v to (output volume of (get volume settings)) + 6",
    "if v > 100 then set v to 100",
    "set volume output volume v",
  ],
  VOL_DOWN: [
    "set v to (output volume of (get volume settings)) - 6",
    "if v < 0 then set v to 0",
    "set volume output volume v",
  ],
  MUTE: ["set volume output muted (not (output muted of (get volume settings)))"],
};
const LEER_VOLUMEN =
  'set s to (get volume settings)\nreturn ((output volume of s) as text) & "," & ((output muted of s) as text)';

function osa(lineas) {
  const args = lineas.flatMap((l) => ["-e", l]);
  return new Promise((ok) => {
    execFile("osascript", args, { timeout: 3000 }, (err, salida) => ok(err ? null : salida.trim()));
  });
}

async function accion(nombre) {
  await osa(ACCIONES[nombre]);
  const s = await osa([LEER_VOLUMEN]);
  if (!s) return null;
  const [v, m] = s.split(",");
  return { v: Number(v), m: m === "true" };
}

// ---------- WebSocket ----------

function tokenValido(t) {
  if (typeof t !== "string" || t.length !== TOKEN.length) return false;
  return timingSafeEqual(Buffer.from(t), Buffer.from(TOKEN));
}

const servidor = https.createServer(certificado(), atender);
servidor.on("tlsClientError", (err, socket) => {
  console.log(`  [tls] ${String(socket.remoteAddress || "?").replace(/^::ffff:/, "")}: ${err.code || err.message}`);
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 256, perMessageDeflate: false });
let cliente = null;

servidor.on("upgrade", (req, socket, cabeza) => {
  const url = new URL(req.url, "https://x");
  const origen = req.headers.origin || "";
  let mismoOrigen = false;
  try {
    mismoOrigen = new URL(origen).host === req.headers.host;
  } catch {
    mismoOrigen = false;
  }
  const permitido =
    url.pathname === "/ws" &&
    esPrivada(req.socket.remoteAddress || "") &&
    mismoOrigen &&
    tokenValido(url.searchParams.get("t"));
  if (!permitido) {
    console.log(`  [rechazo] conexión de ${String(req.socket.remoteAddress).replace(/^::ffff:/, "")} sin código válido`);
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, cabeza, (ws) => conectar(ws, req.socket.remoteAddress));
});

const num = (n) => typeof n === "number" && Number.isFinite(n);
const TECLAS = new Set(["izq", "der", "arr", "aba", "espacio", "esc", "enter"]);

// Tope de mensajes por segundo, compartido por el teléfono que tenga el control.
let ventana = Date.now();
let cuenta = 0;
let ocupado = false;

// Única puerta de entrada de órdenes. Lista cerrada: todo lo demás se ignora.
async function procesar(m) {
  const ahora = Date.now();
  if (ahora - ventana > 1000) {
    ventana = ahora;
    cuenta = 0;
  }
  if (++cuenta > 240) return null;
  if (!m || typeof m !== "object" || Array.isArray(m)) return null;

  switch (m.t) {
    case "m":
      if (num(m.x) && num(m.y) && Math.abs(m.x) <= 400 && Math.abs(m.y) <= 400) {
        alCursor(`m ${m.x.toFixed(2)} ${m.y.toFixed(2)}`);
      }
      return null;
    case "c":
      alCursor("c");
      return null;
    case "r":
      alCursor("r");
      return null;
    case "z":
      alCursor("z");
      return null;
    case "s":
      if (num(m.y) && Math.abs(m.y) <= 300) alCursor(`s ${m.y.toFixed(1)}`);
      return null;
    case "k":
      if (typeof m.n === "string" && TECLAS.has(m.n)) alCursor(`k ${m.n}`);
      return null;
    case "a":
      if (typeof m.n === "string" && Object.hasOwn(ACCIONES, m.n) && !ocupado) {
        ocupado = true;
        const estado = await accion(m.n);
        ocupado = false;
        return estado ? { t: "vol", ...estado } : null;
      }
      return null;
    default:
      return null;
  }
}

function conectar(ws, ip) {
  // Un solo teléfono a la vez: el nuevo reemplaza al anterior.
  if (cliente) cliente.close(4000, "reemplazado");
  cliente = ws;
  porPost = null;
  console.log(`\n  Teléfono conectado (${String(ip).replace(/^::ffff:/, "")}).`);
  ws.send(JSON.stringify({ t: "hola", clics: accesibilidad }));

  ws.on("message", async (crudo, esBinario) => {
    if (esBinario) return;
    let m;
    try {
      m = JSON.parse(crudo.toString());
    } catch {
      return;
    }
    const respuesta = await procesar(m);
    if (respuesta && ws.readyState === ws.OPEN) ws.send(JSON.stringify(respuesta));
  });

  ws.on("close", () => {
    if (cliente === ws) {
      cliente = null;
      console.log("  Teléfono desconectado.");
    }
  });
  ws.on("error", () => {});
}

// ---------- Respaldo por POST (si el teléfono no deja abrir el WebSocket) ----------

let porPost = null; // { id, visto }
const SIN_SENAL = 6000;
setInterval(() => {
  if (porPost && Date.now() - porPost.visto > SIN_SENAL) {
    porPost = null;
    console.log("  Teléfono desconectado (sin señal).");
  }
}, 2000).unref();

function atenderPost(req, res, ruta) {
  let mismoOrigen = false;
  try {
    mismoOrigen = new URL(req.headers.origin || "").host === req.headers.host;
  } catch {
    mismoOrigen = false;
  }
  const id = String(req.headers["x-id"] || "");
  if (!mismoOrigen || !tokenValido(req.headers["x-token"]) || !/^[a-z0-9]{8,32}$/.test(id)) {
    res.writeHead(401).end();
    return;
  }
  if (ruta === "/chau") {
    if (porPost && porPost.id === id) {
      porPost = null;
      console.log("  Teléfono desconectado.");
    }
    res.writeHead(204).end();
    return;
  }
  const ahora = Date.now();
  if (cliente || (porPost && porPost.id !== id && ahora - porPost.visto < SIN_SENAL)) {
    res.writeHead(409).end();
    return;
  }
  if (!porPost || porPost.id !== id) {
    console.log(`\n  Teléfono conectado en modo de respaldo (${String(req.socket.remoteAddress).replace(/^::ffff:/, "")}).`);
  }
  porPost = { id, visto: ahora };
  let cuerpo = "";
  req.on("data", (c) => {
    cuerpo += c;
    if (cuerpo.length > 4096) req.destroy();
  });
  req.on("end", async () => {
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
    const salida = { clics: accesibilidad };
    for (const m of lista) {
      const r = await procesar(m);
      if (r) salida.vol = r;
    }
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(salida));
  });
}

// ---------- Pantalla de la Mac con el QR grande (solo se ve desde esta compu) ----------

const QRCode = createRequire(import.meta.url)("qrcode-terminal/vendor/QRCode");
const NivelQR = createRequire(import.meta.url)("qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel");

function qrSvg(texto) {
  const qr = new QRCode(-1, NivelQR.M);
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  let d = "";
  for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) if (qr.modules[f][c]) d += `M${c + 2} ${f + 2}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 4} ${n + 4}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#F5F4EE"/><path d="${d}" fill="#101522"/></svg>`;
}

let PUERTO_PANTALLA = 0;
const pantalla = http.createServer((req, res) => {
  // Solo esta compu, y solo con el nombre correcto (evita que otra página web lo lea).
  const anfitrion = String(req.headers.host || "");
  const local = req.socket.remoteAddress === "127.0.0.1" || req.socket.remoteAddress === "::ffff:127.0.0.1";
  if (!local || (anfitrion !== `localhost:${PUERTO_PANTALLA}` && anfitrion !== `127.0.0.1:${PUERTO_PANTALLA}`)) {
    res.writeHead(403).end();
    return;
  }
  const ruta = new URL(req.url, "http://x").pathname;
  if (process.env.PRUEBA === "1" && (ruta === "/prueba" || ARCHIVOS[ruta] && ruta !== "/" || req.method === "POST")) {
    // Modo prueba: la página del teléfono también por HTTP local, para probar sin certificado.
    if (ruta === "/prueba") req.url = "/";
    atender(req, res);
    return;
  }
  if (req.method !== "GET") {
    res.writeHead(404).end();
    return;
  }
  if (ruta === "/estado") {
    const lista = enlaces();
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({
      enlaces: lista,
      qr: lista[0] ? qrSvg(lista[0]) : "",
      conectado: Boolean(cliente || porPost),
      clics: accesibilidad,
    }));
    return;
  }
  if (ruta === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(readFileSync(path.join(AQUI, "public", "pantalla.html")));
    return;
  }
  res.writeHead(404).end();
});
if (process.env.PRUEBA === "1") {
  pantalla.on("upgrade", (req, socket, cabeza) => servidor.emit("upgrade", req, socket, cabeza));
}

// ---------- Arranque y corte ----------

function cortar() {
  cerrando = true;
  if (cliente) cliente.close(4001, "cerrado");
  if (ayudante) ayudante.kill();
  servidor.close();
  pantalla.close();
  console.log("\n  Puntero apagado.");
  process.exit(0);
}
process.on("SIGINT", cortar);
process.on("SIGTERM", cortar);

if (!existsSync(path.join(AQUI, "cursor"))) {
  console.log("  Compilando el ayudante del cursor (solo la primera vez)…");
  try {
    execFileSync("swiftc", ["-O", path.join(AQUI, "cursor.swift"), "-o", path.join(AQUI, "cursor")], { stdio: "inherit" });
  } catch {
    console.error("No pude compilar el ayudante. Corré: npm run compilar");
    process.exit(1);
  }
}
arrancarAyudante();

servidor.on("error", (e) => {
  if (e.code === "EADDRINUSE" && !process.env.PUERTO && PUERTO < 8460) {
    PUERTO += 1;
    servidor.listen(PUERTO, "0.0.0.0");
    return;
  }
  console.error(`No pude abrir el puerto ${PUERTO}: ${e.message}`);
  process.exit(1);
});

servidor.on("listening", () => {
  const lista = enlaces();
  console.log("\n  MANDO · puntero con el teléfono\n");
  if (lista.length === 0) {
    console.log("  No encontré una red local. Conectá la Mac a una Wi-Fi o al hotspot del teléfono;");
    console.log("  el QR de la pantalla se actualiza solo cuando haya red.\n");
  } else {
    console.log("  Escaneá este QR con el teléfono (misma Wi-Fi que la Mac):\n");
    qrcode.generate(lista[0], { small: true }, (qr) => console.log(qr.replace(/^/gm, "  ")));
    for (const e of lista) console.log(`  ${e}`);
  }
  console.log("\n  El teléfono va a mostrar un aviso de seguridad: tocá Avanzado y continuar.");

  // Pantalla con el QR grande, solo en esta compu.
  pantalla.on("error", () => console.log("  (No pude abrir la pantalla del QR; usá el QR de arriba.)"));
  pantalla.listen(0, "127.0.0.1", () => {
    PUERTO_PANTALLA = pantalla.address().port;
    const dir = `http://localhost:${PUERTO_PANTALLA}/`;
    console.log(`  QR grande para mostrar: ${dir}`);
    if (process.env.PRUEBA === "1") console.log(`  (modo prueba) ${dir}prueba#t=${TOKEN}`);
    if (process.env.SIN_PANTALLA !== "1") execFile("open", [dir], () => {});
  });

  setTimeout(() => {
    if (accesibilidad) {
      console.log("  Clics: habilitados.");
    } else {
      console.log("  Clics: todavía NO. El cursor se mueve igual. macOS te va a mostrar un cartel:");
      console.log("  abrí Ajustes del Sistema → Privacidad y seguridad → Accesibilidad y activá la app que nombra.");
      console.log("  No hace falta reiniciar: apenas lo actives, los clics empiezan a andar.");
      if (process.env.SIN_PANTALLA !== "1") alCursor("pedir");
    }
    console.log("  Para cortar: Ctrl+C\n");
  }, 600);
});
servidor.listen(PUERTO, "0.0.0.0");
