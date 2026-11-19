const fs = require('fs');
const path = require('path');

// Carpeta de datos persistentes.
// DATA_DIR permite elegir una carpeta distinta de la raíz del volumen.
const DATA_DIR =
  process.env.DATA_DIR ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH ||
  (fs.existsSync('/var/data') ? '/var/data' : __dirname);

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

module.exports = {
  DATA_DIR,
  UPLOADS_DIR,
  DB_PATH: path.join(DATA_DIR, 'taller.db'),
  TOKEN_FILE: path.join(DATA_DIR, 'token-secreto.txt'),
};
