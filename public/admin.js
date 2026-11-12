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
  document.getElementById('contador').textContent =
    `Tus piezas en la web hoy: ${visibles} visibles.`;

  document.getElementById('lista').innerHTML = productosCache.map(p => `
    <div class="fila-admin ${p.estado === 'pausado' ? 'pausado' : ''}">
      <img src="${p.foto ? '/uploads/' + p.foto : 'https://placehold.co/90'}" alt="">
      <div class="datos">
        <h3>${p.titulo}</h3>
        <div class="precio">$${p.precio}</div>
        ${p.estado === 'pausado' ? '<small>⏸ Pausada</small>' : ''}
      </div>
      <div class="acciones">
        <button onclick="abrirModalEditar(${p.id})">✏️ Editar</button>
        <button onclick="abrirModalFoto(${p.id})">📷 Cambiar foto</button>
        <button class="${p.estado === 'pausado' ? 'reactivar' : 'pausar'}"
          onclick="toggleEstado(${p.id}, '${p.estado}')">
          ${p.estado === 'pausado' ? '▶ Reactivar' : '⏸ Pausar'}
        </button>
      </div>
    </div>
  `).join('');
}

function cerrarModales() {
  document.querySelectorAll('.modal-fondo').forEach(m => m.classList.remove('activo'));
}

// --- Agregar ---
function abrirModalAgregar() {
  document.getElementById('input-foto').value = '';
  document.getElementById('input-titulo').value = '';
  document.getElementById('input-precio').value = '';
  document.getElementById('input-frase').value = '';
  document.getElementById('modal-agregar').classList.add('activo');
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
  document.getElementById('input-editar-frase').value = productoActual.frase || '';

  document.getElementById('modal-editar').classList.add('activo');
}

async function guardarEdicion() {
  const nuevoNombre = document.getElementById('input-editar-nombre').value.trim();
  const nuevoPrecio = document.getElementById('input-editar-precio').value.trim();
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

cargarProductos();