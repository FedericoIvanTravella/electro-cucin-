import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EstadoVacio from '../components/EstadoVacio'
import { api } from '../lib/api'
import { dinero, fechaHora } from '../lib/format'

export default function MisCompras() {
  const [ventas, setVentas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/ventas/mias')
      .then((data) => setVentas(data.ventas))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [])

  return (
    <div className="seccion">
      <div className="seccion__cabecera">
        <div>
          <h1>Mis compras</h1>
          <p className="seccion__bajada">Historial de pedidos registrados con tu cuenta.</p>
        </div>
      </div>

      {error && <p className="alerta alerta--error">{error}</p>}
      {cargando && <p className="aviso">Cargando compras…</p>}

      {!cargando && ventas.length === 0 && (
        <EstadoVacio
          titulo="Todavía no hiciste compras"
          mensaje="Cuando completes un pago vas a verlo acá."
        >
          <Link to="/productos" className="boton boton--primario boton--grande">
            Ver productos
          </Link>
        </EstadoVacio>
      )}

      <div className="compras">
        {ventas.map((venta) => (
          <article key={venta.id} className="card compra">
            <header className="compra__cabecera">
              <div>
                <h3>Pedido #{venta.id}</h3>
                <p>{fechaHora(venta.fecha)}</p>
                {venta.direccion_envio && (
                  <p className="compra__envio">📦 Envío a: {venta.direccion_envio}</p>
                )}
              </div>
              <span className={`chip ${venta.estado === 'anulada' ? 'chip--peligro' : 'chip--exito'}`}>
                {venta.estado}
              </span>
            </header>
            <ul className="compra__items">
              {venta.items.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.cantidad}× {item.nombre}
                  </span>
                  <span>{dinero(item.precio * item.cantidad)}</span>
                </li>
              ))}
            </ul>
            <footer className="compra__pie">
              {venta.descuento_pct > 0 && (
                <span className="chip chip--descuento">
                  Descuento {venta.descuento_pct}%: - {dinero(venta.descuento_monto)}
                </span>
              )}
              <strong>Total: {dinero(venta.total)}</strong>
            </footer>
          </article>
        ))}
      </div>
    </div>
  )
}
