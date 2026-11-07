/* Voltio: comportamiento de la página
   1. Utilidades compartidas (fechas, textos, ubicaciones)
   2. Teléfonos de demostración
   3. Agenda: barrio, calendario con disponibilidad y turnos
   El asistente está en asistente.js y los datos del negocio en datos.js */

const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 1. Utilidades ---------- */
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const TURNOS = ["8:00", "9:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

const pesos = (n) => "$\u00a0" + Math.round(n).toLocaleString("es-UY"); // espacio que no se corta
const normalizar = (t) => t.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const fechaLarga = (d) => `${mayuscula(DIAS[d.getDay()])} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
const fechaCorta = (d) => `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}` + (d.getFullYear() !== new Date().getFullYear() ? ` de ${d.getFullYear()}` : "");

// Encuentra un lugar en el texto aunque esté mal escrito ("malvin", "el la teja", "puntas carretas")
const LUGARES = [
  ...BARRIOS.map((n) => ({ n, tipo: "cubierto" })),
  ...COSTA.map((n) => ({ n, tipo: "cubierto" })),
  ...MONTEVIDEO.map((n) => ({ n, tipo: "traslado" })),
  ...CERCA.map((n) => ({ n, tipo: "cerca" })),
  ...INTERIOR.map((n) => ({ n, tipo: "interior" }))
].map((l) => ({ ...l, clave: normalizar(l.n) }));
const buscadorLugares = new Fuse(LUGARES, { keys: ["clave"], includeScore: true, threshold: 0.3, ignoreLocation: true });
function ubicar(texto) {
  const palabras = normalizar(texto).replace(/[^a-z0-9ñ ]/g, " ").split(/\s+/).filter(Boolean);
  let mejor = null;
  for (let largo = 4; largo >= 1; largo--) {
    for (let i = 0; i + largo <= palabras.length; i++) {
      const ventana = palabras.slice(i, i + largo).join(" ");
      if (ventana.length < 4) continue;
      for (const r of buscadorLugares.search(ventana).slice(0, 2)) {
        const parecido = ventana.length / r.item.clave.length;
        const mismoInicio = ventana.slice(0, 2) === r.item.clave.slice(0, 2);
        const limite = r.item.clave.length <= 7 ? 0.12 : 0.25;
        if (r.score < limite && mismoInicio && parecido > 0.75 && parecido < 1.35 && (!mejor || r.score < mejor.score)) mejor = r;
      }
    }
  }
  return mejor ? mejor.item : null;
}
// Texto de cobertura para cada tipo de lugar
function textoCobertura(lugar) {
  return {
    cubierto: `Llegamos a ${lugar.n} sin costo de traslado ✓`,
    traslado: `Llegamos a ${lugar.n} con un costo de traslado de ${pesos(NEGOCIO.traslado)}.`,
    cerca: `${lugar.n} ya es interior: llegamos solo para trabajos grandes, a coordinar por WhatsApp.`,
    interior: `Por ahora no llegamos a ${lugar.n} 😕 Trabajamos en Montevideo y Ciudad de la Costa.`
  }[lugar.tipo];
}

/* ---------- 2. Teléfonos de demostración ----------
   En la demo no se llama a nadie: el botón avisa qué haría en el sitio real. */
function telefonoDemo(boton) {
  const original = boton.innerHTML;
  boton.addEventListener("click", (e) => {
    e.preventDefault();
    boton.textContent = boton.dataset.demo || "Demo: en el sitio real se abre WhatsApp o la llamada";
    clearTimeout(boton._volver);
    boton._volver = setTimeout(() => (boton.innerHTML = original), 3000);
  });
}
document.querySelectorAll(".js-demo-tel").forEach(telefonoDemo);

/* ---------- 3. Agenda ---------- */
const agenda = document.getElementById("agenda");
const campoBarrio = document.getElementById("barrio");
const cobertura = document.getElementById("cobertura");
const calendario = document.getElementById("calendario");
const calDias = document.getElementById("cal-dias");
const mesTitulo = document.getElementById("mes-titulo");
const btnAnterior = document.getElementById("mes-anterior");
const btnSiguiente = document.getElementById("mes-siguiente");
const cajaHoras = document.getElementById("horas");
const grillaHoras = document.getElementById("horas-grilla");
const botonConfirmar = document.getElementById("confirmar");
const ayuda = document.getElementById("agenda-ayuda");
const motivo = document.getElementById("agenda-motivo");
const reserva = { barrio: "", conCosto: false, dia: null, hora: "", motivo: "" };
// En servicios.html no hay agenda: ahí solo se usan la disponibilidad y el asistente
if (agenda) [...BARRIOS, ...COSTA, ...MONTEVIDEO].sort((a, b) => a.localeCompare(b, "es"))
  .forEach((b) => document.getElementById("lista-barrios").insertAdjacentHTML("beforeend", `<option value="${b}">`));

campoBarrio?.addEventListener("input", () => {
  const texto = campoBarrio.value.trim();
  cobertura.className = "agenda__cobertura";
  reserva.barrio = ""; reserva.conCosto = false;
  if (normalizar(texto).length < 3) { cobertura.textContent = ""; return revisar(); }
  const lugar = ubicar(texto);
  if (!lugar) {
    cobertura.textContent = "No reconozco ese barrio. Si es en Montevideo, llegamos con costo de traslado.";
    cobertura.classList.add("no");
    reserva.barrio = texto; reserva.conCosto = true;
  } else {
    cobertura.textContent = textoCobertura(lugar);
    cobertura.classList.add(lugar.tipo === "cubierto" ? "si" : "no");
    if (lugar.tipo !== "interior") { reserva.barrio = lugar.n; reserva.conCosto = lugar.tipo !== "cubierto"; }
  }
  revisar();
});

// Disponibilidad simulada: cada fecha tiene una cantidad fija de turnos ocupados
const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
const semilla = (d) => (d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate()) * 2654435761 >>> 0;
const ocupados = (d) => [0, 2, 3, 4, 5, 6, 7, 9, 10, 12][semilla(d) % 10];
// Hoy siempre quedan algunos turnos libres, para que la demo muestre la reserva del mismo día
const turnoOcupado = (d, i) => ((i * 5 + semilla(d)) % 12) < (d.getTime() === hoy.getTime() ? Math.min(ocupados(d), 5) : ocupados(d));
function estadoDia(d) {
  if (d <= hoy || d.getDay() === 0) return "cerrado";
  const n = ocupados(d);
  return n >= 12 ? "rojo" : n >= 8 ? "amarillo" : "verde";
}
const turnosLibres = (d) => TURNOS.filter((t, i) => !turnoOcupado(d, i));
// Primer día con turnos (o días seguidos libres, para trabajos largos)
function proximoDiaLibre(seguidos = 1) {
  for (let i = 1; i < 60; i++) {
    const d = new Date(hoy); d.setDate(d.getDate() + i);
    let ok = true;
    for (let j = 0; j < seguidos && ok; j++) {
      const x = new Date(d); x.setDate(x.getDate() + j);
      ok = ["verde", "amarillo"].includes(estadoDia(x));
    }
    if (ok) return d;
  }
  return null;
}

const mesInicial = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
const mesFinal = new Date(hoy.getFullYear() + 1, 11, 1); // agenda abierta hasta diciembre del año que viene
const ultimoDiaAgenda = new Date(mesFinal.getFullYear(), 11, 31);
let mesVisible = new Date(mesInicial);

function dibujarMes() {
  const anio = mesVisible.getFullYear(), mes = mesVisible.getMonth();
  mesTitulo.textContent = `${MESES[mes]} ${anio}`;
  btnAnterior.disabled = mesVisible <= mesInicial;
  btnSiguiente.disabled = mesVisible >= mesFinal;
  calDias.innerHTML = "";
  const corrimiento = (new Date(anio, mes, 1).getDay() + 6) % 7; // la semana empieza el lunes
  for (let i = 0; i < corrimiento; i++) calDias.append(document.createElement("span"));
  const ultimo = new Date(anio, mes + 1, 0).getDate();
  for (let n = 1; n <= ultimo; n++) {
    const d = new Date(anio, mes, n);
    const estado = estadoDia(d);
    const b = document.createElement("button");
    b.type = "button"; b.textContent = n;
    b.className = "cal__dia" + (estado !== "cerrado" ? " cal__dia--" + estado : "");
    b.disabled = estado === "cerrado" || estado === "rojo";
    const textoEstado = { cerrado: d.getDay() === 0 ? "cerrado" : "no disponible", rojo: "completo", amarillo: "pocos turnos", verde: "disponible" }[estado];
    b.setAttribute("aria-label", `${DIAS[d.getDay()]} ${n} de ${MESES[mes]}, ${textoEstado}`);
    b.setAttribute("aria-pressed", String(!!reserva.dia && reserva.dia.getTime() === d.getTime()));
    if (!b.disabled) b.addEventListener("click", () => elegirDia(d));
    calDias.append(b);
  }
}
btnAnterior?.addEventListener("click", () => { mesVisible.setMonth(mesVisible.getMonth() - 1); dibujarMes(); });
btnSiguiente?.addEventListener("click", () => { mesVisible.setMonth(mesVisible.getMonth() + 1); dibujarMes(); });

function elegirDia(d, enfocar = true) {
  reserva.dia = d; reserva.hora = "";
  mesVisible = new Date(d.getFullYear(), d.getMonth(), 1);
  document.getElementById("horas-titulo").textContent = `${mayuscula(DIAS[d.getDay()])} ${d.getDate()} de ${MESES[d.getMonth()]}`;
  grillaHoras.innerHTML = "";
  TURNOS.forEach((t, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "hora"; b.textContent = t;
    b.disabled = turnoOcupado(d, i);
    b.setAttribute("aria-label", `${t} horas${b.disabled ? ", ocupado" : ""}`);
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => {
      reserva.hora = t;
      [...grillaHoras.children].forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      revisar();
    });
    grillaHoras.append(b);
  });
  calendario.hidden = true; cajaHoras.hidden = false;
  document.getElementById("paso-num").textContent = "3";
  document.getElementById("paso-texto").textContent = "Elegí el horario";
  if (enfocar) grillaHoras.querySelector("button:not(:disabled)")?.focus();
  revisar();
}
function verCalendario() {
  cajaHoras.hidden = true; calendario.hidden = false;
  document.getElementById("paso-num").textContent = "2";
  document.getElementById("paso-texto").textContent = "Elegí el día";
  dibujarMes();
}
document.getElementById("cambiar-dia")?.addEventListener("click", () => { verCalendario(); calDias.querySelector('[aria-pressed="true"]')?.focus(); });

function revisar() {
  const falta = !reserva.barrio ? "Escribí tu barrio." : !reserva.dia ? "Elegí un día en el calendario." : !reserva.hora ? "Elegí un horario." : "";
  botonConfirmar.disabled = !!falta;
  ayuda.textContent = falta || "Todo listo: confirmá tu visita.";
}

const nuevoCodigo = () => "VT-" + Math.floor(1000 + Math.random() * 9000);
botonConfirmar?.addEventListener("click", () => mostrarConfirmacion(nuevoCodigo()));
// Muestra la reserva confirmada en la tarjeta (la usa también el asistente)
function mostrarConfirmacion(codigo, extra = []) {
  if (!agenda) return;
  const desdeBoton = document.activeElement === botonConfirmar;
  const filas = [
    ["Fecha", fechaLarga(reserva.dia)],
    ["Hora", reserva.hora + " h"],
    ["Barrio", reserva.barrio + (reserva.conCosto ? " (con traslado)" : "")],
    ...extra
  ];
  if (reserva.motivo) filas.push(["Motivo", reserva.motivo]);
  document.getElementById("codigo").textContent = codigo;
  document.getElementById("resumen").innerHTML = filas.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join("");
  document.querySelector(".agenda__formulario").hidden = true;
  document.getElementById("agenda-listo").hidden = false;
  if (desdeBoton) document.getElementById("agenda-listo").focus();
}

document.getElementById("nueva-reserva")?.addEventListener("click", () => {
  Object.assign(reserva, { barrio: "", conCosto: false, dia: null, hora: "", motivo: "" });
  campoBarrio.value = ""; cobertura.textContent = ""; motivo.hidden = true;
  mesVisible = new Date(mesInicial);
  verCalendario(); revisar();
  document.getElementById("agenda-listo").hidden = true;
  document.querySelector(".agenda__formulario").hidden = false;
  campoBarrio.focus();
});
if (agenda) { dibujarMes(); revisar(); }

// Lo usa el asistente: abre la agenda con el motivo, el barrio y el día ya cargados
function irAAgenda({ texto = "", barrio = null, fecha = null } = {}) {
  if (!agenda) { // desde servicios.html: vuelve a la portada con los datos cargados
    const datos = new URLSearchParams();
    if (texto) datos.set("motivo", texto);
    if (barrio) datos.set("barrio", barrio);
    if (fecha) datos.set("fecha", `${fecha.getFullYear()}-${fecha.getMonth() + 1}-${fecha.getDate()}`);
    location.href = "index.html" + (datos.size ? "?" + datos : "") + "#agenda";
    return;
  }
  if (!document.getElementById("agenda-listo").hidden) document.getElementById("nueva-reserva").click();
  if (texto) { reserva.motivo = texto; motivo.textContent = "Motivo: " + texto; motivo.hidden = false; }
  if (barrio) { campoBarrio.value = barrio; campoBarrio.dispatchEvent(new Event("input")); }
  const sePuede = fecha && (estadoDia(fecha) === "verde" || estadoDia(fecha) === "amarillo");
  if (sePuede) elegirDia(fecha, false); else verCalendario();
  if (typeof cerrarChat === "function") cerrarChat(); // se minimiza para dejar ver la agenda
  agenda.scrollIntoView({ behavior: sinMovimiento ? "auto" : "smooth", block: "center" });
  agenda.classList.add("resaltada");
  setTimeout(() => agenda.classList.remove("resaltada"), 2200);
  setTimeout(() => (barrio ? (sePuede ? grillaHoras.querySelector("button:not(:disabled)") : calDias.querySelector("button:not(:disabled)")) : campoBarrio)?.focus({ preventScroll: true }), 450);
}

// Si llega desde servicios.html con datos (?motivo=…&barrio=…&fecha=…), abre la agenda ya cargada
if (agenda && location.search) {
  const datos = new URLSearchParams(location.search);
  const [a, m, d] = (datos.get("fecha") || "").split("-").map(Number);
  if (datos.has("motivo") || datos.has("barrio") || a) {
    irAAgenda({ texto: datos.get("motivo") || "", barrio: datos.get("barrio"), fecha: a ? new Date(a, m - 1, d) : null });
    history.replaceState(null, "", location.pathname + "#agenda");
  }
}
