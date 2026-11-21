// Motor de la TV simulada: estado inicial y reductor de acciones.
// No modifica el estado recibido; siempre devuelve uno nuevo o el mismo si la acción no aplica.

export const initialState = Object.freeze({
  power: true,
  volume: 55,
  muted: false,
  channel: 1,
});

export const VOLUME_MIN = 0;
export const VOLUME_MAX = 100;
export const CHANNEL_MIN = 1;
export const CHANNEL_MAX = 99;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const wrapChannel = (c) =>
  c > CHANNEL_MAX ? CHANNEL_MIN : c < CHANNEL_MIN ? CHANNEL_MAX : c;

export function applyAction(state, action) {
  if (action === "POWER") return { ...state, power: !state.power };

  // Salto directo de canal (asistente de voz / mini IA), aunque la TV esté "apagada"
  // la dejamos encendida para que el pedido se vea.
  if (typeof action === "string" && action.startsWith("CH_SET:")) {
    const n = Number(action.slice(7));
    if (!Number.isFinite(n)) return state;
    return {
      ...state,
      power: true,
      channel: wrapChannel(Math.round(n)),
    };
  }

  if (!state.power) return state;

  switch (action) {
    case "MUTE":
      return { ...state, muted: !state.muted };
    case "VOL_UP":
      return { ...state, volume: clamp(state.volume + 1, VOLUME_MIN, VOLUME_MAX) };
    case "VOL_DOWN":
      return { ...state, volume: clamp(state.volume - 1, VOLUME_MIN, VOLUME_MAX) };
    case "CH_UP":
      return { ...state, channel: wrapChannel(state.channel + 1) };
    case "CH_DOWN":
      return { ...state, channel: wrapChannel(state.channel - 1) };
    default:
      return state;
  }
}
