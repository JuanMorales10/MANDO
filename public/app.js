import { mountRemote } from "./remote.js";

const remoteRoot = document.querySelector("#remote-root");
const actionLog = document.querySelector("#action-log");

if (!remoteRoot || !actionLog) {
  throw new Error("Faltan #remote-root o #action-log en la demo");
}

const recent = [];

function dispatch(action) {
  recent.unshift(action);
  recent.length = Math.min(recent.length, 5);
  actionLog.textContent = recent.join(" → ");
  console.log("dispatch", action);
}

mountRemote(remoteRoot, dispatch);
