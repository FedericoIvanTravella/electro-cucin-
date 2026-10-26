import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'

// Traduce los códigos de acción a etiquetas legibles.
const ACCIONES = {
  login: 'Inicio de sesión',
  'login-fallido': 'Intento fallido',
  logout: 'Cierre de sesión',
  registro: 'Registro de cuenta',
  'revocar-sesiones': 'Cierre en todos lados',
  'producto-crear': 'Producto creado',
  'producto-editar': 'Producto editado',
  'producto-stock': 'Stock modificado',
  'producto-ocultar': 'Producto ocultado',
  'producto-eliminar': 'Producto eliminado',
  'cliente-crear': 'Cliente creado',
  'cliente-editar': 'Cliente editado',
  'cliente-eliminar': 'Cliente eliminado',
  venta: 'Venta registrada',
  'venta-anular': 'Venta anulada'
}

export default function AuditoriaAdmin() {
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    api('/auditoria')
      .then((d) => {
        setRegistros(d.registros)
        setError('')
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [])

  const visibles = useMemo(() => {
    const texto = filtro.trim().toLowerCase()
    if (!texto) return registros
    return registros.filter((r) =>
      `${r.usuario} ${r.accion} ${r.detalle}`.toLowerCase().includes(texto)
    )
  }, [registros, filtro])

  return (
    <div>
      {error && <p className="alerta alerta--error">{error}</p>}

      <div className="barra-acciones">
        <input
          type="search"
          className="campo-input"
          placeholder="Buscar por usuario, acción o detalle…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
      </div>

      {cargando ? (
        <p className="aviso">Cargando auditoría…</p>
      ) : (
        <div className="card tabla-envolver">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr>
                  <td colSpan="4">No hay registros de auditoría.</td>
                </tr>
              )}
              {visibles.map((r) => (
                <tr key={r.id}>
                  <td>{r.fecha}</td>
                  <td>
                    <strong>{r.usuario}</strong>
                  </td>
                  <td>
                    <span className={`chip ${r.accion === 'login-fallido' ? 'chip--peligro' : ''}`}>
                      {ACCIONES[r.accion] || r.accion}
                    </span>
                  </td>
                  <td>{r.detalle || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
