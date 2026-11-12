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
const path = require('path');

const DB_PATH = 'taller.db';
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
  
  guardarDB();
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

module.exports = { initDB, queryAll, runSql, db };