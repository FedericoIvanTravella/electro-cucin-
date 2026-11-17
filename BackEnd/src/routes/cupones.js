import { Router } from 'express'
import { db } from '../db.js'
import { requerirAuth, requerirAdmin } from '../auth.js'

const router = Router()

export function calcularDescuentoCupon(cupon, subtotal) {
  if (!cupon || !cupon.activo) return 0
  if (cupon.tipo === 'porcentaje') return Number(((subtotal * cupon.valor) / 100).toFixed(2))
  return Number(Math.min(cupon.valor, subtotal).toFixed(2))
}

export function cuponDisponible(cupon) {
  if (!cupon || !cupon.activo) return false
  if (cupon.usos_max !== null && cupon.usos_max !== undefined && cupon.usos_max > 0 && cupon.usado >= cupon.usos_max) return false
  return true
}

router.post('/validar', requerirAuth, (req, res) => {
  const codigo = String(req.body?.codigo || '').trim().toUpperCase()
  const subtotal = Number(req.body?.subtotal)
  if (!codigo) return res.status(400).json({ error: 'Ingresá un código.' })
  if (!Number.isFinite(subtotal) || subtotal < 0) return res.status(400).json({ error: 'Subtotal inválido.' })

  const cupon = db.prepare('SELECT * FROM cupones WHERE codigo = ?').get(codigo)
  if (!cuponDisponible(cupon)) {
    return res.status(404).json({ error: 'Cupón no válido, vencido o sin usos disponibles.' })
  }
  const descuento = calcularDescuentoCupon(cupon, subtotal)
  res.json({
    cupon: { codigo: cupon.codigo, tipo: cupon.tipo, valor: cupon.valor, usos_max: cupon.usos_max, usado: cupon.usado },
    descuento,
    usosRestantes: cupon.usos_max ? Math.max(0, cupon.usos_max - cupon.usado) : null
  })
})

router.get('/', requerirAdmin, (req, res) => {
  const cupones = db.prepare('SELECT * FROM cupones ORDER BY created_at DESC, codigo').all()
  res.json({ cupones })
})

router.post('/', requerirAdmin, (req, res) => {
  const codigo = String(req.body?.codigo || '').trim().toUpperCase()
  const tipo = String(req.body?.tipo || '')
  const valor = Number(req.body?.valor)
  const usosMaxRaw = req.body?.usos_max
  const usosMax = usosMaxRaw === '' || usosMaxRaw === undefined || usosMaxRaw === null ? null : Number(usosMaxRaw)

  if (!/^[A-Z0-9_-]{3,20}$/.test(codigo)) {
    return res.status(400).json({ error: 'Código inválido: 3-20 caracteres (letras, números, - y _).' })
  }
  if (!['porcentaje', 'fijo'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo inválido: porcentaje o fijo.' })
  }
  if (!Number.isFinite(valor) || valor <= 0) {
    return res.status(400).json({ error: 'Valor inválido: debe ser mayor que 0.' })
  }
  if (tipo === 'porcentaje' && valor > 100) {
    return res.status(400).json({ error: 'El porcentaje no puede ser mayor a 100.' })
  }
  if (usosMax !== null && (!Number.isInteger(usosMax) || usosMax < 1)) {
    return res.status(400).json({ error: 'usos_max debe ser un entero ≥ 1 (o vacío para ilimitado).' })
  }
  if (db.prepare('SELECT codigo FROM cupones WHERE codigo = ?').get(codigo)) {
    return res.status(409).json({ error: 'Ya existe un cupón con ese código.' })
  }

  db.prepare('INSERT INTO cupones (codigo, tipo, valor, usos_max) VALUES (?, ?, ?, ?)').run(codigo, tipo, valor, usosMax)
  const cupon = db.prepare('SELECT * FROM cupones WHERE codigo = ?').get(codigo)
  res.status(201).json({ cupon })
})

router.patch('/:codigo', requerirAdmin, (req, res) => {
  const codigo = String(req.params.codigo || '').trim().toUpperCase()
  const cupon = db.prepare('SELECT * FROM cupones WHERE codigo = ?').get(codigo)
  if (!cupon) return res.status(404).json({ error: 'Cupón no encontrado.' })

  const activo = req.body?.activo === undefined ? cupon.activo : req.body.activo ? 1 : 0
  const usosMaxRaw = req.body?.usos_max
  let usosMax = cupon.usos_max
  if (usosMaxRaw !== undefined) {
    usosMax = usosMaxRaw === '' || usosMaxRaw === null ? null : Number(usosMaxRaw)
    if (usosMax !== null && (!Number.isInteger(usosMax) || usosMax < 1)) {
      return res.status(400).json({ error: 'usos_max debe ser un entero ≥ 1 (o vacío para ilimitado).' })
    }
  }

  db.prepare('UPDATE cupones SET activo = ?, usos_max = ? WHERE codigo = ?').run(activo, usosMax, codigo)
  res.json({ cupon: db.prepare('SELECT * FROM cupones WHERE codigo = ?').get(codigo) })
})

router.delete('/:codigo', requerirAdmin, (req, res) => {
  const codigo = String(req.params.codigo || '').trim().toUpperCase()
  const cupon = db.prepare('SELECT codigo FROM cupones WHERE codigo = ?').get(codigo)
  if (!cupon) return res.status(404).json({ error: 'Cupón no encontrado.' })
  db.prepare('DELETE FROM cupones WHERE codigo = ?').run(codigo)
  res.json({ eliminado: true })
})

export default router
