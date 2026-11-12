const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TOKEN_FILE = path.join(__dirname, 'token-secreto.txt');

// Lee el token del archivo, o lo crea si no existe
function obtenerToken() {
  if (fs.existsSync(TOKEN_FILE)) {
    return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  }
  // Genera uno nuevo: 32 bytes -> 64 caracteres hex
  const nuevo = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(TOKEN_FILE, nuevo, 'utf8');
  return nuevo;
}

// Middleware: exige token válido en la query (?llave=...) o en el header
function requiereAuth(req, res, next) {
  const tokenValido = obtenerToken();
  const tokenRecibido =
    req.query.llave ||
    req.headers['x-llave'] ||
    (req.body && req.body.llave);

  if (tokenRecibido && tokenRecibido === tokenValido) {
    return next();
  }
  res.status(401).json({ error: 'No autorizado' });
}

module.exports = { obtenerToken, requiereAuth };