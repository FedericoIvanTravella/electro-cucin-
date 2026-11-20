/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { api } from '../lib/api'

const CartContext = createContext(null)
const CLAVE = 'ec_carrito'

function leerStorage() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) || '[]')
    return Array.isArray(guardado) ? guardado : []
  } catch {
    return []
  }
}

// Une el carrito local (invitado) con el que venía guardado en la cuenta.
// Si el mismo producto está en ambos, se suman las cantidades sin pasarse
// del stock; si no, se conserva tal cual.
function mezclar(local, servidor) {
  const mapa = new Map()
  for (const item of servidor) mapa.set(item.producto_id, { ...item })
  for (const item of local) {
    const existente = mapa.get(item.producto_id)
    if (!existente) {
      mapa.set(item.producto_id, { ...item })
      continue
    }
    const tope = Math.min(existente.stock || Infinity, item.stock || Infinity)
    const suma = existente.cantidad + item.cantidad
    mapa.set(item.producto_id, { ...existente, cantidad: Math.min(suma, tope) || existente.cantidad })
  }
  return [...mapa.values()]
}

export function CartProvider({ children }) {
  const { usuario, cargando } = useAuth()
  const [items, setItems] = useState(leerStorage)
  // Solo permitimos subir el carrito al servidor después de fusionarlo con
  // el guardado en la cuenta; evita pisar lo que haya del otro lado.
  const [sincronizado, setSincronizado] = useState(false)

  useEffect(() => {
    localStorage.setItem(CLAVE, JSON.stringify(items))
  }, [items])

  // Al resolver la sesión: si hay usuario, traemos su carrito y lo fusionamos
  // con el local. Sin usuario, el carrito local queda como está.
  useEffect(() => {
    if (cargando) return undefined
    if (!usuario) {
      setSincronizado(true)
      return undefined
    }
    let cancelado = false
    setSincronizado(false)
    api('/carrito')
      .then((data) => {
        if (cancelado) return
        const servidor = Array.isArray(data.items) ? data.items : []
        setItems((actuales) => mezclar(actuales, servidor))
      })
      .catch(() => {
        // Sin conexión seguimos con el carrito local.
      })
      .finally(() => {
        if (!cancelado) setSincronizado(true)
      })
    return () => {
      cancelado = true
    }
  }, [cargando, usuario])

  // Cada cambio del carrito se guarda en la cuenta (con debounce para no
  // disparar un PUT por cada tecla del selector de cantidad).
  const refTimer = useRef(0)
  useEffect(() => {
    if (!usuario || !sincronizado) return undefined
    clearTimeout(refTimer.current)
    refTimer.current = setTimeout(() => {
      api('/carrito', { method: 'PUT', body: { items } }).catch(() => {})
    }, 600)
    return () => clearTimeout(refTimer.current)
  }, [items, usuario, sincronizado])

  // Sin efectos dentro del updater: calcula desde el estado actual.
  // Los eventos no son reentrantes en este flujo, así que el valor
  // devuelto es fiable (llamar dos veces en el mismo tick no duplica).
  const agregar = (producto, cantidad = 1) => {
    const existente = items.find((i) => i.producto_id === producto.id)
    const tope = producto.stock ?? existente?.stock ?? 0

    if (existente) {
      const nueva = Math.min(existente.cantidad + cantidad, tope)
      if (nueva === existente.cantidad) return false
      setItems(items.map((i) => (i.producto_id === producto.id ? { ...i, cantidad: nueva } : i)))
      return true
    }

    const aAgregar = Math.min(cantidad, tope)
    if (aAgregar <= 0) return false
    setItems([
      ...items,
      {
        producto_id: producto.id,
        nombre: producto.nombre,
        precio: Number(producto.precio),
        imagen: producto.imagen || '',
        categoria: producto.categoria,
        stock: producto.stock ?? 0,
        cantidad: aAgregar
      }
    ])
    return true
  }

  const cambiarCantidad = (productoId, cantidad) => {
    setItems((actuales) =>
      actuales.flatMap((i) => {
        if (i.producto_id !== productoId) return [i]
        if (cantidad <= 0) return []
        return [{ ...i, cantidad: Math.min(cantidad, i.stock || cantidad) }]
      })
    )
  }

  const quitar = (productoId) => {
    setItems((actuales) => actuales.filter((i) => i.producto_id !== productoId))
  }

  const vaciar = () => setItems([])

  const totales = useMemo(() => {
    const subtotal = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0)
    const porcentaje = usuario?.descuento?.activo ? usuario.descuento.porcentaje : 0
    const descuento = (subtotal * porcentaje) / 100
    return {
      subtotal,
      porcentaje,
      descuento,
      total: subtotal - descuento,
      unidades: items.reduce((acc, i) => acc + i.cantidad, 0)
    }
  }, [items, usuario])

  return (
    <CartContext.Provider value={{ items, agregar, cambiarCantidad, quitar, vaciar, totales }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
