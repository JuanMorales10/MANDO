// Arranque del modo celular con puntero: node server/con-puntero.mjs
// Es el mismo servidor de server.mjs (misma sala, mismos conectores) más:
//   - una puerta HTTPS para los teléfonos, con QR para entrar;
//   - el puntero: mover el teléfono mueve el cursor de la notebook.

import { crearServidor, direccionesLan } from "./server.mjs";
import { crearConectorComputadora } from "./conectores/computadora.mjs";
import { crearConectorPjlink } from "./conectores/pjlink.mjs";
import { sumarPuntero } from "./puntero/puntero.mjs";

const puerto = Number(process.env.PORT) || 8080;
const puertoHttps = Number(process.env.PUERTO_HTTPS) || 8443;
const puertoPantalla = Number(process.env.PUERTO_PANTALLA) || 8090;
const log = (m) => console.log(`[mando] ${m}`);

const conectores = [];
if (process.env.COMPUTADORA !== "no") {
  conectores.push(crearConectorComputadora({ inicio: `http://localhost:${puertoPantalla}/proyector.html` }));
}
if (process.env.PJLINK_HOST) {
  conectores.push(
    crearConectorPjlink({
      host: process.env.PJLINK_HOST,
      port: Number(process.env.PJLINK_PORT) || 4352,
      password: process.env.PJLINK_PASS || "",
    }),
  );
}

const app = crearServidor({
  codigo: process.env.SALA,
  conectores,
  pasoVolumen: Number(process.env.PASO_VOLUMEN) || 5,
  log,
});
for (const c of conectores) await c.iniciar?.(app);

const puntero = await sumarPuntero(app, { puertoHttps, puertoPantalla, log });
// El mando del celular (entrada normal, sin aviso de certificado) ofrece el puntero con un botón.
if (puntero.disponible) app.extras.punteroPuerto = puertoHttps;

app.server.listen(puerto, "0.0.0.0", () => {
  console.log("\nMANDO · Tu control, a tu manera");
  console.log(`Proyector (con QR): ${puntero.urlProyector}`);
  console.log(`Celular:            ${puntero.urlCelular() || "sin red: conectá la notebook al wifi"}`);
  for (const ip of direccionesLan()) console.log(`Celular sin puntero: http://${ip}:${puerto}/celular.html`);
  console.log(`Código:             ${app.sala.codigo}`);
  console.log(`Conectores:         ${conectores.map((c) => c.nombre).join(", ") || "ninguno (solo TV simulada)"}`);
  console.log(`Puntero:            ${puntero.disponible ? "disponible" : "no disponible en este sistema"}`);
  console.log("El teléfono avisa que el certificado no es de confianza: Avanzado → Continuar.\n");
});

const cortar = () => {
  puntero.cerrar();
  app.server.close();
  process.exit(0);
};
process.on("SIGINT", cortar);
process.on("SIGTERM", cortar);
