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
    return JSON.parse(localStorage.getItem("mando-puntero-v2")) || {};
  } catch {
    return {};
  }
})();
const ajustes = { velocidad: 20, apretar: false, invX: false, invY: false, ...guardados };

function guardar() {
  try {
    localStorage.setItem("mando-puntero-v2", JSON.stringify(ajustes));
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
//
// El teléfono informa su velocidad de giro en tres ejes propios. En vez de suponer qué eje
// es "derecha" y cuál "arriba" (cambia según el teléfono y cómo lo agarres), se aprende con
// dos gestos: girar a la derecha y apuntar hacia arriba. Así la dirección nunca queda invertida.
//
// Además se usa la gravedad (el acelerómetro dice dónde está "abajo"): "derecha/izquierda" es
// siempre girar alrededor de la vertical, y "arriba/abajo" es girar alrededor de un eje
// horizontal. Así sigue andando bien aunque después agarres el teléfono más parado, más
// acostado o con la muñeca torcida, y no solo en la postura exacta de la calibración.

const esIOS = typeof DeviceMotionEvent !== "undefined" &&
  typeof DeviceMotionEvent.requestPermission === "function";

let giroActivo = false;
let apoyado = false;
let ultimo = 0;
let suaveX = 0;
let suaveY = 0;
let llegaronDatos = false;

const UMBRAL = 0.35; // grados por segundo que se descuentan: tapa el temblor del sensor en reposo

// ejes = { v: 3, x, y, sx, f }: x/y son los giros aprendidos (respaldo si no hay acelerómetro);
// sx es el signo de "derecha" respecto de la vertical; f es hacia dónde apunta el teléfono.
let ejes = ajustes.ejes && ajustes.ejes.v === 3 && Array.isArray(ajustes.ejes.x) && Array.isArray(ajustes.ejes.y)
  ? ajustes.ejes
  : null;
let grav = null; // vertical vista desde el teléfono (unitaria, suavizada)
let pausaHasta = 0;
let calibracion = null; // { paso: "derecha" | "quieto" | "arriba", suma: [x,y,z], quietoDesde, x }

const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const largo = (a) => Math.hypot(a[0], a[1], a[2]);
const unitario = (a) => {
  const l = largo(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sinVertical = (a, g) => {
  const c = punto(a, g);
  return [a[0] - c * g[0], a[1] - c * g[1], a[2] - c * g[2]];
};

function medirGravedad(e, dt) {
  const a = e.accelerationIncludingGravity;
  if (!a || a.x == null || a.y == null || a.z == null) return;
  const m = Math.hypot(a.x, a.y, a.z);
  if (m < 4 || m > 16) return; // sacudón o caída libre: esa lectura no sirve
  const u = [a.x / m, a.y / m, a.z / m];
  if (!grav) {
    grav = u;
    return;
  }
  const k = 1 - Math.exp(-dt / 0.12);
  grav = unitario([grav[0] + (u[0] - grav[0]) * k, grav[1] + (u[1] - grav[1]) * k, grav[2] + (u[2] - grav[2]) * k]);
}

// Velocidad hacia la derecha y hacia arriba, en grados por segundo.
function velocidades(w) {
  if (!grav || !ejes.f) return [punto(w, ejes.x), punto(w, ejes.y)];
  // Eje horizontal de "arriba/abajo": se arma con dos pistas que se cubren entre sí
  // (una aguanta que inclines el teléfono, la otra que tuerzas la muñeca).
  const a = sinVertical(ejes.y, grav);
  const b = cruz(ejes.f, grav);
  const p = [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const vy = largo(p) > 0.25 ? punto(w, unitario(p)) : punto(w, ejes.y);
  return [ejes.sx * punto(w, grav), vy];
}

function empezarCalibracion() {
  calibracion = { paso: "derecha", suma: [0, 0, 0], quietoDesde: 0, x: null };
  suaveX = 0;
  suaveY = 0;
  pintarCalibracion();
}

function pintarCalibracion() {
  const caja = $("calibrar-caja");
  if (!calibracion) {
    caja.hidden = true;
    return;
  }
  caja.hidden = false;
  const textos = {
    derecha: ["Paso 1 de 2", "Agarrá el teléfono como un control remoto y girálo hacia la DERECHA →"],
    quieto: ["¡Bien!", "Ahora dejalo quieto un instante…"],
    arriba: ["Paso 2 de 2", "Ahora apuntá hacia ARRIBA ↑"],
  };
  $("calibrar-paso").textContent = textos[calibracion.paso][0];
  $("calibrar-texto").textContent = textos[calibracion.paso][1];
}

function calibrar(w, dt, ahora) {
  const c = calibracion;
  const rapidez = largo(w);
  if (c.paso === "quieto") {
    if (rapidez > 12) c.quietoDesde = 0;
    else if (!c.quietoDesde) c.quietoDesde = ahora;
    else if (ahora - c.quietoDesde > 350) {
      c.paso = "arriba";
      c.suma = [0, 0, 0];
      pintarCalibracion();
    }
    return;
  }
  // Se junta el giro mientras el gesto es claro; con 14 grados girados alcanza.
  if (rapidez > 20) for (let i = 0; i < 3; i++) c.suma[i] += w[i] * dt;
  if (largo(c.suma) < 14) return;
  if (c.paso === "derecha") {
    const x = unitario(c.suma);
    if (grav && Math.abs(punto(x, grav)) < 0.45) {
      // Giró la muñeca o apuntó arriba/abajo: eso no es "derecha".
      c.suma = [0, 0, 0];
      $("calibrar-texto").textContent = "Ese giro no fue hacia el costado. Apuntá hacia la DERECHA →, como señalando una pared.";
      return;
    }
    c.x = x;
    c.g = grav ? grav.slice() : null;
    c.paso = "quieto";
    c.quietoDesde = 0;
    if (navigator.vibrate) navigator.vibrate(20);
    pintarCalibracion();
    return;
  }
  // "Arriba" tiene que ser un giro distinto al de "derecha"; se le quita lo que tenga en común.
  const crudo = unitario(c.suma);
  const comun = punto(crudo, c.x);
  if (Math.abs(comun) > 0.8) {
    c.suma = [0, 0, 0];
    $("calibrar-texto").textContent = "Ese giro se pareció al anterior. Apuntá hacia ARRIBA ↑ (como mirando el techo).";
    return;
  }
  let y = unitario([crudo[0] - comun * c.x[0], crudo[1] - comun * c.x[1], crudo[2] - comun * c.x[2]]);
  let sx = 0;
  let f = null;
  const g = grav || c.g;
  if (g) {
    const plano = sinVertical(crudo, g);
    if (largo(plano) < 0.45) {
      c.suma = [0, 0, 0];
      $("calibrar-texto").textContent = "Ese giro se pareció al anterior. Apuntá hacia ARRIBA ↑ (como mirando el techo).";
      return;
    }
    y = unitario(plano);
    sx = punto(c.x, c.g || g) >= 0 ? 1 : -1;
    f = unitario(cruz(g, y)); // así cruz(f, g) vuelve a dar "y" en esta misma postura
  }
  ejes = { v: 3, x: c.x, y, sx, f };
  ajustes.ejes = ejes;
  ajustes.invX = false;
  ajustes.invY = false;
  $("inv-x").checked = false;
  $("inv-y").checked = false;
  guardar();
  calibracion = null;
  pintarCalibracion();
  if (navigator.vibrate) navigator.vibrate([20, 60, 20]);
  // Medio segundo de gracia para volver al frente; después el cursor arranca desde el centro.
  pausaHasta = performance.now() + 600;
  setTimeout(() => enviar({ t: "z" }), 550);
  aviso.textContent = "Listo. Mové el teléfono: despacio es fino, rápido cruza la pantalla.";
}

function alMoverse(e) {
  const r = e.rotationRate;
  if (!r || r.alpha == null) return;
  llegaronDatos = true;

  const ahora = performance.now();
  const dt = Math.min(0.05, ultimo ? (ahora - ultimo) / 1000 : 0);
  ultimo = ahora;
  if (dt > 0) medirGravedad(e, dt);
  if (!giroActivo || dt === 0) return;

  const w = [r.alpha || 0, r.beta || 0, r.gamma || 0]; // grados por segundo
  if (calibracion) {
    calibrar(w, dt, ahora);
    return;
  }
  if (!ejes || ahora < pausaHasta) return;
  if (ajustes.apretar && !apoyado) {
    suaveX = 0;
    suaveY = 0;
    return;
  }

  let [vx, vy] = velocidades(w); // positivo = hacia la derecha / hacia arriba
  vx = Math.sign(vx) * Math.max(0, Math.abs(vx) - UMBRAL);
  vy = Math.sign(vy) * Math.max(0, Math.abs(vy) - UMBRAL);

  // Suavizado que se adapta: firme cuando vas despacio (no tiembla), suelto cuando vas rápido (no se atrasa).
  const rapidez = Math.hypot(vx, vy);
  const mezcla = Math.max(0.25, Math.min(0.85, rapidez / 60));
  suaveX += (vx - suaveX) * mezcla;
  suaveY += (vy - suaveY) * mezcla;

  // Aceleración: despacio = movimiento fino para apuntar; rápido = cruza la pantalla.
  const v = Math.hypot(suaveX, suaveY);
  const curva = Math.max(0.3, Math.min(1.8, Math.pow(v / 45, 0.65)));
  const k = ajustes.velocidad * curva * dt; // píxeles por grado girado
  accX += suaveX * k * (ajustes.invX ? -1 : 1);
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
    calibracion = null;
    pintarCalibracion();
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
  if (ejes) {
    aviso.textContent = "Mové el teléfono: despacio es fino, rápido cruza la pantalla.";
  } else {
    aviso.textContent = "";
    empezarCalibracion();
  }
  setTimeout(() => {
    if (giroActivo && !llegaronDatos) {
      calibracion = null;
      pintarCalibracion();
      aviso.textContent = "El sensor de movimiento no responde. Usá la zona táctil.";
    }
  }, 1500);
};

$("calibrar").onclick = () => {
  if (!giroActivo) {
    ejes = null;
    activar.click();
    return;
  }
  empezarCalibracion();
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
