// Contenido editorial del blog de Electro Cuciné.
// Es estático a propósito: no necesita API, se sirve rápido y el Google
// Bot puede leerlo tal cual (React Router lo resuelve en el cliente,
// así que cada artículo además actualiza el <title> y las meta tags).

export const ARTICULOS = [
  {
    slug: 'elegir-freidora-de-aire',
    titulo: 'Cómo elegir tu freidora de aire sin equivocarte',
    bajada: 'Capacidad, potencia y programas: las tres claves que realmente importan antes de comprar.',
    fecha: '2026-10-12',
    fechaTexto: '12 de octubre de 2026',
    categoria: 'Guías de compra',
    lectura: '5 min',
    autor: 'Equipo Electro Cuciné',
    cuerpo: [
      { tipo: 'parrafo', texto: 'La freidora de aire dejó de ser un gadget para convertirse en uno de los electrodomésticos que más se usan día a día. Pero no todas sirven para lo mismo: elegir por precio o por marca sola suele terminar en una máquina que queda guardada en el placard. Estos son los tres puntos que conviene mirar antes de decidir.' },
      { tipo: 'h2', texto: '1. La capacidad depende de cuántas personas cocinés' },
      { tipo: 'parrafo', texto: 'Para uno o dos convive alcanza con 3,5 a 4 litros. Si cocinás para cuatro o más, apuntá a 5,5 litros o superior: la diferencia no es solo "más comida", sino que el aire tiene que circular entre las piezas. Llenar una freidora chica hasta el tope es la receta para que todo quede parejo por fuera y crudo por dentro.' },
      { tipo: 'h2', texto: '2. Potencia: más vatios, menos espera' },
      { tipo: 'parrafo', texto: 'Entre 1400 y 1700 W es el rango habitual. Más potencia significa que la cámara recupera temperatura rápido cada vez que abris la canasta, lo que se traduce en dorados más uniformes y tiempos de cocción menores. Si vas a usarla a diario, la diferencia se nota desde el primer uso.' },
      { tipo: 'h2', texto: '3. Programas y limpieza' },
      { tipo: 'parrafo', texto: 'Los programas predefinidos (papas, pollo, pescado, deshidratar) son cómodos pero no decisivos: cualquier freidora decente permite manejar tiempo y temperatura a mano. Lo que sí importa es el revestimiento antiadherente de la canasta y si es apta para lavavajillas. Una canasta que cuesta limpiar es una canasta que termina sin usarse.' },
      { tipo: 'parrafo', texto: 'En nuestra tienda podés filtrar por capacidad y precio en la categoría Preparación, y leer lo que opinaron compradores reales en cada ficha.' }
    ]
  },
  {
    slug: 'cafetera-italiana-o-prensa-francesa',
    titulo: 'Cafetera italiana o prensa francesa: ¿cuál te conviene?',
    bajada: 'Dos formas distintas de preparar el mismo café. Una es más rápida, la otra es más indulgente.',
    fecha: '2026-09-28',
    fechaTexto: '28 de septiembre de 2026',
    categoria: 'Guías de compra',
    lectura: '4 min',
    autor: 'Equipo Electro Cuciné',
    cuerpo: [
      { tipo: 'parrafo', texto: 'Si tomás café todos los días, la diferencia entre una buena y una mala preparación se nota más que entre una marca y otra. Estos dos métodos tienen lógicas opuestas y elegir bien depende de cómo seas vos por la mañana.' },
      { tipo: 'h2', texto: 'Cafetera italiana (moka): intensidad en pocos minutos' },
      { tipo: 'parrafo', texto: 'La moka funciona con vapor y presión: en cinco minutos tenés una taza concentrada, con cuerpo, parecida a un espresso corto. Es ideal si querés café fuerte para arrancar el día, si tenés poco tiempo o si no te gusta esperar. Requiere molido medio fino y un fuego moderado: dejarla mucho tiempo en el fuego quema el café.' },
      { tipo: 'h2', texto: 'Prensa francesa: cuerpo y paciencia' },
      { tipo: 'parrafo', texto: 'La prensa infusiona el café molido grueso durante cuatro minutos y después separa con el émbolo. El resultado es una taza más redonda y aceitosa, con más cuerpo y menos acidez. No hay filtro de papel, así que los aceites del grano quedan en la taza: para muchos es la mejor forma de tomar café; para otros, es pesada.' },
      { tipo: 'h2', texto: 'Entonces, ¿cuál?' },
      { tipo: 'parrafo', texto: 'Si buscás velocidad e intensidad, moka. Si disfrutás el ritual y un café más suave y texturizado, prensa. Y si querés el mejor de los dos mundos, una cafetera automática con molino integrado resuelve la ecuación, aunque pide una inversión mayor.' }
    ]
  },
  {
    slug: 'mantener-limpias-las-batidoras',
    titulo: 'El truco de las 30 segundos para que tus batidoras no se ensucien',
    bajada: 'Una costumbre durante el uso que ahorra 20 minutos de limpieza después.',
    fecha: '2026-09-10',
    fechaTexto: '10 de septiembre de 2026',
    categoria: 'Cuidados',
    lectura: '3 min',
    autor: 'Equipo Electro Cuciné',
    cuerpo: [
      { tipo: 'parrafo', texto: 'Toda batidora de mano se limpia mal por la misma razón: la masa se seca en las aspas mientras terminás de cocinar. La solución no es un producto especial, es costumbre.' },
      { tipo: 'h2', texto: 'Sumergila antes de que se seque' },
      { tipo: 'parrafo', texto: 'Terminás de batir, apagás, y en lugar de dejar la batidora sobre la mesada, meté las aspas en un vaso con agua tibia y una gota de detergente. Treinta segundos. Después pasás un cepillo de dientes viejo por las uniones y listo: la masa se desprende sola porque todavía no agarró.' },
      { tipo: 'h2', texto: 'Ojo con la base motriz' },
      { tipo: 'parrafo', texto: 'Nunca sumergas la parte donde está el motor, y no la laves bajo el chorro. Un paño húmedo alcanza. Y si tu batidora tiene las aspas desmontables, desarmalas: la humedad que queda adentro de la unión es lo que termina manchando con el tiempo.' },
      { tipo: 'parrafo', texto: 'Con dos semanas de constancia se vuelve automático, y la batidora dura el doble.' }
    ]
  },
  {
    slug: 'cuando-cambio-mi-electrodomestico',
    titulo: 'Señales de que ya tocaba cambiar ese electrodoméstico',
    bajada: 'Ruidos, tiempos y consumos que avisan que la retirada está cerca.',
    fecha: '2026-08-22',
    fechaTexto: '22 de agosto de 2026',
    categoria: 'Cuidados',
    lectura: '4 min',
    autor: 'Equipo Electro Cuciné',
    cuerpo: [
      { tipo: 'parrafo', texto: 'Nadie cambia un electrodoméstico porque sí. Pero postergar el reemplazo cuando las señales ya están puede salir más caro: reparaciones que cuestan lo mismo que la unidad nueva, y una factura de luz que crece sin que lo notes.' },
      { tipo: 'h2', texto: 'Señales claras' },
      { tipo: 'parrafo', texto: 'La pava que tarda el doble en hervir, la batidora que huele a quemado, el lavavajillas que deja la vajilla con manchas después de dos ciclos, la freidora que ya no recupera temperatura. Todas apuntan a lo mismo: desgaste de resistencias, sellos o motor.' },
      { tipo: 'h2', texto: 'Hacé la cuenta' },
      { tipo: 'parrafo', texto: 'Sumá lo que gastaste en reparaciones en los últimos dos años y compará con el precio de una unidad nueva. Si te acercás al 50%, casi siempre conviene cambiar. A eso sumale que los modelos actuales suelen consumir menos, lo que se refleja en todos los meses siguientes.' },
      { tipo: 'parrafo', texto: 'Cuando llegue el momento, en la tienda podés filtrar por categoría y ordenar por precio o por los más vendidos para comparar rápido.' }
    ]
  }
]

export function articuloPorSlug(slug) {
  return ARTICULOS.find((a) => a.slug === slug) || null
}
