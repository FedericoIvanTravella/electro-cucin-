import { Link } from 'react-router-dom'
import TazaMascota from './TazaMascota'

// Mensajes y expresión de la mascota para cada código HTTP.
const CODIGOS = {
  400: {
    titulo: 'Datos inválidos',
    mensaje: 'Algo de lo que completaste no está del todo bien. Revisá los datos y volvé a intentarlo.',
    estado: 'duda'
  },
  401: {
    titulo: 'Necesitás iniciar sesión',
    mensaje: 'Tu sesión expiró o todavía no ingresaste. Iniciá sesión para seguir con tu compra.',
    estado: 'duda'
  },
  403: {
    titulo: 'Acceso restringido',
    mensaje: 'Esta sección es solo para el superusuario. No tenés permiso para verla.',
    estado: 'seria'
  },
  404: {
    titulo: 'Página no encontrada',
    mensaje: 'Se nos enfrió el café buscando esta página y no la encontramos. Puede que ya no exista.',
    estado: 'triste'
  },
  409: {
    titulo: 'Ese registro ya existe',
    mensaje: 'Parece que alguien pidió lo mismo antes. Probá con otros datos.',
    estado: 'duda'
  },
  429: {
    titulo: 'Demasiados intentos',
    mensaje: 'Hicimos muchas preguntas seguidas y nos pidieron esperar un momento. Probá en unos minutos.',
    estado: 'seria'
  },
  500: {
    titulo: 'El servidor tuvo un problema',
    mensaje: 'Se nos derramó el café en la cocina. Nuestro equipo ya está limpiando el desastre.',
    estado: 'triste'
  },
  503: {
    titulo: 'Servicio no disponible',
    mensaje: 'La cocina está en mantenimiento. Volvemos en unos minutos con todo listo.',
    estado: 'seria'
  }
}

const DEFECTO = {
  titulo: 'Ups, algo salió mal',
  mensaje: 'Ocurrió un error inesperado mientras preparábamos todo.',
  estado: 'triste'
}

export default function PaginaError({ codigo = 500, titulo, mensaje, estado, reintentar = true, children }) {
  const info = CODIGOS[codigo] || DEFECTO
  const tituloFinal = titulo || info.titulo
  const mensajeFinal = mensaje || info.mensaje
  const estadoFinal = estado || info.estado

  return (
    <div className="pagina-error">
      <div className="pagina-error__mascota">
        <TazaMascota codigo={codigo} estado={estadoFinal} />
      </div>
      <div className="pagina-error__texto">
        <p className="pagina-error__codigo">Error {codigo}</p>
        <h1>{tituloFinal}</h1>
        <p className="pagina-error__mensaje">{mensajeFinal}</p>
        <div className="pagina-error__acciones">
          <Link to="/" className="boton boton--primario boton--grande">
            Volver al inicio
          </Link>
          {reintentar && (
            <button
              type="button"
              className="boton boton--fantasma boton--grande"
              onClick={() => window.location.reload()}
            >
              Reintentar
            </button>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
