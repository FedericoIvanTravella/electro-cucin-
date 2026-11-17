import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { dinero } from '../../lib/format'

export default function CuponesAdmin() {
  const [cupones, setCupones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [form, setForm] = useState({ codigo: '', tipo: 'porcentaje', valor: '', usos_max: '' })
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(() => {
    setCargando(true)
    api('/cupones')
      .then((d) => setCupones(d.cupones))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [])

  useEffect(cargar, [cargar])

  const crear = async (e) => {
    e.preventDefault()
    setError('')
    setMensaje('')
    setGuardando(true)
    try {
      await api('/cupones', {
        method: 'POST',
        body: {
          codigo: form.codigo.trim().toUpperCase(),
          tipo: form.tipo,
          valor: Number(form.valor),
          usos_max: form.usos_max === '' ? null : Number(form.usos_max)
        }
      })
      setMensaje(`Cupón ${form.codigo.trim().toUpperCase()} creado.`)
      setForm({ codigo: '', tipo: 'porcentaje', valor: '', usos_max: '' })
      cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const cambiarActivo = async (cupon) => {
    setError('')
    try {
      await api(`/cupones/${cupon.codigo}`, { method: 'PATCH', body: { activo: !cupon.activo } })
      setMensaje(`Cupón ${cupon.codigo} ${cupon.activo ? 'desactivado' : 'activado'}.`)
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  const eliminar = async (cupon) => {
    if (!confirm(`¿Eliminar el cupón "${cupon.codigo}"? Esa acción no se puede deshacer.`)) return
    setError('')
    try {
      await api(`/cupones/${cupon.codigo}`, { method: 'DELETE' })
      setMensaje(`Cupón ${cupon.codigo} eliminado.`)
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  const describir = (c) => (c.tipo === 'porcentaje' ? `${c.valor}% de descuento` : `${dinero(c.valor)} de descuento`)

  return (
    <div>
      {mensaje && <p className="alerta alerta--exito">{mensaje}</p>}
      {error && <p className="alerta alerta--error">{error}</p>}

      <div className="filtro-chips">
        {['COCINA10 (-10%)', 'CUCINE5 (-$5.000)'].map((c) => (
          <span key={c} className="chip">{c}</span>
        ))}
      </div>

      <form className="card cupones-form" onSubmit={crear}>
        <h2>Crear cupón</h2>
        <div className="fila-campos">
          <label className="campo">
            <span>Código</span>
            <input
              value={form.codigo}
              onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))}
              placeholder="ej: COCINA20"
              required
              pattern="[A-Za-z0-9_-]{3,20}"
              title="3 a 20 caracteres: letras, números, - y _"
            />
          </label>
          <label className="campo">
            <span>Tipo</span>
            <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
              <option value="porcentaje">Porcentaje (%)</option>
              <option value="fijo">Monto fijo ($)</option>
            </select>
          </label>
          <label className="campo">
            <span>{form.tipo === 'porcentaje' ? 'Porcentaje' : 'Monto ($)'}</span>
            <input
              type="number"
              min="1"
              value={form.valor}
              onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
              placeholder={form.tipo === 'porcentaje' ? '10' : '5000'}
              required
            />
          </label>
          <label className="campo">
            <span>Usos máximos (vacío = ilimitado)</span>
            <input
              type="number"
              min="1"
              value={form.usos_max}
              onChange={(e) => setForm((f) => ({ ...f, usos_max: e.target.value }))}
              placeholder="ej: 100"
            />
          </label>
        </div>
        <button type="submit" className="boton boton--primario" disabled={guardando}>
          <i className="fi fi-rr-plus" aria-hidden="true" /> {guardando ? 'Creando…' : 'Crear cupón'}
        </button>
      </form>

      {cargando ? (
        <p className="aviso">Cargando cupones…</p>
      ) : cupones.length === 0 ? (
        <p className="aviso">Todavía no hay cupones.</p>
      ) : (
        <div className="card tabla-envolver">
          <table className="tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descuento</th>
                <th>Usos</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cupones.map((c) => (
                <tr key={c.codigo}>
                  <td>
                    <strong>{c.codigo}</strong>
                  </td>
                  <td>{describir(c)}</td>
                  <td>
                    {c.usado} {c.usos_max ? `/ ${c.usos_max}` : 'usos'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`chip chip--boton ${c.activo ? 'chip--exito' : 'chip--gris'}`}
                      onClick={() => cambiarActivo(c)}
                      title={c.activo ? 'Click para desactivar' : 'Click para ACTIVAR'}
                    >
                      {c.activo ? 'activo' : 'inactivo'}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="boton boton--peligro boton--chico"
                      onClick={() => eliminar(c)}
                      aria-label={`Eliminar cupón ${c.codigo}`}
                    >
                      <i className="fi fi-rr-trash" aria-hidden="true" /> Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
