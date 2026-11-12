// Columnas verticales en SVG, sin dependencias (serie de tiempo).
// props: datos [{ etiqueta, valor, tooltip }], formato (v) => texto
export default function ChartColumns({ datos, formato = (v) => String(v) }) {
  const series = datos || []
  const max = Math.max(1, ...series.map((d) => Number(d.valor) || 0))
  const n = series.length
  if (n === 0) return <p className="aviso aviso--minimo">Todavía no hay datos para graficar.</p>

  const W = 620
  const H = 190
  const BASE = 160
  const ALTO = 128
  const paso = W / n
  const ancho = Math.max(8, paso * 0.58)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="columnas__svg" role="img" aria-label="Ventas de los últimos 14 días">
      {/* línea base */}
      <line x1="0" y1={BASE} x2={W} y2={BASE} stroke="var(--borde)" strokeWidth="1.5" />
      {series.map((d, i) => {
        const valor = Number(d.valor) || 0
        const h = (valor / max) * ALTO
        const x = i * paso + (paso - ancho) / 2
        return (
          <g key={i}>
            <rect
              x={x}
              y={BASE - h}
              width={ancho}
              height={Math.max(valor > 0 ? 2 : 0, h)}
              rx="3"
              className="columnas__barra"
            >
              <title>{`${d.tooltip || d.etiqueta}: ${formato(valor)}`}</title>
            </rect>
            {i % 2 === 0 && (
              <text x={x + ancho / 2} y={BASE + 14} textAnchor="middle" className="columnas__label">
                {d.etiqueta}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
