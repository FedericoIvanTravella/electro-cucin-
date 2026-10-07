/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setCargando(false)
      return
    }
    api('/auth/me')
      .then((data) => setUsuario(data.usuario))
      .catch(() => setToken(null))
      .finally(() => setCargando(false))
  }, [])

  const entrar = useCallback(async (username, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { username, password } })
    setToken(data.token)
    setUsuario(data.usuario)
    return data.usuario
  }, [])

  const registrar = useCallback(async (datos) => {
    const data = await api('/auth/register', { method: 'POST', body: datos })
    setToken(data.token)
    setUsuario(data.usuario)
    return data.usuario
  }, [])

  const salir = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch {
      // la sesión se cierra igual en el cliente
    }
    setToken(null)
    setUsuario(null)
  }, [])

  const refrescar = useCallback(async () => {
    const data = await api('/auth/me')
    setUsuario(data.usuario)
    return data.usuario
  }, [])

  const esAdmin = usuario?.rol === 'admin'
  const conDescuento = Boolean(usuario?.descuento?.activo)

  return (
    <AuthContext.Provider
      value={{ usuario, cargando, esAdmin, conDescuento, entrar, registrar, salir, refrescar }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
