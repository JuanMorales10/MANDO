// MANDO en el celular: onboarding, mando completo configurable y guía por sectores.
// Cada botón manda su acción al servidor de la notebook, que la aplica a los aparatos reales.

import { BOTONES, SECCIONES, BOTON, FAVORITOS_INICIALES, nombreDe } from "./mando-botones.js";

const CLAVE_CONFIG = "mando-celular-v1";
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
    ? "⏻ Apagada"
    : state.muted
      ? "🔇 Silencio"
      : `🔊 Volumen ${state.volume}`;
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
    icono.textContent = b.icono;
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
  // La primera vez que se entra a Editar, un recorrido corto explica cómo armarlo.
  if (nuevo === "editar") setTimeout(() => recorrido.siPrimeraVez("editar"), 250);
}

for (const b of document.querySelectorAll(".modos__btn")) {
  b.addEventListener("click", () => cambiarModo(b.dataset.modo));
}

// ---------- Entrar: con el QR es directo; sin QR, una sola pantalla con el código ----------

function pantallaCodigo(motivo = "") {
  $("onb").hidden = false;
  $("app").hidden = true;
  $("error-codigo").textContent = motivo;
  setTimeout(() => $("codigo").focus(), 50);
}

async function conectar(valor) {
  $("error-codigo").textContent = "";
  try {
    const datos = await post("/api/entrar", { codigo: valor });
    codigo = valor;
    guardado.escribir(CLAVE_CODIGO, valor, sessionStorage);
    mostrarEstado(datos);
    escuchar();
    abrirMando();
  } catch (error) {
    pantallaCodigo(error.status === 403
      ? "Ese código no es. Fijate el que aparece en el proyector."
      : "No llego a la notebook. ¿Estás en el mismo wifi?");
  }
}

$("form-codigo").addEventListener("submit", (e) => {
  e.preventDefault();
  conectar($("codigo").value.trim());
});

function abrirMando() {
  $("onb").hidden = true;
  $("app").hidden = false;
  modo = "usar";
  render();
  setTimeout(() => recorrido.siPrimeraVez("mando"), 700);
}

function volverAlCodigo(motivo) {
  eventos?.close();
  codigo = null;
  pantallaCodigo(motivo);
}

// ---------- Recorrido por pantalla (estilo Pedido Claro) ----------
// La PRIMERA vez se ilumina cada elemento clave y una tarjeta explica cómo se usa (3 pasos como máximo).
// Se saltea en cualquier momento y se vuelve a ver con «?». Escape cierra, ← → cambian de paso,
// un toque en el fondo cierra y el foco vuelve adonde estaba. Un paso cuyo elemento no se ve se saltea.

const RECORRIDOS = {
  mando: {
    id: "mando-v1",
    etiqueta: "Mando",
    pasos: [
      { objetivo: '[data-tour="estado"]', titulo: "La tele, en vivo", texto: "Acá ves cómo está: volumen, silencio y canal. Cambia apenas tocás un botón." },
      { objetivo: '[data-tour="favoritos"]', titulo: "Lo que más usás, arriba", texto: "Tus botones, grandes y a mano. Abajo están todos: navegación, reproducción, apps y números." },
      { objetivo: ['a[href="/puntero/index.html"]', '[data-tour="modo"]'], titulo: "Hacelo tuyo", texto: "Tocá «Editar» para elegir tus botones. Y con «Puntero», movés el celular en el aire para mover el cursor." },
    ],
  },
  editar: {
    id: "editar-v1",
    etiqueta: "Editar",
    pasos: [
      { objetivo: '.seccion--basicos .boton', titulo: "Elegí tus botones", texto: "Tocá cualquier botón para sumarlo a «Tus botones» (☆ → ★). Tocalo de nuevo para sacarlo." },
      { objetivo: '[data-tour="favoritos"] .editor', titulo: "Agrandá y ordená", texto: "Con ⤢ lo hacés grande y con ◀ ▶ lo movés. Se guarda solo en este celular." },
      { objetivo: '[data-modo="usar"]', titulo: "Listo, a usar", texto: "Volvé a «Usar» y controlá la tele. En Editar los botones no mandan nada." },
    ],
  },
};

const recorrido = (() => {
  const capa = $("tour");
  const hueco = $("tour-hueco");
  const tarjeta = $("tour-tarjeta");
  let actual = null;
  let pasos = [];
  let indice = 0;
  let volverA = null;

  const visto = (id) => {
    try {
      return localStorage.getItem(`mando-tour:${id}`) !== null;
    } catch {
      return true; // sin almacenamiento: no insiste
    }
  };
  const marcarVisto = (id) => guardado.escribir(`mando-tour:${id}`, new Date().toISOString());

  function visible(objetivo) {
    for (const sel of Array.isArray(objetivo) ? objetivo : [objetivo]) {
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
      }
    }
    return null;
  }

  function ubicar() {
    const paso = pasos[indice];
    const el = paso && visible(paso.objetivo);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const PAD = 8;
    const GAP = 12;
    const MARGEN = 12;
    Object.assign(hueco.style, {
      top: `${r.top - PAD}px`,
      left: `${r.left - PAD}px`,
      width: `${r.width + PAD * 2}px`,
      height: `${r.height + PAD * 2}px`,
    });
    const ancho = Math.min(380, innerWidth - MARGEN * 2);
    const alto = tarjeta.offsetHeight || 220;
    const izquierda = Math.min(Math.max(MARGEN, r.left + r.width / 2 - ancho / 2), innerWidth - ancho - MARGEN);
    const abajo = r.bottom + PAD + GAP;
    const arriba = r.top - PAD - GAP - alto;
    const top = abajo + alto <= innerHeight - MARGEN ? abajo : arriba >= MARGEN ? arriba : innerHeight - alto - MARGEN;
    Object.assign(tarjeta.style, { top: `${top}px`, left: `${izquierda}px`, width: `${ancho}px` });
  }

  function pintar() {
    const paso = pasos[indice];
    const el = visible(paso.objetivo);
    const r = el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > innerHeight - 260) {
      scrollTo({ top: scrollY + r.top - 100, behavior: "instant" });
    }
    $("tour-etiqueta").textContent = actual.etiqueta;
    $("tour-cuenta").textContent = `${indice + 1} de ${pasos.length}`;
    $("tour-titulo").textContent = paso.titulo;
    $("tour-texto").textContent = paso.texto;
    $("tour-atras").hidden = indice === 0;
    $("tour-saltar").hidden = indice === pasos.length - 1;
    $("tour-siguiente").textContent = indice === pasos.length - 1 ? "Listo" : "Siguiente →";
    $("tour-puntos").replaceChildren(
      ...pasos.map((_, i) => {
        const punto = document.createElement("span");
        if (i === indice) punto.className = "is-actual";
        return punto;
      }),
    );
    tarjeta.classList.remove("is-entrando");
    void tarjeta.offsetWidth;
    tarjeta.classList.add("is-entrando");
    requestAnimationFrame(ubicar);
    tarjeta.focus();
  }

  function abrir(clave) {
    const r = RECORRIDOS[clave];
    pasos = r.pasos.filter((p) => visible(p.objetivo));
    if (!pasos.length) return;
    actual = r;
    indice = 0;
    volverA = document.activeElement;
    capa.hidden = false;
    document.documentElement.classList.add("sin-scroll");
    pintar();
  }

  function cerrar() {
    if (!actual) return;
    marcarVisto(actual.id);
    actual = null;
    capa.hidden = true;
    document.documentElement.classList.remove("sin-scroll");
    volverA?.focus?.();
  }

  const mover = (delta) => {
    const nuevo = indice + delta;
    if (nuevo < 0) return;
    if (nuevo >= pasos.length) return cerrar();
    indice = nuevo;
    pintar();
  };

  $("tour-siguiente").addEventListener("click", () => mover(1));
  $("tour-atras").addEventListener("click", () => mover(-1));
  $("tour-saltar").addEventListener("click", cerrar);
  $("tour-cerrar").addEventListener("click", cerrar);
  $("tour-fondo").addEventListener("click", cerrar);
  addEventListener("keydown", (e) => {
    if (!actual) return;
    if (e.key === "Escape") cerrar();
    else if (e.key === "ArrowRight") mover(1);
    else if (e.key === "ArrowLeft") mover(-1);
  });
  addEventListener("resize", () => actual && ubicar());

  return {
    siPrimeraVez(clave) {
      if (!navigator.webdriver && !actual && !visto(RECORRIDOS[clave].id)) abrir(clave);
    },
    // «?»: el de la pantalla en la que estás.
    repetir: () => abrir(modo === "editar" ? "editar" : "mando"),
  };
})();

$("ver-tour").addEventListener("click", () => recorrido.repetir());

// ---------- Arranque ----------

const codigoInicial = new URLSearchParams(location.search).get("c") || guardado.leer(CLAVE_CODIGO, sessionStorage);
if (codigoInicial) {
  $("codigo").value = codigoInicial;
  conectar(codigoInicial); // entró por el QR: directo al mando
} else {
  pantallaCodigo();
}
