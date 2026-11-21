import { mountRemote } from "./remote.js";

const CLAVE_CODIGO = "mando-sala";

const gate = document.querySelector("#gate");
const sala = document.querySelector("#sala");
const form = document.querySelector("#form-codigo");
const input = document.querySelector("#codigo");
const errorCodigo = document.querySelector("#error-codigo");
const errorEl = document.querySelector("#error");
const conexion = document.querySelector("#conexion");
const tvChip = document.querySelector("#tv-chip");
const remoteRoot = document.querySelector("#remote-root");

let codigo = null;
let eventos = null;
let remoteMounted = false;

async function post(ruta, cuerpo) {
  const res = await fetch(ruta, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(datos.error || `Error ${res.status}`), {
      status: res.status,
    });
  }
  return datos;
}

function marcarConexion(on) {
  conexion.dataset.estado = on ? "on" : "off";
  conexion.textContent = on ? "Conectado" : "Reconectando…";
}

function mostrarEstado({ state } = {}) {
  if (!state) return;
  if (!state.power) {
    tvChip.textContent = "TV apagada";
    return;
  }
  if (state.muted) {
    tvChip.textContent = `Silencio · vol ${state.volume} · ch ${state.channel}`;
    return;
  }
  tvChip.textContent = `Vol ${state.volume} · Canal ${state.channel}`;
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
      // ignore
    }
  };
}

async function enviar(accion) {
  errorEl.textContent = "";
  navigator.vibrate?.(12);
  try {
    await post("/api/accion", { codigo, accion });
  } catch (error) {
    if (error.status === 403) {
      volverAlCodigo("El código cambió. Escaneá el QR de nuevo.");
      return;
    }
    errorEl.textContent = `No se pudo enviar ${accion}`;
  }
}

function montarMando() {
  if (remoteMounted) return;
  mountRemote(remoteRoot, enviar);
  remoteMounted = true;
}

async function conectar(valor) {
  const limpio = String(valor || "").trim();
  errorCodigo.textContent = "";
  try {
    const datos = await post("/api/entrar", { codigo: limpio });
    codigo = limpio;
    sessionStorage.setItem(CLAVE_CODIGO, limpio);
    gate.hidden = true;
    sala.hidden = false;
    montarMando();
    escuchar();
    mostrarEstado(datos);
    marcarConexion(true);
  } catch (error) {
    errorCodigo.textContent =
      error.status === 403
        ? "Ese código no es. Mirá el del proyector."
        : "No se pudo conectar. ¿Misma WiFi?";
  }
}

function volverAlCodigo(motivo) {
  codigo = null;
  sessionStorage.removeItem(CLAVE_CODIGO);
  eventos?.close();
  gate.hidden = false;
  sala.hidden = true;
  marcarConexion(false);
  errorCodigo.textContent = motivo;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  conectar(input.value);
});

const desdeQr =
  new URLSearchParams(location.search).get("c") ||
  sessionStorage.getItem(CLAVE_CODIGO);

if (desdeQr) {
  input.value = desdeQr;
  conectar(desdeQr);
}
