# MANDO · Plan para 4 computadoras · Prototipo en 90 minutos

**Tu control, a tu manera.**

**Demo:** https://mando-one.vercel.app · **Docs:** [Proyecto](./docs/PROYECTO.md) · [Features](./docs/FEATURES.md)

**Celular + QR (misma WiFi):** `npm run sala` → abrí `http://localhost:8080/proyector.html` → escaneá el QR con el teléfono.

Alguien del jurado mueve y agranda **Silencio**, vuelve al modo **Usar**, toca el botón reubicado y se silencia la TV simulada del proyector. La demo tiene que funcionar en una sola página y en una sola notebook, sin depender del celular, un QR ni la red entre máquinas.

## Quién hace qué

| Compu | Responsable | Correo | Rama | Entrega |
| --- | --- | --- | --- | --- |
| 1 | Juan «Juanse» Aguirre · @aguirrejuanse | Juanseagui@gmail.com | `feat/mando` | [Mando y editor · #1](https://github.com/JuanMorales10/MANDO/issues/1) |
| 2 | Juan Morales · @JuanMorales10 | juanmoralesp19@gmail.com | `feat/motor` | [Motor y pruebas · #2](https://github.com/JuanMorales10/MANDO/issues/2) |
| 3 | Nicolás «Nico» Faingold · @nicofaingold066-sketch | nicofaingold066@gmail.com | `feat/tv` | [TV y visual de proyector · #4](https://github.com/JuanMorales10/MANDO/issues/4) |
| 4 | Santiago · @sponte77 | Sponte77@gmail.com | `feat/demo` | [Integración, GitHub y pitch · #3](https://github.com/JuanMorales10/MANDO/issues/3) |

## Acuerdos antes de arrancar

Un solo repo de GitHub. Todos parten del mismo `main`. Cada compu abre su rama y toca únicamente sus archivos. Si ya existe una rama con trabajo, se conserva. **Solo la compu 4 integra en `main`.**

HTML, CSS y JS, sin framework ni base de datos. Identidad **MANDO · Tu control, a tu manera**. Azul noche `#101522`, marfil `#F5F4EE` y lima `#C9F76A`. Usen botones con texto e ícono, contraste alto y letra grande para proyectar.

Si todavía no tienen el repo en su compu, clónenlo y abran esa carpeta en Cursor.

```sh
git clone https://github.com/JuanMorales10/MANDO.git
cd MANDO
```

## Compu 1 · Juanse · Mando y editor

**Rama** `feat/mando` · **Archivos** `public/remote.js` y `public/remote.css`.

- Exportá `mountRemote(el, dispatch)`. El mando no conoce la TV, no calcula el volumen y no llama a ninguna API.
- Primero armá los modos **Editar / Usar** y los botones Silencio y Volumen +/−. En Usar emiten `MUTE`, `VOL_UP` y `VOL_DOWN`. En Editar, nunca emiten acciones.
- Hacé que «Silencio» se mueva con mouse y dedo. Si arrastrar complica, permití seleccionar el botón y tocar su casilla destino. Después agregá dos tamaños y guardá posiciones y tamaños en `localStorage` con la clave `mando-layout-v1`. Usá clases con prefijo `.mando-remote`.
- Probá con un `dispatch` provisorio que mover no emite nada, usar emite una sola acción y recargar conserva el diseño. Abrí PR apenas funcione mover y usar «Silencio», aunque falte el pulido.

## Compu 2 · Juan · Motor y pruebas

**Rama** `feat/motor` · **Archivos** `public/tv-state.js` y `tests/tv-state.test.mjs`.

- Exportá `initialState = { power: true, volume: 15, muted: false, channel: 1 }` y `applyAction(state, action)`.
- `MUTE` alterna silencio sin cambiar el volumen guardado. `VOL_UP` y `VOL_DOWN` cambian el volumen de a 1, de 0 a 100. Una acción desconocida no cambia nada. No modifiques el estado original.
- Subí `MUTE` primero. Después probá dos pulsaciones para volver al estado inicial, volumen preservado, ambos topes, acción desconocida y que no se modifica el objeto original. Corré `node --test tests/tv-state.test.mjs`. Pasale a Santiago los nombres de los dos exports y el resultado. Nada de servidor ni base de datos para la entrega inicial.

## Compu 3 · Nico · TV y visual de proyector

**Rama** `feat/tv` · **Archivos** `public/tv.js` y `public/tv.css`.

- Exportá `renderTV(el, state)`. Trabajá con dos estados de ejemplo, normal y silenciado, sin esperar a las otras compus.
- Mostrá **TV SIMULADA**, volumen grande y un aviso **SILENCIO** que se lea desde el fondo. Usá texto, ícono y contraste, no solo color. Al desactivar silencio, que vuelva a verse el volumen anterior. Estilos con prefijo `.mando-tv`.
- No pongas video, fuentes externas ni controles que todavía no funcionan. Abrí PR con la primera pantalla usable. Una vez integrada, probala en pantalla completa y avisá si algo se corta o no se lee.

## Compu 4 · Santiago · Integración, GitHub y pitch

**Rama** `feat/demo` · **Archivos** `public/index.html`, `public/app.js`, `public/demo.css`, `package.json` y `README.md`.

- Dejá en la base común `package.json` con `{ "private": true, "type": "module" }` si todavía no existe. Armá la pantalla dividida con un botón y un indicador provisorios mientras llegan los módulos.
- Integrá **motor → mando → TV** y después tu pantalla. En `app.js` guardá el estado y conectá **`mountRemote` → `dispatch(action)` → `applyAction` → `renderTV`**. Importá las tres hojas de estilo y sacá los elementos provisorios. Al abrir, dibujá la TV con `initialState`.
- Publicá `public/` como la demo estática. Verificá en incógnito y desde otra compu que el enlace abre sin sesión. Probá **Editar → mover y agrandar Silencio → Usar → tocar el botón reubicado → TV silenciada**. Documentá cómo abrirla localmente y poné el enlace en este README. La demo publicada funciona sin una sala ni la red del evento.

## Reloj común

| Minuto | Hito |
| --- | --- |
| 0–5 | Santiago pasa el repo y los contratos. Todos abren su rama. Cursor construye y cada persona edita sus archivos. |
| 25 | Cada compu sube su bloque y abre PR a `main`. Santiago integra. Si hay conflicto, lo resuelve con el dueño del archivo. |
| 45 | Hagan el recorrido completo de «Silencio» en la notebook. Guarden ese commit como respaldo. Si funciona, ya pueden publicar. |
| 60 | Prueben desde otro equipo, recarguen y revisen tamaño, volumen y proyector. Usen Grokbot para buscar fallas en ese recorrido. Arreglen solo lo que lo rompa. |
| 75–90 | Congelen, ensayen y envíen **visión + repo + demo** en **Equipos**. Guardar un borrador no cuenta. **Cierre a las 15:00 de Mendoza**. Si el reloj aprieta, entreguen antes el último commit que funciona. Celu y QR quedan afuera hasta tener la entrega asegurada. |

## Pitch

«No tenés que adaptarte al control. El control se adapta a vos».

Dale el mouse a alguien del jurado para que mueva su botón y lo use. El cambio en la TV es la prueba.
