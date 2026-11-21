// Pantalla del proyector: TV simulada en vivo, código para unirse y aparatos conectados.

import { renderTV } from "./tv.js";
import { initialState } from "./tv-state.js";
import { nombreDe } from "./mando-botones.js";


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

// El código y la dirección solo los entrega el servidor a la propia notebook.
try {
  const res = await fetch("/api/info");
  if (res.ok) {
    const info = await res.json();
    $("codigo").replaceChildren(...String(info.codigo).split("").map((d) => {
      const casilla = document.createElement("span");
      casilla.className = "pro__digito";
      casilla.textContent = d;
      return casilla;
    }));
    $("codigo").setAttribute("aria-label", `Código ${info.codigo}`);
    $("url").textContent = info.urls[0]?.replace(/^http:\/\//, "") || "Sin red: conectá la notebook al wifi";
    $("unirse").hidden = false;
    ultimaVista = info.ultima?.hora || 0;
    aplicar(info);
  }
} catch {
  $("aviso").textContent = "Abrí esta página desde el servidor: node server/server.mjs";
  $("aviso").classList.add("is-visible");
}

const eventos = new EventSource("/api/eventos");
eventos.onmessage = (mensaje) => {
  try {
    aplicar(JSON.parse(mensaje.data));
  } catch {
    // Mensaje incompleto: esperamos el próximo.
  }
};
