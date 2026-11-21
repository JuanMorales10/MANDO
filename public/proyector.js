// Pantalla del proyector: TV en vivo, QR y código para el celular.

import { renderTV, unlockTVAudio } from "./tv.js";
import { initialState } from "./tv-state.js";
import { nombreDe } from "./mando-botones.js";

const $ = (id) => document.getElementById(id);
const tvEl = $("tv");
let ultimaVista = 0;
let ocultarAviso = null;
let state = { ...initialState };

renderTV(tvEl, state);

function pintarConectores(conectores = []) {
  const lista = $("conectores");
  if (!lista) return;
  lista.replaceChildren();
  for (const item of [
    { nombre: "TV simulada", ok: true, detalle: "En pantalla" },
    ...conectores,
  ]) {
    const li = document.createElement("li");
    li.dataset.ok = String(item.ok);
    const nombre = document.createElement("strong");
    nombre.textContent = `${item.ok ? "✔" : "⚠"} ${item.nombre}`;
    const detalle = document.createElement("span");
    detalle.textContent = item.detalle || "";
    li.append(nombre, detalle);
    lista.append(li);
  }
}

function avisar(ultima) {
  if (!ultima || ultima.hora <= ultimaVista) return;
  ultimaVista = ultima.hora;
  const quien =
    ultima.origen === "celular" ? "📱 Desde un celular" : "💻 Desde la notebook";
  $("aviso").textContent = `${quien}: ${nombreDe(ultima.accion)}`;
  $("aviso").classList.add("is-visible");
  clearTimeout(ocultarAviso);
  ocultarAviso = setTimeout(() => $("aviso").classList.remove("is-visible"), 2200);
}

function aplicar(datos) {
  if (datos.state) {
    state = datos.state;
    renderTV(tvEl, state);
  }
  pintarConectores(datos.conectores || []);
  avisar(datos.ultima);
}

function qrSrc(data) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(data)}`;
}

function mostrarSala(info) {
  const joinUrl =
    info.urls?.[0] ||
    `${location.origin}/celular?c=${info.codigo}`;
  $("codigo").textContent = info.codigo;
  $("url").textContent = joinUrl.replace(/^https?:\/\//, "");
  const qr = $("qr");
  if (qr) {
    qr.hidden = false;
    qr.src = qrSrc(joinUrl);
    qr.alt = `QR para abrir ${joinUrl}`;
  }
  $("unirse").hidden = false;
  ultimaVista = info.ultima?.hora || 0;
  aplicar(info);
}

try {
  const res = await fetch("/api/info");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  mostrarSala(await res.json());
} catch {
  $("aviso").textContent =
    "No se pudo abrir la sala. Recargá la página o corré npm run sala en local.";
  $("aviso").classList.add("is-visible");
}

async function refrescar() {
  try {
    const res = await fetch("/api/estado", { cache: "no-store" });
    if (!res.ok) return;
    aplicar(await res.json());
  } catch {
    // ignore
  }
}

setInterval(refrescar, 700);

try {
  const eventos = new EventSource("/api/eventos");
  eventos.onmessage = (mensaje) => {
    try {
      aplicar(JSON.parse(mensaje.data));
    } catch {
      // ignore
    }
  };
} catch {
  // Polling alcanza.
}

function activarSonido() {
  unlockTVAudio(tvEl);
  renderTV(tvEl, state);
}

window.addEventListener("pointerdown", activarSonido, { once: true, passive: true });
window.addEventListener("keydown", activarSonido, { once: true });
