import { useEffect } from 'react'

// Visor de imagen ampliada (zoom). Se cierra con Escape o un clic afuera.
export default function Lightbox({ src, alt = '', onClose }) {
  useEffect(() => {
    const alEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', alEscape)
    return () => window.removeEventListener('keydown', alEscape)
  }, [onClose])

  if (!src) return null

  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button type="button" className="lightbox__cerrar" onClick={onClose} aria-label="Cerrar">
        ×
      </button>
      <img src={src} alt={alt} className="lightbox__img" onClick={(e) => e.stopPropagation()} />
    </div>
  )
}
