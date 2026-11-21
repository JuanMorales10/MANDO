// Página del teléfono: el puntero del modo celular de MANDO.
// Manda al puente solo mensajes de una lista cerrada:
//   {t:"m",x,y} mover · {t:"c"} clic · {t:"r"} clic derecho · {t:"z"} centrar
//   {t:"s",y} rueda · {t:"k",n:"izq"|"der"|...} tecla para pasar diapositivas
//   {t:"l",v:1|0} láser · {t:"d",v:1|0} empezar / terminar un trazo · {t:"b"} borrar los trazos
//   {t:"e",n:"bloquear"|"suspender"|"apagar"} energía (siempre después de mantener apretado)
// El volumen y el resto de los botones están en el mando (celular.html).

const $ = (id) => document.getElementById(id);
const estado = $("estado");
const aviso = $("aviso");
const volumen = $("volumen");
const pad = $("pad");
const activar = $("activar");

// Se usa el mismo código de 4 números de la sala: llega en la dirección, o es el que ya
// se escribió en el mando (queda guardado mientras dure la pestaña).
const token = (() => {
  const deLaUrl = new URLSearchParams(location.search).get("c") ||
    new URLSearchParams(location.hash.slice(1)).get("c");
  let guardado = "";
  try {
    guardado = sessionStorage.getItem("mando-sala") || "";
    if (deLaUrl) sessionStorage.setItem("mando-sala", deLaUrl);
  } catch {
    /* sin almacenamiento, sigue andando */
  }
  const valor = String(deLaUrl || guardado).replace(/^"|"$/g, "");
  return /^\d{4}$/.test(valor) ? valor : "";
})();
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
    // El láser y la energía se muestran solo si la compu avisa que los ofrece.
    if (m.laser !== undefined) $("herramientas").hidden = m.laser !== true;
    if (m.energia !== undefined) ofrecidas = Array.isArray(m.energia) ? m.energia : [];
    pintarEnergia();
  }
  if (m.t === "energia") alResultadoEnergia(m);
}

function conectar() {
  if (cortado) return;
  if (!token) {
    ponerEstado("sin", "Falta el código");
    aviso.textContent = "Entrá primero al mando con el código del proyector y después volvé al puntero.";
    return;
  }
  if (modoPost) return;
  const esquema = location.protocol === "http:" ? "ws" : "wss";
  let abrio = false;
  const este = new WebSocket(`${esquema}://${location.host}/puntero/ws?t=${encodeURIComponent(token)}`);
  ws = este;
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
    if (ws !== este) return; // es una conexión vieja: ya hay otra en su lugar
    ws = null;
    alCortarse();
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
  const r = await fetch("/puntero/m", {
    method: "POST",
    headers: { "x-token": token, "x-id": ID },
    body: JSON.stringify(lista),
  });
  ultimoPost = performance.now();
  if (r.status === 401) {
    const e = new Error("Código incorrecto");
    e.sinCodigo = true;
    throw e;
  }
  if (r.status === 409) throw new Error("Otro teléfono tiene el control");
  if (!r.ok) throw new Error("Sin conexión");
  const datos = await r.json();
  alRecibir({ t: "hola", clics: datos.clics, laser: datos.laser, energia: datos.energia });
  alRecibir(datos.vol);
  // Por este camino el resultado de una orden de energía llega en la misma respuesta.
  if (Array.isArray(datos.acuses)) for (const a of datos.acuses) if (a && a.t === "energia") alRecibir(a);
}

async function probarPost() {
  try {
    await post([]);
    modoPost = true;
    ponerEstado("ok", "Conectado");
  } catch (e) {
    ponerEstado("sin", e.message);
    fallosWs = 0;
    if (e.sinCodigo) {
      // Reintentar con un código malo solo consigue que la compu bloquee a este teléfono.
      aviso.textContent = "El código ya no sirve. Tocá «Mando», entrá de nuevo con el código del proyector y volvé.";
      return;
    }
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
      alCortarse();
      ponerEstado("sin", e.message);
      fallosWs = 0;
      if (!e.sinCodigo) setTimeout(conectar, 2000);
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
    } else if (cola.length < 64 || m.t === "d") {
      // El fin de un trazo no se descarta aunque la cola esté llena.
      cola.push({ ...m });
    }
    vaciarCola();
    return;
  }
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
}

// ---------- Volver al mando ----------

$("ir-mando").onclick = () => {
  location.href = token ? `/celular.html?c=${token}` : "/celular.html";
};

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

const esIOS = typeof DeviceMotionEvent !== "undefined" &&
  typeof DeviceMotionEvent.requestPermission === "function";

let giroActivo = false;
let apoyado = false;
let ultimo = 0;
let suaveX = 0;
let suaveY = 0;
let llegaronDatos = false;

const UMBRAL = 0.35; // grados por segundo que se descuentan: tapa el temblor del sensor en reposo

let ejes = ajustes.ejes && Array.isArray(ajustes.ejes.x) && Array.isArray(ajustes.ejes.y) ? ajustes.ejes : null;
let pausaHasta = 0;
let calibracion = null; // { paso: "derecha" | "quieto" | "arriba", suma: [x,y,z], quietoDesde, x }

const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const largo = (a) => Math.hypot(a[0], a[1], a[2]);
const unitario = (a) => {
  const l = largo(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// Al tocar «Activar» la mano todavía se está acomodando: se espera un momento antes de
// escuchar el primer gesto, y se pide un giro amplio para darlo por bueno.
const ESPERA_CALIBRAR = 1000;
const GIRO_CALIBRAR = 20;

function empezarCalibracion() {
  calibracion = { paso: "derecha", suma: [0, 0, 0], quietoDesde: 0, x: null, desde: performance.now() + ESPERA_CALIBRAR };
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
  if (ahora < c.desde) return;
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
  if (largo(c.suma) < GIRO_CALIBRAR) return;
  if (c.paso === "derecha") {
    c.x = unitario(c.suma);
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
  const y = unitario([crudo[0] - comun * c.x[0], crudo[1] - comun * c.x[1], crudo[2] - comun * c.x[2]]);
  ejes = { x: c.x, y };
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
  if (!giroActivo || dt === 0) return;

  const w = [r.alpha || 0, r.beta || 0, r.gamma || 0]; // grados por segundo
  if (calibracion) {
    calibrar(w, dt, ahora);
    return;
  }
  if (!ejes || ahora < pausaHasta) return;
  // Mantener apretado «Dibujar» cuenta como dedo apoyado: el trazo sigue al teléfono.
  if (ajustes.apretar && !apoyado && !dibujando) {
    suaveX = 0;
    suaveY = 0;
    return;
  }

  let vx = punto(w, ejes.x); // positivo = hacia la derecha
  let vy = punto(w, ejes.y); // positivo = hacia arriba
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
    soltarTrazo();
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

const botonCortar = $("cortar");
const textoCortar = [...botonCortar.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
function pintarCortar() {
  if (textoCortar) textoCortar.textContent = cortado ? "Volver a conectar" : "Desconectar";
  else botonCortar.textContent = cortado ? "Volver a conectar" : "Desconectar";
}

botonCortar.onclick = () => {
  if (cortado) {
    // Volver a conectar, sin recargar la página.
    cortado = false;
    modoPost = false;
    reintento = 0;
    fallosWs = 0;
    cola = [];
    pintarCortar();
    ponerEstado("sin", "Conectando…");
    aviso.textContent = "Tocá «Activar puntero» para volver a mover el cursor.";
    conectar();
    return;
  }
  // Antes de cortar se suelta el trazo y se apaga el láser (la compu igual limpia al desconectarse).
  soltarTrazo();
  if (laserPrendido) enviar({ t: "l", v: 0 });
  cancelarEnergia();
  cortado = true;
  alCortarse();
  giroActivo = false;
  calibracion = null;
  pintarCalibracion();
  pintarActivar();
  if (modoPost) fetch("/puntero/chau", { method: "POST", headers: { "x-token": token, "x-id": ID }, keepalive: true }).catch(() => {});
  modoPost = false;
  cola = [];
  if (ws) ws.close();
  ws = null;
  if (bloqueo) bloqueo.release().catch(() => {});
  ponerEstado("sin", "Desconectado");
  aviso.textContent = "Cortaste la conexión. Tocá «Volver a conectar» cuando quieras seguir.";
  pintarCortar();
};

// Al volver a la pestaña (o desbloquear el teléfono) se reconecta solo.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || cortado) return;
  const conectado = modoPost || (ws && ws.readyState === WebSocket.OPEN);
  const conectando = ws && ws.readyState === WebSocket.CONNECTING;
  if (!conectado && !conectando) {
    reintento = 0;
    fallosWs = 0;
    conectar();
  }
});

$("clic").onclick = () => enviar({ t: "c" });
$("derecho").onclick = () => enviar({ t: "r" });
$("centrar").onclick = () => enviar({ t: "z" });

// ---------- Láser y dibujo sobre la pantalla ----------
//
// «Láser» es un interruptor. «Dibujar» se mantiene apretado: mientras el dedo no se levanta,
// el cursor deja trazo. La fila aparece solo si la compu avisó laser:true en el «hola».

const botonLaser = $("laser");
const botonDibujar = $("dibujar");
let laserPrendido = false;
let dibujando = false;
let trazo = null; // dedo que mantiene apretado «Dibujar»: { id, x, y, inicio }

const hayConexion = () => modoPost || Boolean(ws && ws.readyState === WebSocket.OPEN);

function pintarLaser() {
  botonLaser.setAttribute("aria-pressed", String(laserPrendido));
  botonDibujar.dataset.apretado = dibujando ? "si" : "no";
}

function ponerLaser(prendido) {
  laserPrendido = prendido;
  enviar({ t: "l", v: prendido ? 1 : 0 });
  pintarLaser();
}

function soltarTrazo() {
  trazo = null;
  if (!dibujando) return;
  dibujando = false;
  enviar({ t: "d", v: 0 });
  pintarLaser();
}

// Se cortó la conexión: la compu ya apagó el láser y cerró el trazo por su cuenta.
function alCortarse() {
  laserPrendido = false;
  dibujando = false;
  trazo = null;
  pintarLaser();
}

botonLaser.onclick = () => {
  if (!hayConexion()) {
    aviso.textContent = "Sin conexión con la compu.";
    return;
  }
  ponerLaser(!laserPrendido);
  if (navigator.vibrate) navigator.vibrate(10);
};

botonDibujar.addEventListener("pointerdown", (e) => {
  if (trazo) return;
  if (!hayConexion()) {
    aviso.textContent = "Sin conexión con la compu.";
    return;
  }
  try {
    botonDibujar.setPointerCapture(e.pointerId);
  } catch {
    /* sin captura, igual anda mientras el dedo no salga del botón */
  }
  trazo = { id: e.pointerId, x: e.clientX, y: e.clientY, inicio: performance.now() };
  if (!laserPrendido) ponerLaser(true); // así se ve por dónde va el trazo
  dibujando = true;
  enviar({ t: "d", v: 1 });
  pintarLaser();
  if (navigator.vibrate) navigator.vibrate(10);
});

botonDibujar.addEventListener("pointermove", (e) => {
  if (!trazo || e.pointerId !== trazo.id) return;
  const dx = e.clientX - trazo.x;
  const dy = e.clientY - trazo.y;
  trazo.x = e.clientX;
  trazo.y = e.clientY;
  // Sin el puntero por movimiento, el mismo dedo dibuja arrastrando (como en la zona táctil).
  if (!giroActivo) {
    const ganancia = ajustes.velocidad / 11;
    accX += dx * ganancia;
    accY += dy * ganancia;
  }
});

function finTrazo(e) {
  if (!trazo || e.pointerId !== trazo.id) return;
  const corto = performance.now() - trazo.inicio < 250;
  soltarTrazo();
  if (corto) aviso.textContent = "Mantené apretado «Dibujar» y mové el teléfono: mientras no sueltes, deja trazo.";
}
for (const tipo of ["pointerup", "pointercancel", "lostpointercapture"]) botonDibujar.addEventListener(tipo, finTrazo);
botonDibujar.addEventListener("contextmenu", (e) => e.preventDefault());

$("borrar").onclick = () => {
  enviar({ t: "b" });
  if (navigator.vibrate) navigator.vibrate(10);
};

// ---------- Compu: bloquear, suspender, apagar ----------
//
// Cada botón pide mantener apretado un segundo y medio; si se suelta antes, no manda nada.
// Solo se muestran las acciones que la compu ofrece en el «hola».

const MANTENER = 1500;
const NOMBRES = { bloquear: "Bloquear pantalla", suspender: "Suspender", apagar: "Apagar" };
const avisoEnergia = $("energia-aviso");
const botonesEnergia = [...document.querySelectorAll("[data-energia]")];
let ofrecidas = [];
let apretando = null; // { boton, id, desde, reloj }

function decirEnergia(texto, tono = "") {
  avisoEnergia.textContent = texto;
  avisoEnergia.dataset.tono = tono;
}

function pintarEnergia() {
  let alguna = false;
  for (const b of botonesEnergia) {
    b.hidden = !ofrecidas.includes(b.dataset.energia);
    if (!b.hidden) alguna = true;
  }
  if (apretando && apretando.boton.hidden) cancelarEnergia();
  $("energia-bajada").hidden = !alguna;
  $("energia-vacio").hidden = alguna;
  $("energia-vacio").textContent = "El servidor no ofrece estas acciones.";
}

function pintarAvance() {
  if (!apretando) return;
  const avance = Math.min(1, (performance.now() - apretando.desde) / MANTENER);
  apretando.boton.style.setProperty("--avance", avance.toFixed(3));
  requestAnimationFrame(pintarAvance);
}

function cancelarEnergia(texto) {
  if (!apretando) return;
  clearTimeout(apretando.reloj);
  apretando.boton.dataset.apretado = "no";
  apretando.boton.style.removeProperty("--avance");
  apretando = null;
  if (texto) decirEnergia(texto);
}

function confirmarEnergia() {
  if (!apretando) return;
  const accion = apretando.boton.dataset.energia;
  cancelarEnergia();
  if (!hayConexion()) {
    decirEnergia("Sin conexión con la compu.", "mal");
    return;
  }
  enviar({ t: "e", n: accion });
  if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
  decirEnergia(`«${NOMBRES[accion]}»: pedido enviado a la compu…`);
  // La compu acepta una orden de estas cada 5 segundos.
  for (const b of botonesEnergia) b.disabled = true;
  setTimeout(() => {
    for (const b of botonesEnergia) b.disabled = false;
  }, 5000);
}

function alResultadoEnergia(m) {
  const nombre = typeof m.n === "string" && Object.keys(NOMBRES).includes(m.n) ? NOMBRES[m.n] : "La orden";
  if (m.ok === true) decirEnergia(`«${nombre}»: hecho.`, "ok");
  else decirEnergia(`«${nombre}»: la compu no lo hizo. Esperá unos segundos y probá de nuevo.`, "mal");
}

for (const boton of botonesEnergia) {
  boton.addEventListener("pointerdown", (e) => {
    if (apretando) return;
    if (!hayConexion()) {
      decirEnergia("Sin conexión con la compu.", "mal");
      return;
    }
    try {
      boton.setPointerCapture(e.pointerId);
    } catch {
      /* sin captura, igual anda mientras el dedo no salga del botón */
    }
    apretando = { boton, id: e.pointerId, desde: performance.now(), reloj: setTimeout(confirmarEnergia, MANTENER) };
    boton.dataset.apretado = "si";
    decirEnergia("Seguí apretando…");
    requestAnimationFrame(pintarAvance);
  });
  boton.addEventListener("pointermove", (e) => {
    if (!apretando || apretando.boton !== boton || apretando.id !== e.pointerId) return;
    // Correr el dedo bien afuera del botón es arrepentirse.
    const r = boton.getBoundingClientRect();
    const fuera = e.clientX < r.left - 24 || e.clientX > r.right + 24 || e.clientY < r.top - 24 || e.clientY > r.bottom + 24;
    if (fuera) cancelarEnergia("Cancelado: no se mandó nada.");
  });
  for (const tipo of ["pointerup", "pointercancel", "lostpointercapture"]) {
    boton.addEventListener(tipo, (e) => {
      if (!apretando || apretando.boton !== boton || apretando.id !== e.pointerId) return;
      cancelarEnergia("Soltaste antes de tiempo: no se mandó nada. Mantené apretado hasta que se llene.");
    });
  }
  boton.addEventListener("contextmenu", (e) => e.preventDefault());
}

// Al ocultarse la página no puede quedar un trazo abierto ni una confirmación a medias.
// Al volver, si el láser figura prendido se manda de nuevo, por si la compu lo apagó mientras tanto.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    soltarTrazo();
    cancelarEnergia();
  } else if (laserPrendido && hayConexion()) {
    enviar({ t: "l", v: 1 });
  }
});
window.addEventListener("pagehide", soltarTrazo);

// ---------- Pestañas ----------

function irA(vista) {
  soltarTrazo();
  cancelarEnergia();
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
