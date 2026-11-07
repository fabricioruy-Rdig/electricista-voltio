/* Voltio: asistente automático (sin inteligencia artificial).
   Cómo piensa:
   1. Limpia el texto: errores de tipeo, abreviaturas, letras repetidas.
   2. Si hizo una pregunta, primero intenta encajar la respuesta (sí, no, no sé, creo que…).
   3. Busca emergencias y temas especiales con reglas.
   4. Compara el mensaje con frases de ejemplo usando Fuse.js (búsqueda aproximada).
   5. Responde con frases variadas y usando lo que recuerda de la conversación. */

const chat = document.getElementById("chat");
const chatBoton = document.getElementById("chat-boton");
const mensajes = document.getElementById("chat-mensajes");
const opciones = document.getElementById("chat-opciones");
const campoChat = document.getElementById("chat-texto");

// Lo que el asistente recuerda de la conversación
const memoria = {
  lugar: null, motivo: "", jubilado: false, cantidades: null, total: 0,
  ultimaIntencion: "", sinEntender: 0, opciones: [], explicacion: "", nota: "", frases: {},
  reservas: {}, ultimaReserva: null, pendiente: null, reprogramando: null, guiado: null, materiales: null, resumenTotal: 0, urgente: false
};

/* ===================== Ventana del chat ===================== */
let iniciado = false;
function abrirChat(inicio) {
  chat.hidden = false;
  chatBoton.classList.add("abierto");
  chatBoton.setAttribute("aria-expanded", "true");
  if (typeof inicio === "function") { iniciado = true; inicio(); }
  else if (!iniciado) {
    iniciado = true;
    const h = horaActual();
    const saludo = h < 6 ? "¡Hola! 🌙 Sí, a esta hora también te atiendo." : "¡Hola! Soy el asistente automático de Voltio ⚡";
    bot(`${saludo}<br>Contame qué está pasando o qué necesitás. Por ejemplo: <em>«se me cortó la luz»</em>, <em>«cuánto sale cambiar un enchufe»</em> o <em>«¿pueden venir el lunes a Pocitos?»</em>`, () => ofrecer([
      ["Tengo un problema eléctrico", problema], ["Quiero un presupuesto", () => presupuesto()], ["Agendar una visita", () => agendar()]
    ]));
  }
  campoChat.focus();
}
function cerrarChat() {
  chat.hidden = true;
  chatBoton.classList.remove("abierto");
  chatBoton.setAttribute("aria-expanded", "false");
}
document.querySelectorAll(".js-abrir-chat").forEach((b) => b.addEventListener("click", abrirChat));
chat.querySelector(".chat__minimizar").addEventListener("click", () => { cerrarChat(); chatBoton.focus(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !chat.hidden) { cerrarChat(); chatBoton.focus(); } });

const escapar = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const bajar = () => (mensajes.scrollTop = mensajes.scrollHeight);
function agregar(contenido, quien = "bot") {
  const m = document.createElement("div");
  m.className = "msj msj--" + quien;
  if (typeof contenido === "string") m.innerHTML = contenido; else m.append(contenido);
  mensajes.append(m); bajar();
  return m;
}
// Los mensajes del bot van en fila: "escribe" un momento y responde, uno detrás del otro
let fila = Promise.resolve();
function bot(contenido, despues) {
  opciones.innerHTML = ""; memoria.opciones = [];
  fila = fila.then(() => new Promise((listo) => {
    opciones.innerHTML = "";
    if (memoria.nota && typeof contenido === "string") { contenido = memoria.nota + "<br>" + contenido; memoria.nota = ""; }
    const escribiendo = agregar("<i></i><i></i><i></i>");
    escribiendo.classList.add("msj--escribiendo");
    const largo = typeof contenido === "string" ? contenido.replace(/<[^>]+>/g, "").length : 120;
    setTimeout(() => {
      escribiendo.remove();
      const m = agregar(contenido);
      m.querySelectorAll(".js-tel-chat").forEach(telefonoDemo);
      if (despues) despues(m);
      listo();
    }, sinMovimiento ? 120 : Math.min(1200, 400 + largo * 4));
  }));
}
// Botones de respuesta: aparecen solo cuando el bot pregunta algo.
// Cada opción puede tener un "tipo" (si, no, nose) para entender respuestas escritas.
function ofrecer(lista, explicacion = "") {
  memoria.opciones = lista; memoria.explicacion = explicacion;
  opciones.innerHTML = "";
  lista.forEach(([texto, accion, clase]) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "opcion" + (clase ? " " + clase : ""); b.textContent = texto;
    b.addEventListener("click", () => { agregar(escapar(texto), "yo"); memoria.opciones = []; accion(); });
    opciones.append(b);
  });
}
// Elige una frase al azar sin repetir la última usada para ese tema
function variar(clave, frases) {
  const posibles = frases.filter((f) => f !== memoria.frases[clave]);
  const elegida = posibles[Math.floor(Math.random() * posibles.length)] || frases[0];
  memoria.frases[clave] = elegida;
  return elegida;
}
function horaActual() {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Montevideo", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
}
const fueraDeHorario = () => { const h = horaActual(); return h < NEGOCIO.abre || h >= NEGOCIO.cierra || new Date().getDay() === 0; };
const precioVisitaAhora = () => NEGOCIO.visita * (fueraDeHorario() ? 1 + NEGOCIO.recargo : 1);

/* ===================== 1. Limpieza del texto ===================== */
const CORRECCIONES = {
  q: "que", k: "que", ke: "que", qe: "que", x: "por", xq: "porque", pq: "porque", porq: "porque",
  xfa: "por favor", porfa: "por favor", plis: "por favor", tb: "tambien", tmb: "tambien", d: "de",
  toy: "estoy", nesecito: "necesito", nesesito: "necesito", nececito: "necesito", nesecitaria: "necesitaria",
  ola: "hola", wenas: "buenas", bnas: "buenas", grax: "gracias", gracia: "gracias", ntp: "no te preocupes",
  tomas: "tomacorrientes", toma: "tomacorriente", enchufe: "enchufe", mono: "monoambiente",
  laburan: "trabajan", laburo: "trabajo", labura: "trabaja", nse: "no se", nose: "no se", nolose: "no lo se"
};
function limpiar(texto) {
  let t = normalizar(texto).replace(/[¿?¡!.,;:()"'*\-]/g, " ");
  t = t.replace(/([a-z])\1{2,}/g, "$1").replace(/([aeiou])\1+\b/g, "$1"); // "siii" → "si", "noo" → "no"
  return t.split(/\s+/).filter(Boolean).map((p) => CORRECCIONES[p] || VOCABULARIO.get(fonetico(p)) || p).join(" ");
}
// Versión "como suena": iguala b/v, s/z/c, ll/y, sin h. Así "bengan" ≈ "vengan" y "canviar" ≈ "cambiar".
function fonetico(t) {
  return t.replace(/ch/g, "§").replace(/h/g, "").replace(/§/g, "ch")
    .replace(/v/g, "b").replace(/z/g, "s").replace(/c([ei])/g, "s$1").replace(/qu/g, "k").replace(/c/g, "k")
    .replace(/ll/g, "y").replace(/nb/g, "mb");
}

/* ===================== 2. Respuestas cortas a una pregunta ===================== */
function clasificar(t) {
  if (/\b(que es eso|que es|que seria|como es eso|no entiendo la pregunta)\b/.test(t)) return "que";
  if (/\b(no se|no lo se|ni idea|no tengo idea|ni la mas palida|no sabria|no me fije|no estoy seguro|no tengo ni idea)\b/.test(t)) return "nose";
  if (/\b(creo que si|me parece que si|capaz que si|puede ser|capaz|supongo que si|calculo que si)\b/.test(t)) return "creosi";
  if (/\b(creo que no|me parece que no|capaz que no|supongo que no|calculo que no)\b/.test(t)) return "creono";
  if (/^(no|nop|nel|nada|para nada|ninguna?o?)\b|\b(estoy bien asi|no gracias|no hace falta|por ahora no|mejor no|todavia no)\b/.test(t)) return "no";
  if (/^(si|sip|sep|obvio|claro|dale|ok|okey|oka|bueno|joya|de una|aja|ta|tienen si|si tienen|correcto|exacto|perfecto|bien|va|vamos)\b/.test(t)) return "si";
  return null;
}
function responderOpcion(t) {
  if (!memoria.opciones.length) return false;
  const tipo = clasificar(t);
  if (tipo === "que" && memoria.explicacion) {
    const lista = memoria.opciones, exp = memoria.explicacion;
    bot(exp, () => ofrecer(lista, exp));
    return true;
  }
  const base = { creosi: "si", creono: "no" }[tipo] || tipo;
  let op = base && memoria.opciones.find((o) => o[3] === base);
  if (!op) { // ¿escribió algo parecido al texto de un botón?
    const f = new Fuse(memoria.opciones.map((o) => ({ o, n: fonetico(limpiar(o[0])) })), { keys: ["n"], includeScore: true, threshold: 0.35, ignoreLocation: true });
    const r = f.search(fonetico(t))[0];
    if (r && t.length >= 4) op = r.item.o;
  }
  if (!op) return false;
  if (tipo === "creosi" || tipo === "creono") memoria.nota = "Lo tomo así y lo confirmamos en la visita 👍";
  memoria.opciones = [];
  op[1]();
  return true;
}

/* ===================== 3. Temas que reconoce (frases de ejemplo) ===================== */
const INTENCIONES = {
  saludo: ["hola", "buenas", "buen dia", "buenas tardes", "buenas noches", "que tal", "como andan", "holis"],
  gracias: ["gracias", "muchas gracias", "genial", "barbaro", "excelente", "buenisimo", "joya gracias", "mil gracias"],
  chau: ["chau", "adios", "hasta luego", "nos vemos", "los espero", "eso es todo", "nada mas", "demas", "saludos"],
  sinluz: ["sin luz", "me quede sin luz", "se corto la luz", "no tengo luz", "se fue la luz", "no hay luz", "sin corriente", "no tengo corriente", "quede a oscuras", "se apago todo", "corte de luz", "apagon", "no anda nada en la casa"],
  llave: ["salta la llave", "se baja la llave", "salta el disyuntor", "disyuntor", "se cae la termica", "salta la termica", "termica", "se baja la tecla", "salta el automatico", "salta el diferencial", "se dispara la llave", "salta cuando prendo"],
  noanda: ["no prende", "no enciende", "no funciona", "no anda", "foco", "lampara", "enchufe", "tomacorriente", "interruptor", "el enchufe no funciona", "no prende la luz", "la luz del baño no anda", "hace falso contacto", "falso contacto", "parpadea la luz"],
  precios: ["presupuesto", "precio", "precios", "cuanto sale", "cuanto cuesta", "cuanto cobran", "cuanto me sale", "que precio tiene", "cotizacion", "tarifa", "valor", "costo", "cuanto seria", "cuanto me cobran"],
  agendar: ["agendar", "agendame", "turno", "visita", "pueden venir", "quiero un turno", "reservar", "cuando pueden venir", "necesito que vengan", "sacar hora", "pedir turno", "vengan", "coordinar", "pasar por casa", "anotame"],
  horarios: ["horario", "horarios", "a que hora atienden", "que dias trabajan", "hasta que hora", "abren los domingos", "atienden los sabados", "horario de atencion", "a que hora abren", "trabajan los domingos", "trabajan los feriados"],
  zonas: ["zona", "zonas", "barrio", "que zonas cubren", "llegan a mi barrio", "donde trabajan", "cobran traslado", "traslado", "cobertura", "hasta donde llegan", "interior", "trabajan en el interior", "van al interior"],
  urgencias: ["urgente", "urgencia", "emergencia", "es urgente", "necesito ya", "lo antes posible", "ahora mismo", "rapido", "ya mismo", "que vengan ahora"],
  garantia: ["garantia", "tienen garantia", "dan garantia", "matriculado", "son matriculados", "son de confianza", "experiencia", "habilitados", "son serios", "si falla despues"],
  pago: ["como se paga", "formas de pago", "medios de pago", "pago", "tarjeta", "transferencia", "efectivo", "mercado pago", "cuotas", "aceptan tarjeta", "pos", "posnet", "debito", "credito", "oca", "visa", "mastercard", "qr", "cuando se paga"],
  descuentos: ["descuento", "descuentos", "rebaja", "promo", "promocion", "oferta", "jubilado", "jubilados", "precio especial", "me hacen precio", "algo mas barato"],
  materiales: ["materiales", "incluye materiales", "los materiales", "tengo que comprar", "cables", "quien pone los materiales", "lista de materiales", "que tengo que comprar"],
  tiempos: ["cuanto demoran", "cuanto tiempo", "cuantos dias", "cuanto tardan", "tardan mucho", "en cuanto lo terminan", "cuanto lleva"],
  factura: ["factura", "rut", "boleta", "comprobante", "hacen factura", "factura con rut", "dan boleta"],
  incluye: ["que incluye la visita", "la visita incluye", "si encuentran el problema", "arreglan en la visita", "la visita se cobra aparte", "va aparte el arreglo", "incluye algun servicio"],
  comercio: ["local", "negocio", "comercio", "oficina", "empresa", "peluqueria", "restaurante", "tienda", "almacen", "consultorio", "mi local"],
  persona: ["hablar con una persona", "hablar con alguien", "un humano", "hablar con el electricista", "contacto", "whatsapp", "telefono", "numero", "llamarlos"],
  servicios: ["servicios", "que servicios hacen", "que hacen", "que trabajos hacen", "hacen instalaciones", "trabajan con tableros"],
  bot: ["sos un robot", "sos humano", "sos una persona", "eres una ia", "con quien hablo", "sos un bot", "sos real", "inteligencia artificial"]
};
// Vocabulario: palabras que conoce, indexadas por cómo suenan ("bengan" → "vengan", "biernes" → "viernes")
const VOCABULARIO = new Map();
[...Object.values(INTENCIONES).flat().join(" ").split(" "),
 "vengan", "venir", "vienen", "cambiar", "cambien", "viernes", "sabado", "lunes", "martes", "miercoles", "jueves", "domingo",
 "enchufe", "enchufes", "tomacorriente", "tomacorrientes", "lampara", "lamparas", "quemado", "quemo", "llave", "tablero",
 "necesito", "presupuesto", "instalacion", "habitacion", "cocina", "visita", "electricista", "cable", "cables", "corriente"]
  .forEach((p) => { if (p.length > 3 && !VOCABULARIO.has(fonetico(p))) VOCABULARIO.set(fonetico(p), p); });

const indiceFrases = Object.entries(INTENCIONES).flatMap(([intencion, frases]) => frases.map((frase) => ({ intencion, frase, f: fonetico(frase) })));
const buscadorFrases = new Fuse(indiceFrases, { keys: ["f"], includeScore: true, threshold: 0.4, ignoreLocation: true, minMatchCharLength: 2 });
const VACIAS = new Set(["el", "la", "los", "las", "un", "una", "de", "del", "a", "al", "y", "o", "que", "me", "mi", "se", "en", "es", "lo", "le", "por", "para", "con", "si", "ya", "hay", "tengo", "quiero", "necesito", "ustedes", "uds", "algo", "esto", "eso", "muy", "medio"]);

// Compara pedacitos del mensaje (de 1 a 4 palabras) con las frases de ejemplo
function reconocer(t) {
  const palabras = fonetico(t).split(" ");
  const puntaje = {};
  for (let largo = 1; largo <= 4; largo++) {
    for (let i = 0; i + largo <= palabras.length; i++) {
      const trozo = palabras.slice(i, i + largo);
      if (largo === 1 && VACIAS.has(palabras[i])) continue;
      const ventana = trozo.join(" ");
      if (ventana.length < 2 || ventana.length > 32) continue;
      for (const r of buscadorFrases.search(ventana).slice(0, 3)) {
        // Palabras cortas: solo valen si coinciden exacto ("paso" no es "pago", "tienen" no es "tienda")
        const largo = r.item.f.length;
        if ((largo <= 5 && r.score > 0.001) || (largo <= 8 && r.score > 0.15)) continue;
        const calidad = (1 - r.score) * Math.min(ventana.length, r.item.f.length) / Math.max(ventana.length, r.item.f.length);
        if (calidad > (puntaje[r.item.intencion] || 0)) puntaje[r.item.intencion] = calidad;
      }
    }
  }
  const temas = Object.entries(puntaje).filter(([, v]) => v >= 0.62).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const reales = temas.filter((x) => !["saludo", "gracias"].includes(x));
  return reales.length ? reales.concat(temas.filter((x) => !reales.includes(x))) : temas;
}

/* Números escritos ("un par", "tres", "4") delante de una palabra */
const NUMEROS = { un: 1, una: 1, uno: 1, dos: 2, par: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, varios: 3, varias: 3, cuantos: 3, cuantas: 3 };
function cantidadAntes(t, re) {
  const p = t.split(" ");
  const i = p.findIndex((x) => re.test(x));
  if (i < 0) return 0;
  for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
    if (/^\d+$/.test(p[j])) return Math.min(20, +p[j]);
    if (NUMEROS[p[j]]) return NUMEROS[p[j]];
  }
  return 1;
}
// Trabajos que el cliente nombra, con cantidades
function trabajosNombrados(t) {
  const c = {};
  const enchufeRe = /^(enchufes?|tomacorrientes?|interruptor(es)?|teclas?|llaves? de luz)$/;
  if (/(enchufe|tomacorriente|interruptor|tecla|llave de luz)/.test(t)) {
    if (/(agregar|poner|sumar|instalar|nuevo|nuevos|mas enchufes|otro enchufe)/.test(t)) c.enchufe = cantidadAntes(t, enchufeRe);
    else c.cambio = cantidadAntes(t, enchufeRe);
  }
  if (/(lampara|luminaria|plafon|aplique|spot|foco)/.test(t) && /(colocar|poner|instalar|cambiar|colgar)/.test(t)) c.lampara = cantidadAntes(t, /^(lamparas?|luminarias?|plafon(es)?|apliques?|spots?|focos?)$/);
  // Llaves y tablero: solo si quiere ponerlas o cambiarlas, o pregunta el precio ("me salta el disyuntor" es una falla)
  const pide = /(poner|instalar|cambiar|cambio|agregar|colocar|sumar|nuev|renovar|cuanto|precio|cobran|sale|cuesta)/.test(t);
  if (/termica/.test(t) && pide) c.termica = cantidadAntes(t, /^termicas?$/);
  if (/(disyuntor|diferencial)/.test(t) && pide) c.disyuntor = 1;
  if (/\baire\b/.test(t)) c.aire = cantidadAntes(t, /^aires?$/);
  if (/(revision|revisar todo|chequeo)/.test(t)) c.revision = 1;
  if (/tablero/.test(t) && pide) c.tablero = 1;
  return Object.keys(c).length ? c : null;
}

/* Fechas: "hoy", "mañana", "pasado mañana", "el lunes", "el 15", "15 de diciembre", "15/12" */
function reconocerFecha(t) {
  const sumar = (n) => { const d = new Date(hoy); d.setDate(d.getDate() + n); return d; };
  if (/\bpasado manana\b/.test(t)) return sumar(2);
  if (/\bmanana\b/.test(t) && !/\b(la|de|por|esta|toda la) manana\b/.test(t)) return sumar(1);
  let dia = -1, donde = -1;
  ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"].forEach((d, i) => {
    const m = fonetico(t).search(new RegExp(`\\b${fonetico(d)}\\b`));
    if (m > donde) { donde = m; dia = i; }
  });
  if (dia >= 0) { let n = (dia - hoy.getDay() + 7) % 7; if (n === 0) n = 7; return sumar(n); }
  let m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/);
  if (m) return armarFecha(+m[1], +m[2] - 1, m[3]);
  m = t.match(/\b(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b(?: del? (?:ano )?(\d{4}|\d{2})\b)?/);
  if (m) return armarFecha(+m[1], m[2] === "setiembre" ? 8 : MESES.indexOf(m[2]), m[3]);
  m = t.match(/\bel (\d{1,2})\b(?! (enchufe|toma|lampara|foco))/);
  if (m) return armarFecha(+m[1], null);
  return null;
}
function armarFecha(dia, mes, anio = null) {
  if (dia < 1 || dia > 31) return null;
  if (anio) { // "15 de diciembre de 2027", "15/12/27"
    const a = +anio < 100 ? 2000 + +anio : +anio;
    return new Date(a, mes, dia);
  }
  if (mes === null) { const d = new Date(hoy.getFullYear(), hoy.getMonth(), dia); return d > hoy ? d : new Date(hoy.getFullYear(), hoy.getMonth() + 1, dia); }
  const d = new Date(hoy.getFullYear(), mes, dia);
  return d > hoy ? d : new Date(hoy.getFullYear() + 1, mes, dia);
}

/* ===================== 4. El cerebro: decide qué responder ===================== */
const RE = {
  persona: /(le dio corriente|me dio corriente|nos dio corriente|lo agarro la corriente|la agarro la corriente|electrocut|descarga electrica|me dio una patada|le dio una patada|toco un cable|se quemo la mano)/,
  calle: /(cable caido|cable cortado en la calle|cables? de la calle|poste|columna de (luz|ute)|cable de ute|medidor|contador de luz|chispas en el poste|transformador)/,
  fuego: /(humo|chispa|fuego|llamas?\b|olor a quemado|huele a quemado|olor raro|se prendio fuego|se esta quemando|echa chispas)/,
  rendirse: /(no entiendo nada|no entiendo de eso|de eso no se|no se nada de|ni idea de (eso|electricidad)|no se de electricidad|no se mucho de|eso no lo entiendo|me perdi)/,
  aparato: /\b(tele|televisor|tv|heladera|freezer|lavarropas|secarropas|microondas|horno|computadora|compu|pc|notebook|monitor|celular|cargador|cafetera|plancha|secador|ventilador|estufa|calefon|termotanque|router|modem|play|consola|lavavajillas|parlante|aire acondicionado)\b/,
  roto: /(quem|rompi|no anda|no prende|no funciona|murio|se apago|exploto|fallo|dejo de|se jodio)/,
  instalacion: /(instalacion (electrica )?(completa|nueva|entera|toda)|rehacer (toda )?la instalacion|arreglar la instalacion|cablear (todo|toda|la casa)|cableado (nuevo|completo)|toda la instalacion|instalacion de (la|mi|un|una))/,
  caro: /\b(caro|carisimo|mucha plata|no tengo tanta plata|muy salado|un robo|es mucho|medio caro|re caro|zarpado)\b/,
  compara: /(otro|otra empresa|en otro lado|la competencia|mi vecino|un conocido).{0,30}(cobra|sale|cobraba|cobran|hace)|(mas barato en otro|me cobran menos)/,
  ahora: /\b(ahora|ya|dentro de un rato|en un rato|lo antes posible|cuanto antes|hoy)\b/,
  quiereVisita: /(venir|vengan|vengas|pasen|pasar por|turno|agend|reserv|coordinar|anotame)/,
  reprogramar: /(reprogram|cancel|anul|cambiar (el|mi|la) (turno|visita|fecha|reserva)|pasar (el|mi|la) (turno|visita)|mover (el|mi|la) (turno|visita)|no puedo (ir|el|ese dia)|me lo pasan)/,
  interior: /\b(interior|otros? departamentos?|fuera de montevideo)\b/
};
const FUERA = [
  [/(sanitari|plomer|perdida de agua|cano de agua|canilla|inodoro|cisterna|desagu|se tapo)/, "un <strong>sanitario</strong>", "Si el agua está cerca de enchufes o del tablero, <strong>cortá la luz de esa zona</strong> hasta que lo arreglen."],
  [/(gas|gasista|garrafa|estufa a gas|calefon a gas|cocina a gas)/, "un <strong>gasista matriculado</strong>", "Si sentís olor a gas, no prendas ni apagues nada eléctrico, abrí las ventanas y salí de la casa."],
  [/(albanil|pintur|pintar|revoque|humedad en la pared|azulejo|reforma de bano)/, "un <strong>albañil o pintor</strong>", ""],
  [/(camaras? de seguridad|alarma|portero|cerco electrico|antena|internet|wifi|fibra)/, "un <strong>técnico en seguridad o telecomunicaciones</strong>", ""],
  [/(instal\w* el (equipo de )?aire|colg\w* el aire|cargar gas del aire|\bsplit\b|instalacion del aire|el aire ya lo compre)/, null, ""]
];
const MOTIVOS = { sinluz: "Corte de luz", llave: "Salta la llave", noanda: "Enchufe o luz que no anda", urgencias: "Urgencia" };

function interpretar(original) {
  const t = limpiar(original);
  const lugar = ubicar(original);
  const fecha = reconocerFecha(t);
  const hora = reconocerHora(t);
  const franja = reconocerFranja(t);

  // 0. Otro idioma: aviso en inglés o portugués
  const idioma = detectarIdioma(original);
  if (idioma) return avisoIdioma(idioma);
  // Faltaba el barrio para cerrar una reserva
  if (memoria.pendiente && lugar) { memoria.lugar = lugar; return completarPendiente(); }
  // Respuestas indirectas a "¿los materiales los ponemos nosotros?"
  if (memoria.guiado?.paso === 2 && /(no hay nada abierto|no tengo tiempo|no se que comprar|no tengo auto|ustedes|traigan|lleven|ni idea de materiales)/.test(t)) return materialesEmpresa(true);
  // ¿Está respondiendo a una pregunta del asistente?
  if (responderOpcion(t)) return;

  // 1. Seguridad primero
  if (RE.persona.test(t)) return emergenciaPersona();
  if (RE.calle.test(t)) return cableCalle();
  if (RE.fuego.test(t)) return quemado();
  if (RE.rendirse.test(t)) return rendirse();

  // 2. Cosas que no hacemos
  for (const [re, quien, consejo] of FUERA) if (re.test(t)) return fueraDelRubro(quien, consejo);

  // 3. Aparatos rotos: no los reparamos, pero revisamos la instalación
  const ap = t.match(RE.aparato);
  if (ap && RE.roto.test(t) && !/aire acondicionado/.test(ap[1])) return repetido("aparato") || problemaAparato(ap[1]);
  if (/\bquem/.test(t)) return repetido("quemado-duda") || quemadoDudoso();

  const lugarNuevo = lugar && (!memoria.lugar || memoria.lugar.n !== lugar.n);
  if (lugar) memoria.lugar = lugar;
  if (/(jubilad|pensionad|\bbps\b)/.test(t)) memoria.jubilado = true;

  const temas = reconocer(t);
  const intencion = temas[0] || null;
  const problemaNombrado = temas.find((x) => MOTIVOS[x]);

  if (/(habl\w* (en )?(ingles|portugues)|in english|en ingles|en portugues|english|portugues)/.test(t)) return bot("Este asistente automático entiende <strong>solo español</strong>, pero por WhatsApp te atendemos también en <strong>inglés y portugués</strong> 🌎 <a href=\"#\" class=\"js-tel-chat\">Escribir por WhatsApp</a>");

  // 4. Materiales, lista y presupuesto total
  if (/(yo compro|los compro|compro yo|compro los materiales|los consigo yo|los compro yo)/.test(t)) {
    materialesCliente();
    if (fecha && /(agend|turno|venir|vengan|reserv|para el)/.test(t)) agendarCon(fecha, hora, franja);
    return;
  }
  if (/(que los pongan ustedes|los ponen ustedes|traiganlos|llevenlos|pongan ustedes los materiales)/.test(t)) return materialesEmpresa();
  if (/(lista de materiales|que tengo que comprar|dame una lista|pasame la lista|que materiales)/.test(t)) return listaMateriales();
  if (/(presupuesto (total|completo|final)|que precisas saber|que necesitas saber|armame (el|un) presupuesto|cuanto seria (todo|en total)|total con todo|haceme (el|un) presupuesto)/.test(t)) return presupuestoGuiado();
  // Cambiar una reserva hecha en este chat
  const cod = (t.match(/\bvt ?(\d{4})\b/) || [])[1];
  if (cod && reprogramarConCodigo("VT-" + cod)) return;
  if (memoria.reprogramando && (fecha || hora)) return agendarCon(fecha || memoria.reservas[memoria.reprogramando].fecha, hora, franja);

  // 5. Instalación completa de un ambiente, monoambiente o casa
  if (RE.instalacion.test(t) || /(monoambiente|cablear)/.test(t)) return instalacionCompleta(t);

  // 5. Objeciones de precio y descuentos
  if (RE.compara.test(t) && (temas.includes("precios") || /cobra|barato|mitad|menos/.test(t))) return comparacion();
  if (RE.caro.test(t)) return objecionPrecio();
  if (temas.includes("descuentos") || memoria.jubilado && /(descuento|algo|tienen)/.test(t)) return descuentos();
  if (RE.reprogramar.test(t) && /(turno|visita|reserva|vt \d{4}|cancel|reprogram|me lo pasan)/.test(t) || /\bvt ?\d{4}\b/.test(t)) return reprogramar(t);

  if (RE.interior.test(t) && !lugar) return interior();
  if (temas.includes("tiempos")) return tiempos(trabajosNombrados(t));
  const INFO = ["incluye", "pago", "materiales", "factura", "garantia", "horarios", "comercio", "persona", "servicios", "bot"];
  // La información pedida gana solo si es el tema principal (o el segundo, detrás de "agendar": "¿qué incluye la visita?")
  const infoPedida = INFO.includes(temas[0]) ? temas[0] : (temas[0] === "agendar" && INFO.includes(temas[1]) ? temas[1] : null);

  // 6. Preguntas por la visita de diagnóstico o por un presupuesto por escrito
  if (/(cuanto|precio|cobran|sale|cuesta|vale)/.test(t) && /(visita|diagnostico|revision para|saber que paso|ver que paso|que tiene)/.test(t)) return rendirse();
  if (/(por escrito|presupuesto formal|en pdf|mandamelo|me lo mandas)/.test(t)) return presupuestoEscrito();

  // 7. Quiere que vayan (o solo nombró un día). Si preguntó otra cosa concreta, eso va primero.
  const trabajos = trabajosNombrados(t);
  const pideVisita = RE.quiereVisita.test(t) || (temas.includes("agendar") && !infoPedida);
  const apuro = RE.ahora.test(t) && memoria.cantidades && !intencion;
  if (pideVisita || (fecha && (!intencion || !infoPedida)) || apuro) {
    // El problema nombrado solo reemplaza el motivo si es el tema principal (no pisa "instalación completa")
    if (problemaNombrado && (!memoria.motivo || temas[0] === problemaNombrado)) memoria.motivo = MOTIVOS[problemaNombrado];
    if (trabajos) { guardarTrabajos(trabajos); memoria.motivo = describirTrabajos(trabajos); }
    if (/\bhoy\b/.test(t) && !memoria.urgente) return turnosDeHoy(hora, franja);
    if (RE.ahora.test(t) && !fecha) return loAntesPosible();
    if (fecha && (hora || franja || memoria.lugar)) return agendarCon(fecha, hora, franja);
    return agendar(fecha);
  }

  if (trabajos && !RE.roto.test(t)) return presupuesto(trabajos);
  if (infoPedida) return responderInfo(infoPedida);

  // 8. Precios (con lo que haya nombrado ya cargado)
  if (temas.includes("precios") || (trabajos && !RE.roto.test(t))) return presupuesto(trabajos);

  if (lugarNuevo && ["chau", "gracias", "saludo", undefined, null].includes(intencion)) return confirmarLugar(lugar, intencion);

  // 9. Solo nombró un lugar
  if (lugar && (!intencion || intencion === "zonas")) return respuestaLugar(lugar);

  return responderInfo(intencion, fecha, lugar);
}
function responderInfo(intencion, fecha = null, lugar = null) {
  switch (intencion) {
    case "sinluz": return repetido("sinluz") || sinLuz();
    case "llave": return repetido("llave") || saltaLlave();
    case "noanda": return repetido("noanda") || noAnda();
    case "urgencias": return urgencias();
    case "horarios": return info("horarios", [
      `Hacemos visitas de <strong>lunes a sábado, de ${NEGOCIO.abre}:00 a ${NEGOCIO.cierra}:00</strong>. Las urgencias, <strong>todos los días las 24 horas</strong>, también domingos y feriados.`,
      `Visitas: lunes a sábado de ${NEGOCIO.abre} a ${NEGOCIO.cierra} h. Urgencias: las 24 horas, todos los días 💪`
    ]);
    case "zonas": return info("zonas", [
      `Trabajamos en <strong>Montevideo y Ciudad de la Costa</strong>. Sin costo de traslado en ${BARRIOS.slice(0, -1).join(", ")} y ${BARRIOS.at(-1)}; en el resto de Montevideo, ${pesos(NEGOCIO.traslado)} de traslado. Al resto del interior no llegamos, salvo trabajos grandes cerca de la Costa.${memoria.lugar ? "" : " ¿En qué barrio estás?"}`,
      `Cubrimos todo Montevideo y Ciudad de la Costa (Canelones). Decime tu barrio y te digo si hay costo de traslado.`
    ]);
    case "garantia": return info("garantia", [
      "Todos los trabajos tienen <strong>6 meses de garantía por escrito</strong>, precio cerrado antes de empezar y factura. Llevamos 15 años en el oficio.",
      "Tranqui: cada trabajo lleva 6 meses de garantía por escrito. Si algo falla en ese tiempo, volvemos sin costo 🔧"
    ]);
    case "pago": return info("pago", [
      `Se paga <strong>al terminar el trabajo</strong>, como prefieras:<ul><li>Efectivo</li><li>Transferencia bancaria</li><li>Débito o crédito con <strong>POS portátil</strong> (Visa, Mastercard, OCA, Creditel y Cabal)</li><li>Mercado Pago con QR</li></ul>En trabajos de más de ${pesos(NEGOCIO.minimoCuotas)}: hasta <strong>${NEGOCIO.cuotas} cuotas sin recargo</strong>, o <strong>10 % de descuento</strong> en efectivo o transferencia.`,
      `Aceptamos efectivo, transferencia, tarjetas (llevamos POS) y Mercado Pago. Pagás al terminar. Si el trabajo pasa los ${pesos(NEGOCIO.minimoCuotas)}, tenés ${NEGOCIO.cuotas} cuotas sin recargo o 10 % menos en efectivo.`
    ]);
    case "materiales": return info("materiales", [
      `Nuestros precios son de <strong>mano de obra</strong>. Los materiales los podemos llevar nosotros (al precio de lista, sin recargo) o los comprás vos con la lista que te pasamos.${memoria.cantidades?.mono ? ` Para tu monoambiente andan en unos <strong>${pesos(NEGOCIO.materialesMono)}</strong>.` : ""}`,
      "Los materiales van aparte de la mano de obra. Elegís: los llevamos nosotros o te pasamos la lista para que los compres."
    ]);
    case "tiempos": return tiempos();
    case "factura": return info("factura", [
      "Sí, hacemos <strong>factura oficial</strong>. Si es para una empresa o comercio, con tu <strong>RUT</strong>.",
      "Claro, siempre con factura. Para empresas, pasanos el RUT y la hacemos a nombre del comercio."
    ]);
    case "incluye": return info("incluye", [
      `La visita (${pesos(NEGOCIO.visita)}) incluye el diagnóstico y los <strong>arreglos menores en el momento</strong>: reconectar, ajustar un cable flojo o una conexión suelta. Si hay que cambiar una pieza, te pasamos el <strong>precio cerrado antes</strong>. Y si hacemos el trabajo, <strong>la visita se descuenta</strong>.`,
      "Pensalo así: si encontramos el problema y lo arreglamos, la visita te sale gratis porque se descuenta. Los arreglos menores van incluidos; las piezas, aparte."
    ]);
    case "comercio": memoria.comercio = true; return info("comercio", [
      `¡Trabajamos con comercios y oficinas! Hacemos <strong>factura con RUT</strong>, podemos ir <strong>fuera del horario comercial</strong> para que no cierres, y te mandamos un <strong>presupuesto formal por escrito</strong> válido por ${NEGOCIO.validezPresupuesto} días. ¿Qué necesitás hacer?`
    ]);
    case "persona": return info("persona", [
      'Claro, te paso con alguien del equipo: <a href="#" class="js-tel-chat">Escribir por WhatsApp</a>',
      'Si preferís hablar con una persona: <a href="#" class="js-tel-chat">WhatsApp de Voltio</a>'
    ]);
    case "servicios": return info("servicios", [
      'Hacemos urgencias, tableros, instalaciones nuevas o completas, iluminación, líneas para aire acondicionado y revisiones preventivas. <a href="servicios.html">Ver servicios y precios →</a>',
      'Todo lo eléctrico de la casa o el local: desde cambiar un enchufe hasta rehacer la instalación completa. <a href="servicios.html">Mirá el detalle →</a>'
    ]);
    case "bot": return info("bot", [
      "Soy un asistente automático 🤖 No soy una persona, pero te ayudo con lo básico: problemas, precios y turnos. Si preferís, te paso con alguien del equipo.",
      "Te soy sincero: soy un asistente automático. Para algo más específico, te paso con una persona cuando quieras."
    ]);
    case "saludo": return bot(variar("saludo", ["¡Hola! 👋 ¿En qué te puedo ayudar?", "¡Buenas! Contame qué necesitás y lo vemos.", "¡Hola! ¿Qué está pasando con la instalación?"]));
    case "gracias": return bot(variar("gracias", ["¡De nada! Cualquier cosa, acá estoy ⚡", "¡Un placer! Si necesitás algo más, escribime.", "¡Con gusto! 🙌"]));
    case "chau": if (memoria.ultimaReserva) { const rv = memoria.reservas[memoria.ultimaReserva]; return bot(`¡Joya! ${rv.urgente ? "Ya estamos en camino 🚐⚡" : `Nos vemos el <strong>${fechaCorta(rv.fecha)}</strong> 👋`} Tu código es <strong>${memoria.ultimaReserva}</strong>: si algo cambia, avisanos al ${NEGOCIO.telefono}. ¡Gracias por elegir Voltio! 💛`); }
      return bot(variar("chau", ["¡Que tengas buen día! 👋 Cualquier cosa, acá estoy ⚡", "¡Chau! Si vuelve a pasar algo, escribime 👋"]));
    case "precios": return presupuesto();
    case "descuentos": return descuentos();
    case "agendar": return agendar(fecha);
  }
  if (lugar) return respuestaLugar(lugar);
  return noEntendi();
}
function interior() {
  memoria.ultimaIntencion = "interior";
  bot(`Trabajamos en <strong>Montevideo y Ciudad de la Costa</strong> (Canelones). Al resto del interior no llegamos 😕 salvo trabajos grandes cerca de la Costa (Pando, Las Piedras, La Paz, Atlántida): esos los coordinamos por WhatsApp.<br>¿En qué barrio o ciudad estás?`);
}
// El cliente dice su barrio al final ("nos vemos el martes, en La Teja")
function confirmarLugar(lugar, intencion) {
  memoria.ultimaIntencion = "lugar";
  const agendaAbierta = typeof reserva !== "undefined" && reserva.dia && agenda; // en servicios.html no hay agenda
  if (agendaAbierta && lugar.tipo !== "interior") { campoBarrio.value = lugar.n; campoBarrio.dispatchEvent(new Event("input")); }
  const cierre = agendaAbierta ? `<br>Ya lo cargué en tu reserva del <strong>${fechaCorta(reserva.dia)}</strong>: solo te falta elegir la hora y confirmar 👍` : "";
  bot(textoCobertura(lugar) + cierre + (["chau", "gracias"].includes(intencion) ? "<br>¡Nos vemos! 👋⚡" : ""));
}

/* ===================== 5. Respuestas ===================== */
// Información: si pregunta lo mismo dos veces seguidas, no se repite
function info(clave, frases) {
  if (memoria.ultimaIntencion === clave) return bot("Eso te lo conté recién 👆 ¿Te ayudo con otra cosa?");
  memoria.ultimaIntencion = clave; memoria.sinEntender = 0;
  bot(variar(clave, frases));
}
// Si repite el mismo problema, no se le hace la misma pregunta otra vez
function repetido(clave) {
  if (memoria.ultimaIntencion !== clave) return false;
  const lista = memoria.opciones;
  bot("Eso ya lo estamos viendo 👆 Elegí una de las opciones o contame algo más.", () => lista.length && ofrecer(lista));
  return true;
}
function respuestaLugar(lugar) {
  memoria.ultimaIntencion = "lugar";
  const extra = { cubierto: " ¿Querés que agendemos una visita?", traslado: " ¿Agendamos?", cerca: "", interior: "" }[lugar.tipo];
  bot(textoCobertura(lugar) + extra, () => {
    if (lugar.tipo === "cubierto" || lugar.tipo === "traslado") ofrecer([["📅 Sí, agendar", () => agendar(), "", "si"]]);
    if (lugar.tipo === "cerca") ofrecer([["💬 Consultar por WhatsApp", () => info("persona", ['Dale: <a href="#" class="js-tel-chat">Escribir por WhatsApp</a>']), "", "si"]]);
  });
}

/* --- Seguridad --- */
function emergenciaPersona() {
  memoria.ultimaIntencion = "persona-emergencia"; memoria.motivo = "Revisar enchufe tras una descarga"; memoria.urgente = true;
  bot(`🚨 <strong>Lo primero es la persona:</strong><ol><li>Si sigue en contacto con la corriente, <strong>no la toques</strong>: bajá la llave general.</li><li>Si está inconsciente, le cuesta respirar o tiene quemaduras, <strong>llamá ya al 911</strong>.</li><li>Aunque parezca estar bien, consultá a un médico.</li></ol>Cuando esté atendida, vamos a revisar ese enchufe como urgencia. ¿Cómo está?`, () => ofrecer([
    ["Está bien, solo se asustó", () => bot("¡Qué alivio! 🙏 No uses ese enchufe y tapalo si podés. Te recomendamos una revisión hoy mismo, y ver si tu tablero tiene <strong>disyuntor</strong>: es lo que corta la luz justamente en estos casos.", () => ofrecer([["🚨 Que vengan hoy", urgencias, "opcion--urgente", "si"], ["📅 Agendar revisión", () => agendar()]])), "", "si"],
    ["Necesita ayuda médica", () => bot("Llamá al <strong>911</strong> ahora. Nosotros esperamos: cuando todo esté bien, escribinos y vamos a revisar la instalación 🙏"), "", "no"]
  ]));
}
function cableCalle() {
  memoria.ultimaIntencion = "calle";
  bot("🚨 <strong>No te acerques ni lo toques</strong>, aunque parezca apagado. Los cables de la calle, los postes y el medidor son responsabilidad de <strong>UTE</strong>: avisales de inmediato. Si hay chispas o fuego, llamá al <strong>104 (Bomberos)</strong>.<br>Si después de eso tenés problemas dentro de tu casa, acá estoy 💪");
}
function quemado() {
  memoria.ultimaIntencion = "quemado"; memoria.motivo = "Olor a quemado o chispas"; memoria.urgente = true;
  resultado("rojo", "Riesgo de incendio", ["Bajá la llave general ya mismo.", "No toques el enchufe ni el cable que huele a quemado.", "Si hay humo o fuego, llamá al 104 (Bomberos)."], "Olor a quemado o chispas", true);
}
function fueraDelRubro(quien, consejo) {
  memoria.ultimaIntencion = "fuera";
  if (!quien) { // aire acondicionado: la línea sí, el equipo no
    return bot(`La <strong>conexión eléctrica</strong> del aire sí la hacemos: la <strong>línea exclusiva</strong> (${pesos(6500)}). La instalación del equipo (colgarlo, la cañería y el gas) la hace un técnico de aire acondicionado. Muchos clientes coordinan los dos el mismo día 😉`, () => ofrecer([["💲 Presupuesto de la línea", () => presupuesto({ aire: 1 }), "", "si"], ["📅 Agendar", () => agendar()]]));
  }
  bot(`Ahí no te puedo ayudar, perdoná 😕 Nosotros hacemos <strong>solo trabajos eléctricos</strong>: para eso necesitás ${quien}.${consejo ? "<br>" + consejo : ""}`);
}

/* --- Diagnóstico guiado --- */
const EXPLICA_TABLERO = "El <strong>tablero</strong> es una cajita con varias llaves en fila, que suele estar cerca de la puerta de entrada, en la cocina o en un pasillo. Cada llave controla una parte de la casa.";
function problema() {
  memoria.ultimaIntencion = "problema";
  bot("Contame, ¿qué está pasando?", () => ofrecer([
    ["Me quedé sin luz", sinLuz], ["Salta la llave", saltaLlave], ["Olor a quemado o chispas", quemado],
    ["Un enchufe o luz no anda", noAnda], ["Se rompió un aparato", () => problemaAparato()]
  ]));
}
function sinLuz() {
  memoria.ultimaIntencion = "sinluz"; memoria.motivo = "Corte de luz"; memoria.urgente = true;
  bot(variar("sinluz", ["Uh, quedarse sin luz es un embole. Tranqui, lo vemos en dos preguntas 💪<br>¿Tus vecinos tienen luz?", "Vamos a ver qué pasa. Primero: ¿los vecinos tienen luz? Fijate si hay luces prendidas al lado o en la calle."]), () => ofrecer([
    ["Sí, solo yo estoy sin luz", tableroPregunta, "", "si"],
    ["No, todo el barrio está sin luz", () => resultado("verde", "Corte general de UTE", ["El problema no es tu instalación: consultá a UTE.", "Bajá la llave general y volvé a subirla cuando vuelva la luz, para cuidar tus aparatos."], "", false, true), "", "no"],
    ["No sé / no veo", () => bot("Mirá si el alumbrado de la calle está prendido o preguntale a un vecino. Si no podés fijarte, seguimos igual 👇", tableroPregunta), "", "nose"]
  ]));
}
function tableroPregunta() {
  bot(`Ahora andá a tu <strong>tablero eléctrico</strong> y fijate las llaves: ¿alguna está <strong>bajada</strong> o distinta a las demás?`, () => ofrecer([
    ["Hay una o más bajadas", () => resultado("amarillo", "Corte en tu instalación", ["Subí la llave general y el disyuntor una sola vez.", "Si vuelven a bajar, no insistas: hay una falla que hay que revisar."], "Corte de luz, saltó el tablero"), "", "si"],
    ["Están todas arriba", () => resultado("rojo", "Falla en la entrada de energía", ["No abras ni toques el tablero.", "Llamanos: puede ser un problema en la acometida."], "Sin luz con el tablero arriba", true), "", "no"],
    ["No encuentro el tablero", rendirse, "", "nose"]
  ], EXPLICA_TABLERO));
}
function rendirse() {
  memoria.ultimaIntencion = "rendirse";
  if (!memoria.motivo || memoria.motivo === "Corte de luz") memoria.motivo = memoria.urgente ? "Sin luz: diagnóstico de la falla" : "Diagnóstico de falla eléctrica";
  const precio = precioVisitaAhora();
  bot(`¡No pasa nada! Para eso estamos 😊 No hace falta que toques nada.<br>Lo mejor es una <strong>visita de diagnóstico: ${pesos(NEGOCIO.visita)}</strong>. Encontramos la falla, los arreglos menores van incluidos y, si hay que cambiar algo, te pasamos el precio cerrado antes. <strong>Si hacemos el trabajo, la visita se descuenta.</strong>${fueraDeHorario() ? `<br>Ahora estamos fuera de horario: como urgencia, la visita queda en ${pesos(precio)}.` : ""}`, () => ofrecer([
    ["🚨 Que vengan ahora", urgencias, "opcion--urgente", "si"], ["📅 Agendar para más tarde", () => agendar()], ["💲 Ver otros precios", () => presupuesto()]
  ]));
}
function saltaLlave() {
  memoria.ultimaIntencion = "llave"; memoria.motivo = "Salta la llave";
  bot(variar("llave", ["¿Salta al enchufar o prender algo en particular?", "Entiendo. ¿Pasa cuando usás algún aparato en especial?"]), () => ofrecer([
    ["Sí, con un aparato", () => resultado("verde", "Probablemente sea el aparato", ["Desenchufá ese aparato y subí la llave.", "Si no vuelve a saltar, el problema está en el aparato y no en tu instalación."], "Salta la llave con un aparato"), "", "si"],
    ["No, salta sola", () => resultado("amarillo", "Hay que revisar la instalación", ["Puede ser humedad o un cable dañado.", "Evitá usar los enchufes de esa zona hasta que lo revisemos."], "Salta la llave sin motivo"), "", "no"],
    ["No sé", () => resultado("amarillo", "Conviene revisarlo", ["Anotá cuándo salta: a qué hora y qué estaba prendido.", "Con eso lo encontramos más rápido en la visita."], "Salta la llave"), "", "nose"]
  ]));
}
function quemadoDudoso() {
  memoria.ultimaIntencion = "quemado-duda";
  bot("¿Ahora mismo ves humo o chispas, o sentís olor a quemado?", () => ofrecer([
    ["Sí", quemado, "opcion--urgente", "si"],
    ["No, se quemó un aparato", () => problemaAparato(), "", "no"],
    ["No, se quemó un enchufe o la llave", () => resultado("amarillo", "Hay que cambiarlo y revisar", ["No uses ese enchufe ni lo que esté conectado ahí.", "Un enchufe quemado suele indicar un mal contacto o una sobrecarga."], "Enchufe o llave quemada", false, false, { cambio: 1 })]
  ]));
}
function noAnda() {
  memoria.ultimaIntencion = "noanda"; memoria.motivo = "Enchufe o luz que no anda";
  bot("¿Es uno solo o son varios?", () => ofrecer([
    ["Uno solo", () => resultado("verde", "Trabajo simple", ["Suele ser un enchufe o interruptor gastado.", "Lo cambiamos en la visita y queda funcionando."], "Enchufe o interruptor que no anda", false, false, { cambio: 1 }), "", "si"],
    ["Varios", () => resultado("amarillo", "Puede ser un circuito", ["Fijate si alguna llave del tablero está baja.", "Si están todas arriba, hay que revisar ese circuito."], "Varios enchufes o luces sin funcionar")]
  ]));
}
function problemaAparato(cual = "") {
  memoria.ultimaIntencion = "aparato";
  const nombre = cual ? `tu ${{ tv: "tele", televisor: "tele", compu: "compu", pc: "compu", calefon: "calefón" }[cual] || cual}` : "ese aparato";
  bot(`${variar("aparato", ["Uy, qué mala suerte", "Qué macana", "Uh, qué bajón"])} con ${nombre} 😕 Nosotros no reparamos aparatos, pero sí revisamos si la causa fue la instalación.<br>Cuando pasó, ¿hubo un corte de luz, saltó la llave o se vio una chispa en el enchufe?`, () => ofrecer([
    ["Sí, pasó algo de eso", () => resultado("amarillo", "Pudo ser una subida de tensión", ["No enchufes otros aparatos en ese enchufe hasta revisarlo.", "Te recomendamos un protector de tensión para cuidar el resto de tus equipos."], `Revisar instalación tras falla de ${cual || "un aparato"}`), "", "si"],
    ["No, solo dejó de andar", () => resultado("verde", "Probablemente sea una falla del aparato", ["Para repararlo, consultá a un técnico de ese aparato.", "Si querés estar tranquilo, revisamos el enchufe en una visita."], "Revisar enchufe"), "", "no"]
  ]));
}
function resultado(color, titulo, pasos, motivoVisita, esUrgente = false, sinVisita = false, sugerido = null) {
  const nivel = { rojo: "Urgente", amarillo: "Pronto", verde: "Sin apuro" }[color];
  if (motivoVisita) memoria.motivo = motivoVisita;
  bot(`<div class="semaforo semaforo--${color}"><i></i>${nivel}: ${titulo}</div>
       <strong>Qué hacer ahora:</strong><ul>${pasos.map((p) => `<li>${p}</li>`).join("")}</ul>`, () => {
    const lista = [];
    if (esUrgente) lista.push(["📞 Llamar a urgencias", urgencias, "opcion--urgente", "si"]);
    if (!sinVisita) {
      lista.push(["📅 Agendar visita", () => agendar(), "", esUrgente ? "" : "si"]);
      lista.push(["💲 Ver presupuesto", () => presupuesto(sugerido)]);
    }
    if (lista.length) ofrecer(lista);
  });
}
function urgencias() {
  memoria.ultimaIntencion = "urgencias";
  if (!memoria.motivo) memoria.motivo = "Urgencia";
  const fuera = fueraDeHorario();
  bot(`🚨 Para urgencias vamos <strong>en menos de una hora</strong>, las 24 horas.${memoria.lugar && memoria.lugar.tipo !== "interior" ? ` ${textoCobertura(memoria.lugar)}` : ""}<br>Visita de urgencia: <strong>${pesos(precioVisitaAhora())}</strong>${fuera ? " (con el recargo fuera de horario)" : ""}. Se descuenta si hacemos el trabajo.<br><a href="#" class="js-tel-chat">📞 Llamar al ${NEGOCIO.telefono}</a> · <a href="#" class="js-tel-chat">💬 Mandar ubicación por WhatsApp</a><br>Mientras esperás: si hay olor a quemado o chispas, bajá la llave general.`, () => ofrecer([["✅ Sí, que vengan ahora", reservaUrgente, "opcion--urgente", "si"], ["No es tan urgente, quiero agendar", () => agendar()]]));
}

/* --- Presupuestos, descuentos y objeciones --- */
function guardarTrabajos(c) { memoria.cantidades = { ...(memoria.cantidades || {}), ...c }; }
function describirTrabajos(c) {
  const lista = TRABAJOS.filter((t) => c[t.id]);
  const suma = lista.reduce((s, t) => s + c[t.id] * t.precio, 0);
  return lista.map((t) => `${c[t.id]} × ${t.nombre.toLowerCase()}`).join(", ") + ` (${lista.some((t) => t.desde) ? "desde " : ""}${pesos(suma)})`;
}
function presupuestoEscrito() {
  memoria.ultimaIntencion = "escrito";
  bot(`¡Claro! Te lo mandamos por WhatsApp como <strong>presupuesto formal</strong>, válido por ${NEGOCIO.validezPresupuesto} días${memoria.total ? ` (total estimado: ${pesos(memoria.total)})` : ""}. Si es para una empresa, pasanos el nombre y el <strong>RUT</strong> y lo hacemos a tu nombre.<br><a href="#" class="js-tel-chat">📄 Recibir el presupuesto por WhatsApp</a>`);
}
function instalacionCompleta(t) {
  memoria.ultimaIntencion = "instalacion";
  const conEnchufes = /(enchufe|tomacorriente|interruptor)/.test(t);
  const sugerido = {};
  let aviso = "";
  if (/monoambiente|apartamento chico|apto chico/.test(t)) {
    sugerido.mono = 1;
    aviso = "La instalación completa de un <strong>monoambiente</strong> incluye cableado nuevo en el ambiente, el baño y la kitchenette, hasta 6 enchufes y 3 puntos de luz.";
  } else if (/(casa|apartamento|apto|vivienda|toda la casa|dormitorios)/.test(t)) {
    memoria.motivo = "Cotizar instalación completa";
    return bot(`Para una casa o un apartamento, el precio depende del tamaño, así que lo cotizamos en una <strong>visita (${pesos(NEGOCIO.visita)}, se descuenta si hacemos el trabajo)</strong>. Como referencia, cada ambiente arranca en <strong>${pesos(9500)}</strong>.${conEnchufes ? " El cambio de enchufes ya va incluido en la instalación completa 😉" : ""}`, () => ofrecer([["📅 Agendar la visita", () => agendar(), "", "si"]]));
  } else {
    const n = cantidadAntes(t, /^(habitacion(es)?|cuartos?|dormitorios?|cocinas?|banos?|livings?|ambientes?|comedor(es)?)$/);
    sugerido.ambiente = n || 1;
    aviso = `La instalación completa de ${sugerido.ambiente > 1 ? sugerido.ambiente + " ambientes" : "un ambiente"} incluye cableado nuevo, hasta 4 enchufes y 2 puntos de luz por ambiente.`;
  }
  memoria.motivo = sugerido.mono ? "Instalación completa de monoambiente" : `Instalación completa (${sugerido.ambiente} ${sugerido.ambiente > 1 ? "ambientes" : "ambiente"})`;
  if (conEnchufes) aviso += " <strong>El cambio de los enchufes ya va incluido</strong>, así que no te lo cobramos dos veces 😉";
  bot(aviso);
  presupuesto(sugerido);
}
function presupuesto(sugerido = null) {
  memoria.ultimaIntencion = "precios"; memoria.sinEntender = 0;
  const cantidades = Object.fromEntries(TRABAJOS.map((t) => [t.id, (sugerido && sugerido[t.id]) || 0]));
  let fueraHorario = false;
  if (memoria.comercio && !memoria.avisoComercio) { memoria.avisoComercio = true; bot("Como es para tu local, podemos ir <strong>antes de las 9:00 o de noche</strong> para que no tengas que cerrar (de noche lleva el recargo del 50 %)."); }
  bot(sugerido ? "Te lo dejé cargado; podés sumar o quitar lo que necesites:" : variar("presu", ["Marcá lo que necesitás y te calculo al momento:", "Dale, armemos el presupuesto. Sumá lo que necesites:"]), () => {
    const caja = document.createElement("div");
    caja.className = "presu";
    caja.innerHTML = TRABAJOS.map((t) => `
      <div class="presu__fila" data-fila="${t.id}">
        <div>${t.nombre}<small>${t.desde ? "desde " : ""}${pesos(t.precio)}${t.max ? "" : " c/u"}</small></div>
        <div class="contador" data-id="${t.id}">
          <button type="button" data-paso="-1" aria-label="Quitar ${t.nombre}">−</button>
          <output aria-label="Cantidad de ${t.nombre}">0</output>
          <button type="button" data-paso="1" aria-label="Agregar ${t.nombre}">+</button>
        </div>
      </div>`).join("") + `
      <label class="presu__extra"><input type="checkbox"> Es urgencia fuera de horario (+50 %)</label>
      <div class="presu__total" aria-live="polite"><span>Total estimado</span><strong>$ 0</strong></div>
      <p class="presu__pagos"></p>
      <p class="presu__nota">Mano de obra; los materiales van aparte. Precio estimado: se confirma en la visita (${pesos(NEGOCIO.visita)}, se descuenta si hacemos el trabajo).</p>`;
    const total = caja.querySelector(".presu__total strong");
    const pagos = caja.querySelector(".presu__pagos");
    function actualizar() {
      let suma = 0, desde = false;
      const incluyeEnchufes = cantidades.mono || cantidades.ambiente;
      TRABAJOS.forEach((t) => {
        const n = cantidades[t.id];
        const gratis = t.id === "cambio" && incluyeEnchufes;
        if (!gratis) suma += n * t.precio;
        if (n && t.desde) desde = true;
        const c = caja.querySelector(`[data-id="${t.id}"]`);
        c.querySelector("output").textContent = n;
        c.querySelector('[data-paso="-1"]').disabled = n === 0;
        c.querySelector('[data-paso="1"]').disabled = t.max ? n >= t.max : n >= 20;
        caja.querySelector(`[data-fila="${t.id}"] small`).textContent = gratis && n ? "incluido en la instalación completa" : `${t.desde ? "desde " : ""}${pesos(t.precio)}${t.max ? "" : " c/u"}`;
      });
      if (fueraHorario) suma = Math.round(suma * (1 + NEGOCIO.recargo));
      memoria.total = suma; memoria.cantidades = { ...cantidades };
      total.textContent = (desde ? "desde " : "") + pesos(suma);
      const lineas = [];
      if (suma >= NEGOCIO.minimoDescuento) lineas.push(`Efectivo o transferencia (−10 %): <strong>${pesos(suma * (1 - NEGOCIO.descuentoEfectivo))}</strong>`);
      if (suma >= NEGOCIO.minimoCuotas) lineas.push(`Crédito en ${NEGOCIO.cuotas} cuotas sin recargo: <strong>${NEGOCIO.cuotas} × ${pesos(Math.ceil(suma / NEGOCIO.cuotas))}</strong>`);
      if (memoria.jubilado && suma) lineas.push(`Con descuento de jubilado (−10 %): <strong>${pesos(suma * (1 - NEGOCIO.descuentoJubilados))}</strong>`);
      pagos.innerHTML = lineas.join("<br>");
      pagos.hidden = !lineas.length;
    }
    caja.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-paso]");
      if (!b) return;
      cantidades[b.parentElement.dataset.id] += Number(b.dataset.paso);
      actualizar();
    });
    caja.querySelector("input").addEventListener("change", (e) => { fueraHorario = e.target.checked; actualizar(); });
    actualizar();
    agregar(caja);
    ofrecer([["📋 Presupuesto total (3 preguntas)", presupuestoGuiado], ["📅 Agendar con este presupuesto", () => {
      const elegidos = TRABAJOS.filter((t) => cantidades[t.id]).map((t) => `${cantidades[t.id]} × ${t.nombre.toLowerCase()}`);
      if (elegidos.length) memoria.motivo = `${elegidos.join(", ")} (${total.textContent})`;
      agendar();
    }, "", "si"], ["🏷️ ¿Hay descuentos?", descuentos]]);
  });
}
function descuentos() {
  memoria.ultimaIntencion = "descuentos";
  const t = memoria.total;
  let texto;
  if (t) {
    const lineas = [`Sobre tu presupuesto de <strong>${pesos(t)}</strong>:`];
    lineas.push(t >= NEGOCIO.minimoDescuento
      ? `• Pagando en <strong>efectivo o transferencia</strong>: <strong>${pesos(t * (1 - NEGOCIO.descuentoEfectivo))}</strong> (10 % menos).`
      : `• El 10 % por efectivo o transferencia es para trabajos de más de ${pesos(NEGOCIO.minimoDescuento)}; este no llega.`);
    lineas.push(memoria.jubilado
      ? `• Como <strong>jubilado</strong>: <strong>${pesos(t * (1 - NEGOCIO.descuentoJubilados))}</strong>, mostrando el carné o un recibo del BPS.`
      : "• Si sos <strong>jubilado</strong>, tenés 10 % de descuento mostrando el carné o un recibo del BPS.");
    lineas.push("Los descuentos <strong>no se acumulan</strong>: te aplicamos el que más te conviene 👍");
    texto = lineas.join("<br>");
    return bot(texto, () => ofrecer([["📅 Agendar", () => agendar(), "", "si"]]));
  }
  texto = `Tenemos dos descuentos:<br>• <strong>10 % pagando en efectivo o transferencia</strong>, en trabajos de más de ${pesos(NEGOCIO.minimoDescuento)}.<br>• <strong>10 % para jubilados</strong> en mano de obra, mostrando el carné o un recibo del BPS.<br>No se acumulan: aplicamos el que más te conviene. ¿Te armo el presupuesto para ver cuánto te queda?`;
  bot(texto, () => ofrecer([["💲 Sí, armar presupuesto", () => presupuesto(), "", "si"]]));
}
function objecionPrecio() {
  memoria.ultimaIntencion = "caro";
  if (memoria.total) {
    const t = memoria.total;
    const partes = ["Te entiendo 🙏 Algunas formas de que te salga menos:"];
    if (t >= NEGOCIO.minimoDescuento) partes.push(`• En efectivo o transferencia queda en <strong>${pesos(t * 0.9)}</strong>.`);
    if (t >= NEGOCIO.minimoCuotas) partes.push(`• Con crédito, en <strong>${NEGOCIO.cuotas} cuotas sin recargo</strong> de ${pesos(Math.ceil(t / NEGOCIO.cuotas))}.`);
    partes.push("• Si comprás vos los materiales, te pasamos la lista y te ahorrás ese costo.");
    partes.push("Y el precio incluye garantía de 6 meses por escrito y factura.");
    return bot(partes.join("<br>"), () => ofrecer([["📅 Agendar", () => agendar(), "", "si"], ["💬 Hablar con alguien", () => info("persona", ['Dale: <a href="#" class="js-tel-chat">Escribir por WhatsApp</a>'])]]));
  }
  bot(`Te entiendo 🙏 Pensalo así: <strong>si arreglamos el problema, la visita te sale gratis</strong>, porque esos ${pesos(NEGOCIO.visita)} se descuentan del trabajo. Además, los arreglos menores van incluidos y, si hay que cambiar algo, te decimos el precio antes de empezar.`, () => ofrecer([["📅 Bueno, agendar", () => agendar(), "", "si"], ["🏷️ ¿Hay descuentos?", descuentos]]));
}
function comparacion() {
  memoria.ultimaIntencion = "compara";
  bot("Comparar está bien 👍 Para que compares parejo: nuestro precio incluye <strong>mano de obra con precio cerrado, prueba de todos los circuitos, 6 meses de garantía por escrito y factura</strong>. Preguntale al otro si incluye eso, sobre todo la garantía.<br>En trabajos de electricidad, lo barato puede salir caro. Igual tenemos 10 % de descuento en efectivo y cuotas sin recargo en trabajos grandes.", () => ofrecer([["🏷️ Ver descuentos", descuentos, "", "si"], ["📅 Agendar", () => agendar()]]));
}
function tiempos(nombrados = null) {
  if (memoria.ultimaIntencion === "tiempos" && !nombrados) return bot("Eso te lo conté recién 👆");
  memoria.ultimaIntencion = "tiempos";
  const base = nombrados || memoria.cantidades;
  const elegidos = base ? TRABAJOS.filter((t) => base[t.id]) : [];
  if (elegidos.length) return bot(`Para lo que elegiste:<ul>${elegidos.map((t) => `<li>${t.nombre}: ${t.horas}</li>`).join("")}</ul>Te confirmamos el tiempo exacto en la visita.`);
  bot("Depende del trabajo:<ul><li>Cambiar un enchufe o una lámpara: menos de 1 hora.</li><li>Un tablero: 1 día.</li><li>Un ambiente completo: 1 día; un monoambiente, 1 o 2 días.</li></ul>Para urgencias, llegamos en menos de una hora.");
}
function reprogramar(t) {
  memoria.ultimaIntencion = "reprogramar";
  const codigo = (t.match(/\bvt ?(\d{4})\b/) || [])[1];
  bot(`${codigo ? `Anoté tu reserva <strong>VT-${codigo}</strong>. ` : ""}Podés <strong>cambiar o cancelar sin costo hasta ${NEGOCIO.cancelacion} horas antes</strong>. ${codigo ? "Escribinos por WhatsApp con el código y te la cambiamos al momento" : "Pasame tu código de reserva (empieza con VT) o escribinos por WhatsApp"}: <a href="#" class="js-tel-chat">Escribir por WhatsApp</a>`, () => ofrecer([["📅 Elegir otro día en la agenda", () => agendar(), "", "si"]]));
}

/* --- Agenda --- */
function loAntesPosible() {
  const urgente = memoria.urgente || /Corte|quemado|Urgencia|descarga/i.test(memoria.motivo);
  if (urgente) return urgencias();
  const largos = trabajoLargo();
  memoria.ultimaIntencion = "agendar";
  if (!largos) return turnosDeHoy();
  const dia = proximoDiaLibre(2);
  const hoyLibre = new Date().getDay() !== 0 ? libresDe(new Date(hoy))[0] : null;
  bot(`¡Jaja, serías de los primeros! 😄 Pero ojo, esto se hace en dos partes:<ol>${hoyLibre ? `<li><strong>La visita, hoy a las ${hoyLibre}</strong>: vemos el lugar, confirmamos el presupuesto y encargamos los materiales.</li>` : ""}<li><strong>El trabajo completo</strong> lleva dos días seguidos: arrancamos el <strong>${fechaCorta(dia)}</strong>.</li></ol>Mientras tanto podés usar la luz normalmente: no es una urgencia ✓`, () => ofrecer([
    hoyLibre ? [`✅ Visita hoy ${hoyLibre}`, () => reservar({ fecha: new Date(hoy), hora: hoyLibre }), "", "si"] : null,
    [`📅 Todo junto el ${fechaCorta(dia)}`, () => agendarCon(dia)]
  ].filter(Boolean)));
}
function agendar(fecha = null) {
  memoria.ultimaIntencion = "agendar"; memoria.sinEntender = 0;
  const partes = [];
  if (memoria.motivo) partes.push(`Anoté el motivo: <strong>${memoria.motivo}</strong>.`);
  if (memoria.lugar) {
    if (memoria.lugar.tipo === "interior") partes.push(textoCobertura(memoria.lugar));
    else partes.push(textoCobertura(memoria.lugar));
  }
  let fechaOk = null;
  if (fecha) {
    const estado = estadoDia(fecha);
    if (fecha <= hoy) partes.push("Para hoy no quedan visitas programadas: si es urgente, llamanos y vamos en el día. Si no, elegí otro día en el calendario.");
    else if (fecha > ultimoDiaAgenda) partes.push(`Esa fecha está un poco lejos: por ahora la agenda llega hasta diciembre de ${mesFinal.getFullYear()}.`);
    else if (fecha.getDay() === 0) partes.push(`El ${fecha.getDate()} de ${MESES[fecha.getMonth()]} cae domingo: ese día solo atendemos urgencias, así que te muestro el calendario para elegir otro.`);
    else if (estado === "rojo") partes.push(`El ${fechaCorta(fecha)} ya está completo 😕 Te muestro el calendario para que elijas otro día.`);
    else { fechaOk = fecha; partes.push(`Te marqué el <strong>${fechaCorta(fecha)}</strong>${estado === "amarillo" ? " (quedan pocos turnos)" : ""}: elegí la hora que te quede mejor 👉`); }
  }
  if (!fecha) partes.push(memoria.lugar && memoria.lugar.tipo !== "interior" ? "Te llevo a la agenda: elegí el día y la hora 👉" : "Te llevo a la agenda: escribí tu barrio y elegí día y hora 👉");
  const barrio = memoria.lugar && memoria.lugar.tipo !== "interior" ? memoria.lugar.n : null;
  bot(partes.join("<br>"), () => setTimeout(() => irAAgenda({ texto: memoria.motivo, barrio, fecha: fechaOk }), sinMovimiento ? 0 : 900));
}

/* --- Cuando no entiende: nunca cambia de tema --- */
function noEntendi() {
  memoria.sinEntender++;
  const lista = memoria.opciones;
  if (lista.length) return bot("No te entendí bien 🤔 Elegí una de las opciones o contámelo con otras palabras.", () => ofrecer(lista, memoria.explicacion));
  if (memoria.sinEntender === 1) return bot(variar("duda", ["Mmm, no estoy seguro de haber entendido 🤔 ¿Me lo contás con otras palabras?", "Perdón, no te entendí bien. ¿Me lo explicás de otra forma?"]));
  memoria.sinEntender = 0;
  bot('Sobre eso no tengo información, perdoná 😅 Lo mejor es que lo consultes con una persona del equipo: <a href="#" class="js-tel-chat">Escribir por WhatsApp</a>');
}

document.getElementById("chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const texto = campoChat.value.trim();
  if (!texto) return;
  agregar(escapar(texto), "yo");
  campoChat.value = "";
  interpretar(texto);
});

// Para pruebas: window.__entender("frase") muestra qué temas reconoce
window.__entender = (t) => ({ limpio: limpiar(t), temas: reconocer(limpiar(t)), lugar: ubicar(t), fecha: reconocerFecha(limpiar(t)) });
