// =====================================================================
// SECCIÓN: BASE DE DATOS (SQLite con node:sqlite)
// - Único módulo que toca la DB. Los routers importan `db` desde acá.
// - Al importarse este archivo se (1) crean las tablas, (2) se aplican
//   migraciones de columnas nuevas y ajustes de datos heredados.
// - El SEED (superusuario y catálogo) vive en src/seed.js y lo invoca
//   index.js al arrancar, o `npm run seed` a mano.
// =====================================================================
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data')
fs.mkdirSync(dataDir, { recursive: true })

// Ruta de la DB: configurable por entorno (los tests usan :memory:).
const dbPath = process.env.EC_DB_PATH || path.join(dataDir, 'electrocucine.db')

// ---------------------- Conexión a la base ----------------------
export const db = new DatabaseSync(dbPath)

// ---------------------- Helper de transacciones ----------------------
// node:sqlite no trae db.transaction(): este helper envuelve una función
// en BEGIN IMMEDIATE (bloquea temprano el lock de escritura) y hace
// ROLLBACK automático si algo falla a mitad.
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

// ---------------------- Esquema de tablas ----------------------
// CREATE TABLE IF NOT EXISTS: no borra nada si la tabla ya existe.
//  - usuarios: cuentas (password = hash bcrypt, nunca texto plano).
//  - sesiones: tokens de sesión (hasheados con SHA-256) + expiración.
//  - productos: catálogo; {precio, precio_tachado} = precio de oferta y
//    precio "tachado" anterior (para mostrar % OFF).
//  - clientes: libreta de contactos del superusuario.
//  - ventas / venta_items: cabecera de venta + detalle por producto.
//  - auditoria: quién hizo qué acción sensible y cuándo.
//  - meta: marcadores internos de migraciones (clave/valor).

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

  CREATE TABLE IF NOT EXISTS meta (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sesiones_expira ON sesiones (expira_en);
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

// ---------------------- Migraciones ----------------------
// Si una versión anterior de la DB no tiene una columna nueva,
// se la agrega con ALTER TABLE sin perder los datos existentes.
function migrar() {
  const columnasProductos = db.prepare('PRAGMA table_info(productos)').all().map((c) => c.name)
  if (!columnasProductos.includes('precio_tachado')) {
    db.exec('ALTER TABLE productos ADD COLUMN precio_tachado REAL NOT NULL DEFAULT 0')
  }
  const columnasVentas = db.prepare('PRAGMA table_info(ventas)').all().map((c) => c.name)
  if (!columnasVentas.includes('direccion_envio')) {
    db.exec("ALTER TABLE ventas ADD COLUMN direccion_envio TEXT DEFAULT ''")
  }
  if (!columnasVentas.includes('cuotas')) {
    db.exec('ALTER TABLE ventas ADD COLUMN cuotas INTEGER NOT NULL DEFAULT 1')
  }

  // Las imágenes de productos 6..100 son SVG generados (public/productos/<id>.svg).
  // Antes el campo guardaba solo el número, que el frontend resolvía a "<n>.jpg"
  // (inexistente para 6..100). Se migra una sola vez.
  if (leerMeta('imagenes_svg_v1') !== '1') {
    db.exec(
      `UPDATE productos SET imagen = imagen || '.svg'
       WHERE imagen NOT LIKE '%.%' AND imagen NOT LIKE 'http%' AND imagen NOT LIKE '/%'
         AND CAST(imagen AS INTEGER) BETWEEN 6 AND 100000`
    )
    escribirMeta('imagenes_svg_v1', '1')
  }

  // Solo los productos 1..5 tienen foto real. Las imágenes "técnicas"
  // ("<id>", "<id>.jpg|png|svg") se quitan a propósito: se muestran con el
  // ícono por defecto. Cualquier imagen elegida a mano (base distinta del id)
  // se respeta.
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

  // Imágenes elegidas por el dueño del proyecto (mapa src/imagenes-reales.json):
  // solo archivos ubicados en public/productos/<archivo>; se aplican sobre
  // instalaciones existentes una sola vez.
  if (leerMeta('imagenes_elegidas_v1') !== '1') {
    try {
      const rutaMapa = path.join(__dirname, 'imagenes-reales.json')
      const mapa = JSON.parse(fs.readFileSync(rutaMapa, 'utf8'))
      const actualizar = db.prepare('UPDATE productos SET imagen = ? WHERE id = ?')
      for (const [id, archivo] of Object.entries(mapa)) {
        if (fs.existsSync(path.join(__dirname, '..', 'public', 'productos', archivo))) {
          actualizar.run(archivo, Number(id))
        }
      }
      escribirMeta('imagenes_elegidas_v1', '1')
    } catch {
      // Sin el mapa (checkout parcial) no se toca nada.
    }
  }

  // No todos los productos llevan oferta: cada 3er producto queda a precio
  // normal (precio_tachado = 0). Aplicado una sola vez sobre DB existentes.
  if (leerMeta('descuentos_mixtos_v1') !== '1') {
    db.exec('UPDATE productos SET precio_tachado = 0 WHERE id % 3 = 0')
    escribirMeta('descuentos_mixtos_v1', '1')
  }

  // Los tokens de sesión se guardan hasheados (SHA-256) desde esta versión.
  // Antes se guardaban en texto plano: se hashean los existentes una sola vez.
  // (Los tokens crudos y su hash son ambos 64 hex: el marcador meta garantiza
  // que esta migración corra exactamente una vez.)
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

// ---------------------- Helpers de edad y descuento ----------------------
// Calcula la edad a partir de la fecha de nacimiento.
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

// Constantes del negocio: descuento 30% para mayores de 65, tope de 100 años.
export const EDAD_DESCUENTO = 65
export const PORCENTAJE_DESCUENTO = 30
export const EDAD_MAXIMA = 100

// Valida una fecha de nacimiento (formato, futuro y límite de edad).
// Devuelve '' si es correcta o un mensaje de error legible.
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

// Indica si un usuario accede al descuento (65 años o más).
export function tieneDescuento(usuario) {
  const edad = calcularEdad(usuario?.fecha_nacimiento)
  return edad !== null && edad >= EDAD_DESCUENTO
}

// ---------------------- Auditoría ----------------------
// Registra una acción sensible (quién hizo qué y cuándo). Nunca debe
// romper la operación principal, por eso atrapa cualquier error.
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
