const BASE = '/api'
const DEMO = import.meta.env.VITE_DEMO === '1'

// Lee una cookie por nombre (el backend expone ec_csrf como cookie legible).
function leerCookie(nombre) {
  const par = document.cookie.split('; ').find((c) => c.startsWith(`${nombre}=`))
  return par ? decodeURIComponent(par.split('=').slice(1).join('=')) : ''
}

// ---------------------------------------------------------------
// Modo demo (GitHub Pages / cualquier hosting estático sin backend):
// responde con un snapshot del catálogo embebido en /demo/productos.json
// y simula las escrituras (cupones COCINA10 / CUCINE5 y un pedido
// confirmado que nunca se envía a ningún lado).
// ---------------------------------------------------------------
let demoCache = null

// Usuario virtual: la tienda entra autenticada con una cuenta ficticia para
// poder recorrer todo el flujo de compra de punta a punta.
const DEMO_USER = {
  id: 999,
  nombre: 'Martín Pereyra',
  username: 'martinpereyra',
  email: 'martin.pereyra@electrocucine.com',
  rol: 'cliente',
  edad: 34,
  descuento: { activo: false }
}

async function cargarDemo() {
  if (demoCache) return demoCache
  const res = await fetch(`${import.meta.env.BASE_URL}demo/productos.json`)
  if (!res.ok) throw new Error('No se pudo cargar el catálogo de la demo.')
  demoCache = await res.json()
  return demoCache
}

function errorStatus(mensaje, status) {
  const error = new Error(mensaje)
  error.status = status
  return error
}

async function apiDemo(path, { method = 'GET', body } = {}) {
  const metodo = String(method).toUpperCase()
  const [ruta, qs] = String(path).split('?')
  const params = new URLSearchParams(qs || '')
  const demo = await cargarDemo()
  const activos = demo.productos.filter((p) => p.activo)

  const matchDetalle = ruta.match(/^\/productos\/(\d+)(\/resenas)?\/?$/)

  if (metodo === 'GET') {
    if (ruta === '/productos' || ruta === '/productos/') {
      let items = activos
      const cat = params.get('categoria')
      if (cat) items = items.filter((p) => p.categoria === cat)
      if (params.get('soloStock') === '1') items = items.filter((p) => Number(p.stock) > 0)
      return { productos: items, categorias: [...new Set(activos.map((p) => p.categoria))] }
    }
    if (ruta === '/productos/populares') {
      const vendidos = [...activos].sort((a, b) => (b.unidades_vendidas || 0) - (a.unidades_vendidas || 0))
      const ids = vendidos.slice(0, 6).map((p) => p.id)
      const vistos = activos.filter((p) => !ids.includes(p.id))
      return { productos: [...vendidos.slice(0, 6), ...vistos].slice(0, 6) }
    }
    if (matchDetalle && !matchDetalle[2]) {
      const producto = activos.find((p) => String(p.id) === matchDetalle[1])
      if (!producto) throw errorStatus('Producto no encontrado.', 404)
      return { producto }
    }
    if (matchDetalle && matchDetalle[2]) {
      return { resenas: demo.resenas.filter((r) => String(r.producto_id) === matchDetalle[1]) }
    }
    if (ruta === '/auth/me') return { usuario: DEMO_USER }
    if (ruta === '/ventas/mias') return { ventas: [] }
    if (ruta === '/newsletter') return { ok: true }
  }

  if (metodo === 'POST') {
    if (ruta === '/cupones/validar') {
      const codigo = String(body?.codigo || '').trim().toUpperCase()
      const subtotal = Number(body?.subtotal || 0)
      if (codigo === 'COCINA10') {
        const descuento = Math.round(subtotal * 0.1 * 100) / 100
        return { cupon: { codigo, tipo: 'porcentaje', valor: 10 }, descuento }
      }
      if (codigo === 'CUCINE5') {
        return { cupon: { codigo, tipo: 'fijo', valor: 5000 }, descuento: Math.min(5000, subtotal) }
      }
      if (codigo === 'NAVIDAD25') {
        const descuento = Math.round(subtotal * 0.25 * 100) / 100
        return { cupon: { codigo, tipo: 'porcentaje', valor: 25 }, descuento }
      }
      throw errorStatus('Cupón no válido.', 404)
    }
    if (ruta === '/ventas') {
      const hoy = new Date()
      const fecha = hoy.toLocaleDateString('es-AR')
      // Reconstruimos el ticket a partir del carrito enviado.
      const lineas = (body?.items || []).map((item, i) => {
        const producto = demo.productos.find((p) => String(p.id) === String(item.producto_id))
        const precio = Number(producto?.precio || 0)
        return {
          id: i + 1,
          cantidad: Number(item.cantidad || 1),
          nombre: producto?.nombre || 'Producto',
          precio
        }
      })
      const subtotal = lineas.reduce((suma, l) => suma + l.precio * l.cantidad, 0)
      const cuponCodigo = String(body?.cupon_codigo || '').trim().toUpperCase()
      let cuponDescuento = 0
      if (cuponCodigo === 'COCINA10') cuponDescuento = Math.round(subtotal * 0.1 * 100) / 100
      else if (cuponCodigo === 'CUCINE5') cuponDescuento = Math.min(5000, subtotal)
      else if (cuponCodigo === 'NAVIDAD25') cuponDescuento = Math.round(subtotal * 0.25 * 100) / 100
      const total = Math.max(0, Number((subtotal - cuponDescuento).toFixed(2)))
      return {
        venta: {
          id: Math.floor(hoy.getTime() / 1000),
          fecha,
          items: lineas,
          subtotal,
          descuento_pct: 0,
          descuento_monto: 0,
          cupon_codigo: cuponDescuento > 0 ? cuponCodigo : '',
          cupon_descuento: cuponDescuento,
          total,
          direccion_envio: body?.direccion_envio || '',
          cuotas: Number(body?.cuotas || 1),
          demo: true
        }
      }
    }
    if (ruta === '/newsletter') return { ok: true }
    if (ruta === '/avisos') return { ok: true }
    if (ruta === '/auth/login' || ruta === '/auth/register' || ruta === '/auth/logout' || ruta === '/auth/revocar-sesiones') {
      return { usuario: DEMO_USER, ok: true }
    }
  }

  throw errorStatus('La demo no persiste cambios.', 0)
}

// Realiza una petición a la API. La sesión viaja en una cookie httpOnly
// (por eso "credentials: include"); en los métodos que modifican datos se
// envía además el token CSRF en el header X-CSRF-Token.
// Acepta "signal" para cancelar (AbortController) y evitar carreras.
export async function api(path, { method = 'GET', body, signal } = {}) {
  if (DEMO) {
    return apiDemo(path, { method, body })
  }

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
      signal,
      body: body === undefined ? undefined : JSON.stringify(body)
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new Error('No se pudo conectar con el servidor.', { cause: error })
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
