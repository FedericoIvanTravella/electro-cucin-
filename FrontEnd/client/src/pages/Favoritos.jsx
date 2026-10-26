import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { GrillaSkeleton } from '../components/SkeletonProducto'
import EstadoVacio from '../components/EstadoVacio'
import { useFavoritos } from '../context/FavoritosContext'
import { api } from '../lib/api'

export default function Favoritos() {
  const { favoritos, limpiar } = useFavoritos()
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    api('/productos')
      .then((data) => setProductos(data.productos))
      .catch(() => setProductos([]))
      .finally(() => setCargando(false))
  }, [])

  const elegidos = productos.filter((p) => favoritos.includes(p.id))

  return (
    <div className="seccion">
      <div className="seccion__cabecera">
        <div>
          <h1>Mis favoritos</h1>
          <p className="seccion__bajada">
            {favoritos.length === 0
              ? 'Todavía no guardaste productos.'
              : `Tenés ${favoritos.length} ${favoritos.length === 1 ? 'producto' : 'productos'} guardados.`}
          </p>
        </div>
        {favoritos.length > 0 && (
          <button type="button" className="boton boton--fantasma" onClick={limpiar}>
            Vaciar favoritos
          </button>
        )}
      </div>

      {cargando && <GrillaSkeleton cantidad={4} />}

      {!cargando && favoritos.length === 0 && (
        <EstadoVacio
          titulo="Todavía no guardaste favoritos"
          mensaje="Marcá productos con el corazón ♥ para verlos acá cuando quieras."
        >
          <Link to="/productos" className="boton boton--primario boton--grande">
            Ver productos
          </Link>
        </EstadoVacio>
      )}

      <div className="grilla-productos">
        {elegidos.map((p) => (
          <ProductCard key={p.id} producto={p} />
        ))}
      </div>
    </div>
  )
}
