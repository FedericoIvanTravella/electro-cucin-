import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import EstadoVacio from '../components/EstadoVacio'
import RutaEntrega from '../components/RutaEntrega'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { dinero, fechaHora } from '../lib/format'

export default function MisCompras() {
  const navigate = useNavigate()
  const { vaciar, agregar } = useCart()
  const { mostrar } = useToast()
  const [ventas, setVentas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [repitiendo, setRepitiendo] = useState(null)

  const repetirCompra = async (venta) => {
    setRepitiendo(venta.id)
    try {
      vaciar()
      let agregados = 0
      for (const item of venta.items) {
        if (!item.producto_id) continue
        try {
          const data = await api(`/productos/${item.producto_id}`)
          const p = data.producto
          if (p && p.activo && p.stock > 0) {
            agregar(p, Math.min(item.cantidad, p.stock))
            agregados += 1
          }
        } catch {
          // producto inexistente: se saltea
        }
      }
      mostrar(
        agregados > 0 ? `Pedido #${venta.id} cargado en el carrito (${agregados} ${agregados === 1 ? 'producto' : 'productos'}).` : 'No queda stock de esos productos.',
        agregados > 0 ? 'exito' : 'error'
      )
      if (agregados > 0) navigate('/carrito')
    } finally {
      setRepitiendo(null)
    }
  }

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
                  <p className="compra__envio"><i className="fi fi-rr-box" aria-hidden="true" /> Envío a: {venta.direccion_envio}</p>
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
              {Number(venta.cupon_descuento) > 0 && (
                <span className="chip chip--exito">
                  Cupón {venta.cupon_codigo}: - {dinero(venta.cupon_descuento)}
                </span>
              )}
              <strong>Total: {dinero(venta.total)}</strong>
              {venta.estado === 'completada' && (
                <button
                  type="button"
                  className="boton boton--fantasma boton--chico"
                  onClick={() => repetirCompra(venta)}
                  disabled={repitiendo === venta.id}
                >
                  <i className="fi fi-rr-refresh" aria-hidden="true" /> {repitiendo === venta.id ? 'Cargando…' : 'Repetir compra'}
                </button>
              )}
            </footer>
            {venta.estado !== 'anulada' && <RutaEntrega compacto />}
          </article>
        ))}
      </div>
    </div>
  )
}
