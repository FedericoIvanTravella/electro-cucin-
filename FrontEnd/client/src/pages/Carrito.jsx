import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import EstadoVacio from '../components/EstadoVacio'
import { api } from '../lib/api'
import { dinero, imagenProducto, tieneImagen } from '../lib/format'

export default function Carrito() {
  const { items, agregar, cambiarCantidad, quitar, vaciar, totales } = useCart()
  const { usuario, conDescuento } = useAuth()
  const [catalogo, setCatalogo] = useState([])
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api('/productos?soloStock=1')
      .then((data) => setCatalogo(data.productos))
      .catch(() => setCatalogo([]))
  }, [])

  const disponibles = catalogo.filter(
    (p) =>
      p.stock > 0 &&
      !items.some((i) => i.producto_id === p.id) &&
      p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  if (items.length === 0) {
    return (
      <EstadoVacio
        titulo="Tu carrito está vacío"
        mensaje="Agregá productos desde el catálogo y volvé a esta ventana para gestionarlos."
      >
        <Link to="/productos" className="boton boton--primario boton--grande">
          Ir al catálogo
        </Link>
      </EstadoVacio>
    )
  }

  return (
    <div className="carrito">
      <div className="carrito__principal">
        <div className="seccion__cabecera">
          <div>
            <h1>Mi carrito</h1>
            <p className="seccion__bajada">
              {totales.unidades} {totales.unidades === 1 ? 'unidad' : 'unidades'} en tu pedido
            </p>
          </div>
          <button type="button" className="boton boton--peligro-fantasma" onClick={vaciar}>
            Vaciar carrito
          </button>
        </div>

        <div className="card lista-carrito">
          {items.map((item) => (
            <div key={item.producto_id} className="linea-carrito">
              <div className="linea-carrito__media" aria-hidden="true">
                {imagenProducto(item) ? (
                  <img src={imagenProducto(item)} alt="" />
                ) : (
                  <span>{item.imagen || '🍽️'}</span>
                )}
              </div>

              <div className="linea-carrito__info">
                <h3>{item.nombre}</h3>
                <p className="linea-carrito__categoria">{item.categoria}</p>
                <p className="linea-carrito__precio">{dinero(item.precio)} c/u</p>
              </div>

              <div className="cantidad">
                <button
                  type="button"
                  onClick={() => cambiarCantidad(item.producto_id, item.cantidad - 1)}
                  aria-label={`Quitar una unidad de ${item.nombre}`}
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  max={item.stock}
                  value={item.cantidad}
                  onChange={(e) => cambiarCantidad(item.producto_id, Number(e.target.value))}
                  aria-label={`Cantidad de ${item.nombre}`}
                />
                <button
                  type="button"
                  onClick={() => cambiarCantidad(item.producto_id, item.cantidad + 1)}
                  disabled={item.cantidad >= item.stock}
                  aria-label={`Agregar una unidad de ${item.nombre}`}
                >
                  +
                </button>
              </div>

              <div className="linea-carrito__total">{dinero(item.precio * item.cantidad)}</div>

              <button
                type="button"
                className="boton boton--peligro"
                onClick={() => quitar(item.producto_id)}
                title="Eliminar del carrito"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="boton boton--fantasma"
          onClick={() => setAbierto((v) => !v)}
        >
          {abierto ? 'Ocultar productos' : '➕ Agregar otro producto'}
        </button>

        {abierto && (
          <div className="card agregar-productos">
            <input
              type="search"
              placeholder="Buscar producto para agregar…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <div className="agregar-productos__lista">
              {disponibles.length === 0 && (
                <p className="aviso">No hay más productos disponibles para agregar.</p>
              )}
              {disponibles.slice(0, 8).map((p) => (
                <div key={p.id} className="agregar-productos__item">
                  {tieneImagen(p) ? (
                    <img src={imagenProducto(p)} alt="" className="agregar-productos__thumb" />
                  ) : (
                    <span aria-hidden="true">{p.imagen || '🍽️'}</span>
                  )}
                  <div>
                    <strong>{p.nombre}</strong>
                    <small>
                      {dinero(p.precio)} · stock {p.stock}
                    </small>
                  </div>
                  <button type="button" className="boton boton--primario boton--chico" onClick={() => agregar(p, 1)}>
                    Agregar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <aside className="carrito__resumen card">
        <h2>Resumen del pedido</h2>
        <div className="resumen-linea">
          <span>Subtotal</span>
          <span>{dinero(totales.subtotal)}</span>
        </div>
        {conDescuento && (
          <div className="resumen-linea resumen-linea--descuento">
            <span>Descuento 65+ ({totales.porcentaje}%)</span>
            <span>- {dinero(totales.descuento)}</span>
          </div>
        )}
        {!conDescuento && (
          <div className="resumen-nota">
            {usuario ? (
              <p>
                {usuario.edad !== null
                  ? `Tenés ${usuario.edad} años. El 30% se aplica automáticamente desde los 65 años.`
                  : 'Cargá tu fecha de nacimiento para acceder al descuento de 65+.'}
              </p>
            ) : (
              <p>
                <Link to="/login">Iniciá sesión</Link> o <Link to="/registro">registrate</Link> para
                obtener el 30% si tenés 65 años o más.
              </p>
            )}
          </div>
        )}
        <div className="resumen-linea resumen-linea--total">
          <span>Total</span>
          <span>{dinero(totales.total)}</span>
        </div>

        <button
          type="button"
          className="boton boton--primario boton--grande boton--bloque"
          onClick={() => navigate(usuario ? '/pago' : '/login')}
        >
          {usuario ? 'Ir a pagar' : 'Ingresá para pagar'}
        </button>
        <Link to="/productos" className="boton boton--fantasma boton--bloque">
          Seguir comprando
        </Link>
      </aside>
    </div>
  )
}
