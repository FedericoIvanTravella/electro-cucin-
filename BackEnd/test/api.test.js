import { test } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'

process.env.EC_DB_PATH = ':memory:'
process.env.ADMIN_USERNAME = 'admin'
process.env.ADMIN_PASSWORD = 'claveAdmin123'
process.env.NODE_ENV = 'test'
const OUTBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'ec-outbox-'))
process.env.EC_OUTBOX_DIR = OUTBOX

const { default: app } = await import('../index.js')

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

test('GET /api/saludo responde 200', async () => {
  const res = await request(app).get('/api/saludo')
  if (res.status !== 200) throw new Error('status ' + res.status)
})

test('GET /api/salud hace ping a la DB', async () => {
  const res = await request(app).get('/api/salud')
  if (res.status !== 200 || res.body.db !== 'ok') throw new Error(JSON.stringify(res.body))
})

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

test('POST sin token CSRF responde 403', async () => {
  const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'claveAdmin123' })
  if (res.status !== 403) throw new Error('status ' + res.status)
})

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

  
  const csrfDeLogout = await obtenerCsrf()
  const out = await request(app).post('/api/auth/logout').set('Cookie', `ec_csrf=${csrfDeLogout}`).set('X-CSRF-Token', csrfDeLogout)
  if (out.status !== 200) throw new Error('logout: ' + out.status)

  
  const { status, body } = await login('usuariotest', 'claveSegura123')
  if (status !== 200 || body.usuario.username !== 'usuariotest') throw new Error('login')
})

test('login con contraseña incorrecta responde 401', async () => {
  const { status } = await login('usuariotest', 'claveIncorrecta9')
  if (status !== 401) throw new Error('status ' + status)
})

test('comprar descuenta stock y valida método de pago/cuotas', async () => {
  const { cookies } = await login('usuariotest', 'claveSegura123')
  const csrfLogin = cookies.ec_csrf
  const cookieSesion = headerCookie(cookies)

  
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

  
  const mala = await request(app)
    .post('/api/ventas')
    .set('Cookie', cookieSesion)
    .set('X-CSRF-Token', csrfLogin)
    .send({ items: [{ producto_id: 2, cantidad: 1 }], metodo_pago: 'trueque' })
  if (mala.status !== 400) throw new Error('metodo_pago inválido: ' + mala.status)

  
  const demasiadas = await request(app)
    .post('/api/ventas')
    .set('Cookie', cookieSesion)
    .set('X-CSRF-Token', csrfLogin)
    .send({ items: [{ producto_id: 4, cantidad: 9999 }], metodo_pago: 'tarjeta' })
  if (demasiadas.status !== 409) throw new Error('stock excedido: ' + demasiadas.status)
})

test('compra con email en la cuenta escribe correo de confirmación', async () => {
  const csrf = await obtenerCsrf()
  const reg = await request(app)
    .post('/api/auth/register')
    .set('Cookie', `ec_csrf=${csrf}`)
    .set('X-CSRF-Token', csrf)
    .send({ username: 'compradormail', password: 'claveSegura123', nombre: 'Comprador Mail', email: 'comprador@test.com' })
  if (reg.status !== 201) throw new Error('registro: ' + JSON.stringify(reg.body))
  const cookies = cookiesDe(reg)

  const compra = await request(app)
    .post('/api/ventas')
    .set('Cookie', headerCookie(cookies))
    .set('X-CSRF-Token', cookies.ec_csrf)
    .send({ items: [{ producto_id: 2, cantidad: 1 }], metodo_pago: 'tarjeta', cuotas: 1, email_contacto: '' })
  if (compra.status !== 201) throw new Error('compra: ' + JSON.stringify(compra.body))
  if (!compra.body.correo || compra.body.correo.enviado !== true) {
    throw new Error('no se registró el envío: ' + JSON.stringify(compra.body.correo))
  }

  const archivos = fs.readdirSync(OUTBOX)
  if (archivos.length === 0) throw new Error('outbox vacío')
  const contenido = JSON.parse(fs.readFileSync(path.join(OUTBOX, archivos.sort().at(-1)), 'utf8'))
  if (contenido.para !== 'comprador@test.com') throw new Error('destinatario incorrecto: ' + contenido.para)
  if (!contenido.asunto.includes('Pedido #')) throw new Error('asunto sin número de pedido: ' + contenido.asunto)
  if (!contenido.html.includes('Licuadora')) throw new Error('html sin el producto comprado')
})

test('email_contacto inválido responde 400', async () => {
  const { cookies } = await login('usuariotest', 'claveSegura123')
  const res = await request(app)
    .post('/api/ventas')
    .set('Cookie', headerCookie(cookies))
    .set('X-CSRF-Token', cookies.ec_csrf)
    .send({ items: [{ producto_id: 2, cantidad: 1 }], metodo_pago: 'tarjeta', email_contacto: 'no-es-mail' })
  if (res.status !== 400) throw new Error('status ' + res.status)
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
