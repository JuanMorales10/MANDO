import { mountRemote } from "./remote.js";
import { initialState, applyAction } from "./tv-state.js";
import { renderTV, unlockTVAudio } from "./tv.js";

const remoteRoot = document.querySelector("#remote-root");
const tvRoot = document.querySelector("#tv-root");

if (!remoteRoot || !tvRoot) {
  throw new Error("Faltan #remote-root o #tv-root en la demo");
}

let state = { ...initialState };

function paint() {
  renderTV(tvRoot, state);
}

function dispatch(action) {
  unlockTVAudio(tvRoot);
  state = applyAction(state, action);
  paint();
  console.log("dispatch", action, state);
}

paint();
mountRemote(remoteRoot, dispatch);

window.addEventListener(
  "pointerdown",
  () => {
    unlockTVAudio(tvRoot);
    paint();
  },
  { once: true, passive: true },
);
