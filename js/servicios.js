/* Voltio: menú de servicios (franja de arriba) y servicios dentro del texto
   Se usa en las dos páginas. Los precios salen de datos.js, los mismos que usa
   el asistente: si el dueño cambia un precio ahí, cambia en todos lados. */

document.querySelectorAll("[data-trabajo]").forEach((el) => {
  const t = TRABAJOS.find((x) => x.id === el.dataset.trabajo);
  if (t) el.textContent = (t.desde ? "desde " : "") + pesos(t.precio);
});
document.querySelectorAll("[data-negocio]").forEach((el) => (el.textContent = pesos(NEGOCIO[el.dataset.negocio])));

// Menú desplegable "Servicios"
const menuBoton = document.getElementById("menu-serv-boton");
const menuPanel = document.getElementById("menu-serv");
function menuAbierto(abrir) {
  menuPanel.hidden = !abrir;
  menuBoton.setAttribute("aria-expanded", String(abrir));
  if (abrir) menuPanel.querySelector("button").focus();
}
menuBoton.addEventListener("click", () => menuAbierto(menuPanel.hidden));
document.addEventListener("click", (e) => { if (!menuPanel.hidden && !e.target.closest(".menu-serv")) menuAbierto(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menuPanel.hidden) { menuAbierto(false); menuBoton.focus(); } });
menuPanel.querySelector(".menu-serv__pie").addEventListener("click", () => menuAbierto(false));

// Cualquier servicio (del menú o del texto) abre el asistente con ese trabajo ya cargado
document.querySelectorAll("[data-pedir]").forEach((boton) => boton.addEventListener("click", (e) => {
  e.preventDefault(); // los del texto son enlaces
  menuAbierto(false);
  const id = boton.dataset.pedir;
  const saludo = iniciado ? "" : "¡Hola! Soy el asistente automático de Voltio ⚡<br>";
  abrirChat(() => {
    bot(`${saludo}Vi que te interesa <strong>${boton.dataset.servicio}</strong>.`);
    if (id === "urgencia") urgencias();
    else presupuesto({ [id]: 1 });
  });
}));
