// Puntero: el teléfono mueve el cursor de esta Mac.
// HTTPS + WebSocket seguro, token por arranque, un solo teléfono, lista cerrada de órdenes.
import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import qrcode from 'qrcode-terminal';

const DIR = path.dirname(fileURLToPath(import.meta.url));
let PORT = Number(process.env.PORT) || 8765;
const TOKEN = crypto.randomBytes(16).toString('hex');
const MAX_STEP = 400; // píxeles máximos por mensaje
const IDLE_MS = 6000; // sin noticias del teléfono => se libera el lugar

// ---------- direcciones ----------
function isPrivate(addr = '') {
  const a = addr.replace(/^::ffff:/, '');
  if (a === '::1' || a.startsWith('127.')) return true;
  if (a.startsWith('10.') || a.startsWith('192.168.') || a.startsWith('169.254.')) return true;
  const m = a.match(/^172\.(\d+)\./);
  if (m && +m[1] >= 16 && +m[1] <= 31) return true;
  return /^f[cd][0-9a-f]{2}:/i.test(a) || /^fe80:/i.test(a);
}
function lanIPs() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces()))
    for (const i of list || [])
      if (i.family === 'IPv4' && !i.internal && isPrivate(i.address)) out.push([name, i.address]);
  // Primero la Wi-Fi (en0/en1); los puentes y redes virtuales al final.
  const peso = (n) => (/^en\d+$/.test(n) ? 0 : 1);
  return out.sort((a, b) => peso(a[0]) - peso(b[0]) || a[0].localeCompare(b[0])).map((x) => x[1]);
}

// ---------- certificado autofirmado ----------
function ensureCert(ips) {
  const dir = path.join(DIR, '.cert');
  const key = path.join(dir, 'key.pem');
  const crt = path.join(dir, 'cert.pem');
  const stamp = path.join(dir, 'ips.txt');
  const want = ips.join(',');
  if (!(fs.existsSync(key) && fs.existsSync(crt) && fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === want)) {
    fs.mkdirSync(dir, { recursive: true });
    const san = ['DNS:localhost', 'IP:127.0.0.1', ...ips.map((ip) => `IP:${ip}`)].join(',');
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '30',
      '-keyout', key, '-out', crt, '-subj', '/CN=MANDO Puntero',
      '-addext', `subjectAltName=${san}`,
    ], { stdio: 'ignore' });
    fs.writeFileSync(stamp, want);
  }
  return { key: fs.readFileSync(key), cert: fs.readFileSync(crt) };
}

// ---------- ayudante que mueve el cursor ----------
const helperBin = path.join(DIR, 'helper', 'cursor');
if (!fs.existsSync(helperBin)) {
  console.log('Compilando el ayudante del cursor (solo la primera vez)…');
  execFileSync('swiftc', ['-O', path.join(DIR, 'helper', 'cursor.swift'), '-o', helperBin], { stdio: 'inherit' });
}
const helper = spawn(helperBin, [], { stdio: ['pipe', 'pipe', 'inherit'] });
let trusted = null;
helper.stdout.on('data', (d) => {
  const m = String(d).match(/trusted=(true|false)/);
  if (m) {
    trusted = m[1] === 'true';
    if (!trusted) {
      console.log('\n⚠️  Falta el permiso de Accesibilidad: el cursor se MUEVE, pero los CLICS no van a andar.');
      console.log('   Ajustes del Sistema → Privacidad y seguridad → Accesibilidad → activá la app');
      console.log('   desde la que arrancaste esto (Terminal, iTerm, Claude…) y volvé a arrancar.\n');
    }
  }
});
helper.on('exit', () => { console.log('El ayudante del cursor se cerró. Chau.'); process.exit(1); });
const send = (line) => helper.stdin.write(line + '\n');

// ---------- órdenes permitidas (lista cerrada) ----------
let lastClick = 0;
function handle(msg) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return false;
  switch (msg.t) {
    case 'm': {
      const { dx, dy } = msg;
      if (typeof dx !== 'number' || typeof dy !== 'number' || !Number.isFinite(dx) || !Number.isFinite(dy)) return false;
      if (Math.abs(dx) > MAX_STEP || Math.abs(dy) > MAX_STEP) return false;
      send(`m ${dx.toFixed(2)} ${dy.toFixed(2)}`);
      return true;
    }
    case 'c':
    case 'r': {
      const now = Date.now();
      if (now - lastClick < 80) return true; // freno: máx. ~12 clics por segundo
      lastClick = now;
      send(msg.t);
      return true;
    }
    case 'z': send('z'); return true;
    case 'k': return true; // "sigo acá"
    default: return false;
  }
}
function parse(text) {
  if (typeof text !== 'string' || text.length > 4096) return null;
  try { return JSON.parse(text); } catch { return null; }
}
function tokenOk(t) {
  if (typeof t !== 'string' || t.length !== TOKEN.length) return false;
  return crypto.timingSafeEqual(Buffer.from(t), Buffer.from(TOKEN));
}

// ---------- un solo teléfono ----------
let active = null; // { id, ws|null, seen }
function claim(id, ws = null) {
  const now = Date.now();
  if (active && active.id !== id && now - active.seen < IDLE_MS) return false;
  if (!active || active.id !== id) console.log('📱 Teléfono conectado.');
  active = { id, ws, seen: now };
  return true;
}
function release(id, why = '') {
  if (active && active.id === id) { active = null; console.log(`📴 Teléfono desconectado. ${why}`); }
}
setInterval(() => {
  if (active && !active.ws && Date.now() - active.seen > IDLE_MS) release(active.id, '(sin señal)');
}, 2000).unref();

// ---------- HTTPS ----------
const ips = lanIPs();
const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/puntero.js': ['puntero.js', 'text/javascript; charset=utf-8'],
  '/puntero.css': ['puntero.css', 'text/css; charset=utf-8'],
};
const onRequest = (req, res) => {
  if (!isPrivate(req.socket.remoteAddress)) { res.writeHead(403).end(); return; }
  const url = new URL(req.url, 'https://x');
  // Plan B si el navegador no deja abrir el WebSocket: mismas órdenes por POST.
  if (req.method === 'POST' && (url.pathname === '/m' || url.pathname === '/bye')) {
    const id = String(req.headers['x-id'] || '');
    if (!tokenOk(req.headers['x-token']) || !/^[a-z0-9]{8,32}$/.test(id)) { res.writeHead(401).end(); return; }
    if (url.pathname === '/bye') { release(id, '(botón Desconectar)'); res.writeHead(204).end(); return; }
    if (!claim(id)) { res.writeHead(409).end(); return; }
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 8192) req.destroy(); });
    req.on('end', () => {
      const list = parse(body);
      if (!Array.isArray(list) || list.length > 64) { res.writeHead(400).end(); return; }
      for (const m of list) handle(m);
      res.writeHead(204).end();
    });
    return;
  }
  const hit = req.method === 'GET' && STATIC[url.pathname];
  if (!hit) { res.writeHead(404).end('No existe'); return; }
  res.writeHead(200, { 'Content-Type': hit[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(path.join(DIR, 'public', hit[0])).pipe(res);
};
const server = https.createServer(ensureCert(ips), onRequest);

// ---------- WebSocket ----------
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
const onUpgrade = (req, socket, head) => {
  const url = new URL(req.url, 'https://x');
  const id = url.searchParams.get('id') || '';
  const deny = (code, text) => { socket.write(`HTTP/1.1 ${code} ${text}\r\n\r\n`); socket.destroy(); };
  if (!isPrivate(req.socket.remoteAddress)) return deny(403, 'Forbidden');
  if (url.pathname !== '/ws' || !tokenOk(url.searchParams.get('t')) || !/^[a-z0-9]{8,32}$/.test(id)) return deny(401, 'Unauthorized');
  if (active && active.id !== id && (active.ws || Date.now() - active.seen < IDLE_MS)) return deny(409, 'Busy');
  wss.handleUpgrade(req, socket, head, (ws) => {
    claim(id, ws);
    ws.send(JSON.stringify({ t: 'hola', clics: trusted !== false }));
    let bad = 0;
    ws.on('message', (data, isBinary) => {
      if (active) active.seen = Date.now();
      if (isBinary || !handle(parse(String(data)))) { if (++bad > 20) ws.close(1008, 'mensajes inválidos'); }
    });
    ws.on('close', () => release(id));
    ws.on('error', () => {});
  });
};
server.on('upgrade', onUpgrade);

// Solo para probar desde esta misma compu sin certificado: PRUEBA=1 abre HTTP en 127.0.0.1.
if (process.env.PRUEBA === '1') {
  const local = http.createServer(onRequest);
  local.on('upgrade', onUpgrade);
  local.listen(8799, '127.0.0.1', () => console.log(`(modo prueba) http://localhost:8799/#t=${TOKEN}`));
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE' && PORT < 8790) { PORT += 1; server.listen(PORT, '0.0.0.0'); return; }
  console.error('No pude abrir el puerto:', e.message); process.exit(1);
});
server.on('listening', () => {
  const hosts = ips.length ? ips : ['localhost'];
  const urls = hosts.map((h) => `https://${h}:${PORT}/#t=${TOKEN}`);
  console.log('\n🎯 MANDO · Puntero listo.\n');
  console.log('Escaneá este QR con la cámara del teléfono (misma red Wi-Fi que la Mac):\n');
  qrcode.generate(urls[0], { small: true });
  for (const u of urls) console.log('  ' + u);
  console.log(`\nPrueba en esta compu: https://localhost:${PORT}/#t=${TOKEN}`);
  console.log('El teléfono va a mostrar una advertencia de certificado: tocá "Avanzado" → "Continuar".');
  console.log('Para cortar todo: Ctrl+C.\n');
});
server.listen(PORT, '0.0.0.0');

function bye() {
  console.log('\nCortando…');
  try { send('q'); } catch {}
  for (const c of wss.clients) c.terminate();
  server.close();
  process.exit(0);
}
process.on('SIGINT', bye);
process.on('SIGTERM', bye);
