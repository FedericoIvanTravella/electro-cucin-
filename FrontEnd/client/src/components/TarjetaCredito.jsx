// Tarjeta de crédito visual que se completa en vivo con lo que escribe
// el usuario. Muestra el logo de la empresa en la esquina superior.
export default function TarjetaCredito({ numero, titular, vencimiento, cvv }) {
  // Toma solo los dígitos y completa con "•" hasta 16, agrupando de a 4.
  const digitos = String(numero || '').replace(/\D/g, '').slice(0, 16)
  const grupos = []
  for (let i = 0; i < 16; i += 4) {
    grupos.push(digitos.slice(i, i + 4).padEnd(4, '•'))
  }

  return (
    <div className="tarjeta-visual" aria-hidden="true">
      <div className="tarjeta-visual__brillo" />
      <div className="tarjeta-visual__cabecera">
        <span className="tarjeta-visual__chip">
          <span />
        </span>
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="tarjeta-visual__logo" />
      </div>

      <p className="tarjeta-visual__numero">{grupos.join(' ')}</p>

      <div className="tarjeta-visual__pie">
        <div className="tarjeta-visual__campo">
          <span className="tarjeta-visual__etiqueta">Titular</span>
          <strong>{titular ? titular.toUpperCase() : 'NOMBRE Y APELLIDO'}</strong>
        </div>
        <div className="tarjeta-visual__campo">
          <span className="tarjeta-visual__etiqueta">Vence</span>
          <strong>{vencimiento || 'MM/AA'}</strong>
        </div>
        <div className="tarjeta-visual__campo tarjeta-visual__campo--cvv">
          <span className="tarjeta-visual__etiqueta">CVV</span>
          <strong>{cvv || '•••'}</strong>
        </div>
      </div>
    </div>
  )
}