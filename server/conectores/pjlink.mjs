// Conector "Proyector (PJLink)": controla el proyector por la red.
// PJLink es el estándar abierto de Epson, Sony, NEC, Panasonic, Optoma, BenQ, Canon,
// Hitachi y otros: puerto TCP 4352, comandos de texto.
//
//   POWER     → %1POWR 1 / 0   (encender / apagar)
//   MUTE      → %1AVMT 31 / 30 (silencia imagen y sonido / los restituye)
//   VOL_UP    → %2SVOL 1       (volumen del parlante, clase 2: no todos los modelos)
//   VOL_DOWN  → %2SVOL 0
//
// Si el proyector tiene contraseña, la conexión pide un hash MD5 de (semilla + contraseña).

import net from "node:net";
import { createHash } from "node:crypto";

const ERRORES = {
  ERR1: "El proyector no reconoce el comando",
  ERR2: "Parámetro fuera de rango",
  ERR3: "El proyector está ocupado o en espera",
  ERR4: "Falla del proyector",
  ERRA: "Contraseña PJLink incorrecta",
};

/** Envía un comando PJLink y devuelve la respuesta, por ejemplo "%1AVMT=OK". */
export function enviarPjlink({ host, port = 4352, password = "", timeout = 3000 }, comando) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let buffer = "";
    let saludado = false;
    const terminar = (error, valor) => {
      socket.destroy();
      if (error) reject(error);
      else resolve(valor);
    };
    socket.setTimeout(timeout, () => terminar(new Error(`El proyector no respondió en ${timeout} ms`)));
    socket.on("error", (error) => terminar(new Error(`No me pude conectar al proyector: ${error.message}`)));
    socket.on("data", (parte) => {
      buffer += parte.toString("latin1");
      let fin;
      while ((fin = buffer.indexOf("\r")) !== -1) {
        const linea = buffer.slice(0, fin).trim();
        buffer = buffer.slice(fin + 1);
        if (!saludado) {
          saludado = true;
          if (linea === "PJLINK ERRA") return terminar(new Error(ERRORES.ERRA));
          let prefijo = "";
          const auth = /^PJLINK 1 (\S+)$/.exec(linea);
          if (auth) {
            if (!password) return terminar(new Error("El proyector pide contraseña PJLink (PJLINK_PASS)"));
            prefijo = createHash("md5").update(auth[1] + password).digest("hex");
          } else if (linea !== "PJLINK 0") {
            return terminar(new Error(`Saludo PJLink inesperado: ${linea}`));
          }
          socket.write(`${prefijo}${comando}\r`);
          continue;
        }
        if (linea === "PJLINK ERRA") return terminar(new Error(ERRORES.ERRA));
        const error = /=(ERR[1-4A])$/.exec(linea)?.[1];
        if (error) return terminar(new Error(ERRORES[error]));
        return terminar(null, linea);
      }
    });
  });
}

export function comandosPara(antes, despues, accion) {
  switch (accion) {
    case "POWER":
      return [`%1POWR ${despues.power ? 1 : 0}`];
    case "MUTE":
      return [`%1AVMT ${despues.muted ? 31 : 30}`];
    case "VOL_UP":
      return despues.volume !== antes.volume ? ["%2SVOL 1"] : [];
    case "VOL_DOWN":
      return despues.volume !== antes.volume ? ["%2SVOL 0"] : [];
    default:
      return [];
  }
}

export function crearConectorPjlink(config) {
  const estado = { ok: false, detalle: `Buscando proyector en ${config.host}…` };

  return {
    nombre: "Proyector (PJLink)",
    estado: () => ({ ...estado }),
    async iniciar() {
      try {
        const nombre = await enviarPjlink(config, "%1NAME ?");
        estado.ok = true;
        estado.detalle = `Conectado: ${nombre.replace(/^%1NAME=/, "") || config.host}`;
      } catch (error) {
        estado.ok = false;
        estado.detalle = error.message;
      }
    },
    async aplicar(antes, despues, accion) {
      for (const comando of comandosPara(antes, despues, accion)) {
        try {
          await enviarPjlink(config, comando);
          estado.ok = true;
          estado.detalle = `Conectado a ${config.host}`;
        } catch (error) {
          estado.ok = false;
          estado.detalle = comando.startsWith("%2") && /no reconoce/.test(error.message)
            ? "Este proyector no permite cambiar el volumen por red"
            : error.message;
        }
      }
    },
  };
}
