import { useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'

const RUTAS = {
  terminos: {
    titulo: 'Términos y Condiciones de Uso',
    actualizado: '12 de noviembre de 2026',
    contenido: [
      {
        h: '1. Objeto',
        p: 'Electro Cuciné (en adelante "el Vendedor") comercializa electrodomésticos de cocina a través de la plataforma /electro-cucine.com.ar a consumidores finales en el territorio de la República Argentina. El presente documento rige las condiciones de uso del sitio y las operaciones de compraventa que se realizan a través de él.'
      },
      {
        h: '2. Partes',
        p: 'Vendedor: Electro Cuciné S.R.L., con domicilio en Av. Siempreviva 742, C1066 CABA, CUIT 30-71234567-8. Correo: ayuda@electrocucine.com. Teléfono: 0800-123-4567. Lunes a sábados, de 9 a 20 h. Comprador: toda persona que registre una cuenta y realice una compra a través del sitio.'
      },
      {
        h: '3. Cuenta y responsabilidad',
        p: 'Para comprar es necesario registrarse y verificar el correo. El comprador es responsable de mantener confidencial la contraseña y de cualquier compra realizada desde su cuenta. Se pueden cerrar todas las sesiones desde el panel "Cerrar todo". Ante cualquier operación desconocida se debe contactar de inmediato con el Vendedor.'
      },
      {
        h: '4. Precios y disponibilidad',
        p: 'Los precios publicados incluyen IVA. El Vendedor se reserva el derecho de corregir errores tipográficos o de precio antes del envío de la confirmación. El stock informado es referencial; si hay falta de stock se comunicará al comprador dentro de las 48 h hábiles con la opción de cancelar y reintegrar el importe dentro de los 10 días corridos.'
      },
      {
        h: '5. Compra y facturación',
        p: 'Al confirmar el pago se emite comprobante de venta digital. El comprador recibe correo de confirmación con el detalle del pedido. Ante cualquier discrepancia entre lo comprado y lo facturado, el comprador puede reclamar dentro de los 15 días corridos siguientes al envío.'
      },
      {
        h: '6. Entrega',
        p: 'El envío es sin cargo para compras superiores a $150.000. Debajo de ese monto se calcula el costo según el código postal. Entrega estimada: 24–48 h hábiles para CABA y GBA; hasta 5 días hábiles para el interior del país. El comprador puede hacer el seguimiento desde su panel "Mis compras".'
      },
      {
        h: '7. Garantía',
        p: 'Todos los productos cuentan con 2 años de garantía oficial con servicio técnico autorizado en todo el país. La garantía no cubre mal uso, conexiones eléctricas defectuosas, golpes ni daño causado por terceros. Para hacer válida la garantía es necesario contar con el comprobante de compra.'
      },
      {
        h: '8. Arrepentimiento y devoluciones',
        p: 'El comprador tiene derecho a retractarse de la compra dentro de los 10 (diez) días corridos desde la recepción sin necesidad de justificar la causa (art. 34 Ley 24.240 y cc.). El producto debe estar sin uso, en su embalaje original y con todos los accesorios. El costo de envío de la devolución es a cargo del Vendedor. El reintegro del importe se realiza dentro de los 10 días hábiles siguientes a la recepción del producto.'
      },
      {
        h: '9. Propiedad intelectual',
        p: 'Las marcas, logotipos, textos y elementos del sitio son propiedad de Electro Cuciné S.R.L. y/o de sus licenciantes. No se permite su uso comercial ni su reproducción sin autorización escrita.'
      },
      {
        h: '10. Modificaciones',
        p: 'El Vendedor se reserva el derecho de modificar estos Términos en cualquier momento. Los cambios rigen desde la publicación de la nueva versión. Las compras confirmadas con anterioridad a la modificación se rigen por los Términos vigentes al momento de la compra.'
      },
      {
        h: '11. Ley aplicable y jurisdicción',
        p: 'Los presentes Términos se rigen por las leyes de la República Argentina. Cualquier controversia se someterá a los tribunales ordinarios con competencia en la Ciudad Autónoma de Buenos Aires, sin perjuicio del derecho del consumidor de acudir ante las instancias administrativas (COPREC) y la posibilidad de mediación prevista por la Ley 24.240.'
      }
    ]
  },

  privacidad: {
    titulo: 'Política de Privacidad y Protección de Datos',
    actualizado: '12 de noviembre de 2026',
    contenido: [
      {
        h: '1. Responsable del tratamiento',
        p: 'Electro Cuciné S.R.L. (Av. Siempreviva 742, C1066 CABA, CUIT 30-71234567-8) es el responsable del tratamiento de los datos personales que el usuario proporciona al utilizar nuestros servicios. Base de datos inscripta ante la Agencia de Acceso a la Información Pública (AAIP) bajo los lineamientos de la Ley 25.326 y su reglamentación.'
      },
      {
        h: '2. Datos que recolectamos',
        p: 'Al registrarte: nombre y apellido, correo, fecha de nacimiento (para descuento 65+) y, opcionalmente, correo de contacto. Al comprar: dirección de envío, datos de pago (la tarjeta nunca se almacena en nuestros servidores; la operación se procesa con Mercado Pago / tarjetas bajo PCI DSS). Datos de navegación: cookies propias y de herramientas analíticas (ver sección 6).'
      },
      {
        h: '3. Finalidad y legitimación',
        p: 'Los datos se utilizan exclusivamente para: (a) procesar y entregar los pedidos, (b) emitir comprobantes, (c) brindar atención al cliente, (d) aplicar el descuento 65+, (e) notificar el estado del pedido (cuando pedís aviso), (f) mejorar la experiencia de la tienda (analítica agregada, sin perfilamiento individual). La base de legitimación es la ejecución del contrato de compraventa y tu consentimiento para las comunicaciones opcionales.'
      },
      {
        h: '4. Conservación',
        p: 'Los datos asociados a una compra se conservan mientras exista relación contractual y durante los plazos legales exigidos para conservación fiscal y contable (10 años). Los datos de cuenta se pueden suprimir a pedido del titular, salvo obligación legal contraria.'
      },
      {
        h: '5. Destinatarios',
        p: 'Los datos pueden comunicarse a: (a) empresas de logística para la entrega, (b) pasarelas de pago para procesar la operación, (c) la AAIP y la AFIP cuando la ley lo exija, (d) proveedores de alojamiento de la plataforma. Todos están obligados contractualmente a un nivel de protección adecuado y no pueden usarlos para otros fines.'
      },
      {
        h: '6. Cookies y tecnologías',
        p: 'Utilizamos cookies propias para mantener la sesión y el carrito, y cookies de analítica (agregada y anonimizada) para entender cómo usás el sitio. Podés desactivar las cookies desde tu navegador, pero algunas funciones pueden dejar de operar correctamente.'
      },
      {
        h: '7. Tus derechos',
        p: 'Tenés derecho a acceder, rectificar, actualizar, suprimir y conocer el uso de tus datos. Para ejercerlos escribinos a ayuda@electrocucine.com indicando tu nombre, correo y la solicitud. Respondemos dentro de los 10 días corridos. Podés presentar tu reclamo también ante el Órgano de Acceso a la Información Pública (Av. de Mayo 525, piso 8, CABA; www.argentina.gob.ar/aaip).'
      },
      {
        h: '8. Seguridad',
        p: 'Aplicamos medidas técnicas y organizativas razonables: cifrado de contraseñas (bcrypt), sesiones con tokens hasheados, conexión cifrada (HTTPS/TLS), acceso restringido por roles y auditorías internas. Aun así, ningún sistema conectado es 100% seguro: te recomendamos usar contraseñas distintas del resto de tus sitios.'
      },
      {
        h: '9. Menores de edad',
        p: 'El sitio está dirigido a personas mayores de 18 años. No recolectamos datos de menores con conocimiento. Si sos padre/madre o tutor y advertís que un menor registró datos, contactanos para su supresión inmediata.'
      },
      {
        h: '10. Modificaciones',
        p: 'Esta política puede actualizarse. Los cambios relevantes se comunicarán en el sitio. La versión vigente siempre estará disponible en esta sección.'
      }
    ]
  },

  devoluciones: {
    titulo: 'Cambios y Devoluciones',
    actualizado: '12 de noviembre de 2026',
    contenido: [
      {
        h: '1. Tus derechos como consumidor',
        p: 'Conforme a la Ley 24.240 (Defensa del Consumidor) y el Código Civil y Comercial de la Nación, tenés derecho a arrepentirte de tu compra dentro de los 10 (diez) días corridos desde la recepción, sin necesidad de justificar la causa ni pagar penalidad. También tenés derecho a reclamar por falta de conformidad de los bienes con las condiciones pactadas y por vicios o defectos ocultos.'
      },
      {
        h: '2. Cómo retractarte (10 días)',
        p: 'Para ejercer el derecho de arrepentimiento: (1) dejanos tu notificación por escrito (correo a ayuda@electrocucine.com o baja de la compra desde tu cuenta indicando "quiero retractar la compra #N"), (2) devolvé el producto sin uso, con todos los accesorios, cables, manuales y embalaje original, (3) adjuntá el número de pedido. El costo del envío de vuelta lo cubre el Vendedor. Una vez recibido y verificado el producto, el reintegro del dinero se realiza dentro de los 10 días hábiles siguientes por el mismo medio de pago utilizado.'
      },
      {
        h: '3. Cambio por falla',
        p: 'Si el producto presenta alguna falla en los primeros 2 años, comunicate con el Vendedor dentro de ese plazo. Según corresponda: (a) se repara el producto, (b) se reemplaza por otro igual o de similares características, o (c) se reintegra el dinero. Si la falla es irreparable o el cambio se reitera, tenés derecho a exigir el reembolso inmediato.'
      },
      {
        h: '4. Producto dañado o incompleto al recibir',
        p: 'Revisá el paquete antes de firmar la recepción. Si al abrirlo constatás algún faltante o daño, comunicalo dentro de los 7 días hábiles vía ayuda@electrocucine.com adjuntando fotos del producto y el embalaje y el número de pedido. Si el envío lo hace el Vendedor, el costo de cambio o devolución es a nuestro cargo.'
      },
      {
        h: '5. Exclusiones',
        p: 'La garantía y el derecho de arrepentimiento no cubren: (a) productos usados, (b) daños por mal uso, golpes o instalaciones defectuosas, (c) consumibles (manuales, baterías incluidas si no vienen integradas, etc.), (d) productos abiertos y/o con accesorios faltantes que impidan su reventa como nuevos.'
      },
      {
        h: '6. Fricciones comunes (FAQ)',
        p: '• "¿Tengo que devolver el producto en su caja original?" Sí, para que podamos procesar el reintegro. • "¿Cuánto tarda el reintegro?" Entre 5 y 10 días hábiles tras la recepción. • "¿Me puedo arrepentir aunque la compra haya sido en oferta?" Sí, el derecho de arrepentimiento aplica a cualquier compra. • "¿Cómo hago el reclamo administrativo?" También podés acudir a COPREC (Calle 25 de Mayo 653, Piso 2, CABA, www.coprec.gob.ar).'
      },
      {
        h: '7. ¿Dónde hago el reclamo?',
        p: 'Electro Cuciné S.R.L., Av. Siempreviva 742, C1066 CABA. Correo: ayuda@electrocucine.com. Teléfono (0800) 123-4567, lunes a sábados de 9 a 20 h. Adicionalmente, podés acudir a las autoridades de defensa del consumidor (nacional, provincial o municipal) y al COPREC.'
      }
    ]
  }
}

export default function Legal() {
  const location = useLocation()
  const slug = location.pathname.replace('/', '').split('/')[0]
  const seccion = RUTAS[slug]

  if (!seccion) {
    return (
      <div className="card" style={{ maxWidth: 720, margin: '2rem auto' }}>
        <h1>Página no encontrada</h1>
        <p>Esta sección no existe.</p>
        <Link to="/" className="boton boton--primario">Volver al inicio</Link>
      </div>
    )
  }

  return (
    <article className="legal">
      <header className="legal__cabecera">
        <h1 className="legal__titulo">{seccion.titulo}</h1>
        <p className="legal__actualizado">Última actualización: {seccion.actualizado}</p>
      </header>
      {seccion.contenido.map((sec, i) => (
        <section key={i} className="card legal__seccion">
          <h2>{sec.h}</h2>
          <p>{sec.p}</p>
        </section>
      ))}
      <footer className="legal__pie">
        <Link to="/" className="boton boton--fantasma">Volver al inicio</Link>
        <Link to="/ayuda" className="boton boton--fantasma">Contacto y ayuda</Link>
      </footer>
    </article>
  )
}
