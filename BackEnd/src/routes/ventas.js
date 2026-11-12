import { Router } from 'express'
import { db, transaction, tieneDescuento, PORCENTAJE_DESCUENTO, registrarAuditoria } from '../db.js'
import { requerirAuth, requerirAdmin } from '../auth.js'

const router = Router()

// ---------------------- SECCIÓN: VENTAS ----------------------
const METODOS_PAGO = ['tarjeta', 'efectivo', 'transferencia', 'mercado_pago']
const CUOTAS_VALIDAS = [1, 3, 6, 12]

// arma el detalle completo de UNA venta: sus ítems + usuario/cliente.
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

// Versión EN LOTE de detalleVenta: resuelve ítems/usuarios/clientes de N
// ventas con 3 queries en total (evita el N+1 del panel admin).
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

// Normaliza page/por_pagina con límites seguros.
function paginacion(query, porDefecto = 50, maximo = 200) {
  const pagina = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const porPagina = Math.min(maximo, Math.max(1, Number.parseInt(query.por_pagina, 10) || porDefecto))
  return { pagina, porPagina, offset: (pagina - 1) * porPagina }
}

// ---------------------- POST /api/ventas · Registrar una compra ----------------------
// Requiere sesión. Valida stock, calcula el descuento de 65+, guarda la
// cabecera + ítems y descuenta el stock, todo dentro de UNA transacción.
router.post('/', requerirAuth, (req, res) => {
  const { items, metodo_pago = 'tarjeta', cuotas = 1, cliente_id = null, direccion_envio = '' } = req.body || {}

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El carrito está vacío.' })
  }

  // --- Método de pago y cuotas: solo valores conocidos ---
  const metodo = METODOS_PAGO.includes(metodo_pago) ? metodo_pago : null
  if (!metodo) {
    return res.status(400).json({ error: `Método de pago inválido. Opciones: ${METODOS_PAGO.join(', ')}.` })
  }
  const cuotasNum = Number(cuotas)
  if (!Number.isInteger(cuotasNum) || !CUOTAS_VALIDAS.includes(cuotasNum)) {
    return res.status(400).json({ error: `Cuotas inválidas. Opciones: ${CUOTAS_VALIDAS.join(', ')}.` })
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
  const total = Number((subtotal - descuento_monto).toFixed(2))

  if (cliente_id && !db.prepare('SELECT id FROM clientes WHERE id = ?').get(cliente_id)) {
    return res.status(400).json({ error: 'El cliente indicado no existe.' })
  }

  // --- Insert de cabecera + ítems + descuento de stock (todo o nada) ---
  let ventaId
  try {
    ventaId = transaction(() => {
      const venta = db
        .prepare(
          `INSERT INTO ventas (usuario_id, cliente_id, subtotal, descuento_pct, descuento_monto, total, metodo_pago, direccion_envio, cuotas)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
          cuotasNum
        )

      const id = venta.lastInsertRowid
      const itemStmt = db.prepare(
        'INSERT INTO venta_items (venta_id, producto_id, nombre, precio, cantidad) VALUES (?, ?, ?, ?, ?)'
      )
      // UPDATE condicionado: si otro proceso comió el stock entre la validación
      // y la escritura, .changes === 0 y se aborta toda la transacción.
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
  registrarAuditoria(req.usuario, 'venta', `Venta #${venta.id} por $${total}`)
  res.status(201).json({ venta: detalleVenta(venta) })
})

// ---------------------- GET /api/ventas/mias · Mis compras (cliente) ----------------------
router.get('/mias', requerirAuth, (req, res) => {
  const { pagina, porPagina, offset } = paginacion(req.query, 50)
  const total = db.prepare('SELECT COUNT(*) AS n FROM ventas WHERE usuario_id = ?').get(req.usuario.id).n
  const ventas = detalleVentas(
    db.prepare('SELECT * FROM ventas WHERE usuario_id = ? ORDER BY fecha DESC LIMIT ? OFFSET ?').all(req.usuario.id, porPagina, offset)
  )
  res.json({ ventas, total, pagina, paginas: Math.max(1, Math.ceil(total / porPagina)) })
})

// ---------------------- GET /api/ventas · Todas (admin, filtro por estado + paginación) ----------------------
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
// Calcula TODO en SQL (sin cargar la tabla completa en memoria).
// Solo suma las ventas "completada" (las anuladas no cuentan).
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
