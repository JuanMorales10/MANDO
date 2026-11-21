import { mountRemote } from "./remote.js";

const LABELS = {
  MUTE: "SILENCIO",
  VOL_UP: "VOLUMEN +",
  VOL_DOWN: "VOLUMEN −",
};

const remoteRoot = document.querySelector("#remote-root");
const actionLog = document.querySelector("#action-log");

if (!remoteRoot || !actionLog) {
  throw new Error("Faltan #remote-root o #action-log en la demo");
}

let pulseTimer = 0;

function showAction(action) {
  actionLog.textContent = LABELS[action] || action;
  actionLog.classList.remove("is-pulse");
  // Force reflow so the pulse can replay on repeated presses.
  void actionLog.offsetWidth;
  actionLog.classList.add("is-pulse");
  window.clearTimeout(pulseTimer);
  pulseTimer = window.setTimeout(() => {
    actionLog.classList.remove("is-pulse");
  }, 280);
}

function dispatch(action) {
  showAction(action);
  console.log("dispatch", action);
}

mountRemote(remoteRoot, dispatch);
