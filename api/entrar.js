import { json, leerJson, leerSala, paquete } from "./_lib/sala.mjs";

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
    const sala = await leerSala();
    if (String(datos?.codigo) !== sala.codigo) {
      return json(res, 403, { error: "Código incorrecto" });
    }
    return json(res, 200, paquete(sala));
  } catch {
    return json(res, 400, { error: "JSON inválido" });
  }
}
