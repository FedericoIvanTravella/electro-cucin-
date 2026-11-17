// Exporta un snapshot read-only del catálogo para la demo estática
// (GitHub Pages / cualquier hosting sin backend).
// Uso: npm run demo:export  (no modifica la base; conexión readonly)
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.EC_DB_PATH || path.join(__dirname, '..', 'data', 'electrocucine.db')
const salida = process.env.EC_DEMO_OUT || path.join(__dirname, '..', '..', 'FrontEnd', 'client', 'public', 'demo', 'productos.json')

const db = new DatabaseSync(dbPath, { readonly: true })

const productos = db
  .prepare(
    `SELECT p.*,
            COALESCE((SELECT SUM(vi.cantidad) FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id AND v.estado != 'anulada' WHERE vi.producto_id = p.id), 0) AS unidades_vendidas,
            COALESCE((SELECT AVG(r.estrellas) FROM resenas r WHERE r.producto_id = p.id), 0) AS promedio_resenas,
            (SELECT COUNT(*) FROM resenas r WHERE r.producto_id = p.id) AS cantidad_resenas
     FROM productos p
     WHERE p.activo = 1
     ORDER BY p.nombre`
  )
  .all()

const resenas = db
  .prepare(
    `SELECT r.id, r.producto_id, r.estrellas, r.comentario, r.fecha,
            u.id AS usuario_id, u.nombre AS usuario_nombre, u.username AS usuario_username
     FROM resenas r
     JOIN usuarios u ON u.id = r.usuario_id
     ORDER BY r.fecha DESC`
  )
  .all()

fs.mkdirSync(path.dirname(salida), { recursive: true })
fs.writeFileSync(
  salida,
  JSON.stringify({ generado: new Date().toISOString(), productos, resenas }, null, 0)
)

console.log(`[demo] ${productos.length} productos y ${resenas.length} reseñas → ${salida}`)
