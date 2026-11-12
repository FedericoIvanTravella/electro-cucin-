/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'

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

export function CartProvider({ children }) {
  const { usuario } = useAuth()
  const [items, setItems] = useState(leerStorage)

  useEffect(() => {
    localStorage.setItem(CLAVE, JSON.stringify(items))
  }, [items])

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
