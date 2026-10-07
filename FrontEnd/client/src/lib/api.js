const BASE = '/api'

export function getToken() {
  return localStorage.getItem('ec_token')
}

export function setToken(token) {
  if (token) localStorage.setItem('ec_token', token)
  else localStorage.removeItem('ec_token')
}

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const sesion = token ?? getToken()
  if (sesion) headers.Authorization = `Bearer ${sesion}`

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
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
