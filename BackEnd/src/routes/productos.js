import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, registrarAuditoria } from '../db.js'
import { requerirAdmin, requerirAuth, obtenerUsuarioOpcional } from '../auth.js'
import { enviarAvisoClienteStock } from '../correo.js'

function notificarVueltaSiRestock(productoAntes, stockNuevo) {
  if (!productoAntes || !(productoAntes.stock <= 0) || stockNuevo <= 0) return
  const avisos = db.prepare('SELECT email FROM avisos_stock WHERE producto_id = ?').all(productoAntes.id)
  for (const { email } of avisos) {
    enviarAvisoClienteStock({ ...productoAntes, stock: stockNuevo }, email).catch(() => {})
  }
  db.prepare('DELETE FROM avisos_stock WHERE producto_id = ?').run(productoAntes.id)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CARPETA_IMAGENES = path.join(__dirname, '..', '..', 'public', 'productos')

const router = Router()

const CATEGORIAS = ['Cocción', 'Preparación', 'Cafetería', 'Limpieza']

function normalizarImagen(valor) {
  return String(valor || '').trim().slice(0, 300)
}

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

function listarProductos(req, res, incluirOcultos) {
  const { q = '', categoria = '', soloStock = '', min = '', max = '' } = req.query
  const filtros = []
  const params = []

  if (!incluirOcultos) filtros.push('activo = 1')
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

  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''
  const productos = db
    .prepare(
      `SELECT p.*,
              COALESCE((SELECT AVG(r.estrellas) FROM resenas r WHERE r.producto_id = p.id), 0) AS promedio_resenas,
              (SELECT COUNT(*) FROM resenas r WHERE r.producto_id = p.id) AS cantidad_resenas
       FROM productos p ${where} ORDER BY p.nombre`
    )
    .all(...params)

  res.json({ productos, categorias: CATEGORIAS })
}

router.get('/', (req, res) => {
  if (req.query.admin === '1') {
    return requerirAdmin(req, res, () => listarProductos(req, res, true))
  }
  listarProductos(req, res, false)
})

router.get('/imagenes', requerirAdmin, (req, res) => {
  let archivos = []
  if (fs.existsSync(CARPETA_IMAGENES)) {
    archivos = fs
      .readdirSync(CARPETA_IMAGENES)
      .filter((f) => /\.(jpe?g|png|webp|avif|gif|svg)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }
  res.json({ imagenes: archivos, ruta: '/productos' })
})

router.get('/populares', (req, res) => {
  const productos = db
    .prepare(
      `SELECT p.*, COALESCE(SUM(vi.cantidad), 0) AS unidades_vendidas
       FROM productos p
       JOIN venta_items vi ON vi.producto_id = p.id
       JOIN ventas v ON v.id = vi.venta_id AND v.estado != 'anulada'
       WHERE p.activo = 1
       GROUP BY p.id
       ORDER BY unidades_vendidas DESC
       LIMIT 6`
    )
    .all()
  const idsPopulares = productos.map((p) => p.id)
  const todos = db.prepare('SELECT * FROM productos WHERE activo = 1 ORDER BY id').all()
  const vistos = idsPopulares.length >= 6 ? [] : todos.filter((p) => !idsPopulares.includes(p.id)).slice(0, 6 - idsPopulares.length)
  res.json({ productos: [...productos, ...vistos].slice(0, 6) })
})

router.get('/:id', (req, res) => {
  const producto = db
    .prepare(
      `SELECT p.*,
              COALESCE((SELECT AVG(r.estrellas) FROM resenas r WHERE r.producto_id = p.id), 0) AS promedio_resenas,
              (SELECT COUNT(*) FROM resenas r WHERE r.producto_id = p.id) AS cantidad_resenas
       FROM productos p WHERE p.id = ?`
    )
    .get(req.params.id)
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado.' })
  if (!producto.activo) {
    const usuario = obtenerUsuarioOpcional(req)
    if (!usuario || usuario.rol !== 'admin') {
      return res.status(404).json({ error: 'Producto no encontrado.' })
    }
  }
  res.json({ producto })
})

router.get('/:id/resenas', (req, res) => {
  const existe = db.prepare('SELECT id FROM productos WHERE id = ?').get(req.params.id)
  if (!existe) return res.status(404).json({ error: 'Producto no encontrado.' })

  const resenas = db
    .prepare(
      `SELECT r.id, r.estrellas, r.comentario, r.fecha, r.updated_at,
              u.id AS usuario_id, u.nombre AS usuario_nombre, u.username AS usuario_username
       FROM resenas r
       JOIN usuarios u ON u.id = r.usuario_id
       WHERE r.producto_id = ?
       ORDER BY r.updated_at DESC`
    )
    .all(req.params.id)

  const resumen = db
    .prepare(
      `SELECT COALESCE(AVG(estrellas), 0) AS promedio, COUNT(*) AS cantidad,
              COALESCE(SUM(CASE WHEN estrellas = 5 THEN 1 ELSE 0 END), 0) AS cinco,
              COALESCE(SUM(CASE WHEN estrellas = 4 THEN 1 ELSE 0 END), 0) AS cuatro,
              COALESCE(SUM(CASE WHEN estrellas = 3 THEN 1 ELSE 0 END), 0) AS tres,
              COALESCE(SUM(CASE WHEN estrellas = 2 THEN 1 ELSE 0 END), 0) AS dos,
              COALESCE(SUM(CASE WHEN estrellas = 1 THEN 1 ELSE 0 END), 0) AS uno
       FROM resenas WHERE producto_id = ?`
    )
    .get(req.params.id)

  res.json({ resenas, resumen: { ...resumen, promedio: Number(Number(resumen.promedio).toFixed(1)) } })
})

router.post('/:id/resenas', requerirAuth, (req, res) => {
  const producto = db.prepare('SELECT id FROM productos WHERE id = ? AND activo = 1').get(req.params.id)
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado.' })

  const compro = db
    .prepare(
      `SELECT COUNT(*) AS n FROM venta_items vi
       JOIN ventas v ON v.id = vi.venta_id AND v.estado = 'completada'
       WHERE vi.producto_id = ? AND v.usuario_id = ?`
    )
    .get(req.params.id, req.usuario.id).n > 0
  if (!compro) {
    return res.status(403).json({ error: 'Solo los compradores pueden valorar este producto.' })
  }

  const estrellas = Number(req.body?.estrellas)
  if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) {
    return res.status(400).json({ error: 'Las estrellas deben ser un entero entre 1 y 5.' })
  }
  const comentario = String(req.body?.comentario ?? '').trim().slice(0, 500)

  db
    .prepare(
      `INSERT INTO resenas (producto_id, usuario_id, estrellas, comentario)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (producto_id, usuario_id)
       DO UPDATE SET estrellas = excluded.estrellas, comentario = excluded.comentario,
                     updated_at = datetime('now', 'localtime')`
    )
    .run(req.params.id, req.usuario.id, estrellas, comentario)

  const mia = db
    .prepare('SELECT id, estrellas, comentario, fecha FROM resenas WHERE producto_id = ? AND usuario_id = ?')
    .get(req.params.id, req.usuario.id)

  res.status(201).json({ resena: mia })
})

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

router.put('/:id', requerirAdmin, (req, res) => {
  const actual = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id)
  if (!actual) return res.status(404).json({ error: 'Producto no encontrado.' })

  const { errores, datos } = validarProducto({ ...actual, ...(req.body || {}) })
  if (errores.length) return res.status(400).json({ error: errores.join(' ') })

  notificarVueltaSiRestock(actual, Number(datos.stock ?? 0))
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

  notificarVueltaSiRestock(producto, nuevoStock)
  db.prepare(
    "UPDATE productos SET stock = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
  ).run(nuevoStock, req.params.id)

  registrarAuditoria(req.usuario, 'producto-stock', `#${producto.id} ${producto.nombre}: ${producto.stock} → ${nuevoStock}`)
  res.json({ producto: db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id) })
})

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

