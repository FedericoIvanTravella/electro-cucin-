// Barras horizontales (ranking de productos), sin dependencias.
// props: datos [{ etiqueta, valor }], formato (v) => texto
export default function ChartBars({ datos, formato = (v) => String(v) }) {
  const series = (datos || []).filter((d) => Number(d.valor) > 0)
  if (series.length === 0) {
    return <p className="aviso aviso--minimo">Todavía no hay ventas para graficar.</p>
  }
  const max = Math.max(...series.map((d) => Number(d.valor) || 0))

  return (
    <ol className="barras-h">
      {series.map((d) => (
        <li key={d.etiqueta} className="barras-h__fila">
          <span className="barras-h__etiqueta" title={d.etiqueta}>
            {d.etiqueta}
          </span>
          <span className="barras-h__pista">
            <span className="barras-h__barra" style={{ width: `${(Number(d.valor) / max) * 100}%` }} />
          </span>
          <span className="barras-h__valor">{formato(Number(d.valor))}</span>
        </li>
      ))}
    </ol>
  )
}
