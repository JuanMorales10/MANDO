import { leerSala, paquete } from "./_lib/sala.mjs";

// SSE corto: en Vercel preferimos polling a /api/estado.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Método no permitido");
    return;
  }
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-store",
    connection: "keep-alive",
    "access-control-allow-origin": "*",
  });
  res.write(`data: ${JSON.stringify(paquete(await leerSala()))}\n\n`);
  setTimeout(() => res.end(), 1000);
}
