// =====================================================================
// Tests de la API (node:test + supertest).
// Usa una base EN MEMORIA (EC_DB_PATH=:memory:) sembrada automáticamente:
// superusuario ADMIN_USERNAME/ADMIN_PASSWORD de prueba + 100 productos.
// =====================================================================
import { test } from 'node:test'
import request from 'supertest'

process.env.EC_DB_PATH = ':memory:'
process.env.ADMIN_USERNAME = 'admin'
process.env.ADMIN_PASSWORD = 'claveAdmin123'
process.env.NODE_ENV = 'test'

const { default: app } = await import('../index.js')

// ---------- Utilidades de cookies / CSRF ----------
function cookiesDe(res) {
  const header = res.headers['set-cookie'] || []
  const lista = Array.isArray(header) ? header : [header]
  const mapa = {}
  for (const cookie of lista) {
    const [par] = cookie.split(';')
    const idx = par.indexOf('=')
    mapa[par.slice(0, idx).trim()] = par.slice(idx + 1).trim()
  }
  return mapa
}

function headerCookie(mapa) {
  return Object.entries(mapa)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

async function obtenerCsrf() {
  const res = await request(app).get('/api/saludo')
  return cookiesDe(res).ec_csrf
}

// Login de un usuario; devuelve { cookies, csrf, usuario }
async function login(username, password) {
  const csrf = await obtenerCsrf()
  const res = await request(app)
    .post('/api/auth/login')
    .set('Cookie', `ec_csrf=${csrf}`)
    .set('X-CSRF-Token', csrf)
    .send({ username, password })
  const cookies = { ...cookiesDe(res) }
  return { status: res.status, body: res.body, cookies, csrf }
}

// ---------- Salud ----------
test('GET /api/saludo responde 200', async () => {
  const res = await request(app).get('/api/saludo')
  if (res.status !== 200) throw new Error('status ' + res.status)
})

test('GET /api/salud hace ping a la DB', async () => {
  const res = await request(app).get('/api/salud')
  if (res.status !== 200 || res.body.db !== 'ok') throw new Error(JSON.stringify(res.body))
})

// ---------- Catálogo público ----------
test('GET /api/productos lista el catálogo sembrado (100 productos activos)', async () => {
  const res = await request(app).get('/api/productos')
  if (res.status !== 200) throw new Error('status ' + res.status)
  if (res.body.productos.length !== 100) throw new Error('productos: ' + res.body.productos.length)
  if (res.body.productos.some((p) => !p.activo)) throw new Error('Hay ocultos en la lista pública')
  if (!res.body.categorias?.includes('Cocción')) throw new Error('Faltan categorías')
})

test('GET /api/productos?admin=1 sin sesión responde 401 (no filtra ocultos)', async () => {
  const res = await request(app).get('/api/productos?admin=1')
  if (res.status !== 401) throw new Error('status ' + res.status)
})

test('GET /api/productos?admin=1 con rol cliente responde 403', async () => {
  const csrf = await obtenerCsrf()
  const reg = await request(app)
    .post('/api/auth/register')
    .set('Cookie', `ec_csrf=${csrf}`)
    .set('X-CSRF-Token', csrf)
    .send({ username: 'clientenormal', password: 'claveSegura123', nombre: 'Cliente Normal' })
  if (reg.status !== 201) throw new Error('registro: ' + JSON.stringify(reg.body))
  const cookieCliente = headerCookie({ ...cookiesDe(reg) })
  const res = await request(app).get('/api/productos?admin=1').set('Cookie', cookieCliente)
  if (res.status !== 403) throw new Error('status ' + res.status)
})

test('GET /api/productos?admin=1 como admin devuelve también los ocultos', async () => {
  const { cookies } = await login('admin', 'claveAdmin123')
  const res = await request(app).get('/api/productos?admin=1').set('Cookie', headerCookie(cookies))
  if (res.status !== 200) throw new Error('status ' + res.status)
})

// ---------- CSRF ----------
test('POST sin token CSRF responde 403', async () => {
  const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'claveAdmin123' })
  if (res.status !== 403) throw new Error('status ' + res.status)
})

// ---------- Auth ----------
test('registro + /me + login + logout funcionan', async () => {
  const csrf = await obtenerCsrf()
  const reg = await request(app)
    .post('/api/auth/register')
    .set('Cookie', `ec_csrf=${csrf}`)
    .set('X-CSRF-Token', csrf)
    .send({ username: 'usuariotest', password: 'claveSegura123', nombre: 'Usuario Test', fecha_nacimiento: '1990-05-10' })
  if (reg.status !== 201) throw new Error('registro: ' + JSON.stringify(reg.body))
  if (reg.body.usuario.username !== 'usuariotest') throw new Error('usuario')
  if (reg.body.usuario.password) throw new Error('La contraseña no debe viajar al cliente')

  const cookieReg = headerCookie(cookiesDe(reg))
  const me = await request(app).get('/api/auth/me').set('Cookie', cookieReg)
  if (me.body.usuario?.username !== 'usuariotest') throw new Error('/me')

  // logout
  const csrfDeLogout = await obtenerCsrf()
  const out = await request(app).post('/api/auth/logout').set('Cookie', `ec_csrf=${csrfDeLogout}`).set('X-CSRF-Token', csrfDeLogout)
  if (out.status !== 200) throw new Error('logout: ' + out.status)

  // login con la misma cuenta
  const { status, body } = await login('usuariotest', 'claveSegura123')
  if (status !== 200 || body.usuario.username !== 'usuariotest') throw new Error('login')
})

test('login con contraseña incorrecta responde 401', async () => {
  const { status } = await login('usuariotest', 'claveIncorrecta9')
  if (status !== 401) throw new Error('status ' + status)
})

// ---------- Ventas ----------
test('comprar descuenta stock y valida método de pago/cuotas', async () => {
  const { cookies } = await login('usuariotest', 'claveSegura123')
  const csrfLogin = cookies.ec_csrf
  const cookieSesion = headerCookie(cookies)

  // Producto 1 tiene 18 unidades en el seed
  const antes = await request(app).get('/api/productos/1')
  const stockAntes = antes.body.producto.stock

  const compra = await request(app)
    .post('/api/ventas')
    .set('Cookie', cookieSesion)
    .set('X-CSRF-Token', csrfLogin)
    .send({ items: [{ producto_id: 1, cantidad: 2 }], metodo_pago: 'tarjeta', cuotas: 3 })
  if (compra.status !== 201) throw new Error('compra: ' + JSON.stringify(compra.body))
  if (compra.body.venta.cuotas !== 3) throw new Error('cuotas no persistidas')

  const despues = await request(app).get('/api/productos/1')
  if (despues.body.producto.stock !== stockAntes - 2) throw new Error('stock no descontado')

  // Método de pago inválido
  const mala = await request(app)
    .post('/api/ventas')
    .set('Cookie', cookieSesion)
    .set('X-CSRF-Token', csrfLogin)
    .send({ items: [{ producto_id: 2, cantidad: 1 }], metodo_pago: 'trueque' })
  if (mala.status !== 400) throw new Error('metodo_pago inválido: ' + mala.status)

  // Más unidades que el stock
  const demasiadas = await request(app)
    .post('/api/ventas')
    .set('Cookie', cookieSesion)
    .set('X-CSRF-Token', csrfLogin)
    .send({ items: [{ producto_id: 4, cantidad: 9999 }], metodo_pago: 'tarjeta' })
  if (demasiadas.status !== 409) throw new Error('stock excedido: ' + demasiadas.status)
})

test('GET /api/stats requiere rol admin', async () => {
  const { cookies } = await login('usuariotest', 'claveSegura123')
  const res = await request(app).get('/api/stats').set('Cookie', headerCookie(cookies))
  if (res.status !== 403) throw new Error('cliente no debe ver stats: ' + res.status)

  const admin = await login('admin', 'claveAdmin123')
  const ok = await request(app).get('/api/stats').set('Cookie', headerCookie(admin.cookies))
  if (ok.status !== 200 || typeof ok.body.stats.ingresos !== 'number') throw new Error('stats admin: ' + ok.status)
  const a = ok.body.analitica
  if (!a || !Array.isArray(a.porCategoria) || !Array.isArray(a.ventasPorDia) || a.ventasPorDia.length !== 14) {
    throw new Error('analitica incompleta: ' + JSON.stringify(Object.keys(a || {})))
  }
  for (const clave of ['catalogoPorCategoria', 'ventasPorEstado', 'topProductos', 'stock']) {
    if (!(clave in a)) throw new Error('falta analitica.' + clave)
  }
})

test('ruta /api inexistente responde 404 JSON', async () => {
  const res = await request(app).get('/api/no-existe')
  if (res.status !== 404) throw new Error('status ' + res.status)
})
