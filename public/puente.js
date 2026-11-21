// Puente en la nube: conecta el mando del celular, la pantalla (TV/proyector) y la notebook
// desde la app publicada, sin IP ni mismo wifi. Usa ntfy.sh (pub/sub por HTTP, sin cuenta).
// Por acá viajan solo nombres de botones y el estado de la tele, dentro de una sala con código.
//
// Mensajes (JSON):
//   {t:"hola", de}                 alguien entró a la sala y pide el estado
//   {t:"estado", state, de}        la pantalla (o la notebook) informa el estado de la tele
//   {t:"acciones", a:[...], de}    el mando manda uno o más botones
//   {t:"agente", conectores, de}   la notebook avisa que está conectada y qué controla

import { applyAction } from "./tv-state.js";

export const SERVIDOR_PUENTE = "https://ntfy.sh";

// En la sala, el volumen sube y baja de a 5 para que el cambio se escuche en el lugar.
export const PASO_VOLUMEN = 5;
export function aplicarEnSala(state, accion) {
  const veces = accion === "VOL_UP" || accion === "VOL_DOWN" ? PASO_VOLUMEN : 1;
  let s = state;
  for (let i = 0; i < veces; i += 1) s = applyAction(s, accion);
  return s;
}
const PREFIJO = "mando-v1-";
const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I para no confundir

export function nuevaSala(largo = 6) {
  const azar = crypto.getRandomValues(new Uint8Array(largo));
  return Array.from(azar, (n) => LETRAS[n % LETRAS.length]).join("");
}

export const normalizarSala = (texto = "") => texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const esSalaNube = (texto = "") => /^[A-Z0-9]{6}$/.test(normalizarSala(texto)) && !/^\d+$/.test(texto);

export const miId = Array.from(crypto.getRandomValues(new Uint8Array(6)), (n) => n.toString(36)).join("");

/**
 * Se une a una sala. Devuelve { enviar(mensaje), cerrar() }.
 * @param {string} sala
 * @param {(mensaje: object) => void} alMensaje  recibe los mensajes de los demás (no los propios).
 * @param {(conectado: boolean) => void} [alCambiarConexion]
 */
export function unirseASala(sala, alMensaje, alCambiarConexion = () => {}) {
  const tema = `${PREFIJO}${normalizarSala(sala)}`;
  const fuente = new EventSource(`${SERVIDOR_PUENTE}/${tema}/sse`);
  fuente.addEventListener("open", () => alCambiarConexion(true));
  fuente.onerror = () => alCambiarConexion(false);
  fuente.onmessage = (e) => {
    try {
      const sobre = JSON.parse(e.data);
      if (sobre.event && sobre.event !== "message") return;
      const mensaje = JSON.parse(sobre.message);
      if (mensaje.de !== miId) alMensaje(mensaje);
    } catch {
      // Mensaje que no es nuestro o incompleto: se ignora.
    }
  };
  return {
    async enviar(mensaje) {
      await fetch(`${SERVIDOR_PUENTE}/${tema}`, {
        method: "POST",
        body: JSON.stringify({ ...mensaje, de: miId }),
      });
    },
    cerrar: () => fuente.close(),
  };
}
