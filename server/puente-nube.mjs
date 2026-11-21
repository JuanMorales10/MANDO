// La notebook se une a la sala de la nube (ntfy.sh) que muestra la pantalla publicada.
// Así el celular controla desde la app publicada, desde cualquier red, y los botones
// actúan de verdad en la compu (volumen, apps, teclas) a través de los conectores.

import { randomBytes } from "node:crypto";
import { ACCIONES } from "../public/mando-botones.js";

const SERVIDOR = process.env.PUENTE_SERVIDOR || "https://ntfy.sh";
const PREFIJO = "mando-v1-";
const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function nuevaSala(largo = 6) {
  return Array.from(randomBytes(largo), (n) => LETRAS[n % LETRAS.length]).join("");
}

/**
 * @param {object} app  lo que devuelve crearServidor (ejecutar, sala.state, conectores en el paquete).
 * @param {object} o
 * @param {string} o.sala  código de 6 caracteres.
 * @param {() => Array} o.conectores  resumen de aparatos para mostrar en la pantalla.
 */
export function unirAgente(app, { sala, conectores = () => [], log = () => {} }) {
  const tema = `${PREFIJO}${sala}`;
  const de = `agente-${randomBytes(4).toString("hex")}`;
  let cortado = false;
  let controlador = null;

  const publicar = (mensaje) =>
    fetch(`${SERVIDOR}/${tema}`, { method: "POST", body: JSON.stringify({ ...mensaje, de }) }).catch((e) =>
      log(`puente: no pude publicar (${e.message})`),
    );
  const presentarse = () => {
    publicar({ t: "agente", conectores: conectores() });
    publicar({ t: "estado", state: app.sala.state, origen: "agente" });
  };

  async function atender(m) {
    if (!m || m.de === de) return;
    if (m.t === "hola") return presentarse();
    if (m.t === "acciones" && Array.isArray(m.a)) {
      for (const a of m.a.slice(0, 20)) if (ACCIONES.includes(a)) await app.ejecutar(a, "celular");
      // La notebook manda el estado real (por ejemplo, el volumen sube de a 5 en la compu).
      publicar({ t: "estado", state: app.sala.state, origen: "agente" });
    }
  }

  async function escuchar() {
    let espera = 1000;
    while (!cortado) {
      try {
        controlador = new AbortController();
        const res = await fetch(`${SERVIDOR}/${tema}/json`, { signal: controlador.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        log(`puente: unida a la sala ${sala}`);
        presentarse();
        espera = 1000;
        const lector = res.body.getReader();
        const decodificador = new TextDecoder();
        let resto = "";
        for (;;) {
          const { value, done } = await lector.read();
          if (done) break;
          resto += decodificador.decode(value, { stream: true });
          let fin;
          while ((fin = resto.indexOf("\n")) !== -1) {
            const linea = resto.slice(0, fin);
            resto = resto.slice(fin + 1);
            try {
              const sobre = JSON.parse(linea);
              if (sobre.event === "message") await atender(JSON.parse(sobre.message));
            } catch {
              // Línea incompleta o ajena: se ignora.
            }
          }
        }
      } catch (error) {
        if (cortado) return;
        log(`puente: sin conexión (${error.message}), reintento en ${espera / 1000}s`);
      }
      await new Promise((r) => setTimeout(r, espera));
      espera = Math.min(espera * 2, 15000);
    }
  }

  escuchar();
  return {
    sala,
    cerrar() {
      cortado = true;
      controlador?.abort();
    },
  };
}
