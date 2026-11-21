// MANDO en el celular: onboarding, mando completo configurable y guía por sectores.
// Cada botón manda su acción al servidor de la notebook, que la aplica a los aparatos reales.

import { BOTONES, SECCIONES, BOTON, FAVORITOS_INICIALES, nombreDe } from "./mando-botones.js";

const CLAVE_CONFIG = "mando-celular-v1";
const CLAVE_ONBOARDING = "mando-onboarding-v1";
const CLAVE_CODIGO = "mando-sala";

const $ = (id) => document.getElementById(id);
const body = document.body;

// ---------- Almacenamiento (nunca rompe si el navegador lo bloquea) ----------

const guardado = {
  leer(clave, almacen = localStorage) {
    try {
      return almacen.getItem(clave);
    } catch {
      return null;
    }
  },
  escribir(clave, valor, almacen = localStorage) {
    try {
      almacen.setItem(clave, valor);
    } catch {
      // Sin almacenamiento: funciona igual, solo no recuerda.
    }
  },
};

function leerConfig() {
  try {
    const c = JSON.parse(guardado.leer(CLAVE_CONFIG));
    const validos = (lista) => (Array.isArray(lista) ? lista.filter((id) => BOTON[id]) : []);
    if (c) return { favoritos: validos(c.favoritos), grandes: validos(c.grandes), ocultas: Array.isArray(c.ocultas) ? c.ocultas : [] };
  } catch {
    // Config dañada: arrancamos de fábrica.
  }
  return { favoritos: [...FAVORITOS_INICIALES], grandes: [], ocultas: [] };
}

let config = leerConfig();
const guardarConfig = () => guardado.escribir(CLAVE_CONFIG, JSON.stringify(config));

// ---------- Estado de la sesión ----------

let codigo = null;
let modo = "usar";
let estadoTV = null;
let eventos = null;

// ---------- Red ----------

async function post(ruta, cuerpo) {
  const res = await fetch(ruta, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(datos.error || `Error ${res.status}`), { status: res.status });
  return datos;
}

async function enviar(accion) {
  $("error").textContent = "";
  navigator.vibrate?.(12);
  try {
    await post("/api/accion", { codigo, accion });
  } catch (error) {
    if (error.status === 403) return volverAlCodigo("El código cambió. Escribilo de nuevo.");
    $("error").textContent = `No se pudo enviar ${nombreDe(accion)}: ${error.message}`;
  }
}

function escuchar() {
  eventos?.close();
  eventos = new EventSource("/api/eventos");
  eventos.onopen = () => marcarConexion(true);
  eventos.onerror = () => marcarConexion(false);
  eventos.onmessage = (m) => {
    try {
      mostrarEstado(JSON.parse(m.data));
    } catch {
      // Mensaje incompleto: esperamos el próximo.
    }
  };
}

function marcarConexion(on) {
  $("conexion").dataset.estado = on ? "on" : "off";
  $("conexion").textContent = on ? "Conectado" : "Reconectando…";
}

function mostrarEstado({ state, conectores = [] }) {
  if (!state) return;
  estadoTV = state;
  body.dataset.tv = !state.power ? "apagada" : state.muted ? "silencio" : "sonando";
  $("estado-principal").textContent = !state.power
    ? "Apagada"
    : state.muted
      ? "Silencio"
      : `Volumen ${state.volume}`;
  const caidos = conectores.filter((c) => !c.ok);
  $("estado-detalle").textContent = [
    `Canal ${state.channel}`,
    ...caidos.map((c) => `⚠ ${c.nombre}: ${c.detalle}`),
  ].join(" · ");
  marcarActivos();
}

function marcarActivos() {
  if (!estadoTV) return;
  for (const el of document.querySelectorAll('.boton[data-accion="MUTE"]')) el.dataset.activo = String(estadoTV.muted);
  for (const el of document.querySelectorAll('.boton[data-accion="POWER"]')) el.dataset.activo = String(!estadoTV.power);
}

// ---------- Dibujo del mando ----------

// Íconos de línea (solo visual): reemplazan los emojis del catálogo cuando hay uno.
const PARLANTE = '<path d="M11 5 6 9H3v6h3l5 4z"/>';
const TRAZOS = {
  POWER: '<path d="M12 3v9"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>',
  INPUT: '<path d="M4 8h14l-3-3"/><path d="M20 16H6l3 3"/>',
  MUTE: `${PARLANTE}<path d="m16 9.5 5 5M21 9.5l-5 5"/>`,
  VOL_DOWN: `${PARLANTE}<path d="M15.5 12h5"/>`,
  VOL_UP: `${PARLANTE}<path d="M15.5 12h5M18 9.5v5"/>`,
  CH_DOWN: '<path d="m6 9 6 6 6-6"/>',
  CH_UP: '<path d="m6 15 6-6 6 6"/>',
  UP: '<path d="m6 15 6-6 6 6"/>',
  DOWN: '<path d="m6 9 6 6 6-6"/>',
  LEFT: '<path d="m15 6-6 6 6 6"/>',
  RIGHT: '<path d="m9 6 6 6-6 6"/>',
  BACK: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  HOME: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h4.5v-5.5h4V20h4.5V9.5"/>',
  MENU: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  REWIND: '<path d="M11 6.5 4.5 12l6.5 5.5zM19.5 6.5 13 12l6.5 5.5z"/>',
  PLAY_PAUSE: '<path d="M4 6.5v11l7.5-5.5z"/><path d="M15.5 6.5v11M20 6.5v11"/>',
  FORWARD: '<path d="m13 6.5 6.5 5.5-6.5 5.5zM4.5 6.5 11 12l-6.5 5.5z"/>',
  FULLSCREEN: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
};
const svgDe = (trazos) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${trazos}</svg>`;

function crearBoton(b, { favorito = false } = {}) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "boton";
  if (b.url) el.classList.add("boton--app");
  if (b.soloIcono) el.classList.add("boton--solo-icono");
  el.dataset.accion = b.id;
  if (b.tono) el.dataset.tono = b.tono;
  el.dataset.favorito = String(config.favoritos.includes(b.id));
  el.setAttribute("aria-label", b.nombre);

  if (b.icono) {
    const icono = document.createElement("span");
    icono.className = "boton__icono";
    icono.setAttribute("aria-hidden", "true");
    if (TRAZOS[b.id]) {
      icono.classList.add("boton__icono--svg");
      icono.innerHTML = svgDe(TRAZOS[b.id]);
    } else icono.textContent = b.icono;
    el.append(icono);
  }
  if (!b.soloIcono || favorito) {
    const nombre = document.createElement("span");
    nombre.className = "boton__nombre";
    nombre.textContent = b.nombre;
    el.append(nombre);
  }
  if (modo === "editar") {
    const estrella = document.createElement("span");
    estrella.className = "estrella";
    estrella.setAttribute("aria-hidden", "true");
    estrella.textContent = config.favoritos.includes(b.id) ? "★" : "☆";
    el.append(estrella);
  }
  return el;
}

function crearSeccion(id, titulo, { oculta = false } = {}) {
  const seccion = document.createElement("section");
  seccion.className = `seccion seccion--${id}`;
  seccion.dataset.tour = id;
  seccion.dataset.oculta = String(oculta);
  const cabeza = document.createElement("div");
  cabeza.className = "seccion__cabeza";
  const h = document.createElement("h2");
  h.className = "seccion__titulo";
  h.textContent = titulo;
  cabeza.append(h);
  if (modo === "editar" && id !== "favoritos") {
    const ojo = document.createElement("button");
    ojo.type = "button";
    ojo.className = "seccion__ojo";
    ojo.dataset.ojo = id;
    ojo.textContent = oculta ? "Mostrar" : "Ocultar";
    cabeza.append(ojo);
  }
  const rejilla = document.createElement("div");
  rejilla.className = "rejilla";
  seccion.append(cabeza, rejilla);
  return { seccion, rejilla };
}

function render() {
  const mando = $("mando");
  mando.replaceChildren();
  body.dataset.modo = modo;
  for (const b of document.querySelectorAll(".modos__btn")) b.setAttribute("aria-pressed", String(b.dataset.modo === modo));
  $("aviso-edicion").hidden = modo !== "editar";

  // Tus botones
  const fav = crearSeccion("favoritos", "Tus botones");
  if (!config.favoritos.length) {
    const vacio = document.createElement("p");
    vacio.className = "favoritos__vacio";
    vacio.textContent = modo === "editar" ? "Tocá ☆ en cualquier botón para sumarlo acá." : "Todavía no elegiste botones. Tocá Editar.";
    fav.rejilla.append(vacio);
  }
  config.favoritos.forEach((id, i) => {
    const item = document.createElement("div");
    item.className = "favorito";
    if (config.grandes.includes(id)) item.classList.add("is-grande");
    item.append(crearBoton(BOTON[id], { favorito: true }));
    if (modo === "editar") {
      const editor = document.createElement("div");
      editor.className = "editor";
      const nombre = BOTON[id].nombre;
      editor.innerHTML = `
        <button type="button" data-mover="-1" data-id="${id}" aria-label="Mover ${nombre} antes" ${i === 0 ? "disabled" : ""}>◀</button>
        <button type="button" data-grande="${id}" aria-label="${config.grandes.includes(id) ? "Achicar" : "Agrandar"} ${nombre}">${config.grandes.includes(id) ? "↙ Achicar" : "⤢ Agrandar"}</button>
        <button type="button" data-mover="1" data-id="${id}" aria-label="Mover ${nombre} después" ${i === config.favoritos.length - 1 ? "disabled" : ""}>▶</button>`;
      item.append(editor);
    }
    fav.rejilla.append(item);
  });
  mando.append(fav.seccion);

  // Secciones del catálogo
  for (const s of SECCIONES) {
    const oculta = config.ocultas.includes(s.id);
    if (oculta && modo === "usar") continue;
    const sec = crearSeccion(s.id, s.nombre, { oculta });
    for (const b of BOTONES.filter((x) => x.seccion === s.id)) sec.rejilla.append(crearBoton(b));
    mando.append(sec.seccion);
  }
  marcarActivos();
}

function pulso(el) {
  el.classList.remove("is-pulso");
  void el.offsetWidth;
  el.classList.add("is-pulso");
  setTimeout(() => el.classList.remove("is-pulso"), 140);
}

$("mando").addEventListener("click", (evento) => {
  const t = evento.target;

  const ojo = t.closest("[data-ojo]");
  if (ojo) {
    const id = ojo.dataset.ojo;
    config.ocultas = config.ocultas.includes(id) ? config.ocultas.filter((x) => x !== id) : [...config.ocultas, id];
    guardarConfig();
    return render();
  }

  const mover = t.closest("[data-mover]");
  if (mover) {
    const lista = config.favoritos;
    const i = lista.indexOf(mover.dataset.id);
    const j = i + Number(mover.dataset.mover);
    if (j >= 0 && j < lista.length) [lista[i], lista[j]] = [lista[j], lista[i]];
    guardarConfig();
    return render();
  }

  const grande = t.closest("[data-grande]");
  if (grande) {
    const id = grande.dataset.grande;
    config.grandes = config.grandes.includes(id) ? config.grandes.filter((x) => x !== id) : [...config.grandes, id];
    guardarConfig();
    return render();
  }

  const boton = t.closest(".boton");
  if (!boton) return;
  const id = boton.dataset.accion;

  if (modo === "editar") {
    // En Editar ningún botón manda acciones: solo entra o sale de Tus botones.
    if (config.favoritos.includes(id)) {
      config.favoritos = config.favoritos.filter((x) => x !== id);
      config.grandes = config.grandes.filter((x) => x !== id);
    } else {
      config.favoritos = [...config.favoritos, id];
    }
    guardarConfig();
    return render();
  }

  pulso(boton);
  enviar(id);
});

function cambiarModo(nuevo) {
  modo = nuevo;
  render();
}

for (const b of document.querySelectorAll(".modos__btn")) {
  b.addEventListener("click", () => cambiarModo(b.dataset.modo));
}

// ---------- Onboarding ----------

const TOTAL_PASOS = 5;

function irPaso(n) {
  $("onb").hidden = false;
  $("app").hidden = true;
  for (const p of document.querySelectorAll(".onb__paso")) p.hidden = Number(p.dataset.paso) !== n;
  $("onb-barra").style.width = `${(n / TOTAL_PASOS) * 100}%`;
  if (n === 3) setTimeout(() => $("codigo").focus(), 50);
}

for (const b of document.querySelectorAll("[data-ir]")) b.addEventListener("click", () => irPaso(Number(b.dataset.ir)));

function listarAparatos(conectores = []) {
  const lista = $("onb-aparatos");
  lista.replaceChildren();
  const items = [{ nombre: "TV simulada", ok: true, detalle: "En la pantalla del proyector" }, ...conectores];
  for (const c of items) {
    const li = document.createElement("li");
    li.dataset.ok = String(c.ok);
    li.innerHTML = `<strong></strong><span></span>`;
    li.querySelector("strong").textContent = `${c.ok ? "✓" : "⚠"} ${c.nombre === "Computadora" ? "La notebook del proyector" : c.nombre}`;
    li.querySelector("span").textContent = c.nombre === "Computadora"
      ? "Volumen, silencio, apps de streaming y reproducción"
      : c.detalle || "";
    lista.append(li);
  }
}

async function conectar(valor, { desdeOnboarding = true } = {}) {
  $("error-codigo").textContent = "";
  try {
    const datos = await post("/api/entrar", { codigo: valor });
    codigo = valor;
    guardado.escribir(CLAVE_CODIGO, valor, sessionStorage);
    listarAparatos(datos.conectores);
    mostrarEstado(datos);
    escuchar();
    if (desdeOnboarding) irPaso(4);
    else abrirMando();
  } catch (error) {
    irPaso(3);
    $("error-codigo").textContent = error.status === 403
      ? "Ese código no es. Fijate el que aparece en el proyector."
      : `No llego a la notebook: ${error.message}`;
  }
}

$("form-codigo").addEventListener("submit", (e) => {
  e.preventDefault();
  conectar($("codigo").value.trim());
});

function abrirMando({ editar = false, guia = false } = {}) {
  guardado.escribir(CLAVE_ONBOARDING, "hecho");
  $("onb").hidden = true;
  $("app").hidden = false;
  modo = editar ? "editar" : "usar";
  render();
  if (guia) setTimeout(iniciarGuia, 200);
}

$("onb-editar").addEventListener("click", () => abrirMando({ editar: true, guia: true }));
$("onb-usar").addEventListener("click", () => abrirMando({ guia: true }));

function volverAlCodigo(motivo) {
  eventos?.close();
  codigo = null;
  irPaso(3);
  $("error-codigo").textContent = motivo;
}

// ---------- Guía por sectores ----------

const GUIA = [
  { objetivo: "estado", texto: "Acá ves la TV en vivo: volumen, silencio y canal." },
  { objetivo: "modo", texto: "Usar para controlar. Editar para armar el mando a tu manera." },
  {
    objetivo: "favoritos",
    texto: () => modo === "editar"
      ? "Tus botones. Tocá ☆ en cualquier botón para sumarlo, ⤢ para agrandarlo y ◀ ▶ para ordenarlo."
      : "Tus botones: los que más usás, grandes y arriba.",
  },
  { objetivo: "basicos", texto: "Básicos: encendido, entrada, silencio, volumen y canal." },
  { objetivo: "navegacion", texto: "Flechas y OK para moverte por Netflix, YouTube o las diapositivas." },
  { objetivo: "reproduccion", texto: "Play, pausa, adelantar y pantalla completa." },
  { objetivo: "apps", texto: "Tocá una app y se abre directo en el proyector." },
  { objetivo: "ayuda", texto: "¿Te perdiste? Tocá ? y vuelve esta guía." },
];

let pasoGuia = 0;
let pasosVisibles = [];

const objetivoDe = (id) => (id === "ayuda" ? $("ver-tour") : document.querySelector(`[data-tour="${id}"]`));

function mostrarPasoGuia() {
  for (const el of document.querySelectorAll(".is-foco")) el.classList.remove("is-foco");
  const paso = pasosVisibles[pasoGuia];
  if (!paso) return terminarGuia();
  const el = objetivoDe(paso.objetivo);
  el.classList.add("is-foco");
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  $("tour-paso").textContent = `Paso ${pasoGuia + 1} de ${pasosVisibles.length}`;
  $("tour-texto").textContent = typeof paso.texto === "function" ? paso.texto() : paso.texto;
  $("tour-siguiente").textContent = pasoGuia === pasosVisibles.length - 1 ? "¡Listo!" : "Siguiente";
}

function iniciarGuia() {
  pasosVisibles = GUIA.filter((p) => objetivoDe(p.objetivo));
  pasoGuia = 0;
  $("tour").hidden = false;
  mostrarPasoGuia();
}

function terminarGuia() {
  for (const el of document.querySelectorAll(".is-foco")) el.classList.remove("is-foco");
  $("tour").hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("tour-siguiente").addEventListener("click", () => {
  pasoGuia += 1;
  mostrarPasoGuia();
});
$("tour-saltar").addEventListener("click", terminarGuia);
$("ver-tour").addEventListener("click", iniciarGuia);

// ---------- Arranque ----------

const codigoInicial = new URLSearchParams(location.search).get("c") || guardado.leer(CLAVE_CODIGO, sessionStorage);
if (codigoInicial) $("codigo").value = codigoInicial;

if (guardado.leer(CLAVE_ONBOARDING) === "hecho" && codigoInicial) {
  conectar(codigoInicial, { desdeOnboarding: false });
} else if (guardado.leer(CLAVE_ONBOARDING) === "hecho") {
  irPaso(3);
} else {
  irPaso(1);
}
