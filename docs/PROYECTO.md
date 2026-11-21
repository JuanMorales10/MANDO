# MANDO — documentación del proyecto

**MANDO** es un mando configurable en el navegador: movés y agrandás tus botones, y controlás una TV simulada (y, en el modo extendido, notebook/proyector reales).

**Tagline:** *Tu control, a tu manera.*  
**Preview (TV + Mandy):** https://mando-guia-ai.vercel.app  
**Prod:** https://mando-one.vercel.app  

Home `/` = TV + QR. Celular `/celular` = Mandy + mando.

## Quick path

1. Abrí https://mando-one.vercel.app (o `npx serve public` en local).
2. Modo **Usar** → tocá Silencio / Volumen.
3. Modo **Editar** → mové o agrandá Silencio → volvé a **Usar** → tocá el botón.

## Qué es hoy

| Pieza | Estado | Dónde |
| --- | --- | --- |
| Mando configurable | En `main` / extendido | `public/remote.js` + `remote.css` |
| UX mobile-first | En `main` | `public/index.html`, `demo.css`, `identidad.css` |
| Demo estática | En producción | https://mando-one.vercel.app |
| Motor de estado | Integrado en demo de canales | `public/tv-state.js` |
| TV + canales YouTube | Demo interactiva | `public/catalogo.js` + `tv.js` — radios EN VIVO + cine |
| Home TV + QR | `/` | `index.html` + `ai.js` / `ai.css` |
| Mandy + mando | `/celular` | `celular.js` + `asistente.js` + `/api/asistente` |
| Celular + proyector real | PR abierto | [#9](https://github.com/JuanMorales10/MANDO/pull/9) · `server/` + HTML celular |

## Arquitectura (contrato)

```
mountRemote(el, dispatch)
        │
        ▼
  dispatch("MUTE" | "VOL_UP" | "VOL_DOWN" | …)
        │
        ▼
  applyAction(state, action)  →  nuevo estado (inmutable)
        │
        ▼
  renderTV(el, state)
```

| Export | Responsabilidad |
| --- | --- |
| `mountRemote(el, dispatch)` | UI del mando. Emite acciones; no conoce la TV. |
| `applyAction(state, action)` | Reglas de volumen, mute, canal, power. |
| `renderTV(el, state)` | Dibuja la TV a partir del estado. |
| Estado inicial | `{ power: true, volume: 15, muted: false, channel: 1 }` |

Layout del mando: `localStorage` clave `mando-layout-v1`.

## Stack

- HTML / CSS / JS en `public/`, sin framework ni DB.
- Paleta: azul noche `#101522`, marfil `#F5F4EE`, lima `#C9F76A`.
- Deploy: Vercel (`vercel.json` → `outputDirectory: public`).
- Modo celular (PR #9): Node en memoria + conectores notebook / PJLink.

## Cómo correr

**En Vercel:** abrí la home → escaneá el QR → controlá desde el celular.

**En local:**

```sh
git clone https://github.com/JuanMorales10/MANDO.git
cd MANDO
npm run sala          # proyector + QR + celular (LAN)
npm run sala:puntero  # sala + puntero del teléfono → cursor Mac
npm start             # solo estáticos (/demo)
```

1. Notebook: `http://localhost:8080/` o `/proyector.html`
2. Escaneá el QR con el celular
3. El mando del teléfono controla la TV (y con `sala:puntero`, también el cursor)

## Equipo

| Rol | Persona | Rama |
| --- | --- | --- |
| Mando | Juanse · @aguirrejuanse | `feat/mando` |
| Motor | Juan Morales · @JuanMorales10 | `feat/motor` |
| TV | Nico · @nicofaingold066-sketch | `feat/tv` |
| Integración / pitch | Santiago · @sponte77 | `feat/demo` |

## Pitch

> No tenés que adaptarte al control. El control se adapta a vos.

## Siguiente lectura

- [Features y roadmap](./FEATURES.md)
- [Plan de 90 minutos (README)](../README.md)
