// =====================================================================
// Descarga imágenes REALES de productos desde Wikimedia Commons.
// - Consulta la API pública de Commons (sin clave) con una query en
//   inglés derivada del nombre del producto.
// - Acepta solo licencias libres (dominio público, CC0, CC BY, CC BY-SA).
//   Se descartan NC, ND, non-free y fair use.
// - Guarda BackEnd/public/productos/<id>.<ext> (800px, calidad suficiente).
// - Escribe:
//     src/imagenes-reales.json      { "6": "6.jpg", ... }
//     public/productos/ATRIBUCION.md (atribución obligatoria de Commons)
// - Actualiza la base local: productos cuyo imagen era "<id>" o "<id>.svg"
//   pasan al archivo real (nunca pisa imágenes elegidas a mano).
//
// Uso: node scripts/descargar-imagenes-reales.mjs [--force]
//   --force vuelve a descargar aunque el archivo ya exista.
// =====================================================================
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { productosIniciales } from '../src/catalogo.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const raiz = path.join(__dirname, '..')
const carpetaImg = path.join(raiz, 'public', 'productos')
const rutaMapa = path.join(raiz, 'src', 'imagenes-reales.json')
const dbPath = process.env.EC_DB_PATH || path.join(raiz, 'data', 'electrocucine.db')
const FORCE = process.argv.includes('--force')

const API = 'https://commons.wikimedia.org/w/api.php'
const UA = 'ElectroCucine/1.0 (educational project; contact: local-dev) node'
const EXT_OK = new Set(['jpg', 'jpeg', 'png', 'webp'])

// ---------- Reglas: nombre en español -> query en inglés ----------
const REGLAS = [
  [/freidora de aire/, 'air fryer appliance'],
  [/horno.*microondas|microondas/, 'microwave oven'],
  [/horno/, 'toaster oven'],
  [/arrocera/, 'rice cooker'],
  [/multicocina/, 'multi cooker appliance'],
  [/olla de presión/, 'electric pressure cooker'],
  [/wok/, 'electric wok'],
  [/olla de cerámica|cerámica multicooker/, 'ceramic slow cooker'],
  [/vaporera/, 'food steamer appliance'],
  [/inducci/, 'induction cooktop'],
  [/anafe|dos fuegos|2 hornallas/, 'electric hot plate'],
  [/cocina solar/, 'solar cooker'],
  [/cocina a gas/, 'camping gas stove'],
  [/grill panini|panini/, 'panini press'],
  [/grill.*contacto|plancha doble contacto/, 'contact grill'],
  [/parrilla eléctrica/, 'electric grill appliance'],
  [/sandwichera/, 'sandwich maker'],
  [/gofrera/, 'waffle maker'],
  [/máquina para hacer pan/, 'bread machine'],
  [/deshidratador/, 'food dehydrator'],
  [/selladora|envasadora/, 'vacuum sealer'],
  [/crepera/, 'crepe maker'],
  [/palomitas/, 'popcorn maker machine'],
  [/churrera/, 'churro maker'],
  [/fondue/, 'cheese fondue set'],
  [/licuadora.*(vaso|industrial|abatible|extractor)/, 'blender appliance'],
  [/licuadora personal|portátil/, 'personal blender'],
  [/minipimer|licuadora de mano/, 'immersion blender'],
  [/espumadora/, 'milk frother'],
  [/batidora de mano/, 'hand mixer'],
  [/batidora planetaria|batidora de pedestal/, 'stand mixer'],
  [/batidora/, 'hand mixer'],
  [/picadora de carne/, 'meat grinder'],
  [/picadora/, 'food chopper'],
  [/multiprocesadora|procesador de alimentos|procesadora|robot de cocina|kitchen/, 'food processor'],
  [/mini procesador/, 'food chopper'],
  [/exprimidor.*cítricos/, 'citrus juicer'],
  [/exprimidor de jugos|juguer|juguera/, 'juicer appliance'],
  [/exprimidor/, 'juicer'],
  [/rallador eléctrico/, 'rotary grater'],
  [/cortadora de fiambre/, 'meat slicer'],
  [/balanza/, 'kitchen scale'],
  [/termómetro/, 'meat thermometer'],
  [/espiralizador|rallador espiral/, 'spiralizer vegetable'],
  [/abrelatas/, 'electric can opener'],
  [/rallador/, 'grater'],
  [/máquina.*fideos|fideos.*secador/, 'pasta maker machine'],
  [/yogurtera/, 'yogurt maker'],
  [/heladera eléctrica/, 'ice cream maker'],
  [/extractor de humos|campana/, 'range hood kitchen'],
  [/lavavajillas/, 'dishwasher'],
  [/purificador/, 'air purifier'],
  [/cortador multiuso/, 'vegetable slicer'],
  [/prensa de jugos/, 'manual citrus press'],
  [/cafetera.*(espresso|automática|grano)/, 'espresso machine'],
  [/cafetera.*(filtro|goteo)/, 'drip coffee maker'],
  [/moka|italiana/, 'moka pot'],
  [/cápsulas/, 'coffee pod machine'],
  [/molinillo/, 'coffee grinder'],
  [/prensa francesa/, 'french press coffee maker'],
  [/cafetera personal 3 en 1/, 'stovetop coffee maker'],
  [/cafetera personal/, 'coffee maker'],
  [/cafetera/, 'coffee maker'],
  [/pava|hervidor/, 'electric kettle'],
  [/tostadora/, 'toaster'],
  [/chocolate/, 'hot chocolate dispenser'],
  [/filtro de agua|jarra/, 'water filter pitcher']
]

const FALLBACK = {
  Cocción: 'kitchen appliance cooking',
  Preparación: 'kitchen appliance',
  Cafetería: 'coffee maker',
  Limpieza: 'kitchen appliance'
}

function queryPara(nombre, categoria) {
  const n = nombre.toLowerCase()
  for (const [regex, query] of REGLAS) {
    if (regex.test(n)) return query
  }
  return FALLBACK[categoria] || 'kitchen appliance'
}

function licenciaPermitida(shortName = '') {
  const s = shortName.toLowerCase()
  if (s.includes('nc') || s.includes('nd') || s.includes('fair') || s.includes('non-free')) return false
  if (s.includes('cc0') || s.includes('public domain') || s.includes('gfdl')) return true
  if (/^cc by(-sa)?( 2\.0| 3\.0| 4\.0)?$/.test(s)) return true
  if (s.includes('cc by-sa')) return true
  if (s.includes('cc by ')) return true
  return false
}

function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

async function buscarImagen(query) {
  const url =
    API +
    '?' +
    new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: query,
      gsrnamespace: '6',
      gsrlimit: '10',
      prop: 'imageinfo',
      iiprop: 'url|size|extmetadata',
      iiurlwidth: '800',
      format: 'json'
    })
  const res = await fetchConReintento(url)
  if (!res.ok) throw new Error(`Commons API ${res.status}`)
  const data = await res.json()
  const paginas = Object.values(data.query?.pages || {})
  for (const p of paginas) {
    const ii = p.imageinfo?.[0]
    if (!ii) continue
    const ext = (ii.url.match(/\.([a-z0-9]+)(\?|$)/i)?.[1] || 'jpg').toLowerCase()
    if (!EXT_OK.has(ext)) continue
    if (ii.width < 400 || ii.height < 300) continue
    const meta = ii.extmetadata || {}
    const licencia = meta.LicenseShortName?.value || ''
    if (!licenciaPermitida(licencia)) continue
    return {
      titulo: p.title,
      url: ii.thumburl || ii.url,
      ancho: ii.width,
      alto: ii.height,
      licencia,
      autor: stripHtml(meta.Artist?.value || 'Desconocido'),
      pagina: meta.DescriptionUrl?.value || ii.descriptionurl || '',
      ext
    }
  }
  return null
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

// Commons responde 429 si vamos rápido: espera progresiva y hasta 5 intentos.
async function fetchConReintento(url, intentos = 5) {
  for (let i = 0; i < intentos; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (res.status === 429 || res.status >= 500) {
      const espera = 3000 * (i + 1)
      console.log(`    (${res.status} de Commons, esperando ${espera / 1000}s…)`)
      await dormir(espera)
      continue
    }
    return res
  }
  throw new Error('Commons API 429 (reintentos agotados)')
}

// ---------- Bucle principal ----------
console.log('[imagenes] Buscando 95 imágenes en Wikimedia Commons…\n')
const mapa = fs.existsSync(rutaMapa) ? JSON.parse(fs.readFileSync(rutaMapa, 'utf8')) : {}
const atribucion = []
const faltantes = []
const db = fs.existsSync(dbPath) ? new DatabaseSync(dbPath) : null
const actualizar = db
  ? db.prepare("UPDATE productos SET imagen = ? WHERE id = ? AND (imagen = ? OR imagen LIKE ?)")
  : null

for (let i = 0; i < productosIniciales.length; i++) {
  const id = i + 1
  if (id <= 5) continue // las 1..5 tienen foto real propia
  const [nombre, categoria] = productosIniciales[i]
  const query = queryPara(nombre, categoria)

  const yaBajada = Object.entries(mapa).find(([pid]) => Number(pid) === id)?.[1]
  if (yaBajada && fs.existsSync(path.join(carpetaImg, yaBajada)) && !FORCE) {
    console.log(`  #${id} ${nombre} -> ya descargada (${yaBajada}), se omite`)
    continue
  }

  try {
    const hit = await buscarImagen(query)
    if (!hit) {
      faltantes.push({ id, nombre, query })
      console.log(`  #${id} ${nombre} -> SIN RESULTADO (query: "${query}"), queda el placeholder`)
      continue
    }
    const archivo = `${id}.${hit.ext}`
    const destino = path.join(carpetaImg, archivo)
    const bin = Buffer.from(await (await fetchConReintento(hit.url)).arrayBuffer())
    fs.writeFileSync(destino, bin)
    mapa[id] = archivo
    if (actualizar) {
      actualizar.run(archivo, id, String(id), `${id}.svg`)
    }
    atribucion.push({ id, nombre, ...hit, archivo })
    console.log(`  #${id} ${nombre} -> ${archivo} (${hit.licencia})`)
  } catch (error) {
    faltantes.push({ id, nombre, query })
    console.log(`  #${id} ${nombre} -> ERROR: ${error.message}`)
  }
  await dormir(400) // cortesía con la API de Commons
}

if (db) db.close()
fs.writeFileSync(rutaMapa, JSON.stringify(mapa, null, 2) + '\n', 'utf8')

// ---------- Atribución ----------
const hoy = new Date().toISOString().slice(0, 10)
const lineas = [
  '# Atribución de imágenes de productos',
  '',
  `Imágenes descargadas de Wikimedia Commons el ${hoy}.`,
  'Todas las licencias indicadas permiten uso con atribución.',
  ''
]
for (const a of atribucion) {
  lineas.push(`## #${a.id} — ${a.nombre}`)
  lineas.push(`- Archivo: \`${a.archivo}\` (de ${a.titulo})`)
  lineas.push(`- Autor: ${a.autor}`)
  lineas.push(`- Licencia: ${a.licencia}`)
  if (a.pagina) lineas.push(`- Fuente: ${a.pagina}`)
  lineas.push('')
}
if (faltantes.length) {
  lineas.push('## Sin imagen real (usan placeholder SVG)')
  for (const f of faltantes) lineas.push(`- #${f.id} — ${f.nombre} (query: "${f.query}")`)
}
fs.writeFileSync(path.join(carpetaImg, 'ATRIBUCION.md'), lineas.join('\n'), 'utf8')

console.log(`\n[imagenes] Listo. ${atribucion.length} descargadas, ${faltantes.length} sin resultado.`)
console.log('[imagenes] Mapa: src/imagenes-reales.json · Atribución: public/productos/ATRIBUCION.md')
