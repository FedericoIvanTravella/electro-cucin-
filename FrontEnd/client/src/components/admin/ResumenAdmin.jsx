import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { dinero } from '../../lib/format'
import ChartDonut from '../ChartDonut'
import ChartColumns from '../ChartColumns'
import ChartBars from '../ChartBars'

export default function ResumenAdmin() {
  const [stats, setStats] = useState(null)
  const [analitica, setAnalitica] = useState(null)
  const [ventasRecientes, setVentasRecientes] = useState([])
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    api('/stats')
      .then((d) => {
        setStats(d.stats)
        setAnalitica(d.analitica || null)
      })
      .catch((e) => setError(e.message))
    api('/ventas?por_pagina=5')
      .then((d) => setVentasRecientes(d.ventas))
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
    { etiqueta: 'Ventas con 30% 65+', valor: stats.ventas_con_descuento, icono: 'fi-rr-person-walking-with-cane' },
    { etiqueta: 'Suscriptores newsletter', valor: stats.newsletter ?? 0, icono: 'fi-rr-envelope' }
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

      {analitica && (
        <section className="highlights">
          <h2 className="h2-seccion">Destaques del mes</h2>
          <div className="highlights__grid">
            <article className="card highlight">
              <span className="highlight__icono"><i className="fi fi-rr-receipt" aria-hidden="true" /></span>
              <div>
                <p className="highlight__valor">{dinero(analitica.comparativa?.ticketPromedio ?? 0)}</p>
                <p className="highlight__etiqueta">Ticket promedio</p>
              </div>
            </article>
            <article className="card highlight">
              <span className="highlight__icono highlight__icono--estrella"><i className="fi fi-sr-star" aria-hidden="true" /></span>
              <div>
                <p className="highlight__valor">{analitica.categoriaEstrella?.categoria ?? '—'}</p>
                <p className="highlight__etiqueta">
                  Categoría estrella · {analitica.categoriaEstrella ? dinero(analitica.categoriaEstrella.ingresos) : 'sin datos'}
                </p>
              </div>
            </article>
            <article className="card highlight">
              <span className="highlight__icono highlight__icono--top"><i className="fi fi-rr-box" aria-hidden="true" /></span>
              <div>
                <p className="highlight__valor">{analitica.topProducto?.nombre ?? '—'}</p>
                <p className="highlight__etiqueta">
                  Producto top · {analitica.topProducto?.unidades ?? 0} unidades
                </p>
              </div>
            </article>
            <article className={`card highlight ${analitica.comparativa?.variacionPct == null ? '' : analitica.comparativa.variacionPct >= 0 ? 'highlight--positivo' : 'highlight--negativo'}`}>
              <span className="highlight__icono">
                <i className={`fi ${(analitica.comparativa?.variacionPct ?? 0) >= 0 ? 'fi-rr-arrow-trend-up' : 'fi-rr-arrow-trend-down'}`} aria-hidden="true" />
              </span>
              <div>
                <p className="highlight__valor">
                  {analitica.comparativa?.variacionPct == null
                    ? '—'
                    : `${analitica.comparativa.variacionPct >= 0 ? '+' : ''}${analitica.comparativa.variacionPct}%`}
                </p>
                <p className="highlight__etiqueta">
                  vs mes anterior · {dinero(analitica.comparativa?.mesActual ?? 0)} <br />
                  ({analitica.comparativa?.ventasMesActual ?? 0} ventas)
                </p>
              </div>
            </article>
          </div>
        </section>
      )}

      {analitica && (
        <section className="analitica">
          <h2 className="h2-seccion">Analítica</h2>
          <div className="analitica__grilla">
            <div className="card grafico">
              <h3>Ingresos por categoría</h3>
              <ChartDonut
                datos={analitica.porCategoria.map((c) => ({ etiqueta: c.categoria, valor: c.ingresos }))}
                formato={dinero}
                centroTitulo="Ingresos"
              />
              <p className="grafico__pie">Ingresos brutos por línea (sin prorratear descuentos de pedido).</p>
            </div>

            <div className="card grafico">
              <h3>Unidades vendidas por categoría</h3>
              <ChartDonut
                datos={analitica.porCategoria.map((c) => ({ etiqueta: c.categoria, valor: c.unidades }))}
                formato={(v) => `${v} u.`}
                centroTitulo="Unidades"
              />
            </div>

            <div className="card grafico">
              <h3>Catálogo por categoría</h3>
              <ChartDonut
                datos={analitica.catalogoPorCategoria.map((c) => ({ etiqueta: c.categoria, valor: c.cantidad }))}
                formato={(v) => `${v} prod.`}
                centroTitulo="Productos"
              />
            </div>

            <div className="card grafico">
              <h3>Estado de ventas</h3>
              <ChartDonut
                datos={analitica.ventasPorEstado.map((e) => ({ etiqueta: e.estado, valor: e.cantidad }))}
                formato={(v) => `${v} ventas`}
                centroTitulo="Ventas"
                centroValor={String(analitica.ventasPorEstado.reduce((s, e) => s + e.cantidad, 0))}
              />
            </div>

            <div className="card grafico grafico--ancho">
              <h3>Ventas de los últimos 14 días</h3>
              <ChartColumns
                datos={analitica.ventasPorDia.map((d) => ({
                  etiqueta: d.etiqueta,
                  valor: d.ingresos,
                  tooltip: `${d.etiqueta}: ${d.cantidad} ventas${d.descuentos > 0 ? `, descuentos ${dinero(d.descuentos)}` : ''}`
                }))}
                formato={dinero}
              />
              <p className="grafico__pie">
                Total del período:{' '}
                {dinero(analitica.ventasPorDia.reduce((s, d) => s + d.ingresos, 0))} en{' '}
                {analitica.ventasPorDia.reduce((s, d) => s + d.cantidad, 0)} ventas
              </p>
            </div>

            <div className="card grafico grafico--ancho">
              <h3>Top 8 productos por unidades</h3>
              <ChartBars
                datos={analitica.topProductos.map((p) => ({ etiqueta: p.nombre, valor: p.unidades }))}
                formato={(v) => `${v} u.`}
              />
            </div>

            <div className="card grafico grafico--ancho">
              <h3>Salud del inventario</h3>
              {(() => {
                const { sinStock, stockBajo, stockOk } = analitica.stock
                const total = sinStock + stockBajo + stockOk
                const pct = (n) => (total > 0 ? (n / total) * 100 : 0)
                return (
                  <div className="stock-salud">
                    <div className="stock-salud__barra" role="img" aria-label="Distribución del inventario por nivel de stock">
                      {sinStock > 0 && <span className="stock-salud__seg stock-salud__seg--sin" style={{ width: `${pct(sinStock)}%` }} />}
                      {stockBajo > 0 && <span className="stock-salud__seg stock-salud__seg--bajo" style={{ width: `${pct(stockBajo)}%` }} />}
                      {stockOk > 0 && <span className="stock-salud__seg stock-salud__seg--ok" style={{ width: `${pct(stockOk)}%` }} />}
                    </div>
                    <ul className="stock-salud__leyenda">
                      <li>
                        <span className="stock-salud__dot stock-salud__dot--sin" /> Sin stock: <strong>{sinStock}</strong>
                      </li>
                      <li>
                        <span className="stock-salud__dot stock-salud__dot--bajo" /> Stock bajo (≤ 5): <strong>{stockBajo}</strong>
                      </li>
                      <li>
                        <span className="stock-salud__dot stock-salud__dot--ok" /> Stock saludable: <strong>{stockOk}</strong>
                      </li>
                    </ul>
                  </div>
                )
              })()}
            </div>
          </div>
        </section>
      )}

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