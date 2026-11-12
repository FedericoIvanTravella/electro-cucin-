import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { ahorroPorcentaje, dinero, imagenProducto } from '../../lib/format'

const VACIO = { nombre: '', categoria: '', descripcion: '', precio: '', precio_tachado: '', stock: '', imagen: '' }
const CATEGORIAS = ['Cocción', 'Preparación', 'Cafetería', 'Limpieza']

export default function ProductosAdmin() {
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [mostrarOcultos, setMostrarOcultos] = useState(false)
  const [form, setForm] = useState({ abierto: false, editando: null, datos: VACIO })
  const [mensaje, setMensaje] = useState('')
  const [imagenes, setImagenes] = useState([])

  const cargar = () => {
    setCargando(true)
    api('/productos?admin=1')
      .then((d) => {
        setProductos(d.productos)
        setError('')
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargar()
    api('/productos/imagenes')
      .then((d) => setImagenes(d.imagenes))
      .catch(() => setImagenes([]))
  }, [])

  const visibles = useMemo(() => {
    return productos.filter(
      (p) => (mostrarOcultos || p.activo === 1) && p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    )
  }, [productos, busqueda, mostrarOcultos])

  const abrirNuevo = () =>
    setForm({ abierto: true, editando: null, datos: { ...VACIO, categoria: CATEGORIAS[0], activo: 1 } })

  const abrirEditar = (p) =>
    setForm({ abierto: true, editando: p, datos: { ...p, activo: p.activo } })

  const cerrar = () => setForm({ abierto: false })

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    const cuerpo = {
      nombre: form.datos.nombre,
      categoria: form.datos.categoria,
      descripcion: form.datos.descripcion,
      precio: Number(form.datos.precio),
      precio_tachado: Number(form.datos.precio_tachado || 0),
      stock: Number(form.datos.stock),
      imagen: form.datos.imagen,
      activo: form.datos.activo === 1 || form.datos.activo
    }
    try {
      if (form.editando) {
        await api(`/productos/${form.editando.id}`, { method: 'PUT', body: cuerpo })
        setMensaje('Producto actualizado.')
      } else {
        await api('/productos', { method: 'POST', body: cuerpo })
        setMensaje('Producto creado.')
      }
      cerrar()
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  const cambiarStock = async (producto, ajuste) => {
    try {
      await api(`/productos/${producto.id}/stock`, { method: 'PATCH', body: { ajuste } })
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  const fijarStock = async (producto, stock) => {
    try {
      await api(`/productos/${producto.id}/stock`, { method: 'PATCH', body: { stock: Number(stock) } })
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  const alternarActivo = async (producto) => {
    try {
      await api(`/productos/${producto.id}`, {
        method: 'PUT',
        body: { ...producto, activo: producto.activo ? 0 : 1, precio: producto.precio, stock: producto.stock }
      })
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  const eliminar = async (producto) => {
    if (!confirm(`¿Eliminar "${producto.nombre}"?`)) return
    try {
      const r = await api(`/productos/${producto.id}`, { method: 'DELETE' })
      setMensaje(
        r.oculto
          ? 'El producto tiene ventas asociadas: se ocultó del catálogo.'
          : 'Producto eliminado definitivamente.'
      )
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  const actualizar = (campo, valor) =>
    setForm((f) => ({ ...f, datos: { ...f.datos, [campo]: valor } }))

  return (
    <div>
      {mensaje && <p className="alerta alerta--exito">{mensaje}</p>}
      {error && <p className="alerta alerta--error">{error}</p>}

      <div className="barra-acciones">
        <input
          type="search"
          className="campo-input"
          placeholder="Buscar producto…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <label className="check">
          <input type="checkbox" checked={mostrarOcultos} onChange={(e) => setMostrarOcultos(e.target.checked)} />
          Mostrar ocultos
        </label>
        <button type="button" className="boton boton--primario" onClick={abrirNuevo}>
          + Nuevo producto
        </button>
      </div>

      {cargando ? (
        <p className="aviso">Cargando productos…</p>
      ) : (
        <div className="card tabla-envolver">
          <table className="tabla tabla--productos">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr>
                  <td colSpan="6">No hay productos con esos filtros.</td>
                </tr>
              )}
              {visibles.map((p) => (
                <tr key={p.id} className={p.activo ? '' : 'fila-oculta'}>
                  <td>
                    <div className="celda-producto">
                      {imagenProducto(p) ? (
                        <img src={imagenProducto(p)} alt="" className="celda-producto__thumb" />
                      ) : (
                        <i className="fi fi-rr-utensils" aria-hidden="true" />
                      )}
                      <div>
                        <strong>{p.nombre}</strong>
                        <small>{p.descripcion}</small>
                      </div>
                    </div>
                  </td>
                  <td>{p.categoria}</td>
                  <td>
                    <div>
                      <strong>{dinero(p.precio)}</strong>
                      {p.precio_tachado > p.precio && (
                        <>
                          <br />
                          <small className="celda-tachado">{dinero(p.precio_tachado)}</small>
                          <span className="chip chip--descuento">
                            {ahorroPorcentaje(p.precio, p.precio_tachado)}% OFF
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="stock-control">
                      <button type="button" onClick={() => cambiarStock(p, -1)} aria-label="Restar stock">
                        −
                      </button>
                      <input
                        type="number"
                        value={p.stock}
                        min="0"
                        onChange={(e) => fijarStock(p, e.target.value)}
                      />
                      <button type="button" onClick={() => cambiarStock(p, 1)} aria-label="Sumar stock">
                        +
                      </button>
                    </div>
                  </td>
                  <td>
                    <span className={`chip ${p.activo ? 'chip--exito' : 'chip--gris'}`}>
                      {p.activo ? 'Activo' : 'Oculto'}
                    </span>
                    {p.stock <= 5 && p.activo === 1 && <span className="chip chip--peligro">stock bajo</span>}
                  </td>
                  <td>
                    <div className="acciones-tabla">
                      <button type="button" className="boton boton--fantasma boton--chico" onClick={() => abrirEditar(p)}>
                        Editar
                      </button>
                      <button type="button" className="boton boton--fantasma boton--chico" onClick={() => alternarActivo(p)}>
                        {p.activo ? 'Ocultar' : 'Mostrar'}
                      </button>
                      <button type="button" className="boton boton--peligro boton--chico" onClick={() => eliminar(p)}>
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
            <h2>{form.editando ? `Editar: ${form.editando.nombre}` : 'Nuevo producto'}</h2>

            <label className="campo">
              <span>Nombre *</span>
              <input value={form.datos.nombre} onChange={(e) => actualizar('nombre', e.target.value)} required />
            </label>

            <div className="fila-campos">
              <label className="campo">
                <span>Categoría *</span>
                <select value={form.datos.categoria} onChange={(e) => actualizar('categoria', e.target.value)}>
                  {CATEGORIAS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="campo">
                <span>Precio de venta *</span>
                <input
                  type="number"
                  min="0"
                  value={form.datos.precio}
                  onChange={(e) => actualizar('precio', e.target.value)}
                  required
                />
              </label>
              <label className="campo">
                <span>Precio anterior (para mostrar OF)</span>
                <input
                  type="number"
                  min="0"
                  value={form.datos.precio_tachado}
                  onChange={(e) => actualizar('precio_tachado', e.target.value)}
                  placeholder="opcional"
                />
              </label>
              <label className="campo">
                <span>Stock *</span>
                <input
                  type="number"
                  min="0"
                  value={form.datos.stock}
                  onChange={(e) => actualizar('stock', e.target.value)}
                  required
                />
              </label>
            </div>

            <label className="campo">
              <span>Descripción</span>
              <textarea
                rows="2"
                value={form.datos.descripcion}
                onChange={(e) => actualizar('descripcion', e.target.value)}
              />
            </label>

            <div className="fila-campos">
              <label className="campo">
                <span>Imagen (archivo del servidor o URL; ej: 42.jpg, 6.svg)</span>
                <input
                  value={form.datos.imagen}
                  onChange={(e) => actualizar('imagen', e.target.value)}
                  placeholder="ej: 42 · 42.jpg · 6.svg · https://…"
                />
              </label>
              <label className="check check--primaria">
                <input
                  type="checkbox"
                  checked={form.datos.activo === 1 || form.datos.activo}
                  onChange={(e) => actualizar('activo', e.target.checked ? 1 : 0)}
                />
                Visible en el catálogo
              </label>
            </div>

            {imagenes.length > 0 && (
              <div className="selector-imagenes">
                <span>Imágenes disponibles en el servidor:</span>
                <div className="selector-imagenes__lista">
                  {imagenes.map((archivo) => {
                    const sinExtension = archivo.replace(/\.[^.]+$/, '')
                    const activa =
                      String(form.datos.imagen) === String(archivo) ||
                      String(form.datos.imagen) === String(sinExtension)
                    return (
                      <button
                        key={archivo}
                        type="button"
                        className={`chip chip--boton ${activa ? 'chip--primario' : ''}`}
                        onClick={() => actualizar('imagen', activa ? '' : archivo)}
                        title={`Usar ${archivo}`}
                      >
                        {archivo}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="modal__acciones">
              <button type="button" className="boton boton--fantasma" onClick={cerrar}>
                Cancelar
              </button>
              <button type="submit" className="boton boton--primario">
                {form.editando ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}