import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { edadDesde } from '../lib/format'

const FORM_INICIAL = {
  nombre: '',
  username: '',
  email: '',
  fecha_nacimiento: '',
  password: '',
  confirmar: ''
}

const EDAD_MAXIMA = 100

export default function Registro() {
  const { registrar } = useAuth()
  const navegar = useNavigate()
  const [form, setForm] = useState(FORM_INICIAL)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const edad = useMemo(() => edadDesde(form.fecha_nacimiento), [form.fecha_nacimiento])
  const aplicaDescuento = edad !== null && edad >= 65

  // Requisitos de contraseña fuerte que se muestran en vivo.
  const requisitos = [
    { ok: form.password.length >= 8, texto: 'Al menos 8 caracteres' },
    {
      ok: /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(form.password) && /[0-9]/.test(form.password),
      texto: 'Combina letras y números'
    },
    {
      ok: !form.username || !form.password.toLowerCase().includes(form.username.trim().toLowerCase()),
      texto: 'No incluye tu usuario'
    }
  ]
  const passwordOk = requisitos.every((r) => r.ok)

  const actualizar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const enviar = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (!passwordOk) {
      setError('La contraseña no cumple con los requisitos de seguridad.')
      return
    }
    if (edad !== null && edad > EDAD_MAXIMA) {
      setError(`La edad máxima para crear una cuenta es de ${EDAD_MAXIMA} años. Verificá tu fecha de nacimiento.`)
      return
    }
    setError('')
    setEnviando(true)
    try {
      await registrar({
        nombre: form.nombre,
        username: form.username,
        email: form.email,
        fecha_nacimiento: form.fecha_nacimiento,
        password: form.password
      })
      navegar('/productos', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="auth">
      <form className="card auth__form" onSubmit={enviar}>
        <h1>Crear cuenta</h1>
        <p className="seccion__bajada">
          Completá tus datos y empezá a comprar. Al registrarte podés acceder al descuento para
          mayores de 65 años.
        </p>

        {error && <p className="alerta alerta--error">{error}</p>}

        <label className="campo">
          <span>Nombre y apellido</span>
          <input value={form.nombre} onChange={(e) => actualizar('nombre', e.target.value)} required />
        </label>

        <div className="fila-campos">
          <label className="campo">
            <span>Usuario</span>
            <input
              value={form.username}
              onChange={(e) => actualizar('username', e.target.value)}
              minLength={3}
              required
            />
          </label>
          <label className="campo">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => actualizar('email', e.target.value)}
              placeholder="opcional"
            />
          </label>
        </div>

        <label className="campo">
          <span>Fecha de nacimiento</span>
          <input
            type="date"
            value={form.fecha_nacimiento}
            onChange={(e) => actualizar('fecha_nacimiento', e.target.value)}
            min="1900-01-01"
            max={new Date().toISOString().slice(0, 10)}
          />
        </label>

        {edad !== null && (
          <div className={`edad-info ${edad > EDAD_MAXIMA ? 'edad-info--error' : aplicaDescuento ? 'edad-info--descuento' : ''}`}>
            {edad > EDAD_MAXIMA
              ? `Tenés ${edad} años, por encima del máximo permitido (${EDAD_MAXIMA}). Verificá la fecha.`
              : aplicaDescuento
                ? `Tenés ${edad} años: ¡accedés al 30% de descuento en todas tus compras!`
                : `Tenés ${edad} años. El descuento del 30% se activa a partir de los 65 años.`}
          </div>
        )}

        <div className="fila-campos">
          <label className="campo">
            <span>Contraseña</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => actualizar('password', e.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="campo">
            <span>Repetir contraseña</span>
            <input
              type="password"
              value={form.confirmar}
              onChange={(e) => actualizar('confirmar', e.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
            />
          </label>
        </div>

        <ul className="password-req">
          {requisitos.map((r) => (
            <li key={r.texto} className={r.ok ? 'password-req__ok' : ''}>
              <span aria-hidden="true">{r.ok ? '✓' : '○'}</span> {r.texto}
            </li>
          ))}
        </ul>

        <button type="submit" className="boton boton--primario boton--grande boton--bloque" disabled={enviando}>
          {enviando ? 'Creando cuenta…' : 'Crear mi cuenta'}
        </button>

        <p className="auth__pie">
          ¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link>
        </p>
      </form>

      <aside className="card auth__lateral">
        <h2>Descuento 65+</h2>
        <p>
          Cargá tu fecha de nacimiento. Si tenés 65 años o más, cada compra que hagas con tu sesión
          iniciada tendrá un <strong>30% de descuento</strong> aplicado automáticamente en el carrito y
          en el pago.
        </p>
        <ul className="lista-tilde">
          <li>Seguimiento de tus compras</li>
          <li>Carrito sincronizado con tu cuenta</li>
          <li>Descuento automático si correspondés</li>
        </ul>
      </aside>
    </div>
  )
}
