import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import Revelar from '../components/Revelar'
import { GrillaSkeleton } from '../components/SkeletonProducto'
import EstadoVacio from '../components/EstadoVacio'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { ahorroPorcentaje, dinero } from '../lib/format'

const INICIAL = { busqueda: '', categorias: [], subcategorias: [], min: '', max: '', soloStock: false, conDescuento: false, minEstrellas: 0 }
const POR_PAGINA = 18
const ICONO_CATEGORIA = {
  Cocción: 'fi-rr-pot',
  Preparación: 'fi-rr-blender',
  Cafetería: 'fi-rr-mug-hot',
  Limpieza: 'fi-rr-spray-can-sparkles'
}
const PRESETS_PRECIO = [
  { etiqueta: 'Hasta $100 mil', min: '', max: '100000' },
  { etiqueta: '$100k – $200k', min: '100000', max: '200000' },
  { etiqueta: '$200k – $400k', min: '200000', max: '400000' },
  { etiqueta: 'Más de $400k', min: '400000', max: '' }
]

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
  const [comparando, setComparando] = useState([])
  const [compararAbierto, setCompararAbierto] = useState(false)
  const { mostrar } = useToast()
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
      if (filtros.subcategorias.length && !filtros.subcategorias.includes(p.subcategoria)) return false
      if (filtros.minEstrellas && Number(p.promedio_resenas || 0) < filtros.minEstrellas) return false
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
    } else if (orden === 'mas-vendidos') {
      copia.sort((a, b) => (b.unidades_vendidas || 0) - (a.unidades_vendidas || 0))
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

  const cambiarCategoria = (categoria) => {
    setFiltros((f) => {
      const nueva = f.categorias.includes(categoria)
        ? f.categorias.filter((x) => x !== categoria)
        : [...f.categorias, categoria]
      return { ...f, categorias: nueva, subcategorias: [] }
    })
    setPagina(1)
  }

  const cambiarFiltro = (parcial) => {
    setFiltros((f) => ({ ...f, ...parcial }))
    setPagina(1)
  }

  const limpiarFiltros = () => {
    setFiltros(INICIAL)
    setPagina(1)
  }

  const activos = filtros.busqueda || filtros.categorias.length || filtros.subcategorias.length || filtros.min || filtros.max || filtros.soloStock || filtros.conDescuento || filtros.minEstrellas > 0

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const desde = (paginaActual - 1) * POR_PAGINA
  const paginados = visibles.slice(desde, desde + POR_PAGINA)
  const hasta = Math.min(desde + POR_PAGINA, visibles.length)

  const cambiarPagina = (nueva) => {
    setPagina(nueva)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const productosSeleccionados = productos.filter((p) => comparando.includes(p.id))

  const quitarDeComparacion = (id) => setComparando((prev) => prev.filter((x) => x !== id))

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
            <h4><i className="fi fi-rr-tags" aria-hidden="true" /> Categoría</h4>
            <div className="cat-chips">
              {categorias.map(([categoria, cantidad]) => {
                const activa = filtros.categorias.includes(categoria)
                return (
                  <button
                    key={categoria}
                    type="button"
                    className={`chip-categoria ${activa ? 'chip-categoria--activo' : ''}`}
                    onClick={() => cambiarCategoria(categoria)}
                    aria-pressed={activa}
                  >
                    <i className={`fi ${ICONO_CATEGORIA[categoria] || 'fi-rr-tag'}`} aria-hidden="true" />
                    <span className="chip-categoria__nombre">{categoria}</span>
                    <span className="chip-categoria__cant">{cantidad}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {filtros.categorias.length > 0 && (
            <div className="grupo-filtro">
              <h4><i className="fi fi-rr-tags" aria-hidden="true" /> Subcategoría</h4>
              <div className="cat-chips">
                {[...new Set(productos.filter((p) => filtros.categorias.includes(p.categoria)).map((p) => p.subcategoria))]
                  .sort((a, b) => a.localeCompare(b))
                  .map((sub) => {
                    const activa = filtros.subcategorias.includes(sub)
                    const total = productos.filter((p) => filtros.categorias.includes(p.categoria) && p.subcategoria === sub).length
                    return (
                      <button
                        key={sub}
                        type="button"
                        className={`chip-categoria chip-categoria--sub ${activa ? 'chip-categoria--activo' : ''}`}
                        onClick={() => {
                          setFiltros((f) => ({
                            ...f,
                            subcategorias: f.subcategorias.includes(sub)
                              ? f.subcategorias.filter((x) => x !== sub)
                              : [...f.subcategorias, sub]
                          }))
                          setPagina(1)
                        }}
                        aria-pressed={activa}
                      >
                        <span className="chip-categoria__nombre">{sub}</span>
                        <span className="chip-categoria__cant">{total}</span>
                      </button>
                    )
                  })}
              </div>
            </div>
          )}

          <div className="grupo-filtro">
            <h4><i className="fi fi-rr-money" aria-hidden="true" /> Precio</h4>
            <div className="rango-precio">
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={filtros.min}
                onChange={(e) => cambiarFiltro({ min: e.target.value })}
                aria-label="Precio mínimo"
              />
              <span>–</span>
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={filtros.max}
                onChange={(e) => cambiarFiltro({ max: e.target.value })}
                aria-label="Precio máximo"
              />
            </div>
            <div className="precio-presets">
              {PRESETS_PRECIO.map((p) => {
                const activo = filtros.min === p.min && filtros.max === p.max && (p.max !== '' || p.min !== '')
                return (
                  <button
                    key={p.etiqueta}
                    type="button"
                    className={`preset ${activo ? 'preset--activo' : ''}`}
                    onClick={() => cambiarFiltro({ min: p.min, max: p.max })}
                  >
                    {p.etiqueta}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grupo-filtro">
            <h4><i className="fi fi-rr-check" aria-hidden="true" /> Disponibilidad</h4>
            <label className="radio-disponibilidad">
              <input
                type="checkbox"
                checked={filtros.soloStock}
                onChange={(e) => cambiarFiltro({ soloStock: e.target.checked })}
              />
              <span className="radio-disponibilidad__texto">
                <i className="fi fi-rr-truck-moving" aria-hidden="true" />
                Solo en stock
              </span>
            </label>
            <label className="radio-disponibilidad">
              <input
                type="checkbox"
                checked={filtros.conDescuento}
                onChange={(e) => cambiarFiltro({ conDescuento: e.target.checked })}
              />
              <span className="radio-disponibilidad__texto">
                <i className="fi fi-rr-badge-percent" aria-hidden="true" />
                Solo con ofertas
              </span>
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
                <option value="mas-vendidos">Más vendidos</option>
                <option value="precio-asc">Menor precio</option>
                <option value="precio-desc">Mayor precio</option>
                <option value="descuento">Mayor descuento</option>
              </select>
            </label>
          </div>

          <div className="top-chips" aria-label="Filtros rápidos">
            <button
              type="button"
              className={`top-chip ${filtros.conDescuento ? 'top-chip--activo' : ''}`}
              onClick={() => cambiarFiltro({ conDescuento: !filtros.conDescuento })}
            >
              <i className="fi fi-rr-badge-percent" aria-hidden="true" /> Ofertas
            </button>
            <button
              type="button"
              className={`top-chip ${filtros.minEstrellas === 4 ? 'top-chip--activo' : ''}`}
              onClick={() => cambiarFiltro({ minEstrellas: filtros.minEstrellas === 4 ? 0 : 4 })}
              title="Solo productos con 4 o más estrellas"
            >
              <i className="fi fi-rr-star" aria-hidden="true" /> 4★ o más
            </button>
            <button
              type="button"
              className={`top-chip ${filtros.minEstrellas === 3 ? 'top-chip--activo' : ''}`}
              onClick={() => cambiarFiltro({ minEstrellas: filtros.minEstrellas === 3 ? 0 : 3 })}
              title="Solo productos con 3 o más estrellas"
            >
              <i className="fi fi-rr-star" aria-hidden="true" /> 3★ o más
            </button>
            <button
              type="button"
              className={`top-chip ${filtros.soloStock ? 'top-chip--activo' : ''}`}
              onClick={() => cambiarFiltro({ soloStock: !filtros.soloStock })}
            >
              <i className="fi fi-rr-truck-moving" aria-hidden="true" /> Solo en stock
            </button>
            <button
              type="button"
              className={`top-chip ${orden === 'mas-vendidos' ? 'top-chip--activo' : ''}`}
              onClick={() => { setOrden('mas-vendidos'); setPagina(1) }}
            >
              <i className="fi fi-rr-box" aria-hidden="true" /> Más vendidos
            </button>
            <button
              type="button"
              className={`top-chip ${orden === 'descuento' ? 'top-chip--activo' : ''}`}
              onClick={() => { setOrden('descuento'); setPagina(1) }}
            >
              <i className="fi fi-rr-percentage" aria-hidden="true" /> Mejor descuento
            </button>
            <button
              type="button"
              className={`top-chip ${orden === 'precio-asc' ? 'top-chip--activo' : ''}`}
              onClick={() => { setOrden('precio-asc'); setPagina(1) }}
            >
              <i className="fi fi-rr-sort-amount-up" aria-hidden="true" /> Menor precio
            </button>
            <button
              type="button"
              className={`top-chip ${(filtros.min !== '' || filtros.max !== '') ? 'top-chip--activo' : ''}`}
              onClick={() => cambiarFiltro({ min: '', max: '100000' })}
            >
              <i className="fi fi-rr-money" aria-hidden="true" /> Hasta $100k
            </button>
            <button
              type="button"
              className="top-chip top-chip--limpiar"
              onClick={limpiarFiltros}
              disabled={!activos && orden === 'relevancia'}
            >
              <i className="fi fi-rr-refresh" aria-hidden="true" /> Limpiar
            </button>
          </div>

          {(filtros.busqueda || filtros.categorias.length > 0 || filtros.subcategorias.length > 0 || filtros.min || filtros.max || filtros.soloStock || filtros.conDescuento) && (
            <div className="filtros-activos" aria-label="Filtros activos">
              <span className="filtros-activos__label">Filtros activos:</span>
              {filtros.busqueda && (
                <button type="button" className="filtro-activo" onClick={() => cambiarFiltro({ busqueda: '' })}>
                  “{filtros.busqueda}” <i className="fi fi-rr-x" aria-hidden="true" />
                </button>
              )}
              {filtros.categorias.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="filtro-activo"
                  onClick={() => cambiarFiltro({ categorias: filtros.categorias.filter((x) => x !== c), subcategorias: [] })}
                >
                  {c} <i className="fi fi-rr-x" aria-hidden="true" />
                </button>
              ))}
              {filtros.subcategorias.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="filtro-activo"
                  onClick={() => cambiarFiltro({ subcategorias: filtros.subcategorias.filter((x) => x !== s) })}
                >
                  {s} <i className="fi fi-rr-x" aria-hidden="true" />
                </button>
              ))}
              {filtros.min && (
                <button type="button" className="filtro-activo" onClick={() => cambiarFiltro({ min: '' })}>
                  Desde {dinero(filtros.min)} <i className="fi fi-rr-x" aria-hidden="true" />
                </button>
              )}
              {filtros.max && (
                <button type="button" className="filtro-activo" onClick={() => cambiarFiltro({ max: '' })}>
                  Hasta {dinero(filtros.max)} <i className="fi fi-rr-x" aria-hidden="true" />
                </button>
              )}
              {filtros.soloStock && (
                <button type="button" className="filtro-activo" onClick={() => cambiarFiltro({ soloStock: false })}>
                  Solo en stock <i className="fi fi-rr-x" aria-hidden="true" />
                </button>
              )}
              {filtros.conDescuento && (
                <button type="button" className="filtro-activo" onClick={() => cambiarFiltro({ conDescuento: false })}>
                  Solo con ofertas <i className="fi fi-rr-x" aria-hidden="true" />
                </button>
              )}
              {filtros.minEstrellas > 0 && (
                <button type="button" className="filtro-activo" onClick={() => cambiarFiltro({ minEstrellas: 0 })}>
                  {filtros.minEstrellas}+ estrellas <i className="fi fi-rr-x" aria-hidden="true" />
                </button>
              )}
            </div>
          )}

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
                  <div className="comparar-item">
                    <ProductCard
                      producto={p}
                      mediaExtras={
                        <button
                          type="button"
                          className={`comparar-toggle ${comparando.includes(p.id) ? 'comparar-toggle--activo' : ''}`}
                          onClick={() =>
                            setComparando((prev) => {
                              if (prev.includes(p.id)) return prev.filter((id) => id !== p.id)
                              if (prev.length >= 3) {
                                mostrar('Solo podés comparar hasta 3 productos.', 'error')
                                return prev
                              }
                              return [...prev, p.id]
                            })
                          }
                          aria-pressed={comparando.includes(p.id)}
                          aria-label={comparando.includes(p.id) ? 'Quitar de la comparación' : 'Agregar a la comparación'}
                          title={comparando.includes(p.id) ? 'Quitar de la comparación' : 'Agregar a la comparación'}
                        >
                          <i className="fi fi-rr-columns-3" aria-hidden="true" />
                        </button>
                      }
                    />
                  </div>
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

      {comparando.length > 0 && (
        <aside className="comparar-bar" aria-label="Barra de comparación">
          <div className="contenedor comparar-bar__interior">
            <div className="comparar-bar__productos">
              {productosSeleccionados.map((p) => (
                <span key={p.id} className="comparar-bar__nav">
                  <span>{p.nombre.slice(0, 42)}{p.nombre.length > 42 ? '…' : ''}</span>
                  <button type="button" onClick={() => quitarDeComparacion(p.id)} aria-label="Quitar de la comparación">
                    <i className="fi fi-rr-x" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
            <div className="comparar-bar__acciones">
              <button type="button" className="boton boton--fantasma boton--chico" onClick={() => setComparando([])}>
                Limpiar
              </button>
              <button
                type="button"
                className="boton boton--primario"
                disabled={comparando.length < 2}
                onClick={() => setCompararAbierto(true)}
              >
                <i className="fi fi-rr-columns-3" aria-hidden="true" /> Comparar ({comparando.length})
              </button>
            </div>
          </div>
        </aside>
      )}

      {compararAbierto && comparando.length >= 2 && (
        <div
          className="comparar-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Comparación de productos"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCompararAbierto(false)
          }}
        >
          <div className="card comparar-modal__panel">
            <header className="comparar-modal__cabecera">
              <h2>Comparar productos</h2>
              <button type="button" className="boton boton--fantasma boton--chico" onClick={() => setCompararAbierto(false)} aria-label="Cerrar">
                <i className="fi fi-rr-x" aria-hidden="true" /> Cerrar
              </button>
            </header>

            <div className="comparar-modal__scroll">
              <div className="comparar-grid" style={{ gridTemplateColumns: `10rem repeat(${productosSeleccionados.length}, minmax(160px, 1fr))` }}>
                <div className="comparar-grid__esquina"></div>
                {productosSeleccionados.map((p) => (
                  <div key={`head-${p.id}`} className="comparar-grid__celda comparar-grid__celda--head">
                    <button type="button" className="comparar-quitar" onClick={() => quitarDeComparacion(p.id)} aria-label="Quitar">
                      <i className="fi fi-rr-x" aria-hidden="true" />
                    </button>
                    {p.imagen && (String(p.imagen) === '0' || /\d+/.test(String(p.imagen))) ? (
                      <img src={`/productos/${String(p.imagen).replace(/[^\d]/g, '') || p.imagen}.jpg`} alt={p.nombre} />
                    ) : (
                      <span className="comparar-icono" aria-hidden="true"><i className="fi fi-rr-utensils" /></span>
                    )}
                    <strong className="comparar-nombre">{p.nombre}</strong>
                    <input type="hidden" aria-hidden="true" value={p.id} readOnly />
                  </div>
                ))}

                {[
                  ['Categoría', (p) => p.categoria],
                  ['Subcategoría', (p) => p.subcategoria || '—'],
                  ['Precio', (p) => dinero(p.precio)],
                  ['Precio anterior', (p) => Number(p.precio_tachado) > Number(p.precio) ? dinero(p.precio_tachado) : '—'],
                  ['Descuento', (p) => ahorroPorcentaje(p.precio, p.precio_tachado) > 0 ? `${ahorroPorcentaje(p.precio, p.precio_tachado)}% OFF` : '—'],
                  ['12 cuotas', (p) => `12 × ${dinero(Math.max(0, p.precio / 12))} sin interés`],
                  ['Envío gratis', (p) => Number(p.precio) >= 150000 ? 'Sí' : 'No (+costo)'],
                  ['Garantía', () => '2 años oficial'],
                  ['Stock', (p) => p.stock > 0 ? `${p.stock} u.` : 'Sin stock'],
                  ['Rating', (p) => Number(p.cantidad_resenas) > 0 ? `⭐ ${Number(p.promedio_resenas).toFixed(1)} (${p.cantidad_resenas})` : 'Sin reseñas']
                ].map(([etiqueta, valor]) => (
                  <FragmentRow key={etiqueta} etiqueta={etiqueta} productos={productosSeleccionados} valor={valor} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FragmentRow({ etiqueta, productos, valor }) {
  return (
    <>
      <div className="comparar-grid__label">{etiqueta}</div>
      {productos.map((p) => (
        <div key={`${etiqueta}-${p.id}`} className="comparar-grid__celda">{valor(p)}</div>
      ))}
    </>
  )
}