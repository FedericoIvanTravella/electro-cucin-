import { randomBytes } from 'node:crypto'
import { db, sha256, calcularEdad, tieneDescuento, PORCENTAJE_DESCUENTO } from './db.js'

const DURACION_SESION_DIAS = 7 

export const COOKIE_SESION = 'ec_sesion'
export const COOKIE_CSRF = 'ec_csrf'

export function usuarioPublico(usuario) {
  const edad = calcularEdad(usuario.fecha_nacimiento)
  const descuento = tieneDescuento(usuario)
  return {
    id: usuario.id,
    username: usuario.username,
    nombre: usuario.nombre,
    email: usuario.email,
    fecha_nacimiento: usuario.fecha_nacimiento,
    rol: usuario.rol,
    edad,
    descuento: {
      activo: descuento,
      porcentaje: descuento ? PORCENTAJE_DESCUENTO : 0
    }
  }
}

export function crearSesion(usuarioId) {
  const token = randomBytes(32).toString('hex')
  db.prepare(
    "INSERT INTO sesiones (token, usuario_id, expira_en) VALUES (?, ?, datetime('now', '+7 day'))"
  ).run(sha256(token), usuarioId)
  return { token, dias: DURACION_SESION_DIAS }
}

export function obtenerUsuario(token) {
  if (!token) return null
  const fila = db
    .prepare(
      `SELECT u.* FROM sesiones s
       JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token = ? AND s.expira_en > datetime('now')`
    )
    .get(sha256(token))
  return fila || null
}

export function cerrarSesion(token) {
  if (token) db.prepare('DELETE FROM sesiones WHERE token = ?').run(sha256(token))
}

export function revocarSesiones(usuarioId) {
  return db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(usuarioId).changes
}

function tokenDePeticion(req) {
  const header = req.headers.authorization || ''
  return (
    req.cookies?.[COOKIE_SESION] ||
    (header.startsWith('Bearer ') ? header.slice(7) : req.headers['x-session']) ||
    null
  )
}

export function requerirAuth(req, res, next) {
  const token = tokenDePeticion(req)
  const usuario = obtenerUsuario(token)
  if (!usuario) {
    return res.status(401).json({ error: 'Debés iniciar sesión para continuar.' })
  }
  req.usuario = usuario
  req.token = token
  next()
}

export function obtenerUsuarioOpcional(req) {
  return obtenerUsuario(tokenDePeticion(req))
}

export function requerirAdmin(req, res, next) {
  requerirAuth(req, res, (err) => {
    if (err) return
    if (req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Esta sección es exclusiva del superusuario.' })
    }
    next()
  })
}
