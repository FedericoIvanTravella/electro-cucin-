// =====================================================================
// SECCIÓN: UTILIDADES DE SEGURIDAD
// - Limitador de intentos de login en memoria (anti fuerza bruta).
// - Política de contraseñas fuertes.
// - Generación de tokens CSRF (patrón "double submit cookie").
// =====================================================================
import { randomBytes } from 'node:crypto'

// ---------------------- Rate limit de login ----------------------
// Guarda los intentos fallidos por clave (IP + usuario). Al superar el
// máximo, la clave queda bloqueada durante una ventana de tiempo.
const MAX_INTENTOS = 5
const VENTANA_MS = 15 * 60 * 1000 // 15 minutos
const BLOQUEO_MS = 15 * 60 * 1000 // 15 minutos de bloqueo

const intentos = new Map() // clave -> { cantidad, primer_intento, bloqueado_hasta }

// Devuelve los minutos que faltan si la clave está bloqueada, o 0 si no lo está.
export function minutosBloqueo(clave) {
  const registro = intentos.get(clave)
  if (!registro) return 0
  const ahora = Date.now()
  if (registro.bloqueado_hasta && registro.bloqueado_hasta > ahora) {
    return Math.ceil((registro.bloqueado_hasta - ahora) / 60000)
  }
  return 0
}

// Suma un intento fallido; si llega al máximo, bloquea la clave.
export function registrarFallo(clave) {
  const ahora = Date.now()
  let registro = intentos.get(clave)
  if (!registro || ahora - registro.primer_intento > VENTANA_MS) {
    registro = { cantidad: 0, primer_intento: ahora, bloqueado_hasta: 0 }
  }
  registro.cantidad += 1
  if (registro.cantidad >= MAX_INTENTOS) {
    registro.bloqueado_hasta = ahora + BLOQUEO_MS
    registro.cantidad = 0
    registro.primer_intento = ahora
  }
  intentos.set(clave, registro)
}

// Limpia los intentos al iniciar sesión correctamente.
export function limpiarIntentos(clave) {
  intentos.delete(clave)
}

// ---------------------- Política de contraseñas ----------------------
// Contraseñas muy usadas que se rechazan de entrada.
const CONTRASENAS_COMUNES = new Set([
  '123456', '12345678', '123456789', '1234567890', 'password', 'contraseña',
  'qwerty', 'qwerty123', 'abc123', '111111', '000000', 'iloveyou', 'admin',
  'admin123', 'admin23', 'electro', 'cucine', 'federico', '1234567', '654321',
  'asdf1234', 'password1', 'bienvenido', 'argentina', 'gato1234'
])

// Valida la fortaleza de una contraseña. Devuelve '' si está OK
// o un mensaje de error legible si no cumple.
export function validarContrasena(password, username = '') {
  const pw = String(password || '')
  if (pw.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.'
  }
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(pw) || !/[0-9]/.test(pw)) {
    return 'La contraseña debe combinar letras y números.'
  }
  if (CONTRASENAS_COMUNES.has(pw.toLowerCase())) {
    return 'Esa contraseña es demasiado común. Elegí una más difícil de adivinar.'
  }
  if (username && pw.toLowerCase().includes(String(username).toLowerCase())) {
    return 'La contraseña no puede contener tu nombre de usuario.'
  }
  return ''
}

// ---------------------- Token CSRF ----------------------
// Token aleatorio para el patrón double-submit: se guarda en una cookie
// legible por el frontend y debe repetirse en el header X-CSRF-Token.
export function generarCsrf() {
  return randomBytes(24).toString('hex')
}
