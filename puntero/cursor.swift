// Ayudante del puntero: lee órdenes por stdin, una por línea, y mueve el cursor.
//   m <dx> <dy>   mover relativo (puntos de pantalla)
//   c             clic izquierdo
//   r             clic derecho
//   z             llevar el cursor al centro de la pantalla principal
//   s <dy>        rueda del mouse (píxeles; positivo = hacia arriba)
//   k <tecla>     tecla de una lista cerrada: izq der arr aba espacio esc enter
//   e             informar si hay permiso de Accesibilidad
//   pedir         mostrar el cartel de macOS que pide el permiso
//   q             salir
// Solo entiende esas órdenes. Cualquier otra línea se ignora.

import ApplicationServices
import Foundation

setvbuf(stdout, nil, _IOLBF, 0)

// Se consulta cada vez: si el usuario da el permiso con esto andando, empieza a funcionar solo.
var confiable: Bool { AXIsProcessTrusted() }
print(confiable ? "listo accesibilidad=si" : "listo accesibilidad=no")

let fuente = CGEventSource(stateID: .hidSystemState)

func limites() -> CGRect {
    return CGDisplayBounds(CGMainDisplayID())
}

func posicionActual() -> CGPoint {
    return CGEvent(source: nil)?.location ?? CGPoint(x: limites().midX, y: limites().midY)
}

func moverA(_ p: CGPoint) {
    let b = limites()
    let x = min(max(p.x, b.minX), b.maxX - 1)
    let y = min(max(p.y, b.minY), b.maxY - 1)
    let destino = CGPoint(x: x, y: y)
    if confiable, let e = CGEvent(mouseEventSource: fuente, mouseType: .mouseMoved,
                                   mouseCursorPosition: destino, mouseButton: .left) {
        e.post(tap: .cghidEventTap)
    } else {
        // Sin permiso de Accesibilidad el cursor se mueve igual, pero las apps no se enteran.
        CGWarpMouseCursorPosition(destino)
    }
}

func clic(_ boton: CGMouseButton) {
    guard confiable else { return }
    let p = posicionActual()
    let abajo: CGEventType = boton == .left ? .leftMouseDown : .rightMouseDown
    let arriba: CGEventType = boton == .left ? .leftMouseUp : .rightMouseUp
    CGEvent(mouseEventSource: fuente, mouseType: abajo, mouseCursorPosition: p, mouseButton: boton)?
        .post(tap: .cghidEventTap)
    usleep(12_000)
    CGEvent(mouseEventSource: fuente, mouseType: arriba, mouseCursorPosition: p, mouseButton: boton)?
        .post(tap: .cghidEventTap)
}

while let linea = readLine() {
    let partes = linea.split(separator: " ")
    guard let orden = partes.first else { continue }
    switch orden {
    case "m":
        guard partes.count == 3, let dx = Double(partes[1]), let dy = Double(partes[2]),
              dx.isFinite, dy.isFinite else { continue }
        let p = posicionActual()
        moverA(CGPoint(x: p.x + min(max(dx, -400), 400), y: p.y + min(max(dy, -400), 400)))
    case "c":
        clic(.left)
    case "r":
        clic(.right)
    case "z":
        moverA(CGPoint(x: limites().midX, y: limites().midY))
    case "s":
        guard confiable, partes.count == 2, let dy = Double(partes[1]), dy.isFinite else { continue }
        CGEvent(scrollWheelEvent2Source: fuente, units: .pixel, wheelCount: 1,
                wheel1: Int32(min(max(dy, -300), 300)), wheel2: 0, wheel3: 0)?.post(tap: .cghidEventTap)
    case "k":
        let teclas: [Substring: CGKeyCode] = ["izq": 123, "der": 124, "aba": 125, "arr": 126,
                                             "espacio": 49, "esc": 53, "enter": 36]
        guard confiable, partes.count == 2, let codigo = teclas[partes[1]] else { continue }
        CGEvent(keyboardEventSource: fuente, virtualKey: codigo, keyDown: true)?.post(tap: .cghidEventTap)
        usleep(12_000)
        CGEvent(keyboardEventSource: fuente, virtualKey: codigo, keyDown: false)?.post(tap: .cghidEventTap)
    case "e":
        print(confiable ? "accesibilidad=si" : "accesibilidad=no")
    case "pedir":
        let opciones = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        _ = AXIsProcessTrustedWithOptions(opciones)
    case "q":
        exit(0)
    default:
        continue
    }
}
