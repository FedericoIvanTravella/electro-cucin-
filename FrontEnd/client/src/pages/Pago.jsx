import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import TarjetaCredito from '../components/TarjetaCredito'
import EstadoVacio from '../components/EstadoVacio'
import RutaEntrega from '../components/RutaEntrega'
import Confetti from '../components/Confetti'
import { api } from '../lib/api'
import { dinero } from '../lib/format'

const FORM_INICIAL = {
  titular: '',
  numero: '',
  vencimiento: '',
  cvv: '',
  cuotas: '1',
  calle: '',
  ciudad: '',
  cp: '',
  provincia: ''
}

export default function Pago() {
  const { items, totales, vaciar } = useCart()
  const { usuario } = useAuth()
  const [form, setForm] = useState({ ...FORM_INICIAL, email: usuario?.email || '' })
  const [error, setError] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [venta, setVenta] = useState(null)
  const [cuponInput, setCuponInput] = useState('')
  const [cuponAplicado, setCuponAplicado] = useState(null)
  const [cuponError, setCuponError] = useState('')
  const [aplicandoCupon, setAplicandoCupon] = useState(false)

  if (venta) {
    return (
      <div className="pago-exitoso card">
        <Confetti />
        <span className="pago-exitoso__icono" aria-hidden="true">
          <i className="fi fi-rr-check" />
        </span>
        <h1>¡Pago aprobado!</h1>
        <p>
          Tu compra <strong>#{venta.id}</strong> fue registrada el {venta.fecha}. Te enviamos el
          detalle a {form.email.trim() || usuario?.email || 'tu correo'}.
        </p>
        <RutaEntrega />

        <div className="ticket">
          {venta.items.map((i) => (
            <div key={i.id} className="ticket__linea">
              <span>
                {i.cantidad}× {i.nombre}
              </span>
              <span>{dinero(i.precio * i.cantidad)}</span>
            </div>
          ))}
          <div className="ticket__linea">
            <span>Subtotal</span>
            <span>{dinero(venta.subtotal)}</span>
          </div>
          {venta.descuento_pct > 0 && (
            <div className="ticket__linea ticket__linea--descuento">
              <span>Descuento {venta.descuento_pct}% (65+)</span>
              <span>- {dinero(venta.descuento_monto)}</span>
            </div>
          )}
          {Number(venta.cupon_descuento) > 0 && (
            <div className="ticket__linea ticket__linea--descuento">
              <span>Cupón {venta.cupon_codigo}</span>
              <span>- {dinero(venta.cupon_descuento)}</span>
            </div>
          )}
          <div className="ticket__linea ticket__linea--total">
            <span>Total pagado</span>
            <span>{dinero(venta.total)}</span>
          </div>
          {venta.direccion_envio && (
            <div className="ticket__linea ticket__linea--envio">
              <span><i className="fi fi-rr-box" aria-hidden="true" /> Envío a:</span>
              <span className="ticket__envio-texto">{venta.direccion_envio}</span>
            </div>
          )}
        </div>

        <div className="pago-exitoso__acciones">
          <Link to="/mis-compras" className="boton boton--primario">
            Ver mis compras
          </Link>
          <Link to="/productos" className="boton boton--fantasma">
            Seguir comprando
          </Link>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <EstadoVacio
        titulo="No hay productos para pagar"
        mensaje="Agregá productos al carrito antes de iniciar el pago."
      >
        <Link to="/productos" className="boton boton--primario boton--grande">
          Ir al catálogo
        </Link>
      </EstadoVacio>
    )
  }

  const actualizar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const totalFinal = cuponAplicado ? Math.max(0, totales.total - cuponAplicado.descuento) : totales.total

  const aplicarCupon = async () => {
    const codigo = cuponInput.trim().toUpperCase()
    if (!codigo) {
      setCuponError('Ingresá un código.')
      return
    }
    setAplicandoCupon(true)
    setCuponError('')
    try {
      const data = await api('/cupones/validar', { method: 'POST', body: { codigo, subtotal: totales.subtotal } })
      setCuponAplicado({ ...data.cupon, descuento: data.descuento, codigo: data.cupon.codigo })
      setCuponInput('')
    } catch (err) {
      setCuponError(err?.message || 'Cupón no válido.')
      setCuponAplicado(null)
    } finally {
      setAplicandoCupon(false)
    }
  }

  const quitarCupon = () => setCuponAplicado(null)

  const direccionEnvio = () =>
    [form.calle.trim(), form.ciudad.trim(), form.cp.trim() && `CP ${form.cp.trim()}`, form.provincia.trim()]
      .filter(Boolean)
      .join(', ')

  const validar = () => {
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      return 'El correo para la confirmación no es válido.'
    }
    if (!form.titular.trim()) return 'Ingresá el nombre del titular de la tarjeta.'
    const numero = form.numero.replace(/\s+/g, '')
    if (!/^\d{16}$/.test(numero)) return 'El número de tarjeta debe tener 16 dígitos.'
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(form.vencimiento)) return 'El vencimiento debe tener el formato MM/AA.'
    if (!/^\d{3,4}$/.test(form.cvv)) return 'El código de seguridad debe tener 3 o 4 dígitos.'
    if (!form.calle.trim()) return 'Ingresá la calle y número para el envío.'
    if (!form.ciudad.trim()) return 'Ingresá la ciudad de envío.'
    if (!/^\d{4,5}$/.test(form.cp.trim())) return 'Ingresá el código postal correcto.'
    if (!form.provincia.trim()) return 'Ingresá la provincia de envío.'
    return ''
  }

  const pagar = async (e) => {
    e.preventDefault()
    const falla = validar()
    if (falla) {
      setError(falla)
      return
    }

    setError('')
    setProcesando(true)
    try {
      const data = await api('/ventas', {
        method: 'POST',
        body: {
          items: items.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
          metodo_pago: 'tarjeta',
          cuotas: Number(form.cuotas),
          direccion_envio: direccionEnvio(),
          email_contacto: form.email.trim(),
          cupon_codigo: cuponAplicado?.codigo || ''
        }
      })
      setVenta(data.venta)
      vaciar()
    } catch (err) {
      setError(err.message)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="pago">
      <form className="card pago__formulario" onSubmit={pagar}>
        <div className="pago__encabezado">
          <h1>Pago</h1>
          <span className="chip chip--seguro"><i className="fi fi-rr-lock" aria-hidden="true" /> Pago seguro</span>
        </div>
        <p className="seccion__bajada">
          Completá los datos de la tarjeta. Nunca almacenamos los números y la operación se procesa de forma segura.
        </p>

        <TarjetaCredito
          numero={form.numero}
          titular={form.titular}
          vencimiento={form.vencimiento}
          cvv={form.cvv}
        />

        {error && <p className="alerta alerta--error">{error}</p>}

        <label className="campo">
          <span>Titular de la tarjeta</span>
          <input
            value={form.titular}
            onChange={(e) => actualizar('titular', e.target.value)}
            placeholder="Como figura en la tarjeta"
          />
        </label>

        <label className="campo">
          <span>Número de tarjeta</span>
          <input
            value={form.numero}
            onChange={(e) => actualizar('numero', e.target.value.replace(/[^\d ]/g, '').slice(0, 19))}
            placeholder="4111 1111 1111 1111"
            inputMode="numeric"
          />
        </label>

        <label className="campo">
          <span>Correo para la confirmación</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => actualizar('email', e.target.value)}
            placeholder="tu@correo.com"
            autoComplete="email"
            required
          />
          <small className="campo__nota">Te llega el detalle del pedido a este correo (por defecto, el de tu cuenta).</small>
        </label>

        <div className="fila-campos">
          <label className="campo">
            <span>Vencimiento</span>
            <input
              value={form.vencimiento}
              onChange={(e) => {
                let v = e.target.value.replace(/[^\d]/g, '').slice(0, 4)
                if (v.length > 2) v = `${v.slice(0, 2)}/${v.slice(2)}`
                actualizar('vencimiento', v)
              }}
              placeholder="MM/AA"
            />
          </label>
          <label className="campo">
            <span>CVV</span>
            <input
              value={form.cvv}
              onChange={(e) => actualizar('cvv', e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
              placeholder="123"
              inputMode="numeric"
            />
          </label>
          <label className="campo">
            <span>Cuotas</span>
            <select value={form.cuotas} onChange={(e) => actualizar('cuotas', e.target.value)}>
              <option value="1">1 pago</option>
              <option value="3">3 cuotas</option>
              <option value="6">6 cuotas</option>
              <option value="12">12 cuotas</option>
            </select>
          </label>
        </div>

        <h2 className="pago__subtitulo">Dirección de envío</h2>
        <label className="campo">
          <span>Calle y número</span>
          <input
            value={form.calle}
            onChange={(e) => actualizar('calle', e.target.value)}
            placeholder="Av. Corrientes 1234, piso 2 (opcional: depto / referencia)"
            autoComplete="street-address"
          />
        </label>
        <div className="fila-campos">
          <label className="campo">
            <span>Ciudad</span>
            <input
              value={form.ciudad}
              onChange={(e) => actualizar('ciudad', e.target.value)}
              placeholder="Ciudad"
              autoComplete="address-level2"
            />
          </label>
          <label className="campo">
            <span>Código postal</span>
            <input
              value={form.cp}
              onChange={(e) => actualizar('cp', e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
              placeholder="1414"
              inputMode="numeric"
              autoComplete="postal-code"
            />
          </label>
          <label className="campo">
            <span>Provincia</span>
            <input
              value={form.provincia}
              onChange={(e) => actualizar('provincia', e.target.value)}
              placeholder="Buenos Aires (CABA)"
              autoComplete="address-level1"
            />
          </label>
        </div>

        <button type="submit" className="boton boton--primario boton--grande boton--bloque" disabled={procesando}>
          {procesando ? 'Procesando pago…' : `Pagar ${dinero(totalFinal)}`}
        </button>
      </form>

      <aside className="card pago__resumen">
        <h2>Tu pedido</h2>
        {items.map((i) => (
          <div key={i.producto_id} className="resumen-linea">
            <span>
              {i.cantidad}× {i.nombre}
            </span>
            <span>{dinero(i.precio * i.cantidad)}</span>
          </div>
        ))}
        <div className="resumen-linea">
          <span>Subtotal</span>
          <span>{dinero(totales.subtotal)}</span>
        </div>
        {totales.porcentaje > 0 && (
          <div className="resumen-linea resumen-linea--descuento">
            <span>Descuento 65+ ({totales.porcentaje}%)</span>
            <span>- {dinero(totales.descuento)}</span>
          </div>
        )}
        {cuponAplicado && (
          <div className="resumen-linea resumen-linea--descuento">
            <span>
              Cupón {cuponAplicado.codigo}{' '}
              <button type="button" className="resumen-linea__quitar" onClick={quitarCupon} aria-label="Quitar cupón">
                <i className="fi fi-rr-x" aria-hidden="true" />
              </button>
            </span>
            <span>- {dinero(cuponAplicado.descuento)}</span>
          </div>
        )}
        <div className="cupon">
          <input
            type="text"
            placeholder="Código de descuento (ej: COCINA10)"
            value={cuponInput}
            onChange={(e) => {
              setCuponInput(e.target.value.toUpperCase())
              setCuponError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                aplicarCupon()
              }
            }}
            aria-label="Código de descuento"
          />
          <button type="button" className="boton boton--secundario boton--chico" onClick={aplicarCupon} disabled={aplicandoCupon || !cuponInput.trim()}>
            {aplicandoCupon ? '…' : 'Aplicar'}
          </button>
        </div>
        {cuponError && <p className="alerta alerta--error alerta--compacta">{cuponError}</p>}
        <div className="resumen-linea resumen-linea--total">
          <span>Total</span>
          <span>{dinero(totalFinal)}</span>
        </div>
        <small className="pago__nota">
          El descuento para mayores de 65 años se valida con tu fecha de nacimiento registrada.
        </small>
      </aside>
    </div>
  )
}
