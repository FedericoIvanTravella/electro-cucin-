const BASE = '/api'

// Lee una cookie por nombre (el backend expone ec_csrf como cookie legible).
function leerCookie(nombre) {
  const par = document.cookie.split('; ').find((c) => c.startsWith(`${nombre}=`))
  return par ? decodeURIComponent(par.split('=').slice(1).join('=')) : ''
}

// Realiza una petición a la API. La sesión viaja en una cookie httpOnly
// (por eso "credentials: include"); en los métodos que modifican datos se
// envía además el token CSRF en el header X-CSRF-Token.
export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const metodo = method.toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(metodo)) {
    headers['X-CSRF-Token'] = leerCookie('ec_csrf')
  }

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body)
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor.')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.error || `Error ${res.status}`)
    error.status = res.status
    error.data = data
    throw error
  }
  return data
}
