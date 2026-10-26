import { useEffect, useRef, useState } from 'react'

// Envuelve contenido y lo hace aparecer suavemente cuando entra en pantalla
// (animación sutil al hacer scroll, sin exagerar).
export default function Revelar({ children, className = '', delay = 0, as: Etiqueta = 'div' }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const obs = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <Etiqueta
      ref={ref}
      className={`revelar ${visible ? 'revelar--visible' : ''} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Etiqueta>
  )
}
