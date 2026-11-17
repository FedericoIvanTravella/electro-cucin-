import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import Revelar from '../components/Revelar'
import { GrillaSkeleton } from '../components/SkeletonProducto'
import EstadoVacio from '../components/EstadoVacio'
import { api } from '../lib/api'
import { ahorroPorcentaje, dinero } from '../lib/format'

const INICIAL = { busqueda: '', categorias: [], min: '', max: '', soloStock: false, conDescuento: false }
const POR_PAGINA = 18

export default function Productos() {
  const [params] = useSearchParams()
  const categoriaInicial = params.get('categoria')
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtros, setFiltros] = useState(
    categoriaInicial ? { ...INICIAL, categorias: [categoriaInicial] } : INICIAL
  )
  const [orden, setOrden] = useState('relevancia')
  const [pagina, setPagina] = useState(1)
  const [ladoAbierto, setLadoAbierto] = useState(false)
  const [indiceSugerencia, setIndiceSugerencia] = useState(-1)
  const [sugerenciasAbiertas, setSugerenciasAbiertas] = useState(false)

  useEffect(() => {
    const controlador = new AbortController()
    api('/productos', { signal: controlador.signal })
      .then((data) => {
        setProductos(data.productos)
        setError('')
      })
      .catch((e) => {
        if (controlador.signal.aborted) return
        setError(e.message)
      })
      .finally(() => {
        if (!controlador.signal.aborted) setCargando(false)
      })
    return () => controlador.abort()
  }, [])

  const sugerencias = useMemo(() => {
    const texto = filtros.busqueda.trim().toLowerCase()
    if (texto.length < 2) return []
    return productos
      .filter((p) => `${p.nombre} ${p.descripcion} ${p.categoria}`.toLowerCase().includes(texto))
      .slice(0, 8)
  }, [filtros.busqueda, productos])

  const categorias = useMemo(() => {
    const mapa = new Map()
    for (const p of productos) mapa.set(p.categoria, (mapa.get(p.categoria) || 0) + 1)
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [productos])

  const visibles = useMemo(() => {
    const texto = filtros.busqueda.trim().toLowerCase()
    let resultado = productos.filter((p) => {
      if (texto && !`${p.nombre} ${p.descripcion} ${p.categoria}`.toLowerCase().includes(texto)) return false
      if (filtros.categorias.length && !filtros.categorias.includes(p.categoria)) return false
      if (filtros.soloStock && p.stock <= 0) return false
      if (filtros.conDescuento && ahorroPorcentaje(p.precio, p.precio_tachado) === 0) return false
      if (filtros.min !== '' && p.precio < Number(filtros.min)) return false
      if (filtros.max !== '' && p.precio > Number(filtros.max)) return false
      return true
    })

    const copia = [...resultado]
    if (orden === 'precio-asc') copia.sort((a, b) => a.precio - b.precio)
    else if (orden === 'precio-desc') copia.sort((a, b) => b.precio - a.precio)
    else if (orden === 'descuento') {
      copia.sort(
        (a, b) =>
          ahorroPorcentaje(b.precio, b.precio_tachado) - ahorroPorcentaje(a.precio, a.precio_tachado)
      )
    } else {
      // Relevancia de la vidriera: primero las ofertas más fuertes.
      copia.sort(
        (a, b) =>
          ahorroPorcentaje(b.precio, b.precio_tachado) - ahorroPorcentaje(a.precio, a.precio_tachado) ||
          a.id - b.id
      )
    }
    return copia
  }, [productos, filtros, orden])

  const togglCategoria = (c) =>
    setFiltros((f) => ({
      ...f,
      categorias: f.categorias.includes(c)
        ? f.categorias.filter((x) => x !== c)
        : [...f.categorias, c]
    }))

  const cambiarFiltro = (parcial) => {
    setFiltros((f) => ({ ...f, ...parcial }))
    setPagina(1)
  }

  const limpiarFiltros = () => {
    setFiltros(INICIAL)
    setPagina(1)
  }

  const activos = filtros.busqueda || filtros.categorias.length || filtros.min || filtros.max || filtros.soloStock || filtros.conDescuento

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const desde = (paginaActual - 1) * POR_PAGINA
  const paginados = visibles.slice(desde, desde + POR_PAGINA)
  const hasta = Math.min(desde + POR_PAGINA, visibles.length)

  const cambiarPagina = (nueva) => {
    setPagina(nueva)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const numerosPagina = () => {
    if (totalPaginas <= 7) return Array.from({ length: totalPaginas }, (_, i) => i + 1)
    const numeros = [1]
    for (let i = Math.max(2, paginaActual - 1); i <= Math.min(totalPaginas - 1, paginaActual + 1); i++) {
      numeros.push(i)
    }
    if (!numeros.includes(2)) numeros.splice(1, 0, '…')
    if (numeros[numeros.length - 1] !== totalPaginas - 1) numeros.push('…')
    numeros.push(totalPaginas)
    return [...new Set(numeros)]
  }

  return (
    <div className="seccion">
      <div className="seccion__cabecera">
        <div>
          <h1>Pequeños electrodomésticos</h1>
          <p className="seccion__bajada">
            {cargando ? 'Cargando…' : `${visibles.length} productos en la tienda`}
          </p>
        </div>
        <button
          type="button"
          className="boton boton--fantasma filtros-movil"
          onClick={() => setLadoAbierto((v) => !v)}
        >
          <i className="fi fi-rr-menu-burger" aria-hidden="true" /> Filtros
        </button>
      </div>

      <div className="listado">
        <aside className={`filtros-laterales card ${ladoAbierto ? 'abierto' : ''}`}>
          <div className="filtros-laterales__cabecera">
            <h3>Filtrar por</h3>
            {activos && (
              <button type="button" className="enlace-quitar" onClick={limpiarFiltros}>
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="grupo-filtro">
            <h4>Buscar</h4>
            <div className="buscador-autocomplete">
              <input
                type="search"
                placeholder="Batidora, cafetera…"
                value={filtros.busqueda}
                autoComplete="off"
                role="combobox"
                aria-expanded={sugerenciasAbiertas && sugerencias.length > 0}
                aria-controls="sugerencias-productos"
                aria-autocomplete="list"
                onChange={(e) => {
                  cambiarFiltro({ busqueda: e.target.value })
                  setSugerenciasAbiertas(true)
                  setIndiceSugerencia(-1)
                }}
                onFocus={() => setSugerenciasAbiertas(true)}
                onBlur={() => setTimeout(() => setSugerenciasAbiertas(false), 150)}
                onKeyDown={(e) => {
                  if (!sugerenciasAbiertas || sugerencias.length === 0) return
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setIndiceSugerencia((i) => Math.min(sugerencias.length - 1, i + 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setIndiceSugerencia((i) => Math.max(0, i - 1))
                  } else if (e.key === 'Enter' && indiceSugerencia >= 0) {
                    e.preventDefault()
                    const elegido = sugerencias[indiceSugerencia]
                    cambiarFiltro({ busqueda: elegido.nombre })
                    setSugerenciasAbiertas(false)
                    setPagina(1)
                  } else if (e.key === 'Escape') {
                    setSugerenciasAbiertas(false)
                  }
                }}
              />
              {sugerenciasAbiertas && sugerencias.length > 0 && (
                <ul className="sugerencias" id="sugerencias-productos" role="listbox">
                  {sugerencias.map((s, i) => (
                    <li key={s.id} role="option" aria-selected={i === indiceSugerencia}>
                      <button
                        type="button"
                        className={`sugerencia ${i === indiceSugerencia ? 'sugerencia--activa' : ''}`}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          cambiarFiltro({ busqueda: s.nombre })
                          setSugerenciasAbiertas(false)
                          setPagina(1)
                        }}
                        onMouseEnter={() => setIndiceSugerencia(i)}
                      >
                        <span className="sugerencia__nombre">{s.nombre}</span>
                        <span className="sugerencia__meta">
                          {s.categoria} · {dinero(s.precio)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="grupo-filtro">
            <h4>Categoría</h4>
            {categorias.map(([categoria, cantidad]) => (
              <label key={categoria} className="checkbox-filtro">
                <input
                  type="checkbox"
                  checked={filtros.categorias.includes(categoria)}
                  onChange={() => { togglCategoria(categoria); setPagina(1) }}
                />
                <span>{categoria}</span>
                <em>{cantidad}</em>
              </label>
            ))}
          </div>

          <div className="grupo-filtro">
            <h4>Precio</h4>
            <div className="rango-precio">
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={filtros.min}
                onChange={(e) => cambiarFiltro({ min: e.target.value })}
              />
              <span>–</span>
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={filtros.max}
                onChange={(e) => cambiarFiltro({ max: e.target.value })}
              />
            </div>
          </div>

          <div className="grupo-filtro">
            <h4>Disponibilidad</h4>
            <label className="checkbox-filtro">
              <input
                type="checkbox"
                checked={filtros.soloStock}
                onChange={(e) => cambiarFiltro({ soloStock: e.target.checked })}
              />
              <span>Solo en stock</span>
            </label>
            <label className="checkbox-filtro">
              <input
                type="checkbox"
                checked={filtros.conDescuento}
                onChange={(e) => cambiarFiltro({ conDescuento: e.target.checked })}
              />
              <span>Solo con ofertas</span>
            </label>
          </div>
        </aside>

        <div className="listado__contenido">
          <div className="listado__barra">
            <span className="listado__resultados">
              {visibles.length === 0
                ? 'Sin resultados'
                : `Mostrando ${desde + 1}–${hasta} de ${visibles.length} ${
                    visibles.length === 1 ? 'producto' : 'productos'
                  }`}
            </span>
            <label className="campo campo--orden">
              <select value={orden} onChange={(e) => { setOrden(e.target.value); setPagina(1) }}>
                <option value="relevancia">Relevancia</option>
                <option value="nombre">Nombre (A-Z)</option>
                <option value="precio-asc">Menor precio</option>
                <option value="precio-desc">Mayor precio</option>
                <option value="descuento">Mayor descuento</option>
              </select>
            </label>
          </div>

          {error && <p className="alerta alerta--error">{error}</p>}

          {!cargando && visibles.length === 0 && !error && (
            <EstadoVacio
              titulo="No encontramos productos"
              mensaje="Probá con otros filtros o quitá la búsqueda: seguro hay algo rico esperándote."
              size={150}
            >
              <button
                type="button"
                className="boton boton--fantasma boton--grande"
                onClick={limpiarFiltros}
              >
                Limpiar filtros
              </button>
            </EstadoVacio>
          )}

          {cargando ? (
            <GrillaSkeleton cantidad={9} />
          ) : (
            <div className="grilla-productos">
              {paginados.map((p, i) => (
                <Revelar key={p.id} delay={(i % 6) * 70} className="revelar--item">
                  <ProductCard producto={p} />
                </Revelar>
              ))}
            </div>
          )}

          {totalPaginas > 1 && (
            <nav className="paginacion" aria-label="Paginación">
              <button
                type="button"
                className="paginacion__boton"
                disabled={paginaActual <= 1}
                onClick={() => cambiarPagina(paginaActual - 1)}
              >
                ‹ Anterior
              </button>
              {numerosPagina().map((n, i) =>
                n === '…' ? (
                  <span key={`el-${i}`} className="paginacion__puntos">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    className={`paginacion__boton ${n === paginaActual ? 'paginacion__boton--actual' : ''}`}
                    aria-current={n === paginaActual ? 'page' : undefined}
                    onClick={() => cambiarPagina(n)}
                  >
                    {n}
                  </button>
                )
              )}
              <button
                type="button"
                className="paginacion__boton"
                disabled={paginaActual >= totalPaginas}
                onClick={() => cambiarPagina(paginaActual + 1)}
              >
                Siguiente ›
              </button>
            </nav>
          )}
        </div>
      </div>
    </div>
  )
}