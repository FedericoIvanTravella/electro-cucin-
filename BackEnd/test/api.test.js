import { test } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'

process.env.EC_DB_PATH = ':memory:'
process.env.ADMIN_USERNAME = 'admin'
process.env.ADMIN_PASSWORD = 'claveAdmin123'
process.env.NODE_ENV = 'test'
process.env.SMTP_HOST = ''
process.env.SMTP_USER = ''
process.env.SMTP_PASS = ''
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
    .send({ username: 'clientenormal', password: 'claveSegura123', nombre: 'Cliente Normal', email: 'clientenormal@test.com' })
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
    .send({ username: 'usuariotest', password: 'claveSegura123', nombre: 'Usuario Test', email: 'usuariotest@test.com', fecha_nacimiento: '1990-05-10' })
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

test('resenas: pide compra previa, alta y listado', async () => {
  const { cookies } = await login('usuariotest', 'claveSegura123')
  const csrf = cookies.ec_csrf
  const cookie = headerCookie(cookies)

  const sinComprar = await request(app)
    .post('/api/productos/99/resenas')
    .set('Cookie', cookie)
    .set('X-CSRF-Token', csrf)
    .send({ estrellas: 5, comentario: 'Excelente producto de prueba' })
  if (sinComprar.status !== 403) throw new Error('no-comprador: ' + sinComprar.status)

  const compra = await request(app)
    .post('/api/ventas')
    .set('Cookie', cookie)
    .set('X-CSRF-Token', csrf)
    .send({ items: [{ producto_id: 2, cantidad: 1 }], metodo_pago: 'tarjeta', cuotas: 1 })
  if (compra.status !== 201) throw new Error('compra: ' + JSON.stringify(compra.body))

  const alta = await request(app)
    .post('/api/productos/2/resenas')
    .set('Cookie', cookie)
    .set('X-CSRF-Token', csrf)
    .send({ estrellas: 5, comentario: 'Muy buena licuadora, silenciosa.' })
  if (alta.status !== 201) throw new Error('reseña: ' + JSON.stringify(alta.body))

  const lista = await request(app).get('/api/productos/2/resenas')
  if (lista.status !== 200 || lista.body.resumen.cantidad < 1) throw new Error('listado: ' + JSON.stringify(lista.body.resumen))
  if (lista.body.resumen.promedio !== 5) throw new Error('promedio: ' + lista.body.resumen.promedio)
})

test('cupon de descuento aplicado a la venta', async () => {
  const { cookies } = await login('usuariotest', 'claveSegura123')
  const cookie = headerCookie(cookies)

  const validar = await request(app)
    .post('/api/cupones/validar')
    .set('Cookie', cookie)
    .set('X-CSRF-Token', cookies.ec_csrf)
    .send({ codigo: 'CUCINE5', subtotal: 100000 })
  if (validar.status !== 200 || validar.body.descuento !== 5000) {
    throw new Error('validar: ' + JSON.stringify(validar.body))
  }

  const compra = await request(app)
    .post('/api/ventas')
    .set('Cookie', cookie)
    .set('X-CSRF-Token', cookies.ec_csrf)
    .send({ items: [{ producto_id: 3, cantidad: 1 }], metodo_pago: 'tarjeta', cupon_codigo: 'CUCINE5' })
  if (compra.status !== 201) throw new Error('compra: ' + JSON.stringify(compra.body))
  const v = compra.body.venta
  if (v.cupon_codigo !== 'CUCINE5' || v.cupon_descuento !== 5000) {
    throw new Error('cupon no persistido: ' + JSON.stringify({ cupon_codigo: v.cupon_codigo, cupon_descuento: v.cupon_descuento }))
  }

  const invalido = await request(app)
    .post('/api/cupones/validar')
    .set('Cookie', cookie)
    .set('X-CSRF-Token', cookies.ec_csrf)
    .send({ codigo: 'NOEXISTE', subtotal: 1000 })
  if (invalido.status !== 404) throw new Error('cupon invalido: ' + invalido.status)
})

test('newsletter: suscripción idempotente', async () => {
  const csrf = await obtenerCsrf()
  const correo = 'suscr@test.com'
  const alta = await request(app)
    .post('/api/newsletter')
    .set('Cookie', `ec_csrf=${csrf}`)
    .set('X-CSRF-Token', csrf)
    .send({ email: correo })
  if (alta.status !== 201) throw new Error('alta: ' + alta.status)

  const repetido = await request(app)
    .post('/api/newsletter')
    .set('Cookie', `ec_csrf=${csrf}`)
    .set('X-CSRF-Token', csrf)
    .send({ email: correo })
  if (repetido.status !== 200) throw new Error('repetido: ' + repetido.status)

  const invalido = await request(app)
    .post('/api/newsletter')
    .set('Cookie', `ec_csrf=${csrf}`)
    .set('X-CSRF-Token', csrf)
    .send({ email: 'no-es-mail' })
  if (invalido.status !== 400) throw new Error('invalido: ' + invalido.status)
})

test('avisos de vuelta de stock: se agenda y luego se avisa al restaurar', async () => {
  const admin = await login('admin', 'claveAdmin123')
  const cookieAdmin = headerCookie(admin.cookies)

  const ponerCero = await request(app)
    .patch('/api/productos/4/stock')
    .set('Cookie', cookieAdmin)
    .set('X-CSRF-Token', admin.cookies.ec_csrf)
    .send({ stock: 0 })
  if (ponerCero.status !== 200) throw new Error('stock 0: ' + ponerCero.status)

  const csrf = await obtenerCsrf()
  const avisar = await request(app)
    .post('/api/avisos')
    .set('Cookie', `ec_csrf=${csrf}`)
    .set('X-CSRF-Token', csrf)
    .send({ producto_id: 4, email: 'aviso@test.com' })
  if (avisar.status !== 201) throw new Error('aviso: ' + JSON.stringify(avisar.body))

  const restaurar = await request(app)
    .patch('/api/productos/4/stock')
    .set('Cookie', cookieAdmin)
    .set('X-CSRF-Token', admin.cookies.ec_csrf)
    .send({ stock: 9 })
  if (restaurar.status !== 200) throw new Error('stock 9: ' + restaurar.status)

  const archivos = fs.readdirSync(OUTBOX).filter((f) => f.endsWith('.json'))
  const mails = archivos.map((f) => JSON.parse(fs.readFileSync(path.join(OUTBOX, f), 'utf8')))
  const avisoMail = mails.find((m) => m.para === 'aviso@test.com')
  if (!avisoMail) throw new Error('no se encontró el correo de aviso de vuelta de stock')
  if (!avisoMail.asunto.includes('Volvió')) throw new Error('asunto inesperado: ' + avisoMail.asunto)
})

test('cupones admin: crear, usos_max agotable, desactivar y eliminar', async () => {
  const admin = await login('admin', 'claveAdmin123')
  const cookieAdmin = headerCookie(admin.cookies)

  const crear = await request(app)
    .post('/api/cupones')
    .set('Cookie', cookieAdmin)
    .set('X-CSRF-Token', admin.cookies.ec_csrf)
    .send({ codigo: 'USO1', tipo: 'porcentaje', valor: 15, usos_max: 1 })
  if (crear.status !== 201) throw new Error('crear: ' + JSON.stringify(crear.body))

  const duplicado = await request(app)
    .post('/api/cupones')
    .set('Cookie', cookieAdmin)
    .set('X-CSRF-Token', admin.cookies.ec_csrf)
    .send({ codigo: 'USO1', tipo: 'fijo', valor: 1000 })
  if (duplicado.status !== 409) throw new Error('duplicado: ' + duplicado.status)

  const lista = await request(app).get('/api/cupones').set('Cookie', cookieAdmin)
  if (!lista.body.cupones.some((c) => c.codigo === 'USO1')) throw new Error('no aparece en listado')

  const comprador = await login('compradormail', 'claveSegura123')
  const cookieComprador = headerCookie(comprador.cookies)
  const csrfComprador = comprador.cookies.ec_csrf

  const validarPrimero = await request(app)
    .post('/api/cupones/validar')
    .set('Cookie', cookieComprador)
    .set('X-CSRF-Token', csrfComprador)
    .send({ codigo: 'USO1', subtotal: 100000 })
  if (validarPrimero.status !== 200) throw new Error('validar USO1: ' + JSON.stringify(validarPrimero.body))

  const compra = await request(app)
    .post('/api/ventas')
    .set('Cookie', cookieComprador)
    .set('X-CSRF-Token', csrfComprador)
    .send({ items: [{ producto_id: 5, cantidad: 1 }], metodo_pago: 'tarjeta', cupon_codigo: 'USO1' })
  if (compra.status !== 201) throw new Error('compra con USO1: ' + JSON.stringify(compra.body))

  const validarAgotado = await request(app)
    .post('/api/cupones/validar')
    .set('Cookie', cookieComprador)
    .set('X-CSRF-Token', csrfComprador)
    .send({ codigo: 'USO1', subtotal: 100000 })
  if (validarAgotado.status !== 404) throw new Error('USO1 agotado: ' + validarAgotado.status)

  const borrar = await request(app)
    .delete('/api/cupones/USO1')
    .set('Cookie', cookieAdmin)
    .set('X-CSRF-Token', admin.cookies.ec_csrf)
  if (borrar.status !== 200) throw new Error('borrar: ' + borrar.status)
})

test('estado de venta: completada -> en_camino -> entregado y mails', async () => {
  const { cookies } = await login('compradormail', 'claveSegura123')
  const compra = await request(app)
    .post('/api/ventas')
    .set('Cookie', headerCookie(cookies))
    .set('X-CSRF-Token', cookies.ec_csrf)
    .send({ items: [{ producto_id: 6, cantidad: 1 }], metodo_pago: 'tarjeta', cuotas: 1 })
  if (compra.status !== 201) throw new Error('compra: ' + JSON.stringify(compra.body))
  const ventaId = compra.body.venta.id

  const admin = await login('admin', 'claveAdmin123')
  const cookieAdmin = headerCookie(admin.cookies)

  const invalida = await request(app)
    .patch(`/api/ventas/${ventaId}/estado`)
    .set('Cookie', cookieAdmin)
    .set('X-CSRF-Token', admin.cookies.ec_csrf)
    .send({ estado: 'entregado' })
  if (invalida.status !== 400) throw new Error('salto invalido: ' + invalida.status)

  const camino = await request(app)
    .patch(`/api/ventas/${ventaId}/estado`)
    .set('Cookie', cookieAdmin)
    .set('X-CSRF-Token', admin.cookies.ec_csrf)
    .send({ estado: 'en_camino' })
  if (camino.status !== 200 || camino.body.venta.estado !== 'en_camino') {
    throw new Error('en_camino: ' + JSON.stringify(camino.body))
  }

  const entregado = await request(app)
    .patch(`/api/ventas/${ventaId}/estado`)
    .set('Cookie', cookieAdmin)
    .set('X-CSRF-Token', admin.cookies.ec_csrf)
    .send({ estado: 'entregado' })
  if (entregado.status !== 200 || entregado.body.venta.estado !== 'entregado') {
    throw new Error('entregado: ' + JSON.stringify(entregado.body))
  }

  const archivos = fs.readdirSync(OUTBOX).filter((f) => f.endsWith('.json'))
  const mails = archivos.map((f) => JSON.parse(fs.readFileSync(path.join(OUTBOX, f), 'utf8')))
  const caminoMail = mails.find((m) => m.para === 'comprador@test.com' && m.asunto.includes('en camino'))
  const entregadoMail = mails.find((m) => m.para === 'comprador@test.com' && m.asunto.includes('entregado'))
  if (!caminoMail || !entregadoMail) {
    throw new Error('faltan mails de estado: ' + mails.map((m) => m.asunto).join(' | '))
  }
})

test('cupón con usos_max agotado ya no se puede aplicar en la venta', async () => {
  const admin = await login('admin', 'claveAdmin123')
  const cookieAdmin = headerCookie(admin.cookies)
  await request(app)
    .post('/api/cupones')
    .set('Cookie', cookieAdmin)
    .set('X-CSRF-Token', admin.cookies.ec_csrf)
    .send({ codigo: 'USOMAX', tipo: 'porcentaje', valor: 10, usos_max: 1 })

  const comprador = await login('compradormail', 'claveSegura123')
  const cookieComprador = headerCookie(comprador.cookies)
  const csrfComprador = comprador.cookies.ec_csrf

  const compra1 = await request(app)
    .post('/api/ventas')
    .set('Cookie', cookieComprador)
    .set('X-CSRF-Token', csrfComprador)
    .send({ items: [{ producto_id: 7, cantidad: 1 }], metodo_pago: 'tarjeta', cupon_codigo: 'USOMAX' })
  if (compra1.status !== 201) throw new Error('primera compra: ' + JSON.stringify(compra1.body))

  const compra2 = await request(app)
    .post('/api/ventas')
    .set('Cookie', cookieComprador)
    .set('X-CSRF-Token', csrfComprador)
    .send({ items: [{ producto_id: 7, cantidad: 1 }], metodo_pago: 'tarjeta', cupon_codigo: 'USOMAX' })
  if (compra2.status !== 400) throw new Error('segunda compra con cupón agotado: ' + compra2.status)
})

test('export.csv es admin-only y devuelve CSV con BOM', async () => {
  const cliente = await login('usuariotest', 'claveSegura123')
  const prohibido = await request(app).get('/api/ventas/export.csv').set('Cookie', headerCookie(cliente.cookies))
  if (prohibido.status !== 403) throw new Error('cliente: ' + prohibido.status)

  const admin = await login('admin', 'claveAdmin123')
  const ok = await request(app).get('/api/ventas/export.csv').set('Cookie', headerCookie(admin.cookies))
  if (ok.status !== 200) throw new Error('admin: ' + ok.status)
  if (!String(ok.headers['content-type']).includes('text/csv')) throw new Error('content-type: ' + ok.headers['content-type'])
  if (!ok.text.includes('N°') || !ok.text.includes('Total')) throw new Error('falta cabecera')
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

test('carrito de la cuenta: requiere sesión, guarda y rehidrata con stock real', async () => {
  const anonimo = await request(app).get('/api/carrito')
  if (anonimo.status !== 401) throw new Error('anónimo: ' + anonimo.status)

  const cliente = await login('usuariotest', 'claveSegura123')
  const cookie = headerCookie(cliente.cookies)
  const csrf = cliente.cookies.ec_csrf

  const vacio = await request(app).get('/api/carrito').set('Cookie', cookie)
  if (vacio.status !== 200 || !Array.isArray(vacio.body.items)) throw new Error('GET inicial: ' + vacio.status)

  // Cantidad mayor al stock y un producto inexistente: el servidor debe corregirlos.
  const guardar = await request(app)
    .put('/api/carrito')
    .set('Cookie', cookie)
    .set('X-CSRF-Token', csrf)
    .send({ items: [{ producto_id: 6, cantidad: 5000 }, { producto_id: 999999, cantidad: 1 }] })
  if (guardar.status !== 200) throw new Error('PUT: ' + guardar.status)
  const producto6 = guardar.body.items.find((i) => i.producto_id === 6)
  if (!producto6) throw new Error('no rehidrató el producto 6')
  if (producto6.cantidad > producto6.stock) throw new Error('cantidad supera el stock')
  if (guardar.body.items.some((i) => i.producto_id === 999999)) throw new Error('quedó el producto inexistente')
  if (typeof producto6.precio !== 'number' || !producto6.nombre) throw new Error('faltan datos del catálogo')

  // Otra sesión (dispositivo distinto) ve el mismo carrito.
  const otraSesion = await login('usuariotest', 'claveSegura123')
  const rerecuperado = await request(app).get('/api/carrito').set('Cookie', headerCookie(otraSesion.cookies))
  if (rerecuperado.body.items.find((i) => i.producto_id === 6)?.cantidad !== producto6.cantidad) {
    throw new Error('el carrito no persistió entre sesiones')
  }

  // Vaciar desde el cliente también limpia lo guardado.
  const vaciar = await request(app)
    .put('/api/carrito')
    .set('Cookie', cookie)
    .set('X-CSRF-Token', csrf)
    .send({ items: [] })
  if (vaciar.status !== 200 || vaciar.body.items.length !== 0) throw new Error('vaciar: ' + vaciar.status)
})

test('recuperación de contraseña: mail, token de un solo uso y cierre de sesiones', async () => {
  const email = 'recupero@example.com'
  const csrfRegistro = await obtenerCsrf()
  const alta = await request(app)
    .post('/api/auth/register')
    .set('Cookie', `ec_csrf=${csrfRegistro}`)
    .set('X-CSRF-Token', csrfRegistro)
    .send({
      username: 'recupero',
      password: 'claveVieja123',
      nombre: 'Recupero Prueba',
      email,
      fecha_nacimiento: '1990-01-01'
    })
  if (alta.status !== 201) throw new Error('registro: ' + alta.status)

  const csrf = await obtenerCsrf()
  const pedido = await request(app)
    .post('/api/auth/recuperar')
    .set('Cookie', `ec_csrf=${csrf}`)
    .set('X-CSRF-Token', csrf)
    .send({ email })
  if (pedido.status !== 200) throw new Error('recuperar: ' + pedido.status)

  // Un email inexistente recibe exactamente la misma respuesta (no se filtra si existe).
  const inexistente = await request(app)
    .post('/api/auth/recuperar')
    .set('Cookie', `ec_csrf=${csrf}`)
    .set('X-CSRF-Token', csrf)
    .send({ email: 'nadie@example.com' })
  if (inexistente.status !== 200 || inexistente.body.mensaje !== pedido.body.mensaje) {
    throw new Error('la respuesta revela si el email existe')
  }

  const invalido = await request(app)
    .post('/api/auth/recuperar')
    .set('Cookie', `ec_csrf=${csrf}`)
    .set('X-CSRF-Token', csrf)
    .send({ email: 'no-es-un-email' })
  if (invalido.status !== 400) throw new Error('aceptó un email inválido')

  // El enlace se escribe en el outbox de correo.
  let token = ''
  for (const archivo of fs.readdirSync(OUTBOX).filter((f) => f.endsWith('.json'))) {
    const contenido = JSON.parse(fs.readFileSync(path.join(OUTBOX, archivo), 'utf8'))
    if (contenido.para !== email) continue
    const encontrado = String(contenido.texto || '').match(/token=([a-f0-9]{64})/)
    if (encontrado) token = encontrado[1]
  }
  if (!token) throw new Error('no se encontró el token en el correo')

  const verificar = await request(app).get('/api/auth/recuperar/verificar').query({ token })
  if (!verificar.body.valido) throw new Error('el token recién emitido debería ser válido')

  const debil = await request(app)
    .post('/api/auth/restablecer')
    .set('Cookie', `ec_csrf=${csrf}`)
    .set('X-CSRF-Token', csrf)
    .send({ token, password: '123' })
  if (debil.status !== 400) throw new Error('aceptó una contraseña débil')

  const cambio = await request(app)
    .post('/api/auth/restablecer')
    .set('Cookie', `ec_csrf=${csrf}`)
    .set('X-CSRF-Token', csrf)
    .send({ token, password: 'claveNueva456' })
  if (cambio.status !== 200) throw new Error('restablecer: ' + cambio.status)

  const vieja = await login('recupero', 'claveVieja123')
  if (vieja.status !== 401) throw new Error('la contraseña vieja sigue funcionando')
  const nueva = await login('recupero', 'claveNueva456')
  if (nueva.status !== 200) throw new Error('la contraseña nueva no funciona')

  const repetido = await request(app)
    .post('/api/auth/restablecer')
    .set('Cookie', `ec_csrf=${csrf}`)
    .set('X-CSRF-Token', csrf)
    .send({ token, password: 'otraClave789' })
  if (repetido.status !== 400) throw new Error('el token se pudo reutilizar')
})
