/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const TemaContext = createContext(null)
const CLAVE = 'ec_tema'
const TEMAS = ['claro', 'oscuro', 'navideño']

export function TemaProvider({ children }) {
  const [tema, setTema] = useState(() => {
    const guardado = localStorage.getItem(CLAVE)
    return TEMAS.includes(guardado) ? guardado : 'claro'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-tema', tema)
    localStorage.setItem(CLAVE, tema)
  }, [tema])

  const alternar = useCallback(
    () => setTema((t) => (t === 'oscuro' ? 'claro' : 'oscuro')),
    []
  )

  const alternarNavideño = useCallback(
    () => setTema((t) => (t === 'navideño' ? 'claro' : 'navideño')),
    []
  )

  return <TemaContext.Provider value={{ tema, alternar, alternarNavideño }}>{children}</TemaContext.Provider>
}

export function useTema() {
  return useContext(TemaContext)
}
