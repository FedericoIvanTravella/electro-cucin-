import { Router } from 'express'
import { db, transaction, tieneDescuento, PORCENTAJE_DESCUENTO, registrarAuditoria } from '../db.js'
import { requerirAuth, requerirAdmin } from '../auth.js'

const router = Router()

// ---------------------- SECCIÓN: VENTAS ----------------------
// arma el detalle completo de una venta: sus ítems + usuario/cliente.
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

// ---------------------- POST /api/ventas · Registrar una compra ----------------------
// Requiere sesión. Valida stock, calcula el descuento de 65+, guarda la
// cabecera + ítems y descuenta el stock, todo dentro de UNA transacción.
router.post('/', requerirAuth, (req, res) => {
  const { items, metodo_pago = 'tarjeta', cliente_id = null, direccion_envio = '' } = req.body || {}

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El carrito estÃ¡ vacÃ­o.' })
  }

  // --- Descuento 65+ y cálculo del subtotal ---
  const descuentoActivo = tieneDescuento(req.usuario)
  const descuento_pct = descuentoActivo ? PORCENTAJE_DESCUENTO : 0
  const lineas = []
  let subtotal = 0

  // Valida cada producto: que exista, esté activo y tenga stock suficiente.
  for (const item of items) {
    const cantidad = Number(item.cantidad)
    const producto = db.prepare('SELECT * FROM productos WHERE id = ? AND activo = 1').get(item.producto_id)
    if (!producto) {
      return res.status(400).json({ error: `Uno de los productos ya no estÃ¡ disponible.` })
    }
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      return res.status(400).json({ error: `Cantidad invÃ¡lida para ${producto.nombre}.` })
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
  const total = Number((subtotal - descuento_monto).toFixed(2))

  if (cliente_id && !db.prepare('SELECT id FROM clientes WHERE id = ?').get(cliente_id)) {
    return res.status(400).json({ error: 'El cliente indicado no existe.' })
  }

  // --- Insert de cabecera + ítems + descuento de stock (todo o nada) ---
  const resultado = transaction(() => {
    const venta = db
      .prepare(
        `INSERT INTO ventas (usuario_id, cliente_id, subtotal, descuento_pct, descuento_monto, total, metodo_pago, direccion_envio)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.usuario.id,
        cliente_id ?? null,
        subtotal,
        descuento_pct,
        descuento_monto,
        total,
        metodo_pago,
        direccion_envio
      )

    const ventaId = venta.lastInsertRowid
    const itemStmt = db.prepare(
      'INSERT INTO venta_items (venta_id, producto_id, nombre, precio, cantidad) VALUES (?, ?, ?, ?, ?)'
    )
    const stockStmt = db.prepare('UPDATE productos SET stock = stock - ? WHERE id = ?')
    for (const { producto, cantidad } of lineas) {
      itemStmt.run(ventaId, producto.id, producto.nombre, producto.precio, cantidad)
      stockStmt.run(cantidad, producto.id)
    }
    return ventaId
  })

  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(resultado)
  registrarAuditoria(req.usuario, 'venta', `Venta #${venta.id} por $${total}`)
  res.status(201).json({ venta: detalleVenta(venta) })
})

// ---------------------- GET /api/ventas/mias · Mis compras (cliente) ----------------------
router.get('/mias', requerirAuth, (req, res) => {
  const ventas = db
    .prepare('SELECT * FROM ventas WHERE usuario_id = ? ORDER BY fecha DESC')
    .all(req.usuario.id)
    .map(detalleVenta)
  res.json({ ventas })
})

// ---------------------- GET /api/ventas · Todas (admin, con filtro por estado) ----------------------
router.get('/', requerirAdmin, (req, res) => {
  const { estado = '' } = req.query
  const filtros = estado ? 'WHERE v.estado = ?' : ''
  const params = estado ? [estado] : []
  const ventas = db
    .prepare(`SELECT v.* FROM ventas v ${filtros} ORDER BY v.fecha DESC`)
    .all(...params)
    .map(detalleVenta)
  res.json({ ventas })
})

// ---------------------- GET /api/ventas/:id · Detalle de una venta (admin) ----------------------
router.get('/:id', requerirAdmin, (req, res) => {
  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id)
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' })
  res.json({ venta: detalleVenta(venta) })
})

// ---------------------- DELETE /api/ventas/:id · Anular (admin) ----------------------
// "Anula" la venta (estado = 'anulada') y restituye el stock de sus ítems.
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

// ---------------------- Estadísticas (para el panel del superusuario) ----------------------
// Solo suma las ventas "completada" (las anuladas no cuentan).
export function estadisticas() {
  const ventas = db.prepare("SELECT * FROM ventas WHERE estado = 'completada'").all()
  const ingresos = ventas.reduce((acc, v) => acc + v.total, 0)
  const unidades = db
    .prepare("SELECT COALESCE(SUM(cantidad), 0) AS n FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id WHERE v.estado = 'completada'")
    .get().n

  return {
    ingresos: Number(ingresos.toFixed(2)),
    cantidad_ventas: ventas.length,
    unidades_vendidas: unidades,
    productos: db.prepare('SELECT COUNT(*) AS n FROM productos WHERE activo = 1').get().n,
    stock_bajo: db.prepare('SELECT COUNT(*) AS n FROM productos WHERE activo = 1 AND stock <= 5').get().n,
    clientes: db.prepare('SELECT COUNT(*) AS n FROM clientes').get().n,
    usuarios: db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n,
    ventas_con_descuento: ventas.filter((v) => v.descuento_pct > 0).length
  }
}

export default router
