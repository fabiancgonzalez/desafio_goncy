const fs = require('fs');
const path = require('path');

// Carpeta de datos persistentes.
// En Render el disco "datos" está montado en /var/data (configurable con DATA_DIR).
// En local (o si no hay disco), se usa la carpeta del proyecto como siempre.
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/var/data') ? '/var/data' : __dirname);

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

module.exports = {
  DATA_DIR,
  UPLOADS_DIR,
  DB_PATH: path.join(DATA_DIR, 'taller.db'),
  TOKEN_FILE: path.join(DATA_DIR, 'token-secreto.txt'),
};
