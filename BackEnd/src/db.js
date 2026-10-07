import { DatabaseSync } from 'node:sqlite'
import bcrypt from 'bcrypt'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data')
fs.mkdirSync(dataDir, { recursive: true })

export const db = new DatabaseSync(path.join(dataDir, 'electrocucine.db'))

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
`)

export function transaction(fn) {
  db.exec('BEGIN')
  try {
    const resultado = fn()
    db.exec('COMMIT')
    return resultado
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

const SUPER_USER = {
  username: 'federico',
  password: 'admin23',
  nombre: 'Federico Travella',
  email: 'federico@electrocucine.com',
  rol: 'admin'
}

const productosIniciales = [
  ['Batidora de mano 5 velocidades', 'Preparación', 'Motor de 400W, 5 velocidades, varillas de acero inoxidable y vaso de 700ml.', 45999, 25, '🥄'],
  ['Licuadora de vaso 1.5L', 'Preparación', 'Vaso de vidrio resistente, 600W y programadora con hielo picado.', 78500, 18, '🥤'],
  ['Procesador de alimentos 12 accesorios', 'Preparación', 'Corta, ralla, amasa y exprime. Bowl de 3.5L con accesorios incluidos.', 112900, 9, '🔪'],
  ['Horno eléctrico 45L con grill', 'Cocción', 'Termostato hasta 250°C, grill superior, 4 planes y timer de 60 minutos.', 189900, 7, '🔥'],
  ['Microondas 25L inverter', 'Cocción', 'Potencia 900W, 10 niveles, función descongelar y plato girador.', 145500, 12, '🍽️'],
  ['Freidora de aire 5.5L', 'Cocción', 'Hasta un 85% menos de aceite, 8 programas y pantalla táctil.', 96700, 22, '🍟'],
  ['Cafetera espresso 15 bar', 'Cafetería', 'Presión de 15 bar, vaporizador de leche y bandeja calientatazas.', 134900, 14, '☕'],
  ['Cafetera goteo programable', 'Cafetería', '12 tazas, filtro reutilizable, programador de 24h y mantenimiento caliente.', 58400, 20, '☕'],
  ['Tostadora 2 ranuras', 'Cafetería', '7 niveles de tostado, cancelación instantánea y bandeja de migas.', 32990, 30, '🍞'],
  ['Pava eléctrica 1.7L', 'Cafetería', 'Apagado automático, indicador de nivel y base 360°.', 27500, 35, '🫖'],
  ['Lavavajillas compacto 14 cubiertos', 'Limpieza', '6 programas, consumo eficiente clase A++ y función media carga.', 465000, 4, '🧼'],
  ['Extractor de humos 60cm', 'Limpieza', 'Motor silencioso 400 m³/h, 3 velocidades y luz LED.', 158900, 6, '💨'],
  ['Arrocera 1.8L con vapor', 'Preparación', 'Cocción por vapor, 5 funciones y función keep warm 12 horas.', 41200, 16, '🍚'],
  ['Sandwichera plana 1000W', 'Cocción', 'Planchas antiadherentes de granito y bandeja de grasa extraíble.', 38900, 24, '🥪']
]

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

export function tieneDescuento(usuario) {
  const edad = calcularEdad(usuario?.fecha_nacimiento)
  return edad !== null && edad >= EDAD_DESCUENTO
}

function seed() {
  const admin = db.prepare('SELECT id FROM usuarios WHERE username = ?').get(SUPER_USER.username)
  if (!admin) {
    const hash = bcrypt.hashSync(SUPER_USER.password, 10)
    db.prepare(
      'INSERT INTO usuarios (username, password, nombre, email, fecha_nacimiento, rol) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(SUPER_USER.username, hash, SUPER_USER.nombre, SUPER_USER.email, '', SUPER_USER.rol)
    console.log(`[seed] Superusuario creado: ${SUPER_USER.username}`)
  }

  const cantidad = db.prepare('SELECT COUNT(*) AS n FROM productos').get().n
  if (cantidad === 0) {
    const stmt = db.prepare(
      'INSERT INTO productos (nombre, categoria, descripcion, precio, stock, imagen) VALUES (?, ?, ?, ?, ?, ?)'
    )
    for (const p of productosIniciales) stmt.run(...p)
    console.log(`[seed] ${productosIniciales.length} productos de ejemplo cargados`)
  }
}

seed()
