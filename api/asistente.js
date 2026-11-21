import { json, leerJson, leerSala, registrarChat } from "./_lib/sala.mjs";
import { resolverPedido } from "./_lib/commit-academy.mjs";
import { chipsDesdeRespuesta } from "../public/catalogo.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "POST, OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type");
    return res.end();
  }
  if (req.method !== "POST") return json(res, 405, { error: "Método no permitido" });
  try {
    const datos = await leerJson(req);
    const texto = String(datos?.texto || datos?.q || "").trim();
    const historial = Array.isArray(datos?.historial) ? datos.historial : [];
    const origen = datos?.origen === "notebook" ? "notebook" : "celular";
    const codigo = datos?.codigo != null ? String(datos.codigo) : "";

    const r = await resolverPedido(texto, historial);
    const sugerencias = chipsDesdeRespuesta(r);

    let chat;
    if (codigo && texto) {
      const sala = await leerSala();
      if (String(sala.codigo) !== codigo) {
        return json(res, 403, { error: "Código incorrecto" });
      }
      const hora = Date.now();
      chat = await registrarChat(sala, [
        {
          role: "user",
          content: texto,
          origen,
          hora,
        },
        {
          role: "assistant",
          content: r.mensaje || "Listo.",
          origen: "mandy",
          hora: hora + 1,
          sugerencias,
        },
      ]);
    }

    return json(res, 200, { ...r, sugerencias, chat });
  } catch (error) {
    return json(res, 400, { error: error.message || "Pedido inválido" });
  }
}
