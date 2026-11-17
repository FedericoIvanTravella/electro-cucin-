import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcrypt'
import { db } from './db.js'
import { productosIniciales, subcategorizar } from './catalogo.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const imagenesElegidas = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'imagenes-reales.json'), 'utf8'))
  } catch {
    return {}
  }
})()

const RONDAS_BCRYPT = 10

export function seedInicial() {
  
  const username = (process.env.ADMIN_USERNAME || 'admin').trim()
  const nombre = (process.env.ADMIN_NOMBRE || 'Administrador').trim()
  const email = (process.env.ADMIN_EMAIL || '').trim()

  const admin = db.prepare('SELECT id, username FROM usuarios WHERE username = ?').get(username)
  if (!admin) {
    let password = process.env.ADMIN_PASSWORD
    let generada = false
    if (!password) {
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
    
    console.warn('[seguridad] La cuenta "federico" proviene de una instalación anterior con una contraseña débil. Cambiala cuanto antes.')
  }

  
  const cantidadCupones = db.prepare('SELECT COUNT(*) AS n FROM cupones').get().n
  if (cantidadCupones === 0) {
    const stmt = db.prepare('INSERT INTO cupones (codigo, tipo, valor) VALUES (?, ?, ?)')
    stmt.run('COCINA10', 'porcentaje', 10)
    stmt.run('CUCINE5', 'fijo', 5000)
    console.log('[seed] 2 cupones cargados: COCINA10 (-10%) y CUCINE5 (-$5.000)')
  }

  const cantidad = db.prepare('SELECT COUNT(*) AS n FROM productos').get().n
  if (cantidad === 0) {
    const stmt = db.prepare(
      'INSERT INTO productos (nombre, categoria, subcategoria, descripcion, precio, precio_tachado, stock, imagen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    
    
    
    
    productosIniciales.forEach((p, indice) => {
      const id = indice + 1
      const imagen = imagenesElegidas[id] ?? (id <= 5 ? String(id) : '')
      const tachado = id % 3 === 0 ? 0 : p[5]
      stmt.run(p[0], p[1], subcategorizar(p[0]), p[2], p[3], tachado, p[4], imagen)
    })
    console.log(`[seed] ${productosIniciales.length} productos cargados`)
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedInicial()
  console.log('[seed] Listo.')
}

