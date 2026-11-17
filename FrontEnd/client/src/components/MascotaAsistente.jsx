import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import TazaMascota from './TazaMascota'
import { useToast } from '../context/ToastContext'

// Nero, la mascota de Electro Cuciné, como asistente flotante en la home.
// Cada clic avanza de tip; incluye cupones copiables y atajos útiles.
const MENSAJES = [
  {
    icono: 'fi-rr-truck-side',
    texto: 'Envío gratis en compras desde $150.000, a todo el país.'
  },
  {
    icono: 'fi-rr-credit-card',
    texto: 'Podés pagar en 12 cuotas sin interés con tarjetas seleccionadas.'
  },
  {
    icono: 'fi-rr-badge-percent',
    texto: '¿Tenés 65 años o más? Registrate con tu fecha de nacimiento y te aplicamos 30% OFF en todo.',
    cta: { to: '/registro', etiqueta: 'Aprovechar el 30%', interno: true }
  },
  {
    icono: 'fi-rr-ticket',
    texto: 'Cupón COCINA10: 10% OFF en toda tu compra. ¡Copialo y usalo en el checkout!',
    cupon: 'COCINA10'
  },
  {
    icono: 'fi-rr-ticket',
    texto: 'Cupón CUCINE5: $5.000 de descuento en electrodométicos. ¡Copialo!',
    cupon: 'CUCINE5'
  },
  {
    icono: 'fi-rr-shield-check',
    texto: 'Todos los productos tienen 2 años de garantía oficial y service autorizado.'
  },
  {
    icono: 'fi-rr-hand-holding-heart',
    texto: 'Cambios y devoluciones gratis hasta 30 días después de tu compra.'
  },
  {
    icono: 'fi-rr-star',
    texto: 'Los favoritos del mes: freidoras de aire, pavas eléctricas y hornos eléctricos.',
    cta: { to: '/productos', etiqueta: 'Ver más vendidos', interno: true }
  },
  {
    icono: 'fi-brands-whatsapp',
    texto: '¿Dudas con tu compra? Escribinos por WhatsApp y te ayudamos al toque.',
    cta: {
      to: 'https://wa.me/5490800123456?text=Hola%2C%20vengo%20de%20Electro%20Cucin%C3%A9.%20Quiero%20consultar%20por%20un%20producto.',
      etiqueta: 'Abrir WhatsApp',
      interno: false
    }
  }
]

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    return
  } catch {
    // Fallback para contextos donde la Clipboard API falla (permisos, http viejo)
    const area = document.createElement('textarea')
    area.value = texto
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    document.body.removeChild(area)
  }
}

export default function MascotaAsistente() {
  const { mostrar } = useToast()
  const [abierto, setAbierto] = useState(false)
  const [indice, setIndice] = useState(0)
  const contenedorRef = useRef(null)

  const total = MENSAJES.length
  const mensaje = MENSAJES[indice]

  useEffect(() => {
    if (!abierto) return undefined
    const alClick = (evento) => {
      if (!contenedorRef.current?.contains(evento.target)) setAbierto(false)
    }
    const alEscape = (evento) => {
      if (evento.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', alClick)
    document.addEventListener('keydown', alEscape)
    return () => {
      document.removeEventListener('mousedown', alClick)
      document.removeEventListener('keydown', alEscape)
    }
  }, [abierto])

  const alClickMascota = () => {
    if (!abierto) {
      setAbierto(true)
      return
    }
    setIndice((i) => (i + 1) % total)
  }

  const siguiente = () => setIndice((i) => (i + 1) % total)

  const copiarCupon = async () => {
    try {
      await copiar(mensaje.cupon)
      mostrar(`Cupón ${mensaje.cupon} copiado, pegalo en el checkout`, 'exito')
    } catch {
      mostrar(`No pude copiar el cupón. Usalo manualmente: ${mensaje.cupon}`, 'error')
    }
  }

  return (
    <div className="mascota-asistente" ref={contenedorRef}>
      {abierto && (
        <div
          className="mascota-asistente__burbuja"
          id="mascota-burbuja"
          role="complementary"
          aria-label="Consejos y cupones de Electro Cuciné"
        >
          <div className="mascota-asistente__encabezado">
            <span className="mascota-asistente__nombre">
              <i className="fi fi-rr-mug-hot" aria-hidden="true" /> Nero, tu asistente
            </span>
            <button
              type="button"
              className="mascota-asistente__cerrar"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar ayudante"
            >
              <i className="fi fi-rr-x" aria-hidden="true" />
            </button>
          </div>

          <div className="mascota-asistente__cuerpo">
            <i className={`fi ${mensaje.icono} mascota-asistente__icono`} aria-hidden="true" />
            <p>{mensaje.texto}</p>
          </div>

          {mensaje.cupon && (
            <button type="button" className="mascota-asistente__cupon" onClick={copiarCupon}>
              <span className="mascota-asistente__codigo">{mensaje.cupon}</span>
              <i className="fi fi-rr-copy" aria-hidden="true" /> Copiar cupón
            </button>
          )}

          {mensaje.cta &&
            (mensaje.cta.interno ? (
              <Link to={mensaje.cta.to} className="mascota-asistente__cta" onClick={() => setAbierto(false)}>
                {mensaje.cta.etiqueta} <i className="fi fi-rr-angle-right" aria-hidden="true" />
              </Link>
            ) : (
              <a
                href={mensaje.cta.to}
                className="mascota-asistente__cta"
                target="_blank"
                rel="noopener noreferrer"
              >
                {mensaje.cta.etiqueta} <i className="fi fi-rr-angle-right" aria-hidden="true" />
              </a>
            ))}

          <div className="mascota-asistente__pie">
            <span className="mascota-asistente__contador">
              {indice + 1}/{total}
            </span>
            <button type="button" className="mascota-asistente__siguiente" onClick={siguiente}>
              Siguiente consejo
              <i className="fi fi-rr-angle-right" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className={`mascota-asistente__boton ${abierto ? 'mascota-asistente__boton--activo' : ''}`}
        onClick={alClickMascota}
        aria-expanded={abierto}
        aria-controls="mascota-burbuja"
        aria-label={abierto ? 'Nero: mostrar siguiente consejo' : 'Nero, ayuda con tu compra'}
        title={abierto ? 'Otro consejo' : 'Ayuda con tu compra'}
      >
        <TazaMascota estado="neutra" size={62} />
        {!abierto && (
          <span className="mascota-asistente__aviso" aria-hidden="true">
            <i className="fi fi-rr-info" />
          </span>
        )}
      </button>
    </div>
  )
}
