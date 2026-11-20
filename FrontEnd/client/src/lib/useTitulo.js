import { useEffect } from 'react'

// Actualiza el <title> de la pestaña al montar la página.
// En un SPA el index.html es único, así que sin esto todas las rutas
// se ven igual en la barra del navegador (y en los resultados de búsqueda
// cuando el robot ejecuta JavaScript).
export function useTitulo(titulo) {
  useEffect(() => {
    if (!titulo) return undefined
    const anterior = document.title
    document.title = titulo
    return () => {
      document.title = anterior
    }
  }, [titulo])
}
