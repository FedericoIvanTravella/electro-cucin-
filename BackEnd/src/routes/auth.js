import { Router } from 'express'
import bcrypt from 'bcrypt'
import { db } from '../db.js'
import { crearSesion, requerirAuth, usuarioPublico } from '../auth.js'

const router = Router()

router.post('/register', (req, res) => {
  const { username, password, nombre, email = '', fecha_nacimiento = '' } = req.body || {}

  if (!username || !password || !nombre) {
    return res.status(400).json({ error: 'Usuario, contraseña y nombre son obligatorios.' })
  }
  if (String(username).trim().length < 3) {
    return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres.' })
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' })
  }
  if (fecha_nacimiento && Number.isNaN(new Date(`${fecha_nacimiento}T00:00:00`).getTime())) {
    return res.status(400).json({ error: 'La fecha de nacimiento no es válida.' })
  }

  const existe = db.prepare('SELECT id FROM usuarios WHERE username = ?').get(String(username).trim())
  if (existe) {
    return res.status(409).json({ error: 'Ese usuario ya está registrado.' })
  }

  const hash = bcrypt.hashSync(String(password), 10)
  const resultado = db
    .prepare('INSERT INTO usuarios (username, password, nombre, email, fecha_nacimiento) VALUES (?, ?, ?, ?, ?)')
    .run(String(username).trim(), hash, String(nombre).trim(), String(email).trim(), String(fecha_nacimiento))

  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(resultado.lastInsertRowid)
  const sesion = crearSesion(usuario.id)
  res.status(201).json({ token: sesion.token, usuario: usuarioPublico(usuario) })
})

router.post('/login', (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) {
    return res.status(400).json({ error: 'Ingresá usuario y contraseña.' })
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(String(username).trim())
  if (!usuario || !bcrypt.compareSync(String(password), usuario.password)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' })
  }

  const sesion = crearSesion(usuario.id)
  res.json({ token: sesion.token, usuario: usuarioPublico(usuario) })
})

router.post('/logout', requerirAuth, (req, res) => {
  db.prepare('DELETE FROM sesiones WHERE token = ?').run(req.token)
  res.json({ ok: true })
})

router.get('/me', requerirAuth, (req, res) => {
  res.json({ usuario: usuarioPublico(req.usuario) })
})

export default router
