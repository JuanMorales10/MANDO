// Conector "Computadora": la notebook conectada al proyector por HDMI.
// Lo que suena y se ve en el proyector sale de acá, así que controlar la notebook
// es controlar la sala sin hardware extra.
//
// macOS:   volumen y silencio con AppleScript (sin permisos).
//          Apps de streaming e Inicio abren una página (sin permisos).
//          Flechas, OK, Volver, play/pausa, números y Entrada simulan teclas con
//          "System Events": la primera vez macOS pide permiso de Accesibilidad.
// Windows: lo mismo con teclas multimedia y SendKeys (PowerShell) y "start" para las apps.

import { execFile } from "node:child_process";
import { platform } from "node:os";
import { BOTON } from "../../public/mando-botones.js";

function correr(comando, args) {
  return new Promise((resolve, reject) => {
    execFile(comando, args, { timeout: 4000 }, (error, stdout, stderr) => {
      if (error) reject(new Error((stderr || error.message).trim()));
      else resolve(stdout.trim());
    });
  });
}

// Códigos de tecla de macOS.
const TECLA_MAC = {
  UP: 126, DOWN: 125, LEFT: 123, RIGHT: 124,
  CH_UP: 124, CH_DOWN: 123, // pasan diapositivas
  REWIND: 123, FORWARD: 124, // en YouTube y Netflix: −5 s / +5 s
  OK: 36, // Enter
  BACK: 53, // Escape
  PLAY_PAUSE: 49, // Espacio
  FULLSCREEN: 3, // "f" en YouTube y Netflix
};
const DIGITO_MAC = { 0: 29, 1: 18, 2: 19, 3: 20, 4: 21, 5: 23, 6: 22, 7: 26, 8: 28, 9: 25 };

const teclaMac = (codigo, modificadores = "") =>
  ["osascript", ["-e", `tell application "System Events" to key code ${codigo}${modificadores}`]];

/** Lista de comandos [programa, argumentos] que ejecuta macOS para una acción. */
export function pasosMac(antes, despues, accion, { inicio } = {}) {
  const pasos = [];
  const osa = (script) => pasos.push(["osascript", ["-e", script]]);

  if (accion === "MUTE" || (accion !== "POWER" && antes.muted !== despues.muted)) {
    osa(`set volume output muted ${despues.muted}`);
  }
  if (antes.volume !== despues.volume) {
    osa(`set volume output volume ${despues.volume}`);
    // Cambiar el volumen no debe sacar el silencio que eligió el usuario.
    if (despues.muted) osa("set volume output muted true");
  }
  if (accion === "POWER") {
    // Apagar la TV = silenciar la notebook; prender = volver al estado anterior.
    osa(`set volume output muted ${!despues.power || despues.muted}`);
  }
  if (accion in TECLA_MAC) pasos.push(teclaMac(TECLA_MAC[accion]));
  if (accion.startsWith("NUM_")) pasos.push(teclaMac(DIGITO_MAC[accion.slice(4)]));
  if (accion === "INPUT") pasos.push(teclaMac(48, " using command down")); // Cmd+Tab: cambia de app
  if (accion === "MENU") pasos.push(["open", ["-a", "Mission Control"]]);
  if (accion === "HOME" && inicio) pasos.push(["open", [inicio]]);
  const url = BOTON[accion]?.url;
  if (url) pasos.push(["open", [url]]);
  return pasos;
}

// Teclas de Windows para SendKeys.
const TECLA_WIN = {
  UP: "{UP}", DOWN: "{DOWN}", LEFT: "{LEFT}", RIGHT: "{RIGHT}",
  CH_UP: "{RIGHT}", CH_DOWN: "{LEFT}", REWIND: "{LEFT}", FORWARD: "{RIGHT}",
  OK: "~", BACK: "{ESC}", PLAY_PAUSE: " ", FULLSCREEN: "f", INPUT: "%{TAB}",
};

/** Lista de comandos que ejecuta Windows para una acción. */
export function pasosWindows(antes, despues, accion, { inicio } = {}) {
  const pasos = [];
  const teclas = [];
  // Teclas multimedia: 173 silencio, 174 bajar, 175 subir (2 puntos por tecla).
  if (accion === "MUTE" || accion === "POWER") teclas.push("[char]173");
  const diferencia = despues.volume - antes.volume;
  for (let i = 0; i < Math.round(Math.abs(diferencia) / 2); i += 1) teclas.push(diferencia > 0 ? "[char]175" : "[char]174");
  if (accion in TECLA_WIN) teclas.push(`'${TECLA_WIN[accion]}'`);
  if (accion.startsWith("NUM_")) teclas.push(`'${accion.slice(4)}'`);
  if (teclas.length) {
    const script = `$w = New-Object -ComObject WScript.Shell; ${teclas.map((t) => `$w.SendKeys(${t})`).join("; ")}`;
    pasos.push(["powershell", ["-NoProfile", "-Command", script]]);
  }
  const url = BOTON[accion]?.url || (accion === "HOME" ? inicio : null);
  if (url) pasos.push(["cmd", ["/c", "start", "", url]]);
  return pasos;
}

const DRIVERS = {
  darwin: {
    pasos: pasosMac,
    async leer() {
      const salida = await correr("osascript", ["-e", "get volume settings"]);
      // "output volume:50, input volume:75, alert volume:100, output muted:false"
      const volumen = Number(/output volume:(\d+)/.exec(salida)?.[1]);
      return Number.isFinite(volumen) ? { volume: volumen, muted: /output muted:true/.test(salida) } : null;
    },
  },
  win32: {
    pasos: pasosWindows,
    async leer() {
      return null; // Windows no expone el volumen sin dependencias.
    },
  },
};

export function crearConectorComputadora({ sistema = platform(), driver, ejecutar = correr, inicio } = {}) {
  const impl = driver ?? DRIVERS[sistema] ?? null;
  const estado = { ok: Boolean(impl), detalle: impl ? "Lista" : `Sistema no soportado: ${sistema}` };

  return {
    nombre: "Computadora",
    estado: () => ({ ...estado }),
    async iniciar(app) {
      if (!impl?.leer) return;
      try {
        const real = await impl.leer();
        if (real) {
          app.sincronizar(real);
          estado.detalle = `Volumen real ${real.volume}${real.muted ? " · en silencio" : ""}`;
        }
      } catch (error) {
        estado.ok = false;
        estado.detalle = `No pude leer el volumen: ${error.message}`;
      }
    },
    async aplicar(antes, despues, accion) {
      if (!impl) return;
      try {
        if (impl.aplicar) await impl.aplicar(antes, despues, accion);
        for (const [programa, args] of impl.pasos?.(antes, despues, accion, { inicio }) ?? []) {
          await ejecutar(programa, args);
        }
        estado.ok = true;
        estado.detalle = "Lista";
      } catch (error) {
        estado.ok = false;
        estado.detalle = /assistive|accessibility|1002|-1719|-25211|no está autorizado|not allowed/i.test(error.message)
          ? "Falta permiso de Accesibilidad para las teclas"
          : error.message;
      }
    },
  };
}
