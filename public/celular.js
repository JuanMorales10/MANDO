// Mando en el celular: el mismo mando configurable (remote.js) manda cada acción
// al servidor de la notebook, que la aplica a la TV y a los aparatos reales.

import { mountRemote } from "./remote.js";

const CLAVE_CODIGO = "mando-sala";
const NOMBRES = {
  POWER: "Encendido",
  MUTE: "Silencio",
  VOL_UP: "Volumen +",
  VOL_DOWN: "Volumen −",
  CH_UP: "Canal +",
  CH_DOWN: "Canal −",
};

const $ = (id) => document.getElementById(id);
const conexion = $("conexion");
let codigo = null;
let eventos = null;

function leerCodigoGuardado() {
  try {
    return sessionStorage.getItem(CLAVE_CODIGO);
  } catch {
    return null;
  }
}

function guardarCodigo(valor) {
  try {
    sessionStorage.setItem(CLAVE_CODIGO, valor);
  } catch {
    // Sin almacenamiento: se vuelve a pedir el código al recargar.
  }
}

function marcarConexion(estado, texto) {
  conexion.dataset.estado = estado;
  conexion.textContent = texto;
}

// El mando no conoce la TV; esta página sí, así que marca qué está activo.
function marcarBotones(state) {
  const silencio = document.querySelector('#remote [data-action="MUTE"]');
  if (silencio) {
    silencio.dataset.activo = String(state.muted);
    silencio.setAttribute("aria-pressed", String(state.muted));
  }
  const encendido = document.querySelector('.cel__extra [data-accion="POWER"]');
  if (encendido) {
    encendido.dataset.activo = String(!state.power);
    encendido.setAttribute("aria-pressed", String(!state.power));
  }
}

function mostrarEstado({ state, conectores = [] }) {
  if (!state) return;
  marcarBotones(state);
  document.body.dataset.tv = !state.power ? "apagada" : state.muted ? "silencio" : "sonando";
  const partes = [
    state.power ? (state.muted ? "🔇 Silencio" : `🔊 Volumen ${state.volume}`) : "⏻ Apagada",
    `Canal ${state.channel}`,
  ];
  const caidos = conectores.filter((c) => !c.ok).map((c) => c.nombre);
  if (caidos.length) partes.push(`⚠ ${caidos.join(", ")}`);
  $("estado").textContent = partes.join(" · ");
}

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
  $("error-mando").textContent = "";
  navigator.vibrate?.(15);
  try {
    await post("/api/accion", { codigo, accion });
  } catch (error) {
    if (error.status === 403) return salir("El código cambió. Volvé a escribirlo.");
    $("error-mando").textContent = `No se pudo enviar ${NOMBRES[accion] || accion}: ${error.message}`;
  }
}

function escuchar() {
  eventos?.close();
  eventos = new EventSource("/api/eventos");
  eventos.onopen = () => marcarConexion("on", "Conectado");
  eventos.onerror = () => marcarConexion("off", "Reconectando…");
  eventos.onmessage = (mensaje) => {
    try {
      mostrarEstado(JSON.parse(mensaje.data));
    } catch {
      // Mensaje incompleto: esperamos el próximo.
    }
  };
}

function salir(motivo) {
  eventos?.close();
  codigo = null;
  $("mando").hidden = true;
  $("entrar").hidden = false;
  $("error-entrar").textContent = motivo || "";
  marcarConexion("off", "Sin conectar");
}

let montado = false;
async function entrar(valor) {
  $("error-entrar").textContent = "";
  try {
    const datos = await post("/api/entrar", { codigo: valor });
    codigo = valor;
    guardarCodigo(valor);
    $("entrar").hidden = true;
    $("mando").hidden = false;
    if (!montado) {
      mountRemote($("remote"), enviar);
      const extras = document.querySelectorAll(".cel__extra [data-accion]");
      for (const boton of extras) {
        boton.addEventListener("click", () => enviar(boton.dataset.accion));
      }
      // En Editar ningún botón manda acciones, tampoco los de abajo.
      const remote = $("remote");
      const sincronizarModo = () => {
        const editando = remote.classList.contains("is-edit");
        for (const boton of extras) boton.disabled = editando;
      };
      new MutationObserver(sincronizarModo).observe(remote, { attributes: true, attributeFilter: ["class"] });
      sincronizarModo();
      montado = true;
    }
    mostrarEstado(datos);
    escuchar();
  } catch (error) {
    salir(error.status === 403 ? "Código incorrecto. Revisalo en el proyector." : `No llego a la notebook: ${error.message}`);
  }
}

$("entrar").addEventListener("submit", (evento) => {
  evento.preventDefault();
  entrar($("codigo").value.trim());
});

// Un enlace como celular.html?c=1234 conecta directo.
const inicial = new URLSearchParams(location.search).get("c") || leerCodigoGuardado();
if (inicial) {
  $("codigo").value = inicial;
  entrar(inicial);
}
