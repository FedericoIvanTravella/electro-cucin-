import { useState } from 'react'
import { useCart } from '../context/CartContext'
import { dinero } from '../lib/format'

export default function ProductCard({ producto, destacado = false }) {
  const { agregar } = useCart()
  const [agregado, setAgregado] = useState(false)
  const sinStock = producto.stock <= 0

  const sumar = () => {
    agregar(producto, 1)
    setAgregado(true)
    setTimeout(() => setAgregado(false), 1200)
  }

  return (
    <article className={`producto ${destacado ? 'producto--destacado' : ''}`}>
      <div className="producto__media">
        {producto.imagen?.startsWith('http') ? (
          <img src={producto.imagen} alt={producto.nombre} />
        ) : (
          <span className="producto__emoji" aria-hidden="true">
            {producto.imagen || '🍽️'}
          </span>
        )}
        <span className="producto__categoria">{producto.categoria}</span>
      </div>

      <div className="producto__cuerpo">
        <h3 className="producto__nombre">{producto.nombre}</h3>
        <p className="producto__descripcion">{producto.descripcion || 'Electrodoméstico de cocina.'}</p>

        <div className="producto__pie">
          <div>
            <p className="producto__precio">{dinero(producto.precio)}</p>
            <p className={`producto__stock ${producto.stock <= 5 ? 'producto__stock--bajo' : ''}`}>
              {sinStock ? 'Sin stock' : `${producto.stock} disponibles`}
            </p>
          </div>
          <button
            type="button"
            className={`boton ${agregado ? 'boton--exito' : 'boton--primario'}`}
            onClick={sumar}
            disabled={sinStock}
          >
            {sinStock ? 'Agotado' : agregado ? '✓ Agregado' : 'Agregar'}
          </button>
        </div>
      </div>
    </article>
  )
}
