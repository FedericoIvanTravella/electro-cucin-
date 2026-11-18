import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import Revelar from '../components/Revelar'
import Lightbox from '../components/Lightbox'
import Stars from '../components/Stars'
import { GrillaSkeleton } from '../components/SkeletonProducto'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useFavoritos } from '../context/FavoritosContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { ahorroPorcentaje, cuota, dinero, fecha, imagenProducto } from '../lib/format'

// Página de detalle de producto, al estilo MercadoLibre:
// galería, precio con descuento, cuotas, stock, cantidad, comprar,
// garantías y productos relacionados (misma categoría).
export default function Producto() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const { agregar } = useCart()
  const { esFavorito, alternar } = useFavoritos()
  const { mostrar } = useToast()

  const [producto, setProducto] = useState(null)
  const [relacionados, setRelacionados] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [zoom, setZoom] = useState(false)
  const [resenas, setResenas] = useState([])
  const [resumen, setResumen] = useState(null)
  const [compro, setCompro] = useState(null)
  const [miEstrellas, setMiEstrellas] = useState(0)
  const [miComentario, setMiComentario] = useState('')
  const [enviandoResena, setEnviandoResena] = useState(false)
  const [errorResena, setErrorResena] = useState('')
  const [resenaEnviada, setResenaEnviada] = useState(false)
  const [avisoEmail, setAvisoEmail] = useState('')
  const [avisoCargando, setAvisoCargando] = useState(false)
  const [avisoMensaje, setAvisoMensaje] = useState('')

  useEffect(() => {
    const controlador = new AbortController()
    setCargando(true)
    setError('')
    setProducto(null)
    setCantidad(1)

    api(`/productos/${id}`, { signal: controlador.signal })
      .then((data) => {
        setProducto(data.producto)
        try {
          const vista = { id: data.producto.id, nombre: data.producto.nombre, precio: data.producto.precio, imagen: data.producto.imagen, categoria: data.producto.categoria, stock: data.producto.stock, descripcion: data.producto.descripcion, precio_tachado: data.producto.precio_tachado }
          const vistos = JSON.parse(localStorage.getItem('ec_vistos') || '[]').filter((v) => v.id !== vista.id)
          localStorage.setItem('ec_vistos', JSON.stringify([vista, ...vistos].slice(0, 6)))
        } catch {
          void 0
        }
        return api(`/productos?categoria=${encodeURIComponent(data.producto.categoria)}&soloStock=1`, {
          signal: controlador.signal
        })
      })
      .then((data) => {
        if (!data) return
        setRelacionados(data.productos.filter((p) => String(p.id) !== String(id)).slice(0, 4))
      })
      .catch((err) => {
        if (controlador.signal.aborted) return
        setError(err?.message || 'No se pudo cargar el producto.')
      })
      .finally(() => {
        if (!controlador.signal.aborted) setCargando(false)
      })

    return () => controlador.abort()
  }, [id])

  useEffect(() => {
    if (!producto) return
    const controlador = new AbortController()
    api(`/productos/${producto.id}/resenas`, { signal: controlador.signal })
      .then((data) => {
        setResenas(data.resenas || [])
        setResumen(data.resumen || null)
        const mia = usuario ? data.resenas.find((r) => r.usuario_id === usuario.id) : null
        if (mia) {
          setMiEstrellas(mia.estrellas)
          setMiComentario(mia.comentario || '')
        }
      })
      .catch(() => {})
    if (usuario) {
      api('/ventas/mias?por_pagina=100', { signal: controlador.signal })
        .then((data) => {
          const comproEste = (data.ventas || []).some((v) => (v.items || []).some((i) => i.producto_id === producto.id))
          setCompro(comproEste)
        })
        .catch(() => setCompro(false))
    }
    return () => controlador.abort()
  }, [producto, usuario])

  const enviarAviso = async (e) => {
    e.preventDefault()
    const correo = (avisoEmail || usuario?.email || '').trim()
    if (!correo || !producto) return
    setAvisoCargando(true)
    setAvisoMensaje('')
    try {
      const data = await api('/avisos', { method: 'POST', body: { producto_id: producto.id, email: correo } })
      setAvisoMensaje(data?.mensaje || 'Aviso registrado.')
    } catch (err) {
      setAvisoMensaje(err?.message || 'No pudimos guardar tu correo.')
    } finally {
      setAvisoCargando(false)
    }
  }

  const enviarResena = async (e) => {
    e.preventDefault()
    if (!miEstrellas) {
      setErrorResena('Elegí cuántas estrellas.')
      return
    }
    setEnviandoResena(true)
    setErrorResena('')
    try {
      await api(`/productos/${producto.id}/resenas`, {
        method: 'POST',
        body: { estrellas: miEstrellas, comentario: miComentario }
      })
      const data = await api(`/productos/${producto.id}/resenas`)
      setResenas(data.resenas || [])
      setResumen(data.resumen || null)
      setResenaEnviada(true)
      mostrar('¡Gracias! Tu reseña fue publicada.', 'exito')
      setTimeout(() => setResenaEnviada(false), 2500)
    } catch (err) {
      setErrorResena(err?.message || 'No se pudo publicar la reseña.')
    } finally {
      setEnviandoResena(false)
    }
  }

  if (cargando) return <GrillaSkeleton cantidad={1} />
  if (error || !producto) {
    return (
      <div className="card aviso aviso--error">
        <h1>Producto no encontrado</h1>
        <p>{error || 'Este producto no existe o ya no está disponible.'}</p>
        <Link to="/productos" className="boton boton--primario">
          Volver al catálogo
        </Link>
      </div>
    )
  }

  const sinStock = producto.stock <= 0
  const imagen = imagenProducto(producto)
  const descuento = ahorroPorcentaje(producto.precio, producto.precio_tachado)
  const cuotaMensual = cuota(producto.precio)
  const favorito = esFavorito(producto.id)
  const descuento65 = usuario?.descuento?.activo ? usuario.descuento.porcentaje : 0

  const sumar = () => {
    if (sinStock) return
    const agregado = agregar(producto, cantidad)
    if (agregado) {
      mostrar(`${producto.nombre} se agregó al carrito`, 'exito')
    } else {
      mostrar('No hay más stock disponible de este producto.', 'error')
    }
  }

  const comprarAhora = () => {
    if (sinStock) return
    agregar(producto, cantidad)
    navigate('/pago')
  }

  const marcar = () => {
    alternar(producto.id)
    mostrar(
      favorito ? `${producto.nombre} quitado de favoritos` : `${producto.nombre} en favoritos`,
      'info'
    )
  }

  return (
    <article className="pdp">
      {/* ---------- Migas de pan ---------- */}
      <nav className="pdp-migas" aria-label="Migas de pan">
        <Link to="/">Inicio</Link>
        <i className="fi fi-rr-angle-right" aria-hidden="true" />
        <Link to="/productos">Productos</Link>
        <i className="fi fi-rr-angle-right" aria-hidden="true" />
        <Link to={`/productos?categoria=${encodeURIComponent(producto.categoria)}`}>
          {producto.categoria}
        </Link>
        <i className="fi fi-rr-angle-right" aria-hidden="true" />
        <span aria-current="page">{producto.nombre}</span>
      </nav>

      <div className="pdp-layout">
        {/* ---------- Galería ---------- */}
        <div className="card pdp-galeria">
          <div className="pdp-media">
            {descuento > 0 && <span className="pdp-flag">{descuento}% OFF</span>}
            {imagen ? (
              <button
                type="button"
                className="pdp-zoom"
                onClick={() => setZoom(true)}
                aria-label={`Ampliar imagen de ${producto.nombre}`}
              >
                <img src={imagen} alt={producto.nombre} />
              </button>
            ) : (
              <span className="pdp-icono" aria-hidden="true">
                <i className="fi fi-rr-utensils" />
              </span>
            )}
          </div>
          <p className="pdp-id">Publicación #{producto.id}</p>
        </div>

        {/* ---------- Información de compra ---------- */}
        <div className="card pdp-info">
          <div className="pdp-info__cabecera">
            <div>
              <p className="pdp-info__condicion">
                Nuevo{producto.stock > 0 && ` · Stock disponible: ${producto.stock} unidades`}
              </p>
              <h1 className="pdp-info__titulo">{producto.nombre}</h1>
            </div>
            <button
              type="button"
              className={`pdp-favorito ${favorito ? 'pdp-favorito--activo' : ''}`}
              onClick={marcar}
              aria-label={favorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              aria-pressed={favorito}
            >
              <i className={`fi ${favorito ? 'fi-sr-heart' : 'fi-rr-heart'}`} aria-hidden="true" />
            </button>
          </div>

          {/* ---------- Precio ---------- */}
          <div className="pdp-precio">
            {descuento > 0 && <p className="pdp-precio__tachado">{dinero(producto.precio_tachado)}</p>}
            <div className="pdp-precio__fila">
              <p className="pdp-precio__actual">{dinero(producto.precio)}</p>
              {descuento > 0 && <span className="pdp-precio__off">{descuento}% OFF</span>}
            </div>
            {producto.precio > 0 && (
              <p className="pdp-precio__cuotas">en 12x {dinero(cuotaMensual)} sin interés</p>
            )}
            {descuento65 > 0 && (
              <p className="pdp-precio__65">
                <i className="fi fi-rr-person-walking-with-cane" aria-hidden="true" /> Tenés{' '}
                {descuento65}% de descuento por tener 65 años o más (se aplica en el pago).
              </p>
            )}
            {Number(producto.precio) >= 150000 && (
              <p className="pdp-envio-gratis">
                <i className="fi fi-rr-truck-side" aria-hidden="true" /> Envío gratis en este producto
              </p>
            )}
          </div>

          {/* ---------- Beneficios rápidos ---------- */}
          <ul className="pdp-beneficios">
            <li>
              <i className="fi fi-rr-shipping-fast" aria-hidden="true" /> Envío gratis en compras
              superiores a $150.000
            </li>
            <li>
              <i className="fi fi-rr-shield-check" aria-hidden="true" /> 2 años de garantía oficial
            </li>
            <li>
              <i className="fi fi-rr-undo" aria-hidden="true" /> 30 días para cambios y devoluciones
            </li>
          </ul>

          {/* ---------- Cantidad y acciones ---------- */}
          {!sinStock && (
            <div className="pdp-cantidad">
              <span>Cantidad:</span>
              <div className="cantidad">
                <button
                  type="button"
                  onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                  aria-label="Quitar una unidad"
                >
                  <i className="fi fi-rr-minus" aria-hidden="true" />
                </button>
                <input
                  type="number"
                  min="1"
                  max={producto.stock}
                  value={cantidad}
                  onChange={(e) =>
                    setCantidad(Math.min(producto.stock, Math.max(1, Number(e.target.value) || 1)))
                  }
                  aria-label="Cantidad de unidades"
                />
                <button
                  type="button"
                  onClick={() => setCantidad((c) => Math.min(producto.stock, c + 1))}
                  disabled={cantidad >= producto.stock}
                  aria-label="Agregar una unidad"
                >
                  <i className="fi fi-rr-plus" aria-hidden="true" />
                </button>
              </div>
              <small>({producto.stock} disponibles)</small>
            </div>
          )}

          {sinStock ? (
            <div className="pdp-sinstock-box">
              <p className="pdp-sinstock">
                <i className="fi fi-rr-triangle-warning" aria-hidden="true" /> Sin stock por el
                momento. Volvé a consultar pronto o dejanos tu correo y te avisamos cuando vuelva.
              </p>
              {avisoMensaje ? (
                <p className="alerta alerta--exito"><i className="fi fi-rr-check" aria-hidden="true" /> {avisoMensaje}</p>
              ) : (
                <form className="pdp-aviso-form" onSubmit={enviarAviso}>
                  <input
                    type="email"
                    required
                    value={avisoEmail || usuario?.email || ''}
                    onChange={(e) => {
                      setAvisoEmail(e.target.value)
                      setAvisoMensaje('')
                    }}
                    placeholder="tu@correo.com"
                    aria-label="Correo para aviso de stock"
                  />
                  <button type="submit" className="boton boton--primario" disabled={avisoCargando}>
                    <i className="fi fi-rr-bell" aria-hidden="true" /> {avisoCargando ? 'Guardando…' : 'Avisame cuando vuelva'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="pdp-acciones">
              <button
                type="button"
                className="boton boton--primario boton--grande"
                onClick={comprarAhora}
              >
                <i className="fi fi-rr-bolt" aria-hidden="true" /> Comprar ahora
              </button>
              <button type="button" className="boton boton--secundario boton--grande" onClick={sumar}>
                <i className="fi fi-rr-shopping-cart-add" aria-hidden="true" /> Agregar al carrito
              </button>
            </div>
          )}

          {/* ---------- Vendedor ---------- */}
          <div className="pdp-vendedor">
            <i className="fi fi-rr-store-alt" aria-hidden="true" />
            <div>
              <strong>Electro Cuciné</strong>
              <p>Tienda oficial · Ventas en todo el país desde 2009</p>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Descripción completa ---------- */}
      <section className="card pdp-descripcion">
        <h2>Lo que tenés que saber de este producto</h2>
        <p>{producto.descripcion || 'Electrodoméstico de cocina de la línea Electro Cuciné.'}</p>
        <ul>
          <li>
            <i className="fi fi-rr-check" aria-hidden="true" /> Categoría: {producto.categoria}
          </li>
          <li>
            <i className="fi fi-rr-check" aria-hidden="true" /> Servicio técnico oficial en todo el
            país
          </li>
          <li>
            <i className="fi fi-rr-check" aria-hidden="true" /> Garantía de {2} años con factura de
            compra
          </li>
          <li>
            <i className="fi fi-rr-check" aria-hidden="true" /> Envíos a todo el país; seguimiento en
            “Mis compras”
          </li>
        </ul>
      </section>

      {/* ---------- Reseñas de compradores ---------- */}
      <section className="card pdp-resenas" id="resenas">
        <h2>Reseñas de compradores</h2>
        <div className="resenas__cuerpo">
          <div className="resenas__resumen">
            <p className="resenas__promedio">{resumen ? resumen.promedio.toFixed(1) : '—'}</p>
            <Stars promedio={resumen?.promedio || 0} className="estrellitas--grande" />
            <p className="resenas__cantidad">
              {resumen?.cantidad ? `${resumen.cantidad} ${resumen.cantidad === 1 ? 'reseña' : 'reseñas'}` : 'Nadie reseñó todavía'}
            </p>
          </div>
          <div className="resenas__barras" aria-hidden="true">
            {[['cinco', 5], ['cuatro', 4], ['tres', 3], ['dos', 2], ['uno', 1]].map(([clave, n]) => {
              const cantidad = resumen?.[clave] || 0
              const pct = resumen?.cantidad ? (cantidad / resumen.cantidad) * 100 : 0
              return (
                <div key={clave} className="resenas__fila">
                  <span className="resenas__fila-num">
                    {n} <i className="fi fi-sr-star" />
                  </span>
                  <div className="resenas__pista">
                    <div className="resenas__relleno" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="resenas__fila-cant">{cantidad}</span>
                </div>
              )
            })}
          </div>
        </div>

        {usuario && compro && (
          <form className="resenas__form" onSubmit={enviarResena}>
            <p className="resenas__form-titulo">¿Qué te pareció este producto?</p>
            <div className="resenas__stars-input" role="radiogroup" aria-label="Estrellas">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`resenas__star-btn ${n <= miEstrellas ? 'resenas__star-btn--on' : ''}`}
                  onClick={() => setMiEstrellas(n)}
                  aria-label={`${n} estrellas`}
                  aria-pressed={n <= miEstrellas}
                >
                  <i className={`fi ${n <= miEstrellas ? 'fi-sr-star' : 'fi-rr-star'}`} aria-hidden="true" />
                </button>
              ))}
            </div>
            <textarea
              className="resenas__textarea"
              rows="3"
              maxLength={500}
              placeholder="Contanos tu experiencia (opcional)…"
              value={miComentario}
              onChange={(e) => setMiComentario(e.target.value)}
            />
            {errorResena && <p className="alerta alerta--error">{errorResena}</p>}
            <button type="submit" className="boton boton--primario boton--chico" disabled={enviandoResena}>
              {resenaEnviada ? <><i className="fi fi-rr-check" aria-hidden="true" /> ¡Publicada!</> : enviandoResena ? 'Publicando…' : 'Publicar reseña'}
            </button>
          </form>
        )}
        {usuario && compro === false && (
          <p className="resenas__aviso"><i className="fi fi-rr-info" aria-hidden="true" /> Solo los compradores pueden valorar este producto.</p>
        )}
        {!usuario && (
          <p className="resenas__aviso">
            <i className="fi fi-rr-info" aria-hidden="true" /> <Link to="/login">Iniciá sesión</Link> y comprá para dejar tu reseña.
          </p>
        )}

        {resenas.length > 0 ? (
          <ul className="resenas__lista">
            {resenas.map((r) => (
              <li key={r.id} className="resena">
                <div className="resena__avatar" aria-hidden="true">
                  {(r.usuario_nombre || r.usuario_username || '?').charAt(0).toUpperCase()}
                </div>
                <div className="resena__cuerpo">
                  <div className="resena__encabezado">
                    <strong>{r.usuario_nombre || r.usuario_username}</strong>
                    <Stars promedio={r.estrellas} />
                    <span className="resena__fecha">{fecha(r.fecha)}</span>
                  </div>
                  {r.comentario && <p className="resena__comentario">{r.comentario}</p>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="aviso aviso--minimo">Todavía no hay reseñas. Cuando compres este producto vas a poder ser el primero.</p>
        )}
      </section>

      {/* ---------- Relacionados ---------- */}
      {relacionados.length > 0 && (
        <section className="seccion pdp-relacionados">
          <div className="seccion__cabecera">
            <div>
              <h2>Productos relacionados</h2>
              <p className="seccion__bajada">Más opciones de {producto.categoria} que te pueden interesar.</p>
            </div>
            <Link
              to={`/productos?categoria=${encodeURIComponent(producto.categoria)}`}
              className="boton boton--fantasma"
            >
              Ver todos
            </Link>
          </div>
          <div className="grilla-productos">
            {relacionados.map((p, i) => (
              <Revelar key={p.id} delay={i * 80} className="revelar--item">
                <ProductCard producto={p} />
              </Revelar>
            ))}
          </div>
        </section>
      )}

      {zoom && imagen && <Lightbox src={imagen} alt={producto.nombre} onClose={() => setZoom(false)} />}
    </article>
  )
}
