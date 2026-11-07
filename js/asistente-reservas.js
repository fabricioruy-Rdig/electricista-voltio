/* Voltio: segunda parte del asistente.
   - Presupuesto guiado (3 preguntas) con resumen final y formas de pago
   - Lista de materiales para comprar
   - Reservas con código desde el chat (visitas, urgencias, trabajos de varios días)
   - Horas concretas ("a las 10"), franjas ("de tarde") y turnos de hoy
   - Cambio de turno con el código
   - Aviso en inglés y portugués */

/* ===================== Horas y franjas ===================== */
function reconocerHora(t) {
  let m = t.match(/\ba las (\d{1,2})(?:[:.](\d{2}))?\b/) || t.match(/\b(\d{1,2})(?:[:.](\d{2}))? ?(am|pm|hs|h|horas)\b/) || t.match(/\b(\d{1,2})[:.](\d{2})\b/);
  if (!m) return null;
  let h = +m[1];
  if (m[3] === "pm" && h < 12) h += 12;
  if (h < 8 && /de la tarde|pm/.test(t)) h += 12;
  return h >= 8 && h <= 19 ? `${h}:00` : null;
}
const FRANJAS = {
  manana: { nombre: "de mañana", horas: ["8:00", "9:00", "10:00", "11:00"] },
  mediodia: { nombre: "al mediodía", horas: ["12:00", "13:00"] },
  tarde: { nombre: "de tarde", horas: ["14:00", "15:00", "16:00", "17:00"] },
  noche: { nombre: "al final del día", horas: ["18:00", "19:00"] }
};
function reconocerFranja(t) {
  if (/\b(de|por|a) la manana\b|\bde manana\b|\btemprano\b/.test(t)) return "manana";
  if (/\bmediodia\b/.test(t)) return "mediodia";
  if (/\b(de|por|a) la tarde\b|\bde tarde\b|\bpasado el mediodia\b/.test(t)) return "tarde";
  if (/\b(de|a la|por la) noche\b|\bal final del dia\b|\bdespues del trabajo\b/.test(t)) return "noche";
  return null;
}
const indiceTurno = (hora) => TURNOS.indexOf(hora);
function libresDe(fecha, horas = TURNOS) {
  const ahora = horaActual();
  const esHoy = fecha.getTime() === hoy.getTime();
  return horas.filter((h) => !turnoOcupado(fecha, indiceTurno(h)) && (!esHoy || parseInt(h) > ahora));
}

/* ===================== Reservas desde el chat ===================== */
function trabajoLargo() {
  const c = memoria.cantidades || {};
  return !!(c.mono || (c.ambiente || 0) > 1);
}
// Pide el barrio si falta; si no, reserva
function reservar({ fecha, hora, urgente = false, codigo = null }) {
  if (!memoria.lugar || memoria.lugar.tipo === "interior") {
    memoria.pendiente = { fecha, hora, urgente, codigo };
    memoria.ultimaIntencion = "pide-barrio";
    return bot(urgente ? "¡Vamos! Decime en qué <strong>barrio</strong> estás y te confirmo." : `Perfecto, te guardo el <strong>${fechaCorta(fecha)} a las ${hora}</strong>. Me falta un solo dato: <strong>¿en qué barrio estás?</strong>`);
  }
  memoria.pendiente = null;
  const cod = codigo || nuevoCodigo();
  const dias = [fecha];
  if (!urgente && trabajoLargo()) {
    const siguiente = new Date(fecha); siguiente.setDate(siguiente.getDate() + 1);
    if (siguiente.getDay() === 0) siguiente.setDate(siguiente.getDate() + 1);
    dias.push(siguiente);
  }
  const traslado = memoria.lugar.tipo === "traslado" || memoria.lugar.tipo === "cerca" ? NEGOCIO.traslado : 0;
  const motivoTexto = memoria.motivo || (urgente ? "Urgencia" : "Visita de diagnóstico");
  const totalTexto = urgente ? pesos(precioVisitaAhora() + traslado) + " (visita de urgencia)" : memoria.resumenTotal ? pesos(memoria.resumenTotal + traslado) : memoria.total ? pesos(memoria.total + traslado) : `${pesos(NEGOCIO.visita + traslado)} (visita)`;
  memoria.reservas[cod] = { fecha, hora, dias, urgente };
  memoria.ultimaReserva = cod;
  memoria.ultimaIntencion = "reservado";

  // La tarjeta de la agenda también queda confirmada con el mismo código
  Object.assign(reserva, { barrio: memoria.lugar.n, conCosto: !!traslado, dia: fecha, hora: urgente ? "ahora" : hora, motivo: motivoTexto });
  mostrarConfirmacion(cod, dias.length > 1 ? [["Sigue", fechaLarga(dias[1])]] : []);

  const filas = [
    ["Trabajo", motivoTexto],
    ["Fecha", urgente ? "Hoy, en menos de una hora" : fechaLarga(fecha) + `, ${hora} h` + (dias.length > 1 ? ` (sigue el ${fechaCorta(dias[1])})` : "")],
    ["Barrio", memoria.lugar.n + (traslado ? ` (traslado ${pesos(traslado)})` : "")],
    memoria.materiales ? ["Materiales", memoria.materiales === "cliente" ? "Los comprás vos" : "Los llevamos nosotros"] : null,
    ["Total", totalTexto]
  ].filter(Boolean);
  const tabla = `<table class="tabla-chat">${filas.map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join("")}</table>`;
  if (urgente) {
    bot(`✅ <strong>Urgencia ${cod}</strong>${tabla}<a href="#" class="js-tel-chat">📞 Llamar y decir el código</a> · <a href="#" class="js-tel-chat">💬 Mandar ubicación por WhatsApp</a><br>Mientras esperás: si la llave general está arriba, <strong>bajala</strong>, así no se dañan los aparatos cuando vuelva la luz.`);
  } else {
    bot(`✅ <strong>Reserva ${cod}</strong>${tabla}Te escribimos el día anterior para recordártela. Podés cambiarla o cancelarla sin costo hasta ${NEGOCIO.cancelacion} horas antes.`, () => ofrecer([["📄 Mandarme todo por WhatsApp", () => bot('Listo: <a href="#" class="js-tel-chat">Abrir WhatsApp con la reserva</a>')]]));
  }
}
function reservaUrgente() { reservar({ fecha: new Date(hoy), hora: "ahora", urgente: true }); }

// Agendar con día, hora o franja
function agendarCon(fecha, hora, franja) {
  if (memoria.reprogramando) { const cod = memoria.reprogramando; memoria.reprogramando = null; return elegirTurno(fecha, hora, franja, cod); }
  return elegirTurno(fecha, hora, franja);
}
function elegirTurno(fecha, hora, franja, codigo = null) {
  memoria.ultimaIntencion = "agendar";
  const esHoy = fecha && fecha.getTime() === hoy.getTime();
  if (esHoy) return turnosDeHoy(hora, franja);
  const estado = estadoDia(fecha);
  if (estado === "cerrado" || estado === "rojo" || fecha > ultimoDiaAgenda) return agendar(fecha); // agendar explica por qué no se puede
  if (trabajoLargo()) {
    const siguiente = new Date(fecha); siguiente.setDate(siguiente.getDate() + 1);
    if (siguiente.getDay() === 0) siguiente.setDate(siguiente.getDate() + 1);
    if (!["verde", "amarillo"].includes(estadoDia(siguiente))) {
      const otro = proximoDiaLibre(2);
      return bot(`El ${fechaCorta(fecha)} hay lugar, pero el ${fechaCorta(siguiente)} ya está completo, y este trabajo lleva dos días seguidos. El primer par de días libres arranca el <strong>${fechaCorta(otro)}</strong>. ¿Te sirve?`, () => ofrecer([["✅ Sí, ese día", () => elegirTurno(otro, null, null, codigo), "", "si"], ["📅 Ver el calendario", () => agendar()]]));
    }
  }
  if (hora) {
    if (libresDe(fecha, [hora]).length) return reservar({ fecha, hora, codigo });
    const cerca = libresDe(fecha).sort((a, b) => Math.abs(parseInt(a) - parseInt(hora)) - Math.abs(parseInt(b) - parseInt(hora))).slice(0, 3).sort((a, b) => parseInt(a) - parseInt(b));
    return bot(`A las ${hora} del ${fechaCorta(fecha)} ya está ocupado 😕 ${cerca.length ? "Los turnos más cercanos son:" : "Ese día no quedan turnos."}`, () => cerca.length && ofrecer(cerca.map((h) => [h, () => reservar({ fecha, hora: h, codigo })])));
  }
  const horas = franja ? FRANJAS[franja].horas : TURNOS;
  const libres = libresDe(fecha, horas);
  if (!libres.length) return bot(`El ${fechaCorta(fecha)} ${franja ? FRANJAS[franja].nombre + " " : ""}ya no quedan turnos 😕 Probá otro horario u otro día.`, () => ofrecer([["📅 Ver el calendario", () => agendar(fecha)]]));
  bot(`El <strong>${fechaCorta(fecha)}</strong> ${franja ? FRANJAS[franja].nombre + " " : ""}tenemos estos turnos libres. ¿Cuál preferís?`, () => ofrecer(libres.slice(0, 6).map((h) => [h, () => reservar({ fecha, hora: h, codigo })]).concat([["📅 Ver el calendario", () => agendar(fecha)]])));
}
function turnosDeHoy(hora, franja) {
  if (new Date().getDay() === 0) return bot("Hoy es domingo: solo atendemos urgencias. Si es urgente, te mandamos a alguien ya 👇", () => ofrecer([["🚨 Es urgente", urgencias, "opcion--urgente", "si"], ["📅 Ver otros días", () => agendar()]]));
  const libres = libresDe(new Date(hoy), franja ? FRANJAS[franja].horas : hora ? [hora] : TURNOS);
  if (!libres.length) return bot("Para hoy ya no quedan turnos 😕 Si es urgente, vamos igual en menos de una hora.", () => ofrecer([["🚨 Es urgente", urgencias, "opcion--urgente"], ["📅 Ver otros días", () => agendar()]]));
  const primero = libres[0];
  bot(`Hoy ${new Date().getDay() === 6 ? "sábado " : ""}nos quedan turnos a las <strong>${libres.slice(0, 4).join(", ")}</strong>${libres.length > 4 ? " y más" : ""}.${parseInt(primero) === NEGOCIO.abre ? " ¡Serías el primero del día! 😄" : ""} ¿Cuál te reservo?`, () => ofrecer(libres.slice(0, 5).map((h, i) => [h, () => reservar({ fecha: new Date(hoy), hora: h }), "", i === 0 ? "si" : ""])));
}
// Cuando faltaba el barrio y el cliente lo dice
function completarPendiente() {
  const p = memoria.pendiente;
  if (memoria.lugar.tipo === "interior") return bot(textoCobertura(memoria.lugar) + " ¿Hay otra dirección en Montevideo o la Costa donde podamos ir?");
  bot(textoCobertura(memoria.lugar));
  reservar(p);
}

/* ===================== Cambio de turno ===================== */
function reprogramarConCodigo(cod) {
  if (!memoria.reservas[cod]) return false;
  memoria.reprogramando = cod;
  memoria.ultimaIntencion = "reprogramar";
  const r = memoria.reservas[cod];
  bot(`Encontré tu reserva <strong>${cod}</strong>, del ${fechaCorta(r.fecha)} a las ${r.hora}. ¿Para qué día y hora la querés pasar? (Por ejemplo: <em>el jueves a las 15</em>.) Es sin costo.`);
  return true;
}

/* ===================== Presupuesto guiado ===================== */
function presupuestoGuiado() {
  if (!memoria.cantidades || !Object.values(memoria.cantidades).some(Boolean)) {
    return bot("¡Dale! Primero contame qué trabajo necesitás (por ejemplo, <em>cambiar 2 enchufes</em> o <em>instalación completa de un monoambiente</em>) y después te hago 3 preguntas para el total 📋");
  }
  memoria.guiado = { paso: 1 };
  memoria.ultimaIntencion = "guiado";
  bot("¡Dale! Con <strong>3 preguntas rápidas</strong> te armo el total, materiales incluidos 📋");
  preguntaDisyuntor();
}
const EXPLICA_DISYUNTOR = "El <strong>disyuntor diferencial</strong> es una llave más ancha que las otras en el tablero, que suele tener un botón de prueba con una «T». Es lo que corta la luz si alguien toca un cable con corriente.";
function preguntaDisyuntor() {
  bot("<strong>1 de 3:</strong> ¿Tu tablero tiene <strong>disyuntor diferencial</strong>? Es una llave más ancha que las otras, con un botón de prueba con una «T».", () => ofrecer([
    ["Sí, tiene", () => { memoria.guiado.disyuntor = "si"; bot("¡Perfecto! Entonces ya estás protegido y no hace falta sumarlo ✓"); preguntaMateriales(); }, "", "si"],
    ["No tiene", () => { memoria.guiado.disyuntor = "no"; bot(`Te lo sumo al presupuesto: <strong>disyuntor diferencial, ${pesos(4500)}</strong>. Evita accidentes graves si alguien toca un cable con corriente.`); preguntaMateriales(); }, "", "no"],
    ["No sé", () => { memoria.guiado.disyuntor = "nose"; bot(`Tranqui, es lo más común 😉 Te lo sumo como <strong>recomendado</strong> (${pesos(4500)}): si en la visita vemos que ya lo tenés, lo sacamos del total.`); preguntaMateriales(); }, "", "nose"]
  ], EXPLICA_DISYUNTOR));
}
function preguntaMateriales() {
  memoria.guiado.paso = 2;
  bot("<strong>2 de 3:</strong> Los <strong>materiales</strong> (cables, cajas, enchufes, interruptores), ¿los ponemos nosotros o preferís comprarlos vos?", () => ofrecer([
    ["Que los pongan ustedes", () => materialesEmpresa(), "", "si"],
    ["Los compro yo", () => materialesCliente(), "", "no"]
  ], "Los <strong>materiales</strong> son todo lo que se instala: cables, cajas, enchufes, interruptores y llaves. Si los llevamos nosotros, los cobramos al precio de lista, sin recargo."));
}
function materialesEmpresa(indirecto = false) {
  memoria.materiales = "empresa";
  const h = horaActual();
  const intro = indirecto && h < 7 ? "Jaja, tranqui, ¡a esta hora no tenés que comprar nada! 😄 " : indirecto ? "Tranqui, no hace falta que compres nada. " : "";
  bot(`${intro}<strong>Los materiales los llevamos nosotros</strong>, al precio de lista y sin recargo.${estimarMateriales() ? ` Para este trabajo andan en unos <strong>${pesos(estimarMateriales())}</strong>.` : " Te los cotizamos en la visita."}`);
  if (memoria.guiado && memoria.guiado.paso === 2) preguntaAire(); else if (memoria.resumenTotal) resumenFinal();
}
function materialesCliente() {
  memoria.materiales = "cliente";
  bot("¡Dale! Te paso la lista para que los compres 🛒 Así te ahorrás ese costo.");
  if (memoria.guiado && memoria.guiado.paso === 2) preguntaAire(); else { if (memoria.resumenTotal) resumenFinal(); listaMateriales(); }
}
function preguntaAire() {
  memoria.guiado.paso = 3;
  bot("<strong>3 de 3:</strong> ¿Tenés o pensás poner <strong>aire acondicionado</strong>? Si es así, conviene dejarle hecha su <strong>línea exclusiva</strong> ahora, así después no hay que romper de nuevo.", () => ofrecer([
    ["Sí, tengo o voy a poner", () => { memoria.guiado.aire = true; resumenFinal(); }, "", "si"],
    ["No", () => { memoria.guiado.aire = false; resumenFinal(); }, "", "no"],
    ["Todavía no sé", () => { memoria.guiado.aire = false; memoria.nota = "Te dejo la línea del aire afuera; si te decidís, la sumamos en la visita."; resumenFinal(); }, "", "nose"]
  ]));
}
function estimarMateriales() {
  const c = memoria.cantidades || {};
  if (c.mono) return NEGOCIO.materialesMono;
  if (c.ambiente) return c.ambiente * NEGOCIO.materialesAmbiente;
  return 0;
}
function resumenFinal() {
  const g = memoria.guiado || {};
  const c = { ...(memoria.cantidades || {}) };
  if (g.disyuntor === "no" || g.disyuntor === "nose") c.disyuntor = 1;
  if (g.aire) c.aire = Math.max(1, c.aire || 0);
  memoria.cantidades = c;
  const incluyeEnchufes = c.mono || c.ambiente;
  const filas = [];
  let manoDeObra = 0;
  TRABAJOS.forEach((t) => {
    if (!c[t.id]) return;
    if (t.id === "cambio" && incluyeEnchufes) { filas.push([`${t.nombre} (${c[t.id]})`, "incluido"]); return; }
    const precio = c[t.id] * t.precio;
    manoDeObra += precio;
    const nota = t.id === "disyuntor" && g.disyuntor === "nose" ? " <em>(recomendado; se quita si ya lo tenés)</em>" : "";
    filas.push([`${t.nombre}${c[t.id] > 1 ? ` × ${c[t.id]}` : ""}${nota}`, (t.desde ? "desde " : "") + pesos(precio)]);
  });
  const materiales = memoria.materiales === "empresa" ? estimarMateriales() : 0;
  if (memoria.materiales === "empresa") filas.push(["Materiales" + (materiales ? " (aprox.)" : ""), materiales ? pesos(materiales) : "se cotizan en la visita"]);
  if (memoria.materiales === "cliente") filas.push(["Materiales", "los comprás vos"]);
  const traslado = memoria.lugar && ["traslado", "cerca"].includes(memoria.lugar.tipo) ? NEGOCIO.traslado : 0;
  if (traslado) filas.push([`Traslado (${memoria.lugar.n})`, pesos(traslado)]);
  filas.push(["Visita de diagnóstico", `<s>${pesos(NEGOCIO.visita)}</s> incluida`]);
  const total = manoDeObra + materiales + traslado;
  memoria.resumenTotal = total; memoria.total = manoDeObra;
  const pagos = [];
  if (total >= NEGOCIO.minimoDescuento) pagos.push(`Efectivo o transferencia (−10 %): <strong>${pesos(total * 0.9)}</strong>`);
  if (total >= NEGOCIO.minimoCuotas) pagos.push(`Crédito en ${NEGOCIO.cuotas} cuotas sin recargo: <strong>${NEGOCIO.cuotas} × ${pesos(Math.ceil(total / NEGOCIO.cuotas))}</strong>`);
  pagos.push(`Débito o crédito en 1 pago: ${pesos(total)}`);
  if (memoria.jubilado) pagos.push(`Con descuento de jubilado (−10 % en mano de obra): <strong>${pesos(total - manoDeObra * 0.1)}</strong>`);
  const masLargo = ["mono", "ambiente", "tablero", "aire", "revision", "disyuntor", "enchufe", "termica", "lampara", "cambio"].find((id) => c[id]);
  const tiempo = masLargo && TRABAJOS.find((t) => t.id === masLargo).horas;
  memoria.guiado = null;
  memoria.ultimaIntencion = "resumen";
  bot(`📋 <strong>Tu presupuesto</strong><table class="tabla-chat">${filas.map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join("")}<tr class="tabla-chat__total"><th>Total</th><td>${pesos(total)}</td></tr></table>${pagos.join("<br>")}<br><small>Lleva ${tiempo || "poco tiempo"} · 6 meses de garantía por escrito · se confirma en la visita.</small>`, () => {
    const lista = [["📅 Agendar", () => agendar(), "", "si"], ["📄 Enviarme el presupuesto", presupuestoEscrito]];
    if (memoria.materiales === "cliente") lista.push(["🛒 Lista de materiales", listaMateriales]);
    ofrecer(lista);
  });
}

/* ===================== Lista de materiales ===================== */
function listaMateriales() {
  const c = memoria.cantidades || {};
  const items = [];
  const n = c.mono ? 1 : (c.ambiente || 0);
  if (c.mono) {
    items.push("50 m de cable de <strong>2,5 mm² marrón</strong> (enchufes)", "50 m de cable de <strong>2,5 mm² celeste</strong> (enchufes)", "50 m de cable de <strong>2,5 mm² verde y amarillo</strong> (tierra)", "30 m de cable de <strong>1,5 mm² marrón</strong> (luces)", "30 m de cable de <strong>1,5 mm² celeste</strong> (luces)", "6 tomacorrientes <strong>con tierra</strong> (3 patas), con tapas", "3 interruptores de luz, con tapas", "1 llave térmica de <strong>10 A</strong> (luces) y 1 de <strong>16 A</strong> (enchufes)");
  } else if (n) {
    items.push(`${20 * n} m de cable de <strong>2,5 mm²</strong> en marrón, celeste y verde-amarillo (de cada color)`, `${10 * n} m de cable de <strong>1,5 mm²</strong> marrón y celeste (de cada color)`, `${4 * n} tomacorrientes <strong>con tierra</strong>, con tapas`, `${2 * n} interruptores de luz, con tapas`);
  }
  if (!n && c.cambio) items.push(`${c.cambio} tomacorriente${c.cambio > 1 ? "s" : ""} o interruptor${c.cambio > 1 ? "es" : ""} <strong>con tierra</strong> (llevá una foto del que tenés para que te den uno igual)`);
  if (c.enchufe) items.push(`${c.enchufe} tomacorriente${c.enchufe > 1 ? "s" : ""} <strong>con tierra</strong> y ${c.enchufe} caja${c.enchufe > 1 ? "s" : ""} de embutir`, `${10 * c.enchufe} m de cable de <strong>2,5 mm²</strong> (marrón, celeste y verde-amarillo)`);
  if (c.lampara) items.push(`Las ${c.lampara > 1 ? c.lampara + " lámparas o plafones" : "lámpara o plafón"} que elijas (nosotros llevamos lo necesario para conectarlas)`);
  if (c.termica) items.push(`${c.termica} llave${c.termica > 1 ? "s" : ""} térmica${c.termica > 1 ? "s" : ""} (te decimos los amperes en la visita, o mandanos una foto del tablero)`);
  if (c.disyuntor) items.push("1 <strong>disyuntor diferencial 2 × 25 A, 30 mA</strong>" + (memoria.guiado?.disyuntor === "nose" || !memoria.guiado ? " <em>(solo si tu tablero no tiene)</em>" : ""));
  if (c.aire) items.push("20 m de cable de <strong>4 mm²</strong> (marrón, celeste y verde-amarillo) y 1 llave térmica de <strong>20 A</strong> para el aire");
  if (!items.length) return bot("Primero contame qué trabajo necesitás y te armo la lista 🛒");
  items.push("20 conectores rápidos (tipo bornera de palanca) y 1 rollo de cinta aisladora");
  memoria.ultimaIntencion = "lista";
  bot(`🛒 <strong>Lista de materiales</strong><br><small>En cualquier barraca o casa de electricidad te lo arman con esta lista.</small><ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>Si te falta algo o tenés dudas, <strong>mandanos una foto</strong> de lo que conseguiste y te decimos si sirve.`, () => ofrecer([["📄 Mandarme la lista por WhatsApp", () => bot('Listo: <a href="#" class="js-tel-chat">Abrir WhatsApp con la lista</a>')]]));
}

/* ===================== Otros idiomas ===================== */
function detectarIdioma(original) {
  const t = " " + normalizar(original).replace(/[^a-z ]/g, " ") + " ";
  const en = (t.match(/ (hi|hello|hey|the|you|your|can|how|much|need|please|thanks|thank|power|outlet|electrician|is|are|do|does|my|english|there|what|help|fix|light|price) /g) || []).length;
  const pt = (t.match(/ (oi|voce|voces|preciso|obrigado|obrigada|tomada|eletricista|nao|estou|bom dia|boa tarde|boa noite|quanto custa|fazer|consegue|vcs|tudo bem|ajuda|minha|meu) /g) || []).length;
  if (en >= 2 && en > pt) return "en";
  if (pt >= 2 && pt >= en) return "pt";
  if (/^\s*(hi|hello|hey)\b/.test(t)) return "en";
  if (/^\s*(oi|ola tudo bem)\b/.test(t)) return "pt";
  return null;
}
function avisoIdioma(idioma) {
  memoria.ultimaIntencion = "idioma";
  const texto = idioma === "en"
    ? `Hi! 👋 Voltio is an electrician in Montevideo, Uruguay, and this automatic assistant understands <strong>Spanish only</strong>. You can write to us on WhatsApp and we'll help you in English.<br><a href="#" class="js-tel-chat">💬 Write on WhatsApp</a><br><small>Portfolio demo: try typing in Spanish, for example «se me cortó la luz» (my power went out) or «cuánto sale cambiar un enchufe» (how much to replace an outlet).</small>`
    : `Oi! 👋 A Voltio é um eletricista em Montevidéu, Uruguai, e este assistente automático entende <strong>só espanhol</strong>. Escreva para a gente no WhatsApp que te atendemos em português.<br><a href="#" class="js-tel-chat">💬 Escrever no WhatsApp</a><br><small>Demo de portfólio: experimente escrever em espanhol, por exemplo «se me cortó la luz» (acabou a luz) ou «cuánto sale cambiar un enchufe» (quanto custa trocar uma tomada).</small>`;
  bot(texto);
}
