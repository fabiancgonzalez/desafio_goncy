let productoActual = null;
let productosCache = [];

function getLlave() {
  return localStorage.getItem('llave_tia') || '';
}

// Helper para fetch con la llave incluida
async function apiFetch(url, opciones = {}) {
  const llave = getLlave();
  const headers = opciones.headers || {};
  headers['x-llave'] = llave;

  const res = await fetch(url, { ...opciones, headers });

  if (res.status === 401) {
    // Token inválido o vencido: mostrar pantalla de acceso denegado
    document.getElementById('panel').style.display = 'none';
    document.getElementById('acceso-denegado').style.display = 'block';
    throw new Error('No autorizado');
  }

  return res;
}

async function cargarProductos() {
  const llave = getLlave();

// Sin llave: no hay panel
  if (!llave) {
    document.getElementById('panel').style.display = 'none';
    document.getElementById('acceso-denegado').style.display = 'block';
    return;
  }

  // Validar la llave contra el server
  try {
    const check = await fetch(`/api/auth/validar?llave=${encodeURIComponent(llave)}`);
    if (!check.ok) {
      localStorage.removeItem('llave_tia');
      document.getElementById('panel').style.display = 'none';
      document.getElementById('acceso-denegado').style.display = 'block';
      return;
    }
  } catch (e) {
    // Si falla la red, mostramos igual el panel (por si está offline momentáneamente)
  }

  // Llave válida: mostrar el panel y cargar productos
  document.getElementById('panel').style.display = 'block';
  document.getElementById('acceso-denegado').style.display = 'none';

  const res = await apiFetch('/api/admin/productos');
  productosCache = await res.json();

  // const res = await apiFetch('/api/admin/productos', {
  //   headers: {
  //     'x-llave': llave
  //   }
  // });
  // productosCache = await res.json();

  const visibles = productosCache.filter(p => p.estado === 'visible').length;
  const vendidas = productosCache.filter(p => p.estado === 'vendido').length;
  document.getElementById('contador').textContent =
    `Tus piezas en la web hoy: ${visibles} visibles · ${vendidas} vendidas.`;

  document.getElementById('lista').innerHTML = productosCache.map(p => `
    <div class="fila-admin ${p.estado !== 'visible' ? 'pausado' : ''}">
      <img src="${p.foto ? '/uploads/' + p.foto : 'https://placehold.co/90'}" alt="">
      <div class="datos">
        <h3>${p.titulo}</h3>
        <div class="precio">$${p.precio}</div>
        ${p.estado !== 'vendido' ? `<small>📦 ${(p.stock ?? 1) === 1 ? 'Queda 1' : `Quedan ${p.stock}`}</small>` : ''}
        ${p.estado === 'pausado' ? '<small>⏸ Pausada</small>' : ''}
        ${p.estado === 'vendido' ? '<small>💰 Vendida' + (p.vendido_en ? ` el ${new Date(p.vendido_en + 'Z').toLocaleDateString('es-AR')}` : '') + '</small>' : ''}
      </div>
      <div class="acciones">
        <button onclick="abrirModalEditar(${p.id})">✏️ Editar</button>
        <button onclick="abrirModalFoto(${p.id})">📷 Cambiar foto</button>
        ${p.estado !== 'vendido' ? `
          <button class="${p.estado === 'pausado' ? 'reactivar' : 'pausar'}"
            onclick="toggleEstado(${p.id}, '${p.estado}')">
            ${p.estado === 'pausado' ? '▶ Reactivar' : '⏸ Pausar'}
          </button>
          <button class="vendida" onclick="marcarVendida(${p.id})">💰 Vendida</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// --- Marcar como vendida ---
async function marcarVendida(id) {
  const producto = productosCache.find(p => p.id === id);
  if (!producto) return;

  if (!confirm(`¿Marcar "${producto.titulo}" como vendida? Sale de la web y queda registrada para tus reportes.`)) {
    return;
  }

  const entrada = prompt(`¿A cuánto la vendiste? (vacío = precio publicado: $${producto.precio})`);
  if (entrada === null) return; // canceló
  const precioFinal = entrada.trim() || null;

  await apiFetch(`/api/productos/${id}/vendido`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ precioFinal })
  });
  cargarProductos();
}

function cerrarModales() {
  document.querySelectorAll('.modal-fondo').forEach(m => m.classList.remove('activo'));
}

// --- Agregar ---
function abrirModalAgregar() {
  document.getElementById('input-foto').value = '';
  document.getElementById('input-titulo').value = '';
  document.getElementById('input-precio').value = '';
  document.getElementById('input-stock').value = '';
  document.getElementById('input-frase').value = '';
  document.getElementById('boton-analizar').style.display = 'none';
  document.getElementById('ia-estado').textContent = '';
  document.getElementById('nombre-foto').textContent = '';
  document.getElementById('modal-agregar').classList.add('activo');
}

// --- Análisis de foto con IA ---
document.getElementById('input-foto').addEventListener('change', (e) => {
  const archivo = e.target.files[0];
  document.getElementById('boton-analizar').style.display = archivo ? 'block' : 'none';
  document.getElementById('ia-estado').textContent = '';
  document.getElementById('nombre-foto').textContent = archivo ? `📎 ${archivo.name}` : '';
});

document.getElementById('input-nueva-foto').addEventListener('change', (e) => {
  const archivo = e.target.files[0];
  document.getElementById('nombre-nueva-foto').textContent = archivo ? `📎 ${archivo.name}` : '';
});

async function analizarFoto() {
  const foto = document.getElementById('input-foto').files[0];
  if (!foto) return;

  const boton = document.getElementById('boton-analizar');
  const estado = document.getElementById('ia-estado');
  boton.disabled = true;
  estado.textContent = '🔎 La IA está mirando tu foto…';

  try {
    const fd = new FormData();
    fd.append('foto', foto);
    const res = await apiFetch('/api/asistente/foto', { method: 'POST', body: fd });
    const datos = await res.json();
    if (!res.ok) throw new Error(datos.error || 'Error del asistente');

    document.getElementById('input-titulo').value = datos.titulo || '';
    document.getElementById('input-precio').value = datos.precio ?? '';
    document.getElementById('input-frase').value = datos.frase || '';
    estado.textContent = `✨ Vi "${datos.objeto}" y te dejé todo sugerido. Podés cambiarlo antes de guardar.`;
    hablar(`Vi ${datos.objeto}. Te sugerí llamarla ${datos.titulo} a ${datos.precio} pesos.`);
  } catch (err) {
    estado.textContent = `😕 ${err.message}`;
  } finally {
    boton.disabled = false;
  }
}

async function guardarNueva() {
  const foto = document.getElementById('input-foto').files[0];
  const titulo = document.getElementById('input-titulo').value.trim();
  const precio = document.getElementById('input-precio').value.trim();
  const frase = document.getElementById('input-frase').value.trim();

  if (!titulo || !precio) {
    alert('Falta el nombre o el precio 🙂');
    return;
  }

  const fd = new FormData();
  fd.append('titulo', titulo);
  fd.append('precio', precio);
  fd.append('frase', frase);
  fd.append('stock', document.getElementById('input-stock').value.trim() || '1');
  if (foto) fd.append('foto', foto);

  await apiFetch('/api/productos', { method: 'POST', body: fd });
  cerrarModales();
  cargarProductos();
}

// --- Editar (nombre + precio + frase) ---
function abrirModalEditar(id) {
  productoActual = productosCache.find(p => p.id === id);
  if (!productoActual) {
    alert('No encontré esa pieza. Recargá la página.');
    return;
  }

  document.getElementById('editar-titulo').textContent = `Editar "${productoActual.titulo}"`;
  document.getElementById('input-editar-nombre').value = productoActual.titulo;
  document.getElementById('input-editar-precio').value = productoActual.precio;
  document.getElementById('input-editar-stock').value = productoActual.stock ?? 1;
  document.getElementById('input-editar-frase').value = productoActual.frase || '';

  document.getElementById('modal-editar').classList.add('activo');
}

async function guardarEdicion() {
  const nuevoNombre = document.getElementById('input-editar-nombre').value.trim();
  const nuevoPrecio = document.getElementById('input-editar-precio').value.trim();
  const nuevoStock = parseInt(document.getElementById('input-editar-stock').value.trim()) || 0;
  const nuevaFrase = document.getElementById('input-editar-frase').value.trim();

  if (!nuevoNombre || !nuevoPrecio) {
    alert('El nombre y el precio no pueden quedar vacíos 🙂');
    return;
  }

  await apiFetch(`/api/productos/${productoActual.id}/editar`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      titulo: nuevoNombre,
      precio: nuevoPrecio,
      stock: nuevoStock,
      frase: nuevaFrase
    })
  });

  cerrarModales();
  cargarProductos();
}

// --- Foto ---
function abrirModalFoto(id) {
  productoActual = productosCache.find(p => p.id === id);
  document.getElementById('foto-titulo').textContent = `Foto de "${productoActual.titulo}"`;
  document.getElementById('input-nueva-foto').value = '';
  document.getElementById('nombre-nueva-foto').textContent = '';
  document.getElementById('modal-foto').classList.add('activo');
}

async function guardarFoto() {
  const foto = document.getElementById('input-nueva-foto').files[0];
  if (!foto) {
    alert('Elegí o sacá una foto primero 🙂');
    return;
  }
  const fd = new FormData();
  fd.append('foto', foto);
  await apiFetch(`/api/productos/${productoActual.id}/foto`, { method: 'PUT', body: fd });
  cerrarModales();
  cargarProductos();
}

// --- Pausar / Reactivar ---
async function toggleEstado(id, estadoActual) {
  const nuevo = estadoActual === 'pausado' ? 'visible' : 'pausado';
  await apiFetch(`/api/productos/${id}/estado`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado: nuevo })
  });
  cargarProductos();
}

// ============ ASISTENTE DE VOZ ============
const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
let reconocimiento = null;
let escuchando = false;

function toggleAsistente() {
  document.getElementById('asistente-panel').classList.toggle('activo');
}

// Respuesta hablada (texto → voz del navegador)
function hablar(texto) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const mensaje = new SpeechSynthesisUtterance(texto);
  mensaje.lang = 'es-AR';
  mensaje.rate = 1.05;
  speechSynthesis.speak(mensaje);
}

function agregarAlLog(quien, texto) {
  const log = document.getElementById('asistente-log');
  const burbuja = document.createElement('div');
  burbuja.className = `mensaje ${quien}`;
  burbuja.textContent = texto;
  log.appendChild(burbuja);
  log.scrollTop = log.scrollHeight;
}

async function enviarComando(texto) {
  const limpio = (texto || '').trim();
  if (!limpio) return;

  agregarAlLog('usuario', limpio);
  const pensando = document.createElement('div');
  pensando.className = 'mensaje asistente pensando';
  pensando.textContent = 'Pensando…';
  const log = document.getElementById('asistente-log');
  log.appendChild(pensando);
  log.scrollTop = log.scrollHeight;

  try {
    const res = await apiFetch('/api/asistente/comando', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: limpio })
    });
    const datos = await res.json();
    if (!res.ok) throw new Error(datos.error || 'Error del asistente');
    pensando.textContent = datos.texto;
    pensando.classList.remove('pensando');
    hablar(datos.texto);
    cargarProductos(); // refrescar por si el asistente modificó piezas
  } catch (err) {
    pensando.textContent = `😕 ${err.message}`;
    pensando.classList.remove('pensando');
  }
}

function enviarTexto() {
  const input = document.getElementById('asistente-texto');
  enviarComando(input.value);
  input.value = '';
}

function toggleMicrofono() {
  if (!Reconocimiento) {
    agregarAlLog('asistente', 'Tu navegador no soporta reconocimiento de voz. Probá con Chrome o Edge.');
    return;
  }

  if (escuchando) {
    reconocimiento.stop();
    return;
  }

  speechSynthesis.cancel(); // si estaba hablando, se calla para escuchar
  reconocimiento = new Reconocimiento();
  reconocimiento.lang = 'es-AR';
  reconocimiento.interimResults = false;

  const mic = document.getElementById('asistente-mic');
  reconocimiento.onstart = () => {
    escuchando = true;
    mic.classList.add('escuchando');
    mic.textContent = '🔴';
  };
  reconocimiento.onend = () => {
    escuchando = false;
    mic.classList.remove('escuchando');
    mic.textContent = '🎤';
  };
  reconocimiento.onerror = () => {
    escuchando = false;
    mic.classList.remove('escuchando');
    mic.textContent = '🎤';
  };
  reconocimiento.onresult = (e) => {
    const texto = e.results[0][0].transcript;
    enviarComando(texto);
  };

  reconocimiento.start();
}

// Enviar con Enter desde el input del asistente
document.getElementById('asistente-texto').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') enviarTexto();
});

cargarProductos();