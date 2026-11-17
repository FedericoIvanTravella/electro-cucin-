import { randomBytes } from 'node:crypto'

const MAX_INTENTOS = 5
const VENTANA_MS = 15 * 60 * 1000 
const BLOQUEO_MS = 15 * 60 * 1000 
const MAX_ENTRADAS = 500 

const intentos = new Map() 

export function minutosBloqueo(clave) {
  const registro = intentos.get(clave)
  if (!registro) return 0
  const ahora = Date.now()
  if (registro.bloqueado_hasta && registro.bloqueado_hasta > ahora) {
    return Math.ceil((registro.bloqueado_hasta - ahora) / 60000)
  }
  return 0
}

export function registrarFallo(clave) {
  if (intentos.size >= MAX_ENTRADAS) purgarIntentosViejos()
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

export function limpiarIntentos(clave) {
  intentos.delete(clave)
}

export function purgarIntentosViejos() {
  const ahora = Date.now()
  for (const [clave, registro] of intentos) {
    const bloqueoVigente = registro.bloqueado_hasta && registro.bloqueado_hasta > ahora
    const ventanaVencida = ahora - registro.primer_intento > VENTANA_MS
    if (!bloqueoVigente && ventanaVencida) intentos.delete(clave)
  }
  
  if (intentos.size > MAX_ENTRADAS) {
    const ordenadas = [...intentos.entries()].sort((a, b) => a[1].primer_intento - b[1].primer_intento)
    for (const [clave] of ordenadas.slice(0, intentos.size - MAX_ENTRADAS)) {
      intentos.delete(clave)
    }
  }
  return intentos.size
}

const CONTRASENAS_COMUNES = new Set([
  '123456', '12345678', '123456789', '1234567890', 'password', 'contraseña',
  'qwerty', 'qwerty123', 'abc123', '111111', '000000', 'iloveyou', 'admin',
  'admin123', 'admin23', 'electro', 'cucine', 'federico', '1234567', '654321',
  'asdf1234', 'password1', 'bienvenido', 'argentina', 'gato1234'
])

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

export function generarCsrf() {
  return randomBytes(24).toString('hex')
}

