import { Router } from 'express'
import { db } from '../db.js'
import { requerirAdmin } from '../auth.js'

const router = Router()

const SOLOS_CATEGORIAS = ['Cocción', 'Preparación', 'Cafetería', 'Limpieza']

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
  if (!parcial || body.stock !== undefined) {
    const stock = Number(body.stock)
    if (!Number.isInteger(stock) || stock < 0) errores.push('El stock debe ser un entero mayor o igual a 0.')
    datos.stock = stock
  }
  if (body.descripcion !== undefined) datos.descripcion = String(body.descripcion || '')
  if (body.imagen !== undefined) datos.imagen = String(body.imagen || '').trim().slice(0, 300)
  if (body.activo !== undefined) datos.activo = body.activo ? 1 : 0

  return { errores, datos }
}

router.get('/', (req, res) => {
  const { q = '', categoria = '', soloStock = '', admin = '' } = req.query
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

  const productos = db
    .prepare(`SELECT * FROM productos WHERE ${filtros.join(' AND ')} ORDER BY nombre`)
    .all(...params)

  res.json({
    productos,
    categorias: SOLOS_CATEGORIAS
  })
})

router.get('/:id', (req, res) => {
  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id)
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado.' })
  res.json({ producto })
})

router.post('/', requerirAdmin, (req, res) => {
  const { errores, datos } = validarProducto(req.body || {})
  if (errores.length) return res.status(400).json({ error: errores.join(' ') })

  const resultado = db
    .prepare(
      `INSERT INTO productos (nombre, categoria, descripcion, precio, stock, imagen, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      datos.nombre,
      datos.categoria,
      datos.descripcion ?? '',
      datos.precio,
      datos.stock ?? 0,
      datos.imagen ?? '',
      datos.activo ?? 1
    )

  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(resultado.lastInsertRowid)
  res.status(201).json({ producto })
})

router.put('/:id', requerirAdmin, (req, res) => {
  const actual = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id)
  if (!actual) return res.status(404).json({ error: 'Producto no encontrado.' })

  const { errores, datos } = validarProducto({ ...actual, ...(req.body || {}) })
  if (errores.length) return res.status(400).json({ error: errores.join(' ') })

  db.prepare(
    `UPDATE productos SET nombre = ?, categoria = ?, descripcion = ?, precio = ?, stock = ?,
      imagen = ?, activo = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
  ).run(
    datos.nombre,
    datos.categoria,
    datos.descripcion ?? '',
    datos.precio,
    datos.stock ?? 0,
    datos.imagen ?? '',
    datos.activo ?? 1,
    req.params.id
  )

  res.json({ producto: db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id) })
})

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

  res.json({ producto: db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id) })
})

router.delete('/:id', requerirAdmin, (req, res) => {
  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id)
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado.' })

  const vendido = db.prepare('SELECT COUNT(*) AS n FROM venta_items WHERE producto_id = ?').get(producto.id).n
  if (vendido > 0) {
    db.prepare('UPDATE productos SET activo = 0, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?').run(producto.id)
    return res.json({ producto: db.prepare('SELECT * FROM productos WHERE id = ?').get(producto.id), oculto: true })
  }

  db.prepare('DELETE FROM productos WHERE id = ?').run(producto.id)
  res.json({ eliminado: true })
})

export default router
