# MANDO · Compu real

Tu teléfono pasa a ser el control de la Mac: lo movés en el aire y se mueve el cursor,
un toque hace clic, y además trae el mando de MANDO (volumen real) y botones para pasar diapositivas.

## Arrancar

```bash
cd puntero
npm install
npm start
```

Se abre sola una pantalla con un **QR grande** (también sale en la terminal).

1. Escaneá el QR con la cámara del teléfono. Tiene que estar en la misma Wi-Fi que la Mac.
2. El teléfono avisa que el certificado no es de confianza: **Avanzado → Continuar**. Es un certificado propio, creado en tu Mac.
3. Tocá **Activar puntero** y aceptá el permiso de movimiento.
4. Apuntá a la pantalla como con un control remoto.

## Qué podés hacer desde el teléfono

- **Puntero:** mover el teléfono mueve el cursor. Tocar la zona grande = clic. Arrastrar el dedo también mueve.
  Mientras el teléfono está conectado, en la Mac el cursor se ve grande y con un halo, para seguirlo desde lejos.
  Dos dedos = desplazar la página. Toque con dos dedos = clic derecho. «Centrar» lleva el cursor al medio.
- **Mando:** el mando de MANDO; volumen y silencio cambian el volumen real de la Mac.
- **Diapositivas:** Anterior, Siguiente, Espacio, Enter y Esc.
- **Ajustes:** velocidad, invertir cada eje, y «mover solo con el dedo apoyado».

## Cortar

- En el teléfono: **Desconectar** (abajo, en Puntero).
- En la Mac: **Ctrl+C** en la terminal. Se apaga todo.

## Si los clics no andan

macOS pide permiso para que un programa haga clic o apriete teclas por vos. Sin ese permiso el cursor se mueve, pero no hay clics, ni rueda, ni teclas.
Al arrancar, macOS muestra un cartel: abrí **Ajustes del Sistema → Privacidad y seguridad → Accesibilidad** y activá la app que nombra
(Terminal, iTerm, Claude…). No hace falta reiniciar: la pantalla del QR pasa a «Clics habilitados ✓».

## Si el teléfono no llega a la Mac

Muchas Wi-Fi de eventos no dejan que los equipos se vean entre sí.

- **Plan B:** activá el hotspot del teléfono y conectá la Mac a ese hotspot. El QR de la pantalla se actualiza solo.
- **Plan C:** un túnel HTTPS hacia el puerto del servidor y abrir en el teléfono la dirección del túnel con `/#t=EL_CODIGO` al final.
  Ojo: eso lo expone a internet y lo único que lo protege es el código.

## Seguridad

- Código aleatorio nuevo en cada arranque (va en el QR). Sin código no hay conexión.
- Un solo teléfono a la vez. Solo redes privadas y solo desde la propia página.
- Lista cerrada de órdenes: mover, clic, clic derecho, centrar, rueda, siete teclas fijas y tres acciones de volumen.
  Nunca se ejecuta un comando que venga del teléfono.
- La pantalla del QR solo se puede abrir desde la propia Mac.

## Opciones

- `PUERTO=8444 npm start`: elegir el puerto (por defecto 8443; si está ocupado prueba el siguiente).
- `SIN_PANTALLA=1 npm start`: no abrir la pantalla del QR ni el cartel de permiso.
- `CURSOR_GRANDE=0 npm start`: no mostrar el cursor grande (flecha con halo) mientras hay un teléfono conectado.
- `PRUEBA=1 npm start`: además sirve la página del teléfono por HTTP solo en esta compu, para probar sin certificado.

## Cómo está hecho

- `cursor.swift`: ayudante mínimo que mueve el cursor, hace clic, rueda y teclas con `CGEvent`. Se compila solo la primera vez (necesita las Command Line Tools de Xcode).
- `server.mjs`: HTTPS con certificado autofirmado (`.cert/`), WebSocket y, de respaldo, las mismas órdenes por POST. Sirve `remote.js`, `remote.css` e `identidad.css` del proyecto sin modificarlos.
- `public/index.html`, `puntero.js`, `puntero.css`: la página del teléfono. Usa la velocidad de giro (`devicemotion.rotationRate`). Dos gestos de calibración le enseñan qué es «derecha» y «arriba», y la gravedad (acelerómetro) hace que siga andando aunque cambies la forma de agarrar el teléfono.
- `public/pantalla.html`: la pantalla del QR para la Mac.
