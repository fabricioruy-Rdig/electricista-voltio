/* Voltio: datos del negocio (ficticios, para la demo).
   Todo lo que un dueño real cambiaría está acá: precios, zonas, condiciones. */

const NEGOCIO = {
  telefono: "099 333 333",
  visita: 1200,             // visita de diagnóstico (se descuenta si se hace el trabajo)
  recargo: 0.5,             // urgencia fuera de horario: +50 %
  traslado: 400,            // barrios de Montevideo fuera de la zona sin costo
  descuentoEfectivo: 0.10,  // efectivo o transferencia, en trabajos de más de...
  minimoDescuento: 10000,
  descuentoJubilados: 0.10, // en mano de obra, con carné o recibo del BPS
  cuotas: 3,                // sin recargo, en trabajos de más de...
  minimoCuotas: 10000,
  validezPresupuesto: 15,   // días
  cancelacion: 24,          // horas antes, sin costo
  abre: 8, cierra: 20,      // horario de visitas (lunes a sábado)
  materialesMono: 8500,     // materiales aproximados de un monoambiente
  materialesAmbiente: 4500  // materiales aproximados por ambiente
};

// Trabajos y precios de mano de obra (pesos uruguayos)
const TRABAJOS = [
  { id: "cambio", nombre: "Cambio de enchufe o interruptor", precio: 600, horas: "menos de 1 hora" },
  { id: "enchufe", nombre: "Enchufe nuevo con cableado", precio: 1500, horas: "1 a 2 horas" },
  { id: "lampara", nombre: "Colocar lámpara o luminaria", precio: 900, horas: "menos de 1 hora" },
  { id: "termica", nombre: "Llave térmica", precio: 1800, horas: "1 hora" },
  { id: "disyuntor", nombre: "Disyuntor diferencial", precio: 4500, max: 1, horas: "1 a 2 horas" },
  { id: "aire", nombre: "Línea para aire acondicionado", precio: 6500, horas: "medio día" },
  { id: "revision", nombre: "Revisión preventiva completa", precio: 3500, max: 1, horas: "2 a 3 horas" },
  { id: "ambiente", nombre: "Instalación completa de un ambiente", precio: 9500, desde: true, horas: "1 día por ambiente" },
  { id: "mono", nombre: "Instalación completa de monoambiente", precio: 16000, max: 1, desde: true, horas: "1 a 2 días" },
  { id: "tablero", nombre: "Cambio de tablero completo", precio: 14000, max: 1, desde: true, horas: "1 día" }
];

// Zonas
const BARRIOS = [ // sin costo de traslado
  "Buceo", "Carrasco", "Centro", "Ciudad Vieja", "Cordón", "La Blanqueada",
  "Malvín", "Parque Batlle", "Parque Rodó", "Pocitos", "Punta Carretas",
  "Punta Gorda", "Tres Cruces", "Unión", "Ciudad de la Costa"
];
const COSTA = [ // forman parte de Ciudad de la Costa: sin costo
  "Solymar", "Lagomar", "El Pinar", "Shangrilá", "Lomas de Solymar", "Parque de Solymar",
  "Médanos de Solymar", "San José de Carrasco", "Colinas de Solymar", "Parque Carrasco", "Montes de Solymar"
];
const MONTEVIDEO = [ // resto de Montevideo: con costo de traslado
  "Aguada", "Aires Puros", "Atahualpa", "Bañados de Carrasco", "Barra de Carrasco", "Barrio Sur", "Bella Vista",
  "Belvedere", "Brazo Oriental", "Capurro", "Carrasco Norte", "Casabó", "Casavalle", "Cerrito", "Cerro",
  "Cerro Norte", "Colón", "Conciliación", "Flor de Maroñas", "Goes", "Ituzaingó", "Jacinto Vera",
  "Jardines del Hipódromo", "La Comercial", "La Figurita", "La Paloma", "La Teja", "Larrañaga", "Las Acacias",
  "Las Canteras", "Lezica", "Malvín Norte", "Manga", "Maroñas", "Melilla", "Mercado Modelo", "Nuevo París",
  "Pajas Blancas", "Palermo", "Paso de la Arena", "Paso de las Duranas", "Peñarol", "Piedras Blancas", "Prado",
  "Punta de Rieles", "Reducto", "Sayago", "Tomkinson", "Tres Ombúes", "Villa Española", "Villa García", "Villa Muñoz"
];
const CERCA = [ // interior cercano: solo trabajos grandes, a consultar
  "Pando", "Las Piedras", "La Paz", "Barros Blancos", "Joaquín Suárez", "Atlántida", "Salinas",
  "Paso Carrasco", "Colonia Nicolich", "Toledo", "Progreso"
];
const INTERIOR = [ // no llegamos
  "Canelones", "Maldonado", "Punta del Este", "Piriápolis", "Colonia", "Carmelo", "Nueva Helvecia", "Salto",
  "Paysandú", "Rivera", "Tacuarembó", "Florida", "Durazno", "San José", "Libertad", "Minas", "Lavalleja",
  "Rocha", "Chuy", "Treinta y Tres", "Melo", "Cerro Largo", "Artigas", "Mercedes", "Soriano", "Fray Bentos",
  "Río Negro", "Young", "Flores", "Trinidad", "Santa Lucía", "Sauce", "Parque del Plata", "La Floresta"
];
