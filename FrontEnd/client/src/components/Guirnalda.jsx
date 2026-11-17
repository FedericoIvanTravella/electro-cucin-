// Guirnalda de luces navideñas: cable caído en arcos (catenaria aprox.)
// colgado de la parte superior del viewport, con luces que titilan.
const COLORES = ['#ff5a5a', '#ffd166', '#4ade80', '#60a5fa', '#c084fc', '#fb923c']
const SWAGS = 5
const DROP = 20 // píxeles máximos de caída del cable
const ALTO = 46 // alto del contenedor en px

// Curva: |sin| escalado, con mínimos (anclajes) en 0 y máximos en DROP
const caida = (t) => DROP * Math.abs(Math.sin(Math.PI * SWAGS * t))

export default function Guirnalda() {
  // Cable: polilínea muestreada de la misma función
  const puntos = []
  for (let x = 0; x <= 1440; x += 10) {
    puntos.push(`${x},${caida(x / 1440).toFixed(2)}`)
  }
  const cable = puntos.join(' ')

  // Luces: distribuidas a lo largo de los arcos
  const TOTAL = 32
  const luces = []
  for (let i = 0; i < TOTAL; i++) {
    const t = (i + 0.5) / TOTAL
    const y = caida(t)
    const color = COLORES[i % COLORES.length]
    const retraso = (i * 0.23) % 2.1
    luces.push(
      <span
        key={i}
        className="guirnalda__luz"
        style={{ left: `${t * 100}%`, top: `${y}px` }}
      >
        <span className="guirnalda__cuelgue" style={{ height: `${y < 6 ? 8 : 6}px` }} />
        <span
          className="guirnalda__bulbo"
          style={{
            background: color,
            boxShadow: `0 0 6px ${color}, 0 0 14px ${color}aa`,
            animationDelay: `${retraso}s`
          }}
        />
      </span>
    )
  }

  return (
    <div className="guirnalda" style={{ height: ALTO }} aria-hidden="true">
      <svg viewBox="0 0 1440 46" preserveAspectRatio="none" className="guirnalda__cable">
        <polyline points={cable} fill="none" stroke="#14201a" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      {luces}
    </div>
  )
}
