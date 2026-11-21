/**
 * /ai = TV + QR + chat Mandy (notebook).
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
  try {
    renderTV(tvEl, state);
  } catch (error) {
    console.warn("TV render:", error);
  }
  try {
    pintarAhora();
  } catch {
    // ignore
  }
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
  try {
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
  } catch (error) {
    console.warn("Mandy:", error);
  }
}

/** Varias fuentes por si una CDN bloquea el hotlink. */
function fuentesQr(texto) {
  const q = encodeURIComponent(texto);
  return [
    `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=6&data=${q}`,
    `https://quickchart.io/qr?size=280&margin=2&text=${q}`,
  ];
}

function pintarQr(img, texto) {
  if (!img || !texto) return;
  const fuentes = fuentesQr(texto);
  let i = 0;
  img.referrerPolicy = "no-referrer";
  img.decoding = "async";
  img.onerror = () => {
    i += 1;
    if (i < fuentes.length) img.src = fuentes[i];
  };
  img.hidden = false;
  img.src = fuentes[0];
  img.alt = `QR para abrir ${texto}`;
}

async function refrescarPuntero() {
  const bloque = $("bloque-puntero");
  const link = $("link-puntero");
  const texto = $("puntero-texto");
  if (!bloque || !link) return;

  const codigoQ = codigo ? `?c=${encodeURIComponent(codigo)}` : "";
  link.href = `/puntero/index.html${codigoQ}`;

  // Local (npm run sala:puntero / MANDO.command): el server expone /puntero/info.
  try {
    const res = await fetch("/puntero/info", { cache: "no-store" });
    if (res.ok) {
      const info = await res.json().catch(() => null);
      if (info?.puntero) {
        bloque.dataset.listo = "1";
        if (texto) texto.textContent = "Listo en esta compu · abrí desde el celu o acá";
        link.href = `/puntero/index.html${codigoQ}`;
        return;
      }
    }
  } catch {
    // en Vercel no hay server de puntero
  }

  bloque.dataset.listo = "0";
  if (texto) texto.textContent = "Mové el celu y movés el cursor de la compu";
}

function mostrarSala(info) {
  codigo = info.codigo;
  const joinUrl =
    info.urls?.[0] || `${location.origin}/celular?c=${info.codigo}`;

  // Primero el QR (aunque falle la TV o Mandy).
  $("codigo").textContent = info.codigo;
  $("url").textContent = joinUrl.replace(/^https?:\/\//, "");
  $("link-cel").href = `/celular?c=${encodeURIComponent(info.codigo)}`;
  pintarQr($("qr"), joinUrl);
  $("unirse").hidden = false;

  ultimaVista = info.ultima?.hora || 0;
  aplicar(info);
  montarMandy();
  refrescarPuntero().catch(() => {});
}

// Si abrís /ai desde el teléfono, saltá directo al mando + Mandy.
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
} catch (error) {
  console.warn("Sala:", error);
  $("aviso").textContent = "No se pudo abrir la sala. Recargá la página.";
  $("aviso").classList.add("is-visible");
  // Fallback: igual mostramos un QR a /celular con el código fijo de demo.
  const fallback = `${location.origin}/celular?c=2026`;
  $("codigo").textContent = "2026";
  $("url").textContent = fallback.replace(/^https?:\/\//, "");
  $("link-cel").href = `/celular?c=2026`;
  pintarQr($("qr"), fallback);
  $("unirse").hidden = false;
  codigo = "2026";
  montarMandy();
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
