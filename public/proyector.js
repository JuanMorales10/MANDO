import { renderTV, unlockTVAudio } from "./tv.js";
import { initialState } from "./tv-state.js";

const tvRoot = document.querySelector("#tv-root");
const codigoEl = document.querySelector("#codigo");
const urlEl = document.querySelector("#url");
const qrEl = document.querySelector("#qr");
const avisoEl = document.querySelector("#aviso");

let ultimaVista = 0;
let state = { ...initialState };

renderTV(tvRoot, state);

function qrSrc(data) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(data)}`;
}

function avisar(ultima) {
  if (!ultima || ultima.hora <= ultimaVista) return;
  ultimaVista = ultima.hora;
  const quien = ultima.origen === "celular" ? "Desde el celular" : "Desde la notebook";
  avisoEl.textContent = `${quien}: ${ultima.accion}`;
}

function aplicar(datos) {
  if (datos.state) {
    state = datos.state;
    renderTV(tvRoot, state);
  }
  avisar(datos.ultima);
}

try {
  const res = await fetch("/api/info");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const info = await res.json();
  const joinUrl = info.urls?.[0];

  codigoEl.textContent = info.codigo;
  urlEl.textContent = joinUrl?.replace(/^https?:\/\//, "") || "Conectá la notebook al WiFi";
  if (joinUrl) {
    qrEl.src = qrSrc(joinUrl);
    qrEl.alt = `QR para abrir ${joinUrl}`;
  }
  ultimaVista = info.ultima?.hora || 0;
  aplicar(info);
  avisoEl.textContent = "Escaneá el QR con el celular (misma WiFi)";
} catch {
  avisoEl.textContent = "Abrí esta página con: npm run sala";
}

const eventos = new EventSource("/api/eventos");
eventos.onmessage = (mensaje) => {
  try {
    aplicar(JSON.parse(mensaje.data));
  } catch {
    // ignore
  }
};

window.addEventListener(
  "pointerdown",
  () => {
    unlockTVAudio(tvRoot);
    renderTV(tvRoot, state);
  },
  { once: true, passive: true },
);
