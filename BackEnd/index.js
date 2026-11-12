// =====================================================================
// Electro Cuciné · BackEnd — PUNTO DE ENTRADA DEL SERVIDOR
// Express monta (1) la API REST bajo /api y (2) sirve la app de
// React ya compilada (carpeta dist del FrontEnd) para producción.
// Exporta `app` para los tests; solo escucha si se ejecuta directamente.
// =====================================================================
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
import ventasRoutes, { estadisticas } from './src/routes/ventas.js'
import { requerirAdmin, COOKIE_CSRF } from './src/auth.js'
import { generarCsrf, purgarIntentosViejos } from './src/seguridad.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const esPrincipal = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
const app = express()
const PORT = process.env.PORT || 3001 // Puerto por defecto de la API.
const esProduccion = process.env.NODE_ENV === 'production'

// Datos iniciales (superusuario desde env + catálogo si está vacío).
seedInicial()

// Detrás de un proxy/reverse proxy (nginx, IIS, Cloudflare), habilitar con
// TRUST_PROXY=1 para que req.ip sea la IP real del cliente (rate limit OK).
if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1)
}

// ---------------------- Seguridad de cabeceras ----------------------
// helmet() agrega headers de protección (CSP, nosniff, etc.) y elimina
// el header "X-Powered-By" que revelaba que usamos Express.
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

// ---------------------- CORS restringido ----------------------
// Solo se permite el origen del propio sitio (frontend o dominio real).
// Se personaliza con la variable de entorno CORS_ORIGINS separada por comas.
const origenesPermitidos = (
  process.env.CORS_ORIGINS ||
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

// Error específico para que el middleware de errores responda 403 y no 500.
class OrigenNoPermitido extends Error {
  constructor(origen) {
    super(`Origen no permitido por CORS: ${origen}`)
    this.status = 403
  }
}

app.use(
  cors({
    origin(origin, cb) {
      // Sin Origin (mismo sitio, curl) o si está en la lista, se permite.
      if (!origin || origenesPermitidos.includes(origin)) return cb(null, true)
      cb(new OrigenNoPermitido(origin))
    },
    credentials: true
  })
)

// ---------------------- Middlewares globales ----------------------
// express.json(): convierte el body de las peticiones a JSON (límite 100kb).
// cookieParser(): lee las cookies de la petición en req.cookies.
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

// ---------------------- Protección CSRF ----------------------
// Patrón "double submit": nos aseguramos de que siempre exista una cookie
// CSRF legible por el frontend; en cada petición que modifica datos
// (POST/PUT/PATCH/DELETE) se exige que el header X-CSRF-Token coincida.
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

// Endpoint de prueba para verificar que la API está viva.
app.get('/api/saludo', (req, res) => {
  res.json({ mensaje: 'API de Electro Cuciné funcionando' })
})

// Health check con ping a la base (para monitoreo / Docker).
app.get('/api/salud', (req, res) => {
  try {
    db.prepare('SELECT 1').get()
    res.json({ estado: 'ok', db: 'ok', uptime: Math.round(process.uptime()) })
  } catch {
    res.status(503).json({ estado: 'error', db: 'no disponible' })
  }
})

// ---------------------- Rutas de la API ----------------------
// Cada módulo define su propio enrutador con el prefijo /api/<recurso>.
// El CSRF solo se exige dentro de /api (no afecta a los archivos estáticos).
app.use('/api', verificarCsrf)
app.use('/api/auth', authRoutes) // Registro, login, logout, "quién soy".
app.use('/api/productos', productosRoutes) // Catálogo, stock e imágenes.
app.use('/api/clientes', clientesRoutes) // Libreta de clientes (admin).
app.use('/api/ventas', ventasRoutes) // Ventas, mis compras y anulaciones.

// Estadísticas generales para el panel del superusuario (solo admin).
app.get('/api/stats', requerirAdmin, (req, res) => {
  res.json({ stats: estadisticas() })
})

// Registro de auditoría: quién hizo qué acción sensible y cuándo (solo admin).
app.get('/api/auditoria', requerirAdmin, (req, res) => {
  const registros = db
    .prepare('SELECT * FROM auditoria ORDER BY fecha DESC, id DESC LIMIT 200')
    .all()
  res.json({ registros })
})

// Cualquier otra ruta /api que no exista responde 404 con JSON.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' })
})

// Manejo centralizado de errores: nunca "tire" la app. Respeta el status
// del error si viene marcado (p. ej. 403 por CORS) y oculta detalles.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err)
  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 600 ? err.status : 500
  if (status >= 500) console.error(err)
  res.status(status).json({ error: status >= 500 ? 'Error interno del servidor.' : err.message })
})

// ---------------------- Frontend estático (producción) ----------------------
// 1) public/  -> archivos que genera el backend (imágenes numeradas de productos).
// 2) dist/    -> build de React. Si existe, todo lo que no sea /api
//                resuelve a index.html (SPA con rutas propias de react-router).
const dist = path.join(__dirname, '..', 'FrontEnd', 'client', 'dist')
const publico = path.join(__dirname, 'public')
if (fs.existsSync(publico)) {
  app.use(express.static(publico))
}
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(dist, 'index.html'))
  })
}

// ---------------------- Arranque ----------------------
if (esPrincipal) {
  // Limpieza de sesiones vencidas al arrancar + cada 6 horas.
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
