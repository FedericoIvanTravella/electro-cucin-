import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import ResumenAdmin from '../components/admin/ResumenAdmin.jsx'
import ProductosAdmin from '../components/admin/ProductosAdmin.jsx'
import ClientesAdmin from '../components/admin/ClientesAdmin.jsx'
import VentasAdmin from '../components/admin/VentasAdmin.jsx'

const vistas = [
  { id: 'resumen', nombre: 'Resumen', icono: '📊' },
  { id: 'productos', nombre: 'Productos y stock', icono: '📦' },
  { id: 'clientes', nombre: 'Clientes', icono: '👥' },
  { id: 'ventas', nombre: 'Registro de ventas', icono: '🧾' }
]

export default function Admin() {
  const { usuario } = useAuth()
  const [vista, setVista] = useState('resumen')

  return (
    <div className="admin">
      <header className="admin__cabecera">
        <div>
          <h1>Panel del superusuario</h1>
          <p className="seccion__bajada">
            Bienvenido/a, {usuario?.nombre}. Tenés el control total de Electro Cuciné.
          </p>
        </div>
      </header>

      <nav className="admin__tabs card">
        {vistas.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`admin__tab ${vista === v.id ? 'activo' : ''}`}
            onClick={() => setVista(v.id)}
          >
            <span aria-hidden="true">{v.icono}</span> {v.nombre}
          </button>
        ))}
      </nav>

      <div className="admin__contenido">
        {vista === 'resumen' && <ResumenAdmin />}
        {vista === 'productos' && <ProductosAdmin />}
        {vista === 'clientes' && <ClientesAdmin />}
        {vista === 'ventas' && <VentasAdmin />}
      </div>
    </div>
  )
}