import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import TazaMascota from './TazaMascota'
import { api } from '../lib/api'
import { dinero, imagenProducto } from '../lib/format'

const CLAVE_HISTORIAL = 'ec-nero-chat-v1'
const WHATSAPP = 'https://wa.me/5490800123456'

const BIENVENIDA = {
  id: 'bienvenida',
  autor: 'nero',
  respuesta: '¡Hola! Soy Nero 👋 Puedo ayudarte con productos, precios, envíos, devoluciones y el estado de tus pedidos.',
  sugerencias: ['¿Qué freidoras tenés?', '¿Cuánto cuesta el envío?', '¿Cómo hago una devolución?']
}

function leerHistorial() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_HISTORIAL))
    if (Array.isArray(guardado) && guardado.length) {
      return guardado
        .slice(-30)
        .map((mensaje) =>
          mensaje.autor === 'nero' && mensaje.texto && !mensaje.respuesta
            ? { ...mensaje, respuesta: mensaje.texto }
            : mensaje
        )
    }
  } catch {
    // Historial dañado: arrancamos de cero.
  }
  return [BIENVENIDA]
}

function linkHumano(texto) {
  const mensaje = texto
    ? `Hola, vengo de Electro Cuciné. Necesito ayuda con: ${texto}`
    : 'Hola, vengo de Electro Cuciné. Quiero consultar por un producto.'
  return `${WHATSAPP}?text=${encodeURIComponent(mensaje)}`
}

function horaActual() {
  return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function nuevaId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export default function ChatNero() {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState(leerHistorial)
  const [texto, setTexto] = useState('')
  const [escribiendo, setEscribiendo] = useState(false)
  const contenedorRef = useRef(null)
  const inputRef = useRef(null)
  const listaRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(mensajes.slice(-30)))
    } catch {
      // Modo privado o storage lleno: la charla sigue en memoria.
    }
  }, [mensajes])

  useEffect(() => {
    if (!abierto) return undefined
    inputRef.current?.focus()
    const alClic = (evento) => {
      if (!contenedorRef.current?.contains(evento.target)) setAbierto(false)
    }
    const alTeclear = (evento) => {
      if (evento.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', alClic)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('mousedown', alClic)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [abierto])

  useEffect(() => {
    if (abierto && listaRef.current) {
      listaRef.current.scrollTop = listaRef.current.scrollHeight
    }
  }, [abierto, mensajes, escribiendo])

  useEffect(() => () => abortRef.current?.abort(), [])

  const enviar = async (valor) => {
    const consulta = String(valor ?? texto).trim().slice(0, 500)
    if (!consulta || escribiendo) return

    setMensajes((actuales) => [
      ...actuales,
      { id: nuevaId(), autor: 'cliente', texto: consulta, respuesta: consulta, hora: horaActual() }
    ])
    setTexto('')
    setEscribiendo(true)

    const control = new AbortController()
    abortRef.current = control
    try {
      const respuesta = await api('/chat', { method: 'POST', body: { mensaje: consulta }, signal: control.signal })
      setMensajes((actuales) => [
        ...actuales,
        { id: nuevaId(), autor: 'nero', hora: horaActual(), ...respuesta }
      ])
    } catch (error) {
      if (error?.name === 'AbortError') return
      setMensajes((actuales) => [
        ...actuales,
        {
          id: nuevaId(),
          autor: 'nero',
          hora: horaActual(),
          respuesta: 'No pude conectar con la tienda en este momento. Probá de nuevo o escribinos por WhatsApp.',
          enlaces: [{ etiqueta: 'Hablar por WhatsApp', to: linkHumano(consulta), externo: true }],
          sugerencias: []
        }
      ])
    } finally {
      setEscribiendo(false)
      abortRef.current = null
    }
  }

  const ultimoNero = [...mensajes].reverse().find((mensaje) => mensaje.autor === 'nero')
  const ultimaConsulta = [...mensajes].reverse().find((mensaje) => mensaje.autor === 'cliente')?.texto || ''
  const sugerencias = ultimoNero?.sugerencias || []

  return (
    <div className="nero-chat" ref={contenedorRef}>
      {abierto && (
        <section className="nero-chat__panel" id="nero-chat-panel" role="dialog" aria-label="Chat con Nero">
          <header className="nero-chat__cabecera">
            <div className="nero-chat__identidad">
              <span className="nero-chat__avatar" aria-hidden="true">
                <TazaMascota estado="neutra" size={38} />
              </span>
              <div>
                <p className="nero-chat__nombre">Nero <span className="nero-chat__estado" aria-label="Disponible" /></p>
                <p className="nero-chat__subtitulo">Asistente de Electro Cuciné</p>
              </div>
            </div>
            <button
              type="button"
              className="nero-chat__cerrar"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar chat"
            >
              <i className="fi fi-rr-x" aria-hidden="true" />
            </button>
          </header>

          <div className="nero-chat__mensajes" ref={listaRef} role="log" aria-live="polite" aria-label="Conversación">
            {mensajes.map((mensaje) => (
              <div key={mensaje.id} className={`nero-chat__fila nero-chat__fila--${mensaje.autor}`}>
                <div className="nero-chat__burbuja">
                  {(mensaje.respuesta || mensaje.texto) && <p>{mensaje.respuesta || mensaje.texto}</p>}

                  {mensaje.productos?.length > 0 && (
                    <div className="nero-chat__productos">
                      {mensaje.productos.map((producto) => {
                        const imagen = imagenProducto(producto)
                        return (
                          <Link key={producto.id} to={producto.url} className="nero-chat__producto" onClick={() => setAbierto(false)}>
                            {imagen ? (
                              <img src={imagen} alt="" className="nero-chat__producto-img" loading="lazy" />
                            ) : (
                              <span className="nero-chat__producto-img nero-chat__producto-img--vacio" aria-hidden="true">
                                <i className="fi fi-rr-mug-hot" />
                              </span>
                            )}
                            <span className="nero-chat__producto-datos">
                              <strong>{producto.nombre}</strong>
                              <span>{dinero(producto.precio)}</span>
                              <small>{producto.stock > 0 ? `${producto.stock} en stock` : 'Sin stock'}</small>
                            </span>
                            <i className="fi fi-rr-angle-right" aria-hidden="true" />
                          </Link>
                        )
                      })}
                    </div>
                  )}

                  {mensaje.enlaces?.length > 0 && (
                    <div className="nero-chat__enlaces">
                      {mensaje.enlaces.map((enlace) =>
                        enlace.externo ? (
                          <a key={enlace.to} href={enlace.to} target="_blank" rel="noopener noreferrer">
                            {enlace.etiqueta} <i className="fi fi-rr-angle-right" aria-hidden="true" />
                          </a>
                        ) : (
                          <Link key={enlace.to} to={enlace.to} onClick={() => setAbierto(false)}>
                            {enlace.etiqueta} <i className="fi fi-rr-angle-right" aria-hidden="true" />
                          </Link>
                        )
                      )}
                    </div>
                  )}
                  {mensaje.hora && <time className="nero-chat__hora">{mensaje.hora}</time>}
                </div>
              </div>
            ))}

            {escribiendo && (
              <div className="nero-chat__fila nero-chat__fila--nero" aria-label="Nero está escribiendo">
                <div className="nero-chat__burbuja nero-chat__burbuja--escribiendo">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>

          {sugerencias.length > 0 && !escribiendo && (
            <div className="nero-chat__sugerencias" aria-label="Preguntas sugeridas">
              {sugerencias.map((sugerencia) => (
                <button key={sugerencia} type="button" onClick={() => enviar(sugerencia)}>
                  {sugerencia}
                </button>
              ))}
            </div>
          )}

          <form
            className="nero-chat__formulario"
            onSubmit={(evento) => {
              evento.preventDefault()
              enviar()
            }}
          >
            <label className="nero-chat__campo">
              <span className="sr-only">Escribí tu consulta</span>
              <input
                ref={inputRef}
                value={texto}
                onChange={(evento) => setTexto(evento.target.value)}
                placeholder="Escribí tu consulta…"
                maxLength={500}
                autoComplete="off"
              />
            </label>
            <button type="submit" disabled={!texto.trim() || escribiendo} aria-label="Enviar mensaje">
              <i className="fi fi-rr-paper-plane-top" aria-hidden="true" />
            </button>
          </form>

          <a className="nero-chat__humano" href={linkHumano(ultimaConsulta)} target="_blank" rel="noopener noreferrer">
            <i className="fi fi-brands-whatsapp" aria-hidden="true" /> Hablar con una persona
          </a>
        </section>
      )}

      <button
        type="button"
        className={`nero-chat__boton ${abierto ? 'nero-chat__boton--activo' : ''}`}
        onClick={() => setAbierto((valor) => !valor)}
        aria-expanded={abierto}
        aria-controls="nero-chat-panel"
        aria-label={abierto ? 'Cerrar chat con Nero' : 'Abrir chat con Nero'}
        title={abierto ? 'Cerrar chat' : 'Chateá con Nero'}
      >
        <TazaMascota estado="neutra" size={54} />
        {!abierto && <span className="nero-chat__punto" aria-hidden="true"><i className="fi fi-rr-comment-dots" /></span>}
      </button>
    </div>
  )
}
