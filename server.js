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

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { initDB, queryAll, runSql } = require('./database');

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
  const productos = queryAll(
    "SELECT * FROM productos WHERE estado = 'visible' ORDER BY creado DESC"
  );
  res.json(productos);
});

// ============ API ADMIN ============
// Obtener TODOS los productos (para el panel de la tía)
app.get('/api/admin/productos', (req, res) => {
  const productos = queryAll(
    "SELECT * FROM productos ORDER BY creado DESC"
  );
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

    const info = runSql(
      "INSERT INTO productos (titulo, precio, frase, foto) VALUES (?, ?, ?, ?)",
      [titulo, precio, frase || '', fotoNombre]
    );

    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo guardar la pieza' });
  }
});

// Editar título, precio y frase
app.put('/api/productos/:id/editar', (req, res) => {
  runSql(
    "UPDATE productos SET titulo = ?, precio = ?, frase = ? WHERE id = ?",
    [req.body.titulo, req.body.precio, req.body.frase, req.params.id]
  );
  res.json({ ok: true });
});

// Cambiar precio
app.put('/api/productos/:id/precio', (req, res) => {
  runSql(
    "UPDATE productos SET precio = ? WHERE id = ?",
    [req.body.precio, req.params.id]
  );
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
app.put('/api/productos/:id/estado', (req, res) => {
  runSql(
    "UPDATE productos SET estado = ? WHERE id = ?",
    [req.body.estado, req.params.id]
  );
  res.json({ ok: true });
});

// Eliminar producto (por si acaso)
app.delete('/api/productos/:id', (req, res) => {
  runSql("DELETE FROM productos WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

// ============ ARRANQUE ============
// Inicializamos la base de datos ANTES de levantar el servidor
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🫖 Taller de la tía tia de Goncy corriendo en http://localhost:${PORT}`);
      console.log(`   Web pública: http://localhost:${PORT}`);
      console.log(`   Panel de tia de Goncy: http://localhost:${PORT}/admin.html`);
    });
  })
  .catch((err) => {
    console.error('No se pudo iniciar la base de datos:', err);
    process.exit(1);
  });