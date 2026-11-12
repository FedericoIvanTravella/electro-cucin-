// Animación decorativa de envío: un camión recorre una ruta punteada
// desde el depósito (caja) hasta la casa del comprador.
// Se muestra en "Mis compras" y al confirmar un pago.
export default function RutaEntrega({ compacto = false }) {
  return (
    <div
      className={`ruta-entrega ${compacto ? 'ruta-entrega--compacto' : ''}`}
      role="img"
      aria-label="Tu pedido está en período de entrega, en camino a tu domicilio"
    >
      <div className="ruta-entrega__franja">
        <span className="ruta-entrega__punto ruta-entrega__punto--origen" title="Depósito Electro Cuciné">
          <i className="fi fi-rr-box-check" aria-hidden="true" />
        </span>
        <div className="ruta-entrega__carretera">
          <span className="ruta-entrega__asfalto" aria-hidden="true" />
          <span className="ruta-entrega__camion" aria-hidden="true">
            <i className="fi fi-rr-truck-moving" />
          </span>
        </div>
        <span className="ruta-entrega__punto ruta-entrega__punto--destino" title="Tu domicilio">
          <i className="fi fi-rr-home" aria-hidden="true" />
        </span>
      </div>
      <p className="ruta-entrega__texto">
        <span className="ruta-entrega__pulso" aria-hidden="true" />
        En período de entrega · estimado 24–48 h hábiles
      </p>
    </div>
  )
}
