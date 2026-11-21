// Motor de la TV simulada: estado inicial y reductor de acciones.
// No modifica el estado recibido; siempre devuelve uno nuevo o el mismo si la acción es desconocida.

export const initialState = Object.freeze({ power: true, volume: 15, muted: false, channel: 1 });

const clampVolume = (v) => Math.min(100, Math.max(0, v));

export function applyAction(state, action) {
  switch (action) {
    case "MUTE":
      return { ...state, muted: !state.muted };
    case "VOL_UP":
      return { ...state, volume: clampVolume(state.volume + 1) };
    case "VOL_DOWN":
      return { ...state, volume: clampVolume(state.volume - 1) };
    default:
      return state;
  }
}
