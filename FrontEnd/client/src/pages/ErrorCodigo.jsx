import { useParams } from 'react-router-dom'
import PaginaError from '../components/PaginaError'

// Ruta para previsualizar cualquier código de error: /error/401, /error/500, etc.
export default function ErrorCodigo() {
  const { codigo } = useParams()
  const numero = Number(codigo) || 500
  return <PaginaError codigo={numero} />
}
