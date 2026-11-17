import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { dinero, fechaHora } from '../../lib/format'

export default function VentasAdmin() {
  const [ventas, setVentas] = useState([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [abierta, setAbierta] = useState(null)

  const cargar = (estado = estadoFiltro) => {
    setCargando(true)
    setError('')
    api(`/ventas?por_pagina=100${estado ? `&estado=${encodeURIComponent(estado)}` : ''}`)
      .then((d) => {
        setVentas(d.ventas)
        setTotal(d.total ?? d.ventas.length)
      })
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

  const cambiarEstado = async (venta, destino) => {
    setError('')
    setMensaje('')
    try {
      const d = await api(`/ventas/${venta.id}/estado`, { method: 'PATCH', body: { estado: destino } })
      if (d.correo?.enviado) {
        setMensaje(`Venta #${venta.id} marcada como ${destino}. Se envió el aviso al comprador.`)
      } else {
        setMensaje(`Venta #${venta.id} marcada como ${destino}.`)
      }
      cargar(estadoFiltro)
    } catch (err) {
      setError(err.message)
    }
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
          {['', 'completada', 'en_camino', 'entregado', 'anulada'].map((f) => (
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
          {total > ventas.length ? `${ventas.length} de ${total} ventas` : `${ventas.length} ventas`} ·{' '}
          {dinero(totalCompletadas)} en ingresos completados
        </p>
        <a className="boton boton--fantasma boton--chico" href="/api/ventas/export.csv" download>
          <i className="fi fi-rr-file-csv" aria-hidden="true" /> Exportar CSV
        </a>
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
                    {abierta === v.id ? <i className="fi fi-rr-angle-up" aria-hidden="true" /> : <i className="fi fi-rr-angle-down" aria-hidden="true" />}
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
                    {v.direccion_envio && (
                      <p className="venta__metodo"><i className="fi fi-rr-box" aria-hidden="true" /> Envío a: {v.direccion_envio}</p>
                    )}
                  </div>
                  <div className="venta__acciones">
                    {v.estado === 'completada' && (
                      <button type="button" className="boton boton--secundario boton--chico" onClick={() => cambiarEstado(v, 'en_camino')}>
                        <i className="fi fi-rr-truck-moving" aria-hidden="true" /> Marcar en camino
                      </button>
                    )}
                    {v.estado === 'en_camino' && (
                      <button type="button" className="boton boton--secundario boton--chico" onClick={() => cambiarEstado(v, 'entregado')}>
                        <i className="fi fi-rr-box-check" aria-hidden="true" /> Marcar entregado
                      </button>
                    )}
                    {v.estado === 'completada' && (
                      <button type="button" className="boton boton--peligro" onClick={() => anular(v)}>
                        Anular venta
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}