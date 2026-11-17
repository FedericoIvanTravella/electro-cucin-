import { useEffect, useRef } from 'react'

// Capa de nieve sobre toda la página (canvas a pantalla completa).
// Se renderiza solo si el tema activo es "navideño".
export default function Nieve() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    let ancho = window.innerWidth
    let alto = window.innerHeight
    canvas.width = ancho
    canvas.height = alto

    const MAX = 180
    const copos = Array.from({ length: MAX }, () => ({
      x: Math.random() * ancho,
      y: Math.random() * alto,
      r: 0.8 + Math.random() * 2.6,
      vy: 0.3 + Math.random() * 1.1,
      vx: (Math.random() - 0.5) * 0.6,
      fase: Math.random() * Math.PI * 2,
      amplitud: 0.4 + Math.random() * 1.2,
      opacidad: 0.4 + Math.random() * 0.6
    }))

    let raf = 0
    const tick = () => {
      ctx.clearRect(0, 0, ancho, alto)
      const t = performance.now() / 1000
      for (const c of copos) {
        c.y += c.vy
        c.x += c.vx + Math.sin(t + c.fase) * 0.4 * c.amplitud
        if (c.y > alto + 4) {
          c.y = -4
          c.x = Math.random() * ancho
        }
        if (c.x > ancho + 4) c.x = 4
        else if (c.x < 4) c.x = ancho - 4

        ctx.beginPath()
        ctx.fillStyle = `rgba(255,255,255,${c.opacidad})`
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const onResize = () => {
      ancho = window.innerWidth
      alto = window.innerHeight
      canvas.width = ancho
      canvas.height = alto
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={ref} className="nieve-canvas" aria-hidden="true" />
}
