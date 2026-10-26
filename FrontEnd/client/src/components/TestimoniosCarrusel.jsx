import { useCallback, useEffect, useState } from 'react'

// Comentarios de compradores. El carrusel avanza solo y se puede
// navegar con las flechas laterales o los puntos de abajo.
const TESTIMONIOS = [
  {
    nombre: 'Marta Gómez',
    lugar: 'Caballito, CABA',
    producto: 'Freidora de aire 5.5L',
    estrellas: 5,
    inicial: 'M',
    texto:
      'Tenía dudas con la compra online por mi edad, pero la página es clarísima. Al iniciar sesión me aplicó el 30% de descuento solo y pagué en cuotas. ¡La freidora es un lujo!'
  },
  {
    nombre: 'Jorge Pereyra',
    lugar: 'Rosario, Santa Fe',
    producto: 'Batidora planetaria 1000W',
    estrellas: 5,
    inicial: 'J',
    texto:
      'Compré un viernes y el lunes ya la tenía en casa. La tarjeta se ve reflejada en la pantalla mientras cargás los datos, eso te da confianza. El producto, impecable.'
  },
  {
    nombre: 'Lucía Fernández',
    lugar: 'Córdoba Capital',
    producto: 'Cafetera espresso 15 bar',
    estrellas: 5,
    inicial: 'L',
    texto:
      'El proceso de pago fue rapidísimo y me confirmaron el pedido al instante. La cafetera superó lo que esperaba por el precio, la recomiendo totalmente.'
  },
  {
    nombre: 'Ricardo Salas',
    lugar: 'La Plata, Buenos Aires',
    producto: 'Pava eléctrica 1.7L',
    estrellas: 5,
    inicial: 'R',
    texto:
      'Excelente atención al comprador. Llamé por una duda con el envío y me respondieron enseguida. El descuento para adultos mayores es un gran gesto.'
  },
  {
    nombre: 'Sofía Martins',
    lugar: 'Mendoza',
    producto: 'Licuadora de vidrio 1.5L',
    estrellas: 4,
    inicial: 'S',
    texto:
      'Muy buena experiencia de compra. Los productos vienen bien embalados y con garantía. Solo tardó un día más de lo previsto, pero valió la pena.'
  }
]

function Estrellas({ cantidad }) {
  return (
    <span className="estrellas" aria-label={`${cantidad} de 5 estrellas`}>
      {'★'.repeat(cantidad)}
      <span className="estrellas__vacias">{'★'.repeat(5 - cantidad)}</span>
    </span>
  )
}

export default function TestimoniosCarrusel() {
  const [indice, setIndice] = useState(0)
  const [pausado, setPausado] = useState(false)
  const total = TESTIMONIOS.length

  const ir = useCallback((n) => setIndice(((n % total) + total) % total), [total])
  const siguiente = useCallback(() => ir(indice + 1), [ir, indice])
  const anterior = useCallback(() => ir(indice - 1), [ir, indice])

  // Avance automático cada 6 segundos (se detiene al pasar el mouse).
  useEffect(() => {
    if (pausado) return
    const timer = setInterval(() => setIndice((i) => (i + 1) % total), 6000)
    return () => clearInterval(timer)
  }, [pausado, total])

  return (
    <div
      className="testimonios"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      <div className="testimonios__ventana">
        {TESTIMONIOS.map((testimonio, i) => (
          <article
            key={testimonio.nombre}
            className={`testimonio ${i === indice ? 'testimonio--activo' : ''}`}
            aria-hidden={i !== indice}
          >
            <Estrellas cantidad={testimonio.estrellas} />
            <p className="testimonio__texto">“{testimonio.texto}”</p>
            <div className="testimonio__autor">
              <span className="testimonio__avatar" aria-hidden="true">
                {testimonio.inicial}
              </span>
              <div>
                <strong>{testimonio.nombre}</strong>
                <span className="testimonio__lugar">{testimonio.lugar}</span>
              </div>
              <span className="chip chip--exito testimonio__producto">✔ {testimonio.producto}</span>
            </div>
          </article>
        ))}
      </div>

      <button
        type="button"
        className="carrusel__boton carrusel__boton--izq"
        onClick={anterior}
        aria-label="Comentario anterior"
      >
        ‹
      </button>
      <button
        type="button"
        className="carrusel__boton carrusel__boton--der"
        onClick={siguiente}
        aria-label="Comentario siguiente"
      >
        ›
      </button>

      <div className="carrusel__puntos">
        {TESTIMONIOS.map((testimonio, i) => (
          <button
            key={testimonio.nombre}
            type="button"
            className={`carrusel__punto ${i === indice ? 'carrusel__punto--activo' : ''}`}
            onClick={() => ir(i)}
            aria-label={`Ir al comentario ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}