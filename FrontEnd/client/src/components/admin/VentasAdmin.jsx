import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { dinero, fechaHora } from '../../lib/format'

export default function VentasAdmin() {
  const [ventas, setVentas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [abierta, setAbierta] = useState(null)

  const cargar = (estado = estadoFiltro) => {
    setCargando(true)
    setError('')
    api(`/ventas${estado ? `?estado=${encodeURIComponent(estado)}` : ''}`)
      .then((d) => setVentas(d.ventas))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargar('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrar = (estado) => {
    setEstadoFiltro(estado)
    cargar(estado)
  }

  const anular = async (venta) => {
    if (!confirm(`¿Anular la venta #${venta.id}? Se restituirá el stock de los productos.`)) return
    try {
      await api(`/ventas/${venta.id}`, { method: 'DELETE' })
      setMensaje(`Venta #${venta.id} anulada y stock restituido.`)
      cargar(estadoFiltro)
    } catch (err) {
      setError(err.message)
    }
  }

  const totalCompletadas = ventas.filter((v) => v.estado === 'completada').reduce((a, v) => a + v.total, 0)

  return (
    <div>
      {mensaje && <p className="alerta alerta--exito">{mensaje}</p>}
      {error && <p className="alerta alerta--error">{error}</p>}

      <div className="barra-acciones">
        <div className="filtro-chips">
          {['', 'completada', 'anulada'].map((f) => (
            <button
              key={f}
              type="button"
              className={`chip chip--boton ${estadoFiltro === f ? 'chip--primario' : ''}`}
              onClick={() => filtrar(f)}
            >
              {f === '' ? 'Todas' : f}
            </button>
          ))}
        </div>
        <p className="aviso aviso--minimo">
          {ventas.length} ventas · {dinero(totalCompletadas)} en ingresos completados
        </p>
      </div>

      {cargando ? (
        <p className="aviso">Cargando ventas…</p>
      ) : ventas.length === 0 ? (
        <p className="aviso">No hay ventas para mostrar.</p>
      ) : (
        <div className="lista-ventas">
          {ventas.map((v) => (
            <article key={v.id} className="card venta">
              <header className="venta__cabecera" onClick={() => setAbierta(abierta === v.id ? null : v.id)}>
                <div>
                  <h3>
                    Venta #{v.id} <span className="venta__fecha">{fechaHora(v.fecha)}</span>
                  </h3>
                  <p className="venta__cliente">
                    {v.usuario?.nombre || '—'}
                    {v.usuario && <span className="chip chip--gris">usuario {v.usuario.username}</span>}
                    {v.cliente && <span className="chip chip--gris">cliente {v.cliente.nombre}</span>}
                  </p>
                </div>
                <div className="venta__resumen">
                  <strong>{dinero(v.total)}</strong>
                  <span className={`chip ${v.estado === 'anulada' ? 'chip--peligro' : 'chip--exito'}`}>
                    {v.estado}
                  </span>
                  <span className="venta__flecha" aria-hidden="true">
                    {abierta === v.id ? '▲' : '▼'}
                  </span>
                </div>
              </header>

              {abierta === v.id && (
                <div className="venta__detalle">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Precio</th>
                        <th>Cantidad</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.items.map((i) => (
                        <tr key={i.id}>
                          <td>{i.nombre}</td>
                          <td>{dinero(i.precio)}</td>
                          <td>{i.cantidad}</td>
                          <td>{dinero(i.precio * i.cantidad)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="venta__totales">
                    <p>
                      Subtotal <strong>{dinero(v.subtotal)}</strong>
                    </p>
                    {v.descuento_pct > 0 && (
                      <p className="venta__descuento">
                        Descuento {v.descuento_pct}% (65+) - <strong>{dinero(v.descuento_monto)}</strong>
                      </p>
                    )}
                    <p>
                      TOTAL <strong>{dinero(v.total)}</strong>
                    </p>
                    <p className="venta__metodo">Método de pago: {v.metodo_pago}</p>
                  </div>
                  {v.estado === 'completada' && (
                    <button type="button" className="boton boton--peligro" onClick={() => anular(v)}>
                      Anular venta
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}