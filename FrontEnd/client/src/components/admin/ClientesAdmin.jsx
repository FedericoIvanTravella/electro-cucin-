import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'

const VACIO = { nombre: '', email: '', telefono: '', direccion: '', fecha_nacimiento: '', notas: '' }

export default function ClientesAdmin() {
  const [clientes, setClientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState({ abierto: false, editando: null, datos: VACIO })

  const cargar = () => {
    setCargando(true)
    api('/clientes')
      .then((d) => {
        setClientes(d.clientes)
        setError('')
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }

  useEffect(cargar, [])

  const visibles = useMemo(
    () =>
      clientes.filter(
        (c) =>
          c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          c.email.toLowerCase().includes(busqueda.toLowerCase())
      ),
    [clientes, busqueda]
  )

  const abrirNuevo = () => setForm({ abierto: true, editando: null, datos: VACIO })
  const abrirEditar = (c) => setForm({ abierto: true, editando: c, datos: { ...c } })
  const cerrar = () => setForm({ abierto: false })
  const actualizar = (campo, valor) => setForm((f) => ({ ...f, datos: { ...f.datos, [campo]: valor } }))

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (form.editando) {
        await api(`/clientes/${form.editando.id}`, { method: 'PUT', body: form.datos })
        setMensaje('Cliente actualizado.')
      } else {
        await api('/clientes', { method: 'POST', body: form.datos })
        setMensaje('Cliente registrado.')
      }
      cerrar()
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  const eliminar = async (cliente) => {
    if (!confirm(`¿Eliminar a "${cliente.nombre}"?`)) return
    try {
      await api(`/clientes/${cliente.id}`, { method: 'DELETE' })
      setMensaje('Cliente eliminado.')
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      {mensaje && <p className="alerta alerta--exito">{mensaje}</p>}
      {error && <p className="alerta alerta--error">{error}</p>}

      <div className="barra-acciones">
        <input
          type="search"
          className="campo-input"
          placeholder="Buscar por nombre o email…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <button type="button" className="boton boton--primario" onClick={abrirNuevo}>
          + Registrar cliente
        </button>
      </div>

      {cargando ? (
        <p className="aviso">Cargando clientes…</p>
      ) : (
        <div className="card tabla-envolver">
          <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Dirección</th>
                <th>Edad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr>
                  <td colSpan="6">No hay clientes registrados.</td>
                </tr>
              )}
              {visibles.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.nombre}</strong>
                  </td>
                  <td>{c.email || '—'}</td>
                  <td>{c.telefono || '—'}</td>
                  <td>{c.direccion || '—'}</td>
                  <td>
                    {c.edad !== null && c.edad !== undefined ? (
                      <>
                        {c.edad} años{' '}
                        {c.edad >= 65 && <span className="chip chip--descuento">30%</span>}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <div className="acciones-tabla">
                      <button type="button" className="boton boton--fantasma boton--chico" onClick={() => abrirEditar(c)}>
                        Editar
                      </button>
                      <button type="button" className="boton boton--peligro boton--chico" onClick={() => eliminar(c)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form.abierto && (
        <div className="modal-fondo" onClick={cerrar}>
          <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
            <h2>{form.editando ? `Editar: ${form.editando.nombre}` : 'Registrar cliente'}</h2>

            <label className="campo">
              <span>Nombre y apellido *</span>
              <input value={form.datos.nombre} onChange={(e) => actualizar('nombre', e.target.value)} required />
            </label>

            <div className="fila-campos">
              <label className="campo">
                <span>Email</span>
                <input type="email" value={form.datos.email} onChange={(e) => actualizar('email', e.target.value)} />
              </label>
              <label className="campo">
                <span>Teléfono</span>
                <input value={form.datos.telefono} onChange={(e) => actualizar('telefono', e.target.value)} />
              </label>
            </div>

            <label className="campo">
              <span>Dirección</span>
              <input value={form.datos.direccion} onChange={(e) => actualizar('direccion', e.target.value)} />
            </label>

            <div className="fila-campos">
              <label className="campo">
                <span>Fecha de nacimiento</span>
                <input
                  type="date"
                  value={form.datos.fecha_nacimiento}
                  onChange={(e) => actualizar('fecha_nacimiento', e.target.value)}
                />
              </label>
              <label className="campo">
                <span>Notas</span>
                <input value={form.datos.notas} onChange={(e) => actualizar('notas', e.target.value)} />
              </label>
            </div>

            <div className="modal__acciones">
              <button type="button" className="boton boton--fantasma" onClick={cerrar}>
                Cancelar
              </button>
              <button type="submit" className="boton boton--primario">
                {form.editando ? 'Guardar cambios' : 'Registrar cliente'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}