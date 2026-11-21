// Agregado para la pantalla del proyector: muestra un QR para entrar desde el teléfono.
// Lo inserta el servidor con puntero; proyector.html y proyector.js no se modifican.

async function ponerQr() {
  let info;
  try {
    const res = await fetch("/puntero/info");
    if (!res.ok) return;
    info = await res.json();
  } catch {
    return;
  }
  if (!info.url) return;
  const unirse = document.getElementById("unirse");
  const url = document.getElementById("url");
  if (!unirse || !url) return;

  const caja = document.createElement("div");
  caja.style.cssText =
    "width:min(100%,260px);aspect-ratio:1;margin:0.6rem 0;padding:10px;background:#fff;border-radius:16px;";
  const img = new Image();
  img.alt = "Código QR para abrir el mando en el teléfono";
  img.style.cssText = "display:block;width:100%;height:100%;";
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(info.qr)}`;
  caja.append(img);

  const pista = document.createElement("p");
  pista.textContent = "Escaneá con la cámara del teléfono";
  pista.style.cssText = "margin:0 0 0.4rem;font-weight:700;";

  unirse.insertBefore(pista, url);
  unirse.insertBefore(caja, url);

  // La dirección escrita pasa a ser la segura, que es la que habilita el puntero.
  const corta = info.url.replace(/^https:\/\//, "").replace(/\?.*$/, "");
  const fijar = () => {
    if (url.textContent !== corta) url.textContent = corta;
  };
  fijar();
  new MutationObserver(fijar).observe(url, { childList: true, characterData: true, subtree: true });
}

ponerQr();
