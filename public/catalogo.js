/**
 * Guía de canales tipo cable (DirectTV / Supercanal).
 * Géneros + keywords para el asistente (local o Commit Academy).
 */

export const GENEROS = [
  { id: "radio-hablada", nombre: "Radio hablada", orden: 1 },
  { id: "radio-musica", nombre: "Radio música", orden: 2 },
  { id: "cine", nombre: "Cine y series", orden: 3 },
  { id: "docs", nombre: "Documentales", orden: 4 },
  { id: "deportes", nombre: "Deportes", orden: 5 },
  { id: "kids", nombre: "Clásicos", orden: 6 },
];

/**
 * Catálogo. `youtube` debe permitir embed (oEmbed 200).
 * `live` = stream 24/7. `hablada` = gente hablando (charlas / TED / estudio).
 */
export const CHANNELS = [
  {
    id: 101,
    name: "Charlas TED",
    tagline: "Creatividad · Ken Robinson",
    youtube: "iG9CE55wbtY",
    genero: "radio-hablada",
    hablada: true,
    audio: true,
    keywords: ["ted", "charla", "hablar", "hablada", "creatividad", "escuela", "entrevista", "podcast", "radio hablada", "conferencia"],
  },
  {
    id: 102,
    name: "Procrastinación",
    tagline: "Tim Urban · TED",
    youtube: "arj7oStGLkU",
    genero: "radio-hablada",
    hablada: true,
    audio: true,
    keywords: ["procrastinar", "tim urban", "ted", "charla", "hablar", "hablada", "podcast", "motivacion", "motivación"],
  },
  {
    id: 103,
    name: "Liderazgo",
    tagline: "Simon Sinek · TED",
    youtube: "qp0HIF3SfI4",
    genero: "radio-hablada",
    hablada: true,
    audio: true,
    keywords: ["liderazgo", "simon sinek", "ted", "charla", "hablar", "hablada", "negocios", "trabajo", "entrevista"],
  },
  {
    id: 104,
    name: "Vulnerabilidad",
    tagline: "Brené Brown · TED",
    youtube: "iCvmsMzlF7o",
    genero: "radio-hablada",
    hablada: true,
    audio: true,
    keywords: ["brene", "brenè", "brown", "vulnerabilidad", "ted", "charla", "hablar", "hablada", "emociones", "podcast"],
  },
  {
    id: 105,
    name: "Estudiar mejor",
    tagline: "Marty Lobdell",
    youtube: "IlU-zDU6aQ0",
    genero: "radio-hablada",
    hablada: true,
    audio: true,
    keywords: ["estudiar", "estudio", "universidad", "charla", "hablar", "hablada", "consejos", "clase", "podcast"],
  },
  {
    id: 106,
    name: "Bounty Hunter",
    tagline: "Historia real · charla",
    youtube: "TQHEJj68Jew",
    genero: "radio-hablada",
    hablada: true,
    audio: true,
    keywords: ["historia", "charla", "hablar", "hablada", "entrevista", "realidad", "story", "podcast"],
  },
  {
    id: 107,
    name: "Lenguaje corporal",
    tagline: "Amy Cuddy · TED",
    youtube: "Ks-_Mh1QhMc",
    genero: "radio-hablada",
    hablada: true,
    audio: true,
    keywords: ["amy cuddy", "lenguaje", "corporal", "confianza", "ted", "charla", "hablar", "hablada"],
  },
  {
    id: 108,
    name: "Mejores stats",
    tagline: "Hans Rosling · TED",
    youtube: "hVimVzgtD6w",
    genero: "radio-hablada",
    hablada: true,
    audio: true,
    keywords: ["hans", "rosling", "datos", "stats", "mundo", "ted", "charla", "hablar", "hablada"],
  },
  {
    id: 109,
    name: "Una sola historia",
    tagline: "Chimamanda · TED",
    youtube: "D9Ihs241zeg",
    genero: "radio-hablada",
    hablada: true,
    audio: true,
    keywords: ["chimamanda", "historia", "africa", "narrativa", "ted", "charla", "hablar", "hablada"],
  },
  {
    id: 110,
    name: "Steve Jobs",
    tagline: "Stanford 2005",
    youtube: "UF8uR6Z6KLc",
    genero: "radio-hablada",
    hablada: true,
    audio: true,
    keywords: ["steve jobs", "apple", "stanford", "discurso", "charla", "hablar", "hablada", "inspiracion"],
  },
  {
    id: 111,
    name: "Última clase",
    tagline: "Randy Pausch",
    youtube: "ji5_MqicxSo",
    genero: "radio-hablada",
    hablada: true,
    audio: true,
    keywords: ["randy", "pausch", "sueños", "clase", "charla", "hablar", "hablada", "vida"],
  },
  {
    id: 112,
    name: "Introvertidos",
    tagline: "Susan Cain · TED",
    youtube: "c0KYU2j0TM4",
    genero: "radio-hablada",
    hablada: true,
    audio: true,
    keywords: ["susan cain", "introvertidos", "quiet", "ted", "charla", "hablar", "hablada"],
  },
  {
    id: 113,
    name: "Vida feliz",
    tagline: "Sam Berns · TEDx",
    youtube: "36m1o-tM05g",
    genero: "radio-hablada",
    hablada: true,
    audio: true,
    keywords: ["sam berns", "felicidad", "filosofia", "ted", "charla", "hablar", "hablada"],
  },
  {
    id: 114,
    name: "Cómo hablar",
    tagline: "Julian Treasure · TED",
    youtube: "eIho2S0ZahI",
    genero: "radio-hablada",
    hablada: true,
    audio: true,
    keywords: ["julian", "hablar", "escuchar", "voz", "ted", "charla", "hablada", "comunicacion"],
  },
  {
    id: 115,
    name: "Tech & AI",
    tagline: "Sundar Pichai",
    youtube: "n2RNcPRtAiY",
    genero: "radio-hablada",
    hablada: true,
    audio: true,
    keywords: ["ia", "ai", "google", "tech", "tecnologia", "entrevista", "charla", "hablar", "hablada"],
  },
  {
    id: 201,
    name: "Radio Lofi",
    tagline: "🔴 EN VIVO · chill beats",
    youtube: "jfKfPfyJRdk",
    genero: "radio-musica",
    live: true,
    audio: true,
    keywords: ["lofi", "musica", "música", "radio", "chill", "beats"],
  },
  {
    id: 202,
    name: "Radio Jazz",
    tagline: "🔴 EN VIVO · piano 24/7",
    youtube: "Dx5qFachd3A",
    genero: "radio-musica",
    live: true,
    audio: true,
    keywords: ["jazz", "piano", "musica", "música", "radio", "cafe", "café"],
  },
  {
    id: 203,
    name: "Radio House",
    tagline: "🔴 EN VIVO · Good Life",
    youtube: "36YnV9STBqc",
    genero: "radio-musica",
    live: true,
    audio: true,
    keywords: ["house", "fiesta", "musica", "música", "radio", "gym", "dance"],
  },
  {
    id: 204,
    name: "Radio Synth",
    tagline: "🔴 EN VIVO · synthwave",
    youtube: "4xDzrJKXOOY",
    genero: "radio-musica",
    live: true,
    audio: true,
    keywords: ["synth", "synthwave", "gaming", "musica", "música", "radio"],
  },
  {
    id: 205,
    name: "Radio Clásica",
    tagline: "Mozart · Beethoven",
    youtube: "jgpJVI3tDbY",
    genero: "radio-musica",
    audio: true,
    keywords: ["clasica", "clásica", "mozart", "orquesta", "musica", "música"],
  },
  {
    id: 206,
    name: "Lofi Sleep",
    tagline: "Beats para dormir",
    youtube: "DWcJFNfaw9c",
    genero: "radio-musica",
    live: true,
    audio: true,
    keywords: ["lofi", "sleep", "dormir", "chill", "musica", "música", "radio", "noche"],
  },
  {
    id: 207,
    name: "Ambiente",
    tagline: "Hidden Valley · relax",
    youtube: "2OEL4P1Rz04",
    genero: "radio-musica",
    audio: true,
    keywords: ["ambiente", "relax", "meditation", "meditacion", "musica", "música", "calma"],
  },
  {
    id: 208,
    name: "Study Session",
    tagline: "Lofi 1 A.M.",
    youtube: "lTRiuFIWV54",
    genero: "radio-musica",
    audio: true,
    keywords: ["estudiar", "study", "lofi", "focus", "musica", "música", "concentracion"],
  },
  {
    id: 209,
    name: "Rock",
    tagline: "Metallica · Nothing Else",
    youtube: "tAGnKpE4NCI",
    genero: "radio-musica",
    audio: true,
    keywords: ["rock", "metal", "metallica", "musica", "música", "guitarra"],
  },
  {
    id: 210,
    name: "Latino",
    tagline: "Despacito · Fonsi",
    youtube: "kJQP7kiw5Fk",
    genero: "radio-musica",
    audio: true,
    keywords: ["latino", "reggaeton", "despacito", "fiesta", "musica", "música", "baile"],
  },
  {
    id: 301,
    name: "Cine",
    tagline: "Big Buck Bunny",
    youtube: "aqz-KE-bpKQ",
    genero: "cine",
    audio: true,
    keywords: ["cine", "pelicula", "película", "movie", "film", "corto"],
  },
  {
    id: 302,
    name: "Animación",
    tagline: "Sintel",
    youtube: "eRsGyueVLvQ",
    genero: "cine",
    audio: true,
    keywords: ["animacion", "animación", "sintel", "cine", "corto"],
  },
  {
    id: 303,
    name: "Sci-Fi",
    tagline: "Tears of Steel",
    youtube: "R6MlUcmOul8",
    genero: "cine",
    audio: true,
    keywords: ["scifi", "sci-fi", "ciencia ficcion", "ciencia ficción", "robots", "accion", "acción"],
  },
  {
    id: 304,
    name: "Spring",
    tagline: "Blender Open Movie",
    youtube: "WhWc3b3KhnY",
    genero: "cine",
    audio: true,
    keywords: ["spring", "blender", "animacion", "animación", "cine", "corto", "primavera"],
  },
  {
    id: 305,
    name: "Llamigos",
    tagline: "Caminandes 3",
    youtube: "SkVqJ1SGeL0",
    genero: "cine",
    audio: true,
    keywords: ["llama", "caminandes", "blender", "animacion", "animación", "cine", "corto"],
  },
  {
    id: 306,
    name: "Inception",
    tagline: "Trailer oficial",
    youtube: "YoHD9XEInc0",
    genero: "cine",
    audio: true,
    keywords: ["inception", "nolan", "trailer", "cine", "pelicula", "película", "suenos"],
  },
  {
    id: 307,
    name: "Batman",
    tagline: "The Dark Knight",
    youtube: "EXeTwQWrcwY",
    genero: "cine",
    audio: true,
    keywords: ["batman", "dark knight", "nolan", "trailer", "cine", "accion", "acción"],
  },
  {
    id: 308,
    name: "Pulp Fiction",
    tagline: "Trailer 1994",
    youtube: "s7EdQ4FqbhY",
    genero: "cine",
    audio: true,
    keywords: ["pulp fiction", "tarantino", "trailer", "cine", "clasico", "clásico"],
  },
  {
    id: 309,
    name: "Shawshank",
    tagline: "Trailer · Redención",
    youtube: "6hB3S9bIaco",
    genero: "cine",
    audio: true,
    keywords: ["shawshank", "redencion", "trailer", "cine", "drama", "carcel"],
  },
  {
    id: 310,
    name: "GTA VI",
    tagline: "Trailer 1",
    youtube: "QdBZY2fkU-0",
    genero: "cine",
    audio: true,
    keywords: ["gta", "trailer", "juegos", "gaming", "accion", "acción", "cine"],
  },
  {
    id: 401,
    name: "Naturaleza",
    tagline: "Costa Rica 4K",
    youtube: "LXb3EKWsInQ",
    genero: "docs",
    audio: true,
    keywords: ["naturaleza", "documental", "costa rica", "animales", "viaje", "4k"],
  },
  {
    id: 402,
    name: "Paisajes",
    tagline: "Nature + music",
    youtube: "BHACKCNDMW8",
    genero: "docs",
    audio: true,
    keywords: ["paisaje", "documental", "naturaleza", "relax", "viaje"],
  },
  {
    id: 403,
    name: "Viajes",
    tagline: "Perú 8K",
    youtube: "1La4QzGeaaQ",
    genero: "docs",
    audio: true,
    keywords: ["viaje", "peru", "perú", "documental", "turismo", "8k"],
  },
  {
    id: 404,
    name: "Timelapse",
    tagline: "Amazing Nature HD",
    youtube: "mcixldqDIEQ",
    genero: "docs",
    audio: true,
    keywords: ["timelapse", "naturaleza", "documental", "4k", "paisaje"],
  },
  {
    id: 405,
    name: "Planeta Tierra",
    tagline: "Escenarios naturales",
    youtube: "6v2L2UGZJAM",
    genero: "docs",
    audio: true,
    keywords: ["planeta", "tierra", "earth", "naturaleza", "documental", "paisaje"],
  },
  {
    id: 406,
    name: "Powers of Ten",
    tagline: "Escala del universo · 1977",
    youtube: "0fKBhvDjuy0",
    genero: "docs",
    audio: true,
    keywords: ["universo", "ciencia", "escala", "documental", "espacio", "clasico"],
  },
  {
    id: 407,
    name: "Animación 101",
    tagline: "12 principios",
    youtube: "uDqjIdI4bF4",
    genero: "docs",
    audio: true,
    keywords: ["animacion", "animación", "principios", "disney", "documental", "aprender"],
  },
  {
    id: 408,
    name: "Álgebra visual",
    tagline: "3Blue1Brown · vectores",
    youtube: "fNk_zzaMoSs",
    genero: "docs",
    audio: true,
    keywords: ["mate", "matematica", "vectores", "algebra", "ciencia", "aprender", "documental"],
  },
  {
    id: 501,
    name: "Deportes",
    tagline: "Acción · Ninja course",
    youtube: "hFZFjoX2cGg",
    genero: "deportes",
    audio: true,
    keywords: ["deporte", "deportes", "sports", "futbol", "fútbol", "gol", "partido", "accion", "acción", "ninja"],
  },
  {
    id: 502,
    name: "Epic Split",
    tagline: "Van Damme · Volvo",
    youtube: "M7FIvfx5J10",
    genero: "deportes",
    audio: true,
    keywords: ["van damme", "split", "accion", "acción", "deportes", "camion", "stunt"],
  },
  {
    id: 503,
    name: "Mundial",
    tagline: "Waka Waka · FIFA",
    youtube: "pRpeEdMmmQ0",
    genero: "deportes",
    audio: true,
    keywords: ["mundial", "fifa", "futbol", "fútbol", "shakira", "deportes", "hymno"],
  },
  {
    id: 601,
    name: "Clásicos",
    tagline: "Muppets · Bohemian",
    youtube: "tgbNymZ7vqY",
    genero: "kids",
    audio: true,
    keywords: ["clasicos", "clásicos", "muppets", "bohemian", "karaoke", "musica", "música"],
  },
  {
    id: 602,
    name: "Chimenea",
    tagline: "Fireplace HD",
    youtube: "L_LUpnjgPso",
    genero: "docs",
    audio: true,
    keywords: ["chimenea", "fuego", "ambiente", "relax", "invierno"],
  },
  {
    id: 603,
    name: "Keyboard Cat",
    tagline: "El original",
    youtube: "J---aiyznGQ",
    genero: "kids",
    audio: true,
    keywords: ["gato", "cat", "meme", "clasicos", "clásicos", "divertido", "funny"],
  },
  {
    id: 604,
    name: "Happy",
    tagline: "Pharrell Williams",
    youtube: "ZbZSe6N_BXs",
    genero: "kids",
    audio: true,
    keywords: ["happy", "pharrell", "feliz", "baile", "musica", "música", "clasicos"],
  },
];

const INTENCIONES = [
  {
    id: "silencio",
    re: /\b(silenci|mute|calla|sin\s*sonido)\b/i,
    accion: "MUTE",
    mensaje: "Listo: silencio.",
  },
  {
    id: "volumen_up",
    re: /\b(m[aá]s\s*fuerte|sub[iíe]\s*(el\s*)?volumen|volumen\s*\+)\b/i,
    accion: "VOL_UP",
    mensaje: "Subo el volumen.",
  },
  {
    id: "volumen_down",
    re: /\b(m[aá]s\s*bajo|baj[aá]\s*(el\s*)?volumen|volumen\s*\-)\b/i,
    accion: "VOL_DOWN",
    mensaje: "Bajo el volumen.",
  },
  {
    id: "apagar",
    re: /\b(apag[aá]|power\s*off)\b/i,
    accion: "POWER",
    mensaje: "Apago o enciendo la TV.",
  },
  {
    id: "siguiente",
    re: /\b(siguiente|otro\s*canal|canal\s*\+|zap[eé]a)\b/i,
    accion: "CH_UP",
    mensaje: "Paso al siguiente canal.",
  },
  {
    id: "anterior",
    re: /\b(anterior|canal\s*\-)\b/i,
    accion: "CH_DOWN",
    mensaje: "Vuelvo al canal anterior.",
  },
];

function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function puntuarCanal(canal, q) {
  const bolsa = normalizarTexto(
    [canal.name, canal.tagline, canal.genero, ...(canal.keywords || [])].join(" "),
  );
  if (!q) return 0;
  let score = 0;
  for (const token of q.split(" ")) {
    if (token.length < 3) continue;
    if (bolsa.includes(token)) score += token.length >= 5 ? 3 : 2;
  }
  const nombre = normalizarTexto(canal.name);
  if (q.includes(nombre)) score += 5;
  if (/\bhablad|charla|podcast|entrevista|ted\b/.test(q) && canal.hablada) score += 4;
  if (/\bmusica|música|lofi|jazz|house\b/.test(q) && canal.genero === "radio-musica") score += 3;
  return score;
}

/** Índice 0-based en CHANNELS → número de canal en la guía (posición + 1). */
export function canalNumero(index) {
  return index + 1;
}

export function guiaPorGenero() {
  return GENEROS.map((g) => ({
    ...g,
    canales: CHANNELS.map((c, index) => ({
      ...c,
      index,
      channel: canalNumero(index),
    })).filter((c) => c.genero === g.id),
  })).filter((g) => g.canales.length > 0);
}

export function buscarCatalogo(texto, { limite = 3 } = {}) {
  const q = normalizarTexto(texto);
  return CHANNELS.map((c, index) => ({
    ...c,
    index,
    channel: canalNumero(index),
    score: puntuarCanal(c, q),
  }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limite);
}

/** Chips iniciales del chat Mandy. */
export function sugerenciasIniciales() {
  return ["una charla", "radio jazz", "cine", "deportes", "silencio"];
}

function chipsDeCanales(lista, { excluirId, limite = 4 } = {}) {
  return lista
    .filter((c) => c.id !== excluirId)
    .slice(0, limite)
    .map((c) => c.name);
}

function chipsRelacionados(canal) {
  const mismos = CHANNELS.filter((c) => c.genero === canal.genero && c.id !== canal.id);
  const chips = chipsDeCanales(mismos, { limite: 3 });
  if (canal.hablada) chips.push("radio jazz");
  else if (canal.genero === "radio-musica") chips.push("una charla");
  else chips.push("silencio");
  return [...new Set(chips)].slice(0, 4);
}

/** Normaliza sugerencias (objetos o strings) a frases para chips. */
export function chipsDesdeRespuesta(r) {
  const raw = r?.sugerencias;
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((s) => (typeof s === "string" ? s : s?.name))
      .filter(Boolean)
      .slice(0, 4);
  }
  if (r?.canal?.name) return chipsRelacionados(r.canal);
  return sugerenciasIniciales();
}

/**
 * Cerebro local (fallback si no hay OPENAI_API_KEY de Commit Academy).
 */
export function interpretarPedido(texto) {
  const raw = String(texto || "").trim();
  if (!raw) {
    return {
      ok: false,
      mensaje:
        "Soy Mandy. Contame qué te pinta: charla, música, cine, docs…",
      sugerencias: sugerenciasIniciales(),
    };
  }

  for (const intent of INTENCIONES) {
    if (intent.re.test(raw)) {
      return {
        ok: true,
        mensaje: intent.mensaje,
        accion: intent.accion,
        sugerencias: sugerenciasIniciales(),
      };
    }
  }

  const hits = buscarCatalogo(raw, { limite: 4 });
  if (hits.length && hits[0].score >= 2) {
    const top = hits[0];
    const otros = hits.slice(1).map((h) => h.name);
    return {
      ok: true,
      mensaje: `Pongo ${top.name} (CH ${top.channel}). ${top.tagline} ¿Algo más?`,
      accion: `CH_SET:${top.channel}`,
      canal: top,
      sugerencias: [...otros, ...chipsRelacionados(top)].filter(
        (v, i, a) => a.indexOf(v) === i && v !== top.name,
      ).slice(0, 4),
    };
  }

  const muestra = CHANNELS.filter((c) => c.hablada).slice(0, 3);
  return {
    ok: false,
    mensaje: `No encontré eso. ¿Probamos con ${muestra.map((c) => c.name).join(", ")}…?`,
    sugerencias: [
      ...chipsDeCanales(muestra, { limite: 3 }),
      "radio jazz",
      "cine",
    ].slice(0, 4),
  };
}

/** Texto compacto del catálogo para el system prompt del LLM. */
export function catalogoParaPrompt() {
  return CHANNELS.map((c, i) => {
    const n = canalNumero(i);
    const flags = [
      c.hablada ? "hablada" : null,
      c.live ? "en_vivo" : null,
      c.genero,
    ]
      .filter(Boolean)
      .join(",");
    return `CH ${n}: ${c.name} — ${c.tagline} [${flags}]`;
  }).join("\n");
}
