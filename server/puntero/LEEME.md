# Puntero para el modo celular

Mover el teléfono mueve el cursor de la notebook; un toque hace clic. Se suma al
servidor del modo celular **sin modificar ninguno de sus archivos**.

## Arrancar

```sh
node server/con-puntero.mjs
```

Es el mismo servidor de `server/server.mjs` (misma sala, mismo código, mismos conectores) más:

- una puerta **HTTPS** en el 8443 para los teléfonos (los sensores de movimiento la exigen);
- un **QR** en la pantalla del proyector, que ahora se abre en `http://localhost:8090/proyector.html`;
- un botón **🎯 Puntero** dentro del mando del celular.

En el teléfono: escanear el QR, aceptar el aviso del certificado (es propio, creado en
la notebook), entrar al mando y tocar **🎯 Puntero** → **Activar puntero**.

## Cómo se suma sin tocar lo existente

- `server/puntero/puntero.mjs` atiende las mismas páginas y la misma API reenviando cada
  pedido al servidor de siempre. A `celular.html` y `proyector.html` les agrega una
  etiqueta `<script>` al servirlas (`public/puntero/extra-*.js`); los archivos no cambian.
- `server/puntero/cursor.swift` mueve el cursor y hace clic. Se compila sola la primera
  vez (necesita las Command Line Tools de Xcode). Solo macOS; en otro sistema el
  puntero queda apagado y todo lo demás funciona igual.
- `server/puntero/vendor/qrcode/` es el generador de QR (licencia MIT), copiado para
  seguir sin dependencias de npm.

## Seguridad

- Mismo código de 4 dígitos de la sala. Ocho códigos incorrectos desde un mismo
  teléfono lo bloquean un minuto.
- Solo redes privadas, solo desde la propia página, un solo teléfono a la vez.
- Lista cerrada de órdenes: mover, clic, clic derecho, centrar, rueda y siete teclas
  fijas. Nunca se ejecuta un comando que llegue del teléfono.
- El QR y el código solo se le entregan a la propia notebook.

## Si los clics no andan

macOS pide permiso para que un programa haga clic. Habilitá la app que lanza el
servidor (Terminal, iTerm…) en Ajustes del Sistema → Privacidad y seguridad →
Accesibilidad. Sin ese permiso el cursor se mueve igual.

## Si el teléfono no llega a la notebook

Muchas Wi-Fi de eventos no dejan que los equipos se vean. Plan B: activar el hotspot
del teléfono, conectar la notebook a ese hotspot y volver a arrancar.

## Opciones

`PORT` (8080), `PUERTO_HTTPS` (8443), `PUERTO_PANTALLA` (8090), y las mismas de
`server.mjs`: `SALA`, `PASO_VOLUMEN`, `COMPUTADORA`, `PJLINK_HOST`.
