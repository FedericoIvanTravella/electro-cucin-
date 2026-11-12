export const MONEDA = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0
})

export function dinero(valor) {
  return MONEDA.format(Number(valor) || 0)
}

export function cuota(precio, cantidad = 12) {
  return (Number(precio) || 0) / cantidad
}

export function ahorroPorcentaje(precio, precioTachado) {
  const p = Number(precio) || 0
  const t = Number(precioTachado) || 0
  if (t <= p) return 0
  return Math.round(((t - p) / t) * 100)
}

// Resuelve la imagen de un producto.
//  - "5"          -> archivo numerado: /productos/5.jpg
//  - "6.svg"      -> placeholder generado: /productos/6.svg
//  - "x.png"      -> /productos/x.png (salvo rutas con /)
//  - "https…"     -> URL externa
//  - "/productos/x.jpg" -> ruta directa
//  - emoji / vacío -> sin imagen (se muestra el ícono por defecto)
export function imagenProducto(producto) {
  const img = producto?.imagen
  if (!img) return ''
  if (/^\d+$/.test(img)) return `/productos/${img}.jpg`
  if (/^[\w.-]+\.(jpe?g|png|webp|avif|gif|svg)$/i.test(img)) return `/productos/${img}`
  if (/^https?:\/\//.test(img)) return img
  if (img.startsWith('/')) return img
  return ''
}

export function tieneImagen(producto) {
  return Boolean(imagenProducto(producto))
}

export function fecha(fechaTexto) {
  if (!fechaTexto) return '—'
  const fecha = new Date(String(fechaTexto).replace(' ', 'T'))
  if (Number.isNaN(fecha.getTime())) return fechaTexto
  return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function edadDesde(fecha) {
  if (!fecha) return null
  const nacimiento = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(nacimiento.getTime())) return null
  const hoy = new Date()
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const mes = hoy.getMonth() - nacimiento.getMonth()
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--
  return edad
}

export function fechaHora(fechaTexto) {
  if (!fechaTexto) return '—'
  const fecha = new Date(String(fechaTexto).replace(' ', 'T'))
  if (Number.isNaN(fecha.getTime())) return fechaTexto
  return fecha.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
