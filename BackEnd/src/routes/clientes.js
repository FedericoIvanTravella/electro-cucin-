import { Router } from 'express'
import { db, calcularEdad, registrarAuditoria } from '../db.js'
import { requerirAdmin } from '../auth.js'

const router = Router()

// ---------------------- SECCIÓN: CLIENTES (libreta del superusuario) ----------------------
// Toda la sección requiere que el usuario logueado sea admin.
router.use(requerirAdmin)

// Prepara y valida los campos de un cliente (parcial = solo lo enviado).
function prepararCliente(body, { parcial = false } = {}) {
  const errores = []
  const datos = {}

  if (!parcial || body.nombre !== undefined) {
    if (!String(body.nombre || '').trim()) errores.push('El nombre es obligatorio.')
    datos.nombre = String(body.nombre || '').trim()
  }
  for (const campo of ['email', 'telefono', 'direccion', 'notas']) {
    if (body[campo] !== undefined) datos[campo] = String(body[campo] || '').trim()
  }
  // La fecha de nacimiento es opcional, pero si viene debe ser válida.
  if (body.fecha_nacimiento !== undefined) {
    const fecha = String(body.fecha_nacimiento || '')
    if (fecha && Number.isNaN(new Date(`${fecha}T00:00:00`).getTime())) {
      errores.push('La fecha de nacimiento no es válida.')
    }
    datos.fecha_nacimiento = fecha
  }
  return { errores, datos }
}

// ---------------------- GET /api/clientes · Listar ----------------------
// Con ?q= busca por nombre, email o teléfono. Incluye la edad calculada.
router.get('/', (req, res) => {
  const { q = '' } = req.query
  const params = []
  let where = ''
  if (q) {
    where = 'WHERE nombre LIKE ? OR email LIKE ? OR telefono LIKE ?'
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  const clientes = db
    .prepare(`SELECT * FROM clientes ${where} ORDER BY nombre`)
    .all(...params)
    .map((c) => ({ ...c, edad: calcularEdad(c.fecha_nacimiento) }))
  res.json({ clientes })
})

// ---------------------- GET /api/clientes/:id · Detalle + compras del cliente ----------------------
router.get('/:id', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id)
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado.' })
  const compras = db
    .prepare('SELECT id, fecha, total, estado FROM ventas WHERE cliente_id = ? ORDER BY fecha DESC')
    .all(cliente.id)
  res.json({ cliente: { ...cliente, edad: calcularEdad(cliente.fecha_nacimiento) }, compras })
})

// ---------------------- POST /api/clientes · Crear ----------------------
router.post('/', (req, res) => {
  const { errores, datos } = prepararCliente(req.body || {})
  if (errores.length) return res.status(400).json({ error: errores.join(' ') })

  const resultado = db
    .prepare(
      `INSERT INTO clientes (nombre, email, telefono, direccion, fecha_nacimiento, notas)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      datos.nombre,
      datos.email ?? '',
      datos.telefono ?? '',
      datos.direccion ?? '',
      datos.fecha_nacimiento ?? '',
      datos.notas ?? ''
    )

  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(resultado.lastInsertRowid)
  registrarAuditoria(req.usuario, 'cliente-crear', `#${cliente.id} ${cliente.nombre}`)
  res.status(201).json({ cliente: { ...cliente, edad: calcularEdad(cliente.fecha_nacimiento) } })
})

// ---------------------- PUT /api/clientes/:id · Actualizar ----------------------
router.put('/:id', (req, res) => {
  const actual = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id)
  if (!actual) return res.status(404).json({ error: 'Cliente no encontrado.' })

  const { errores, datos } = prepararCliente({ ...actual, ...(req.body || {}) })
  if (errores.length) return res.status(400).json({ error: errores.join(' ') })

  db.prepare(
    `UPDATE clientes SET nombre = ?, email = ?, telefono = ?, direccion = ?, fecha_nacimiento = ?, notas = ?
     WHERE id = ?`
  ).run(
    datos.nombre,
    datos.email ?? '',
    datos.telefono ?? '',
    datos.direccion ?? '',
    datos.fecha_nacimiento ?? '',
    datos.notas ?? '',
    req.params.id
  )

  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id)
  registrarAuditoria(req.usuario, 'cliente-editar', `#${cliente.id} ${cliente.nombre}`)
  res.json({ cliente: { ...cliente, edad: calcularEdad(cliente.fecha_nacimiento) } })
})

// ---------------------- DELETE /api/clientes/:id · Eliminar ----------------------
router.delete('/:id', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id)
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado.' })
  db.prepare('DELETE FROM clientes WHERE id = ?').run(cliente.id)
  registrarAuditoria(req.usuario, 'cliente-eliminar', `#${cliente.id} ${cliente.nombre}`)
  res.json({ eliminado: true })
})

export default router
