import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useTitulo } from '../lib/useTitulo'

export default function Restablecer() {
  useTitulo('Elegir nueva contraseña | Electro Cuciné')
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [estado, setEstado] = useState(token ? 'verificando' : 'invalido')
  const [form, setForm] = useState({ password: '', repetir: '' })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!token) return
    let activo = true
    api(`/auth/recuperar/verificar?token=${encodeURIComponent(token)}`)
      .then((data) => {
        if (activo) setEstado(data?.valido ? 'listo' : 'invalido')
      })
      .catch(() => {
        if (activo) setEstado('invalido')
      })
    return () => {
      activo = false
    }
  }, [token])

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.repetir) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setEnviando(true)
    try {
      await api('/auth/restablecer', {
        method: 'POST',
        body: { token, password: form.password }
      })
      setEstado('guardado')
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="auth auth--simple">
      <form className="card auth__form" onSubmit={enviar}>
        <span className="auth__icono" aria-hidden="true">
          <i className={`fi ${estado === 'guardado' ? 'fi-rr-check' : 'fi-rr-key'}`} />
        </span>
        <h1>{estado === 'guardado' ? '¡Contraseña actualizada!' : 'Elegí tu nueva contraseña'}</h1>

        {estado === 'verificando' && <p className="aviso">Verificando el enlace…</p>}

        {estado === 'invalido' && (
          <>
            <p className="alerta alerta--error">
              El enlace no es válido o venció. Pedí uno nuevo para continuar.
            </p>
            <Link to="/recuperar" className="boton boton--primario boton--grande boton--bloque">
              Pedir un enlace nuevo
            </Link>
            <p className="auth__pie">
              <Link to="/login">Volver al ingreso</Link>
            </p>
          </>
        )}

        {estado === 'guardado' && (
          <>
            <p className="alerta alerta--exito">
              Tu contraseña cambió correctamente. Por seguridad cerramos las sesiones abiertas en
              otros dispositivos.
            </p>
            <Link to="/login" className="boton boton--primario boton--grande boton--bloque">
              Ingresar con mi contraseña nueva
            </Link>
          </>
        )}

        {estado === 'listo' && (
          <>
            <p className="seccion__bajada">
              Tiene que tener al menos 8 caracteres y combinar letras y números.
            </p>

            {error && <p className="alerta alerta--error">{error}</p>}

            <label className="campo">
              <span>Contraseña nueva</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>

            <label className="campo">
              <span>Repetir contraseña</span>
              <input
                type="password"
                value={form.repetir}
                onChange={(e) => setForm((f) => ({ ...f, repetir: e.target.value }))}
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>

            <button
              type="submit"
              className="boton boton--primario boton--grande boton--bloque"
              disabled={enviando}
            >
              {enviando ? 'Guardando…' : 'Guardar contraseña'}
            </button>

            <p className="auth__pie">
              <Link to="/login">Volver al ingreso</Link>
            </p>
          </>
        )}
      </form>

      <aside className="card auth__lateral">
        <h2>Consejos para una buena contraseña</h2>
        <ul className="auth__pasos">
          <li>Usá al menos 8 caracteres, con letras y números.</li>
          <li>No repitas tu nombre de usuario ni datos personales.</li>
          <li>Evitá contraseñas obvias como “12345678” o “password”.</li>
          <li>Si podés, sumá mayúsculas y algún símbolo.</li>
        </ul>
        <p className="auth__nota">
          El enlace de recuperación es personal: no lo compartas con nadie. Electro Cuciné nunca te
          va a pedir tu contraseña por correo.
        </p>
      </aside>
    </div>
  )
}
