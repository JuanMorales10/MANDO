/**
 * TV simulada con canales de YouTube.
 * Contrato: renderTV(el, state) — se llama al iniciar y tras cada cambio.
 *
 * Canal +/− cambia de video embebido. MUTE / VOL / POWER controlan el player.
 */

import { CHANNELS } from "./catalogo.js";

export { CHANNELS };

const ESTADO_BASE = { power: true, volume: 55, muted: false, channel: 1 };

export const ejemplosTV = {
  normal: { power: true, volume: 55, muted: false, channel: 1 },
  silenciado: { power: true, volume: 55, muted: true, channel: 1 },
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

const PLANTILLA = `
<section class="mando-tv" aria-label="TV simulada">
  <div class="mando-tv__pantalla">
    <div class="mando-tv__player" data-tv="player"></div>
    <p class="mando-tv__error" data-tv="error" hidden>No se pudo cargar este canal</p>
    <button type="button" class="mando-tv__activar-audio" data-tv="activar-audio">
      Tocá para activar el sonido
    </button>
    <div class="mando-tv__scrim" aria-hidden="true"></div>

    <header class="mando-tv__barra">
      <span class="mando-tv__titulo">TV SIMULADA</span>
      <span class="mando-tv__canal" data-tv="canal-badge"></span>
    </header>

    <div class="mando-tv__hud">
      <div class="mando-tv__chip" data-tv="canal-nombre"></div>
      <div class="mando-tv__chip mando-tv__chip--vol">
        ${ICONO_SONIDO}
        <span data-tv="volumen"></span>
      </div>
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

/** @type {WeakMap<Element, object>} */
const hosts = new WeakMap();

let ytApiPromise = null;

function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("sin window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve, reject) => {
    const done = () => {
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube API no lista"));
    };
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        prev?.();
      } catch {
        // ignore
      }
      done();
    };
    if (!document.querySelector('script[data-mando-yt="1"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.dataset.mandoYt = "1";
      script.onerror = () => reject(new Error("No se pudo cargar YouTube"));
      document.head.appendChild(script);
    }
    if (window.YT?.Player) done();
  });

  return ytApiPromise;
}

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
  if (!hosts.has(el)) hosts.set(el, {});
  return tv;
}

function destroyPlayer(ctx, mount) {
  try {
    ctx.player?.destroy?.();
  } catch {
    // ignore
  }
  ctx.player = null;
  ctx.videoId = null;
  ctx.creating = false;
  ctx.broken = false;
  if (mount) mount.replaceChildren();
}

function applyPlayerState(ctx, s) {
  const player = ctx.player;
  if (!player || typeof player.mute !== "function") return;

  // Volumen audible en demo: el motor usa 0–100; YouTube también.
  const vol = Math.min(100, Math.max(0, s.volume));
  try {
    player.setVolume(vol);
  } catch {
    // ignore
  }

  const silence = !s.power || s.muted || !ctx.unlocked || ctx.micDucking;
  try {
    if (silence) player.mute();
    else {
      player.unMute();
      player.setVolume(vol);
    }
  } catch {
    // ignore
  }

  try {
    if (!s.power) {
      player.pauseVideo();
      return;
    }
    const state = player.getPlayerState?.();
    // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
    if (state !== 1 && state !== 3) player.playVideo();
  } catch {
    // ignore
  }
}

function createPlayer(el, mount, meta, errorNode) {
  const ctx = hosts.get(el);
  if (!ctx || ctx.creating) return;
  ctx.creating = true;

  loadYouTubeApi()
    .then((YT) => {
      // Si ya cambiaron de canal mientras cargaba la API, usamos el pending.
      const wanted =
        channelMeta(ctx.pending?.channel ?? meta.number).youtube || meta.youtube;

      destroyPlayer(ctx, mount);
      ctx.creating = true;

      const host = document.createElement("div");
      host.className = "mando-tv__yt";
      mount.append(host);

      ctx.player = new YT.Player(host, {
        width: "100%",
        height: "100%",
        videoId: wanted,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          mute: 1,
          iv_load_policy: 3,
          origin: location.origin,
        },
        events: {
          onReady: () => {
            ctx.videoId = wanted;
            ctx.creating = false;
            ctx.broken = false;
            if (errorNode) errorNode.hidden = true;
            // Si el canal pidió otro video durante el create, cárgalo.
            const nowId = channelMeta(ctx.pending?.channel ?? meta.number).youtube;
            if (nowId && nowId !== wanted) {
              try {
                ctx.player.loadVideoById({ videoId: nowId, startSeconds: 0 });
                ctx.videoId = nowId;
              } catch {
                destroyPlayer(ctx, mount);
                createPlayer(el, mount, channelMeta(ctx.pending.channel), errorNode);
                return;
              }
            }
            if (ctx.pending) applyPlayerState(ctx, ctx.pending);
          },
          onError: () => {
            // Player roto: destruir para que el próximo Canal +/− monte uno nuevo.
            ctx.broken = true;
            ctx.creating = false;
            if (errorNode) errorNode.hidden = false;
            destroyPlayer(ctx, mount);
          },
          onStateChange: (ev) => {
            // Solo loop en VODs; las radios en vivo no “terminan”.
            const live = channelMeta(ctx.pending?.channel ?? 1).live;
            if (ev.data === 0 && ctx.pending?.power && !live) {
              try {
                ctx.player.seekTo(0, true);
                ctx.player.playVideo();
              } catch {
                // ignore
              }
            }
          },
        },
      });
    })
    .catch(() => {
      ctx.creating = false;
      ctx.broken = true;
      if (errorNode) errorNode.hidden = false;
    });
}

function ensurePlayer(el, mount, meta, errorNode) {
  const ctx = hosts.get(el);
  if (!ctx) return;

  // Tras un error, o sin player: crear de nuevo.
  if (!ctx.player || ctx.broken) {
    createPlayer(el, mount, meta, errorNode);
    return;
  }

  if (ctx.videoId !== meta.youtube) {
    if (errorNode) errorNode.hidden = true;
    try {
      ctx.player.loadVideoById({
        videoId: meta.youtube,
        startSeconds: 0,
      });
      ctx.videoId = meta.youtube;
    } catch {
      // loadVideoById falló → recrear player limpio
      destroyPlayer(ctx, mount);
      createPlayer(el, mount, meta, errorNode);
      return;
    }
  }

  if (ctx.pending) applyPlayerState(ctx, ctx.pending);
}

/**
 * Dibuja la TV en `el` con el estado actual.
 */
export function renderTV(el, state) {
  if (!el) return;

  const tv = ensureShell(el);
  const mount = tv.querySelector('[data-tv="player"]');
  const s = normalizar(state);
  const meta = channelMeta(s.channel);
  const ctx = hosts.get(el);
  ctx.pending = s;

  const poner = (clave, texto) => {
    const nodo = tv.querySelector(`[data-tv="${clave}"]`);
    if (nodo && nodo.textContent !== String(texto)) {
      nodo.textContent = String(texto);
    }
  };

  tv.dataset.encendida = s.power ? "si" : "no";
  tv.dataset.silencio = s.muted ? "si" : "no";
  tv.dataset.audio = ctx.unlocked ? "on" : "off";
  tv.dataset.live = meta.live ? "si" : "no";
  tv.dataset.canal = String(meta.index + 1);

  poner("volumen", s.volume);
  poner("volumen-guardado", s.volume);
  poner("canal-badge", `CH ${s.channel}`);
  poner(
    "canal-nombre",
    meta.audio
      ? `${meta.name} · ${meta.tagline}`
      : `${meta.name} · ${meta.tagline}`,
  );
  poner("lector", describir(s, meta));

  const nivel = tv.querySelector('[data-tv="nivel"]');
  if (nivel) nivel.style.width = `${s.volume}%`;

  const activar = tv.querySelector('[data-tv="activar-audio"]');
  if (activar) {
    activar.hidden = Boolean(ctx.unlocked);
    if (!activar.dataset.bound) {
      activar.dataset.bound = "1";
      activar.addEventListener("click", (ev) => {
        ev.preventDefault();
        unlockTVAudio(el);
        renderTV(el, ctx.pending || s);
      });
    }
  }

  const errorNode = tv.querySelector('[data-tv="error"]');
  ensurePlayer(el, mount, meta, errorNode);
  applyPlayerState(ctx, s);
}

/** Llamar tras el primer gesto del usuario para habilitar audio. */
export function unlockTVAudio(el) {
  const ctx = hosts.get(el);
  if (!ctx) return;
  ctx.unlocked = true;
  const slap = () => {
    if (ctx.pending) applyPlayerState(ctx, ctx.pending);
    const tv = el.querySelector?.(":scope > .mando-tv");
    if (tv) tv.dataset.audio = "on";
    const btn = el.querySelector?.('[data-tv="activar-audio"]');
    if (btn) btn.hidden = true;
  };
  slap();
  // YouTube a veces tarda en aceptar unMute tras el gesto.
  clearTimeout(ctx.unlockTimer);
  let n = 0;
  const tick = () => {
    slap();
    n += 1;
    if (n < 6) ctx.unlockTimer = setTimeout(tick, 250);
  };
  ctx.unlockTimer = setTimeout(tick, 200);
}

/** Mientras Mandy escucha, callá el canal (sin tocar el estado de la sala). */
export function setTVMicDucking(el, on) {
  const ctx = hosts.get(el);
  if (!ctx) return;
  ctx.micDucking = Boolean(on);
  if (ctx.pending) applyPlayerState(ctx, ctx.pending);
  else if (ctx.player) {
    try {
      if (on) ctx.player.mute();
      else if (ctx.unlocked) ctx.player.unMute();
    } catch {
      // ignore
    }
  }
}
