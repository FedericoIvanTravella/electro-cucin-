import { Router } from 'express'
import bcrypt from 'bcrypt'
import { db, validarFechaNacimiento, registrarAuditoria } from '../db.js'
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

const router = Router()

const DUMMY_HASH = '$2b$10$C6UzMDM.H6dfI/f/IKcEeO7ZBk5Jq0MPj0vBhGMGWGd7K4U0HfzWe'

const esProduccion = process.env.NODE_ENV === 'production'
const BASE_COOKIE = { sameSite: 'lax', secure: esProduccion, path: '/' }
const UN_DIA_MS = 24 * 60 * 60 * 1000

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

  if (!username || !password || !nombre) {
    return res.status(400).json({ error: 'Usuario, contraseña y nombre son obligatorios.' })
  }
  if (!/^[\w.-]{3,30}$/u.test(String(username).trim())) {
    return res.status(400).json({ error: 'El usuario solo puede tener letras, números, ".", "_" y "-" (3 a 30 caracteres).' })
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'El email no tiene un formato válido.' })
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

