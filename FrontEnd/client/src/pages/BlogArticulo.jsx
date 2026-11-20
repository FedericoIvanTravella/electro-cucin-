import { Link, Navigate, useParams } from 'react-router-dom'
import { ARTICULOS, articuloPorSlug } from '../data/blog'
import { useTitulo } from '../lib/useTitulo'

export default function BlogArticulo() {
  const { slug } = useParams()
  const articulo = articuloPorSlug(slug)

  useTitulo(articulo ? `${articulo.titulo} | Blog Electro Cuciné` : 'Blog | Electro Cuciné')

  if (!articulo) return <Navigate to="/blog" replace />

  const relacionados = ARTICULOS.filter((a) => a.slug !== articulo.slug).slice(0, 2)

  return (
    <article className="seccion blog-articulo">
      <nav className="pdp-migas" aria-label="Migas de pan">
        <Link to="/">Inicio</Link>
        <i className="fi fi-rr-angle-small-right" aria-hidden="true" />
        <Link to="/blog">Blog</Link>
        <i className="fi fi-rr-angle-small-right" aria-hidden="true" />
        <span>{articulo.categoria}</span>
      </nav>

      <header className="blog-articulo__cabecera">
        <span className="blog-card__categoria">{articulo.categoria}</span>
        <h1>{articulo.titulo}</h1>
        <p className="blog-articulo__bajada">{articulo.bajada}</p>
        <p className="blog-articulo__meta">
          Por {articulo.autor} · {articulo.fechaTexto} · {articulo.lectura} de lectura
        </p>
      </header>

      <div className="blog-articulo__cuerpo">
        {articulo.cuerpo.map((bloque, i) =>
          bloque.tipo === 'h2' ? (
            <h2 key={i}>{bloque.texto}</h2>
          ) : (
            <p key={i}>{bloque.texto}</p>
          )
        )}
      </div>

      <div className="blog-articulo__cta card">
        <div>
          <h2>¿Listo para renovar tu cocina?</h2>
          <p>Explorá el catálogo completo con envío sin cargo desde $150.000.</p>
        </div>
        <Link to="/productos" className="boton boton--primario">
          Ver productos
        </Link>
      </div>

      <section className="seccion">
        <h2 className="h2-seccion">Seguir leyendo</h2>
        <div className="blog-grilla">
          {relacionados.map((art) => (
            <Link key={art.slug} to={`/blog/${art.slug}`} className="card blog-card">
              <span className="blog-card__categoria">{art.categoria}</span>
              <h3>{art.titulo}</h3>
              <p>{art.bajada}</p>
              <span className="blog-card__meta">{art.fechaTexto}</span>
            </Link>
          ))}
        </div>
      </section>
    </article>
  )
}
