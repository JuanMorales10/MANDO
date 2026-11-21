import { hostPublico, json, leerSala, paquete } from "./_lib/sala.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Método no permitido" });
  const sala = await leerSala();
  const base = hostPublico(req);
  return json(res, 200, {
    codigo: sala.codigo,
    urls: [`${base}/celular?c=${sala.codigo}`],
    ...paquete(sala),
  });
}
