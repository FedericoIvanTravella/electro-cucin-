/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const TemaContext = createContext(null)
const CLAVE = 'ec_tema'

// Tema claro/oscuro persistido en localStorage y aplicado en <html data-tema>.
export function TemaProvider({ children }) {
  const [tema, setTema] = useState(() => localStorage.getItem(CLAVE) || 'claro')

  useEffect(() => {
    document.documentElement.setAttribute('data-tema', tema)
    localStorage.setItem(CLAVE, tema)
  }, [tema])

  const alternar = useCallback(() => setTema((t) => (t === 'oscuro' ? 'claro' : 'oscuro')), [])

  return <TemaContext.Provider value={{ tema, alternar }}>{children}</TemaContext.Provider>
}

export function useTema() {
  return useContext(TemaContext)
}
