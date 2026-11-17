// PARA USAR CON SQLite
/*
const Database = require('better-sqlite3');
const db = new Database('taller.db');

// Crear tabla si no existe
db.exec(`
  CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    precio TEXT NOT NULL,
    frase TEXT,
    foto TEXT,
    estado TEXT DEFAULT 'visible',
    creado DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;
*/

const initSqlJs = require('sql.js');
const fs = require('fs');
const { DB_PATH } = require('./paths');

let db;

async function initDB() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(new Uint8Array(buffer));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      precio TEXT NOT NULL,
      frase TEXT,
      foto TEXT,
      estado TEXT DEFAULT 'visible',
      creado DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migración: columna para registrar cuándo se vendió una pieza
  const columnas = queryAll("PRAGMA table_info(productos)");
  if (!columnas.some(c => c.name === 'vendido_en')) {
    db.run("ALTER TABLE productos ADD COLUMN vendido_en DATETIME");
  }
  // Migración: cantidad de piezas disponibles
  if (!columnas.some(c => c.name === 'stock')) {
    db.run("ALTER TABLE productos ADD COLUMN stock INTEGER DEFAULT 1");
  }

  // Historial de ventas: una fila por cada unidad vendida
  db.run(`
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER,
      titulo TEXT,
      precio TEXT,
      vendido_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  guardarDB();
}

// Registra una venta (una unidad) y descuenta stock.
// Si el stock llega a 0, la pieza pasa a estado 'vendido' (oculta de la web).
function registrarVenta(id, precioFinal) {
  const producto = queryOne('SELECT * FROM productos WHERE id = ?', [id]);
  if (!producto) return null;

  const stockActual = producto.stock ?? 1;
  const nuevoStock = Math.max(0, stockActual - 1);
  const nuevoEstado = nuevoStock === 0 ? 'vendido' : producto.estado;

  runSql(
    'UPDATE productos SET stock = ?, estado = ?, vendido_en = CURRENT_TIMESTAMP WHERE id = ?',
    [nuevoStock, nuevoEstado, id]
  );
  runSql(
    'INSERT INTO ventas (producto_id, titulo, precio) VALUES (?, ?, ?)',
    [id, producto.titulo, precioFinal ?? producto.precio]
  );

  return { producto, stockRestante: nuevoStock, estado: nuevoEstado };
}

function guardarDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Helper para consultas que devuelven filas
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper para ejecutar (insert/update/delete)
function runSql(sql, params = []) {
  db.run(sql, params);
  guardarDB();
  // Obtener el último ID insertado
  const result = queryAll("SELECT last_insert_rowid() as id");
  return { lastInsertRowid: result[0].id };
}

// Helper para leer una sola fila
function queryOne(sql, params = []) {
  return queryAll(sql, params)[0] || null;
}

module.exports = { initDB, queryAll, queryOne, runSql, registrarVenta, db };