import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useTitulo } from '../lib/useTitulo'

export default function Recuperar() {
  useTitulo('Recuperar contraseña | Electro Cuciné')
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const data = await api('/auth/recuperar', {
        method: 'POST',
        body: { email: email.trim() }
      })
      setMensaje(
        data?.mensaje ||
          'Si el email está registrado, te enviamos un enlace para restablecer la contraseña.'
      )
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
          <i className="fi fi-rr-lock" />
        </span>
        <h1>Recuperar contraseña</h1>
        <p className="seccion__bajada">
          Ingresá el email de tu cuenta y te enviamos un enlace para elegir una nueva contraseña.
        </p>

        {error && <p className="alerta alerta--error">{error}</p>}

        {mensaje ? (
          <>
            <p className="alerta alerta--exito">{mensaje}</p>
            <p className="auth__nota">
              Revisá también la carpeta de spam. El enlace vence en <strong>1 hora</strong> y se puede
              usar una sola vez.
            </p>
            <Link to="/login" className="boton boton--primario boton--grande boton--bloque">
              Volver al ingreso
            </Link>
          </>
        ) : (
          <>
            <label className="campo">
              <span>Email de la cuenta</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                autoComplete="email"
                required
              />
            </label>

            <button
              type="submit"
              className="boton boton--primario boton--grande boton--bloque"
              disabled={enviando}
            >
              {enviando ? 'Enviando…' : 'Enviar enlace'}
            </button>

            <p className="auth__pie">
              <Link to="/login">Volver al ingreso</Link> · <Link to="/registro">Crear una cuenta</Link>
            </p>
          </>
        )}
      </form>

      <aside className="card auth__lateral">
        <h2>¿Cómo funciona?</h2>
        <ol className="auth__pasos">
          <li>Ingresás el email con el que te registraste.</li>
          <li>Te llega un correo con un enlace único.</li>
          <li>Elegís una contraseña nueva y lista.</li>
        </ol>
        <p className="auth__nota">
          Por seguridad, no confirmamos si un email está registrado o no. Si no llega el correo,
          revisá el spam o escribinos a <strong>ayuda@electrocucine.com</strong>.
        </p>
        <div className="auth__beneficio">
          <span aria-hidden="true">
            <i className="fi fi-rr-shield-check" />
          </span>
          <p>
            Al cambiar la contraseña cerramos todas las sesiones abiertas de tu cuenta en otros
            dispositivos.
          </p>
        </div>
      </aside>
    </div>
  )
}
