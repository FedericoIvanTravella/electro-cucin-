export const MONEDA = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0
})

export function dinero(valor) {
  return MONEDA.format(Number(valor) || 0)
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
