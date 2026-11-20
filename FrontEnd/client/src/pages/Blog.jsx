import { Link } from 'react-router-dom'
import Revelar from '../components/Revelar'
import { ARTICULOS } from '../data/blog'
import { useTitulo } from '../lib/useTitulo'

export default function Blog() {
  useTitulo('Blog · Consejos de cocina | Electro Cuciné')

  const [destacado, ...resto] = ARTICULOS

  return (
    <div className="seccion blog">
      <div className="seccion__cabecera">
        <div>
          <h1>Blog de Electro Cuciné</h1>
          <p className="seccion__bajada">
            Guías de compra, cuidados y trucos para sacarle el máximo a tus electrodomésticos.
          </p>
        </div>
        <Link to="/productos" className="boton boton--fantasma">
          Ir al catálogo
        </Link>
      </div>

      <Revelar>
        <Link to={`/blog/${destacado.slug}`} className="card blog-destacado">
          <span className="blog-destacado__badge">{destacado.categoria}</span>
          <h2>{destacado.titulo}</h2>
          <p>{destacado.bajada}</p>
          <span className="blog-destacado__meta">
            {destacado.fechaTexto} · {destacado.lectura} de lectura
          </span>
          <span className="blog-destacado__cta">
            Leer artículo <i className="fi fi-rr-arrow-right" aria-hidden="true" />
          </span>
        </Link>
      </Revelar>

      <div className="blog-grilla">
        {resto.map((art, i) => (
          <Revelar key={art.slug} delay={i * 80} className="revelar--item">
            <Link to={`/blog/${art.slug}`} className="card blog-card">
              <span className="blog-card__categoria">{art.categoria}</span>
              <h2>{art.titulo}</h2>
              <p>{art.bajada}</p>
              <span className="blog-card__meta">
                {art.fechaTexto} · {art.lectura}
              </span>
            </Link>
          </Revelar>
        ))}
      </div>
    </div>
  )
}
