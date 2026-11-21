# Features — qué agregar

Priorizado para no romper el pitch: primero cerrar el recorrido del jurado, después extender.

## Ya está (o casi)

| Feature | Notas |
| --- | --- |
| Mando Editar / Usar | En `main` |
| Mover y redimensionar Silencio | `localStorage` `mando-layout-v1` |
| Demo mobile-first | https://mando-one.vercel.app |
| Motor `applyAction` | En rama `feat/tv-channels` (+ tests) |
| TV `renderTV` + **canales de video** | 4 clips HTML5; MUTE/VOL/CH/POWER en vivo |
| POWER / Canal +/− en el mando | Integrado en la demo |
| Celular + notebook + PJLink | Mergear [#9](https://github.com/JuanMorales10/MANDO/pull/9) |

## Quick path (próximos merges)

1. Integrar **motor → mando → TV** en `app.js` (recorrido Silencio en una sola página).
2. Mergear TV + motor; sacar el log provisorio.
3. Activar modo celular solo si el pitch de una notebook ya está seguro.

---

## P0 — Cerrar la demo del jurado

| Feature | Por qué | Esfuerzo |
| --- | --- | --- |
| Integrar `applyAction` + `renderTV` en `app.js` | Hoy la “TV” es solo un log de acciones | S |
| Pantalla completa de TV para proyector | Que se lea desde el fondo | S |
| Reset de layout (botón “Restablecer”) | Si el jurado deja el mando ilegible | S |
| Indicador visual de mute/volumen en el mando | Feedback sin mirar la TV | S |

## P1 — Mejor mando (sin salir del contrato)

| Feature | Por qué | Esfuerzo |
| --- | --- | --- |
| Más botones configurables (`POWER`, `CH_UP`, `CH_DOWN`) | El contrato ya los nombra | M |
| Perfiles guardados (Abuela / Sala / Jugador) | Historia del pitch: el control se adapta a vos | M |
| Haptic / sonido opcional al pulsar | Feedback táctil en celular | S |
| Grid más denso o libre (snap suave) | Mejor edición en pantallas chicas | M |
| Temas de color del mando (alto contraste / noche) | Accesibilidad y marca | S |
| Tutorial de 10 segundos la primera vez | Reduce fricción del jurado | S |

## P2 — Multi-dispositivo

| Feature | Por qué | Esfuerzo |
| --- | --- | --- |
| Sala con código de 4 dígitos (PR #9) | Celular manda, notebook/proyector reciben | L |
| QR para unirse a la sala | Onboarding rápido en el evento | S (sobre #9) |
| Varios mandos en la misma sala | Familia / competencia amistosa | M |
| Modo “solo TV” vs “solo mando” por URL | Proyector limpio + teléfono como control | S |

## P3 — Hardware y mundo real

| Feature | Por qué | Esfuerzo |
| --- | --- | --- |
| Conector notebook (volumen / mute OS) | Demo “de verdad” sin TV simulada | En #9 |
| PJLink (proyector en red) | Controla el proyector del salón | En #9 |
| HDMI-CEC / Chromecast | Más TVs; fuera del alcance del pitch corto | XL |
| Atajos de teclado en la notebook | Presenter mode | S |

## P4 — Producto / post-evento

| Feature | Por qué | Esfuerzo |
| --- | --- | --- |
| Exportar / importar layout (JSON / link) | Compartir “mi mando” | M |
| Analytics anónimos del recorrido del pitch | Mejorar la demo | S |
| PWA instalable en el celular | Ícono en home screen | M |
| i18n (ES / EN) | Jurado mixto | S |
| Tests e2e del recorrido Silencio | No romper el pitch | M |

---

## Ideas descartadas (por ahora)

| Idea | Motivo |
| --- | --- |
| Framework (React/Vue) | Acuerdo del equipo: vanilla |
| Base de datos / usuarios | Fuera del prototipo de 90 min |
| Video embebido en la TV | Ruido visual; el mute tiene que leerse |
| Controles que aún no tienen motor | No mostrar botones muertos |

## Checklist de aceptación de una feature nueva

- [ ] Respeta el contrato `mountRemote` / `applyAction` / `renderTV`
- [ ] Funciona en una sola página sin red (salvo features P2/P3 explícitas)
- [ ] Targets táctiles ≥ 48px y contraste alto para proyector
- [ ] No rompe Editar (sin emitir acciones) vs Usar
- [ ] Se puede demoar en < 30 segundos

## Next step

Cerrar P0: mergear motor + TV e integrar el recorrido completo en `public/app.js`.
