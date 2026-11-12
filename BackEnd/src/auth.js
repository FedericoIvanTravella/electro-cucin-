// =====================================================================
// SECCIÓN: AUTENTICACIÓN Y SESIONES
// - Las contraseñas NO se guardan en texto plano: se encriptan con
//   bcrypt (interfaz). Eso se maneja en routes/auth.js.
// - Los tokens de sesión se guardan en la DB HASHEADOS con SHA-256:
//   si alguien lee el archivo .db, no obtiene sesiones válidas.
// - Acá se arman los datos "públicos" del usuario (nunca el hash),
//   se crean sesiones con token aleatorio (crypto) y se protegen las
//   rutas que requieren sesión o rol de superusuario.
// =====================================================================
import { randomBytes } from 'node:crypto'
import { db, sha256, calcularEdad, tieneDescuento, PORCENTAJE_DESCUENTO } from './db.js'

const DURACION_SESION_DIAS = 7 // La sesión (token) dura 7 días.

// Nombres de las cookies de sesión (httpOnly) y de CSRF (legible por JS).
export const COOKIE_SESION = 'ec_sesion'
export const COOKIE_CSRF = 'ec_csrf'

// ---------------------- Datos públicos del usuario ----------------------
// Convierte la fila de la DB (que incluye el hash bcrypt) en el objeto
// seguro que recibe el frontend. De paso calcula la edad y si corresponde
// el descuento para mayores de 65.
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

// ---------------------- Sesiones por token ----------------------
// Genera un token aleatorio criptográfico (64 hex), guarda su HASH SHA-256
// en la tabla sesiones con fecha de expiración (+7 días) y devuelve el
// token crudo al frontend (viaja una sola vez en la cookie).
export function crearSesion(usuarioId) {
  const token = randomBytes(32).toString('hex')
  db.prepare(
    "INSERT INTO sesiones (token, usuario_id, expira_en) VALUES (?, ?, datetime('now', '+7 day'))"
  ).run(sha256(token), usuarioId)
  return { token, dias: DURACION_SESION_DIAS }
}

// Busca el usuario dueño de un token mientras la sesión siga vigente.
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

// Cierra una sesión puntual (logout).
export function cerrarSesion(token) {
  if (token) db.prepare('DELETE FROM sesiones WHERE token = ?').run(sha256(token))
}

// Revoca TODAS las sesiones de un usuario ("cerrar sesión en todos
// los dispositivos"). Devuelve cuántas se eliminaron.
export function revocarSesiones(usuarioId) {
  return db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(usuarioId).changes
}

// Lee el token de sesión de la petición (cookie o headers de API).
function tokenDePeticion(req) {
  const header = req.headers.authorization || ''
  return (
    req.cookies?.[COOKIE_SESION] ||
    (header.startsWith('Bearer ') ? header.slice(7) : req.headers['x-session']) ||
    null
  )
}

// ---------------------- Middlewares de protección ----------------------
// requerirAuth: exige una sesión válida. El token se lee de la cookie
// httpOnly "ec_sesion" (o, por compatibilidad con clientes de API, del
// header "Authorization: Bearer <token>"). Si pasa, adjunta req.usuario.
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

// obtenerUsuarioOpcional: como requerirAuth pero nunca corta la petición;
// devuelve el usuario si hay sesión válida o null si no. Para rutas
// públicas que muestran contenido extra a administradores.
export function obtenerUsuarioOpcional(req) {
  return obtenerUsuario(tokenDePeticion(req))
}

// requerirAdmin: como requerirAuth, pero además exige el rol "admin".
export function requerirAdmin(req, res, next) {
  requerirAuth(req, res, (err) => {
    if (err) return
    if (req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Esta sección es exclusiva del superusuario.' })
    }
    next()
  })
}
