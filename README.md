# Voltio, electricista — landing page con asistente

**Demo:** https://fabricioruy-rdig.github.io/electricista-voltio/

!\[Portada con la agenda y el asistente armando un presupuesto](img/captura.webp)

Sitio de un electricista ficticio de Montevideo y Ciudad de la Costa. El cliente puede agendar una visita, pedir un presupuesto o resolver una urgencia sin esperar a que alguien le conteste: lo hace la propia página.

> Proyecto de demostración para mi portafolio. El negocio, los teléfonos, los precios y las reseñas son ficticios.



\*\*Proyecto relacionado:\*\* \[Panel de Voltio](https://github.com/fabricioruy-Rdig/panel-voltio), el programa en Python con base de datos que usa el electricista para su agenda, clientes, cobros e informe.

## Qué tiene

**Portada (una sola pantalla)**

* **Agenda de visitas:** el cliente escribe su barrio y la página le dice si llegan sin costo, con traslado o si no cubren la zona. Después elige el día en un calendario con colores de disponibilidad (verde, amarillo, rojo) y el horario. Se puede agendar hasta diciembre del año siguiente.
* **Asistente automático (chat):** entiende lo que el cliente escribe con sus palabras, incluso con faltas de ortografía:

  * diagnostica problemas («se me cortó la luz», «salta la llave») y da pasos de seguridad;
  * arma presupuestos al instante, con descuentos, cuotas y recargo fuera de horario;
  * reserva turnos con fecha, hora y barrio («¿pueden venir el jueves a la tarde a Pocitos?»), y la tarjeta de la agenda queda confirmada con el mismo código;
  * reprograma con el código de reserva, distingue urgencias y aparatos rotos, y avisa cuando algo no es de su rubro.
* **Menú «Servicios»** en la franja de arriba: cada servicio, con su precio, abre el asistente con ese trabajo ya cargado.
* Botón de contacto por WhatsApp (en la demo muestra un aviso).

**Página «Quiénes somos»**

* Foto y texto contado en primera persona; los servicios nombrados en el texto abren el asistente con ese presupuesto.
* Reseñas en formato collage.

!\[Página Quiénes somos con las reseñas](img/captura-nosotros.webp)

## Cómo funciona el asistente

No usa inteligencia artificial ni servidor: todo corre en el navegador, con reglas.

* Limpia el texto (tildes, mayúsculas, errores comunes) y lo compara por sonido, para que «se me cortó la lus» o «salta el disyunptor» se entiendan igual.
* Reconoce intenciones con búsqueda aproximada ([Fuse.js](https://www.fusejs.io/)) sobre frases de ejemplo.
* Saca datos del mensaje: barrios (todos los de Montevideo y la Costa), fechas («el 15», «15/12/2027», «pasado mañana»), horarios, franjas del día y cantidades escritas con letras.
* Recuerda la conversación (barrio, motivo, presupuesto, reservas) y nunca cambia de tema cuando no entiende: pide que lo expliquen de otra forma u ofrece las opciones que tenía.

Los precios y las condiciones del negocio están en un solo archivo (`js/datos.js`): si cambian ahí, cambian en la página, en el menú y en el chat.

## Notas de la demo

* **Reseñas:** son de ejemplo y lo dice la página. En el sitio de un negocio real se reemplazan por las reseñas verdaderas de su perfil de Google.
* **Disponibilidad:** los turnos ocupados son simulados (siempre los mismos para cada fecha).
* **Teléfono y WhatsApp:** los botones muestran un aviso en lugar de llamar.

## Tecnologías

HTML, CSS y JavaScript, sin frameworks. Única librería: Fuse.js (búsqueda aproximada).

* Diseño adaptado a celular, accesible con teclado y lector de pantalla, y respeta la opción de reducir movimiento.
* Tipografía e imágenes guardadas en el proyecto (WebP): no depende de servicios externos.

## Estructura

```
electricista-voltio
├── index.html                 portada: agenda y asistente
├── servicios.html             quiénes somos y reseñas
├── css/styles.css
├── js/
│   ├── datos.js               precios, zonas y condiciones del negocio
│   ├── main.js                utilidades, barrios y agenda
│   ├── asistente.js           el chat: entender y responder
│   ├── asistente-reservas.js  turnos, reservas y presupuesto completo
│   ├── servicios.js           menú de servicios
│   └── vendor/                Fuse.js y su licencia
├── img/
└── fonts/                     Space Grotesk y su licencia (OFL)
```

## Créditos

* Foto: colsan ltda en [Unsplash](https://unsplash.com/photos/electrician-testing-electrical-panel-LMb98OOtoYU).
* [Fuse.js](https://github.com/krisk/Fuse) 7.1.0, licencia Apache 2.0.
* Tipografía Space Grotesk, licencia SIL Open Font License.

\---

**EN:** Landing page for a fictional electrician in Montevideo, Uruguay. Visit booking with a color-coded availability calendar and neighborhood coverage check, plus a rule-based chat assistant (no AI, no server) that understands free text in Spanish, diagnoses problems, builds instant quotes and books appointments. Plain HTML, CSS and JavaScript with Fuse.js. Portfolio demo project.

Diseño y desarrollo: [fabricioruy-Rdig](https://github.com/fabricioruy-Rdig)

