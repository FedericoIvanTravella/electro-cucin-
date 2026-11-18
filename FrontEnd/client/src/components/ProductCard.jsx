import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useFavoritos } from '../context/FavoritosContext'
import { useToast } from '../context/ToastContext'
import Lightbox from './Lightbox'
import Stars from './Stars'
import { ahorroPorcentaje, cuota, dinero, imagenProducto } from '../lib/format'

export default function ProductCard({ producto, destacado = false, topRank = 0, mediaExtras = null }) {
  const { agregar } = useCart()
  const { esFavorito, alternar } = useFavoritos()
  const { mostrar } = useToast()
  const [agregado, setAgregado] = useState(false)
  const [zoom, setZoom] = useState(false)
  const sinStock = producto.stock <= 0
  const imagen = imagenProducto(producto)
  const descuento = ahorroPorcentaje(producto.precio, producto.precio_tachado)
  const cuotaMensual = cuota(producto.precio)
  const favorito = esFavorito(producto.id)

  const sumar = () => {
    if (sinStock) return
    agregar(producto, 1)
    setAgregado(true)
    mostrar(`${producto.nombre} se agregó al carrito`, 'exito')
    setTimeout(() => setAgregado(false), 1200)
  }

  const marcar = () => {
    alternar(producto.id)
    mostrar(
      favorito ? `${producto.nombre} quitado de favoritos` : `${producto.nombre} en favoritos`,
      'info'
    )
  }

  return (
    <article className={`producto ${destacado ? 'producto--destacado' : ''}`}>
      <div className={`producto__media ${!imagen ? `producto__media--tinte producto__media--${(producto.categoria || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')}` : ''}`}>
        <button
          type="button"
          className={`producto__favorito ${favorito ? 'producto__favorito--activo' : ''}`}
          onClick={marcar}
          aria-label={favorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          aria-pressed={favorito}
        >
          <i className={`fi ${favorito ? 'fi-sr-heart' : 'fi-rr-heart'}`} aria-hidden="true" />
        </button>

        {imagen ? (
          <>
            <Link
              to={`/producto/${producto.id}`}
              className="producto__media-link"
              aria-label={`Ver ${producto.nombre}`}
            >
              <img src={imagen} alt={producto.nombre} loading="lazy" />
            </Link>
            <button
              type="button"
              className="producto__zoom-fab"
              onClick={() => setZoom(true)}
              aria-label={`Ampliar imagen de ${producto.nombre}`}
            >
              <i className="fi fi-rr-zoom-in" aria-hidden="true" />
            </button>
          </>
        ) : (
          <Link to={`/producto/${producto.id}`} className="producto__media-link" aria-label={`Ver ${producto.nombre}`}>
            <i className="fi fi-rr-utensils producto__icono" aria-hidden="true" />
          </Link>
        )}

        <span className="producto__categoria">{producto.categoria}</span>
        {descuento > 0 && <span className="producto__flag">{descuento}% OFF</span>}
        {topRank > 0 && <span className="producto__flag top-rank" title="Producto más vendido">TOP {topRank} u.</span>}

        <button
          type="button"
          className={`producto__carrito-fab ${agregado ? 'producto__carrito-fab--ok' : ''}`}
          onClick={sumar}
          disabled={sinStock}
          aria-label={sinStock ? 'Sin stock' : `Agregar ${producto.nombre} al carrito`}
          title={sinStock ? 'Sin stock' : 'Agregar al carrito'}
        >
          <i className={`fi ${agregado ? 'fi-rr-check' : 'fi-rr-shopping-cart'}`} aria-hidden="true" />
        </button>
        {mediaExtras}
      </div>

      <div className="producto__cuerpo">
        <h3 className="producto__nombre">
          <Link to={`/producto/${producto.id}`}>{producto.nombre}</Link>
        </h3>
        <p className="producto__descripcion">{producto.descripcion || 'Electrodoméstico de cocina.'}</p>
        {Number(producto.cantidad_resenas) > 0 && (
          <p className="producto__rating">
            <Stars promedio={producto.promedio_resenas} cantidad={producto.cantidad_resenas} />
          </p>
        )}

        <div className="producto__precios">
          {descuento > 0 && <p className="producto__listado">{dinero(producto.precio_tachado)}</p>}
          <p className="producto__precio" data-testid="precio">
            {dinero(producto.precio)}
          </p>
          {producto.precio > 0 && (
            <p className="producto__cuota">12 cuotas de {dinero(cuotaMensual)}</p>
          )}
          {Number(producto.precio) >= 150000 && (
            <p className="producto__envio-gratis">
              <i className="fi fi-rr-truck-side" aria-hidden="true" /> Envío gratis
            </p>
          )}
        </div>

      </div>

      {zoom && <Lightbox src={imagen} alt={producto.nombre} onClose={() => setZoom(false)} />}
    </article>
  )
}
