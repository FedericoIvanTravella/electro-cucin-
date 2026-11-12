/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)

// Notificaciones efímeras (toasts) que aparecen arriba a la derecha.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const contador = useRef(0)

  const quitar = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const mostrar = useCallback(
    (mensaje, tipo = 'info') => {
      const id = ++contador.current
      setToasts((t) => [...t, { id, mensaje, tipo }])
      setTimeout(() => quitar(id), 3500)
    },
    [quitar]
  )

  return (
    <ToastContext.Provider value={{ mostrar }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tipo}`} onClick={() => quitar(t.id)}>
            <span className="toast__icono" aria-hidden="true">
              <i className={`fi ${t.tipo === 'exito' ? 'fi-rr-check' : t.tipo === 'error' ? 'fi-rr-exclamation' : 'fi-rr-info'}`} />
            </span>
            <span>{t.mensaje}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
