import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useFavoritos } from '../context/FavoritosContext'
import { useTema } from '../context/TemaContext'

// Barra superior con beneficios rotativos (se ve apenas abre la página).
const PROMOS = [
  '🚚 Envío sin cargo en compras superiores a $150.000',
  '💳 12 cuotas sin interés con tarjetas seleccionadas',
  '👵 30% de descuento para mayores de 65 años',
  '🛡️ 2 años de garantía en todos los productos'
]

function BarraPromos() {
  const [actual, setActual] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setActual((i) => (i + 1) % PROMOS.length), 4000)
    return () => clearInterval(timer)
  }, [])
  return (
    <div className="promos">
      <span className="promos__item" key={actual}>
        {PROMOS[actual]}
      </span>
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
          ☰
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
            {tema === 'oscuro' ? '☀️' : '🌙'}
          </button>

          <Link to="/carrito" className="carrito-boton" title="Ver carrito">
            🛒 Carrito
            {totales.unidades > 0 && <span className="badge-carrito">{totales.unidades}</span>}
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
          <p className="footer__titulo">Beneficio</p>
          <p>30% de descuento para clientes de 65 años o más al iniciar sesión.</p>
        </div>
      </div>
      <p className="footer__legal">© {new Date().getFullYear()} Electro Cuciné · Proyecto académico</p>
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
