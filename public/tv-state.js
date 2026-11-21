// Motor de la TV simulada: estado inicial y reductor de acciones.
// No modifica el estado recibido; siempre devuelve uno nuevo o el mismo si la acción no aplica.

export const initialState = Object.freeze({
  power: true,
  volume: 15,
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
    default: {
      // Salto directo de canal (Mandy / guía), aunque la TV esté "apagada"
      if (typeof action === "string" && action.startsWith("CH_SET:")) {
        const n = Number(action.slice(7));
        if (!Number.isInteger(n) || n < CHANNEL_MIN || n > CHANNEL_MAX) return state;
        return { ...state, power: true, channel: n };
      }
      return state;
    }
  }
}
