// MANDO en el celular: onboarding, mando completo configurable y guía por sectores.
// Cada botón manda su acción al servidor de la notebook, que la aplica a los aparatos reales.

import { BOTONES, SECCIONES, BOTON, FAVORITOS_INICIALES, nombreDe, ACCIONES } from "./mando-botones.js";
import { applyAction, initialState } from "./tv-state.js";
import { unirseASala, normalizarSala, esSalaNube } from "./puente.js";

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
    const mapa = (m) => (m && typeof m === "object" ? Object.fromEntries(Object.entries(m).filter(([k]) => BOTON[k])) : {});
    if (c) return { favoritos: validos(c.favoritos), grandes: validos(c.grandes), ocultas: Array.isArray(c.ocultas) ? c.ocultas : [], tamanos: mapa(c.tamanos), colores: mapa(c.colores) };
  } catch {
    // Config dañada: arrancamos de fábrica.
  }
  return { favoritos: [...FAVORITOS_INICIALES], grandes: [], ocultas: [] };
}

let config = leerConfig();

// Tamaño y color por botón (lo que hace que el mando sea de cada uno).
const TAMANOS = [
  { id: "chico", nombre: "Chico" },
  { id: "grande", nombre: "Grande" },
  { id: "gigante", nombre: "Gigante" },
];
const COLORES = [
  { id: "", nombre: "Sin color" },
  { id: "violeta", nombre: "Violeta" },
  { id: "cian", nombre: "Cian" },
  { id: "verde", nombre: "Verde" },
  { id: "rojo", nombre: "Rojo" },
  { id: "ambar", nombre: "Ámbar" },
];
const tamanoDe = (id) => config.tamanos?.[id] ?? (config.grandes?.includes(id) ? "grande" : "chico");
const colorDe = (id) => config.colores?.[id] ?? "";
function fijar(campo, id, valor) {
  config[campo] = { ...(config[campo] || {}), [id]: valor };
  if (campo === "tamanos") config.grandes = (config.grandes || []).filter((x) => x !== id);
  guardarConfig();
}
let seleccionado = null; // botón de «Tus botones» que se está editando
const guardarConfig = () => guardado.escribir(CLAVE_CONFIG, JSON.stringify(config));

// ---------- Perfiles de un toque: el mando se arma solo según cómo lo vas a usar ----------

const CLAVE_PERFIL = "mando-perfil-v1";
const ICONO_PERFIL = {
  simple: '<rect x="6" y="2.5" width="12" height="19" rx="5"/><circle cx="12" cy="10" r="3.2"/><path d="M10 16h4"/>',
  series: '<rect x="2.5" y="4" width="19" height="13" rx="2.5"/><path d="M10 8.2v5.6l4.6-2.8z"/><path d="M8 20.5h8"/>',
  presentacion: '<rect x="3" y="3.5" width="18" height="12" rx="2"/><path d="M12 15.5v5M8.5 20.5h7"/><path d="m10.5 7.5 3 2-3 2"/>',
  completo: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
};
const PERFILES = [
  {
    id: "simple",
    nombre: "Simple",
    texto: "Pocos botones, bien grandes. Ideal para cualquiera.",
    config: { favoritos: ["MUTE", "VOL_DOWN", "VOL_UP", "POWER"], grandes: ["MUTE", "POWER"], ocultas: ["basicos", "navegacion", "reproduccion", "apps", "numeros"] },
  },
  {
    id: "series",
    nombre: "Series y pelis",
    texto: "Netflix, YouTube, play y volumen a mano.",
    config: { favoritos: ["PLAY_PAUSE", "APP_NETFLIX", "APP_YOUTUBE", "MUTE", "VOL_DOWN", "VOL_UP"], grandes: ["PLAY_PAUSE"], ocultas: ["numeros"] },
  },
  {
    id: "presentacion",
    nombre: "Presentación",
    texto: "Pasá diapositivas, pantalla completa y silencio.",
    config: { favoritos: ["RIGHT", "LEFT", "FULLSCREEN", "MUTE"], grandes: ["RIGHT"], ocultas: ["apps", "numeros", "reproduccion"] },
  },
  {
    id: "completo",
    nombre: "Completo",
    texto: "Todos los botones: navegación, apps y números.",
    config: { favoritos: [...FAVORITOS_INICIALES], grandes: [], ocultas: [] },
  },
];
const perfilActual = () => guardado.leer(CLAVE_PERFIL);

function aplicarPerfil(id) {
  const perfil = PERFILES.find((p) => p.id === id);
  if (!perfil) return;
  const base = JSON.parse(JSON.stringify(perfil.config));
  config = { ...base, tamanos: Object.fromEntries(base.grandes.map((id) => [id, "grande"])), colores: {}, grandes: [] };
  seleccionado = null;
  guardarConfig();
  guardado.escribir(CLAVE_PERFIL, id);
  render();
}

function botonPerfil(p, clase) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = clase;
  b.dataset.perfil = p.id;
  b.setAttribute("aria-pressed", String(perfilActual() === p.id));
  b.innerHTML = `<span class="${clase}-icono" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONO_PERFIL[p.id]}</svg></span><span class="${clase}-textos"><strong></strong><span></span></span>`;
  b.querySelector("strong").textContent = p.nombre;
  b.querySelector(`.${clase}-textos > span`).textContent = p.texto;
  return b;
}

// Hoja «¿Cómo lo vas a usar?»: aparece la primera vez, antes del recorrido.
function elegirPerfil(alTerminar) {
  const hoja = $("perfiles");
  const lista = $("perfiles-lista");
  lista.replaceChildren(...PERFILES.map((p) => botonPerfil(p, "perfil")));
  hoja.hidden = false;
  document.documentElement.classList.add("sin-scroll");
  lista.querySelector("button")?.focus();
  lista.onclick = (e) => {
    const b = e.target.closest("[data-perfil]");
    if (!b) return;
    navigator.vibrate?.(12);
    aplicarPerfil(b.dataset.perfil);
    hoja.hidden = true;
    document.documentElement.classList.remove("sin-scroll");
    alTerminar?.();
  };
}

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

// ---------- Modo nube: la sala vive en el puente, sin IP ni mismo wifi ----------

const nube = { canal: null, state: initialState, conectores: [], cola: [], timer: 0, deAgente: false };

function mostrarNube() {
  mostrarEstado({ state: nube.state, conectores: nube.conectores });
}

function enviarNube(accion) {
  // Se ve al instante en el celular; los toques seguidos viajan juntos para no saturar el puente.
  nube.state = applyAction(nube.state, accion);
  mostrarNube();
  nube.cola.push(accion);
  clearTimeout(nube.timer);
  nube.timer = setTimeout(() => {
    const a = nube.cola.splice(0, 20);
    nube.canal?.enviar({ t: "acciones", a }).catch(() => {
      $("error").textContent = "Sin conexión con la pantalla. Revisá internet.";
    });
  }, 120);
}

function conectarNube(sala) {
  return new Promise((resolve, reject) => {
    nube.canal?.cerrar();
    let listo = false;
    const plazo = setTimeout(() => {
      if (!listo) reject(Object.assign(new Error("sin pantalla"), { status: 404 }));
    }, 5000);
    nube.canal = unirseASala(
      sala,
      (m) => {
        if (m.t === "estado" && m.state) {
          // Si la notebook está en la sala, su estado (volumen real) manda.
          if (m.origen === "agente") nube.deAgente = true;
          else if (nube.deAgente) return;
          nube.state = m.state;
          mostrarNube();
          if (!listo) {
            listo = true;
            clearTimeout(plazo);
            resolve();
          }
        } else if (m.t === "agente") {
          nube.conectores = Array.isArray(m.conectores) ? m.conectores : [];
          mostrarNube();
        } else if (m.t === "acciones" && Array.isArray(m.a)) {
          // Otro celular tocó algo: lo reflejamos acá también.
          for (const a of m.a) if (ACCIONES.includes(a)) nube.state = applyAction(nube.state, a);
          mostrarNube();
        }
      },
      (on) => {
        marcarConexion(on);
        if (on && !listo) nube.canal.enviar({ t: "hola" }).catch(() => {});
      },
    );
  });
}

async function enviar(accion) {
  $("error").textContent = "";
  navigator.vibrate?.(12);
  if (nube.canal) return enviarNube(accion);
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

// Logos de las apps (SVG en línea, sin pedir nada a internet). Solo visual: el nombre sigue como texto y aria-label.
const LOGOS = {
  APP_NETFLIX:
    '<svg viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#000"/><path d="M13 8h5v24l-5 1z" fill="#b1060f"/><path d="M22 8h5v25l-5-1z" fill="#b1060f"/><path d="M13 8h5l9 25h-5z" fill="#e50914"/></svg>',
  APP_YOUTUBE:
    '<svg viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#fff"/><rect x="6" y="11" width="28" height="18" rx="5.5" fill="#ff0033"/><path d="M17.5 15.5v9l8-4.5z" fill="#fff"/></svg>',
  APP_DISNEY:
    '<svg viewBox="0 0 40 40"><defs><radialGradient id="lg-disney" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#1f56d8"/><stop offset=".6" stop-color="#0d2070"/><stop offset="1" stop-color="#040a2e"/></radialGradient><linearGradient id="lg-disney-arco" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".35" stop-color="#bfe6ff"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect width="40" height="40" rx="10" fill="url(#lg-disney)"/><path d="M5 23.5C10 12.5 27 10 35.5 19.5" fill="none" stroke="url(#lg-disney-arco)" stroke-width="1.3" stroke-linecap="round"/><text x="14.5" y="26.5" text-anchor="middle" font-family="\'Snell Roundhand\', \'Apple Chancery\', \'Brush Script MT\', \'Segoe Script\', cursive" font-weight="700" font-size="10" fill="#fff">Disney</text><path d="M32.5 22v7M29 25.5h7" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/></svg>',
  APP_PRIME:
    '<svg viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#00a8e1"/><text x="20" y="21" text-anchor="middle" font-family="system-ui, -apple-system, Helvetica, Arial, sans-serif" font-weight="800" font-size="10.5" letter-spacing="-.3" fill="#fff">prime</text><path d="M9 25c6 4.5 16 4.5 22 0" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M28 23.2l3.4 1.6-1.4 3.4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  APP_SPOTIFY:
    '<svg viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#121212"/><circle cx="20" cy="20" r="13" fill="#1db954"/><g fill="none" stroke="#121212" stroke-linecap="round"><path d="M12 16.5c5.5-1.8 11.5-1.3 16 1.3" stroke-width="2.6"/><path d="M13 20.8c4.6-1.4 9.4-1 13 1.1" stroke-width="2.2"/><path d="M14 24.8c3.6-1 7.2-.7 10 .9" stroke-width="1.8"/></g></svg>',
};

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

  if (LOGOS[b.id]) {
    const logo = document.createElement("span");
    logo.className = "boton__logo";
    logo.setAttribute("aria-hidden", "true");
    logo.innerHTML = LOGOS[b.id];
    el.append(logo);
  } else if (b.icono) {
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
  if (modo === "editar" && id !== "favoritos" && id !== "estilos") {
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

  // Estilos rápidos (solo en Editar): rearma todo el mando de un toque.
  if (modo === "editar") {
    const estilos = crearSeccion("estilos", "Estilos rápidos");
    estilos.seccion.dataset.tour = "estilos";
    estilos.rejilla.append(...PERFILES.map((p) => botonPerfil(p, "estilo")));
    mando.append(estilos.seccion);
  }

  // Tus botones
  const fav = crearSeccion("favoritos", "Tus botones");
  if (!config.favoritos.length) {
    const vacio = document.createElement("p");
    vacio.className = "favoritos__vacio";
    vacio.textContent = modo === "editar" ? "Tocá ☆ en cualquier botón para sumarlo acá." : "Todavía no elegiste botones. Tocá Editar.";
    fav.rejilla.append(vacio);
  }
  config.favoritos.forEach((id) => {
    const item = document.createElement("div");
    item.className = "favorito";
    item.dataset.id = id;
    const tamano = tamanoDe(id);
    if (tamano !== "chico") item.classList.add(`is-${tamano}`);
    if (seleccionado === id && modo === "editar") item.classList.add("is-seleccionado");
    const boton = crearBoton(BOTON[id], { favorito: true });
    if (colorDe(id)) boton.dataset.color = colorDe(id);
    if (modo === "editar") {
      boton.setAttribute("aria-label", `${BOTON[id].nombre}: tocá para editar o arrastrá para mover`);
      const asa = document.createElement("span");
      asa.className = "favorito__asa";
      asa.setAttribute("aria-hidden", "true");
      asa.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
      boton.append(asa);
    }
    item.append(boton);
    fav.rejilla.append(item);
  });
  if (modo === "editar" && config.favoritos.length) {
    const ayuda = document.createElement("p");
    ayuda.className = "favoritos__ayuda";
    ayuda.textContent = "Tocá un botón para cambiar su tamaño o color · Mantené y arrastrá para moverlo";
    fav.seccion.append(ayuda);
  }
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

  const estilo = t.closest("[data-perfil]");
  if (estilo) {
    navigator.vibrate?.(12);
    return aplicarPerfil(estilo.dataset.perfil);
  }

  const ojo = t.closest("[data-ojo]");
  if (ojo) {
    const id = ojo.dataset.ojo;
    config.ocultas = config.ocultas.includes(id) ? config.ocultas.filter((x) => x !== id) : [...config.ocultas, id];
    guardarConfig();
    return render();
  }

  const boton = t.closest(".boton");
  if (!boton) return;
  const id = boton.dataset.accion;

  if (modo === "editar") {
    // En Editar ningún botón manda acciones.
    if (arrastre.acabaDeMover) return;
    if (boton.closest(".seccion--favoritos")) {
      // Tocar uno de tus botones lo selecciona para cambiarle tamaño o color.
      seleccionado = seleccionado === id ? null : id;
      render();
      return pintarBarraEdicion();
    }
    // Tocar uno de las secciones lo suma (o lo saca) de tus botones.
    if (config.favoritos.includes(id)) {
      config.favoritos = config.favoritos.filter((x) => x !== id);
      if (seleccionado === id) seleccionado = null;
    } else {
      config.favoritos = [...config.favoritos, id];
      seleccionado = id;
      navigator.vibrate?.(12);
    }
    guardarConfig();
    render();
    pintarBarraEdicion();
    if (seleccionado === id) document.querySelector(`.favorito[data-id="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  pulso(boton);
  enviar(id);
});

// ---------- Barra de edición: tamaño, color y quitar del botón seleccionado ----------

function pintarBarraEdicion() {
  const barra = $("barra-edicion");
  if (modo !== "editar" || !seleccionado || !config.favoritos.includes(seleccionado)) {
    barra.hidden = true;
    body.classList.remove("con-barra");
    return;
  }
  barra.hidden = false;
  body.classList.add("con-barra");
  $("barra-nombre").textContent = BOTON[seleccionado].nombre;
  const tamanos = $("barra-tamanos");
  tamanos.replaceChildren(
    ...TAMANOS.map((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.tamano = t.id;
      b.textContent = t.nombre;
      b.setAttribute("aria-pressed", String(tamanoDe(seleccionado) === t.id));
      return b;
    }),
  );
  const colores = $("barra-colores");
  colores.replaceChildren(
    ...COLORES.map((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "muestra";
      b.dataset.colorElegir = c.id || "ninguno";
      b.setAttribute("aria-label", c.nombre);
      b.setAttribute("aria-pressed", String(colorDe(seleccionado) === c.id));
      return b;
    }),
  );
  // Que el botón elegido quede a la vista, arriba de la barra, para ver cada cambio al instante.
  (() => {
    const el = document.querySelector(`.favorito[data-id="${seleccionado}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const tope = innerHeight - barra.offsetHeight - 16;
    if (r.bottom > tope || r.top < 70) scrollBy({ top: r.bottom > tope ? r.bottom - tope : r.top - 80 });
  })();
}

$("barra-edicion").addEventListener("click", (e) => {
  if (!seleccionado) return;
  const t = e.target;
  const tamano = t.closest("[data-tamano]");
  const color = t.closest("[data-color-elegir]");
  if (tamano) fijar("tamanos", seleccionado, tamano.dataset.tamano);
  else if (color) fijar("colores", seleccionado, color.dataset.colorElegir === "ninguno" ? "" : color.dataset.colorElegir);
  else if (t.closest("#barra-quitar")) {
    config.favoritos = config.favoritos.filter((x) => x !== seleccionado);
    guardarConfig();
    seleccionado = null;
  } else if (t.closest("#barra-listo")) seleccionado = null;
  else return;
  navigator.vibrate?.(10);
  render();
  pintarBarraEdicion();
});

// ---------- Arrastrar para mover (mouse y dedo) ----------

const arrastre = { id: null, x: 0, y: 0, moviendo: false, acabaDeMover: false, timer: 0 };

$("mando").addEventListener("pointerdown", (e) => {
  if (modo !== "editar" || (e.button !== undefined && e.button !== 0)) return;
  const item = e.target.closest(".seccion--favoritos .favorito");
  if (!item) return;
  Object.assign(arrastre, { id: item.dataset.id, x: e.clientX, y: e.clientY, moviendo: false, acabaDeMover: false });
  // Con el dedo, mantener apretado un momento también lo «levanta».
  clearTimeout(arrastre.timer);
  arrastre.timer = setTimeout(() => levantar(item), 280);
});

function levantar(item) {
  if (!arrastre.id || arrastre.moviendo) return;
  arrastre.moviendo = true;
  item.classList.add("is-arrastrando");
  body.classList.add("arrastrando");
  navigator.vibrate?.(15);
}

addEventListener("pointermove", (e) => {
  if (!arrastre.id) return;
  const item = document.querySelector(`.favorito[data-id="${arrastre.id}"]`);
  if (!item) return;
  if (!arrastre.moviendo) {
    if (Math.hypot(e.clientX - arrastre.x, e.clientY - arrastre.y) < 8) return;
    levantar(item);
  }
  e.preventDefault();
  const debajo = document.elementFromPoint(e.clientX, e.clientY)?.closest(".seccion--favoritos .favorito");
  if (!debajo || debajo === item) return;
  const r = debajo.getBoundingClientRect();
  const despues = e.clientY > r.top + r.height / 2 || (Math.abs(e.clientY - (r.top + r.height / 2)) < r.height / 4 && e.clientX > r.left + r.width / 2);
  debajo.parentNode.insertBefore(item, despues ? debajo.nextSibling : debajo);
}, { passive: false });

function soltar() {
  clearTimeout(arrastre.timer);
  if (!arrastre.id) return;
  if (arrastre.moviendo) {
    config.favoritos = [...document.querySelectorAll(".seccion--favoritos .favorito")].map((el) => el.dataset.id);
    guardarConfig();
    arrastre.acabaDeMover = true;
    setTimeout(() => (arrastre.acabaDeMover = false), 50);
    body.classList.remove("arrastrando");
    render();
    pintarBarraEdicion();
  }
  arrastre.id = null;
  arrastre.moviendo = false;
}
addEventListener("pointerup", soltar);
addEventListener("pointercancel", soltar);

function cambiarModo(nuevo) {
  modo = nuevo;
  if (nuevo !== "editar") seleccionado = null;
  render();
  pintarBarraEdicion();
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
  if (esSalaNube(valor)) {
    const sala = normalizarSala(valor);
    try {
      await conectarNube(sala);
      codigo = sala;
      guardado.escribir(CLAVE_CODIGO, sala, sessionStorage);
      abrirMando();
    } catch {
      nube.canal?.cerrar();
      nube.canal = null;
      pantallaCodigo("No encuentro esa pantalla. Revisá el código o que la pantalla siga abierta.");
    }
    return;
  }
  try {
    const datos = await post("/api/entrar", { codigo: valor });
    codigo = valor;
    guardado.escribir(CLAVE_CODIGO, valor, sessionStorage);
    mostrarEstado(datos);
    escuchar();
    // Puntero: está en la puerta segura (https). Desde la entrada normal se ofrece con un botón,
    // así el aviso del certificado aparece solo si alguien elige usarlo.
    if (datos.punteroPuerto && location.protocol === "http:") {
      $("abrir-puntero").href = `https://${location.hostname}:${datos.punteroPuerto}/puntero/index.html?c=${encodeURIComponent(valor)}`;
      $("abrir-puntero").hidden = false;
    }
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
  const guiar = () => setTimeout(() => recorrido.siPrimeraVez("mando"), 500);
  if (!perfilActual()) setTimeout(() => elegirPerfil(guiar), 300);
  else guiar();
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
      { objetivo: ['#abrir-puntero', 'a[href="/puntero/index.html"]', '[data-tour="modo"]'], titulo: "Hacelo tuyo", texto: "Tocá «Editar» para elegir tus botones. Y con «Puntero», movés el celular en el aire para mover el cursor." },
    ],
  },
  editar: {
    id: "editar-v1",
    etiqueta: "Editar",
    pasos: [
      { objetivo: '[data-tour="estilos"]', titulo: "Un toque y listo", texto: "Elegí un estilo y el mando se arma solo. Después lo ajustás a tu gusto." },
      { objetivo: '.seccion--basicos .boton', titulo: "Sumá los que quieras", texto: "Tocá cualquier botón de abajo y pasa a «Tus botones»." },
      { objetivo: '[data-tour="favoritos"] .favorito', titulo: "Hacelo a tu medida", texto: "Tocá uno de tus botones para cambiarle el tamaño o el color. Mantenelo apretado y arrastralo para moverlo." },
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

const parametros = new URLSearchParams(location.search);
const codigoInicial = parametros.get("sala") || parametros.get("c") || guardado.leer(CLAVE_CODIGO, sessionStorage);
if (codigoInicial) {
  $("codigo").value = codigoInicial;
  conectar(codigoInicial); // entró por el QR: directo al mando
} else {
  pantallaCodigo();
}
