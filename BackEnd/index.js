import './src/env.js' 
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { db, purgarSesionesExpiradas } from './src/db.js'
import { seedInicial } from './src/seed.js'
import authRoutes from './src/routes/auth.js'
import productosRoutes from './src/routes/productos.js'
import clientesRoutes from './src/routes/clientes.js'
import ventasRoutes, { estadisticas, analitica } from './src/routes/ventas.js'
import cuponesRoutes from './src/routes/cupones.js'
import carritoRoutes from './src/routes/carrito.js'
import leadsRoutes from './src/routes/leads.js'
import chatRoutes from './src/routes/chat.js'
import { requerirAdmin, COOKIE_CSRF } from './src/auth.js'
import { generarCsrf, purgarIntentosViejos } from './src/seguridad.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const esPrincipal = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
const app = express()
const PORT = process.env.PORT || 3001 
const esProduccion = process.env.NODE_ENV === 'production'

seedInicial()

if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1)
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginResourcePolicy: { policy: 'same-site' }
  })
)

const origenesPermitidos = (
  process.env.CORS_ORIGINS ||
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

class OrigenNoPermitido extends Error {
  constructor(origen) {
    super(`Origen no permitido por CORS: ${origen}`)
    this.status = 403
  }
}

const corsRestringido = (req, res, next) =>
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true)
      try {
        if (new URL(origin).host === req.headers.host) return cb(null, true)
      } catch { void 0 }
      if (origenesPermitidos.includes(origin)) return cb(null, true)
      cb(new OrigenNoPermitido(origin))
    },
    credentials: true
  })(req, res, next)

app.use('/api', corsRestringido)

app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

const BASE_COOKIE_CSRF = { sameSite: 'lax', secure: esProduccion, path: '/', httpOnly: false }
app.use((req, res, next) => {
  if (!req.cookies?.[COOKIE_CSRF]) {
    res.cookie(COOKIE_CSRF, generarCsrf(), { ...BASE_COOKIE_CSRF, maxAge: 7 * 24 * 60 * 60 * 1000 })
  }
  next()
})

function verificarCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const enviado = req.headers['x-csrf-token']
  if (!enviado || enviado !== req.cookies?.[COOKIE_CSRF]) {
    return res.status(403).json({ error: 'Token de seguridad inválido. Recargá la página e intentá de nuevo.' })
  }
  next()
}

app.get('/api/saludo', (req, res) => {
  res.json({ mensaje: 'API de Electro Cuciné funcionando' })
})

app.get('/api/salud', (req, res) => {
  try {
    db.prepare('SELECT 1').get()
    res.json({ estado: 'ok', db: 'ok', uptime: Math.round(process.uptime()) })
  } catch {
    res.status(503).json({ estado: 'error', db: 'no disponible' })
  }
})

app.use('/api', verificarCsrf)
app.use('/api/auth', authRoutes) 
app.use('/api/productos', productosRoutes) 
app.use('/api/clientes', clientesRoutes) 
app.use('/api/ventas', ventasRoutes)
app.use('/api/cupones', cuponesRoutes)
app.use('/api/carrito', carritoRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api', leadsRoutes) 

app.get('/api/stats', requerirAdmin, (req, res) => {
  res.json({ stats: estadisticas(), analitica: analitica() })
})

app.get('/api/auditoria', requerirAdmin, (req, res) => {
  const registros = db
    .prepare('SELECT * FROM auditoria ORDER BY fecha DESC, id DESC LIMIT 200')
    .all()
  res.json({ registros })
})

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' })
})

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err)
  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 600 ? err.status : 500
  if (status >= 500) console.error(err)
  res.status(status).json({ error: status >= 500 ? 'Error interno del servidor.' : err.message })
})

const dist = path.join(__dirname, '..', 'FrontEnd', 'client', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(dist, 'index.html'))
  })
}

if (esPrincipal) {
  
  const purgadas = purgarSesionesExpiradas()
  if (purgadas > 0) console.log(`[sesiones] ${purgadas} sesiones vencidas eliminadas`)
  const limpieza = setInterval(() => {
    purgarSesionesExpiradas()
    purgarIntentosViejos()
  }, 6 * 60 * 60 * 1000)
  limpieza.unref()

  app.listen(PORT, () => {
    console.log(`Electro Cuciné API escuchando en http://localhost:${PORT}`)
  })
}

export default app
