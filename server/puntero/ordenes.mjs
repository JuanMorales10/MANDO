// Órdenes del puntero: lista cerrada, todo lo demás se ignora.
// Módulo puro, sin efectos: no lanza nada ni toca la red, así se prueba solo.

export const TECLAS = new Set(["izq", "der", "arr", "aba", "espacio", "esc", "enter"]);
export const ENERGIAS = ["bloquear", "suspender", "apagar"];

const num = (n) => typeof n === "number" && Number.isFinite(n);
const linea = (texto) => ({ linea: texto });

/** Órdenes de energía que se le ofrecen al teléfono. «apagar» solo si se habilitó al arrancar. */
export function energiasPermitidas({ apagar = false } = {}) {
  return ENERGIAS.filter((n) => n !== "apagar" || apagar === true);
}

/**
 * Traduce un mensaje del teléfono (ya parseado) a algo que el servidor sabe hacer.
 * @param {unknown} m mensaje del teléfono.
 * @param {{ apagar?: boolean }} [capacidades] apagar: si el apagado está habilitado.
 * @returns {{ linea: string } | { energia: string, permitida: boolean } | null}
 *   { linea }               una línea para el ayudante del cursor;
 *   { energia, permitida }  una orden de energía (permitida=false: se rechaza sin ejecutar);
 *   null                    mensaje que no está en la lista: se ignora.
 */
export function interpretar(m, capacidades = {}) {
  if (!m || typeof m !== "object" || Array.isArray(m)) return null;
  switch (m.t) {
    case "m":
      if (num(m.x) && num(m.y) && Math.abs(m.x) <= 400 && Math.abs(m.y) <= 400) {
        return linea(`m ${m.x.toFixed(2)} ${m.y.toFixed(2)}`);
      }
      return null;
    case "c":
      return linea("c");
    case "r":
      return linea("r");
    case "z":
      return linea("z");
    case "s":
      return num(m.y) && Math.abs(m.y) <= 300 ? linea(`s ${m.y.toFixed(1)}`) : null;
    case "k":
      return typeof m.n === "string" && TECLAS.has(m.n) ? linea(`k ${m.n}`) : null;
    case "l": // láser: prender / apagar
      return m.v === 1 || m.v === 0 ? linea(`l ${m.v}`) : null;
    case "d": // dibujo: empezar / terminar un trazo
      return m.v === 1 || m.v === 0 ? linea(`d ${m.v}`) : null;
    case "b": // borrar los trazos
      return linea("b");
    case "e":
      if (typeof m.n !== "string" || !ENERGIAS.includes(m.n)) return null;
      return { energia: m.n, permitida: energiasPermitidas(capacidades).includes(m.n) };
    default:
      return null;
  }
}

/**
 * Qué hay que hacer para cumplir una orden de energía. Argumentos fijos: nada viene del teléfono.
 * @param {string} accion "bloquear" | "suspender" | "apagar"
 * @param {{ clics?: boolean, laser?: boolean, apagar?: boolean }} [estado]
 *   clics: hay permiso de Accesibilidad; laser: el ayudante avisó «laser=si» (es el de Swift
 *   nuevo, el único que entiende «lock»); apagar: el apagado está habilitado.
 * @returns {{ linea: string } | { comando: string, args: string[] } | null}
 */
export function planEnergia(accion, { clics = false, laser = false, apagar = false } = {}) {
  if (accion === "bloquear") {
    // Control+Comando+Q lo aprieta el ayudante; si no puede, al menos se apaga la pantalla.
    if (clics === true && laser === true) return linea("lock");
    return { comando: "/usr/bin/pmset", args: ["displaysleepnow"] };
  }
  if (accion === "suspender") return { comando: "/usr/bin/pmset", args: ["sleepnow"] };
  if (accion === "apagar" && apagar === true) {
    return { comando: "/usr/bin/osascript", args: ["-e", 'tell application "System Events" to shut down'] };
  }
  return null;
}
