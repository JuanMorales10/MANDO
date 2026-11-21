import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, Output } from "ai";
import { z } from "zod";
import { catalogoParaPrompt, interpretarPedido } from "../../public/catalogo.js";

/** Model alias del proxy Commit Academy (mismo patrón que Cortes Mendoza). */
export const DEFAULT_MODEL = "fast";
export const DEFAULT_BASE_URL = "https://ai.commitacademy.io/v1";

export const PedidoSchema = z.object({
  ok: z.boolean().describe("true si entendiste un pedido accionable"),
  mensaje: z
    .string()
    .describe(
      "Respuesta conversacional corta en español rioplatense (1–2 frases). Podés preguntar o sugerir.",
    ),
  accion: z
    .string()
    .nullable()
    .describe(
      "MUTE | VOL_UP | VOL_DOWN | POWER | CH_UP | CH_DOWN | CH_SET:N (N = número de canal de la guía) o null si solo charlás/sugerís",
    ),
  canal: z.number().int().positive().nullable().describe("Número de canal si aplica"),
  sugerencias: z
    .array(z.string())
    .max(4)
    .describe(
      "Hasta 4 chips de follow-up (nombres de canal o frases cortas tipo «radio jazz», «otra charla»)",
    ),
});

export function llmConfigFromEnv(env = process.env) {
  if (!env.OPENAI_API_KEY) return null;
  const baseUrl = env.OPENAI_BASE_URL || DEFAULT_BASE_URL;
  const { protocol, hostname } = new URL(baseUrl);
  if (protocol !== "https:" && hostname !== "localhost" && hostname !== "127.0.0.1") {
    throw new Error("OPENAI_BASE_URL must use https");
  }
  return {
    apiKey: env.OPENAI_API_KEY,
    baseUrl,
    model: env.MANDO_MODEL || env.URBAN_MODEL || DEFAULT_MODEL,
  };
}

function systemPrompt() {
  return `Sos Mandy, chatbot amigable de MANDO (TV simulada tipo cable).
Hablás en español rioplatense, breve y clara. El usuario chatea con vos: a veces pide un canal, a veces pregunta qué ver.
Podés charlar un toque y SIEMPRE devolver sugerencias útiles (chips).
Si el pedido es claro, mandás la acción. Si es vago («algo tranqui», «no sé»), sugerí 2–3 opciones sin inventar canales.
Respondés SOLO con el schema.
Catálogo (números de canal CH N):
${catalogoParaPrompt()}

Reglas:
- Charla / podcast / TED / entrevista → [hablada].
- Música / lofi / jazz / rock → radio-musica.
- Deportes / fútbol → deportes. Cine / película → cine. Docs / naturaleza → docs.
- Canal concreto → accion "CH_SET:N". Silencio → MUTE. Volumen → VOL_UP / VOL_DOWN. Zapping → CH_UP / CH_DOWN.
- Si solo estás sugiriendo (sin decisión), ok=true o false según contexto, accion=null, y llená sugerencias.
- NUNCA inventes un canal que no esté en la lista.
- mensaje: conversacional (ej. «Listo, pongo Radio Jazz. ¿Seguimos con algo hablado?»); sin markdown.
- sugerencias: frases cortas clickeables (nombres del catálogo o «silencio», «siguiente canal»).`;
}

function historialAPrompt(historial) {
  if (!Array.isArray(historial) || !historial.length) return "";
  const lineas = historial
    .slice(-8)
    .map((m) => {
      const rol = m?.role === "assistant" ? "Mandy" : "Usuario";
      return `${rol}: ${String(m?.content || "").slice(0, 300)}`;
    })
    .filter((l) => l.length > 8);
  if (!lineas.length) return "";
  return `\nConversación reciente:\n${lineas.join("\n")}\n`;
}

export async function interpretarConIA(texto, config, historial = []) {
  const provider = createOpenAICompatible({
    name: "commit-academy",
    baseURL: config.baseUrl || DEFAULT_BASE_URL,
    apiKey: config.apiKey,
    supportsStructuredOutputs: true,
  });
  const model = provider(config.model || DEFAULT_MODEL);
  const { output } = await generateText({
    model,
    output: Output.object({ schema: PedidoSchema }),
    system: systemPrompt(),
    prompt: `${historialAPrompt(historial)}Pedido actual del usuario:\n${String(texto).slice(0, 500)}`,
    temperature: 0.3,
    abortSignal: AbortSignal.timeout(25_000),
  });

  let accion = output.accion || null;
  if (!accion && output.canal) accion = `CH_SET:${output.canal}`;

  return {
    ok: Boolean(output.ok && (accion || output.mensaje)),
    mensaje: output.mensaje,
    accion: accion || undefined,
    sugerencias: Array.isArray(output.sugerencias)
      ? output.sugerencias.filter(Boolean).slice(0, 4)
      : [],
    fuente: "commit-academy",
  };
}

/** IA si hay key; si no, cerebro local del catálogo. */
export async function resolverPedido(texto, historial = []) {
  const local = interpretarPedido(texto);
  const config = llmConfigFromEnv();
  if (!config) {
    return { ...local, fuente: "local" };
  }
  try {
    const ia = await interpretarConIA(texto, config, historial);
    if (ia.ok || ia.mensaje) {
      if (!ia.sugerencias?.length && local.sugerencias?.length) {
        ia.sugerencias = local.sugerencias;
      }
      return ia;
    }
  } catch {
    // proxy caído → local
  }
  return { ...local, fuente: "local-fallback" };
}
