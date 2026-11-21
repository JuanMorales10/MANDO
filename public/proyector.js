// Pantalla del proyector: TV simulada en vivo, código para unirse y aparatos conectados.

import { renderTV } from "./tv.js";
import { initialState, applyAction } from "./tv-state.js";
import { nombreDe, ACCIONES } from "./mando-botones.js";
import { nuevaSala, normalizarSala, unirseASala } from "./puente.js";


const $ = (id) => document.getElementById(id);
const tvEl = $("tv");
let ultimaVista = 0;
let ocultarAviso = null;

renderTV(tvEl, initialState);

function pintarConectores(conectores = []) {
  const lista = $("conectores");
  lista.replaceChildren();
  for (const item of [{ nombre: "TV simulada", ok: true, detalle: "En pantalla" }, ...conectores]) {
    const li = document.createElement("li");
    li.dataset.ok = String(item.ok);
    const nombre = document.createElement("strong");
    nombre.textContent = item.nombre;
    const detalle = document.createElement("span");
    detalle.textContent = item.detalle || "";
    li.append(nombre, detalle);
    lista.append(li);
  }
}

function avisar(ultima) {
  if (!ultima || ultima.hora <= ultimaVista) return;
  ultimaVista = ultima.hora;
  const quien = ultima.origen === "celular" ? "Desde un celular" : "Desde la notebook";
  $("aviso").textContent = `${quien}: ${nombreDe(ultima.accion)}`;
  $("aviso").classList.add("is-visible");
  clearTimeout(ocultarAviso);
  ocultarAviso = setTimeout(() => $("aviso").classList.remove("is-visible"), 2200);
}

function aplicar(datos) {
  if (datos.state) renderTV(tvEl, datos.state);
  pintarConectores(datos.conectores);
  avisar(datos.ultima);
}

function qrSrc(data) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(data)}`;
}

function mostrarCodigo(codigo, direccion, joinUrl) {
  $("codigo").replaceChildren(...String(codigo).split("").map((d) => {
    const casilla = document.createElement("span");
    casilla.className = "pro__digito";
    casilla.textContent = d;
    return casilla;
  }));
  $("codigo").setAttribute("aria-label", `Código ${codigo}`);
  $("url").textContent = direccion;
  const qr = $("qr");
  if (qr && joinUrl) {
    qr.hidden = false;
    qr.src = qrSrc(joinUrl);
    qr.alt = `QR para abrir ${joinUrl}`;
  }
  $("unirse").hidden = false;
}

// Modo local: la notebook corre el servidor (npm run sala / MANDO.command) y entrega código, QR y estado.
async function modoLocal() {
  const res = await fetch("/api/info");
  if (!res.ok) throw new Error("sin servidor local");
  const info = await res.json();
  const joinUrl = info.urls?.[0];
  mostrarCodigo(info.codigo, joinUrl?.replace(/^https?:\/\//, "").replace(/\?.*$/, "") || "Sin red: conectá la notebook al wifi", joinUrl);
  ultimaVista = info.ultima?.hora || 0;
  aplicar(info);
  const eventos = new EventSource("/api/eventos");
  eventos.onmessage = (mensaje) => {
    try {
      aplicar(JSON.parse(mensaje.data));
    } catch {
      // Mensaje incompleto: esperamos el próximo.
    }
  };
}

// Modo nube: abierta desde la app publicada. La pantalla crea una sala y es la tele;
// el celular entra con el QR desde cualquier red. Si MANDO.command está abierto en la notebook,
// se suma a la misma sala y los botones actúan de verdad en la compu.
function modoNube() {
  const params = new URLSearchParams(location.search);
  const sala = normalizarSala(params.get("sala") || "") || nuevaSala();
  if (params.get("sala") !== sala) history.replaceState(null, "", `${location.pathname}?sala=${sala}`);
  const joinUrl = `${location.origin}/celular?sala=${sala}`;
  mostrarCodigo(sala, `${location.host}/celular`, joinUrl);

  let state = initialState;
  let conectores = [];
  let conAgente = false;
  const pintar = (ultima) => aplicar({ state, conectores, ultima });
  pintar();

  const canal = unirseASala(sala, (m) => {
    if (m.t === "hola") canal.enviar({ t: "estado", state, origen: conAgente ? "agente" : "pantalla" });
    else if (m.t === "agente") {
      conAgente = true;
      conectores = Array.isArray(m.conectores) ? m.conectores : [];
      pintar();
    } else if (m.t === "estado" && m.origen === "agente" && m.state) {
      state = m.state;
      pintar();
    } else if (m.t === "acciones" && Array.isArray(m.a)) {
      const validas = m.a.filter((a) => ACCIONES.includes(a)).slice(0, 20);
      for (const a of validas) state = applyAction(state, a);
      if (validas.length) pintar({ accion: validas.at(-1), origen: "celular", hora: Date.now() });
    }
  });
  canal.enviar({ t: "hola" }); // por si la notebook ya está en la sala
}

const forzarNube = new URLSearchParams(location.search).has("sala");
if (forzarNube) modoNube();
else modoLocal().catch(modoNube);
