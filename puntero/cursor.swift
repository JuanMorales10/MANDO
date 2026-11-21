// Ayudante del puntero: lee órdenes por stdin, una por línea, y mueve el cursor.
//   m <dx> <dy>   mover relativo (puntos de pantalla)
//   c             clic izquierdo
//   r             clic derecho
//   z             llevar el cursor al centro de la pantalla principal
//   s <dy>        rueda del mouse (píxeles; positivo = hacia arriba)
//   k <tecla>     tecla de una lista cerrada: izq der arr aba espacio esc enter
//   e             informar si hay permiso de Accesibilidad
//   pedir         mostrar el cartel de macOS que pide el permiso
//   g <0|1>       ocultar o mostrar el cursor grande (una flecha y un halo que siguen al cursor)
//   q             salir
// Solo entiende esas órdenes. Cualquier otra línea se ignora.

import AppKit
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

// ---------- Cursor grande ----------
// Una ventana transparente, que no recibe clics, dibuja una flecha grande y un halo
// con la punta justo donde está el cursor de verdad. No cambia ningún ajuste del sistema.

let LADO: CGFloat = 150

final class VistaCursor: NSView {
    override func draw(_ dirtyRect: NSRect) {
        let c = CGPoint(x: bounds.midX, y: bounds.midY)
        let lima = NSColor(srgbRed: 0.79, green: 0.97, blue: 0.42, alpha: 1)
        let noche = NSColor(srgbRed: 0.06, green: 0.08, blue: 0.13, alpha: 1)

        let halo = NSBezierPath(ovalIn: NSRect(x: c.x - 60, y: c.y - 60, width: 120, height: 120))
        lima.withAlphaComponent(0.22).setFill()
        halo.fill()
        lima.withAlphaComponent(0.9).setStroke()
        halo.lineWidth = 3
        halo.stroke()

        // Flecha clásica, 3 veces más grande, con la punta en el centro de la ventana.
        let k: CGFloat = 3.2
        let puntos: [(CGFloat, CGFloat)] = [(0, 0), (0, -17), (4, -13.2), (6.8, -19.6), (9.6, -18.4), (6.9, -12.2), (12.2, -12.2)]
        let flecha = NSBezierPath()
        for (i, p) in puntos.enumerated() {
            let q = CGPoint(x: c.x + p.0 * k, y: c.y + p.1 * k)
            if i == 0 { flecha.move(to: q) } else { flecha.line(to: q) }
        }
        flecha.close()
        flecha.lineJoinStyle = .round
        noche.setFill()
        flecha.fill()
        NSColor.white.setStroke()
        flecha.lineWidth = 3.5
        flecha.stroke()
    }
}

var ventanaCursor: NSWindow?
var relojCursor: Timer?

func seguirCursor() {
    guard let v = ventanaCursor else { return }
    let p = NSEvent.mouseLocation
    v.setFrameOrigin(NSPoint(x: p.x - LADO / 2, y: p.y - LADO / 2))
}

func mostrarCursorGrande(_ si: Bool) {
    if !si {
        relojCursor?.invalidate()
        relojCursor = nil
        ventanaCursor?.orderOut(nil)
        return
    }
    if ventanaCursor == nil {
        let v = NSWindow(contentRect: NSRect(x: 0, y: 0, width: LADO, height: LADO),
                         styleMask: .borderless, backing: .buffered, defer: false)
        v.isOpaque = false
        v.backgroundColor = .clear
        v.hasShadow = false
        v.ignoresMouseEvents = true
        v.level = .screenSaver
        v.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
        v.contentView = VistaCursor(frame: NSRect(x: 0, y: 0, width: LADO, height: LADO))
        ventanaCursor = v
    }
    seguirCursor()
    ventanaCursor?.orderFrontRegardless()
    if relojCursor == nil {
        let r = Timer(timeInterval: 1.0 / 60.0, repeats: true) { _ in seguirCursor() }
        RunLoop.main.add(r, forMode: .common)
        relojCursor = r
    }
}

func procesar(_ linea: String) {
    let partes = linea.split(separator: " ")
    guard let orden = partes.first else { return }
    switch orden {
    case "m":
        guard partes.count == 3, let dx = Double(partes[1]), let dy = Double(partes[2]),
              dx.isFinite, dy.isFinite else { return }
        let p = posicionActual()
        moverA(CGPoint(x: p.x + min(max(dx, -400), 400), y: p.y + min(max(dy, -400), 400)))
    case "c":
        clic(.left)
    case "r":
        clic(.right)
    case "z":
        moverA(CGPoint(x: limites().midX, y: limites().midY))
    case "s":
        guard confiable, partes.count == 2, let dy = Double(partes[1]), dy.isFinite else { return }
        CGEvent(scrollWheelEvent2Source: fuente, units: .pixel, wheelCount: 1,
                wheel1: Int32(min(max(dy, -300), 300)), wheel2: 0, wheel3: 0)?.post(tap: .cghidEventTap)
    case "k":
        let teclas: [Substring: CGKeyCode] = ["izq": 123, "der": 124, "aba": 125, "arr": 126,
                                             "espacio": 49, "esc": 53, "enter": 36]
        guard confiable, partes.count == 2, let codigo = teclas[partes[1]] else { return }
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
    case "g":
        guard partes.count == 2 else { return }
        mostrarCursorGrande(partes[1] == "1")
    default:
        return
    }
}

// Las órdenes se leen en otro hilo y se ejecutan en el principal, en orden.
// El hilo principal queda libre para dibujar el cursor grande.
let app = NSApplication.shared
app.setActivationPolicy(.accessory) // sin ícono en el Dock ni barra de menú

DispatchQueue.global(qos: .userInteractive).async {
    while let linea = readLine() {
        DispatchQueue.main.async { procesar(linea) }
    }
    DispatchQueue.main.async { exit(0) }
}
app.run()
