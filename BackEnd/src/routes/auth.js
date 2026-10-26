// =====================================================================
// SECCIÓN: REGISTRO, LOGIN, LOGOUT Y SESIÓN ACTUAL
// Encriptado de contraseñas: usa bcrypt.
//   - hashSync(contraseña, 10): "10" es el factor de costo (salt rounds) —
//     cuántas veces se procesa el hash para que sea más lento de forzar.
//   - compareSync(ingresada, hash): verifica la contraseña contra el hash.
//   - El hash NUNCA se devuelve al cliente ni se puede "desencriptar":
//     solo se comparan hashes.
// La sesión viaja en una cookie httpOnly (no accesible por JS), y las
// peticiones que modifican datos exigen además un token CSRF.
// =====================================================================
import { Router } from 'express'
import bcrypt from 'bcrypt'
import { db, validarFechaNacimiento, registrarAuditoria } from '../db.js'
import {
  crearSesion,
  requerirAuth,
  usuarioPublico,
  cerrarSesion,
  revocarSesiones,
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

// ---------------------- Cookies ----------------------
// En producción las cookies van con secure (solo por HTTPS).
const esProduccion = process.env.NODE_ENV === 'production'
const BASE_COOKIE = { sameSite: 'lax', secure: esProduccion, path: '/' }
const UN_DIA_MS = 24 * 60 * 60 * 1000

// Guarda el token de sesión (httpOnly) y un token CSRF (legible por el
// frontend para reenviarlo en el header X-CSRF-Token).
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

// Borra ambas cookies (logout).
function limpiarCookies(res) {
  res.clearCookie(COOKIE_SESION, { ...BASE_COOKIE, httpOnly: true })
  res.clearCookie(COOKIE_CSRF, { ...BASE_COOKIE, httpOnly: false })
}

// ---------------------- POST /api/auth/register · Crear cuenta ----------------------
// Valida los datos (incluida la fortaleza de la contraseña), la encripta
// con bcrypt y guarda al usuario. Deja la sesión iniciada.
router.post('/register', (req, res) => {
  const { username, password, nombre, email = '', fecha_nacimiento = '' } = req.body || {}

  // --- Validaciones básicas ---
  if (!username || !password || !nombre) {
    return res.status(400).json({ error: 'Usuario, contraseña y nombre son obligatorios.' })
  }
  if (String(username).trim().length < 3) {
    return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres.' })
  }
  // --- Política de contraseñas fuertes ---
  const errorPassword = validarContrasena(password, String(username).trim())
  if (errorPassword) {
    return res.status(400).json({ error: errorPassword })
  }
  // --- Validación de edad (máximo 100 años, sin fechas futuras) ---
  const errorNacimiento = validarFechaNacimiento(fecha_nacimiento)
  if (errorNacimiento) {
    return res.status(400).json({ error: errorNacimiento })
  }

  // El nombre de usuario debe ser único.
  const existe = db.prepare('SELECT id FROM usuarios WHERE username = ?').get(String(username).trim())
  if (existe) {
    return res.status(409).json({ error: 'Ese usuario ya está registrado.' })
  }

  // --- ENCRIPTADO DE CONTRASEÑA (bcrypt, 10 rondas de sal) ---
  const hash = bcrypt.hashSync(String(password), 10)

  // --- Alta del usuario en la base ---
  const resultado = db
    .prepare('INSERT INTO usuarios (username, password, nombre, email, fecha_nacimiento) VALUES (?, ?, ?, ?, ?)')
    .run(String(username).trim(), hash, String(nombre).trim(), String(email).trim(), String(fecha_nacimiento))

  // --- Sesión automática al registrarse ---
  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(resultado.lastInsertRowid)
  const sesion = crearSesion(usuario.id)
  ponerCookies(res, sesion.token, sesion.dias)
  registrarAuditoria(usuario, 'registro', `Nueva cuenta: ${usuario.username}`)
  res.status(201).json({ usuario: usuarioPublico(usuario) })
})

// ---------------------- POST /api/auth/login · Iniciar sesión ----------------------
// Verifica usuario y contraseña. Con protección anti fuerza bruta:
// tras varios fallos seguidos, bloquea la IP+usuario por unos minutos.
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
  // compareSync compara la contraseña ingresada contra el hash bcrypt guardado.
  if (!usuario || !bcrypt.compareSync(String(password), usuario.password)) {
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

// ---------------------- POST /api/auth/logout · Cerrar sesión ----------------------
// Borra la sesión actual de la base y limpia las cookies.
router.post('/logout', (req, res) => {
  const token = req.cookies?.[COOKIE_SESION]
  const usuario = token ? db.prepare('SELECT * FROM usuarios WHERE id = (SELECT usuario_id FROM sesiones WHERE token = ?)').get(token) : null
  cerrarSesion(token)
  limpiarCookies(res)
  if (usuario) registrarAuditoria(usuario, 'logout', `Cierre de sesión de ${usuario.username}`)
  res.json({ ok: true })
})

// ---------------------- POST /api/auth/revocar-sesiones · Cerrar en todos lados ----------------------
// Elimina TODAS las sesiones del usuario (por si perdió el dispositivo).
router.post('/revocar-sesiones', requerirAuth, (req, res) => {
  const cantidad = revocarSesiones(req.usuario.id)
  limpiarCookies(res)
  registrarAuditoria(req.usuario, 'revocar-sesiones', `${cantidad} sesiones cerradas`)
  res.json({ ok: true, sesionesCerradas: cantidad })
})

// ---------------------- GET /api/auth/me · Sesión actual ----------------------
// Devuelve el usuario logueado o null. No exige sesión: sirve para que el
// frontend, al cargar, sepa si hay sesión y reciba el token CSRF.
router.get('/me', (req, res) => {
  const token = req.cookies?.[COOKIE_SESION]
  const usuario = token
    ? db
        .prepare(
          `SELECT u.* FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
           WHERE s.token = ? AND s.expira_en > datetime('now')`
        )
        .get(token)
    : null
  res.json({ usuario: usuario ? usuarioPublico(usuario) : null })
})

export default router
