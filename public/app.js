import { mountRemote } from "./remote.js";

const remoteRoot = document.querySelector("#remote-root");
const actionLog = document.querySelector("#action-log");

const recent = [];

function dispatch(action) {
  recent.unshift(action);
  actionLog.textContent = recent.slice(0, 5).join(" → ");
  console.log("dispatch", action);
}

mountRemote(remoteRoot, dispatch);
