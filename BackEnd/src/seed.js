// =====================================================================
// SEED — Datos iniciales (superusuario + catálogo de productos)
// - Se ejecuta al arrancar el servidor (index.js) y también se puede
//   forzar con `npm run seed`.
// - Nunca pisa datos existentes: el catálogo solo se carga si la tabla
//   productos está vacía.
// - El superusuario se crea desde variables de entorno:
//     ADMIN_USERNAME (por defecto "admin")
//     ADMIN_PASSWORD (si falta, se genera una aleatoria y se muestra UNA vez)
//     ADMIN_NOMBRE / ADMIN_EMAIL (opcionales)
// =====================================================================
import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcrypt'
import { db } from './db.js'
import { productosIniciales } from './catalogo.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Mapa id -> archivo real descargado de Wikimedia Commons (ver
// scripts/descargar-imagenes-reales.mjs). Si falta el archivo o el mapa,
// se siembra con el placeholder SVG.
const imagenesReales = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'imagenes-reales.json'), 'utf8'))
  } catch {
    return {}
  }
})()

const RONDAS_BCRYPT = 10

export function seedInicial() {
  // --- Superusuario ---
  const username = (process.env.ADMIN_USERNAME || 'admin').trim()
  const nombre = (process.env.ADMIN_NOMBRE || 'Administrador').trim()
  const email = (process.env.ADMIN_EMAIL || '').trim()

  const admin = db.prepare('SELECT id, username FROM usuarios WHERE username = ?').get(username)
  if (!admin) {
    let password = process.env.ADMIN_PASSWORD
    let generada = false
    if (!password) {
      // Contraseña fuerte generada al vuelo (cumple la política letras+números).
      password = randomBytes(12).toString('base64url').replace(/[-_]/g, 'x') + randomBytes(2).toString('hex')
      generada = true
    }
    const hash = bcrypt.hashSync(password, RONDAS_BCRYPT)
    db.prepare(
      'INSERT INTO usuarios (username, password, nombre, email, fecha_nacimiento, rol) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(username, hash, nombre, email, '', 'admin')

    if (generada) {
      console.log('[seed] ADMIN_PASSWORD no estaba definida. Se creó el superusuario con una contraseña aleatoria.')
      console.log(`[seed]   usuario:     ${username}`)
      console.log(`[seed]   contraseña:  ${password}`)
      console.log('[seed]   ANOTALA AHORA: no se vuelve a mostrar. Cambiala desde el registro o pedí un reset.')
    } else {
      console.log(`[seed] Superusuario creado: ${username}`)
    }
  } else if (admin.username === 'federico') {
    // La cuenta histórica usaba una contraseña débil ("admin23"): avisar siempre.
    console.warn('[seguridad] La cuenta "federico" proviene de una instalación anterior con una contraseña débil. Cambiala cuanto antes.')
  }

  // --- Catálogo inicial (solo si la tabla productos está vacía) ---
  const cantidad = db.prepare('SELECT COUNT(*) AS n FROM productos').get().n
  if (cantidad === 0) {
    const stmt = db.prepare(
      'INSERT INTO productos (nombre, categoria, descripcion, precio, precio_tachado, stock, imagen) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    // Cada lista es [nombre, categoria, descripcion, precio, stock, precio_tachado].
    // La imagen se guarda como número/nombre de archivo (1-5: <id>.jpg con foto
    // real; 6+: <id>.svg placeholder generado).
    productosIniciales.forEach((p, indice) => {
      const id = indice + 1
      const imagen = imagenesReales[id] ?? (id <= 5 ? String(id) : `${id}.svg`)
      stmt.run(p[0], p[1], p[2], p[3], p[5], p[4], imagen)
    })
    console.log(`[seed] ${productosIniciales.length} productos cargados`)
  }
}

// Ejecución directa: `node src/seed.js`
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedInicial()
  console.log('[seed] Listo.')
}
