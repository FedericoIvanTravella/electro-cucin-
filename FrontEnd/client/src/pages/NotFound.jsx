import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="vacio card">
      <span className="vacio__icono" aria-hidden="true">
        🍽️
      </span>
      <h1>Página no encontrada</h1>
      <p>La dirección que buscás no existe en Electro Cuciné.</p>
      <Link to="/" className="boton boton--primario">
        Volver al inicio
      </Link>
    </div>
  )
}
