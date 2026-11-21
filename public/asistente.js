/**
 * Mandy: chatbot sincronizado (notebook ↔ celu vía sala.chat).
 */

import {
  interpretarPedido,
  sugerenciasIniciales,
  chipsDesdeRespuesta,
} from "./catalogo.js";
import { escuchar, soportaVoz } from "./voz.js";

const MAX_HISTORIAL = 10;
const BIENVENIDA =
  "Hola, soy Mandy. Contame qué te pinta o tocá una sugerencia — yo cambio el canal.";

/**
 * @param {object} opts
 * @param {(accion: string) => Promise<void>|void} opts.enviar
 * @param {(msg: string) => void} [opts.onMensaje]
 * @param {HTMLElement} opts.root
 * @param {string[]} [opts.sugerencias]
 * @param {() => void|Promise<void>} [opts.onMicInicio]
 * @param {() => void|Promise<void>} [opts.onMicFin]
 * @param {() => string|null|undefined} [opts.getCodigo]
 * @param {"notebook"|"celular"} [opts.origen]
 */
export function mountAsistente({
  root,
  enviar,
  onMensaje,
  onMicInicio,
  onMicFin,
  getCodigo,
  origen = "celular",
  sugerencias = sugerenciasIniciales(),
}) {
  if (!root) return { destroy() {} };

  const historial = [];
  let chatFirma = "";
  let enviando = false;
  let colaSync = null;

  root.innerHTML = `
    <section class="mandy mandy--chat" aria-label="Mandy, chatbot de MANDO">
      <header class="mandy__cab">
        <span class="mandy__avatar" aria-hidden="true">M</span>
        <div class="mandy__titulos">
          <p class="mandy__nombre">Mandy</p>
          <p class="mandy__hint">Mismo chat en notebook y celu</p>
        </div>
        <button type="button" class="mandy__min" id="mandy-min" aria-expanded="true" aria-controls="mandy-cuerpo" aria-label="Minimizar el chat de Mandy">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>
        </button>
      </header>
      <div class="mandy__cuerpo" id="mandy-cuerpo">
      <div class="mandy__chat" id="mandy-chat" role="log" aria-live="polite" aria-relevant="additions"></div>
      <div class="mandy__chips" id="mandy-chips"></div>
      <form class="mandy__form" id="mandy-form" autocomplete="off">
        <div class="mandy__fila">
          <button type="button" class="mandy__mic" id="mandy-mic" aria-label="Hablarle a Mandy">🎤</button>
          <input
            id="mandy-texto"
            class="mandy__input"
            type="search"
            enterkeyhint="send"
            placeholder="Escribí o pedí una sugerencia…"
            aria-label="Mensaje para Mandy"
          />
          <button type="submit" class="mandy__ok">Enviar</button>
        </div>
      </form>
    </div>
    </section>
  `;

  // Minimizar: queda solo la barrita «Mandy»; un toque la vuelve a abrir. Se recuerda la elección.
  const seccion = root.querySelector(".mandy");
  const botonMin = root.querySelector("#mandy-min");
  const CLAVE_MIN = `mando-mandy-min-${origen}`;
  const leerMin = () => {
    try {
      const v = localStorage.getItem(CLAVE_MIN);
      return v === null ? origen === "celular" : v === "1"; // en el celu arranca minimizado: el mando primero
    } catch {
      return origen === "celular";
    }
  };
  const fijarMin = (min) => {
    seccion.classList.toggle("is-min", min);
    botonMin.setAttribute("aria-expanded", String(!min));
    botonMin.setAttribute("aria-label", min ? "Abrir el chat de Mandy" : "Minimizar el chat de Mandy");
    try {
      localStorage.setItem(CLAVE_MIN, min ? "1" : "0");
    } catch {
      // Sin almacenamiento: no se recuerda.
    }
  };
  fijarMin(leerMin());
  botonMin.addEventListener("click", () => fijarMin(!seccion.classList.contains("is-min")));
  root.querySelector(".mandy__cab").addEventListener("click", (e) => {
    if (seccion.classList.contains("is-min") && !e.target.closest("#mandy-min")) fijarMin(false);
  });

  const form = root.querySelector("#mandy-form");
  const input = root.querySelector("#mandy-texto");
  const mic = root.querySelector("#mandy-mic");
  const chat = root.querySelector("#mandy-chat");
  const chips = root.querySelector("#mandy-chips");

  function scrollChat() {
    chat.scrollTop = chat.scrollHeight;
  }

  function agregarBurbuja(rol, texto, { pending = false, origenMsg } = {}) {
    const el = document.createElement("div");
    el.className = `mandy__burbuja mandy__burbuja--${rol}`;
    if (pending) el.dataset.pending = "1";
    if (rol === "user" && origenMsg && origenMsg !== origen) {
      el.classList.add("mandy__burbuja--remoto");
      const etiqueta = document.createElement("span");
      etiqueta.className = "mandy__desde";
      etiqueta.textContent = origenMsg === "notebook" ? "Notebook" : "Celu";
      el.append(etiqueta);
    }
    const cuerpo = document.createElement("span");
    cuerpo.textContent = texto;
    el.append(cuerpo);
    chat.append(el);
    scrollChat();
    return el;
  }

  function pintarChips(lista) {
    chips.replaceChildren();
    for (const s of (lista || []).slice(0, 5)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mandy__chip";
      b.textContent = s;
      b.addEventListener("click", () => {
        input.value = s;
        ejecutar(s);
      });
      chips.append(b);
    }
  }

  function rebuildHistorial(mensajes) {
    historial.length = 0;
    for (const m of mensajes.slice(-MAX_HISTORIAL)) {
      historial.push({
        role: m.role === "user" ? "user" : "assistant",
        content: String(m.content || "").slice(0, 400),
      });
    }
  }

  function pintarBienvenida() {
    chat.replaceChildren();
    agregarBurbuja("mandy", BIENVENIDA);
    pintarChips(sugerencias);
    chatFirma = "";
    historial.length = 0;
  }

  /**
   * Aplica el chat compartido de la sala (polling / respuesta del API).
   * @param {Array|{id?:string,role:string,content:string,origen?:string,sugerencias?:string[]}} mensajes
   */
  function sincronizar(mensajes) {
    if (!Array.isArray(mensajes)) return;
    if (enviando) {
      colaSync = mensajes;
      return;
    }
    const firma = mensajes.map((m) => m.id || `${m.hora}:${m.role}:${m.content}`).join("|");
    if (firma === chatFirma) return;
    chatFirma = firma;

    if (!mensajes.length) {
      pintarBienvenida();
      return;
    }

    chat.replaceChildren();
    for (const m of mensajes) {
      const rol = m.role === "user" ? "user" : "mandy";
      agregarBurbuja(rol, m.content || "", { origenMsg: m.origen });
    }
    rebuildHistorial(mensajes);

    const ultima = [...mensajes].reverse().find((m) => m.role === "assistant");
    if (ultima?.sugerencias?.length) pintarChips(ultima.sugerencias);
    else pintarChips(sugerenciasIniciales());

    const ultimoTexto = ultima?.content;
    if (ultimoTexto) onMensaje?.(ultimoTexto);
  }

  async function ejecutar(texto) {
    const pedido = String(texto || "").trim();
    if (!pedido) {
      agregarBurbuja("mandy", "Decime qué querés ver o tocá una sugerencia.");
      return null;
    }

    enviando = true;
    colaSync = null;
    agregarBurbuja("user", pedido, { origenMsg: origen });
    input.value = "";
    const pensado = agregarBurbuja("mandy", "Pensando…", { pending: true });

    const local = interpretarPedido(pedido);
    let r = { ...local, sugerencias: chipsDesdeRespuesta(local) };
    const codigo = getCodigo?.() || null;

    try {
      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          texto: pedido,
          historial: historial.slice(-MAX_HISTORIAL),
          codigo,
          origen,
        }),
      });
      if (res.ok) r = await res.json();
    } catch {
      // local
    }

    enviando = false;

    if (Array.isArray(r.chat)) {
      sincronizar(r.chat);
    } else {
      const mensaje = r.mensaje || "Listo.";
      pensado.textContent = "";
      pensado.append(document.createTextNode(mensaje));
      delete pensado.dataset.pending;
      historial.push({ role: "user", content: pedido.slice(0, 400) });
      historial.push({ role: "assistant", content: mensaje.slice(0, 400) });
      while (historial.length > MAX_HISTORIAL) historial.shift();
      onMensaje?.(mensaje);
      pintarChips(chipsDesdeRespuesta(r));
      scrollChat();
    }

    if (colaSync) {
      const pendiente = colaSync;
      colaSync = null;
      if (!Array.isArray(r.chat) || pendiente.length >= (r.chat?.length || 0)) {
        sincronizar(pendiente);
      }
    }

    if (r.ok && r.accion) await enviar(r.accion);
    return r;
  }

  pintarBienvenida();

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    ejecutar(input.value);
  });

  let sesion = null;

  if (!soportaVoz()) {
    mic.disabled = true;
    mic.title = "Voz no disponible — escribile a Mandy";
  }

  mic.addEventListener("click", async () => {
    if (sesion) {
      sesion.stop();
      sesion = null;
      mic.dataset.on = "0";
      return;
    }
    if (!soportaVoz()) {
      input.focus();
      agregarBurbuja("mandy", "Escribime el pedido y tocá Enviar.");
      return;
    }

    mic.dataset.on = "1";
    sesion = await escuchar({
      onInicio: onMicInicio,
      onEstado: (t) => {
        if (t) onMensaje?.(t);
      },
      onTexto: (texto) => {
        input.value = texto;
        ejecutar(texto);
      },
      onFin: async () => {
        sesion = null;
        mic.dataset.on = "0";
        try {
          await onMicFin?.();
        } catch {
          // ignore
        }
      },
    });
    if (!sesion) {
      mic.dataset.on = "0";
      try {
        await onMicFin?.();
      } catch {
        // ignore
      }
    }
  });

  return {
    destroy() {
      root.replaceChildren();
    },
    preguntar: ejecutar,
    sincronizar,
  };
}
