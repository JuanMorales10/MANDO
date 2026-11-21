# MANDO · Puntero

Usá el teléfono como puntero en el aire: lo movés y se mueve el cursor de la Mac. Un toque = clic.

## Arrancar

```bash
cd puntero
npm install
npm start
```

1. La terminal muestra un **QR**. Escanealo con la cámara del teléfono (misma Wi-Fi que la Mac).
2. El teléfono avisa que el certificado no es de confianza: **Avanzado → Continuar** (es un certificado propio, generado en tu Mac).
3. Tocá **Activar puntero** y aceptá el permiso de movimiento.
4. Apuntá a la pantalla como con un control remoto. Tocá la zona grande para hacer clic.

Si va para el lado contrario, usá **Invertir ←→ / ↑↓**. La barra **Velocidad** ajusta la sensibilidad.
Si el movimiento libre molesta, activá **Mover solo con el dedo apoyado**.

## Cortar

- En el teléfono: botón **Desconectar**.
- En la Mac: **Ctrl+C** en la terminal. Se apaga todo.

## Si los clics no andan

macOS pide permiso para que un programa haga clic por vos. Sin ese permiso el cursor se mueve, pero no hace clic.
Ajustes del Sistema → Privacidad y seguridad → **Accesibilidad** → activá la app desde la que corrés `npm start`
(Terminal, iTerm, Claude…) y volvé a arrancar.

## Si el teléfono no llega a la Mac

Muchas Wi-Fi de eventos no dejan que los equipos se vean entre sí.

- **Plan B:** activá el hotspot del teléfono, conectá la Mac a ese hotspot y volvé a correr `npm start`.
- **Plan C:** un túnel HTTPS hacia `https://localhost:8765` (por ejemplo `cloudflared tunnel --url https://localhost:8765 --no-tls-verify`)
  y abrir en el teléfono la dirección del túnel con `/#t=EL_TOKEN` al final. Ojo: eso lo expone a internet; solo lo protege el token.

## Seguridad

- Token aleatorio nuevo en cada arranque (va en el QR). Sin token no hay conexión.
- Un solo teléfono a la vez. Solo direcciones de red privada.
- El teléfono solo puede pedir cuatro cosas: mover, clic, clic derecho y centrar. Nada más; nunca se ejecutan comandos.

## Cómo está hecho

- `helper/cursor.swift`: ayudante mínimo que mueve el cursor (CGEvent). Se compila solo la primera vez (necesita las Command Line Tools de Xcode).
- `server.mjs`: HTTPS + WebSocket (con POST como respaldo), certificado autofirmado en `.cert/`.
- `public/`: la página del teléfono. Usa la velocidad de giro (`devicemotion.rotationRate`) con zona muerta y suavizado.
- `PRUEBA=1 npm start` abre además `http://localhost:8799` solo en esta compu, para probar sin certificado.
