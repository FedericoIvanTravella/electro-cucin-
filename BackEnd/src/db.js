// =====================================================================
// SECCIÓN: BASE DE DATOS (SQLite con node:sqlite)
// - Único módulo que toca la DB. Los routers importan `db` desde acá.
// - Al importarse este archivo se (1) crean las tablas, (2) se aplican
//   migraciones de columnas nuevas y (3) se siembran datos iniciales
//   (superusuario y catálogo de 100 productos) si la DB está vacía.
// =====================================================================
import { DatabaseSync } from 'node:sqlite'
import bcrypt from 'bcrypt'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data')
fs.mkdirSync(dataDir, { recursive: true })

// ---------------------- Conexión a la base ----------------------
// Abre (o crea) el archivo data/electrocucine.db en modo síncrono.
export const db = new DatabaseSync(path.join(dataDir, 'electrocucine.db'))

// ---------------------- Helper de transacciones ----------------------
// node:sqlite no trae db.transaction(): este helper envuelve una función
// en BEGIN/COMMIT y hace ROLLBACK automático si algo falla a mitad.
export function transaction(accion) {
  db.exec('BEGIN')
  try {
    const resultado = accion()
    db.exec('COMMIT')
    return resultado
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

// ---------------------- Esquema de tablas ----------------------
// CREATE TABLE IF NOT EXISTS: no borra nada si la tabla ya existe.
//  - usuarios: cuentas (password = hash bcrypt, nunca texto plano).
//  - sesiones: tokens de sesión con fecha de expiración.
//  - productos: catálogo; {precio, precio_tachado} = precio de oferta y
//    precio "tachado" anterior (para mostrar % OFF).
//  - clientes: libreta de contactos del superusuario.
//  - ventas / venta_items: cabecera de venta + detalle por producto.

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nombre TEXT NOT NULL,
    email TEXT DEFAULT '',
    fecha_nacimiento TEXT DEFAULT '',
    rol TEXT NOT NULL DEFAULT 'cliente',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS sesiones (
    token TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    creada_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    expira_en TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL,
    descripcion TEXT DEFAULT '',
    precio REAL NOT NULL,
    precio_tachado REAL NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    imagen TEXT DEFAULT '',
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT DEFAULT '',
    telefono TEXT DEFAULT '',
    direccion TEXT DEFAULT '',
    fecha_nacimiento TEXT DEFAULT '',
    notas TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    subtotal REAL NOT NULL,
    descuento_pct INTEGER NOT NULL DEFAULT 0,
    descuento_monto REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    metodo_pago TEXT DEFAULT 'tarjeta',
    direccion_envio TEXT DEFAULT '',
    estado TEXT NOT NULL DEFAULT 'completada'
  );

  CREATE TABLE IF NOT EXISTS venta_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
    nombre TEXT NOT NULL,
    precio REAL NOT NULL,
    cantidad INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    usuario TEXT DEFAULT '',
    accion TEXT NOT NULL,
    detalle TEXT DEFAULT '',
    fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`)

// ---------------------- Migraciones ----------------------
// Si una versión anterior de la DB no tiene una columna nueva,
// se la agrega con ALTER TABLE sin perder los datos existentes.
function migrar() {
  const columnasProductos = db.prepare('PRAGMA table_info(productos)').all().map((c) => c.name)
  if (!columnasProductos.includes('precio_tachado')) {
    db.exec('ALTER TABLE productos ADD COLUMN precio_tachado REAL NOT NULL DEFAULT 0')
  }
  const columnasVentas = db.prepare('PRAGMA table_info(ventas)').all().map((c) => c.name)
  if (!columnasVentas.includes('direccion_envio')) {
    db.exec("ALTER TABLE ventas ADD COLUMN direccion_envio TEXT DEFAULT ''")
  }
}
migrar()

// ---------------------- Helpers de edad y descuento ----------------------
// Calcula la edad a partir de la fecha de nacimiento.
export function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null
  const nac = new Date(`${fechaNacimiento}T00:00:00`)
  if (Number.isNaN(nac.getTime())) return null
  const hoy = new Date()
  let edad = hoy.getFullYear() - nac.getFullYear()
  const mes = hoy.getMonth() - nac.getMonth()
  if (mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

// Constantes del negocio: descuento 30% para mayores de 65, tope de 100 años.
export const EDAD_DESCUENTO = 65
export const PORCENTAJE_DESCUENTO = 30
export const EDAD_MAXIMA = 100

// Valida una fecha de nacimiento (formato, futuro y límite de edad).
// Devuelve '' si es correcta o un mensaje de error legible.
export function validarFechaNacimiento(fecha) {
  if (!fecha) return ''
  const nacimiento = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(nacimiento.getTime())) return 'La fecha de nacimiento no es válida.'
  if (nacimiento > new Date()) return 'La fecha de nacimiento no puede ser a futuro.'
  const edad = calcularEdad(fecha)
  if (edad !== null && edad > EDAD_MAXIMA) {
    return `Debés tener como máximo ${EDAD_MAXIMA} años para crear la cuenta.`
  }
  return ''
}

// Indica si un usuario accede al descuento (65 años o más).
export function tieneDescuento(usuario) {
  const edad = calcularEdad(usuario?.fecha_nacimiento)
  return edad !== null && edad >= EDAD_DESCUENTO
}

// ---------------------- Auditoría ----------------------
// Registra una acción sensible (quién hizo qué y cuándo). Nunca debe
// romper la operación principal, por eso atrapa cualquier error.
export function registrarAuditoria(usuario, accion, detalle = '') {
  try {
    db.prepare('INSERT INTO auditoria (usuario_id, usuario, accion, detalle) VALUES (?, ?, ?, ?)').run(
      usuario?.id ?? null,
      usuario?.username ?? 'sistema',
      accion,
      String(detalle)
    )
  } catch {
    // La auditoría es secundaria: si falla, no interrumpe la acción.
  }
}

// ---------------------- Seed: superusuario ----------------------
// Si no existe, crea la cuenta de administrador. La contraseña también
// se encripta con bcrypt (hash de 10 rondas) antes de guardarla.
const SUPER_USER = {
  username: 'federico',
  password: 'admin23',
  nombre: 'Federico Travella',
  email: 'federico@electrocucine.com',
  rol: 'admin'
}

// ---------------------- Seed: catálogo de productos ----------------------
// [nombre, categoria, descripcion, precio, stock, precio_tachado]
// El orden define el ID de cada producto. La imagen "1.jpg" pertenece al producto 1,
// "2.jpg" al 2, etc.: el campo imagen se guarda como el número de archivo.
const productosIniciales = [
  ['Freidora de aire 5.5L Dual Crisp', 'Cocción', 'Freidora sin aceite de 5.5 litros con canasto doble, 12 programas y pantalla táctil.', 189900, 18, 249900],
  ['Licuadora de mano 700W con vaso y varillas', 'Preparación', 'Minipimer de 700W con vaso graduado de 700ml y accesorios para batir y picar.', 68900, 24, 89900],
  ['Pava eléctrica 1.7L acero inoxidable', 'Cafetería', 'Hervidor de 1.7 litros en acero inoxidable, apagado automático y base 360°.', 45900, 30, 59900],
  ['Licuadora de vaso vidrio 1.5L', 'Preparación', 'Vaso de vidrio resistente, 600W, función picar hielo y vaso graduado de 1.5 litros.', 85900, 16, 109900],
  ['Tostadora 2 ranuras metálica', 'Cafetería', 'Levantamiento alto, 7 niveles de tostado, función descongelar y bandeja de migas.', 39900, 26, 52900],
  ['Batidora de mano 5 velocidades', 'Preparación', 'Motor de 400W, 5 velocidades, varillas de acero inoxidable y vaso de 700ml.', 52900, 22, 67900],
  ['Batidora planetaria 1000W bowl 5L', 'Preparación', 'Batidora planetaria con bowl de 5 litros, 6 velocidades y función exprimidor de ajos.', 245900, 8, 309900],
  ['Procesador de alimentos 12 accesorios', 'Preparación', 'Corta, ralla, amasa y pica. Bowl de 2.5L con 12 accesorios intercambiables.', 124900, 11, 159900],
  ['Robot de cocina multifunción', 'Preparación', 'Cocina, amasa, pica y pesa. 15 funciones automáticas con recetario incluido.', 349900, 6, 429900],
  ['Picadora eléctrica 500W', 'Preparación', 'Bowl de 500ml con cuchilla de acero para picar, rallar y moler.', 38900, 28, 49900],
  ['Multiprocesadora 700W con exprimidor', 'Preparación', 'Incluye picadora, vaso para jugo, exprimidor de cítricos y discos para rallar.', 89900, 14, 115900],
  ['Mini procesador 4 tazas', 'Preparación', 'Compacto para picar cebolla, salsa y purés. Bowl de 950ml y guardado de cable.', 45900, 20, 57900],
  ['Exprimidor de cítricos eléctrico', 'Preparación', 'Cono reversible para naranjas y limones, control de pulpa y pico antigoteo.', 34900, 25, 44900],
  ['Exprimidor de jugos 800W', 'Preparación', 'Boca ancha de 75mm, filtro de acero inoxidable y separador de espuma.', 119900, 9, 149900],
  ['Jugueras y extractores de dos pasos', 'Preparación', 'Extractor de 900W con tapa de seguridad y recipiente de 1.2 litros.', 137900, 7, 169900],
  ['Vaporera de 3 niveles', 'Cocción', 'Apilable en 3 niveles, temporizador de 60 minutos y autoapagado.', 79900, 12, 99900],
  ['Arrocera 1.8L con vaporera', 'Cocción', 'Bowl antiadherente de 1.8L, 5 funciones y función keep warm por 12 horas.', 54900, 19, 69900],
  ['Multicocina eléctrica 6L', 'Cocción', 'Olla multifunción con 15 programas: arroz, guiso, sopa y cocción a fuego lento.', 119900, 10, 149900],
  ['Olla de presión eléctrica 6L', 'Cocción', '6 programas automáticos, válvula de seguridad y bowl antiadherente.', 139900, 8, 174900],
  ['Olla eléctrica tipo wok 5L', 'Cocción', 'Wok eléctrico de 5 litros con tapa de cristal y temperatura regulable.', 84900, 13, 104900],
  ['Horno eléctrico 45L con grill', 'Cocción', 'Termostato hasta 250°C, grill superior, 4 planos y timer de 60 minutos.', 259900, 7, 320000],
  ['Mini horno eléctrico 30L', 'Cocción', 'Horno de sobremesa de 30 litros con grill y bandejas antiadherentes.', 169900, 9, 209900],
  ['Microondas 25L Inverter 900W', 'Cocción', 'Panel digital, 10 niveles, descongelado por peso y plato giratorio.', 189900, 12, 239900],
  ['Microondas compacto 18L', 'Cocción', 'Ideal para espacios chicos, 700W con 6 niveles y plato de 26.5cm.', 124900, 15, 154900],
  ['Horno microondas grill 27L', 'Cocción', 'Combinación con grill de cuarzo, 8 preprogramas y dorado de alimentos.', 219900, 6, 269900],
  ['Anafe eléctrico de inducción', 'Cocción', '2 hornallas de inducción, 10 niveles de potencia y bloqueo de seguridad.', 179900, 10, 224900],
  ['Cocina eléctrica 2 hornallas', 'Cocción', 'Cocina a plancha de 2 fuegos con tapa de cristal templado.', 89900, 8, 112900],
  ['Parrilla eléctrica antiadherente', 'Cocción', 'Placa de 2400W con bandeja recoge-aceite y superficie antiadherente.', 119900, 12, 149900],
  ['Grill panini y tostador doble placa', 'Cocción', 'Panini, plancha y parrilla inverter con 3 posiciones de apertura.', 79900, 14, 99900],
  ['Sandwichera plana 1000W', 'Cocción', 'Planchas antiadherentes de granito y bandeja de grasa extraíble.', 45900, 25, 57900],
  ['Gofrera 4 porciones', 'Cocción', '2 planchas antiadherentes con indicador de cocción perfecta.', 62900, 11, 79900],
  ['Máquina para hacer pan 750W', 'Cocción', 'Hasta 1 kg de pan, 13 programas, dispensador de frutas y temporizador.', 189900, 5, 229900],
  ['Freidora de aire 3.5L digital', 'Cocción', 'Digital touch, 8 modos y canasto antiadherente de 3.5 litros.', 129900, 17, 159900],
  ['Freidora de aire 10L tipo horno', 'Cocción', 'Gran capacidad de 10 litros, vista panorámica y rotación asados automática.', 289900, 4, 349900],
  ['Cafetera espresso 15 bar', 'Cafetería', 'Presión de 15 bar, vaporizador de leche y bandeja calientatazas.', 174900, 13, 214900],
  ['Cafetera automática espresso y cappuccino', 'Cafetería', 'Molino integrado, 15 bar, jarra de leche automática y 12 recetas.', 329900, 5, 399900],
  ['Cafetera de filtro 12 tazas', 'Cafetería', 'Programable 24h, jarra de vidrio y función mantener caliente.', 79900, 15, 99900],
  ['Cafetera italiana moka eléctrica', 'Cafetería', 'Prepara 6 tazas de café tipo moka con apagado automático.', 89900, 8, 109900],
  ['Máquina de cápsulas', 'Cafetería', 'Sistema de cápsulas, 15 bar y preparación en 30 segundos.', 99900, 18, 124900],
  ['Molinillo de café 150W', 'Cafetería', 'Molino de cuchillas con 2 niveles y recipiente para 45g.', 32900, 22, 41900],
  ['Prensa francesa 1L', 'Cafetería', 'Filtro de acero inoxidable y jarra de vidrio templado.', 32900, 19, 41900],
  ['Espumador de leche eléctrico', 'Cafetería', 'Espuma fría o caliente en 60 segundos. Incluye varillas batidoras.', 29900, 27, 37900],
  ['Hervidor de viaje plegable', 'Cafetería', 'Pava eléctrica plegable de silicona apta alimentos, 850ml.', 54900, 12, 68900],
  ['Pava eléctrica de vidrio 1.8L', 'Cafetería', 'Vidrio templado con luz LED, temperatura ajustable y apagado auto.', 69900, 14, 85900],
  ['Tostadora 4 ranuras acero', 'Cafetería', '4 ranuras con 7 niveles, funciones descongelar y recalentar.', 69900, 9, 87900],
  ['Sandwichera de dos placas extraíbles', 'Cafetería', 'Placas extraíbles, indicador de listo y parrilla premium.', 54900, 16, 68900],
  ['Batidora de vaso abatible', 'Preparación', 'Vaso que se vuelca para servir, cuchillas de 6 puntas y 800W.', 99900, 7, 124900],
  ['Licuadora personal portátil', 'Preparación', 'Botella de 600ml, batería USB y cuchillas de acero inoxidable.', 45900, 21, 57900],
  ['Licuadora industrial 2L', 'Preparación', 'Motor de 1200W, jarra de 2 litros y cuchillas reforzadas.', 159900, 8, 194900],
  ['Batidora de pedestal 5L', 'Preparación', 'Bowl de 5 litros giratorio, 8 velocidades y batidor de ganchos.', 189900, 6, 234900],
  ['Kitchen y procesadora con vaso', 'Preparación', 'Robot de encimera con vaso de 2.4L y 15 accesorios.', 229900, 4, 279900],
  ['Picadora de carne 1600W', 'Preparación', 'Tolva ancha, cuchillas de acero y 2 placas de picado.', 139900, 9, 169900],
  ['Cortadora de fiambre eléctrica', 'Preparación', 'Disco de 25cm, corte regulable y cuchilla autoafilante.', 149900, 5, 179900],
  ['Balanza de cocina digital 10kg', 'Preparación', 'Pantalla LCD, función tara y pesaje en g/lb/oz.', 21900, 32, 27900],
  ['Termómetro digital de cocina', 'Preparación', 'Sonda de medición instantánea para carnes, masas y líquidos.', 18900, 24, 23900],
  ['Rallador eléctrico 300W', 'Preparación', 'Discos para rallar, rebanar y espirallzar vegetales.', 89900, 10, 109900],
  ['Abrelatas eléctrico', 'Preparación', 'Automático, extrae la tapa con un botón y función manual.', 27900, 18, 34900],
  ['Espiralizador eléctrico', 'Preparación', 'Corta en espiral 3 grosores para verduras y pastas saludables.', 64900, 8, 79900],
  ['Selladora al vacío 60W', 'Preparación', 'Sellado de alimentos con bolsa, modo húmedo y seco, cámara compacta.', 115900, 7, 139900],
  ['Envasadora al vacío con cortadora', 'Preparación', 'Bomba potente con modo precisión y rollo incluido de 3 metros.', 139900, 4, 169900],
  ['Máquina para hacer fideos', 'Preparación', 'Extrusora de pasta fresca con 5 discos de diferentes cortes.', 159900, 5, 189900],
  ['Yogurtera 6 potes', 'Preparación', 'Control de tiempo con alarma y potes de 150ml con tapa.', 54900, 12, 67900],
  ['Heladera eléctrica de mano', 'Preparación', 'Paleta de acero inoxidable para helados y postres fríos.', 18900, 20, 24900],
  ['Licuadora y extractor 2 en 1', 'Preparación', 'Dos funciones en un motor: vaso licuador y canasto extractor.', 114900, 8, 142900],
  ['Deshidratador de alimentos 5 bandejas', 'Cocción', '5 bandejas, 40-70°C, temporizador y circulación de aire.', 134900, 6, 164900],
  ['Cocina solar y parrilla energética', 'Cocción', 'Parrilla ainducción con panel de control táctil y 4 zonas.', 299900, 3, 359900],
  ['Plancha doble contacto', 'Cocción', 'Placas de granito, indicaor de temperatura y base antideslizante.', 74900, 11, 92900],
  ['Café de grano tipo express', 'Cafetería', 'Máquina de 19 bar, molino cerámico y depósito de 2L.', 359900, 4, 429900],
  ['Molinillo de café profesional', 'Cafetería', 'Molino de muelas con 18 niveles y soporte para portafiltros.', 219900, 6, 264900],
  ['Filtro de agua y jarra', 'Cafetería', 'Jarra de 2.2L con filtro de carbono activado.', 49900, 15, 61900],
  ['Extractor de humos 60cm', 'Limpieza', 'Motor silencioso de 400 m³/h, 3 velocidades y luz LED.', 219900, 6, 269900],
  ['Extractor de humos campana isla 90cm', 'Limpieza', 'Doble turbina de 700 m³/h, panel táctil y control remoto.', 339900, 3, 409900],
  ['Lavavajillas de sobremesa 6 cubiertos', 'Limpieza', 'Compacto con manguera incluida, 6 programas y secado.', 549900, 4, 649900],
  ['Lavavajillas compacto 14 cubiertos', 'Limpieza', 'Ancho 45cm, 6 programas, media carga y eficiencia A++.', 689900, 3, 799000],
  ['Purificador de aire para cocina', 'Limpieza', 'Filtro HEPA y sensor de humo, ideal ambientes de hasta 30m².', 159900, 8, 194900],
  ['Cafetera de goteo con jarra térmica', 'Cafetería', 'Jarra acero que mantiene el café caliente 2 horas.', 89900, 9, 109900],
  ['Cafetera personal 3 en 1', 'Cafetería', 'Espresso, goteo y aeropress: manual con resistencia regulable.', 69900, 12, 85900],
  ['Tostadora con placa para huevos', 'Cafetería', 'Ranuras anchas para panes de molde gruesos y bandeja de cocido.', 54900, 10, 67900],
  ['Grill eléctrico de contacto 3 platos', 'Cocción', 'Tres planos de cocción: grill, plancha y parrilla.', 169900, 5, 204900],
  ['Olla de cerámica multicooker 3.5L', 'Cocción', 'Recubrimiento cerámico, 10 programas y cocción lenta.', 134900, 9, 164900],
  ['Freidora de aire cero aceite con rotación', 'Cocción', 'Barra de pollo asado giratoria y canasto de 5 litros.', 249900, 5, 299900],
  ['Batidora espumadora de mano', 'Preparación', 'Bate huevos, crema y café. 3 velocidades con stand.', 24100, 29, 30900],
  ['Prensa de jugos de palanca', 'Preparación', 'Exprime naranjas con mínima fuerza, tapa antisalpicaduras.', 25100, 17, 31900],
  ['Rallador espiral manual', 'Preparación', 'Corta y espiraliza vegetales con 5 cuchillas intercambiables.', 19900, 25, 25900],
  ['Máquina de palomitas eléctrica', 'Cocción', 'Legumbres de maíz en 3 minutos con dosificador de aceite.', 45900, 10, 57900],
  ['Churrera eléctrica 1500W', 'Cocción', 'Acero inoxidable, control de temperatura y capacidad 2.5L.', 189900, 4, 229900],
  ['Crepera eléctrica antiadherente', 'Cocción', 'Placa de 32cm, indicador de listo y gadget para girar.', 59900, 9, 74900],
  ['Cocina de inducción portátil 1 hornalla', 'Cocción', 'Sensor de temperatura, temporizador y panel táctil.', 89900, 14, 109900],
  ['Anafe eléctrico de dos fuegos clásico', 'Cocción', '2 discos independientes con 3 niveles cada uno.', 129900, 6, 154900],
  ['Freidora de inmersión 3L', 'Cocción', 'Depósito de 3 litros, tapa con mirilla y cesto antiadherente.', 139900, 5, 169900],
  ['Máquina de chocolate caliente', 'Cafetería', 'Prepara chocolate y leche espumada, apto para 1.2 litros.', 79900, 7, 99900],
  ['Jarra eléctrica para fondue', 'Cocción', 'Olla para fondue de queso o chocolate con control de temperatura.', 89900, 4, 109900],
  ['Sandwichera grill para pan','Cocción', 'Placas estriadas y lisas intercambiables para tostados y carnes.', 42900, 16, 53900],
  ['Tostadora multitorre 6 ranuras', 'Cafetería', 'Ideal para gastronomía, 6 ranuras con extra-elevación.', 99900, 5, 119900],
  ['Vaporera de arroz y verduras con canasto', 'Cocción', 'Canasto para verduras, bowl de arroz y 2 niveles.', 74900, 8, 92900],
  ['Balanza de cocina con temporizador', 'Preparación', 'Pantalla retroiluminada, temporizador y medida de volumen.', 24900, 12, 31900],
  ['Máquina de fideos y pastas con secador', 'Preparación', 'Amasadora integrada y 12 discos de formatos de pasta.', 199900, 3, 239900],
  ['Cortador multiuso manual', 'Preparación', 'Corta en cubos, juliana y gajos con recipiente recolector.', 18900, 22, 24900],
  ['Cocina a gas portátil', 'Cocción', 'Hornalla a gas con cartucho, ideal camping y balcones.', 38900, 14, 48900],
  ['Extractor de humos compacto 45cm', 'Limpieza', 'Para espacios chicos, 240 m³/h y filtro lavable.', 159900, 5, 189900]
]

function seed() {
  // --- Superusuario ---
  const admin = db.prepare('SELECT id FROM usuarios WHERE username = ?').get(SUPER_USER.username)
  if (!admin) {
    // la contraseña "admin23" se guarda como hash bcrypt.
    const hash = bcrypt.hashSync(SUPER_USER.password, 10)
    db.prepare(
      'INSERT INTO usuarios (username, password, nombre, email, fecha_nacimiento, rol) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(SUPER_USER.username, hash, SUPER_USER.nombre, SUPER_USER.email, '', SUPER_USER.rol)
    console.log(`[seed] Superusuario creado: ${SUPER_USER.username}`)
  }

  // --- Catálogo inicial (solo si la tabla productos está vacía) ---
  const cantidad = db.prepare('SELECT COUNT(*) AS n FROM productos').get().n
  if (cantidad === 0) {
    const stmt = db.prepare(
      'INSERT INTO productos (nombre, categoria, descripcion, precio, precio_tachado, stock, imagen) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    // Cada lista es [nombre, categoria, descripcion, precio, stock, precio_tachado].
    // La imagen se guarda como el número de ID (1 -> /productos/1.jpg).
    productosIniciales.forEach((p, indice) => {
      stmt.run(p[0], p[1], p[2], p[3], p[5], p[4], String(indice + 1))
    })
    console.log(`[seed] ${productosIniciales.length} productos cargados (imagen = número de ID)`)
  }
}

seed()