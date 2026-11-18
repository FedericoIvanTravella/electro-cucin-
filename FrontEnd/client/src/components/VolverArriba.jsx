import { useEffect, useRef, useState } from 'react'

// Boton flotante para volver arriba. Aparece tras hacer scroll y
// respeta prefers-reduced-motion (usa scroll nativo instantaneo).
export default function VolverArriba() {
  const [visible, setVisible] = useState(false)
  const reducido = useRef(false)

  useEffect(() => {
    reducido.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const onScroll = () => setVisible(window.scrollY > 480)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      type="button"
      className="volver-arriba"
      onClick={() =>
        window.scrollTo({ top: 0, behavior: reducido.current ? 'auto' : 'smooth' })
      }
      aria-label="Volver arriba"
      title="Volver arriba"
    >
      <i className="fi fi-rr-angle-up" aria-hidden="true" />
    </button>
  )
}
