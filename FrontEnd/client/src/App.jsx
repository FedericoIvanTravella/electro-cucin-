import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import { useAuth } from './context/AuthContext.jsx'
import Home from './pages/Home.jsx'
import Productos from './pages/Productos.jsx'
import Carrito from './pages/Carrito.jsx'
import Pago from './pages/Pago.jsx'
import Login from './pages/Login.jsx'
import Registro from './pages/Registro.jsx'
import MisCompras from './pages/MisCompras.jsx'
import Ayuda from './pages/Ayuda.jsx'
import Admin from './pages/Admin.jsx'
import NotFound from './pages/NotFound.jsx'

function Protegida({ soloAdmin = false, children }) {
  const { usuario, cargando } = useAuth()
  if (cargando) return <p className="aviso">Cargando…</p>
  if (!usuario) return <Navigate to="/login" replace />
  if (soloAdmin && usuario.rol !== 'admin') {
    return (
      <div className="aviso aviso--error">
        <h2>Acceso restringido</h2>
        <p>Este panel es exclusivo del superusuario.</p>
      </div>
    )
  }
  return children
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/productos" element={<Productos />} />
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
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
