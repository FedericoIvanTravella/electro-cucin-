// Textos de las landings por categoría (usados en /productos?categoria=X).
// Además de dar contexto al comprador, aportan contenido indexable para
// buscadores en rutas que antes solo mostraban una grilla.

export const LANDINGS = {
  Cocción: {
    titulo: 'Electrodomésticos de cocción',
    bajada: 'Hornos, freidoras de aire, anafes y placas para cocinar a la carta.',
    texto:
      'Encontrá todo para cocinar sin vueltas: freidoras de aire con programas automáticos, hornos eléctricos con grill, anafes portátiles para el asado de invierno y placas induction de rápida respuesta. Todos los modelos de la línea Cocción de Electro Cuciné llegan con 2 años de garantía oficial, servicio técnico en todo el país y envío sin cargo en compras superiores a $150.000. Usá los filtros de precio y capacidad para quedarte con el que mejor se adapta a tu cocina.'
  },
  Preparación: {
    titulo: 'Electrodomésticos de preparación',
    bajada: 'Batidoras, licuadoras, procesadoras y centros de procesado.',
    texto:
      'Batidoras de mano y de mano libres, licuadoras de vidrio y Tritan, procesadoras con disco rallador y centros de procesado multifunción: la línea Preparación está pensada para el día a día de una cocina que trabaja. Filtrá por subcategoría, mirá la capacidad del vaso y revisá las reseñas de compradores reales antes de decidir. Todos los productos cuentan con repuestos originales y garantía de 2 años.'
  },
  Cafetería: {
    titulo: 'Cafetería y desayuno',
    bajada: 'Cafeteras, pavas eléctricas, tostadoras y molinos.',
    texto:
      'Desde cafeteras italianas de aluminio hasta automáticas con molino integrado, pasando por pavas rápidas con control de temperatura y tostadoras de dos ranuras: en Cafetería encontrás todo lo que necesitás para arrancar el día. Filtrá por tipo de café y capacidad, y compará con el botón de comparación. Envío sin cargo desde $150.000 y hasta 12 cuotas sin interés con tarjetas seleccionadas.'
  },
  Limpieza: {
    titulo: 'Limpieza del hogar',
    bajada: 'Lavavajillas portátiles, extractores de humo y aspiradores.',
    texto:
      'La línea Limpieza reúne lavavajillas portátiles para departamentos, extractores de humo, aspiradores ciclónicos y planchas de vapor de alto rendimiento. Modelos silenciosos, eficientes en energía y fáciles de mantener, con repuestos y filtros disponibles. Consultá la ficha técnica de cada producto y las opiniones de quienes ya lo usan en casa.'
  }
}

export function landingDe(categoria) {
  return LANDINGS[categoria] || null
}
