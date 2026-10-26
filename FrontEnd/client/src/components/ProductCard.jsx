import { useState } from 'react'
import { useCart } from '../context/CartContext'
import { useFavoritos } from '../context/FavoritosContext'
import { useToast } from '../context/ToastContext'
import Lightbox from './Lightbox'
import { ahorroPorcentaje, cuota, dinero, imagenProducto } from '../lib/format'

export default function ProductCard({ producto, destacado = false }) {
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
      <div className="producto__media">
        <button
          type="button"
          className={`producto__favorito ${favorito ? 'producto__favorito--activo' : ''}`}
          onClick={marcar}
          aria-label={favorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          aria-pressed={favorito}
        >
          {favorito ? '♥' : '♡'}
        </button>

        {imagen ? (
          <button
            type="button"
            className="producto__zoom"
            onClick={() => setZoom(true)}
            aria-label={`Ampliar imagen de ${producto.nombre}`}
          >
            <img src={imagen} alt={producto.nombre} loading="lazy" />
            <span className="producto__zoom-hint" aria-hidden="true">
              🔍
            </span>
          </button>
        ) : (
          <span className="producto__emoji" aria-hidden="true">
            {producto.imagen || '🍽️'}
          </span>
        )}

        <span className="producto__categoria">{producto.categoria}</span>
        {descuento > 0 && <span className="producto__flag">{descuento}% OFF</span>}
      </div>

      <div className="producto__cuerpo">
        <h3 className="producto__nombre">{producto.nombre}</h3>
        <p className="producto__descripcion">{producto.descripcion || 'Electrodoméstico de cocina.'}</p>

        <div className="producto__precios">
          {descuento > 0 && <p className="producto__listado">{dinero(producto.precio_tachado)}</p>}
          <p className="producto__precio" data-testid="precio">
            {dinero(producto.precio)}
          </p>
          {producto.precio > 0 && (
            <p className="producto__cuota">12 cuotas de {dinero(cuotaMensual)}</p>
          )}
        </div>

        <p className={`producto__stock ${sinStock ? 'producto__stock--sin' : producto.stock <= 5 ? 'producto__stock--bajo' : ''}`}>
          {sinStock ? 'Sin stock' : `Stock: ${producto.stock} unidades`}
        </p>

        <button
          type="button"
          className={`boton boton--primario boton--chico boton--bloque ${agregado ? 'boton--exito' : ''}`}
          onClick={sumar}
          disabled={sinStock}
        >
          {sinStock ? 'Sin stock' : agregado ? '✓ Agregado al carrito' : 'Agregar al carrito'}
        </button>
      </div>

      {zoom && <Lightbox src={imagen} alt={producto.nombre} onClose={() => setZoom(false)} />}
    </article>
  )
}
