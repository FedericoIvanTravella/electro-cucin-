// Donut (quesitos) en SVG, sin dependencias.
// props: datos [{ etiqueta, valor }], formato (v) => texto,
//        centroTitulo (texto chico), centroValor (opcional; por defecto total formateado)
const PALETA = ['#f2542d', '#0ea5e9', '#0a2354', '#f5a623', '#00a650', '#8b5cf6', '#e11d48', '#64748b']

export default function ChartDonut({ datos, formato = (v) => String(v), centroTitulo = '', centroValor }) {
  const limpios = (datos || []).map((d) => ({ ...d, valor: Number(d.valor) || 0 })).filter((d) => d.valor > 0)
  const total = limpios.reduce((s, d) => s + d.valor, 0)

  if (total <= 0 || limpios.length === 0) {
    return <p className="aviso aviso--minimo">Todavía no hay datos para graficar.</p>
  }

  const R = 62
  const C = 2 * Math.PI * R
  // Acumulado vía reduce (sin reasignar variables en el cuerpo del componente).
  const { segmentos } = limpios.reduce(
    (estado, d, i) => {
      const dash = (d.valor / total) * C
      const segmento = {
        ...d,
        color: PALETA[i % PALETA.length],
        pct: Math.round((d.valor / total) * 100),
        dash,
        offset: -estado.acumulado
      }
      return { segmentos: [...estado.segmentos, segmento], acumulado: estado.acumulado + dash }
    },
    { segmentos: [], acumulado: 0 }
  )

  return (
    <div className="donut">
      <svg viewBox="0 0 170 170" className="donut__svg" role="img" aria-label={`Distribución de ${centroTitulo || 'categorías'}`}>
        <circle cx="85" cy="85" r={R} fill="none" stroke="var(--gris-claro)" strokeWidth="26" />
        <g transform="rotate(-90 85 85)">
          {segmentos.map((s) => (
            <circle
              key={s.etiqueta}
              cx="85"
              cy="85"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="26"
              strokeDasharray={`${s.dash} ${C - s.dash}`}
              strokeDashoffset={s.offset}
            >
              <title>{`${s.etiqueta}: ${formato(s.valor)} (${s.pct}%)`}</title>
            </circle>
          ))}
        </g>
        <text x="85" y="81" textAnchor="middle" className="donut__centro-valor">
          {centroValor ?? formato(total)}
        </text>
        <text x="85" y="101" textAnchor="middle" className="donut__centro-label">
          {centroTitulo}
        </text>
      </svg>

      <ul className="donut__leyenda">
        {segmentos.map((s) => (
          <li key={s.etiqueta}>
            <span className="donut__dot" style={{ background: s.color }} aria-hidden="true" />
            <span className="donut__label">{s.etiqueta}</span>
            <span className="donut__valor">
              {formato(s.valor)} <em>({s.pct}%)</em>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
