// Esqueleto de carga con la misma forma que una tarjeta de producto.
export function SkeletonProducto() {
  return (
    <div className="producto skeleton-card" aria-hidden="true">
      <div className="skeleton skeleton--media" />
      <div className="producto__cuerpo">
        <div className="skeleton skeleton--linea skeleton--60" />
        <div className="skeleton skeleton--linea skeleton--90" />
        <div className="skeleton skeleton--linea skeleton--40" />
        <div className="skeleton skeleton--boton" />
      </div>
    </div>
  )
}

// Grilla de esqueletos para listados.
export function GrillaSkeleton({ cantidad = 8 }) {
  return (
    <div className="grilla-productos">
      {Array.from({ length: cantidad }, (_, i) => (
        <SkeletonProducto key={i} />
      ))}
    </div>
  )
}
