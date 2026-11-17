import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { subcategorizar } from './catalogo.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data')
fs.mkdirSync(dataDir, { recursive: true })

const dbPath = process.env.EC_DB_PATH || path.join(dataDir, 'electrocucine.db')

export const db = new DatabaseSync(dbPath)

export function transaction(accion) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const resultado = accion()
    db.exec('COMMIT')
    return resultado
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nombre TEXT NOT NULL,
    email TEXT DEFAULT '',
    fecha_nacimiento TEXT DEFAULT '',
    rol TEXT NOT NULL DEFAULT 'cliente',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS sesiones (
    token TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    creada_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    expira_en TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL,
    subcategoria TEXT DEFAULT '',
    descripcion TEXT DEFAULT '',
    precio REAL NOT NULL,
    precio_tachado REAL NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    imagen TEXT DEFAULT '',
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT DEFAULT '',
    telefono TEXT DEFAULT '',
    direccion TEXT DEFAULT '',
    fecha_nacimiento TEXT DEFAULT '',
    notas TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    subtotal REAL NOT NULL,
    descuento_pct INTEGER NOT NULL DEFAULT 0,
    descuento_monto REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    metodo_pago TEXT DEFAULT 'tarjeta',
    direccion_envio TEXT DEFAULT '',
    estado TEXT NOT NULL DEFAULT 'completada'
  );

  CREATE TABLE IF NOT EXISTS venta_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
    nombre TEXT NOT NULL,
    precio REAL NOT NULL,
    cantidad INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    usuario TEXT DEFAULT '',
    accion TEXT NOT NULL,
    detalle TEXT DEFAULT '',
    fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS resenas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    estrellas INTEGER NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
    comentario TEXT DEFAULT '',
    fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    UNIQUE (producto_id, usuario_id)
  );

  CREATE TABLE IF NOT EXISTS cupones (
    codigo TEXT PRIMARY KEY,
    tipo TEXT NOT NULL CHECK (tipo IN ('porcentaje', 'fijo')),
    valor REAL NOT NULL CHECK (valor > 0),
    activo INTEGER NOT NULL DEFAULT 1,
    usado INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS avisos_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    UNIQUE (producto_id, email)
  );

  CREATE TABLE IF NOT EXISTS newsletter (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS meta (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sesiones_expira ON sesiones (expira_en);
  CREATE INDEX IF NOT EXISTS idx_resenas_producto ON resenas (producto_id);
  CREATE INDEX IF NOT EXISTS idx_avisos_producto ON avisos_stock (producto_id);
  CREATE INDEX IF NOT EXISTS idx_venta_items_venta ON venta_items (venta_id);
  CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas (fecha);
  CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria (fecha);
`)

function leerMeta(clave) {
  return db.prepare('SELECT valor FROM meta WHERE clave = ?').get(clave)?.valor ?? null
}

function escribirMeta(clave, valor) {
  db.prepare('INSERT INTO meta (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor').run(clave, valor)
}

function migrar() {
  const columnasProductos = db.prepare('PRAGMA table_info(productos)').all().map((c) => c.name)
  if (!columnasProductos.includes('precio_tachado')) {
    db.exec('ALTER TABLE productos ADD COLUMN precio_tachado REAL NOT NULL DEFAULT 0')
  }
  if (!columnasProductos.includes('subcategoria')) {
    db.exec("ALTER TABLE productos ADD COLUMN subcategoria TEXT DEFAULT ''")
  }
  if (leerMeta('subcategorias_v2') !== '1') {
    const filas = db.prepare('SELECT id, nombre FROM productos').all()
    const asignar = db.prepare('UPDATE productos SET subcategoria = ? WHERE id = ?')
    for (const { id, nombre } of filas) {
      asignar.run(subcategorizar(nombre), id)
    }
    escribirMeta('subcategorias_v2', '1')
  }
  const columnasVentas = db.prepare('PRAGMA table_info(ventas)').all().map((c) => c.name)
  if (!columnasVentas.includes('direccion_envio')) {
    db.exec("ALTER TABLE ventas ADD COLUMN direccion_envio TEXT DEFAULT ''")
  }
  if (!columnasVentas.includes('cuotas')) {
    db.exec('ALTER TABLE ventas ADD COLUMN cuotas INTEGER NOT NULL DEFAULT 1')
  }
  if (!columnasVentas.includes('cupon_codigo')) {
    db.exec("ALTER TABLE ventas ADD COLUMN cupon_codigo TEXT DEFAULT ''")
  }
  if (!columnasVentas.includes('cupon_descuento')) {
    db.exec('ALTER TABLE ventas ADD COLUMN cupon_descuento REAL NOT NULL DEFAULT 0')
  }
  const columnasCupones = db.prepare('PRAGMA table_info(cupones)').all().map((c) => c.name)
  if (!columnasCupones.includes('usos_max')) {
    db.exec('ALTER TABLE cupones ADD COLUMN usos_max INTEGER')
  }

  
  
  
  if (leerMeta('imagenes_svg_v1') !== '1') {
    db.exec(
      `UPDATE productos SET imagen = imagen || '.svg'
       WHERE imagen NOT LIKE '%.%' AND imagen NOT LIKE 'http%' AND imagen NOT LIKE '/%'
         AND CAST(imagen AS INTEGER) BETWEEN 6 AND 100000`
    )
    escribirMeta('imagenes_svg_v1', '1')
  }

  
  
  
  
  if (leerMeta('sin_imagenes_v2') !== '1') {
    const filas = db.prepare('SELECT id, imagen FROM productos WHERE id > 5').all()
    const limpiar = db.prepare("UPDATE productos SET imagen = '' WHERE id = ?")
    for (const { id, imagen } of filas) {
      const texto = String(imagen || '')
      if (!texto) continue
      const base = texto.replace(/\.(jpe?g|png|webp|svg)$/i, '')
      if (texto === String(id) || (/^\d+$/.test(base) && Number(base) === id)) {
        limpiar.run(id)
      }
    }
    escribirMeta('sin_imagenes_v2', '1')
  }

  
  
  
  if (leerMeta('imagenes_elegidas_v1') !== '1') {
    try {
      const rutaMapa = path.join(__dirname, 'imagenes-reales.json')
      const mapa = JSON.parse(fs.readFileSync(rutaMapa, 'utf8'))
      const actualizar = db.prepare('UPDATE productos SET imagen = ? WHERE id = ?')
      for (const [id, archivo] of Object.entries(mapa)) {
        if (fs.existsSync(path.join(__dirname, '..', '..', 'FrontEnd', 'client', 'public', 'productos', archivo))) {
          actualizar.run(archivo, Number(id))
        }
      }
      escribirMeta('imagenes_elegidas_v1', '1')
    } catch { void 0 }
  }

  
  
  // v2: re-aplica el mapa completo (agrega las fotos nuevas: 14, 16, 17, 19, 20,
  // 22, 25, 26, 28, 29, 35, 37, 41, 43, 44, 46, 47, 55, 64, 83, 85, 91).
  if (leerMeta('imagenes_elegidas_v2') !== '1') {
    try {
      const rutaMapa = path.join(__dirname, 'imagenes-reales.json')
      const mapa = JSON.parse(fs.readFileSync(rutaMapa, 'utf8'))
      const actualizar = db.prepare('UPDATE productos SET imagen = ? WHERE id = ?')
      for (const [id, archivo] of Object.entries(mapa)) {
        if (fs.existsSync(path.join(__dirname, '..', '..', 'FrontEnd', 'client', 'public', 'productos', archivo))) {
          actualizar.run(archivo, Number(id))
        }
      }
      escribirMeta('imagenes_elegidas_v2', '1')
    } catch { void 0 }
  }

  if (leerMeta('descuentos_mixtos_v1') !== '1') {
    db.exec('UPDATE productos SET precio_tachado = 0 WHERE id % 3 = 0')
    escribirMeta('descuentos_mixtos_v1', '1')
  }

  
  
  
  
  if (leerMeta('sesiones_hash_v1') !== '1') {
    const filas = db.prepare('SELECT token FROM sesiones').all()
    const actualizar = db.prepare('UPDATE sesiones SET token = ? WHERE token = ?')
    for (const { token } of filas) {
      actualizar.run(sha256(token), token)
    }
    escribirMeta('sesiones_hash_v1', '1')
  }
}

export function sha256(texto) {
  return createHash('sha256').update(String(texto)).digest('hex')
}

export function purgarSesionesExpiradas() {
  return db.prepare("DELETE FROM sesiones WHERE expira_en <= datetime('now')").run().changes
}

migrar()

export function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null
  const nac = new Date(`${fechaNacimiento}T00:00:00`)
  if (Number.isNaN(nac.getTime())) return null
  const hoy = new Date()
  let edad = hoy.getFullYear() - nac.getFullYear()
  const mes = hoy.getMonth() - nac.getMonth()
  if (mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

export const EDAD_DESCUENTO = 65
export const PORCENTAJE_DESCUENTO = 30
export const EDAD_MAXIMA = 100

export function validarFechaNacimiento(fecha) {
  if (!fecha) return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return 'La fecha de nacimiento debe tener formato AAAA-MM-DD.'
  const nacimiento = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(nacimiento.getTime())) return 'La fecha de nacimiento no es válida.'
  if (nacimiento > new Date()) return 'La fecha de nacimiento no puede ser a futuro.'
  const edad = calcularEdad(fecha)
  if (edad !== null && edad > EDAD_MAXIMA) {
    return `Debés tener como máximo ${EDAD_MAXIMA} años para crear la cuenta.`
  }
  return ''
}

export function tieneDescuento(usuario) {
  const edad = calcularEdad(usuario?.fecha_nacimiento)
  return edad !== null && edad >= EDAD_DESCUENTO
}

export function registrarAuditoria(usuario, accion, detalle = '') {
  try {
    db.prepare('INSERT INTO auditoria (usuario_id, usuario, accion, detalle) VALUES (?, ?, ?, ?)').run(
      usuario?.id ?? null,
      usuario?.username ?? 'sistema',
      accion,
      String(detalle)
    )
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auditoria] No se pudo registrar:', error?.message)
    }
  }
}

