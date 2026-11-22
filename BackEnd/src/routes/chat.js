import { Router } from 'express'
import { db } from '../db.js'
import { obtenerUsuarioOpcional, requerirAdmin } from '../auth.js'
import { responderChat } from '../chat.js'

const router = Router()

// Límite simple en memoria: 15 consultas por minuto por IP/sesión.
const LIMITE = 15
const VENTANA_MS = 60 * 1000
const accesos = new Map()

function permite(req, usuario) {
  const clave = `${req.ip || 'ip'}:${usuario?.id || 'invitado'}`
  const ahora = Date.now()
  const recientes = (accesos.get(clave) || []).filter((momento) => ahora - momento < VENTANA_MS)
  if (recientes.length >= LIMITE) {
    accesos.set(clave, recientes)
    return false
  }
  recientes.push(ahora)
  accesos.set(clave, recientes)
  if (accesos.size > 500) {
    for (const [otraClave, momentos] of accesos) {
      if (!momentos.some((momento) => ahora - momento < VENTANA_MS)) accesos.delete(otraClave)
    }
  }
  return true
}

router.post('/', (req, res) => {
  const mensaje = String(req.body?.mensaje || '').trim().slice(0, 500)
  if (!mensaje) {
    return res.status(400).json({ error: 'Escribí una consulta para que Nero pueda ayudarte.' })
  }

  const usuario = obtenerUsuarioOpcional(req)
  if (!permite(req, usuario)) {
    return res.status(429).json({
      respuesta: 'Estoy respondiendo muchas consultas seguidas. Esperá un minuto o escribinos por WhatsApp.',
      tipo: 'limite',
      productos: [],
      enlaces: [],
      sugerencias: [],
      humano: true
    })
  }

  const salida = responderChat(mensaje, usuario)

  // Guardamos lo que no supo responder para alimentar el FAQ más adelante.
  if (salida.tipo === 'desconocida') {
    db.prepare('INSERT INTO chat_preguntas (pregunta, usuario_id) VALUES (?, ?)').run(
      mensaje,
      usuario?.id ?? null
    )
  }

  res.json(salida)
})

router.get('/preguntas', requerirAdmin, (req, res) => {
  const preguntas = db
    .prepare(
      `SELECT p.id, p.pregunta, p.fecha, p.respondida, u.username
       FROM chat_preguntas p
       LEFT JOIN usuarios u ON u.id = p.usuario_id
       ORDER BY p.fecha DESC, p.id DESC
       LIMIT 100`
    )
    .all()
  res.json({ preguntas })
})

export default router
