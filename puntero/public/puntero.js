// Página del teléfono: lee el giroscopio y manda movimientos a la Mac.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const TOKEN = new URLSearchParams(location.hash.slice(1)).get('t') || '';
  const ID = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
  const ES_IOS = typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';

  // Ajustes de sensación
  const ZONA_MUERTA = 1.2;  // grados/seg: por debajo de esto se ignora (temblor de la mano)
  const SUAVIZADO = 0.45;   // 0 = sin suavizar, 1 = congelado

  const cfg = {
    get ganancia() { return +$('ganancia').value; }, // píxeles por grado
    get mantener() { return $('mantener').checked; },
    get invX() { return $('invX').checked ? -1 : 1; },
    get invY() { return $('invY').checked ? -1 : 1; },
  };

  // ---------- transporte: WebSocket, y si no abre, POST ----------
  let ws = null, modo = null, activo = false, cola = [], enviando = false;
  function estado(texto, clase = '') { const e = $('estado'); e.textContent = texto; e.className = 'estado ' + clase; }
  function aviso(texto) { const a = $('aviso'); a.textContent = texto; a.hidden = !texto; }

  function conectar() {
    return new Promise((ok) => {
      let listo = false;
      const fin = (m) => { if (!listo) { listo = true; modo = m; ok(m); } };
      try {
        ws = new WebSocket(`${location.protocol === 'http:' ? 'ws' : 'wss'}://${location.host}/ws?t=${TOKEN}&id=${ID}`);
        ws.onopen = () => fin('ws');
        ws.onmessage = (ev) => {
          try { const m = JSON.parse(ev.data); if (m.t === 'hola' && !m.clics) aviso('La Mac todavía no dio permiso de Accesibilidad: mueve, pero no hace clic.'); } catch {}
        };
        ws.onclose = () => { if (modo === 'ws' && activo) cortar('Se cortó la conexión'); else fin('post'); };
        ws.onerror = () => fin('post');
      } catch { fin('post'); }
      setTimeout(() => fin('post'), 2500);
    });
  }
  async function post(ruta, cuerpo) {
    const r = await fetch(ruta, { method: 'POST', headers: { 'x-token': TOKEN, 'x-id': ID }, body: cuerpo, keepalive: true });
    if (r.status === 401) throw new Error('Código inválido: volvé a escanear el QR');
    if (r.status === 409) throw new Error('Ya hay otro teléfono conectado');
    if (!r.ok) throw new Error('La Mac no respondió');
  }
  function mandar(msg) {
    if (!activo) return;
    if (modo === 'ws') { if (ws.readyState === 1 && ws.bufferedAmount < 4096) ws.send(JSON.stringify(msg)); return; }
    // POST: juntar movimientos para no saturar
    const ult = cola[cola.length - 1];
    if (msg.t === 'm' && ult && ult.t === 'm') { ult.dx += msg.dx; ult.dy += msg.dy; } else cola.push(msg);
    vaciar();
  }
  async function vaciar() {
    if (enviando || !cola.length) return;
    enviando = true;
    const lote = cola.splice(0, 32);
    for (const m of lote) if (m.t === 'm') { m.dx = Math.max(-400, Math.min(400, m.dx)); m.dy = Math.max(-400, Math.min(400, m.dy)); }
    try { await post('/m', JSON.stringify(lote)); } catch (e) { cortar(e.message); }
    enviando = false;
    if (cola.length) vaciar();
  }

  // ---------- giroscopio ----------
  let accX = 0, accY = 0, vx = 0, vy = 0, tPrev = 0, huboSensor = false, dedo = false;
  function alMover(ev) {
    const r = ev.rotationRate;
    if (!r || r.alpha == null) return;
    huboSensor = true;
    const ahora = performance.now();
    const dt = Math.min(0.05, tPrev ? (ahora - tPrev) / 1000 : 0.016);
    tPrev = ahora;
    // Ejes del teléfono: alpha = giro sobre X (cabecear), beta = sobre Y, gamma = sobre Z.
    const wx = r.alpha || 0, wy = r.beta || 0, wz = r.gamma || 0;
    // Giro a izquierda/derecha = giro alrededor de la vertical real, sin importar cómo se agarre.
    let yaw = wz;
    const g = ev.accelerationIncludingGravity;
    if (g && g.x != null) {
      const s = ES_IOS ? -1 : 1; // iOS informa la gravedad con el signo al revés
      const n = Math.hypot(g.x, g.y, g.z) || 1;
      yaw = s * (wx * g.x + wy * g.y + wz * g.z) / n;
    }
    let pitch = wx;
    if (Math.abs(yaw) < ZONA_MUERTA) yaw = 0;
    if (Math.abs(pitch) < ZONA_MUERTA) pitch = 0;
    vx = vx * SUAVIZADO + yaw * (1 - SUAVIZADO);
    vy = vy * SUAVIZADO + pitch * (1 - SUAVIZADO);
    if (cfg.mantener && !dedo) { vx = vy = 0; return; }
    accX += -vx * dt * cfg.ganancia * cfg.invX;
    accY += -vy * dt * cfg.ganancia * cfg.invY;
  }
  let ultimoVivo = 0;
  function cuadro(t) {
    if (!activo) return;
    const dx = Math.max(-400, Math.min(400, accX)), dy = Math.max(-400, Math.min(400, accY));
    if (Math.abs(dx) >= 0.5 || Math.abs(dy) >= 0.5) {
      mandar({ t: 'm', dx: Math.round(dx * 10) / 10, dy: Math.round(dy * 10) / 10 });
      accX = accY = 0; ultimoVivo = t;
    } else if (t - ultimoVivo > 2000) { mandar({ t: 'k' }); ultimoVivo = t; }
    requestAnimationFrame(cuadro);
  }

  // ---------- zona táctil: toque = clic, arrastrar = mover ----------
  const pad = $('pad');
  let tx = 0, ty = 0, t0 = 0, recorrido = 0;
  pad.addEventListener('pointerdown', (e) => {
    pad.setPointerCapture(e.pointerId);
    dedo = true; tx = e.clientX; ty = e.clientY; t0 = performance.now(); recorrido = 0;
    pad.classList.add('apretado');
  });
  pad.addEventListener('pointermove', (e) => {
    if (!dedo) return;
    const dx = e.clientX - tx, dy = e.clientY - ty;
    tx = e.clientX; ty = e.clientY; recorrido += Math.abs(dx) + Math.abs(dy);
    if (recorrido > 10) { accX += dx * 1.6; accY += dy * 1.6; }
  });
  const soltar = (e) => {
    if (!dedo) return;
    dedo = false; pad.classList.remove('apretado');
    if (e.type === 'pointerup' && recorrido <= 10 && performance.now() - t0 < 350) {
      mandar({ t: 'c' });
      if (navigator.vibrate) navigator.vibrate(15);
    }
  };
  pad.addEventListener('pointerup', soltar);
  pad.addEventListener('pointercancel', soltar);
  $('derecho').onclick = () => mandar({ t: 'r' });
  $('centrar').onclick = () => { accX = accY = 0; mandar({ t: 'z' }); };
  $('mantener').onchange = () => {
    $('padTexto').innerHTML = cfg.mantener
      ? 'Mantené apoyado para mover<br><small>Toque corto = clic</small>'
      : 'Tocá acá = clic<br><small>Arrastrar el dedo también mueve</small>';
  };

  // Recordar los ajustes en este teléfono
  for (const id of ['mantener', 'invX', 'invY', 'ganancia']) {
    const el = $(id), esCheck = el.type === 'checkbox';
    try { const v = localStorage.getItem('puntero.' + id); if (v != null) { if (esCheck) el.checked = v === '1'; else el.value = v; } } catch {}
    el.addEventListener('change', () => { try { localStorage.setItem('puntero.' + id, esCheck ? (el.checked ? '1' : '0') : el.value); } catch {} });
  }
  $('mantener').dispatchEvent(new Event('change'));

  // ---------- activar / cortar ----------
  let candado = null;
  async function activar() {
    aviso('');
    if (!TOKEN) return aviso('Falta el código. Escaneá el QR que muestra la Mac.');
    // En iPhone el permiso tiene que pedirse dentro del toque.
    let permiso = 'granted';
    if (ES_IOS) { try { permiso = await DeviceMotionEvent.requestPermission(); } catch { permiso = 'denied'; } }
    estado('Conectando…');
    await conectar();
    activo = true;
    try { if (modo === 'post') await post('/m', '[{"t":"k"}]'); } catch (e) { activo = false; estado('Sin conectar', 'mal'); return aviso(e.message); }
    $('inicio').hidden = true; $('control').hidden = false;
    estado(modo === 'ws' ? 'Conectado' : 'Conectado (modo lento)', 'ok');
    window.addEventListener('devicemotion', alMover);
    requestAnimationFrame(cuadro);
    try { candado = await navigator.wakeLock?.request('screen'); } catch {}
    if (permiso !== 'granted') aviso('No diste permiso de movimiento. Igual podés mover arrastrando el dedo.');
    setTimeout(() => {
      if (activo && !huboSensor && permiso === 'granted')
        $('padTexto').innerHTML = 'Este teléfono no informa movimiento<br><small>Arrastrá el dedo para mover · toque = clic</small>';
    }, 1500);
  }
  function cortar(motivo = '') {
    if (!activo && !ws) return;
    const era = modo;
    activo = false; cola = [];
    window.removeEventListener('devicemotion', alMover);
    if (era === 'post') fetch('/bye', { method: 'POST', headers: { 'x-token': TOKEN, 'x-id': ID }, keepalive: true }).catch(() => {});
    modo = null;
    try { ws && ws.close(); } catch {}
    ws = null;
    try { candado && candado.release(); } catch {}
    $('control').hidden = true; $('inicio').hidden = false;
    estado('Desconectado', motivo ? 'mal' : '');
    aviso(motivo);
  }
  $('activar').onclick = activar;
  $('cortar').onclick = () => cortar();
  document.addEventListener('visibilitychange', () => { if (document.hidden) { accX = accY = 0; } });
})();
