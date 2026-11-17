import { Router } from 'express'
import { db, transaction, tieneDescuento, PORCENTAJE_DESCUENTO, registrarAuditoria } from '../db.js'
import { requerirAuth, requerirAdmin } from '../auth.js'
import { enviarConfirmacionCompra } from '../correo.js'
import { calcularDescuentoCupon } from './cupones.js'

const router = Router()

const METODOS_PAGO = ['tarjeta', 'efectivo', 'transferencia', 'mercado_pago']
const CUOTAS_VALIDAS = [1, 3, 6, 12]

function detalleVenta(venta) {
  const items = db.prepare('SELECT * FROM venta_items WHERE venta_id = ?').all(venta.id)
  const usuario = venta.usuario_id
    ? db.prepare('SELECT id, username, nombre FROM usuarios WHERE id = ?').get(venta.usuario_id)
    : null
  const cliente = venta.cliente_id
    ? db.prepare('SELECT id, nombre, email FROM clientes WHERE id = ?').get(venta.cliente_id)
    : null
  return { ...venta, items, usuario, cliente }
}

function detalleVentas(ventas) {
  if (ventas.length === 0) return []
  const ids = ventas.map((v) => v.id)
  const placeholders = ids.map(() => '?').join(',')
  const items = db.prepare(`SELECT * FROM venta_items WHERE venta_id IN (${placeholders})`).all(...ids)

  const porVenta = new Map()
  for (const item of items) {
    if (!porVenta.has(item.venta_id)) porVenta.set(item.venta_id, [])
    porVenta.get(item.venta_id).push(item)
  }

  const usuarioIds = [...new Set(ventas.map((v) => v.usuario_id).filter(Boolean))]
  const clienteIds = [...new Set(ventas.map((v) => v.cliente_id).filter(Boolean))]
  const usuarios = new Map()
  if (usuarioIds.length) {
    const ph = usuarioIds.map(() => '?').join(',')
    for (const u of db.prepare(`SELECT id, username, nombre FROM usuarios WHERE id IN (${ph})`).all(...usuarioIds)) {
      usuarios.set(u.id, u)
    }
  }
  const clientes = new Map()
  if (clienteIds.length) {
    const ph = clienteIds.map(() => '?').join(',')
    for (const c of db.prepare(`SELECT id, nombre, email FROM clientes WHERE id IN (${ph})`).all(...clienteIds)) {
      clientes.set(c.id, c)
    }
  }

  return ventas.map((v) => ({
    ...v,
    items: porVenta.get(v.id) || [],
    usuario: v.usuario_id ? usuarios.get(v.usuario_id) || null : null,
    cliente: v.cliente_id ? clientes.get(v.cliente_id) || null : null
  }))
}

function paginacion(query, porDefecto = 50, maximo = 200) {
  const pagina = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const porPagina = Math.min(maximo, Math.max(1, Number.parseInt(query.por_pagina, 10) || porDefecto))
  return { pagina, porPagina, offset: (pagina - 1) * porPagina }
}

router.post('/', requerirAuth, async (req, res) => {
  const { items, metodo_pago = 'tarjeta', cuotas = 1, cliente_id = null, direccion_envio = '', email_contacto = '', cupon_codigo = '' } = req.body || {}

  const correoFinal = String(email_contacto || req.usuario.email || '').trim()
  if (correoFinal && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correoFinal)) {
    return res.status(400).json({ error: 'El correo para la confirmación no tiene un formato válido.' })
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El carrito está vacío.' })
  }

  const metodo = METODOS_PAGO.includes(metodo_pago) ? metodo_pago : null
  if (!metodo) {
    return res.status(400).json({ error: `Método de pago inválido. Opciones: ${METODOS_PAGO.join(', ')}.` })
  }
  const cuotasNum = Number(cuotas)
  if (!Number.isInteger(cuotasNum) || !CUOTAS_VALIDAS.includes(cuotasNum)) {
    return res.status(400).json({ error: `Cuotas inválidas. Opciones: ${CUOTAS_VALIDAS.join(', ')}.` })
  }

  const descuentoActivo = tieneDescuento(req.usuario)
  const descuento_pct = descuentoActivo ? PORCENTAJE_DESCUENTO : 0
  const lineas = []
  let subtotal = 0

  for (const item of items) {
    const cantidad = Number(item.cantidad)
    const producto = db.prepare('SELECT * FROM productos WHERE id = ? AND activo = 1').get(item.producto_id)
    if (!producto) {
      return res.status(400).json({ error: 'Uno de los productos ya no está disponible.' })
    }
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      return res.status(400).json({ error: `Cantidad inválida para ${producto.nombre}.` })
    }
    if (producto.stock < cantidad) {
      return res.status(409).json({
        error: `Stock insuficiente de ${producto.nombre}: quedan ${producto.stock} unidades.`,
        producto_id: producto.id,
        stock: producto.stock
      })
    }
    lineas.push({ producto, cantidad })
    subtotal += producto.precio * cantidad
  }

  const descuento_monto = Number(((subtotal * descuento_pct) / 100).toFixed(2))
  let cuponDescuento = 0
  let cuponAplicado = ''
  const codigoCupon = String(cupon_codigo || '').trim().toUpperCase()
  if (codigoCupon) {
    const cupon = db.prepare('SELECT * FROM cupones WHERE codigo = ?').get(codigoCupon)
    if (!cupon || !cupon.activo) {
      return res.status(400).json({ error: 'El cupón no es válido o está desactivado.' })
    }
    cuponDescuento = calcularDescuentoCupon(cupon, subtotal)
    cuponAplicado = cupon.codigo
  }
  const total = Math.max(0, Number((subtotal - descuento_monto - cuponDescuento).toFixed(2)))

  if (cliente_id && !db.prepare('SELECT id FROM clientes WHERE id = ?').get(cliente_id)) {
    return res.status(400).json({ error: 'El cliente indicado no existe.' })
  }

  
  let ventaId
  try {
    ventaId = transaction(() => {
      const venta = db
        .prepare(
          `INSERT INTO ventas (usuario_id, cliente_id, subtotal, descuento_pct, descuento_monto, total, metodo_pago, direccion_envio, cuotas, cupon_codigo, cupon_descuento)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          req.usuario.id,
          cliente_id ?? null,
          subtotal,
          descuento_pct,
          descuento_monto,
          total,
          metodo,
          String(direccion_envio).slice(0, 500),
          cuotasNum,
          cuponAplicado,
          cuponDescuento
        )

      const id = venta.lastInsertRowid
      if (cuponAplicado) {
        db.prepare('UPDATE cupones SET usado = usado + 1 WHERE codigo = ?').run(cuponAplicado)
      }
      const itemStmt = db.prepare(
        'INSERT INTO venta_items (venta_id, producto_id, nombre, precio, cantidad) VALUES (?, ?, ?, ?, ?)'
      )
      
      
      const stockStmt = db.prepare('UPDATE productos SET stock = stock - ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ? AND stock >= ?')
      for (const { producto, cantidad } of lineas) {
        itemStmt.run(id, producto.id, producto.nombre, producto.precio, cantidad)
        const r = stockStmt.run(cantidad, producto.id, cantidad)
        if (r.changes === 0) {
          const error = new Error(`Stock insuficiente de ${producto.nombre}.`)
          error.codigo = 'SIN_STOCK'
          throw error
        }
      }
      return id
    })
  } catch (error) {
    if (error.codigo === 'SIN_STOCK') {
      return res.status(409).json({ error: error.message })
    }
    throw error
  }

  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(ventaId)
  registrarAuditoria(req.usuario, 'venta', `Venta #${venta.id} por $${total}${cuponAplicado ? ` cupón ${cuponAplicado}` : ''}`)
  const resultadoCorreo = await enviarConfirmacionCompra(detalleVenta(venta), req.usuario, correoFinal)
  res.status(201).json({ venta: detalleVenta(venta), correo: resultadoCorreo.via !== 'sin-correo' ? resultadoCorreo : null })
})

router.get('/mias', requerirAuth, (req, res) => {
  const { pagina, porPagina, offset } = paginacion(req.query, 50)
  const total = db.prepare('SELECT COUNT(*) AS n FROM ventas WHERE usuario_id = ?').get(req.usuario.id).n
  const ventas = detalleVentas(
    db.prepare('SELECT * FROM ventas WHERE usuario_id = ? ORDER BY fecha DESC LIMIT ? OFFSET ?').all(req.usuario.id, porPagina, offset)
  )
  res.json({ ventas, total, pagina, paginas: Math.max(1, Math.ceil(total / porPagina)) })
})

router.get('/export.csv', requerirAdmin, (req, res) => {
  const ventas = db.prepare('SELECT * FROM ventas ORDER BY id DESC').all()
  const itemsPorVenta = new Map()
  if (ventas.length > 0) {
    const placeholders = ventas.map(() => '?').join(',')
    const ids = ventas.map((v) => v.id)
    for (const item of db.prepare(`SELECT venta_id, nombre, cantidad FROM venta_items WHERE venta_id IN (${placeholders})`).all(...ids)) {
      if (!itemsPorVenta.has(item.venta_id)) itemsPorVenta.set(item.venta_id, [])
      itemsPorVenta.get(item.venta_id).push(`${item.cantidad}x ${item.nombre}`)
    }
  }

  const usuarioIds = [...new Set(ventas.map((v) => v.usuario_id).filter(Boolean))]
  const usuarios = new Map()
  if (usuarioIds.length) {
    const placeholders = usuarioIds.map(() => '?').join(',')
    for (const u of db.prepare(`SELECT id, username, email, nombre FROM usuarios WHERE id IN (${placeholders})`).all(...usuarioIds)) {
      usuarios.set(u.id, u)
    }
  }

  const esc = (valor) => {
    const texto = String(valor ?? '')
    return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
  }
  const cabecera = ['N°', 'Fecha', 'Usuario', 'Nombre', 'Email', 'Items', 'Cupón', 'Subtotal', 'Descuento 65+', 'Desc. cupón', 'Total', 'Método', 'Cuotas', 'Estado', 'Dirección']
  const lineas = [cabecera.map(esc).join(';')]
  for (const v of ventas) {
    const u = v.usuario_id ? usuarios.get(v.usuario_id) : null
    lineas.push(
      [
        v.id,
        v.fecha,
        u?.username || 'usuario eliminado',
        u?.nombre || '',
        u?.email || '',
        (itemsPorVenta.get(v.id) || []).join(' / '),
        v.cupon_codigo || '',
        Number(v.subtotal).toFixed(2),
        Number(v.descuento_monto).toFixed(2),
        Number(v.cupon_descuento || 0).toFixed(2),
        Number(v.total).toFixed(2),
        v.metodo_pago,
        v.cuotas ?? 1,
        v.estado,
        v.direccion_envio
      ].map(esc).join(';')
    )
  }

  const hoy = new Date()
  const nombre = `ventas-${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}.csv`
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`)
  res.send('\uFEFF' + lineas.join('\r\n'))
})

router.get('/', requerirAdmin, (req, res) => {
  const { estado = '' } = req.query
  const { pagina, porPagina, offset } = paginacion(req.query, 50)
  const filtro = estado ? 'WHERE v.estado = ?' : ''
  const params = estado ? [estado] : []
  const total = db.prepare(`SELECT COUNT(*) AS n FROM ventas v ${filtro}`).get(...params).n
  const filas = db
    .prepare(`SELECT v.* FROM ventas v ${filtro} ORDER BY v.fecha DESC, v.id DESC LIMIT ? OFFSET ?`)
    .all(...params, porPagina, offset)
  res.json({ ventas: detalleVentas(filas), total, pagina, paginas: Math.max(1, Math.ceil(total / porPagina)) })
})

router.get('/:id', requerirAdmin, (req, res) => {
  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id)
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' })
  res.json({ venta: detalleVenta(venta) })
})

router.delete('/:id', requerirAdmin, (req, res) => {
  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id)
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' })
  if (venta.estado === 'anulada') return res.status(400).json({ error: 'La venta ya estaba anulada.' })

  transaction(() => {
    const items = db.prepare('SELECT * FROM venta_items WHERE venta_id = ?').all(venta.id)
    for (const item of items) {
      if (item.producto_id) {
        db.prepare('UPDATE productos SET stock = stock + ? WHERE id = ?').run(item.cantidad, item.producto_id)
      }
    }
    db.prepare("UPDATE ventas SET estado = 'anulada' WHERE id = ?").run(venta.id)
  })

  registrarAuditoria(req.usuario, 'venta-anular', `Venta #${venta.id} por $${venta.total}`)
  res.json({ venta: detalleVenta(db.prepare('SELECT * FROM ventas WHERE id = ?').get(venta.id)) })
})

export function analitica() {
  const pad = (n) => String(n).padStart(2, '0')

  
  const porCategoria = db
    .prepare(
      `SELECT p.categoria AS categoria,
              COALESCE(SUM(vi.precio * vi.cantidad), 0) AS ingresos,
              COALESCE(SUM(vi.cantidad), 0) AS unidades
       FROM venta_items vi
       JOIN ventas v ON v.id = vi.venta_id AND v.estado = 'completada'
       JOIN productos p ON p.id = vi.producto_id
       GROUP BY p.categoria
       ORDER BY ingresos DESC`
    )
    .all()

  
  const catalogoPorCategoria = db
    .prepare('SELECT categoria, COUNT(*) AS cantidad FROM productos WHERE activo = 1 GROUP BY categoria ORDER BY cantidad DESC')
    .all()

  
  const ventasPorEstado = db
    .prepare('SELECT estado, COUNT(*) AS cantidad, COALESCE(SUM(total), 0) AS total FROM ventas GROUP BY estado')
    .all()

  
  const topProductos = db
    .prepare(
      `SELECT vi.nombre AS nombre,
              COALESCE(SUM(vi.cantidad), 0) AS unidades,
              COALESCE(SUM(vi.precio * vi.cantidad), 0) AS ingresos
       FROM venta_items vi
       JOIN ventas v ON v.id = vi.venta_id AND v.estado = 'completada'
       GROUP BY vi.nombre
       ORDER BY unidades DESC
       LIMIT 8`
    )
    .all()

  
  const filas14 = db
    .prepare(
      `SELECT date(fecha) AS dia,
              COALESCE(SUM(total), 0) AS ingresos,
              COUNT(*) AS cantidad,
              COALESCE(SUM(descuento_monto), 0) AS descuentos
       FROM ventas
       WHERE estado = 'completada' AND fecha >= datetime('now', 'localtime', '-13 days', 'start of day')
       GROUP BY date(fecha)`
    )
    .all()
  const porDia = new Map(filas14.map((r) => [r.dia, r]))
  const ventasPorDia = []
  const hoy = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(hoy)
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const fila = porDia.get(key)
    ventasPorDia.push({
      dia: key,
      etiqueta: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`,
      ingresos: fila ? Number(fila.ingresos) : 0,
      cantidad: fila ? fila.cantidad : 0,
      descuentos: fila ? Number(fila.descuentos) : 0
    })
  }

  
  const sinStock = db.prepare('SELECT COUNT(*) AS n FROM productos WHERE activo = 1 AND stock = 0').get().n
  const stockBajo = db.prepare('SELECT COUNT(*) AS n FROM productos WHERE activo = 1 AND stock BETWEEN 1 AND 5').get().n
  const stockOk = db.prepare('SELECT COUNT(*) AS n FROM productos WHERE activo = 1 AND stock > 5').get().n

  return {
    porCategoria,
    catalogoPorCategoria,
    ventasPorEstado,
    topProductos,
    ventasPorDia,
    stock: { sinStock, stockBajo, stockOk }
  }
}

export function estadisticas() {
  const resumen = db
    .prepare(
      `SELECT COALESCE(SUM(total), 0) AS ingresos,
              COUNT(*) AS cantidad_ventas,
              COALESCE(SUM(CASE WHEN descuento_pct > 0 THEN 1 ELSE 0 END), 0) AS ventas_con_descuento
       FROM ventas WHERE estado = 'completada'`
    )
    .get()
  const unidades = db
    .prepare("SELECT COALESCE(SUM(cantidad), 0) AS n FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id WHERE v.estado = 'completada'")
    .get().n

  return {
    ingresos: Number(Number(resumen.ingresos).toFixed(2)),
    cantidad_ventas: resumen.cantidad_ventas,
    unidades_vendidas: unidades,
    productos: db.prepare('SELECT COUNT(*) AS n FROM productos WHERE activo = 1').get().n,
    stock_bajo: db.prepare('SELECT COUNT(*) AS n FROM productos WHERE activo = 1 AND stock <= 5').get().n,
    clientes: db.prepare('SELECT COUNT(*) AS n FROM clientes').get().n,
    usuarios: db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n,
    ventas_con_descuento: resumen.ventas_con_descuento
  }
}

export default router

