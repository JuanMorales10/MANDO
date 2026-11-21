import { ejecutarAccion, json, leerJson, leerSala } from "./_lib/sala.mjs";

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
    const state = await ejecutarAccion(
      sala,
      datos.accion,
      "celular",
      Number(process.env.PASO_VOLUMEN) || 1,
    );
    return json(res, 200, { state });
  } catch (error) {
    return json(res, error.status || 400, { error: error.message || "Error" });
  }
}
