export default function Stars({ promedio = 0, cantidad = null, className = '' }) {
  const p = Number(promedio) || 0
  const llenas = Math.round(p)
  return (
    <span
      className={`estrellitas ${className}`}
      role="img"
      aria-label={`${p.toFixed(1)} de 5 estrellas${cantidad !== null ? ` (${cantidad} reseñas)` : ''}`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={`fi ${n <= llenas ? 'fi-sr-star' : 'fi-rr-star'}`} aria-hidden="true" />
      ))}
      {cantidad !== null && (
        <span className="estrellitas__num">
          {p.toFixed(1)} <em>({cantidad})</em>
        </span>
      )}
    </span>
  )
}
