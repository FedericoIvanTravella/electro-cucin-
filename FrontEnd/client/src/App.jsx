import { Link, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import PaginaError from './components/PaginaError.jsx'
import { useAuth } from './context/AuthContext.jsx'
import Home from './pages/Home.jsx'
import Productos from './pages/Productos.jsx'
import Favoritos from './pages/Favoritos.jsx'
import Carrito from './pages/Carrito.jsx'
import Pago from './pages/Pago.jsx'
import Login from './pages/Login.jsx'
import Registro from './pages/Registro.jsx'
import MisCompras from './pages/MisCompras.jsx'
import Ayuda from './pages/Ayuda.jsx'
import Admin from './pages/Admin.jsx'
import ErrorCodigo from './pages/ErrorCodigo.jsx'
import NotFound from './pages/NotFound.jsx'

function Protegida({ soloAdmin = false, children }) {
  const { usuario, cargando } = useAuth()
  const ubicacion = useLocation()
  if (cargando) return <p className="aviso">Cargando…</p>
  if (!usuario) {
    return (
      <PaginaError codigo={401} reintentar={false}>
        <Link
          to="/login"
          state={{ desde: ubicacion.pathname }}
          className="boton boton--primario boton--grande"
        >
          Iniciar sesión
        </Link>
      </PaginaError>
    )
  }
  if (soloAdmin && usuario.rol !== 'admin') {
    return <PaginaError codigo={403} reintentar={false} />
  }
  return children
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/favoritos" element={<Favoritos />} />
          <Route path="/ayuda" element={<Ayuda />} />
          <Route path="/carrito" element={<Carrito />} />
          <Route
            path="/pago"
            element={
              <Protegida>
                <Pago />
              </Protegida>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route
            path="/mis-compras"
            element={
              <Protegida>
                <MisCompras />
              </Protegida>
            }
          />
          <Route
            path="/admin"
            element={
              <Protegida soloAdmin>
                <Admin />
              </Protegida>
            }
          />
          <Route path="/error/:codigo" element={<ErrorCodigo />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}
