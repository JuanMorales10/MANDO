import { json, leerSala, paquete } from "./_lib/sala.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Método no permitido" });
  return json(res, 200, paquete(await leerSala()));
}
