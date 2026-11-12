import { useState } from 'react'
import { Link } from 'react-router-dom'

const pasosCompra = [
  { icono: 'fi-rr-shopping-bag', texto: 'Elegí tus productos en el catálogo y agregalos al carrito.' },
  { icono: 'fi-rr-lock', texto: 'Iniciá sesión o registrate para continuar con el pago.' },
  { icono: 'fi-rr-map-marker', texto: 'Completá la dirección donde querés recibir el paquete.' },
  { icono: 'fi-rr-credit-card', texto: 'Paginá con tarjeta en hasta 12 cuotas (entorno de prueba).' },
  { icono: 'fi-rr-box', texto: 'Recibí tu pedido y revisá la caja apenas llegue.' }
]

const faqPedido = [
  {
    pregunta: '¿Cómo sé si mi pedido fue registrado?',
    respuesta:
      'Al confirmar el pago ves un ticket con el número de pedido (por ejemplo, #3) y enseguida queda guardado en "Mis compras".'
  },
  {
    pregunta: '¿Puedo pagar en cuotas?',
    respuesta:
      'Sí: ofrecemos 1, 3, 6 y 12 cuotas. En la tarjeta de cada producto podés ver el valor de las 12 cuotas sin interés.'
  },
  {
    pregunta: '¿Cuánto cuesta el envío?',
    respuesta:
      'El envío es sin cargo en compras mayores a $150.000. Debajo de ese monto se calcula el costo según tu código postal.'
  },
  {
    pregunta: '¿Cómo funciona el descuento para mayores de 65?',
    respuesta:
      'Si registrás tu fecha de nacimiento y tenés 65 años o más, al iniciar sesión se aplica automáticamente un 30% sobre el total de tu carrito.'
  },
  {
    pregunta: '¿Cómo agrego o quito productos del carrito?',
    respuesta:
      'Desde el carrito podés cambiar cantidades con los botones + y −, eliminar un producto individual o vaciar todo el carrito.'
  }
]

const faqPaquete = [
  {
    pregunta: 'El producto llegó dañado o golpeado',
    respuesta:
      'Conservá el embalaje y sacá fotos del producto y la caja. Contactanos dentro de los 7 días con el número de pedido y te lo cambiamos sin costo o te hacemos la devolución.'
  },
  {
    pregunta: 'A mi paquete le falta un accesorio o pieza',
    respuesta:
      'Compará el contenido con lo que figura en "Mis compras": si falta algo del producto (accesorio, cable, manual), escribinos con el número de pedido y en 48 h hábiles te enviamos la pieza faltante.'
  },
  {
    pregunta: 'Me llegó un producto que no pedí o está incompleto',
    respuesta:
      'Revisá el ticket de tu compra en "Mis compras" y enviá una foto del paquete y del producto recibido. Coordinamos la recolección y el reemplazo sin costo.'
  },
  {
    pregunta: '¿Qué pasa si otra persona recibe mi paquete?',
    respuesta:
      'El paquete se entrega en la dirección que cargaste al pagar. Verificá que la calle, el código postal y la provincia estén bien escritos antes de confirmar el pago.'
  },
  {
    pregunta: '¿Cómo gestiono un cambio o devolución?',
    respuesta:
      'Tenés 30 días desde la entrega para cambios y devoluciones. El producto debe estar en su caja original. Contactanos por el formulario de acá abajo o por teléfono.'
  },
  {
    pregunta: '¿Cómo funciona la garantía?',
    respuesta:
      'Todos nuestros electrodomésticos tienen 2 años de garantía con servicio técnico oficial. Ante cualquier falla, contactanos con el número de pedido y tu factura.'
  }
]

export default function Ayuda() {
  const [datos, setDatos] = useState({ nombre: '', email: '', pedido: '', consulta: '' })
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  const actualizar = (campo, valor) => setDatos((d) => ({ ...d, [campo]: valor }))

  const enviar = (e) => {
    e.preventDefault()
    if (!datos.nombre.trim() || !datos.email.trim() || !datos.consulta.trim()) {
      setError('Completá nombre, correo y la descripción de tu consulta.')
      return
    }
    setError('')
    setEnviado(true)
  }

  return (
    <div className="ayuda">
      <div className="seccion__cabecera">
        <div>
          <h1>Ayuda al comprador</h1>
          <p className="seccion__bajada">
            ¿Tenés dudas sobre tu pedido o necesitás ayuda con el paquete que te llegó? Acá te
            ayudamos a resolverlo.
          </p>
        </div>
        <Link to="/productos" className="boton boton--fantasma">
          Ir al catálogo
        </Link>
      </div>

      <div className="ayuda__avisos">
        <div className="card ayuda__aviso">
          <span className="ayuda__aviso-icono" aria-hidden="true">
            <i className="fi fi-rr-shopping-cart" />
          </span>
          <div>
            <h3>¿Tenés dudas sobre tu compra?</h3>
            <p>Pedidos, cuotas, envíos y el descuento para mayores de 65 años.</p>
          </div>
        </div>
        <div className="card ayuda__aviso">
          <span className="ayuda__aviso-icono" aria-hidden="true">
            <i className="fi fi-rr-box" />
          </span>
          <div>
            <h3>¿Necesitás ayuda con tu paquete?</h3>
            <p>Producto dañado, accesorios faltantes, cambios, devoluciones y garantía.</p>
          </div>
        </div>
      </div>

      <section className="ayuda__seccion">
        <h2 className="h2-seccion">Cómo comprar</h2>
        <ol className="ayuda__pasos">
          {pasosCompra.map((paso) => (
            <li key={paso.texto} className="card ayuda__paso">
              <span className="ayuda__paso-icono" aria-hidden="true">
                <i className={`fi ${paso.icono}`} />
              </span>
              <p>{paso.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="ayuda__seccion">
        <h2 className="h2-seccion">Preguntas frecuentes</h2>
        <div className="ayuda__faq">
          <div className="card ayuda__grupo">
            <h3><i className="fi fi-rr-credit-card" aria-hidden="true" /> Sobre tu pedido y el pago</h3>
            {faqPedido.map((faq) => (
              <details key={faq.pregunta} className="faq">
                <summary>{faq.pregunta}</summary>
                <p>{faq.respuesta}</p>
              </details>
            ))}
          </div>
          <div className="card ayuda__grupo">
            <h3><i className="fi fi-rr-box" aria-hidden="true" /> Sobre el paquete que recibiste</h3>
            {faqPaquete.map((faq) => (
              <details key={faq.pregunta} className="faq">
                <summary>{faq.pregunta}</summary>
                <p>{faq.respuesta}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="ayuda__seccion">
        <h2 className="h2-seccion">Contacto</h2>
        <div className="ayuda__contacto">
          <div className="card">
            <h3>Centro de ayuda</h3>
            <p className="ayuda__contacto-item"><i className="fi fi-rr-phone-call" aria-hidden="true" /> 0800-123-4567</p>
            <p className="ayuda__contacto-item"><i className="fi fi-rr-envelope" aria-hidden="true" /> ayuda@electrocucine.com</p>
            <p className="ayuda__contacto-item"><i className="fi fi-rr-clock" aria-hidden="true" /> Lunes a sábados de 9 a 20 h</p>
            <p className="ayuda__contacto-item"><i className="fi fi-rr-map-marker" aria-hidden="true" /> Av. Siempreviva 742, CABA</p>
          </div>

          <div className="card">
            <h3>Envianos tu consulta</h3>
            {enviado ? (
              <p className="alerta alerta--exito">
                ¡Gracias {datos.nombre.split(' ')[0]}! Recibimos tu consulta. Te vamos a responder
                al correo {datos.email} en menos de 48 horas hábiles.
              </p>
            ) : (
              <form onSubmit={enviar}>
                {error && <p className="alerta alerta--error">{error}</p>}
                <div className="fila-campos">
                  <label className="campo">
                    <span>Nombre</span>
                    <input
                      value={datos.nombre}
                      onChange={(e) => actualizar('nombre', e.target.value)}
                      placeholder="Tu nombre"
                    />
                  </label>
                  <label className="campo">
                    <span>Correo</span>
                    <input
                      type="email"
                      value={datos.email}
                      onChange={(e) => actualizar('email', e.target.value)}
                      placeholder="tu@correo.com"
                    />
                  </label>
                </div>
                <label className="campo">
                  <span>Número de pedido (opcional)</span>
                  <input
                    value={datos.pedido}
                    onChange={(e) => actualizar('pedido', e.target.value)}
                    placeholder="Ej: #3"
                  />
                </label>
                <label className="campo">
                  <span>Tu consulta</span>
                  <textarea
                    rows="4"
                    value={datos.consulta}
                    onChange={(e) => actualizar('consulta', e.target.value)}
                    placeholder="Contanos qué pasó con tu pedido o paquete…"
                  />
                </label>
                <button type="submit" className="boton boton--primario boton--grande">
                  Enviar consulta
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}