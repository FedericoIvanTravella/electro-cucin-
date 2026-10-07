import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { entrar } = useAuth()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const destino = ubicacion.state?.from || '/'

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await entrar(form.username.trim(), form.password)
      navegar(destino, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="auth">
      <form className="card auth__form" onSubmit={enviar}>
        <h1>Iniciar sesión</h1>
        <p className="seccion__bajada">
          Ingresá para gestionar tus compras. Las contraseñas se guardan encriptadas con bcrypt.
        </p>

        {error && <p className="alerta alerta--error">{error}</p>}

        <label className="campo">
          <span>Usuario</span>
          <input
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            placeholder="tu usuario"
            autoComplete="username"
            required
          />
        </label>

        <label className="campo">
          <span>Contraseña</span>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="••••••"
            autoComplete="current-password"
            required
          />
        </label>

        <button type="submit" className="boton boton--primario boton--grande boton--bloque" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>

        <p className="auth__pie">
          ¿No tenés cuenta? <Link to="/registro">Registrate acá</Link>
        </p>
      </form>

      <aside className="card auth__lateral">
        <h2>Cuentas de prueba</h2>
        <p>
          Superusuario: <strong>federico</strong> / <strong>admin23</strong>
        </p>
        <p className="auth__nota">
          Desde el panel del superusuario podés crear y editar productos, actualizar el stock,
          gestionar clientes y ver el registro de ventas.
        </p>
        <div className="auth__beneficio">
          <span aria-hidden="true">👵</span>
          <p>
            Si tu cuenta tiene 65 años o más, al ingresar se aplica un <strong>30% de descuento</strong> en
            todas tus compras.
          </p>
        </div>
      </aside>
    </div>
  )
}
