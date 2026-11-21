/**
 * Voz → texto (Web Speech API).
 * Mantiene el stream del mic abierto mientras escucha (más estable en Chrome/Android).
 */

export function soportaVoz() {
  return Boolean(
    typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition),
  );
}

function SpeechCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

const ERRORES = {
  "not-allowed": "Permiso de mic denegado. Activá el mic en la barra del navegador.",
  "service-not-allowed": "Este navegador bloquea la voz. Probá Chrome.",
  "no-speech": "No escuché nada. Tocá 🎤 y hablá más fuerte.",
  aborted: "Se canceló la escucha.",
  network: "El servicio de voz falló. Escribí el pedido abajo.",
  "audio-capture": "No hay micrófono disponible.",
  "language-not-supported": "Idioma no soportado. Escribí el pedido.",
};

/**
 * @param {object} opts
 * @param {(texto: string) => void} opts.onTexto
 * @param {(msg: string) => void} [opts.onEstado]
 * @param {() => void} [opts.onFin]
 * @param {() => void|Promise<void>} [opts.onInicio] — mic listo; callá la TV acá
 */
export async function escuchar({ onTexto, onEstado, onFin, onInicio }) {
  const Ctor = SpeechCtor();
  if (!Ctor) {
    onEstado?.("Voz no disponible acá. Escribí abajo.");
    onFin?.();
    return null;
  }
  if (!window.isSecureContext) {
    onEstado?.("La voz necesita HTTPS.");
    onFin?.();
    return null;
  }

  let stream = null;
  try {
    onEstado?.("Activando mic…");
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    onEstado?.(ERRORES["not-allowed"]);
    onFin?.();
    return null;
  }

  try {
    await onInicio?.();
  } catch {
    // si falló callar la TV, igual seguimos escuchando
  }

  const liberarMic = () => {
    if (!stream) return;
    for (const t of stream.getTracks()) t.stop();
    stream = null;
  };

  const rec = new Ctor();
  // es-AR a veces falla; es-ES es más compatible con el motor de Google.
  rec.lang = "es-ES";
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;

  let finalTexto = "";
  let interimTexto = "";
  let stopped = false;
  let delivered = false;
  let hardStopTimer = null;

  const terminar = (forzar = false) => {
    if (delivered && !forzar) return;
    clearTimeout(hardStopTimer);
    stopped = true;
    try {
      rec.stop();
    } catch {
      // ignore
    }
    liberarMic();
    const texto = (finalTexto || interimTexto).trim();
    if (texto && !delivered) {
      delivered = true;
      onTexto(texto);
    } else if (!delivered) {
      onEstado?.("No capturé audio. Tocá 🎤 otra vez o escribí.");
    }
    onFin?.();
  };

  rec.onstart = () => {
    onEstado?.("Escuchando… hablá ahora");
    // Escucha ~6s y cierra (continuous no se corta solo).
    hardStopTimer = setTimeout(() => terminar(), 6000);
  };

  rec.onresult = (ev) => {
    interimTexto = "";
    for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
      const piece = ev.results[i][0]?.transcript || "";
      if (ev.results[i].isFinal) finalTexto += `${piece} `;
      else interimTexto += piece;
    }
    const live = (finalTexto || interimTexto).trim();
    if (live) onEstado?.(`“${live}”`);

    // Si ya hay una frase final clara, cortamos.
    if (finalTexto.trim().length >= 3) {
      clearTimeout(hardStopTimer);
      hardStopTimer = setTimeout(() => terminar(), 450);
    }
  };

  rec.onerror = (ev) => {
    const code = ev.error || "";
    // "no-speech" / "aborted" los manejamos en onend con el texto que haya.
    if (code === "not-allowed" || code === "service-not-allowed" || code === "network") {
      onEstado?.(ERRORES[code] || `Error de voz (${code}).`);
    }
  };

  rec.onend = () => {
    if (stopped) {
      liberarMic();
      return;
    }
    // El motor a veces corta solo: entregamos lo que haya.
    liberarMic();
    const texto = (finalTexto || interimTexto).trim();
    if (texto && !delivered) {
      delivered = true;
      onTexto(texto);
    } else if (!delivered) {
      onEstado?.("No capturé audio. Tocá 🎤 otra vez o escribí.");
    }
    onFin?.();
  };

  try {
    rec.start();
  } catch {
    liberarMic();
    onEstado?.("No se pudo iniciar la voz. Escribí el pedido.");
    onFin?.();
    return null;
  }

  return {
    stop() {
      terminar(true);
    },
  };
}
