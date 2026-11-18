import { useEffect, useRef } from 'react'

// Confeti liviano en canvas (sin dependencias) para la pantalla de éxito.
// Respeta prefers-reduced-motion.
const COLORES = ['#ff6a35', '#ffd166', '#4ade80', '#60a5fa', '#c084fc', '#f6f2ec']

export default function Confetti({ duracion = 3000 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const dimensiones = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    dimensiones()
    window.addEventListener('resize', dimensiones)

    const random = (min, max) => min + Math.random() * (max - min)
    const COPOS = 120
    const particulas = Array.from({ length: COPOS }, () => ({
      x: random(0, window.innerWidth),
      y: random(-window.innerHeight * 0.35, -20),
      vx: random(-1.6, 1.6),
      vy: random(1.2, 3.2),
      ancho: random(5, 11),
      alto: random(8, 16),
      rotacion: random(0, Math.PI),
      velocidadRotacion: random(-0.06, 0.06),
      color: COLORES[Math.floor(Math.random() * COLORES.length)],
      forma: Math.random() < 0.3 ? 'circulo' : 'rectangulo'
    }))

    const inicio = performance.now()
    let raf = 0
    const tick = () => {
      const transcurrido = performance.now() - inicio
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const p of particulas) {
        p.vy = Math.min(p.vy + 0.035, 5)
        p.x += p.vx
        p.y += p.vy
        p.rotacion += p.velocidadRotacion

        if (p.x < -20) p.x = canvas.width + 10
        if (p.x > canvas.width + 20) p.x = -10

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotacion)
        ctx.fillStyle = p.color
        if (p.forma === 'circulo') {
          ctx.beginPath()
          ctx.arc(0, 0, p.ancho / 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(-p.ancho / 2, -p.alto / 2, p.ancho, p.alto)
        }
        ctx.restore()
      }

      if (transcurrido < duracion) {
        raf = requestAnimationFrame(tick)
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', dimensiones)
    }
  }, [duracion])

  return <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />
}
