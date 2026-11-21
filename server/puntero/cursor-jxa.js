// Plan B del ayudante del puntero, sin compilar nada: JavaScript para macOS (JXA),
// que viene con el sistema. Mismo protocolo que puntero/cursor.swift, una orden por línea:
//   m <dx> <dy> · c · r · z · k <tecla> · e · pedir · q   ("s", la rueda, no está en el plan B)
// Se ejecuta con: osascript -l JavaScript server/puntero/cursor-jxa.js

ObjC.import("Cocoa");
ObjC.import("CoreGraphics");
ObjC.import("ApplicationServices");

const TECLAS = { izq: 123, der: 124, aba: 125, arr: 126, espacio: 49, esc: 53, enter: 36 };
const salida = $.NSFileHandle.fileHandleWithStandardOutput;
const entrada = $.NSFileHandle.fileHandleWithStandardInput;

function decir(texto) {
  salida.writeData($(`${texto}\n`).dataUsingEncoding($.NSUTF8StringEncoding));
}

const confiable = () => $.AXIsProcessTrusted();

function limites() {
  return $.CGDisplayBounds($.CGMainDisplayID());
}

function posicion() {
  const e = $.CGEventCreate(null);
  return $.CGEventGetLocation(e);
}

function mover(x, y) {
  const b = limites();
  const px = Math.min(Math.max(x, b.origin.x), b.origin.x + b.size.width - 1);
  const py = Math.min(Math.max(y, b.origin.y), b.origin.y + b.size.height - 1);
  const e = $.CGEventCreateMouseEvent(null, $.kCGEventMouseMoved, { x: px, y: py }, $.kCGMouseButtonLeft);
  $.CGEventPost($.kCGHIDEventTap, e);
}

function clic(derecho) {
  const p = posicion();
  const [abajo, arriba, boton] = derecho
    ? [$.kCGEventRightMouseDown, $.kCGEventRightMouseUp, $.kCGMouseButtonRight]
    : [$.kCGEventLeftMouseDown, $.kCGEventLeftMouseUp, $.kCGMouseButtonLeft];
  $.CGEventPost($.kCGHIDEventTap, $.CGEventCreateMouseEvent(null, abajo, p, boton));
  $.CGEventPost($.kCGHIDEventTap, $.CGEventCreateMouseEvent(null, arriba, p, boton));
}

function tecla(codigo) {
  $.CGEventPost($.kCGHIDEventTap, $.CGEventCreateKeyboardEvent(null, codigo, true));
  $.CGEventPost($.kCGHIDEventTap, $.CGEventCreateKeyboardEvent(null, codigo, false));
}

function procesar(linea) {
  const [orden, a, b] = linea.trim().split(/\s+/);
  if (orden === "e") return decir(confiable() ? "accesibilidad=si" : "accesibilidad=no");
  if (orden === "pedir") {
    // Muestra el aviso de macOS para habilitar Accesibilidad.
    const opciones = $.NSDictionary.dictionaryWithObjectForKey($.YES, $.kAXTrustedCheckOptionPrompt);
    $.AXIsProcessTrustedWithOptions(opciones);
    return;
  }
  if (!confiable()) return;
  if (orden === "m") {
    const dx = Number(a);
    const dy = Number(b);
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 400 || Math.abs(dy) > 400) return;
    const p = posicion();
    mover(p.x + dx, p.y + dy);
  } else if (orden === "c") clic(false);
  else if (orden === "r") clic(true);
  else if (orden === "z") {
    const l = limites();
    mover(l.origin.x + l.size.width / 2, l.origin.y + l.size.height / 2);
  } else if (orden === "k" && Object.prototype.hasOwnProperty.call(TECLAS, a)) tecla(TECLAS[a]);
  // "s" (rueda) no está en el plan B: se ignora.
}

function run() {
  decir(confiable() ? "listo accesibilidad=si" : "listo accesibilidad=no");
  let resto = "";
  for (;;) {
    const datos = entrada.availableData;
    if (datos.length === 0) return; // se cerró la entrada: el servidor terminó
    resto += $.NSString.alloc.initWithDataEncoding(datos, $.NSUTF8StringEncoding).js;
    let fin;
    while ((fin = resto.indexOf("\n")) !== -1) {
      const linea = resto.slice(0, fin);
      resto = resto.slice(fin + 1);
      if (linea.trim() === "q") return;
      try {
        procesar(linea);
      } catch (error) {
        // Una orden rara no debe tirar abajo al ayudante.
      }
    }
  }
}
