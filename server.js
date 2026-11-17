/*const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = 3000;

// Asegurar carpeta de uploads
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Configuración de subida de fotos (en memoria, para comprimir con sharp)
const upload = multer({ storage: multer.memoryStorage() });

// ============ API PÚBLICA ============
// Obtener todos los productos visibles (para la web pública)
app.get('/api/productos', (req, res) => {
  const productos = db.prepare(
    "SELECT * FROM productos WHERE estado = 'visible' ORDER BY creado DESC"
  ).all();
  res.json(productos);
});

// ============ API ADMIN ============
// Obtener TODOS los productos (para el panel de la tía)
app.get('/api/admin/productos', (req, res) => {
  const productos = db.prepare(
    "SELECT * FROM productos ORDER BY creado DESC"
  ).all();
  res.json(productos);
});

// Agregar producto
app.post('/api/productos', upload.single('foto'), async (req, res) => {
  try {
    const { titulo, precio, frase } = req.body;
    let fotoNombre = null;

    if (req.file) {
      // Comprimir y guardar la imagen (máx 800px de ancho, calidad 80)
      fotoNombre = `pieza-${Date.now()}.jpg`;
      await sharp(req.file.buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(path.join('uploads', fotoNombre));
    }

    const info = db.prepare(
      "INSERT INTO productos (titulo, precio, frase, foto) VALUES (?, ?, ?, ?)"
    ).run(titulo, precio, frase || '', fotoNombre);

    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo guardar la pieza' });
  }
});

// Cambiar precio
app.put('/api/productos/:id/precio', (req, res) => {
  db.prepare("UPDATE productos SET precio = ? WHERE id = ?")
    .run(req.body.precio, req.params.id);
  res.json({ ok: true });
});

// Cambiar foto
app.put('/api/productos/:id/foto', upload.single('foto'), async (req, res) => {
  try {
    const fotoNombre = `pieza-${Date.now()}.jpg`;
    await sharp(req.file.buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(path.join('uploads', fotoNombre));

    db.prepare("UPDATE productos SET foto = ? WHERE id = ?")
      .run(fotoNombre, req.params.id);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo cambiar la foto' });
  }
});

// Pausar / Reanudar producto
app.put('/api/productos/:id/estado', (req, res) => {
  db.prepare("UPDATE productos SET estado = ? WHERE id = ?")
    .run(req.body.estado, req.params.id);
  res.json({ ok: true });
});

// Eliminar producto (por si acaso)
app.delete('/api/productos/:id', (req, res) => {
  db.prepare("DELETE FROM productos WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`🫖 Taller de la tía tia de Goncy corriendo en http://localhost:${PORT}`);
});
*/

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const { initDB, queryAll, runSql } = require('./database');
const { obtenerToken, requiereAuth } = require('./auth');
const asistente = require('./asistente');
const { UPLOADS_DIR, DATA_DIR } = require('./paths');
const QRCode = require('qrcode');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOADS_DIR));

// Configuración de subida de fotos (en memoria, para comprimir con sharp)
const upload = multer({ storage: multer.memoryStorage() });



// ============ API PÚBLICA ============
// Obtener todos los productos visibles (para la web pública)
app.get('/api/productos', (req, res) => {
  const productos = queryAll(
    "SELECT * FROM productos WHERE estado = 'visible' ORDER BY creado DESC"
  );
  res.json(productos);
});

// ============ AUTENTICACIÓN ============

// Devuelve un QR con el link mágico (solo se usa una vez, desde tu compu)
app.get('/api/auth/qr', async (req, res) => {
  const token = obtenerToken();
  // Cambiá esto por tu dominio real en producción
  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
  const linkMagico = `${baseUrl}/admin.html?llave=${token}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(linkMagico, {
      width: 400,
      margin: 2,
      color: { dark: '#3d5a40', light: '#fdf8f0' }
    });
    res.json({ link: linkMagico, qr: qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo generar el QR' });
  }
});

// Valida un token (lo usa el panel al cargar)
app.get('/api/auth/validar', (req, res) => {
  const tokenValido = obtenerToken();
  const tokenRecibido = req.query.llave;
  if (tokenRecibido && tokenRecibido === tokenValido) {
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false });
});


// ============ API ADMIN ============
// Obtener TODOS los productos (para el panel de la tía)
app.get('/api/admin/productos', requiereAuth, (req, res) => {
  const productos = queryAll(
    "SELECT * FROM productos ORDER BY creado DESC"
  );
  res.json(productos);
});

// Agregar producto
app.post('/api/productos',requiereAuth, upload.single('foto'), async (req, res) => {
  try {
    const { titulo, precio, frase, stock } = req.body;
    let fotoNombre = null;

    if (req.file) {
      // Comprimir y guardar la imagen (máx 800px de ancho, calidad 80)
      fotoNombre = `pieza-${Date.now()}.jpg`;
      await sharp(req.file.buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(path.join(UPLOADS_DIR, fotoNombre));
    }

    const info = runSql(
      "INSERT INTO productos (titulo, precio, frase, foto, stock) VALUES (?, ?, ?, ?, ?)",
      [titulo, precio, frase || '', fotoNombre, Math.max(1, parseInt(stock) || 1)]
    );

    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo guardar la pieza' });
  }
});

// Editar título, precio, frase y cantidad disponible
app.put('/api/productos/:id/editar', requiereAuth, (req, res) => {
  runSql(
    "UPDATE productos SET titulo = ?, precio = ?, frase = ?, stock = ? WHERE id = ?",
    [req.body.titulo, req.body.precio, req.body.frase, Math.max(0, parseInt(req.body.stock) || 0), req.params.id]
  );
  res.json({ ok: true });
});

// Cambiar precio
app.put('/api/productos/:id/precio', requiereAuth, (req, res) => {
  runSql(
    "UPDATE productos SET precio = ? WHERE id = ?",
    [req.body.precio, req.params.id]
  );
  res.json({ ok: true });
});

// Cambiar foto
app.put('/api/productos/:id/foto', requiereAuth, upload.single('foto'), async (req, res) => {
  try {
    const fotoNombre = `pieza-${Date.now()}.jpg`;
    await sharp(req.file.buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(path.join(UPLOADS_DIR, fotoNombre));

    runSql(
      "UPDATE productos SET foto = ? WHERE id = ?",
      [fotoNombre, req.params.id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo cambiar la foto' });
  }
});

// Pausar / Reanudar producto
app.put('/api/productos/:id/estado', requiereAuth, (req, res) => {
  runSql(
    "UPDATE productos SET estado = ? WHERE id = ?",
    [req.body.estado, req.params.id]
  );
  res.json({ ok: true });
});

// Eliminar producto (por si acaso)
app.delete('/api/productos/:id', requiereAuth, (req, res) => {
  runSql("DELETE FROM productos WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

// Marcar como vendido (registra la fecha para los reportes)
app.put('/api/productos/:id/vendido', requiereAuth, (req, res) => {
  runSql(
    "UPDATE productos SET estado = 'vendido', vendido_en = CURRENT_TIMESTAMP, precio = COALESCE(?, precio) WHERE id = ?",
    [req.body.precioFinal ?? null, req.params.id]
  );
  res.json({ ok: true });
});

// ============ ASISTENTE IA (Vercel AI SDK + AI Gateway) ============
function middlewareAsistente(req, res, next) {
  if (!asistente.asistenteDisponible) {
    return res.status(503).json({ error: 'El asistente no está configurado: falta VERCEL_AI_GATEWAY_API_KEY en el servidor.' });
  }
  next();
}

// Analiza la foto de una pieza y sugiere nombre, precio y frase
app.post('/api/asistente/foto', requiereAuth, middlewareAsistente, upload.single('foto'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Falta la foto' });
    const sugerencia = await asistente.analizarFoto(req.file.buffer, req.file.mimetype);
    res.json(sugerencia);
  } catch (err) {
    console.error('Error analizando foto:', err);
    res.status(500).json({ error: 'No se pudo analizar la foto' });
  }
});

// Ejecuta un comando hablado/escrito sobre los productos
app.post('/api/asistente/comando', requiereAuth, middlewareAsistente, async (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto || !texto.trim()) return res.status(400).json({ error: 'Falta el texto del comando' });
    const respuesta = await asistente.ejecutarComando(texto.trim());
    res.json(respuesta);
  } catch (err) {
    console.error('Error en comando del asistente:', err);
    res.status(500).json({ error: 'El asistente no pudo procesar el pedido' });
  }
});

// ============ ARRANQUE ============
// Inicializamos la base de datos ANTES de levantar el servidor
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🫖 Taller de la tía tia de Goncy corriendo en http://localhost:${PORT}`);
      console.log(`   Web pública: http://localhost:${PORT}`);
      console.log(`   Panel de tia de Goncy: http://localhost:${PORT}/admin.html`);
      console.log(`   Datos persistentes en: ${DATA_DIR}`);
    });
  })
  .catch((err) => {
    console.error('No se pudo iniciar la base de datos:', err);
    process.exit(1);
  });