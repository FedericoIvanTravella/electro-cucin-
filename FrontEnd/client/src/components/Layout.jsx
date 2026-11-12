import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useFavoritos } from '../context/FavoritosContext'
import { useTema } from '../context/TemaContext'

// Barra superior: cinta de beneficios deslizante (marquee infinito).
const PROMOS = [
  { icono: 'fi-rr-shipping-fast', texto: 'Envío sin cargo en compras superiores a $150.000' },
  { icono: 'fi-rr-credit-card', texto: '12 cuotas sin interés con tarjetas seleccionadas' },
  { icono: 'fi-rr-person-walking-with-cane', texto: '30% de descuento para mayores de 65 años' },
  { icono: 'fi-rr-shield-check', texto: '2 años de garantía en todos los productos' }
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

function Navbar() {
  const { usuario, esAdmin, salir, revocarSesiones } = useAuth()
  const { totales } = useCart()
  const { cantidad: favs } = useFavoritos()
  const { tema, alternar } = useTema()
  const [abierto, setAbierto] = useState(false)
  const ubicacion = useLocation()

  useEffect(() => {
    setAbierto(false)
  }, [ubicacion.pathname])

  const cerrarTodos = async () => {
    try {
      await revocarSesiones()
    } catch {
      // si falla, igual cerramos del lado del cliente
    }
  }

  return (
    <header className="navbar">
      <div className="navbar__interior contenedor">
        <Link to="/" className="marca">
          <img src="/logo.png" alt="Logo Electro Cuciné" className="marca__logo" />
          <span className="marca__texto">
            Electro <strong>Cuciné</strong>
          </span>
        </Link>

        <button
          type="button"
          className="navbar__hamburguesa"
          onClick={() => setAbierto((v) => !v)}
          aria-label="Abrir menú"
        >
          <i className="fi fi-rr-menu-burger" aria-hidden="true" />
        </button>

        <nav className={`navbar__nav ${abierto ? 'abierto' : ''}`}>
          <NavLink to="/">Inicio</NavLink>
          <NavLink to="/productos">Productos</NavLink>
          <NavLink to="/favoritos">Favoritos{favs > 0 ? ` (${favs})` : ''}</NavLink>
          <NavLink to="/ayuda">Ayuda</NavLink>
          {usuario && <NavLink to="/mis-compras">Mis compras</NavLink>}
          {esAdmin && <NavLink to="/admin">Panel del superusuario</NavLink>}
        </nav>

        <div className="navbar__acciones">
          <button
            type="button"
            className="tema-boton"
            onClick={alternar}
            aria-label={tema === 'oscuro' ? 'Activar tema claro' : 'Activar tema oscuro'}
            title={tema === 'oscuro' ? 'Tema claro' : 'Tema oscuro'}
          >
            <i className={`fi ${tema === 'oscuro' ? 'fi-rr-sun' : 'fi-rr-moon'}`} aria-hidden="true" />
          </button>

          <Link to="/carrito" className="carrito-boton" title="Ver carrito">
            <i className="fi fi-rr-shopping-cart" aria-hidden="true" /> Carrito
            {totales.unidades > 0 && (
              <span className="badge-carrito badge-carrito--bump" key={totales.unidades}>
                {totales.unidades}
              </span>
            )}
          </Link>

          {usuario ? (
            <div className="usuario">
              <div className="usuario__datos">
                <span className="usuario__nombre">{usuario.nombre}</span>
                {usuario.descuento?.activo ? (
                  <span className="chip chip--descuento">-{usuario.descuento.porcentaje}% jubilados</span>
                ) : (
                  <span className="chip">{usuario.rol === 'admin' ? 'Superusuario' : 'Cliente'}</span>
                )}
              </div>
              <button
                type="button"
                className="boton boton--fantasma boton--chico"
                onClick={cerrarTodos}
                title="Cerrar sesión en todos los dispositivos"
              >
                Cerrar todo
              </button>
              <button type="button" className="boton boton--fantasma boton--chico" onClick={salir}>
                Salir
              </button>
            </div>
          ) : (
            <div className="navbar__sesion">
              <Link to="/login" className="boton boton--fantasma boton--chico">
                Ingresar
              </Link>
              <Link to="/registro" className="boton boton--primario boton--chico">
                Registrarme
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="contenedor footer__interior">
        <div>
          <img src="/logo.png" alt="Electro Cuciné" className="footer__logo" />
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
          </div>
        </div>
        <div>
          <p className="footer__titulo">Atención al cliente</p>
          <p>Av. Siempreviva 742 · 0800-123-4567</p>
          <p>lunes a sábados de 9 a 20 h</p>
          <p>
            <Link to="/ayuda">Ayuda al comprador</Link>
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
      </div>
      <p className="footer__legal">
        <Link to="/ayuda">Términos y condiciones</Link> · <Link to="/ayuda">Privacidad</Link> ·{' '}
        <Link to="/ayuda">Devoluciones</Link><br />
        © {new Date().getFullYear()} Electro Cuciné · Proyecto académico · Íconos por{' '}
        <a href="https://www.flaticon.com" target="_blank" rel="noreferrer">
          Flaticon
        </a>
      </p>
    </footer>
  )
}

export default function Layout() {
  return (
    <div className="app">
      <BarraPromos />
      <Navbar />
      <main className="contenedor main">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
