import { applyAction, initialState } from "../../public/tv-state.js";
import { ACCIONES } from "../../public/mando-botones.js";

const CACHE_KEY = "sala";
const TTL = 60 * 60 * 12; // 12h — dura la demo de la hackatón

/** Fallback in-process (local / si el Runtime Cache no responde). */
let memoria = null;

function crearSala() {
  const fijo = process.env.SALA;
  const codigo =
    fijo && /^\d{4}$/.test(fijo)
      ? fijo
      : String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return {
    codigo,
    state: { ...initialState },
    ultima: null,
    chat: [],
  };
}

const MAX_CHAT = 40;

/** Agrega mensajes al chat compartido (notebook ↔ celu). */
export async function registrarChat(sala, mensajes) {
  const lista = Array.isArray(mensajes) ? mensajes : [mensajes];
  const prev = Array.isArray(sala.chat) ? sala.chat : [];
  const ahora = Date.now();
  const nuevos = lista
    .filter((m) => m && (m.content || m.texto))
    .map((m, i) => ({
      id: m.id || `m-${ahora}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      role: m.role === "user" ? "user" : "assistant",
      content: String(m.content || m.texto || "").slice(0, 500),
      origen: m.origen || "mandy",
      hora: m.hora || ahora + i,
      sugerencias: Array.isArray(m.sugerencias) ? m.sugerencias.slice(0, 5) : undefined,
    }));
  sala.chat = [...prev, ...nuevos].slice(-MAX_CHAT);
  await guardarSala(sala);
  return sala.chat;
}

async function cache() {
  try {
    const { getCache } = await import("@vercel/functions");
    return getCache({ namespace: "mando" });
  } catch {
    return null;
  }
}

export async function leerSala() {
  const c = await cache();
  if (c) {
    try {
      const hit = await c.get(CACHE_KEY);
      if (hit?.codigo && hit?.state) {
        if (!Array.isArray(hit.chat)) hit.chat = [];
        memoria = hit;
        return hit;
      }
    } catch {
      // sigue al fallback
    }
  }
  if (memoria?.codigo && memoria?.state) return memoria;
  const sala = crearSala();
  await guardarSala(sala);
  return sala;
}

export async function guardarSala(sala) {
  memoria = sala;
  const c = await cache();
  if (!c) return;
  try {
    await c.set(CACHE_KEY, sala, { ttl: TTL, tags: ["sala"], name: "mando-sala" });
  } catch {
    // Memoria local alcanza para esta instancia.
  }
}

export function paquete(sala) {
  return {
    state: sala.state,
    ultima: sala.ultima,
    chat: Array.isArray(sala.chat) ? sala.chat : [],
    conectores: [],
  };
}

function accionValida(accion) {
  if (ACCIONES.includes(accion)) return true;
  if (typeof accion === "string" && /^CH_SET:\d{1,3}$/.test(accion)) return true;
  return false;
}

export async function ejecutarAccion(sala, accion, origen, pasoVolumen = 1) {
  if (!accionValida(accion)) {
    const err = new Error("Acción desconocida");
    err.status = 400;
    throw err;
  }
  let despues = sala.state;
  const veces =
    accion === "VOL_UP" || accion === "VOL_DOWN" ? Math.max(1, pasoVolumen) : 1;
  for (let i = 0; i < veces; i += 1) despues = applyAction(despues, accion);
  sala.state = despues;
  sala.ultima = { accion, origen, hora: Date.now() };
  await guardarSala(sala);
  return sala.state;
}

export function json(res, status, cuerpo) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("access-control-allow-origin", "*");
  res.end(JSON.stringify(cuerpo));
}

export async function leerJson(req) {
  const trozos = [];
  for await (const chunk of req) trozos.push(chunk);
  return JSON.parse(Buffer.concat(trozos).toString("utf8"));
}

export function hostPublico(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${proto}://${host}`;
}
