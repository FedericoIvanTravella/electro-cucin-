import TazaMascota from './TazaMascota'

// Estado "vacío" o informativo con la mascota acompañando al usuario.
// El prop "codigo" es opcional: si se pasa, la taza muestra ese número.
export default function EstadoVacio({ titulo, mensaje, codigo, size = 170, children }) {
  return (
    <div className="vacio vacio--mascota card">
      <TazaMascota codigo={codigo} size={size} />
      <h1>{titulo}</h1>
      {mensaje && <p>{mensaje}</p>}
      {children && <div className="pagina-error__acciones">{children}</div>}
    </div>
  )
}
