import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import ResumenAdmin from '../components/admin/ResumenAdmin.jsx'
import ProductosAdmin from '../components/admin/ProductosAdmin.jsx'
import ClientesAdmin from '../components/admin/ClientesAdmin.jsx'
import VentasAdmin from '../components/admin/VentasAdmin.jsx'
import AuditoriaAdmin from '../components/admin/AuditoriaAdmin.jsx'

const vistas = [
  { id: 'resumen', nombre: 'Resumen', icono: 'fi-rr-chart-pie' },
  { id: 'productos', nombre: 'Productos y stock', icono: 'fi-rr-box' },
  { id: 'clientes', nombre: 'Clientes', icono: 'fi-rr-users-alt' },
  { id: 'ventas', nombre: 'Registro de ventas', icono: 'fi-rr-receipt' },
  { id: 'auditoria', nombre: 'Auditoría', icono: 'fi-rr-shield-check' }
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
            <i className={`fi ${v.icono}`} aria-hidden="true" /> {v.nombre}
          </button>
        ))}
      </nav>

      <div className="admin__contenido">
        {vista === 'resumen' && <ResumenAdmin />}
        {vista === 'productos' && <ProductosAdmin />}
        {vista === 'clientes' && <ClientesAdmin />}
        {vista === 'ventas' && <VentasAdmin />}
        {vista === 'auditoria' && <AuditoriaAdmin />}
      </div>
    </div>
  )
}