import { Router } from 'express'
import { randomBytes, createHash } from 'node:crypto'
import bcrypt from 'bcrypt'
import { db, validarFechaNacimiento, registrarAuditoria, transaction } from '../db.js'
import {
  crearSesion,
  requerirAuth,
  usuarioPublico,
  cerrarSesion,
  revocarSesiones,
  obtenerUsuario,
  COOKIE_SESION,
  COOKIE_CSRF
} from '../auth.js'
import {
  validarContrasena,
  minutosBloqueo,
  registrarFallo,
  limpiarIntentos,
  generarCsrf
} from '../seguridad.js'
import { enviarRecuperacion } from '../correo.js'

const router = Router()

const DUMMY_HASH = '$2b$10$C6UzMDM.H6dfI/f/IKcEeO7ZBk5Jq0MPj0vBhGMGWGd7K4U0HfzWe'

const esProduccion = process.env.NODE_ENV === 'production'
const BASE_COOKIE = { sameSite: 'lax', secure: esProduccion, path: '/' }
const UN_DIA_MS = 24 * 60 * 60 * 1000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex')

function tokenValido(token) {
  if (!token) return null
  const fila = db.prepare('SELECT * FROM recuperaciones WHERE token_hash = ?').get(hashToken(token))
  if (!fila || fila.usado) return null
  if (Date.parse(fila.expira_en) <= Date.now()) return null
  return fila
}

function ponerCookies(res, token, dias) {
  res.cookie(COOKIE_SESION, token, {
    ...BASE_COOKIE,
    httpOnly: true,
    maxAge: dias * UN_DIA_MS
  })
  res.cookie(COOKIE_CSRF, generarCsrf(), {
    ...BASE_COOKIE,
    httpOnly: false,
    maxAge: dias * UN_DIA_MS
  })
}

function limpiarCookies(res) {
  res.clearCookie(COOKIE_SESION, { ...BASE_COOKIE, httpOnly: true })
  res.clearCookie(COOKIE_CSRF, { ...BASE_COOKIE, httpOnly: false })
}

router.post('/register', (req, res) => {
  const { username, password, nombre, email = '', fecha_nacimiento = '' } = req.body || {}

  if (!username || !password || !nombre || !email) {
    return res.status(400).json({ error: 'Usuario, contraseña, nombre y email son obligatorios.' })
  }
  if (!/^[\w.-]{3,30}$/u.test(String(username).trim())) {
    return res.status(400).json({ error: 'El usuario solo puede tener letras, números, ".", "_" y "-" (3 a 30 caracteres).' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'El email es obligatorio y debe tener un formato válido.' })
  }
  const errorPassword = validarContrasena(password, String(username).trim())
  if (errorPassword) {
    return res.status(400).json({ error: errorPassword })
  }
  const errorNacimiento = validarFechaNacimiento(fecha_nacimiento)
  if (errorNacimiento) {
    return res.status(400).json({ error: errorNacimiento })
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
  ponerCookies(res, sesion.token, sesion.dias)
  registrarAuditoria(usuario, 'registro', `Nueva cuenta: ${usuario.username}`)
  res.status(201).json({ usuario: usuarioPublico(usuario) })
})

router.post('/login', (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) {
    return res.status(400).json({ error: 'Ingresá usuario y contraseña.' })
  }

  const clave = `${req.ip}|${String(username).trim().toLowerCase()}`
  const minutos = minutosBloqueo(clave)
  if (minutos > 0) {
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Probá de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'}.`
    })
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(String(username).trim())
  
  
  
  const coincide = bcrypt.compareSync(String(password), usuario?.password ?? DUMMY_HASH)
  if (!usuario || !coincide) {
    registrarFallo(clave)
    registrarAuditoria(null, 'login-fallido', `Usuario intentado: ${String(username).trim()}`)
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' })
  }

  limpiarIntentos(clave)
  const sesion = crearSesion(usuario.id)
  ponerCookies(res, sesion.token, sesion.dias)
  registrarAuditoria(usuario, 'login', `Inicio de sesión de ${usuario.username}`)
  res.json({ usuario: usuarioPublico(usuario) })
})

router.get('/recuperar/verificar', (req, res) => {
  res.json({ valido: Boolean(tokenValido(req.query?.token)) })
})

router.post('/recuperar', async (req, res) => {
  const email = String(req.body?.email || '').trim()
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Ingresá un email válido.' })
  }

  // Respuesta genérica siempre: no revelamos si el email está registrado.
  const mensaje =
    'Si el email está registrado, te enviamos un enlace para restablecer la contraseña. Revisá también la carpeta de spam.'

  const usuario = db.prepare('SELECT * FROM usuarios WHERE lower(email) = lower(?)').get(email)
  if (!usuario) return res.json({ mensaje })

  const ultima = db
    .prepare('SELECT creado_en FROM recuperaciones WHERE usuario_id = ? ORDER BY id DESC LIMIT 1')
    .get(usuario.id)
  if (ultima && Date.now() - Date.parse(ultima.creado_en) < 60 * 1000) {
    return res.json({ mensaje })
  }

  const token = randomBytes(32).toString('hex')
  const ahora = Date.now()
  transaction(() => {
    // Un solo enlace vigente por cuenta.
    db.prepare('UPDATE recuperaciones SET usado = 1 WHERE usuario_id = ? AND usado = 0').run(usuario.id)
    db.prepare(
      'INSERT INTO recuperaciones (usuario_id, token_hash, creado_en, expira_en) VALUES (?, ?, ?, ?)'
    ).run(usuario.id, hashToken(token), new Date(ahora).toISOString(), new Date(ahora + 60 * 60 * 1000).toISOString())
    db.prepare(
      `DELETE FROM recuperaciones
       WHERE usuario_id = ? AND usado = 1
         AND id <> (SELECT MAX(id) FROM recuperaciones WHERE usuario_id = ?)`
    ).run(usuario.id, usuario.id)
  })

  await enviarRecuperacion(usuario, token)
  registrarAuditoria(usuario, 'recuperacion-solicitada', 'Enlace de recuperación enviado por email')
  res.json({ mensaje })
})

router.post('/restablecer', (req, res) => {
  const { token, password } = req.body || {}
  if (!token || !password) {
    return res.status(400).json({ error: 'Faltan datos para restablecer la contraseña.' })
  }

  const fila = tokenValido(token)
  if (!fila) {
    return res.status(400).json({ error: 'El enlace no es válido o venció. Pedí uno nuevo.' })
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(fila.usuario_id)
  if (!usuario) {
    return res.status(400).json({ error: 'El enlace no es válido o venció. Pedí uno nuevo.' })
  }

  const errorPassword = validarContrasena(password, usuario.username)
  if (errorPassword) return res.status(400).json({ error: errorPassword })

  const hash = bcrypt.hashSync(String(password), 10)
  transaction(() => {
    db.prepare('UPDATE usuarios SET password = ? WHERE id = ?').run(hash, usuario.id)
    db.prepare('UPDATE recuperaciones SET usado = 1 WHERE id = ?').run(fila.id)
    // Cerramos todas las sesiones abiertas por seguridad.
    db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(usuario.id)
  })

  registrarAuditoria(usuario, 'password-restablecida', 'Contraseña cambiada con enlace de recuperación')
  res.json({ ok: true, mensaje: 'Contraseña actualizada. Ya podés ingresar con la nueva.' })
})

router.post('/logout', (req, res) => {
  const token = req.cookies?.[COOKIE_SESION]
  const usuario = token ? obtenerUsuario(token) : null
  cerrarSesion(token)
  limpiarCookies(res)
  if (usuario) registrarAuditoria(usuario, 'logout', `Cierre de sesión de ${usuario.username}`)
  res.json({ ok: true })
})

router.post('/revocar-sesiones', requerirAuth, (req, res) => {
  const cantidad = revocarSesiones(req.usuario.id)
  limpiarCookies(res)
  registrarAuditoria(req.usuario, 'revocar-sesiones', `${cantidad} sesiones cerradas`)
  res.json({ ok: true, sesionesCerradas: cantidad })
})

router.get('/me', (req, res) => {
  const token = req.cookies?.[COOKIE_SESION]
  const usuario = token ? obtenerUsuario(token) : null
  res.json({ usuario: usuario ? usuarioPublico(usuario) : null })
})

export default router

