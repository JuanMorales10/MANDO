// TV simulada de MANDO.
// Contrato: renderTV(el, state) dibuja la TV en `el` con el estado recibido.
// Se llama al iniciar y después de cada cambio. No guarda estado propio:
// lo que se ve sale siempre de `state`.

const ESTADO_BASE = { power: true, volume: 15, muted: false, channel: 1 };

// Dos estados de ejemplo para probar la pantalla sin las otras compus.
export const ejemplosTV = {
  normal: { power: true, volume: 15, muted: false, channel: 1 },
  silenciado: { power: true, volume: 15, muted: true, channel: 1 },
};

const ICONO_SONIDO = `
<svg class="mando-tv__icono" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <path d="M6 18h9l11-9v30l-11-9H6z" fill="currentColor"/>
  <path d="M32 17c2.6 1.8 4 4.2 4 7s-1.4 5.2-4 7M36 11c4.6 3.2 7 7.6 7 13s-2.400 9.800-7 13"
        fill="none" stroke="currentColor" stroke-width="3.500" stroke-linecap="round"/>
</svg>`;

const ICONO_SILENCIO = `
<svg class="mando-tv__icono" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <path d="M6 18h9l11-9v30l-11-9H6z" fill="currentColor"/>
  <path d="M32 18l12 12M44 18L32 30"
        fill="none" stroke="currentColor" stroke-width="4.500" stroke-linecap="round"/>
</svg>`;

const PLANTILLA = `
<section class="mando-tv" aria-label="TV simulada">
  <div class="mando-tv__pantalla">
    <header class="mando-tv__barra">
      <span class="mando-tv__titulo">TV SIMULADA</span>
    </header>

    <div class="mando-tv__centro mando-tv__centro--volumen">
      <div class="mando-tv__etiqueta">${ICONO_SONIDO}<span>VOLUMEN</span></div>
      <div class="mando-tv__numero" data-tv="volumen"></div>
    </div>

    <div class="mando-tv__centro mando-tv__centro--silencio">
      <div class="mando-tv__aviso">${ICONO_SILENCIO}<span>SILENCIO</span></div>
      <div class="mando-tv__guardado">Volumen guardado <b data-tv="volumen-guardado"></b></div>
    </div>

    <div class="mando-tv__centro mando-tv__centro--apagada">
      <div class="mando-tv__apagada">TV APAGADA</div>
    </div>

    <div class="mando-tv__medidor" aria-hidden="true">
      <div class="mando-tv__medidor-nivel" data-tv="nivel"></div>
    </div>
  </div>
  <div class="mando-tv__pie" aria-hidden="true"></div>
  <p class="mando-tv__lector" role="status" aria-live="polite" data-tv="lector"></p>
</section>`;

function normalizar(state) {
  const s = { ...ESTADO_BASE, ...(state || {}) };
  const volumen = Number(s.volume);
  return {
    power: s.power !== false,
    muted: s.muted === true,
    volume: !Number.isNaN(volumen) ? Math.min(100, Math.max(0, Math.round(volumen))) : 0,
  };
}

function describir(s) {
  if (!s.power) return "TV apagada";
  if (s.muted) return `Silencio activado. Volumen guardado ${s.volume}`;
  return `Volumen ${s.volume}`;
}

export function renderTV(el, state) {
  if (!el) return;

  let tv = el.querySelector(":scope > .mando-tv");
  if (!tv) {
    el.innerHTML = PLANTILLA;
    tv = el.querySelector(":scope > .mando-tv");
  }

  // El elemento anfitrión ocupa todo el ancho disponible. Sin esto, dentro de
  // un contenedor flex centrado se encoge a 0 y la TV no se ve.
  el.classList.add("mando-tv-anfitrion");

  const s = normalizar(state);
  const poner = (clave, texto) => {
    const nodo = tv.querySelector(`[data-tv="${clave}"]`);
    if (nodo && nodo.textContent !== String(texto)) nodo.textContent = String(texto);
  };

  tv.dataset.encendida = s.power ? "si" : "no";
  tv.dataset.silencio = s.muted ? "si" : "no";

  poner("volumen", s.volume);
  poner("volumen-guardado", s.volume);
  poner("lector", describir(s));
  tv.querySelector('[data-tv="nivel"]').style.width = `${s.volume}%`;
}
