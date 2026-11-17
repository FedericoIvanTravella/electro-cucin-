import { Router } from 'express'
import { db } from '../db.js'
import { requerirAuth } from '../auth.js'

const router = Router()

export function calcularDescuentoCupon(cupon, subtotal) {
  if (!cupon || !cupon.activo) return 0
  if (cupon.tipo === 'porcentaje') return Number(((subtotal * cupon.valor) / 100).toFixed(2))
  return Number(Math.min(cupon.valor, subtotal).toFixed(2))
}

router.post('/validar', requerirAuth, (req, res) => {
  const codigo = String(req.body?.codigo || '').trim().toUpperCase()
  const subtotal = Number(req.body?.subtotal)
  if (!codigo) return res.status(400).json({ error: 'Ingresá un código.' })
  if (!Number.isFinite(subtotal) || subtotal < 0) return res.status(400).json({ error: 'Subtotal inválido.' })

  const cupon = db.prepare('SELECT * FROM cupones WHERE codigo = ?').get(codigo)
  if (!cupon || !cupon.activo) {
    return res.status(404).json({ error: 'Cupón no válido o desactivado.' })
  }
  const descuento = calcularDescuentoCupon(cupon, subtotal)
  res.json({ cupon: { codigo: cupon.codigo, tipo: cupon.tipo, valor: cupon.valor }, descuento })
})

export default router
