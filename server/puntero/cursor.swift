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
//   l 1 | l 0     prender / apagar el láser: un punto rojo que sigue al cursor
//   d 1 | d 0     empezar / terminar un trazo dibujado sobre la pantalla
//   b             borrar todos los trazos
//   lock          bloquear la pantalla (Control+Comando+Q)
// Solo entiende esas órdenes. Cualquier otra línea se ignora.

import AppKit
import ApplicationServices
import Foundation

setvbuf(stdout, nil, _IOLBF, 0)

// Se consulta cada vez: si el usuario da el permiso con esto andando, empieza a funcionar solo.
var confiable: Bool { AXIsProcessTrusted() }

let fuente = CGEventSource(stateID: .hidSystemState)

func limites() -> CGRect {
    return CGDisplayBounds(CGMainDisplayID())
}

func posicionActual() -> CGPoint {
    return CGEvent(source: nil)?.location ?? CGPoint(x: limites().midX, y: limites().midY)
}

// Dónde quedó el cursor la última vez que lo movimos, con decimales: así los movimientos de
// menos de medio punto se van sumando en vez de perderse al redondear.
var guardada: CGPoint? = nil

// Por dónde anduvo el cursor movido por nosotros en la última décima de segundo. Un movimiento
// recién mandado tarda un instante en verse: si el cursor real todavía está en uno de estos
// puntos, es que viene en camino y no que lo movió otro.
var recientes: [(p: CGPoint, t: TimeInterval)] = []

func anotar(_ p: CGPoint) {
    let ahora = ProcessInfo.processInfo.systemUptime
    recientes.removeAll { ahora - $0.t >= 0.1 }
    recientes.append((p, ahora))
}

func cerca(_ a: CGPoint, _ b: CGPoint, _ margen: CGFloat) -> Bool {
    return abs(a.x - b.x) <= margen && abs(a.y - b.y) <= margen
}

// La posición guardada mientras el cursor real siga ahí (a menos de `margen` puntos);
// si alguien movió el mouse de verdad, manda la real.
func posicionFina(_ margen: CGFloat) -> CGPoint {
    let real = posicionActual()
    guard let g = guardada else { return real }
    if cerca(real, g, margen) { return g }
    let ahora = ProcessInfo.processInfo.systemUptime
    if recientes.contains(where: { ahora - $0.t < 0.1 && cerca(real, $0.p, margen) }) { return g }
    return real
}

func moverA(_ p: CGPoint) {
    let b = limites()
    let x = min(max(p.x, b.minX), b.maxX - 1)
    let y = min(max(p.y, b.minY), b.maxY - 1)
    let destino = CGPoint(x: x, y: y)
    anotar(posicionActual())
    anotar(destino)
    guardada = destino
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

// ----- Capa de dibujo: una ventana transparente por encima de todo, que el mouse atraviesa -----
var ventana: NSWindow? = nil
let capaTrazos = CALayer() // los trazos, debajo del láser
let laser = CALayer()      // el punto rojo con su halo
var laserPrendido = false
var trazo: CAShapeLayer? = nil // el trazo que se está dibujando
var camino = CGMutablePath()
var ultimoPunto = CGPoint.zero
var reloj: Timer? = nil

func rojo(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ alfa: CGFloat) -> CGColor {
    return CGColor(srgbRed: r, green: g, blue: b, alpha: alfa)
}

// Un círculo con degradé del centro hacia afuera.
func circulo(_ diametro: CGFloat, _ colores: [CGColor], _ cortes: [NSNumber], _ escala: CGFloat) -> CALayer {
    let c = CAGradientLayer()
    c.type = .radial
    c.colors = colores
    c.locations = cortes
    c.startPoint = CGPoint(x: 0.5, y: 0.5)
    c.endPoint = CGPoint(x: 1, y: 1)
    c.bounds = CGRect(x: 0, y: 0, width: diametro, height: diametro)
    c.cornerRadius = diametro / 2
    c.masksToBounds = true
    c.contentsScale = escala
    return c
}

func armarVentana() {
    guard let pantalla = NSScreen.screens.first else { return } // la principal: la de la barra de menús
    let v = NSWindow(contentRect: pantalla.frame, styleMask: .borderless, backing: .buffered, defer: false)
    v.isOpaque = false
    v.backgroundColor = .clear
    v.hasShadow = false
    v.ignoresMouseEvents = true
    v.isReleasedWhenClosed = false
    v.animationBehavior = .none // sin el efecto de macOS al aparecer y desaparecer
    // Por encima de todo, también de las apps en pantalla completa, y en todos los escritorios.
    v.level = NSWindow.Level(rawValue: Int(CGShieldingWindowLevel()))
    v.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
    let vista = NSView(frame: NSRect(origin: .zero, size: pantalla.frame.size))
    let raiz = CALayer()
    vista.layer = raiz
    vista.wantsLayer = true
    v.contentView = vista

    let escala = pantalla.backingScaleFactor
    // Halo de 70 puntos que se desvanece + punto de 22 con el centro más claro, como un láser de verdad.
    laser.addSublayer(circulo(70, [rojo(1, 0.1, 0.1, 0.6), rojo(1, 0.1, 0.1, 0.25), rojo(1, 0.1, 0.1, 0)],
                              [0, 0.4, 1], escala))
    laser.addSublayer(circulo(22, [rojo(1, 0.55, 0.5, 1), rojo(1, 0.08, 0.08, 1), rojo(0.85, 0, 0, 1)],
                              [0, 0.5, 1], escala))
    laser.isHidden = true
    raiz.addSublayer(capaTrazos)
    raiz.addSublayer(laser)
    ventana = v
}

// De coordenadas de CGEvent (origen arriba a la izquierda) a las de la capa (origen abajo a la izquierda).
func aCapa(_ p: CGPoint) -> CGPoint {
    let b = limites()
    return CGPoint(x: p.x - b.minX, y: b.maxY - p.y)
}

// Lleva el láser y el trazo en curso a donde está el cursor, lo mueva el teléfono o el mouse real.
func refrescar() {
    let p = aCapa(posicionFina(1))
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    if laserPrendido { laser.position = p }
    if let t = trazo, hypot(p.x - ultimoPunto.x, p.y - ultimoPunto.y) >= 0.5 {
        camino.addLine(to: p)
        t.path = camino.copy()
        ultimoPunto = p
    }
    CATransaction.commit()
}

func empezarTrazo() {
    let p = aCapa(posicionFina(1))
    let t = CAShapeLayer()
    t.strokeColor = rojo(1, 0.08, 0.08, 1)
    t.fillColor = nil
    t.lineWidth = 5
    t.lineCap = .round
    t.lineJoin = .round
    t.contentsScale = ventana?.backingScaleFactor ?? 2
    camino = CGMutablePath()
    camino.move(to: p)
    camino.addLine(to: p) // un toque sin mover deja un punto
    t.path = camino.copy()
    ultimoPunto = p
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    capaTrazos.addSublayer(t)
    CATransaction.commit()
    trazo = t
}

func terminarTrazo() {
    guard trazo != nil else { return }
    refrescar() // el último tramo
    trazo = nil
}

func borrarTrazos() {
    trazo = nil
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    capaTrazos.sublayers = nil
    CATransaction.commit()
}

// La ventana se muestra solo si hay algo que mostrar, y el reloj corre solo si hay algo que seguir.
func acomodar() {
    guard let v = ventana else { return }
    if laserPrendido || !(capaTrazos.sublayers ?? []).isEmpty {
        v.orderFrontRegardless() // sin activar la app: no le roba el foco a nadie
    } else {
        v.orderOut(nil)
    }
    let seguir = laserPrendido || trazo != nil
    if seguir, reloj == nil {
        let r = Timer(timeInterval: 1.0 / 60.0, repeats: true) { _ in refrescar() }
        RunLoop.main.add(r, forMode: .common)
        reloj = r
    } else if !seguir, let r = reloj {
        r.invalidate()
        reloj = nil
    }
}

func atender(_ linea: String) {
    let partes = linea.split(separator: " ")
    guard let orden = partes.first else { return }
    switch orden {
    case "m":
        guard partes.count == 3, let dx = Double(partes[1]), let dy = Double(partes[2]),
              dx.isFinite, dy.isFinite else { return }
        let p = posicionFina(3)
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
    case "l":
        guard ventana != nil, partes.count == 2, partes[1] == "1" || partes[1] == "0" else { return }
        laserPrendido = partes[1] == "1"
        laser.isHidden = !laserPrendido
        refrescar()
        acomodar()
    case "d":
        guard ventana != nil, partes.count == 2, partes[1] == "1" || partes[1] == "0" else { return }
        terminarTrazo()
        if partes[1] == "1" { empezarTrazo() }
        acomodar()
    case "b":
        let dibujando = trazo != nil
        borrarTrazos()
        if dibujando { empezarTrazo() } // el botón de dibujar sigue apretado: se sigue desde acá
        acomodar()
    case "lock":
        // Control+Comando+Q: el atajo de macOS para bloquear la pantalla.
        guard confiable else { return }
        let banderas: CGEventFlags = [.maskControl, .maskCommand]
        let abajo = CGEvent(keyboardEventSource: fuente, virtualKey: 12, keyDown: true)
        abajo?.flags = banderas
        abajo?.post(tap: .cghidEventTap)
        usleep(12_000)
        let arriba = CGEvent(keyboardEventSource: fuente, virtualKey: 12, keyDown: false)
        arriba?.flags = banderas
        arriba?.post(tap: .cghidEventTap)
    case "q":
        exit(0)
    default:
        return
    }
}

// ----- Arranque: app sin ícono en el Dock, con su bucle de eventos -----
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
// Sin esto macOS «duerme» a las apps que no tienen ventanas a la vista y el cursor iría a los saltos.
// No impide que la Mac se suspenda.
let despierto = ProcessInfo.processInfo.beginActivity(
    options: [.userInitiatedAllowingIdleSystemSleep, .latencyCritical], reason: "puntero")

armarVentana()
print("listo accesibilidad=\(confiable ? "si" : "no")" + (ventana != nil ? " laser=si" : ""))

// Si cambia la pantalla (por ejemplo, se enchufa el proyector) la capa se vuelve a acomodar.
// Los trazos viejos quedarían corridos: se borran.
NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification,
                                       object: nil, queue: .main) { _ in
    guard let v = ventana, let pantalla = NSScreen.screens.first else { return }
    v.setFrame(pantalla.frame, display: true)
    let dibujando = trazo != nil
    borrarTrazos()
    if dibujando { empezarTrazo() }
    acomodar()
}

// stdin se lee en un hilo aparte; cada orden se atiende, en orden, en el hilo principal.
Thread.detachNewThread {
    while let linea = readLine() {
        DispatchQueue.main.async { atender(linea) }
    }
    DispatchQueue.main.async { exit(0) }
}
app.run()
