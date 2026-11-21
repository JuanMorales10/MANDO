// Conector "Computadora": la notebook conectada al proyector por HDMI.
// Lo que suena y se ve en el proyector sale de acá, así que controlar la notebook
// es controlar la sala sin hardware extra.
//
// macOS:   volumen y silencio con AppleScript (no pide permisos).
//          Canal +/− → flecha derecha/izquierda (pasa diapositivas o videos).
//          Eso usa "System Events" y la primera vez macOS pide permiso de Accesibilidad.
// Windows: volumen y silencio con las teclas multimedia (PowerShell).

import { execFile } from "node:child_process";
import { platform } from "node:os";

function correr(comando, args) {
  return new Promise((resolve, reject) => {
    execFile(comando, args, { timeout: 4000 }, (error, stdout, stderr) => {
      if (error) reject(new Error((stderr || error.message).trim()));
      else resolve(stdout.trim());
    });
  });
}

const mac = {
  osascript: (script) => correr("osascript", ["-e", script]),
  async leer() {
    const salida = await this.osascript("get volume settings");
    // "output volume:50, input volume:75, alert volume:100, output muted:false"
    const volumen = Number(/output volume:(\d+)/.exec(salida)?.[1]);
    const silencio = /output muted:true/.test(salida);
    return Number.isFinite(volumen) ? { volume: volumen, muted: silencio } : null;
  },
  async aplicar(antes, despues, accion) {
    if (accion === "MUTE" || antes.muted !== despues.muted) {
      await this.osascript(`set volume output muted ${despues.muted}`);
    }
    if (antes.volume !== despues.volume) {
      await this.osascript(`set volume output volume ${despues.volume}`);
      // Cambiar el volumen no debe sacar el silencio que eligió el usuario.
      if (despues.muted) await this.osascript("set volume output muted true");
    }
    if (accion === "POWER") {
      // Apagar la TV = silenciar la notebook; prender = volver al estado anterior.
      await this.osascript(`set volume output muted ${!despues.power || despues.muted}`);
    }
    if (accion === "CH_UP" || accion === "CH_DOWN") {
      const tecla = accion === "CH_UP" ? 124 : 123; // flecha derecha / izquierda
      await this.osascript(`tell application "System Events" to key code ${tecla}`);
    }
  },
};

const windows = {
  teclas(codigo, veces = 1) {
    const script =
      `$w = New-Object -ComObject WScript.Shell; ` +
      `1..${veces} | ForEach-Object { $w.SendKeys([char]${codigo}) }`;
    return correr("powershell", ["-NoProfile", "-Command", script]);
  },
  async leer() {
    return null; // Windows no expone el volumen sin dependencias; arrancamos del estado del motor.
  },
  async aplicar(antes, despues, accion) {
    if (accion === "MUTE" || accion === "POWER") await this.teclas(173);
    const diferencia = despues.volume - antes.volume;
    // Cada tecla multimedia mueve 2 puntos en Windows.
    if (diferencia > 0) await this.teclas(175, Math.max(1, Math.round(diferencia / 2)));
    if (diferencia < 0) await this.teclas(174, Math.max(1, Math.round(-diferencia / 2)));
    if (accion === "CH_UP") await this.teclas(39);
    if (accion === "CH_DOWN") await this.teclas(37);
  },
};

export function crearConectorComputadora({ sistema = platform(), driver } = {}) {
  const impl = driver ?? (sistema === "darwin" ? mac : sistema === "win32" ? windows : null);
  const estado = { ok: Boolean(impl), detalle: impl ? "Lista" : `Sistema no soportado: ${sistema}` };

  return {
    nombre: "Computadora",
    estado: () => ({ ...estado }),
    async iniciar(app) {
      if (!impl) return;
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
        await impl.aplicar(antes, despues, accion);
        estado.ok = true;
        estado.detalle = "Lista";
      } catch (error) {
        estado.ok = false;
        estado.detalle =
          accion.startsWith("CH_") && /assistive|accessibility|1002|-1719/i.test(error.message)
            ? "Falta permiso de Accesibilidad para pasar diapositivas"
            : error.message;
      }
    },
  };
}
