/**
 * Home = TV + QR + chat Mandy (notebook).
 * El mando completo sigue en /celular?c=CODIGO
 */

import { renderTV, unlockTVAudio } from "./tv.js";
import { initialState } from "./tv-state.js";
import { CHANNELS } from "./catalogo.js";
import { nombreDe } from "./mando-botones.js";
import { mountAsistente } from "./asistente.js";

const $ = (id) => document.getElementById(id);
const tvEl = $("tv");
const ahoraEl = $("ahora");

let state = { ...initialState };
let codigo = null;
let ultimaVista = 0;
let ocultarAviso = null;
let asistenteListo = false;
/** @type {{ sincronizar?: (chat: unknown) => void } | null} */
let mandy = null;

function metaActual() {
  const i = ((state.channel - 1) % CHANNELS.length + CHANNELS.length) % CHANNELS.length;
  return { ...CHANNELS[i], channel: i + 1 };
}

function pintarAhora() {
  const m = metaActual();
  const flag = m.live ? " · EN VIVO" : m.hablada ? " · HABLADA" : "";
  ahoraEl.textContent = `CH ${m.channel} · ${m.name}${flag}`;
}

function paint() {
  renderTV(tvEl, state);
  pintarAhora();
}

function avisar(ultima) {
  if (!ultima || ultima.hora <= ultimaVista) return;
  ultimaVista = ultima.hora;
  const quien = ultima.origen === "celular" ? "Desde el celular" : "Desde la notebook";
  const el = $("aviso");
  el.textContent = `${quien}: ${nombreDe(ultima.accion)}`;
  el.classList.add("is-visible");
  clearTimeout(ocultarAviso);
  ocultarAviso = setTimeout(() => el.classList.remove("is-visible"), 2200);
}

function aplicar(datos) {
  if (datos.state) {
    state = datos.state;
    paint();
  }
  avisar(datos.ultima);
  if (datos.chat) mandy?.sincronizar?.(datos.chat);
}

async function enviarAccion(accion) {
  if (!codigo) return;
  try {
    await fetch("/api/accion", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ codigo, accion }),
    });
  } catch {
    // el poll refresca igual
  }
}

function montarMandy() {
  const root = $("asistente");
  if (!root || asistenteListo) return;
  asistenteListo = true;
  let calladoPorMic = false;
  mandy = mountAsistente({
    root,
    origen: "notebook",
    getCodigo: () => codigo,
    enviar: enviarAccion,
    onMicInicio: async () => {
      if (state && !state.muted) {
        calladoPorMic = true;
        await enviarAccion("MUTE");
      }
    },
    onMicFin: async () => {
      if (calladoPorMic) {
        calladoPorMic = false;
        if (state?.muted) await enviarAccion("MUTE");
      }
    },
  });
}

function qrSrc(data) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=6&data=${encodeURIComponent(data)}`;
}

async function refrescarPuntero() {
  const bloque = $("bloque-puntero");
  const link = $("link-puntero");
  const texto = $("puntero-texto");
  if (!bloque || !link) return;

  const codigoQ = codigo ? `?c=${encodeURIComponent(codigo)}` : "";
  link.href = `/puntero/${codigoQ}`;

  // Local (npm run sala:puntero / MANDO.command): el server expone /puntero/info.
  try {
    const res = await fetch("/puntero/info", { cache: "no-store" });
    if (res.ok) {
      const info = await res.json();
      if (info?.puntero) {
        bloque.dataset.listo = "1";
        texto.textContent = "Listo en esta compu · abrí desde el celu o acá";
        // info.url es el celular; el puntero vive en /puntero/
        link.href = `/puntero/index.html${codigoQ}`;
        return;
      }
    }
  } catch {
    // en Vercel no hay server de puntero
  }

  bloque.dataset.listo = "0";
  texto.textContent = "Mové el celu y movés el cursor de la compu";
}

function mostrarSala(info) {
  codigo = info.codigo;
  const joinUrl =
    info.urls?.[0] || `${location.origin}/celular?c=${info.codigo}`;
  $("codigo").textContent = info.codigo;
  $("url").textContent = joinUrl.replace(/^https?:\/\//, "");
  $("link-cel").href = `/celular?c=${encodeURIComponent(info.codigo)}`;
  const qr = $("qr");
  qr.hidden = false;
  qr.src = qrSrc(joinUrl);
  qr.alt = `QR para abrir Mandy en ${joinUrl}`;
  $("unirse").hidden = false;
  ultimaVista = info.ultima?.hora || 0;
  aplicar(info);
  montarMandy();
  refrescarPuntero();
}

// Si abrís / desde el teléfono, saltá directo al mando + Mandy.
const ua = navigator.userAgent || "";
const esMovil = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
if (esMovil && !new URLSearchParams(location.search).has("tv")) {
  location.replace(`/celular${location.search || ""}`);
}

paint();

try {
  const res = await fetch("/api/info");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  mostrarSala(await res.json());
} catch {
  $("aviso").textContent = "No se pudo abrir la sala. Recargá la página.";
  $("aviso").classList.add("is-visible");
}

setInterval(async () => {
  try {
    const res = await fetch("/api/estado", { cache: "no-store" });
    if (!res.ok) return;
    aplicar(await res.json());
  } catch {
    // ignore
  }
}, 700);

// Si arrancás MANDO.command después, el bloque pasa a «listo».
setInterval(() => {
  refrescarPuntero().catch(() => {});
}, 4000);

window.addEventListener(
  "pointerdown",
  () => {
    unlockTVAudio(tvEl);
    paint();
  },
  { once: true, passive: true },
);
