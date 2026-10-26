import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, registrarAuditoria } from '../db.js'
import { requerirAdmin } from '../auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Carpeta pública donde viven las imágenes numeradas (/productos/1.jpg, etc.).
const CARPETA_IMAGENES = path.join(__dirname, '..', '..', 'public', 'productos')

const router = Router()

// ---------------------- Constantes y utilidades ----------------------
const CATEGORIAS = ['Cocción', 'Preparación', 'Cafetería', 'Limpieza']

function normalizarImagen(valor) {
  return String(valor || '').trim().slice(0, 300)
}

// Valida el body de un producto (parcial = solo campos enviados).
// Devuelve { errores[], datos{} } con los campos ya limpios.
function validarProducto(body, { parcial = false } = {}) {
  const errores = []
  const datos = {}

  if (!parcial || body.nombre !== undefined) {
    if (!String(body.nombre || '').trim()) errores.push('El nombre es obligatorio.')
    datos.nombre = String(body.nombre || '').trim()
  }
  if (!parcial || body.categoria !== undefined) {
    if (!String(body.categoria || '').trim()) errores.push('La categoría es obligatoria.')
    datos.categoria = String(body.categoria || '').trim()
  }
  if (!parcial || body.precio !== undefined) {
    const precio = Number(body.precio)
    if (!Number.isFinite(precio) || precio < 0) errores.push('El precio debe ser un número mayor o igual a 0.')
    datos.precio = precio
  }
  if (!parcial || body.precio_tachado !== undefined) {
    const tachado = Number(body.precio_tachado ?? 0)
    if (!Number.isFinite(tachado) || tachado < 0) errores.push('El precio anterior debe ser un número mayor o igual a 0.')
    datos.precio_tachado = tachado
  }
  if (!parcial || body.stock !== undefined) {
    const stock = Number(body.stock)
    if (!Number.isInteger(stock) || stock < 0) errores.push('El stock debe ser un entero mayor o igual a 0.')
    datos.stock = stock
  }
  if (body.descripcion !== undefined) datos.descripcion = String(body.descripcion || '')
  if (body.imagen !== undefined) datos.imagen = normalizarImagen(body.imagen)
  if (body.activo !== undefined) datos.activo = body.activo ? 1 : 0

  return { errores, datos }
}

// ---------------------- GET /api/productos · Listado con filtros ----------------------
// Público. Filtros: q (texto), categoria, soloStock, min/max (precio) y
// admin=1 (el panel admin pide también los productos ocultos).
router.get('/', (req, res) => {
  const { q = '', categoria = '', soloStock = '', admin = '', min = '', max = '' } = req.query
  const filtros = []
  const params = []

  if (admin === '1') {
    filtros.push('1 = 1')
  } else {
    filtros.push('activo = 1')
  }
  if (q) {
    filtros.push('(nombre LIKE ? OR descripcion LIKE ? OR categoria LIKE ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  if (categoria) {
    filtros.push('categoria = ?')
    params.push(categoria)
  }
  if (soloStock === '1') filtros.push('stock > 0')
  if (min !== '' && !Number.isNaN(Number(min))) {
    filtros.push('precio >= ?')
    params.push(Number(min))
  }
  if (max !== '' && !Number.isNaN(Number(max))) {
    filtros.push('precio <= ?')
    params.push(Number(max))
  }

  const productos = db
    .prepare(`SELECT * FROM productos WHERE ${filtros.join(' AND ')} ORDER BY nombre`)
    .all(...params)

  res.json({ productos, categorias: CATEGORIAS })
})

// ---------------------- GET /api/productos/imagenes · Imágenes disponibles ----------------------
// Solo admin. Devuelve los archivos de imagen subidos al servidor para
// poder elegirlos desde el panel (selector de imágenes).
router.get('/imagenes', requerirAdmin, (req, res) => {
  let archivos = []
  if (fs.existsSync(CARPETA_IMAGENES)) {
    archivos = fs
      .readdirSync(CARPETA_IMAGENES)
      .filter((f) => /\.(jpe?g|png|webp|avif|gif)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }
  res.json({ imagenes: archivos, ruta: '/productos' })
})

// ---------------------- GET /api/productos/:id · Detalle ----------------------
router.get('/:id', (req, res) => {
  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id)
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado.' })
  res.json({ producto })
})

// ---------------------- POST /api/productos · Crear (admin) ----------------------
router.post('/', requerirAdmin, (req, res) => {
  const { errores, datos } = validarProducto(req.body || {})
  if (errores.length) return res.status(400).json({ error: errores.join(' ') })

  const resultado = db
    .prepare(
      `INSERT INTO productos (nombre, categoria, descripcion, precio, precio_tachado, stock, imagen, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      datos.nombre,
      datos.categoria,
      datos.descripcion ?? '',
      datos.precio,
      datos.precio_tachado ?? 0,
      datos.stock ?? 0,
      datos.imagen ?? '',
      datos.activo ?? 1
    )

  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(resultado.lastInsertRowid)
  registrarAuditoria(req.usuario, 'producto-crear', `#${producto.id} ${producto.nombre}`)
  res.status(201).json({ producto })
})

// ---------------------- PUT /api/productos/:id · Actualizar (admin) ----------------------
router.put('/:id', requerirAdmin, (req, res) => {
  const actual = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id)
  if (!actual) return res.status(404).json({ error: 'Producto no encontrado.' })

  const { errores, datos } = validarProducto({ ...actual, ...(req.body || {}) })
  if (errores.length) return res.status(400).json({ error: errores.join(' ') })

  db.prepare(
    `UPDATE productos SET nombre = ?, categoria = ?, descripcion = ?, precio = ?, precio_tachado = ?,
      stock = ?, imagen = ?, activo = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
  ).run(
    datos.nombre,
    datos.categoria,
    datos.descripcion ?? '',
    datos.precio,
    datos.precio_tachado ?? 0,
    datos.stock ?? 0,
    datos.imagen ?? '',
    datos.activo ?? 1,
    req.params.id
  )

  registrarAuditoria(req.usuario, 'producto-editar', `#${req.params.id} ${datos.nombre}`)
  res.json({ producto: db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id) })
})

// ---------------------- PATCH /api/productos/:id/stock · Ajustar stock (admin) ----------------------
// Acepta "stock" (valor fijo) o "ajuste" (delta, puede ser negativo).
router.patch('/:id/stock', requerirAdmin, (req, res) => {
  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id)
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado.' })

  const { stock, ajuste } = req.body || {}
  let nuevoStock

  if (stock !== undefined) {
    nuevoStock = Number(stock)
    if (!Number.isInteger(nuevoStock) || nuevoStock < 0) {
      return res.status(400).json({ error: 'El stock debe ser un entero mayor o igual a 0.' })
    }
  } else if (ajuste !== undefined) {
    const delta = Number(ajuste)
    if (!Number.isInteger(delta)) {
      return res.status(400).json({ error: 'El ajuste debe ser un entero (puede ser negativo).' })
    }
    nuevoStock = producto.stock + delta
    if (nuevoStock < 0) {
      return res.status(400).json({ error: 'El stock no puede quedar en negativo.' })
    }
  } else {
    return res.status(400).json({ error: 'Enviá "stock" o "ajuste".' })
  }

  db.prepare(
    "UPDATE productos SET stock = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
  ).run(nuevoStock, req.params.id)

  registrarAuditoria(req.usuario, 'producto-stock', `#${producto.id} ${producto.nombre}: ${producto.stock} → ${nuevoStock}`)
  res.json({ producto: db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id) })
})

// ---------------------- DELETE /api/productos/:id · Eliminar (admin) ----------------------
// Si el producto ya se vendió se oculta (activo = 0) para no romper las
// ventas históricas; si nunca se vendió se borra físicamente.
router.delete('/:id', requerirAdmin, (req, res) => {
  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id)
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado.' })

  const vendido = db.prepare('SELECT COUNT(*) AS n FROM venta_items WHERE producto_id = ?').get(producto.id).n
  if (vendido > 0) {
    db.prepare("UPDATE productos SET activo = 0, updated_at = datetime('now', 'localtime') WHERE id = ?").run(producto.id)
    registrarAuditoria(req.usuario, 'producto-ocultar', `#${producto.id} ${producto.nombre}`)
    return res.json({ producto: db.prepare('SELECT * FROM productos WHERE id = ?').get(producto.id), oculto: true })
  }

  db.prepare('DELETE FROM productos WHERE id = ?').run(producto.id)
  registrarAuditoria(req.usuario, 'producto-eliminar', `#${producto.id} ${producto.nombre}`)
  res.json({ eliminado: true })
})

export default router