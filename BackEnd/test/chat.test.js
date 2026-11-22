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
process.env.EC_OUTBOX_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ec-chat-'))

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

async function csrf() {
  const res = await request(app).get('/api/saludo')
  return cookiesDe(res).ec_csrf
}

async function preguntar(mensaje, cookie = '') {
  const token = await csrf()
  const sinCsrf = cookie
    .split(';')
    .map((par) => par.trim())
    .filter((par) => par && !par.startsWith('ec_csrf='))
    .join('; ')
  const peticion = request(app)
    .post('/api/chat')
    .set('Cookie', `${sinCsrf}${sinCsrf ? '; ' : ''}ec_csrf=${token}`)
    .set('X-CSRF-Token', token)
    .send({ mensaje })
  return peticion
}

test('POST /api/chat exige token CSRF', async () => {
  const res = await request(app).post('/api/chat').send({ mensaje: 'hola' })
  if (res.status !== 403) throw new Error('status ' + res.status)
})

test('POST /api/chat rechaza mensajes vacíos', async () => {
  const res = await preguntar('   ')
  if (res.status !== 400) throw new Error('status ' + res.status)
})

test('Nero saluda y ofrece sugerencias', async () => {
  const res = await preguntar('Hola')
  if (res.status !== 200 || res.body.tipo !== 'saludo') throw new Error(JSON.stringify(res.body))
  if (!res.body.respuesta.includes('Nero')) throw new Error('Falta el nombre del asistente')
  if (!Array.isArray(res.body.sugerencias) || res.body.sugerencias.length < 2) throw new Error('Sin sugerencias')
})

test('Nero responde envíos con el umbral real de $150.000', async () => {
  const res = await preguntar('¿Cuánto cuesta el envío?')
  if (res.body.tipo !== 'envio') throw new Error(JSON.stringify(res.body))
  if (!res.body.respuesta.includes('$150.000')) throw new Error('No mencionó el envío gratis')
})

test('Nero responde devoluciones con el plazo real de 30 días', async () => {
  const res = await preguntar('¿Cómo hago una devolución?')
  if (res.body.tipo !== 'devolucion') throw new Error(JSON.stringify(res.body))
  if (!res.body.respuesta.includes('30 días')) throw new Error('No mencionó el plazo')
})

test('Nero busca productos reales y devuelve enlaces al detalle', async () => {
  const res = await preguntar('¿Qué freidoras de aire tenés?')
  if (res.body.tipo !== 'producto') throw new Error(JSON.stringify(res.body))
  if (!res.body.productos.length) throw new Error('Sin productos')
  const producto = res.body.productos[0]
  if (!producto.url.startsWith('/producto/') || !producto.nombre || !producto.precio) {
    throw new Error('Producto mal formado: ' + JSON.stringify(producto))
  }
})

test('Nero pide login para consultar pedidos de un visitante', async () => {
  const res = await preguntar('¿Dónde está mi pedido?')
  if (res.body.tipo !== 'pedido') throw new Error(JSON.stringify(res.body))
  if (!res.body.enlaces.some((enlace) => enlace.to === '/login')) throw new Error('Sin enlace de login')
})

test('Usuario autenticado puede consultar sus pedidos', async () => {
  const token = await csrf()
  const registro = await request(app)
    .post('/api/auth/register')
    .set('Cookie', `ec_csrf=${token}`)
    .set('X-CSRF-Token', token)
    .send({
      username: 'clientechat',
      password: 'claveSegura123',
      nombre: 'Cliente Chat',
      email: 'clientechat@test.com'
    })
  if (registro.status !== 201) throw new Error('registro: ' + JSON.stringify(registro.body))
  const cookie = Object.entries(cookiesDe(registro))
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join('; ')

  const res = await preguntar('Muéstrame el estado de mis pedidos', cookie)
  if (res.body.tipo !== 'pedido') throw new Error(JSON.stringify(res.body))
  if (!res.body.respuesta.includes('compras registradas')) throw new Error(JSON.stringify(res.body))
})

test('Preguntas no comprendidas se guardan para revisar en el panel admin', async () => {
  const res = await preguntar('¿Cuál es el clima en Marte?')
  if (res.body.tipo !== 'desconocida' || !res.body.humano) throw new Error(JSON.stringify(res.body))

  const token = await csrf()
  const login = await request(app)
    .post('/api/auth/login')
    .set('Cookie', `ec_csrf=${token}`)
    .set('X-CSRF-Token', token)
    .send({ username: 'admin', password: 'claveAdmin123' })
  const cookie = Object.entries(cookiesDe(login))
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join('; ')

  const revisadas = await request(app).get('/api/chat/preguntas').set('Cookie', cookie)
  if (revisadas.status !== 200) throw new Error('status ' + revisadas.status)
  if (!revisadas.body.preguntas.some((p) => p.pregunta.includes('Marte'))) {
    throw new Error('La pregunta no quedó registrada')
  }
})

test('Nero ofrece WhatsApp cuando pide hablar con una persona', async () => {
  const res = await preguntar('Quiero hablar con una persona')
  if (res.body.tipo !== 'humano' || !res.body.humano) throw new Error(JSON.stringify(res.body))
  if (!res.body.enlaces?.[0]?.to.includes('wa.me/')) throw new Error('Falta el enlace de WhatsApp')
})
