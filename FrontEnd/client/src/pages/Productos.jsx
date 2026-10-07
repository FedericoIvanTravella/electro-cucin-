import { useEffect, useMemo, useState } from 'react'
import ProductCard from '../components/ProductCard'
import { api } from '../lib/api'

export default function Productos() {
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [orden, setOrden] = useState('nombre')

  useEffect(() => {
    const query = new URLSearchParams()
    if (busqueda) query.set('q', busqueda)
    if (categoria) query.set('categoria', categoria)

    const id = setTimeout(() => {
      setCargando(true)
      api(`/productos?${query.toString()}`)
        .then((data) => {
          setProductos(data.productos)
          setError('')
        })
        .catch((e) => setError(e.message))
        .finally(() => setCargando(false))
    }, busqueda ? 250 : 0)

    return () => clearTimeout(id)
  }, [busqueda, categoria])

  const categorias = useMemo(
    () => [...new Set(productos.map((p) => p.categoria))].sort(),
    [productos]
  )

  const visibles = useMemo(() => {
    const copia = [...productos]
    if (orden === 'precio-asc') copia.sort((a, b) => a.precio - b.precio)
    else if (orden === 'precio-desc') copia.sort((a, b) => b.precio - a.precio)
    else copia.sort((a, b) => a.nombre.localeCompare(b.nombre))
    return copia
  }, [productos, orden])

  return (
    <div className="seccion">
      <div className="seccion__cabecera">
        <div>
          <h1>Nuestros productos</h1>
          <p className="seccion__bajada">
            {visibles.length} electrodomésticos disponibles para tu cocina.
          </p>
        </div>
      </div>

      <div className="filtros card">
        <label className="campo campo--busqueda">
          <span>Buscar</span>
          <input
            type="search"
            placeholder="Batidora, cafetera, horno…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>

        <label className="campo">
          <span>Categoría</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          <span>Ordenar por</span>
          <select value={orden} onChange={(e) => setOrden(e.target.value)}>
            <option value="nombre">Nombre</option>
            <option value="precio-asc">Menor precio</option>
            <option value="precio-desc">Mayor precio</option>
          </select>
        </label>
      </div>

      {error && <p className="alerta alerta--error">{error}</p>}
      {cargando && <p className="aviso">Cargando catálogo…</p>}

      {!cargando && visibles.length === 0 && !error && (
        <p className="aviso">No encontramos productos con esos filtros.</p>
      )}

      <div className="grilla-productos">
        {visibles.map((p) => (
          <ProductCard key={p.id} producto={p} />
        ))}
      </div>
    </div>
  )
}
