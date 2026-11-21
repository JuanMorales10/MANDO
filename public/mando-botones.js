// Catálogo único de botones del mando completo.
// Lo usan el celular (para dibujar), el servidor (para validar) y el proyector (para avisar).

export const SECCIONES = [
  { id: "basicos", nombre: "Básicos" },
  { id: "navegacion", nombre: "Navegación" },
  { id: "reproduccion", nombre: "Reproducción" },
  { id: "apps", nombre: "Apps" },
  { id: "numeros", nombre: "Números" },
];

const numeros = Array.from({ length: 10 }, (_, i) => {
  const n = (i + 1) % 10; // 1…9 y después 0, como en un control real
  return { id: `NUM_${n}`, nombre: String(n), icono: String(n), seccion: "numeros", soloIcono: true };
});

export const BOTONES = [
  { id: "POWER", nombre: "Encendido", icono: "⏻", seccion: "basicos", tono: "encendido" },
  { id: "INPUT", nombre: "Entrada", icono: "⇄", seccion: "basicos" },
  { id: "MUTE", nombre: "Silencio", icono: "🔇", seccion: "basicos" },
  { id: "VOL_DOWN", nombre: "Volumen −", icono: "−", seccion: "basicos" },
  { id: "VOL_UP", nombre: "Volumen +", icono: "+", seccion: "basicos" },
  { id: "CH_DOWN", nombre: "Canal −", icono: "⌄", seccion: "basicos" },
  { id: "CH_UP", nombre: "Canal +", icono: "⌃", seccion: "basicos" },

  { id: "UP", nombre: "Arriba", icono: "▲", seccion: "navegacion", soloIcono: true },
  { id: "LEFT", nombre: "Izquierda", icono: "◀", seccion: "navegacion", soloIcono: true },
  { id: "OK", nombre: "OK", icono: "OK", seccion: "navegacion", soloIcono: true },
  { id: "RIGHT", nombre: "Derecha", icono: "▶", seccion: "navegacion", soloIcono: true },
  { id: "DOWN", nombre: "Abajo", icono: "▼", seccion: "navegacion", soloIcono: true },
  { id: "BACK", nombre: "Volver", icono: "↩", seccion: "navegacion" },
  { id: "HOME", nombre: "Inicio", icono: "⌂", seccion: "navegacion" },
  { id: "MENU", nombre: "Menú", icono: "☰", seccion: "navegacion" },

  { id: "REWIND", nombre: "Retroceder", icono: "◀◀", seccion: "reproduccion" },
  { id: "PLAY_PAUSE", nombre: "Play / Pausa", icono: "▶❚❚", seccion: "reproduccion" },
  { id: "FORWARD", nombre: "Adelantar", icono: "▶▶", seccion: "reproduccion" },
  { id: "FULLSCREEN", nombre: "Pantalla completa", icono: "⛶", seccion: "reproduccion" },

  { id: "APP_NETFLIX", nombre: "Netflix", seccion: "apps", url: "https://www.netflix.com/browse" },
  { id: "APP_YOUTUBE", nombre: "YouTube", seccion: "apps", url: "https://www.youtube.com/tv" },
  { id: "APP_DISNEY", nombre: "Disney+", seccion: "apps", url: "https://www.disneyplus.com" },
  { id: "APP_PRIME", nombre: "Prime Video", seccion: "apps", url: "https://www.primevideo.com" },
  { id: "APP_SPOTIFY", nombre: "Spotify", seccion: "apps", url: "https://open.spotify.com" },

  ...numeros,
];

export const ACCIONES = BOTONES.map((b) => b.id);
export const BOTON = Object.fromEntries(BOTONES.map((b) => [b.id, b]));
export const nombreDe = (id) => BOTON[id]?.nombre ?? id;

// Favoritos de fábrica: lo mínimo para que cualquiera lo use sin pensar.
export const FAVORITOS_INICIALES = ["POWER", "MUTE", "VOL_DOWN", "VOL_UP"];
