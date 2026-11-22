import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useFavoritos } from '../context/FavoritosContext'
import { useTema } from '../context/TemaContext'
import { useToast } from '../context/ToastContext'
import Nieve from './Nieve'
import Guirnalda from './Guirnalda'
import VolverArriba from './VolverArriba'
import ChatNero from './ChatNero'
import { api } from '../lib/api'

// Cuenta regresiva para Navidad (se calcula al cargar el módulo).
const diasNavidad = (() => {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const navidad = new Date(hoy.getFullYear(), 11, 25)
  if (hoy > navidad) navidad.setFullYear(navidad.getFullYear() + 1)
  return Math.round((navidad - hoy) / 86400000)
})()

// Barra superior: cinta de beneficios deslizante (marquee infinito).
const PROMOS = [
  { icono: 'fi-rr-shipping-fast', texto: 'Envío sin cargo en compras superiores a $150.000' },
  { icono: 'fi-rr-credit-card', texto: '12 cuotas sin interés con tarjetas seleccionadas' },
  ...(diasNavidad > 0 && diasNavidad <= 90
    ? [{ icono: 'fi-rr-calendar', texto: `Faltan ${diasNavidad} días para Navidad` }]
    : []),
  { icono: 'fi-rr-person-walking-with-cane', texto: '30% de descuento para mayores de 65 años' },
  { icono: 'fi-rr-shield-check', texto: '2 años de garantía en todos los productos' },
  { icono: 'fi-rr-gift', texto: 'Cupón NAVIDAD25: 25% OFF en todo el catálogo' }
]

function BarraPromos() {
  // El contenido se repite dos veces para que el bucle sea perfecto.
  const contenido = [...PROMOS, ...PROMOS]
  return (
    <div className="promos" aria-hidden="true">
      <div className="promos__track">
        {contenido.map((p, i) => (
          <span className="promos__item" key={i}>
            <i className={`fi ${p.icono}`} aria-hidden="true" /> {p.texto}
          </span>
        ))}
      </div>
    </div>
  )
}

// Barra fina arriba de todo que muestra cuánto del artículo se recorrió.
function BarraScroll() {
  const [progreso, setProgreso] = useState(0)

  useEffect(() => {
    let raf = 0
    const medir = () => {
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      setProgreso(max > 0 ? Math.min(1, window.scrollY / max) : 0)
    }
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(medir)
    }
    medir()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', medir)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', medir)
    }
  }, [])

  return (
    <div className="scroll-progreso" aria-hidden="true">
      <div className="scroll-progreso__relleno" style={{ transform: `scaleX(${progreso})` }} />
    </div>
  )
}

const BASE = import.meta.env.BASE_URL || '/'

function Navbar() {
  const { usuario, esAdmin, salir, revocarSesiones } = useAuth()
  const { totales } = useCart()
  const { cantidad: favs } = useFavoritos()
  const { tema, alternar, alternarNavideño } = useTema()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [cuentaAbierta, setCuentaAbierta] = useState(false)
  const cuentaRef = useRef(null)
  const ubicacion = useLocation()

  useEffect(() => {
    setMenuAbierto(false)
    setCuentaAbierta(false)
  }, [ubicacion.pathname])

  useEffect(() => {
    if (!cuentaAbierta) return
    const alHacerClic = (evento) => {
      if (cuentaRef.current && !cuentaRef.current.contains(evento.target)) setCuentaAbierta(false)
    }
    const alTeclear = (evento) => {
      if (evento.key === 'Escape') setCuentaAbierta(false)
    }
    document.addEventListener('mousedown', alHacerClic)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('mousedown', alHacerClic)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [cuentaAbierta])

  const cerrarCuenta = () => setCuentaAbierta(false)

  const salirYcerrar = async () => {
    cerrarCuenta()
    await salir()
  }

  const cerrarTodos = async () => {
    cerrarCuenta()
    try {
      await revocarSesiones()
    } catch {
      // si falla, igual cerramos del lado del cliente
    }
  }

  const alternarMenu = () => {
    setMenuAbierto((v) => !v)
    setCuentaAbierta(false)
  }

  const alternarCuenta = () => {
    setCuentaAbierta((v) => !v)
    setMenuAbierto(false)
  }

  const inicial = String(usuario?.nombre || usuario?.username || '?').trim().charAt(0).toUpperCase() || '?'
  const claseNav = ({ isActive }) => (isActive ? 'activo' : undefined)

  const apariencia = (
    <div className="cuenta-menu__apariencia">
      <p className="cuenta-menu__rotulo">Apariencia</p>
      <button type="button" className="cuenta-menu__opcion" onClick={alternar} aria-pressed={tema === 'oscuro'}>
        <i className={`fi ${tema === 'oscuro' ? 'fi-rr-sun' : 'fi-rr-moon'}`} aria-hidden="true" />
        <span>{tema === 'oscuro' ? 'Tema claro' : 'Tema oscuro'}</span>
        <span className="cuenta-menu__estado">{tema === 'oscuro' ? 'Sí' : 'No'}</span>
      </button>
      <button
        type="button"
        className="cuenta-menu__opcion"
        onClick={alternarNavideño}
        aria-pressed={tema === 'navideño'}
      >
        <i className="fi fi-rr-tree" aria-hidden="true" />
        <span>Modo navideño</span>
        <span className="cuenta-menu__estado">{tema === 'navideño' ? 'Sí' : 'No'}</span>
      </button>
    </div>
  )

  return (
    <header className="navbar">
      <div className="navbar__interior contenedor">
        <button
          type="button"
          className="navbar__hamburguesa"
          onClick={alternarMenu}
          aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuAbierto}
          aria-controls="menu-principal"
        >
          <i className={`fi ${menuAbierto ? 'fi-rr-cross-small' : 'fi-rr-menu-burger'}`} aria-hidden="true" />
        </button>

        <Link to="/" className="marca" aria-label="Electro Cuciné, ir al inicio">
          <svg className="marca__icono" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <path
              d="M9 21h30v9a8 8 0 0 1-8 8H17a8 8 0 0 1-8-8v-9Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <path
              d="M5 23h4M39 23h4M13 21c0-6 4.9-10 11-10s11 4 11 10M22 8h4M24 8V5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <path d="M26.5 24 20 33h5l-2.5 8L31 31h-5l3-7h-2.5Z" fill="currentColor" />
          </svg>
          <span className="marca__texto">
            <span className="marca__electro">Electro</span>
            <span className="marca__cucine">Cuciné</span>
          </span>
        </Link>

        <nav
          id="menu-principal"
          className={`navbar__nav ${menuAbierto ? 'abierto' : ''}`}
          aria-label="Navegación principal"
        >
          <NavLink to="/" end className={claseNav}>
            Inicio
          </NavLink>
          <NavLink to="/productos" className={claseNav}>
            Productos
          </NavLink>
          <NavLink to="/blog" className={claseNav}>
            Blog
          </NavLink>
          <NavLink to="/ayuda" className={claseNav}>
            Ayuda
          </NavLink>
        </nav>

        <div className="navbar__acciones" ref={cuentaRef}>
          <Link
            to="/favoritos"
            className="accion-icono"
            aria-label={`Favoritos${favs > 0 ? ` (${favs})` : ''}`}
            title="Favoritos"
          >
            <i className={`fi ${favs > 0 ? 'fi-sr-heart' : 'fi-rr-heart'}`} aria-hidden="true" />
            {favs > 0 && <span className="badge-accion">{favs}</span>}
          </Link>

          <div className="cuenta">
            <button
              type="button"
              className={`accion-icono accion-icono--cuenta ${cuentaAbierta ? 'accion-icono--activo' : ''}`}
              onClick={alternarCuenta}
              aria-label="Mi cuenta"
              title="Mi cuenta"
              aria-expanded={cuentaAbierta}
              aria-haspopup="true"
              aria-controls="menu-cuenta"
            >
              {usuario ? (
                <span className="cuenta-boton__avatar" aria-hidden="true">
                  {inicial}
                </span>
              ) : (
                <i className="fi fi-rr-user" aria-hidden="true" />
              )}
              <i className="fi fi-rr-angle-small-down cuenta__chevron" aria-hidden="true" />
            </button>

            {cuentaAbierta && (
              <div className="cuenta-menu" id="menu-cuenta">
                {usuario ? (
                  <>
                    <div className="cuenta-menu__perfil">
                      <span className="cuenta-menu__avatar" aria-hidden="true">
                        {inicial}
                      </span>
                      <div>
                        <p className="cuenta-menu__nombre">{usuario.nombre}</p>
                        <p className="cuenta-menu__usuario">@{usuario.username}</p>
                      </div>
                    </div>
                    {usuario.descuento?.activo ? (
                      <p className="cuenta-menu__chip">
                        <i className="fi fi-rr-person-walking-with-cane" aria-hidden="true" />-
                        {usuario.descuento.porcentaje}% por ser mayor de 65
                      </p>
                    ) : (
                      <p className="cuenta-menu__chip cuenta-menu__chip--suave">
                        {usuario.rol === 'admin' ? 'Superusuario' : 'Cliente'}
                      </p>
                    )}

                    <nav className="cuenta-menu__links" aria-label="Opciones de la cuenta">
                      <Link to="/mis-compras" onClick={cerrarCuenta}>
                        <i className="fi fi-rr-shopping-bag" aria-hidden="true" /> Mis compras
                      </Link>
                      <Link to="/favoritos" onClick={cerrarCuenta}>
                        <i className="fi fi-rr-heart" aria-hidden="true" /> Favoritos
                        {favs > 0 && <span className="cuenta-menu__contador">{favs}</span>}
                      </Link>
                      {esAdmin && (
                        <Link to="/admin" onClick={cerrarCuenta}>
                          <i className="fi fi-rr-shield-check" aria-hidden="true" /> Panel del superusuario
                        </Link>
                      )}
                    </nav>

                    {apariencia}

                    <div className="cuenta-menu__separador" />
                    <button type="button" className="cuenta-menu__salir" onClick={salirYcerrar}>
                      <i className="fi fi-rr-sign-out-alt" aria-hidden="true" /> Cerrar sesión
                    </button>
                    <button type="button" className="cuenta-menu__sesiones" onClick={cerrarTodos}>
                      <i className="fi fi-rr-shield-cross" aria-hidden="true" /> Cerrar todas las sesiones
                    </button>
                  </>
                ) : (
                  <>
                    <div className="cuenta-menu__perfil">
                      <span className="cuenta-menu__avatar cuenta-menu__avatar--invitado" aria-hidden="true">
                        <i className="fi fi-rr-user" />
                      </span>
                      <div>
                        <p className="cuenta-menu__nombre">Tu cuenta</p>
                        <p className="cuenta-menu__usuario">Ingresá para comprar más rápido</p>
                      </div>
                    </div>

                    <div className="cuenta-menu__botones">
                      <Link to="/login" className="boton boton--primario" onClick={cerrarCuenta}>
                        Ingresar
                      </Link>
                      <Link to="/registro" className="boton boton--fantasma" onClick={cerrarCuenta}>
                        Crear cuenta
                      </Link>
                    </div>

                    <nav className="cuenta-menu__links" aria-label="Ayuda con tu cuenta">
                      <Link to="/recuperar" onClick={cerrarCuenta}>
                        <i className="fi fi-rr-lock" aria-hidden="true" /> Recuperar contraseña
                      </Link>
                      <Link to="/ayuda" onClick={cerrarCuenta}>
                        <i className="fi fi-rr-interrogation" aria-hidden="true" /> Ayuda y contacto
                      </Link>
                    </nav>

                    {apariencia}
                  </>
                )}
              </div>
            )}
          </div>

          <Link
            to="/carrito"
            className="accion-icono accion-icono--carrito"
            aria-label={`Carrito${totales.unidades > 0 ? ` (${totales.unidades})` : ''}`}
            title="Carrito"
          >
            <i className="fi fi-rr-shopping-cart" aria-hidden="true" />
            {totales.unidades > 0 && (
              <span className="badge-accion badge-accion--carrito" key={totales.unidades}>
                {totales.unidades}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}

function Footer() {
  const { mostrar } = useToast()
  const [emailNewsletter, setEmailNewsletter] = useState('')
  const [suscribiendo, setSuscribiendo] = useState(false)

  const enviarNewsletter = async (e) => {
    e.preventDefault()
    const correo = emailNewsletter.trim()
    if (!correo) return
    setSuscribiendo(true)
    try {
      const data = await api('/newsletter', { method: 'POST', body: { email: correo } })
      mostrar(data?.mensaje || '¡Gracias por suscribirte!', 'exito')
      setEmailNewsletter('')
    } catch (error) {
      mostrar(error?.message || 'No pudimos suscribirte. Probá de nuevo.', 'error')
    } finally {
      setSuscribiendo(false)
    }
  }

  return (
    <footer className="footer">
      <div className="contenedor footer__interior">
        <div>
          <img src={`${BASE}logo.png`} alt="Electro Cuciné" className="footer__logo" />
          <p className="footer__marca">Electro Cuciné</p>
          <p>Electrodomésticos de cocina para todos los días.</p>
          <div className="footer__social">
            <a href="https://www.instagram.com/electrocucine" aria-label="Instagram" title="Instagram">
              <i className="fi fi-brands-instagram" />
            </a>
            <a href="https://www.facebook.com/electrocucine" aria-label="Facebook" title="Facebook">
              <i className="fi fi-brands-facebook" />
            </a>
            <a href="https://www.youtube.com/@electrocucine" aria-label="YouTube" title="YouTube">
              <i className="fi fi-brands-youtube" />
            </a>
            <a href="https://wa.me/5491100000000" aria-label="WhatsApp" title="WhatsApp">
              <i className="fi fi-brands-whatsapp" />
            </a>
            <a
              href="https://github.com/FedericoIvanTravella/electro-cucin-"
              aria-label="Código fuente en GitHub"
              title="Ver el código en GitHub"
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="fi fi-brands-github" />
            </a>
          </div>
        </div>
        <div>
          <p className="footer__titulo">Atención al cliente</p>
          <p>Av. Siempreviva 742 · 0800-123-4567</p>
          <p>lunes a sábados de 9 a 20 h</p>
          <p>
            <Link to="/ayuda">Ayuda al comprador</Link>
          </p>
          <p>
            <Link to="/blog">Blog y consejos</Link>
          </p>
        </div>
        <div>
          <p className="footer__titulo">Confianza</p>
          <ul className="footer__confianza">
            <li>
              <i className="fi fi-rr-shipping-fast" aria-hidden="true" /> Envío gratis +$150.000
            </li>
            <li>
              <i className="fi fi-rr-shield-check" aria-hidden="true" /> 2 años de garantía oficial
            </li>
            <li>
              <i className="fi fi-rr-undo" aria-hidden="true" /> 30 días para cambios
            </li>
          </ul>
        </div>
        <div>
          <p className="footer__titulo">Medios de pago</p>
          <ul className="footer__pagos">
            <li>VISA</li>
            <li>Mastercard</li>
            <li>Amex</li>
            <li>Débito</li>
            <li>Naranja X</li>
            <li>Transferencia</li>
          </ul>
          <p className="footer__nota">Hasta 12 cuotas sin interés.</p>
        </div>
        <div>
          <p className="footer__titulo">Newsletter</p>
          <p>Recibí ofertas y novedades antes que nadie.</p>
          <form className="footer__newsletter" onSubmit={enviarNewsletter}>
            <input
              type="email"
              required
              value={emailNewsletter}
              onChange={(e) => setEmailNewsletter(e.target.value)}
              placeholder="tu@correo.com"
              aria-label="Correo para el newsletter"
            />
            <button type="submit" className="boton boton--primario boton--chico" disabled={suscribiendo}>
              {suscribiendo ? 'Enviando…' : 'Suscribirme'}
            </button>
          </form>
        </div>
      </div>
      <p className="footer__legal">
        <Link to="/terminos">Términos y condiciones</Link> · <Link to="/privacidad">Privacidad</Link> ·{' '}
        <Link to="/devoluciones">Devoluciones</Link> ·{' '}
        <a
          href="https://github.com/FedericoIvanTravella/electro-cucin-"
          target="_blank"
          rel="noopener noreferrer"
        >
          Código en GitHub
        </a>
        <br />
        © {new Date().getFullYear()} Electro Cuciné · Proyecto académico · Íconos por{' '}
        <a href="https://www.flaticon.com" target="_blank" rel="noreferrer">
          Flaticon
        </a>
      </p>
    </footer>
  )
}

export default function Layout() {
  const { tema } = useTema()
  return (
    <div className="app">
      {tema === 'navideño' && (
        <>
          <Nieve />
          <Guirnalda />
        </>
      )}
      <BarraScroll />
      <BarraPromos />
      <Navbar />
      <main className="contenedor main">
        <Outlet />
      </main>
      <Footer />
      <ChatNero />
      <VolverArriba />
    </div>
  )
}
