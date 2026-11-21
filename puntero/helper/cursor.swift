// Ayudante mínimo: lee órdenes por stdin y mueve el cursor con CGEvent.
// Órdenes (una por línea):  m <dx> <dy> | c | r | z | q
import Foundation
import CoreGraphics
import ApplicationServices

setvbuf(stdout, nil, _IOLBF, 0)

func bounds() -> CGRect { CGDisplayBounds(CGMainDisplayID()) }

var last: CGPoint? = nil

func pos() -> CGPoint {
    return CGEvent(source: nil)?.location ?? last ?? CGPoint(x: bounds().midX, y: bounds().midY)
}

func post(_ type: CGEventType, _ p: CGPoint, _ button: CGMouseButton) {
    CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: p, mouseButton: button)?
        .post(tap: .cghidEventTap)
}

func moveTo(_ p: CGPoint) {
    let b = bounds()
    let q = CGPoint(x: min(max(p.x, b.minX), b.maxX - 1), y: min(max(p.y, b.minY), b.maxY - 1))
    // Warp mueve el cursor aun sin permiso de Accesibilidad; el evento avisa a las apps.
    CGWarpMouseCursorPosition(q)
    CGAssociateMouseAndMouseCursorPosition(1)
    last = q
    post(.mouseMoved, q, .left)
}

func click(_ right: Bool) {
    let p = pos()
    post(right ? .rightMouseDown : .leftMouseDown, p, right ? .right : .left)
    usleep(15000)
    post(right ? .rightMouseUp : .leftMouseUp, p, right ? .right : .left)
}

let trusted = AXIsProcessTrusted()
let b = bounds()
print("ready trusted=\(trusted) w=\(Int(b.width)) h=\(Int(b.height))")

while let line = readLine() {
    let parts = line.split(separator: " ")
    guard let cmd = parts.first else { continue }
    switch cmd {
    case "m":
        guard parts.count == 3, let dx = Double(parts[1]), let dy = Double(parts[2]),
              dx.isFinite, dy.isFinite, abs(dx) <= 500, abs(dy) <= 500 else { continue }
        let p = pos()
        moveTo(CGPoint(x: p.x + dx, y: p.y + dy))
    case "c": click(false)
    case "r": click(true)
    case "z": moveTo(CGPoint(x: bounds().midX, y: bounds().midY))
    case "p": let p = pos(); print("pos \(Int(p.x)) \(Int(p.y))")
    case "q": exit(0)
    default: continue
    }
}
