import { Router } from 'express'
import { db } from '../db.js'
import { requerirAuth } from '../auth.js'

const router = Router()

const MAX_ITEMS = 50
const MAX_CANTIDAD = 99

// El carrito se guarda como [{producto_id, cantidad}] y se rehidrata desde
// productos en cada lectura: así el precio, el stock y el nombre siempre
// reflejan el catálogo actual (nunca lo que mandó el cliente).
function leerCrudo(usuarioId) {
  const fila = db.prepare('SELECT carrito FROM usuarios WHERE id = ?').get(usuarioId)
  try {
    const items = JSON.parse(fila?.carrito || '[]')
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

function hidratar(items) {
  const obtener = db.prepare(
    `SELECT p.id AS producto_id, p.nombre, p.precio, p.imagen, p.categoria, p.stock
     FROM productos p WHERE p.id = ? AND p.activo = 1`
  )
  const resultado = []
  for (const item of items) {
    const producto = obtener.get(Number(item.producto_id))
    if (!producto) continue
    const stock = Number(producto.stock) || 0
    if (stock <= 0) continue
    const cantidad = Math.min(Math.max(1, Number(item.cantidad) || 1), stock, MAX_CANTIDAD)
    resultado.push({
      ...producto,
      precio: Number(producto.precio),
      stock,
      cantidad
    })
  }
  return resultado
}

function sanear(items) {
  if (!Array.isArray(items)) return []
  const vistos = new Set()
  const limpio = []
  for (const item of items) {
    const id = Number(item?.producto_id)
    const cantidad = Number(item?.cantidad)
    if (!Number.isInteger(id) || id <= 0) continue
    if (vistos.has(id)) continue
    vistos.add(id)
    limpio.push({ producto_id: id, cantidad: Math.min(Math.max(1, cantidad || 1), MAX_CANTIDAD) })
    if (limpio.length >= MAX_ITEMS) break
  }
  return limpio
}

router.get('/', requerirAuth, (req, res) => {
  res.json({ items: hidratar(leerCrudo(req.usuario.id)) })
})

router.put('/', requerirAuth, (req, res) => {
  const items = sanear(req.body?.items)
  db.prepare('UPDATE usuarios SET carrito = ? WHERE id = ?').run(JSON.stringify(items), req.usuario.id)
  res.json({ items: hidratar(items) })
})

export default router
