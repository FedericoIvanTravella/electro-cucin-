import { db } from './db.js'

// Nero: asistente basado en reglas. Solo responde con datos que viven en la
// tienda (catálogo, cupones, políticas de envío/devolución y pedidos propios).
// Nunca inventa precios, stock ni estados: si no lo sabe, deriva a WhatsApp.

export const WHATSAPP_BASE = 'https://wa.me/5490800123456'

const MONEDA = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0
})

const SUGERENCIAS = [
  '¿Qué freidoras tenés?',
  '¿Cuánto cuesta el envío?',
  '¿Cómo hago una devolución?'
]

export function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function linkWhatsapp(texto = '') {
  const mensaje = texto
    ? `Hola, vengo de Electro Cuciné. Necesito ayuda con: ${texto}`
    : 'Hola, vengo de Electro Cuciné. Quiero consultar por un producto.'
  return `${WHATSAPP_BASE}?text=${encodeURIComponent(mensaje)}`
}

const INTENCIONES = [
  { nombre: 'humano', peso: 10, patrones: [/\b(human|persona|agente|operador|llamar|telefono|whatsapp|wpp|hablar con)/] },
  { nombre: 'dano', peso: 9, patrones: [/\b(roto|rota|danad|damad|golpead|no funciona|falla|fallo|defectuos|equivocad|faltante|accesorio|llego mal|mal estado)/] },
  { nombre: 'devolucion', peso: 7, patrones: [/\b(devoluc|cambio|cambiar|arrepentim|reembolso|reclamo|garantia|service|reparac)/] },
  { nombre: 'pedido', peso: 8, patrones: [/\b(mi pedido|mis pedidos|mi compra|mis compras|mi orden|estado de mi|seguimiento|tracking|donde esta|cuando llega|cuando me llega|numero de pedido|ticket|factura)/] },
  { nombre: 'envio', peso: 6, patrones: [/\b(envio|envios|flete|porte|reparto|demora|entrega|domicilio)/] },
  { nombre: 'descuento', peso: 6, patrones: [/\b(descuento|65 an|mayores de 65|jubilad|beneficio|porcentaje)/] },
  { nombre: 'cupon', peso: 7, patrones: [/\b(cupon|navidad25|cocina10|cucine5|codigo de descuento)/] },
  { nombre: 'pago', peso: 5, patrones: [/\b(cuotas|pagar|pago|tarjeta|mercado pago|efectivo|transferencia|naranja)/] },
  {
    nombre: 'producto',
    peso: 4,
    patrones: [
      /\b(producto|productos|articulo|electrodomestico|freidor|licuador|cafeter|pava|horno|anafe|batidor|tostador|procesador|placa|induccion|busc|tenes|hay stock|stock|disponib|precio|cuesta|vale|recomiend|vendid|populares|barato|economico)/
    ]
  },
  { nombre: 'categoria', peso: 5, patrones: [/\b(coccion|cocina|preparacion|cafeteria|limpieza)/] },
  { nombre: 'saludo', peso: 2, patrones: [/\b(hola|buenas|buen dia|buenos dias|gracias|adios|hey)/] }
]

export function detectarIntencion(mensaje) {
  const texto = normalizar(mensaje)
  let elegida = { nombre: 'desconocida', puntos: 0 }
  for (const intento of INTENCIONES) {
    const puntos = intento.patrones.filter((patron) => patron.test(texto)).length * intento.peso
    if (puntos > elegida.puntos) elegida = { nombre: intento.nombre, puntos }
  }
  return elegida.nombre
}

const VACIAS = new Set(
  `hola buenas buen dia buenos dias por favor quiero necesito buscar busco buscame tenes tiene hay
   cuanto cuesta precio precios productos producto articulos articulo electrodomesticos los las el la
   un una de del para con en y o que como sobre alguno alguna algo ver mostrar denme saber consulta
   duda info informacion mi mis stock disponible disponibilidad barato barata economicos economicas
   recomendame recomienda mas mucho muy todos todas solo puede pueden`
    .split(/\s+/)
    .filter(Boolean)
)

const CATEGORIAS = {
  cocina: 'Cocción',
  coccion: 'Cocción',
  preparacion: 'Preparación',
  cafeteria: 'Cafetería',
  cafe: 'Cafetería',
  limpieza: 'Limpieza'
}

function raiz(token) {
  return token.replace(/(?:es|s)$/, '')
}

function coincide(texto, token) {
  if (token.length < 3) return false
  return texto.includes(token) || texto.includes(raiz(token))
}

function tokensDe(texto) {
  return texto
    .split(' ')
    .filter((token) => token.length >= 3 && !VACIAS.has(token))
    .map(raiz)
    .filter((token) => token.length >= 3)
}

function presupuestoDe(texto) {
  let valor = 0
  for (const coincidencia of texto.matchAll(/(\d+(?:\.\d{3})*)\s*(mil|k)?/g)) {
    const numero = Number(coincidencia[1].replace(/\./g, ''))
    const total = coincidencia[2] ? numero * 1000 : numero
    if (total >= 1000) valor = Math.max(valor, total)
  }
  if (!valor) return null
  const arriba = /\b(mas|arriba|caros?|mayor)\b/.test(texto) && !/\b(menos|abajo|hasta|barato|economico)\b/.test(texto)
  return { valor, arriba }
}

function categoriaDe(texto) {
  for (const [clave, categoria] of Object.entries(CATEGORIAS)) {
    if (texto.includes(clave)) return categoria
  }
  return null
}

function buscarProductos(mensaje, limite = 3) {
  const texto = normalizar(mensaje)
  const tokens = tokensDe(texto)
  const categoria = categoriaDe(texto)
  const presupuesto = presupuestoDe(texto)
  const filas = db
    .prepare('SELECT id, nombre, precio, stock, imagen, categoria, subcategoria, descripcion FROM productos WHERE activo = 1')
    .all()

  const resultados = []
  for (const producto of filas) {
    const nombre = normalizar(producto.nombre)
    const descripcion = normalizar(producto.descripcion)
    const subcategoria = normalizar(producto.subcategoria)
    const categoriaProducto = normalizar(producto.categoria)
    let puntos = 0
    for (const token of tokens) {
      if (coincide(nombre, token)) puntos += 5
      if (coincide(subcategoria, token)) puntos += 3
      if (coincide(categoriaProducto, token)) puntos += 2
      if (coincide(descripcion, token)) puntos += 1
    }
    if (categoria && producto.categoria === categoria) puntos += 4
    if (puntos === 0) continue
    if (presupuesto) {
      if (presupuesto.arriba && Number(producto.precio) < presupuesto.valor) continue
      if (!presupuesto.arriba && Number(producto.precio) > presupuesto.valor) continue
    }
    resultados.push({ producto, puntos })
  }

  resultados.sort((a, b) => b.puntos - a.puntos || Number(a.producto.precio) - Number(b.producto.precio))
  return resultados.slice(0, limite).map(({ producto }) => ({
    id: Number(producto.id),
    nombre: producto.nombre,
    precio: Number(producto.precio),
    stock: Number(producto.stock),
    imagen: producto.imagen || '',
    url: `/producto/${producto.id}`
  }))
}

function respuesta({ texto, tipo, productos = [], enlaces = [], sugerencias = SUGERENCIAS, humano = false }) {
  return { respuesta: texto, tipo, productos, enlaces, sugerencias, humano }
}

function respuestaPedido(mensaje, usuario) {
  if (!usuario) {
    return respuesta({
      texto: 'Si iniciás sesión puedo consultar el estado de tus compras con tu número de pedido.',
      tipo: 'pedido',
      enlaces: [{ etiqueta: 'Ingresar a mi cuenta', to: '/login' }]
    })
  }

  const texto = normalizar(mensaje)
  const numero = texto.match(/(?:pedido|orden|ticket)\s*(?:n[°o]?\s*)?#?(\d+)/)?.[1]
  const ventas = numero
    ? db
        .prepare('SELECT id, fecha, total, estado FROM ventas WHERE usuario_id = ? AND id = ? ORDER BY id DESC LIMIT 1')
        .all(usuario.id, numero)
    : db
        .prepare('SELECT id, fecha, total, estado FROM ventas WHERE usuario_id = ? ORDER BY fecha DESC, id DESC LIMIT 5')
        .all(usuario.id)

  if (!ventas.length) {
    return respuesta({
      texto: numero
        ? `No encontré el pedido #${numero} en tu cuenta. Revisá el número en "Mis compras".`
        : 'Todavía no hay compras registradas en tu cuenta. Cuando hagas una, vas a poder ver el estado acá.',
      tipo: 'pedido',
      enlaces: [{ etiqueta: 'Ver mis compras', to: '/mis-compras' }]
    })
  }

  const estados = { completada: 'Confirmada', en_camino: 'En camino', entregado: 'Entregada', anulada: 'Anulada' }
  const lineas = ventas.map(
    (venta) => `Pedido #${venta.id} · ${estados[venta.estado] || venta.estado} · ${MONEDA.format(venta.total)}`
  )
  const textoRespuesta =
    `Estos son tus pedidos más recientes:\n${lineas.join('\n')}\n\n` +
    'Los entregamos en 24–48 h hábiles en CABA y GBA, y hasta 5 días hábiles en el interior. Decime el número de pedido si querés ver uno en particular.'

  return respuesta({
    texto: textoRespuesta,
    tipo: 'pedido',
    enlaces: [{ etiqueta: 'Ver mis compras', to: '/mis-compras' }]
  })
}

function respuestaCupon() {
  const cupones = db
    .prepare('SELECT codigo, tipo, valor, usado, usos_max FROM cupones WHERE activo = 1 ORDER BY codigo')
    .all()
    .filter((cupon) => !cupon.usado && (cupon.usos_max === null || cupon.usos_max > cupon.usado))

  if (!cupones.length) {
    return respuesta({
      texto: 'En este momento no hay cupones activos. Mirá las promociones de la barra superior.',
      tipo: 'cupon'
    })
  }

  const lineas = cupones.map((cupon) => {
    const beneficio = cupon.tipo === 'porcentaje' ? `${cupon.valor}% de descuento` : `${MONEDA.format(cupon.valor)} de descuento`
    return `${cupon.codigo}: ${beneficio}`
  })

  return respuesta({
    texto: `Los cupones disponibles son:\n${lineas.join('\n')}\nIngresalos en el checkout, antes de confirmar la compra.`,
    tipo: 'cupon',
    enlaces: [{ etiqueta: 'Ir al carrito', to: '/carrito' }]
  })
}

export function responderChat(mensaje, usuario = null) {
  const intencion = detectarIntencion(mensaje)

  switch (intencion) {
    case 'humano':
      return respuesta({
        texto: '¡Claro! Para una respuesta más completa, escribinos por WhatsApp y contanos qué necesitás. Te atendemos de lunes a sábados de 9 a 20 h.',
        tipo: 'humano',
        enlaces: [{ etiqueta: 'Hablar por WhatsApp', to: linkWhatsapp(mensaje), externo: true }],
        humano: true
      })

    case 'dano':
      return respuesta({
        texto: 'Si el producto llegó dañado o le falta una pieza, conservá el embalaje, sacá fotos y escribinos dentro de los 7 días con el número de pedido. Te lo cambiamos sin costo o te devolvemos el dinero.',
        tipo: 'dano',
        enlaces: [{ etiqueta: 'Ver ayuda y contacto', to: '/ayuda' }],
        humano: true
      })

    case 'devolucion':
      return respuesta({
        texto: 'Tenés 30 días desde la entrega para cambios y devoluciones, con el producto en su caja original. Además, todos los electrodomésticos tienen 2 años de garantía oficial con service autorizado en todo el país. Necesitamos tu número de pedido para empezar.',
        tipo: 'devolucion',
        enlaces: [
          { etiqueta: 'Ver devoluciones', to: '/devoluciones' },
          { etiqueta: 'Centro de ayuda', to: '/ayuda' }
        ]
      })

    case 'pedido':
      return respuestaPedido(mensaje, usuario)

    case 'envio':
      return respuesta({
        texto: 'El envío es sin cargo en compras superiores a $150.000, a todo el país. Por debajo de ese monto calculamos el costo según tu código postal. La entrega estimada es de 24–48 h hábiles en CABA y GBA, y hasta 5 días hábiles en el interior.',
        tipo: 'envio',
        enlaces: [{ etiqueta: 'Ver mi carrito', to: '/carrito' }]
      })

    case 'descuento':
      return respuesta({
        texto: 'Si tenés 65 años o más, registrá tu fecha de nacimiento y al iniciar sesión aplicamos automáticamente un 30% de descuento en todo el carrito. También podés usar los cupones vigentes en el checkout.',
        tipo: 'descuento',
        enlaces: [{ etiqueta: 'Ver cupones', to: '/carrito' }]
      })

    case 'cupon':
      return respuestaCupon()

    case 'pago':
      return respuesta({
        texto: 'Podés pagar con tarjeta de crédito o débito, transferencia, efectivo y MercadoPago. Elegí entre 1, 3, 6 y 12 cuotas al confirmar la compra.',
        tipo: 'pago',
        enlaces: [{ etiqueta: 'Ver medios de pago', to: '/ayuda' }]
      })

    case 'categoria':
    case 'producto': {
      const productos = buscarProductos(mensaje)
      if (!productos.length) {
        return respuesta({
          texto: 'No encontré ese producto en el catálogo. Si me decís qué estás buscando lo intento de nuevo, o te paso a una persona por WhatsApp.',
          tipo: 'producto',
          enlaces: [{ etiqueta: 'Ver todo el catálogo', to: '/productos' }],
          humano: true
        })
      }
      return respuesta({
        texto: `Encontré ${productos.length === 1 ? 'esta opción' : `${productos.length} opciones`} en el catálogo:`,
        tipo: 'producto',
        productos,
        enlaces: [{ etiqueta: 'Ver todo el catálogo', to: '/productos' }],
        sugerencias: ['¿Cuánto cuesta el envío?', '¿Cómo hago una devolución?']
      })
    }

    case 'saludo':
      return respuesta({
        texto: '¡Hola! Soy Nero, el asistente de Electro Cuciné. Puedo ayudarte con productos, precios, envíos, devoluciones y el estado de tus pedidos. ¿Qué necesitás?',
        tipo: 'saludo'
      })

    default:
      return respuesta({
        texto: 'Solo puedo responder preguntas sobre la tienda: productos, precios, envíos, devoluciones, cupones y tus pedidos. Si necesitás otra cosa, te paso a una persona por WhatsApp.',
        tipo: 'desconocida',
        enlaces: [{ etiqueta: 'Hablar por WhatsApp', to: linkWhatsapp(mensaje), externo: true }],
        humano: true
      })
  }
}
