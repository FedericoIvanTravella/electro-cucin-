/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const FavoritosContext = createContext(null)
const CLAVE = 'ec_favoritos'

// Guarda los IDs de los productos marcados como favoritos en localStorage.
export function FavoritosProvider({ children }) {
  const [favoritos, setFavoritos] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CLAVE) || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(CLAVE, JSON.stringify(favoritos))
  }, [favoritos])

  const esFavorito = useCallback((id) => favoritos.includes(id), [favoritos])

  const alternar = useCallback((id) => {
    setFavoritos((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))
  }, [])

  const limpiar = useCallback(() => setFavoritos([]), [])

  return (
    <FavoritosContext.Provider value={{ favoritos, cantidad: favoritos.length, esFavorito, alternar, limpiar }}>
      {children}
    </FavoritosContext.Provider>
  )
}

export function useFavoritos() {
  return useContext(FavoritosContext)
}
