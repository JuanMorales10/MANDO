// Agregado para el mando del celular: un botón que abre el puntero.
// Lo inserta el servidor con puntero; celular.html y celular.js no se modifican.

async function ponerBoton() {
  try {
    const res = await fetch("/puntero/estado");
    if (!res.ok) return;
    const estado = await res.json();
    if (!estado.puntero || !estado.seguro) return;
  } catch {
    return;
  }
  const boton = document.createElement("a");
  boton.href = "/puntero/index.html";
  boton.textContent = "🎯 Puntero";
  boton.setAttribute("aria-label", "Abrir el puntero: mover el teléfono mueve el cursor");
  boton.style.cssText = [
    "position:fixed", "z-index:50", "right:12px",
    "bottom:calc(12px + env(safe-area-inset-bottom))",
    "padding:12px 16px", "border-radius:999px",
    "background:#FF6A3D", "color:#1C0B04",
    "font:800 16px system-ui,-apple-system,sans-serif",
    "text-decoration:none", "box-shadow:0 6px 20px rgba(0,0,0,.45)",
  ].join(";");
  document.body.append(boton);
}

ponerBoton();
