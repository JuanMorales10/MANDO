// Página del teléfono: el mando de MANDO + un puntero.
// Manda al puente solo mensajes de una lista cerrada:
//   {t:"m",x,y} mover · {t:"c"} clic · {t:"r"} clic derecho · {t:"z"} centrar
//   {t:"s",y} rueda · {t:"k",n:"izq"|"der"|...} tecla para pasar diapositivas
//   {t:"a",n:"VOL_UP"|"VOL_DOWN"|"MUTE"} acción del mando

import { mountRemote } from "./mando/remote.js";

const $ = (id) => document.getElementById(id);
const estado = $("estado");
const aviso = $("aviso");
const volumen = $("volumen");
const pad = $("pad");
const activar = $("activar");

// El código viene en el QR, después del # (así no viaja en los pedidos de la página).
const token = new URLSearchParams(location.hash.slice(1)).get("t") ||
  new URLSearchParams(location.search).get("t") || "";
const ID = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => (b % 36).toString(36)).join("");

// ---------- Conexión ----------

let ws = null;
let reintento = 0;
let fallosWs = 0;
let modoPost = false; // respaldo: si el WebSocket no abre, las mismas órdenes van por POST
let cortado = false;

function ponerEstado(clave, texto) {
  estado.dataset.estado = clave;
  estado.textContent = texto;
}

function alRecibir(m) {
  if (!m) return;
  if (m.t === "vol") {
    volumen.textContent = m.m ? `Mac en silencio (volumen ${m.v})` : `Volumen de la Mac: ${m.v}`;
  }
  if (m.t === "hola") {
    $("sin-clics").hidden = m.clics !== false;
  }
}

function conectar() {
  if (cortado) return;
  if (!token) {
    ponerEstado("sin", "Falta el código");
    aviso.textContent = "Abrí la página escaneando el QR de la compu.";
    return;
  }
  if (modoPost) return;
  const esquema = location.protocol === "http:" ? "ws" : "wss";
  let abrio = false;
  ws = new WebSocket(`${esquema}://${location.host}/ws?t=${encodeURIComponent(token)}`);
  ws.onopen = () => {
    abrio = true;
    reintento = 0;
    fallosWs = 0;
    ponerEstado("ok", "Conectado");
  };
  ws.onmessage = (e) => {
    try {
      alRecibir(JSON.parse(e.data));
    } catch {
      /* mensaje raro: se ignora */
    }
  };
  ws.onclose = (e) => {
    ws = null;
    if (cortado) return;
    if (e.code === 4000) {
      ponerEstado("sin", "Otro teléfono tomó el control");
      return;
    }
    if (e.code === 4001) {
      ponerEstado("sin", "La compu cortó");
      return;
    }
    ponerEstado("sin", "Sin conexión");
    if (!abrio && ++fallosWs >= 2) {
      probarPost();
      return;
    }
    reintento = Math.min(reintento + 1, 6);
    setTimeout(conectar, 400 * reintento);
  };
  ws.onerror = () => {};
}

// ----- Respaldo por POST -----

let cola = [];
let enviando = false;
let ultimoPost = 0;

async function post(lista) {
  const r = await fetch("/m", {
    method: "POST",
    headers: { "x-token": token, "x-id": ID },
    body: JSON.stringify(lista),
  });
  ultimoPost = performance.now();
  if (r.status === 401) throw new Error("Código vencido: escaneá el QR otra vez");
  if (r.status === 409) throw new Error("Otro teléfono tiene el control");
  if (!r.ok) throw new Error("Sin conexión");
  const datos = await r.json();
  alRecibir({ t: "hola", clics: datos.clics });
  alRecibir(datos.vol);
}

async function probarPost() {
  try {
    await post([]);
    modoPost = true;
    ponerEstado("ok", "Conectado");
  } catch (e) {
    ponerEstado("sin", e.message);
    fallosWs = 0;
    setTimeout(conectar, 2000);
  }
}

async function vaciarCola() {
  if (enviando || !modoPost) return;
  enviando = true;
  while (cola.length && modoPost) {
    const lote = cola.splice(0, 16);
    try {
      await post(lote);
    } catch (e) {
      modoPost = false;
      cola = [];
      ponerEstado("sin", e.message);
      fallosWs = 0;
      setTimeout(conectar, 2000);
    }
  }
  enviando = false;
}
// "Sigo acá", para que la compu no dé por perdido al teléfono.
setInterval(() => {
  if (modoPost && !enviando && performance.now() - ultimoPost > 2500) {
    cola.push({ t: "x" });
    vaciarCola();
  }
}, 1000);

function enviar(m) {
  if (cortado) return;
  if (modoPost) {
    const ult = cola[cola.length - 1];
    if (ult && ult.t === m.t && (m.t === "m" || m.t === "s")) {
      if (m.t === "m") ult.x = Math.max(-400, Math.min(400, ult.x + m.x));
      ult.y = Math.max(m.t === "m" ? -400 : -300, Math.min(m.t === "m" ? 400 : 300, ult.y + m.y));
    } else if (cola.length < 64) {
      cola.push({ ...m });
    }
    vaciarCola();
    return;
  }
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
}

// ---------- Mando ----------

mountRemote($("mando-root"), (accion) => {
  enviar({ t: "a", n: accion });
  if (navigator.vibrate) navigator.vibrate(12);
});

// ---------- Ajustes ----------

const guardados = (() => {
  try {
    return JSON.parse(localStorage.getItem("mando-puntero-v1")) || {};
  } catch {
    return {};
  }
})();
const ajustes = { velocidad: 22, apretar: false, invX: false, invY: false, ...guardados };

function guardar() {
  try {
    localStorage.setItem("mando-puntero-v1", JSON.stringify(ajustes));
  } catch {
    /* sin almacenamiento, sigue andando */
  }
}

$("velocidad").value = ajustes.velocidad;
$("velocidad-valor").textContent = ajustes.velocidad;
$("apretar").checked = ajustes.apretar;
$("inv-x").checked = ajustes.invX;
$("inv-y").checked = ajustes.invY;

$("velocidad").oninput = (e) => {
  ajustes.velocidad = Number(e.target.value);
  $("velocidad-valor").textContent = ajustes.velocidad;
  guardar();
};
$("apretar").onchange = (e) => {
  ajustes.apretar = e.target.checked;
  guardar();
};
$("inv-x").onchange = (e) => {
  ajustes.invX = e.target.checked;
  guardar();
};
$("inv-y").onchange = (e) => {
  ajustes.invY = e.target.checked;
  guardar();
};

// ---------- Envío de movimiento, agrupado por cuadro ----------

let accX = 0;
let accY = 0;
let accRueda = 0;

function vaciar() {
  if (Math.abs(accX) >= 0.5 || Math.abs(accY) >= 0.5) {
    const x = Math.max(-400, Math.min(400, accX));
    const y = Math.max(-400, Math.min(400, accY));
    enviar({ t: "m", x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    accX = 0;
    accY = 0;
  }
  if (Math.abs(accRueda) >= 2) {
    enviar({ t: "s", y: Math.round(Math.max(-300, Math.min(300, accRueda))) });
    accRueda = 0;
  }
  requestAnimationFrame(vaciar);
}
requestAnimationFrame(vaciar);

// ---------- Puntero por movimiento del teléfono ----------

const esIOS = typeof DeviceMotionEvent !== "undefined" &&
  typeof DeviceMotionEvent.requestPermission === "function";

let giroActivo = false;
let apoyado = false;
let ultimo = 0;
let suaveX = 0;
let suaveY = 0;
let llegaronDatos = false;

const ZONA_MUERTA = 0.8; // grados por segundo: por debajo de esto no se mueve
const SUAVIZADO = 0.45;

function alMoverse(e) {
  const r = e.rotationRate;
  if (!r || r.alpha == null) return;
  llegaronDatos = true;

  const ahora = performance.now();
  const dt = Math.min(0.05, ultimo ? (ahora - ultimo) / 1000 : 0);
  ultimo = ahora;
  if (!giroActivo || dt === 0) return;
  if (ajustes.apretar && !apoyado) {
    suaveX = 0;
    suaveY = 0;
    return;
  }

  // Giro del teléfono en sus propios ejes (grados por segundo).
  // Los navegadores entregan: alpha = giro sobre el eje X del teléfono (cabecear),
  // beta = sobre el eje Y (rolar) y gamma = sobre el eje Z (girar acostado).
  const wx = r.alpha || 0;
  const wy = r.beta || 0;
  const wz = r.gamma || 0;

  // Giro a izquierda/derecha = giro alrededor de la vertical real (la gravedad),
  // así funciona con el teléfono acostado o parado.
  const g = e.accelerationIncludingGravity;
  let giroLateral = wz;
  if (g && g.x != null) {
    const largo = Math.hypot(g.x, g.y, g.z);
    if (largo > 1) giroLateral = (wx * g.x + wy * g.y + wz * g.z) / largo;
    if (esIOS) giroLateral = -giroLateral; // iOS informa la gravedad con el signo opuesto
  }
  let giroVertical = wx;

  if (Math.abs(giroLateral) < ZONA_MUERTA) giroLateral = 0;
  if (Math.abs(giroVertical) < ZONA_MUERTA) giroVertical = 0;

  suaveX += (giroLateral - suaveX) * SUAVIZADO;
  suaveY += (giroVertical - suaveY) * SUAVIZADO;

  const k = ajustes.velocidad * dt; // píxeles por grado girado
  accX += -suaveX * k * (ajustes.invX ? -1 : 1);
  accY += -suaveY * k * (ajustes.invY ? -1 : 1);
}

let bloqueo = null;
async function mantenerDespierto() {
  try {
    if ("wakeLock" in navigator) bloqueo = await navigator.wakeLock.request("screen");
  } catch {
    bloqueo = null;
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && giroActivo) mantenerDespierto();
});

function pintarActivar() {
  activar.dataset.activo = giroActivo ? "si" : "no";
  activar.textContent = giroActivo ? "Pausar puntero" : "Activar puntero";
}

activar.onclick = async () => {
  if (giroActivo) {
    giroActivo = false;
    pintarActivar();
    aviso.textContent = "Puntero en pausa.";
    return;
  }
  if (typeof DeviceMotionEvent === "undefined") {
    aviso.textContent = "Este navegador no da acceso al sensor de movimiento. Usá la zona táctil.";
    return;
  }
  try {
    if (esIOS) {
      const permiso = await DeviceMotionEvent.requestPermission();
      if (permiso !== "granted") {
        aviso.textContent = "Sin permiso de movimiento. Usá la zona táctil o volvé a intentar.";
        return;
      }
    }
  } catch {
    aviso.textContent = "No se pudo pedir el permiso de movimiento. Usá la zona táctil.";
    return;
  }
  window.removeEventListener("devicemotion", alMoverse);
  window.addEventListener("devicemotion", alMoverse);
  giroActivo = true;
  llegaronDatos = false;
  ultimo = 0;
  pintarActivar();
  mantenerDespierto();
  aviso.textContent = "Mové el teléfono como un puntero láser.";
  setTimeout(() => {
    if (giroActivo && !llegaronDatos) {
      aviso.textContent = "El sensor de movimiento no responde. Usá la zona táctil.";
    }
  }, 1500);
};

// ---------- Zona táctil: arrastrar mueve, toque corto hace clic ----------

let puntero = null;
const dedos = new Map(); // dedos apoyados en la zona táctil
let huboDos = false;

pad.addEventListener("pointerdown", (e) => {
  pad.setPointerCapture(e.pointerId);
  dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (dedos.size >= 2) huboDos = true;
  if (dedos.size === 1) {
    huboDos = false;
    puntero = { id: e.pointerId, inicio: performance.now(), recorrido: 0 };
  }
  apoyado = true;
  pad.dataset.apoyado = "si";
});

pad.addEventListener("pointermove", (e) => {
  const d = dedos.get(e.pointerId);
  if (!d) return;
  const dx = e.clientX - d.x;
  const dy = e.clientY - d.y;
  d.x = e.clientX;
  d.y = e.clientY;
  if (puntero) puntero.recorrido += Math.abs(dx) + Math.abs(dy);
  if (dedos.size >= 2) {
    // Dos dedos: rueda del mouse (como en un trackpad).
    accRueda += dy * 1.4;
    return;
  }
  // Con el puntero por movimiento activo, el dedo solo sirve de "embrague".
  if (!giroActivo) {
    const ganancia = ajustes.velocidad / 11;
    accX += dx * ganancia;
    accY += dy * ganancia;
  }
});

function soltar(e) {
  if (!dedos.delete(e.pointerId)) return;
  if (dedos.size > 0) return;
  const corto = puntero && performance.now() - puntero.inicio < 250 && puntero.recorrido < 10;
  puntero = null;
  apoyado = false;
  pad.dataset.apoyado = "no";
  if (corto && e.type === "pointerup") {
    enviar({ t: huboDos ? "r" : "c" }); // toque con dos dedos = clic derecho
    if (navigator.vibrate) navigator.vibrate(10);
  }
}
pad.addEventListener("pointerup", soltar);
pad.addEventListener("pointercancel", soltar);

for (const boton of document.querySelectorAll("[data-tecla]")) {
  boton.onclick = () => {
    enviar({ t: "k", n: boton.dataset.tecla });
    if (navigator.vibrate) navigator.vibrate(10);
  };
}
for (const boton of document.querySelectorAll("[data-rueda]")) {
  boton.onclick = () => enviar({ t: "s", y: Number(boton.dataset.rueda) });
}

$("cortar").onclick = () => {
  cortado = true;
  giroActivo = false;
  pintarActivar();
  if (modoPost) fetch("/chau", { method: "POST", headers: { "x-token": token, "x-id": ID }, keepalive: true }).catch(() => {});
  modoPost = false;
  if (ws) ws.close();
  if (bloqueo) bloqueo.release().catch(() => {});
  ponerEstado("sin", "Desconectado");
  aviso.textContent = "Cortaste la conexión. Para volver, recargá la página.";
};

$("clic").onclick = () => enviar({ t: "c" });
$("derecho").onclick = () => enviar({ t: "r" });
$("centrar").onclick = () => enviar({ t: "z" });

// ---------- Pestañas ----------

function irA(vista) {
  for (const b of document.querySelectorAll("[data-ir]")) b.setAttribute("aria-pressed", String(b.dataset.ir === vista));
  for (const s of document.querySelectorAll("[data-vista]")) s.hidden = s.dataset.vista !== vista;
  try {
    sessionStorage.setItem("mando-puntero-vista", vista);
  } catch {
    /* sin almacenamiento, sigue andando */
  }
}
for (const b of document.querySelectorAll("[data-ir]")) b.onclick = () => irA(b.dataset.ir);
try {
  const guardada = sessionStorage.getItem("mando-puntero-vista");
  if (guardada && document.querySelector(`[data-ir="${CSS.escape(guardada)}"]`)) irA(guardada);
} catch {
  /* sin almacenamiento, sigue andando */
}

conectar();
