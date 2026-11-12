import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { dinero } from '../../lib/format'

export default function ResumenAdmin() {
  const [stats, setStats] = useState(null)
  const [ventasRecientes, setVentasRecientes] = useState([])
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    api('/stats')
      .then((d) => setStats(d.stats))
      .catch((e) => setError(e.message))
    api('/ventas')
      .then((d) => setVentasRecientes(d.ventas.slice(0, 5)))
      .catch(() => {})
  }, [])

  useEffect(cargar, [cargar])

  if (!stats) {
    return <p className="aviso">Cargando resumen…</p>
  }

  const tarjetas = [
    { etiqueta: 'Ingresos', valor: dinero(stats.ingresos), icono: 'fi-rr-sack-dollar' },
    { etiqueta: 'Ventas completadas', valor: stats.cantidad_ventas, icono: 'fi-rr-receipt' },
    { etiqueta: 'Unidades vendidas', valor: stats.unidades_vendidas, icono: 'fi-rr-box' },
    { etiqueta: 'Productos activos', valor: stats.productos, icono: 'fi-rr-tags' },
    { etiqueta: 'Stock bajo (≤ 5)', valor: stats.stock_bajo, icono: 'fi-rr-triangle-warning', alerta: stats.stock_bajo > 0 },
    { etiqueta: 'Clientes registrados', valor: stats.clientes, icono: 'fi-rr-users-alt' },
    { etiqueta: 'Usuarios del sitio', valor: stats.usuarios, icono: 'fi-rr-users' },
    { etiqueta: 'Ventas con 30% 65+', valor: stats.ventas_con_descuento, icono: 'fi-rr-person-walking-with-cane' }
  ]

  return (
    <div>
      {error && <p className="alerta alerta--error">{error}</p>}

      <div className="tarjetas-stats">
        {tarjetas.map((t) => (
          <article key={t.etiqueta} className={`card tarjeta-stat ${t.alerta ? 'tarjeta-stat--alerta' : ''}`}>
            <span className="tarjeta-stat__icono" aria-hidden="true">
              <i className={`fi ${t.icono}`} />
            </span>
            <div>
              <p className="tarjeta-stat__valor">{t.valor}</p>
              <p className="tarjeta-stat__etiqueta">{t.etiqueta}</p>
            </div>
          </article>
        ))}
      </div>

      <h2 className="h2-seccion">Últimas ventas</h2>
      {ventasRecientes.length === 0 && <p className="aviso">Todavía no hay ventas registradas.</p>}
      <div className="card tabla-envolver">
        <table className="tabla">
          <thead>
            <tr>
              <th>N°</th>
              <th>Fecha</th>
              <th>Cliente / Usuario</th>
              <th>Descuento</th>
              <th>Total</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {ventasRecientes.map((v) => (
              <tr key={v.id}>
                <td>#{v.id}</td>
                <td>{v.fecha}</td>
                <td>{v.usuario?.nombre || v.cliente?.nombre || '—'}</td>
                <td>{v.descuento_pct > 0 ? `${v.descuento_pct}% (- ${dinero(v.descuento_monto)})` : '—'}</td>
                <td>{dinero(v.total)}</td>
                <td>
                  <span className={`chip ${v.estado === 'anulada' ? 'chip--peligro' : 'chip--exito'}`}>{v.estado}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}