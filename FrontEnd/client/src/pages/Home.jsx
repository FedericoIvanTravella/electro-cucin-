import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { dinero } from '../lib/format'

const beneficios = [
  { icono: '🚚', titulo: 'Envío sin cargo', texto: 'En compras superiores a $150.000 en todo el país.' },
  { icono: '🛡️', titulo: '2 años de garantía', texto: 'Todos los electrodomésticos con servicio técnico oficial.' },
  { icono: '💳', titulo: '12 cuotas sin interés', texto: 'Con tarjetas bancarias seleccionadas.' },
  { icono: '👵', titulo: '30% para mayores', texto: 'Si tenés 65 años o más, iniciá sesión y el descuento se aplica solo.' }
]

export default function Home() {
  const { usuario } = useAuth()
  const [destacados, setDestacados] = useState([])

  useEffect(() => {
    api('/productos?soloStock=1')
      .then((data) => setDestacados(data.productos.slice(0, 4)))
      .catch(() => setDestacados([]))
  }, [])

  const masBarato = destacados.length
    ? destacados.reduce((min, p) => (p.precio < min.precio ? p : min), destacados[0])
    : null

  return (
    <div className="home">
      <section className="hero">
        <div className="hero__texto">
          <p className="hero__etiqueta">Cocina con tecnología</p>
          <h1>
            Electrodomésticos que <span>enamoran tu cocina</span>
          </h1>
          <p className="hero__bajada">
            Batidoras, hornos, cafeteras y más. Elegí tus productos, revisá el carrito y pagá en
            minutos.
          </p>
          <div className="hero__acciones">
            <Link to="/productos" className="boton boton--primario boton--grande">
              Ver productos
            </Link>
            {!usuario && (
              <Link to="/registro" className="boton boton--fantasma boton--grande">
                Crear mi cuenta
              </Link>
            )}
          </div>
          {usuario?.descuento?.activo && (
            <p className="hero__descuento">
              ¡Hola {usuario.nombre}! Tenés aplicado el {usuario.descuento.porcentaje}% de descuento
              para mayores de 65 años.
            </p>
          )}
          <ul className="hero__datos">
            {destacados.length > 0 && masBarato && (
              <li>
                <strong>{dinero(masBarato.precio)}</strong>
                <span>desde {masBarato.nombre.toLowerCase()}</span>
              </li>
            )}
            <li>
              <strong>+100</strong>
              <span>productos para tu cocina</span>
            </li>
            <li>
              <strong>4.8/5</strong>
              <span>valoración de clientes</span>
            </li>
          </ul>
        </div>
        <div className="hero__arte" aria-hidden="true">
          <div className="hero__plato">
            <span>🥘</span>
            <span>🍳</span>
            <span>☕</span>
            <span>🥄</span>
          </div>
        </div>
      </section>

      <section className="beneficios">
        {beneficios.map((b) => (
          <article key={b.titulo} className="beneficio">
            <span className="beneficio__icono" aria-hidden="true">
              {b.icono}
            </span>
            <h3>{b.titulo}</h3>
            <p>{b.texto}</p>
          </article>
        ))}
      </section>

      <section className="seccion">
        <div className="seccion__cabecera">
          <div>
            <h2>Destacados de la semana</h2>
            <p className="seccion__bajada">Los favoritos de nuestros clientes, listos para tu cocina.</p>
          </div>
          <Link to="/productos" className="boton boton--fantasma">
            Ver catálogo completo
          </Link>
        </div>

        <div className="grilla-productos">
          {destacados.length === 0 && <p className="aviso">Cargando productos…</p>}
          {destacados.map((p) => (
            <ProductCard key={p.id} producto={p} destacado />
          ))}
        </div>
      </section>

      <section className="descuento">
        <div>
          <h2>Beneficio para mayores de 65 años</h2>
          <p>
            Registrate con tu fecha de nacimiento y, si tenés 65 años o más, el sistema aplica
            automáticamente un <strong>30% de descuento</strong> en todo tu carrito.
          </p>
        </div>
        <Link to={usuario ? '/productos' : '/registro'} className="boton boton--primario boton--grande">
          {usuario ? 'Comprar ahora' : 'Quiero mi beneficio'}
        </Link>
      </section>
    </div>
  )
}
