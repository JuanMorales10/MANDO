// Agregado para la pantalla del proyector cuando corre el servidor con puntero.
// No agrega otro QR: el de la página es el único (entra sin aviso de certificado).
// Solo avisa que, desde el mando, el celular también puede mover el cursor.

async function avisarPuntero() {
  try {
    const res = await fetch("/puntero/info");
    if (!res.ok) return;
    const info = await res.json();
    if (!info.puntero) return;
  } catch {
    return;
  }
  const unirse = document.getElementById("unirse");
  if (!unirse) return;
  const nota = document.createElement("p");
  nota.className = "pro__puntero";
  nota.textContent = "También: tocá «Puntero» en el mando y mové el celular para mover el cursor.";
  unirse.append(nota);
}

avisarPuntero();
