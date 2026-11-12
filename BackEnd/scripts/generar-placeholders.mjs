// =====================================================================
// Generador de placeholders SVG para los productos del catálogo.
// Crea BackEnd/public/productos/<id>.svg para todo producto con id >= 6
// del seed (los 1..5 tienen foto real <id>.jpg).
// Cada SVG lleva: degradé por categoría, pictograma vectorial,
// nombre del producto y marca Electro Cuciné.
// Uso: node scripts/generar-placeholders.mjs
// =====================================================================
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { productosIniciales } from '../src/catalogo.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const destino = path.join(__dirname, '..', 'public', 'productos')
fs.mkdirSync(destino, { recursive: true })

// Paleta por categoría (dos tonos del degradé + acento).
const ESTILO_CATEGORIA = {
  Cocción: { desde: '#ff7a18', hasta: '#c2410c', claro: '#fdba74' },
  Preparación: { desde: '#0ea5e9', hasta: '#1e3a8a', claro: '#7dd3fc' },
  Cafetería: { desde: '#a16207', hasta: '#422006', claro: '#fcd34d' },
  Limpieza: { desde: '#10b981', hasta: '#064e3b', claro: '#6ee7b7' }
}
const ESTILO_DEFAULT = { desde: '#64748b', hasta: '#0f172a', claro: '#cbd5e1' }

const W = 800
const H = 600

// ---------- Pictogramas vectoriales (trazos simples, estilo plano) ----------
const PICTOGRAMAS = {
  Cocción: `
    <g stroke="ICONO" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.95">
      <path d="M250 250 h300 v60 a40 40 0 0 1 -40 40 h-60 v20 h-100 v-20 h-60 a40 40 0 0 1 -40 -40 z" fill="ICONO" fill-opacity="0.18"/>
      <path d="M230 250 h340"/>
      <path d="M400 250 v-28"/>
      <path d="M338 218 a44 18 0 0 1 124 0"/>
      <path d="M300 410 h200"/>
    </g>`,
  Preparación: `
    <g stroke="ICONO" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.95">
      <path d="M270 240 h260 l-28 130 a46 46 0 0 1 -45 38 h-114 a46 46 0 0 1 -45 -38 z" fill="ICONO" fill-opacity="0.18"/>
      <path d="M250 240 h300"/>
      <path d="M395 240 v-70 m-28 0 h56"/>
      <path d="M330 452 h140"/>
    </g>`,
  Cafetería: `
    <g stroke="ICONO" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.95">
      <path d="M280 250 h210 v100 a58 58 0 0 1 -58 56 h-94 a58 58 0 0 1 -58 -56 z" fill="ICONO" fill-opacity="0.18"/>
      <path d="M490 270 h34 a34 34 0 0 1 0 68 h-36"/>
      <path d="M320 210 a18 18 0 0 1 36 0 M415 210 a18 18 0 0 1 36 0"/>
      <path d="M265 462 h280"/>
    </g>`,
  Limpieza: `
    <g stroke="ICONO" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.95">
      <path d="M330 260 h90 l22 60 v140 a26 26 0 0 1 -26 24 h-82 a26 26 0 0 1 -26 -24 v-140 z" fill="ICONO" fill-opacity="0.18"/>
      <path d="M330 260 v-34 h90 v34"/>
      <path d="M442 300 l70 -24 M448 330 l72 0 M442 360 l70 24"/>
      <path d="M330 420 h-52"/>
    </g>`
}

// Parte el nombre en hasta 3 líneas de ~24 caracteres.
function envolver(texto, maxChars = 24, maxLineas = 3) {
  const palabras = String(texto).split(/\s+/)
  const lineas = []
  let actual = ''
  for (const palabra of palabras) {
    const candidata = actual ? `${actual} ${palabra}` : palabra
    if (candidata.length <= maxChars) {
      actual = candidata
      continue
    }
    if (actual) lineas.push(actual)
    actual = palabra
    if (lineas.length >= maxLineas) break
  }
  if (actual && lineas.length < maxLineas) {
    if (lineas.length === maxLineas - 1 && (actual + ' ' + '').length > 0) {
      // última línea: recortar con puntos suspensivos si excede
      lineas.push(actual.length > maxChars ? actual.slice(0, maxChars - 1) + '…' : actual)
    } else {
      lineas.push(actual)
    }
  }
  return lineas.slice(0, maxLineas)
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function generarSvg(nombre, categoria) {
  const estilo = ESTILO_CATEGORIA[categoria] || ESTILO_DEFAULT
  const pictograma = (PICTOGRAMAS[categoria] || PICTOGRAMAS.Cocción).replaceAll('ICONO', estilo.claro)
  const lineas = envolver(nombre)
  const inicioY = 470 - (lineas.length - 1) * 24
  const textoNombre = lineas
    .map((linea, i) => `      <tspan x="${W / 2}" y="${inicioY + i * 46}">${escapeXml(linea)}</tspan>`)
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(nombre)}">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${estilo.desde}"/>
      <stop offset="1" stop-color="${estilo.hasta}"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.38" r="0.55">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#fondo)"/>
  <rect width="${W}" height="${H}" fill="url(#halo)"/>
  <circle cx="120" cy="120" r="150" fill="#ffffff" fill-opacity="0.05"/>
  <circle cx="700" cy="500" r="180" fill="#000000" fill-opacity="0.08"/>
  <text x="${W / 2}" y="52" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" letter-spacing="6" fill="#ffffff" fill-opacity="0.85">${escapeXml(categoria.toUpperCase())}</text>
  ${pictograma}
  <text text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="34" fill="#ffffff">
${textoNombre}
  </text>
  <text x="${W / 2}" y="${H - 22}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="17" letter-spacing="4" fill="#ffffff" fill-opacity="0.65">ELECTRO CUCINÉ</text>
</svg>
`
}

let generados = 0
productosIniciales.forEach((p, indice) => {
  const id = indice + 1
  if (id <= 5) return // estos tienen foto real
  const [nombre, categoria] = p
  fs.writeFileSync(path.join(destino, `${id}.svg`), generarSvg(nombre, categoria), 'utf8')
  generados += 1
})
console.log(`[placeholders] ${generados} SVG generados en public/productos/`)
