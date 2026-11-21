/**
 * TV simulada con canales de video.
 * Contrato: renderTV(el, state) — se llama al iniciar y tras cada cambio.
 *
 * Canales: clips públicos (Google sample / MDN). CH_UP/DOWN ciclan la grilla.
 * MUTE / VOL / POWER controlan el <video> en vivo.
 */

const ESTADO_BASE = { power: true, volume: 15, muted: false, channel: 1 };

/**
 * Catálogo de canales (HTML5).
 * Fuentes públicas que responden 200 (el bucket gtv-videos de Google ahora da 403).
 * Índice = (channel - 1) % length
 */
export const CHANNELS = [
  {
    id: 1,
    name: "Naturaleza",
    tagline: "Flor · MDN",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  },
  {
    id: 2,
    name: "Corto",
    tagline: "Sample 5s",
    src: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
  },
  {
    id: 3,
    name: "Calle",
    tagline: "Sample 10s",
    src: "https://samplelib.com/lib/preview/mp4/sample-10s.mp4",
  },
  {
    id: 4,
    name: "Viaje",
    tagline: "Sample 15s",
    src: "https://samplelib.com/lib/preview/mp4/sample-15s.mp4",
  },
];

export const ejemplosTV = {
  normal: { power: true, volume: 15, muted: false, channel: 1 },
  silenciado: { power: true, volume: 15, muted: true, channel: 1 },
};

const ICONO_SONIDO = `
<svg class="mando-tv__icono" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <path d="M6 18h9l11-9v30l-11-9H6z" fill="currentColor"/>
  <path d="M32 17c2.6 1.8 4 4.2 4 7s-1.4 5.2-4 7M36 11c4.6 3.2 7 7.6 7 13s-2.4 9.8-7 13"
        fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
</svg>`;

const ICONO_SILENCIO = `
<svg class="mando-tv__icono" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <path d="M6 18h9l11-9v30l-11-9H6z" fill="currentColor"/>
  <path d="M32 18l12 12M44 18L32 30"
        fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>
</svg>`;

const ICONO_ENCENDIDO = `
<svg class="mando-tv__icono" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <path d="M24 6v17" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
  <path d="M14.5 12.5a15 15 0 1 0 19 0" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
</svg>`;

const PLANTILLA = `
<section class="mando-tv" aria-label="TV simulada">
  <div class="mando-tv__pantalla">
    <video class="mando-tv__video" playsinline loop preload="auto" crossorigin="anonymous"></video>
    <p class="mando-tv__error" data-tv="error" hidden>No se pudo cargar este canal</p>
    <div class="mando-tv__scrim" aria-hidden="true"></div>

    <header class="mando-tv__barra">
      <div class="mando-tv__vidrio mando-tv__canal-pill">
        <span class="mando-tv__canal" data-tv="canal-badge"></span>
        <span class="mando-tv__nombre" data-tv="canal-nombre"></span>
      </div>
      <span class="mando-tv__vivo">EN VIVO</span>
    </header>

    <div class="mando-tv__hud">
      <div class="mando-tv__vidrio mando-tv__chip mando-tv__chip--vol">
        ${ICONO_SONIDO}
        <div class="mando-tv__medidor" aria-hidden="true">
          <div class="mando-tv__medidor-nivel" data-tv="nivel"></div>
        </div>
        <span class="mando-tv__vol-num" data-tv="volumen"></span>
      </div>
    </div>

    <div class="mando-tv__centro mando-tv__centro--silencio">
      <div class="mando-tv__aviso">
        ${ICONO_SILENCIO}
        <span class="mando-tv__aviso-texto">SILENCIO</span>
        <span class="mando-tv__guardado">Volumen guardado <b data-tv="volumen-guardado"></b></span>
      </div>
    </div>

    <div class="mando-tv__centro mando-tv__centro--apagada">
      <div class="mando-tv__apagada">${ICONO_ENCENDIDO}<span>TV apagada</span></div>
    </div>
  </div>
  <p class="mando-tv__lector" role="status" aria-live="polite" data-tv="lector"></p>
</section>`;

function channelMeta(channel) {
  const n = Number(channel) || 1;
  const index = ((n - 1) % CHANNELS.length + CHANNELS.length) % CHANNELS.length;
  return { ...CHANNELS[index], number: n, index };
}

function normalizar(state) {
  const s = { ...ESTADO_BASE, ...(state || {}) };
  const volumen = Number(s.volume);
  const canal = Number(s.channel);
  return {
    power: s.power !== false,
    muted: s.muted === true,
    volume: !Number.isNaN(volumen)
      ? Math.min(100, Math.max(0, Math.round(volumen)))
      : 0,
    channel: !Number.isNaN(canal) ? Math.max(1, Math.round(canal)) : 1,
  };
}

function describir(s, meta) {
  if (!s.power) return "TV apagada";
  if (s.muted) {
    return `Silencio. Canal ${s.channel} · ${meta.name}. Volumen guardado ${s.volume}`;
  }
  return `Canal ${s.channel} · ${meta.name}. Volumen ${s.volume}`;
}

function ensureShell(el) {
  let tv = el.querySelector(":scope > .mando-tv");
  if (!tv) {
    el.innerHTML = PLANTILLA;
    tv = el.querySelector(":scope > .mando-tv");
  }
  el.classList.add("mando-tv-anfitrion");
  return tv;
}

function syncVideo(video, s, meta, errorNode) {
  if (!video) return;

  if (!video.dataset.bound) {
    video.dataset.bound = "1";
    video.addEventListener("error", () => {
      if (errorNode) errorNode.hidden = false;
    });
    video.addEventListener("loadeddata", () => {
      if (errorNode) errorNode.hidden = true;
    });
  }

  const nextSrc = meta.src;
  const currentSrc = video.getAttribute("data-channel-src");
  if (currentSrc !== nextSrc) {
    if (errorNode) errorNode.hidden = true;
    video.setAttribute("data-channel-src", nextSrc);
    video.src = nextSrc;
    video.load();
  }

  // Autoplay: los browsers suelen exigir mute en el primer play.
  const wantsSound = s.power && !s.muted;
  video.muted = s.muted || !s.power || !video.dataset.unlocked;
  video.volume = Math.min(1, Math.max(0, s.volume / 100));

  if (!s.power) {
    video.pause();
    return;
  }

  const playPromise = video.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {
      video.muted = true;
      video.play().catch(() => {});
    });
  }

  if (wantsSound && video.dataset.unlocked) {
    video.muted = s.muted;
  }
}

/**
 * Dibuja la TV en `el` con el estado actual.
 */
export function renderTV(el, state) {
  if (!el) return;

  const tv = ensureShell(el);
  const video = tv.querySelector(".mando-tv__video");
  const s = normalizar(state);
  const meta = channelMeta(s.channel);

  const poner = (clave, texto) => {
    const nodo = tv.querySelector(`[data-tv="${clave}"]`);
    if (nodo && nodo.textContent !== String(texto)) {
      nodo.textContent = String(texto);
    }
  };

  tv.dataset.encendida = s.power ? "si" : "no";
  tv.dataset.silencio = s.muted ? "si" : "no";
  tv.dataset.canal = String(meta.index + 1);

  poner("volumen", s.volume);
  poner("volumen-guardado", s.volume);
  poner("canal-badge", `CH ${s.channel}`);
  poner("canal-nombre", `${meta.name} · ${meta.tagline}`);
  poner("lector", describir(s, meta));

  const nivel = tv.querySelector('[data-tv="nivel"]');
  if (nivel) nivel.style.width = `${s.volume}%`;

  const errorNode = tv.querySelector('[data-tv="error"]');
  syncVideo(video, s, meta, errorNode);
}

/** Llamar tras el primer gesto del usuario para habilitar audio. */
export function unlockTVAudio(el) {
  const video = el?.querySelector?.(".mando-tv__video");
  if (!video) return;
  video.dataset.unlocked = "1";
  if (video.paused) {
    video.play().catch(() => {});
  }
}
