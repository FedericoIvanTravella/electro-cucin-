import express from 'express'
import cors from 'cors'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import './src/db.js'
import authRoutes from './src/routes/auth.js'
import productosRoutes from './src/routes/productos.js'
import clientesRoutes from './src/routes/clientes.js'
import ventasRoutes, { estadisticas } from './src/routes/ventas.js'
import { requerirAdmin } from './src/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/api/saludo', (req, res) => {
  res.json({ mensaje: 'API de Electro Cuciné funcionando' })
})

app.use('/api/auth', authRoutes)
app.use('/api/productos', productosRoutes)
app.use('/api/clientes', clientesRoutes)
app.use('/api/ventas', ventasRoutes)

app.get('/api/stats', requerirAdmin, (req, res) => {
  res.json({ stats: estadisticas() })
})

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' })
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor.' })
})

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

app.listen(PORT, () => {
  console.log(`Electro Cuciné API escuchando en http://localhost:${PORT}`)
})
