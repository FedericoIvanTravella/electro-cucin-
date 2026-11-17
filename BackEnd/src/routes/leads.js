import { Router } from 'express'
import { db } from '../db.js'

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

router.post('/newsletter', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email) || email.length > 120) {
    return res.status(400).json({ error: 'Ingresá un correo válido.' })
  }
  try {
    db.prepare('INSERT INTO newsletter (email) VALUES (?)').run(email)
    return res.status(201).json({ ok: true, mensaje: '¡Gracias por suscribirte! Te vamos a escribir cuando haya novedades.' })
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE')) {
      return res.json({ ok: true, mensaje: 'Ya estás suscripto. ¡Gracias!' })
    }
    throw error
  }
})

router.post('/avisos', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const productoId = Number(req.body?.producto_id)
  if (!EMAIL_RE.test(email) || email.length > 120) {
    return res.status(400).json({ error: 'Ingresá un correo válido.' })
  }
  if (!Number.isInteger(productoId) || productoId < 1) {
    return res.status(400).json({ error: 'Producto inválido.' })
  }
  const producto = db.prepare('SELECT id, nombre, stock FROM productos WHERE id = ?').get(productoId)
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado.' })
  if (producto.stock > 0) {
    return res.json({ ok: true, mensaje: 'El producto ya tiene stock. ¡Aprovechalo!' })
  }
  try {
    db.prepare('INSERT INTO avisos_stock (producto_id, email) VALUES (?, ?)').run(productoId, email)
    return res.status(201).json({ ok: true, mensaje: `Te avisamos a ${email} cuando vuelva ${producto.nombre}.` })
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE')) {
      return res.json({ ok: true, mensaje: `Ya tenemos tu correo agendado para ${producto.nombre}.` })
    }
    throw error
  }
})

export default router
