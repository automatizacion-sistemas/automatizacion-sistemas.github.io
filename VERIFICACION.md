# Verificación del sitio — Etapa 5

**Fecha:** 7 de noviembre de 2026  
**Alcance:** página principal, demo de inventarios y guía de estilo.  
**Método:** pruebas automatizadas en Chrome (Playwright) con axe-core, html-validate y Lighthouse.

## Resumen

| Área | Resultado |
|---|---|
| Validación HTML (html-validate) | ✅ 0 errores en las 3 páginas (se corrigieron 22) |
| Accesibilidad WCAG 2.1 AA (axe-core) | ✅ 0 problemas en 7 pantallas (se corrigieron contrastes, encabezados de tabla vacíos y regiones) |
| Lighthouse, página principal (móvil) | ✅ Rendimiento 100 · Accesibilidad 100 · Buenas prácticas 100 · SEO 100 · contenido visible en 0,9 s |
| Lighthouse, demo de inventarios (móvil) | ⚠️ Rendimiento 67–70 · Accesibilidad 100 · Buenas prácticas 100 · SEO 100 (ver nota) |
| Adaptación a pantallas | ✅ Sin desbordes en 320, 360, 390, 414, 768, 1024 y 1440 px |
| Formulario de contacto | ✅ 13 casos verificados (ver abajo) |
| Navegación y teclado | ✅ |
| Demo de inventarios | ✅ Todas las funciones, 5 de 5 ejecuciones completas sin fallos |

## Formulario de contacto

| Caso | Resultado |
|---|---|
| Envío con todos los campos vacíos | Marca 4 campos en rojo y no envía |
| Correos inválidos (`juan`, `juan@`, `juan@empresa`, con espacio interno, dominio de 1 letra) | Rechazados |
| Correo válido con espacios al inicio o al final | Aceptado (se recortan) |
| Mensaje de menos de 20 caracteres | Rechazado |
| Mensaje de más de 2000 caracteres | Se limita a 2000 |
| Doble clic en "Enviar" | Solo se hace 1 envío |
| Web3Forms confirma la recepción | Muestra "¡Mensaje enviado!" y limpia el formulario |
| Web3Forms rechaza el envío | Muestra el error y ofrece WhatsApp; lo escrito no se borra |
| Sin conexión a internet | Muestra el error; el botón vuelve a su estado normal |
| Código HTML escrito en el nombre | Se muestra como texto, no se ejecuta |
| Campo trampa antispam marcado | El envío se descarta |
| "Solicitar un sistema similar" | Llena el tipo de solución y un mensaje inicial |
| **Envío real a tu correo** | ⏳ Pendiente: se prueba en la Etapa 6, con el sitio publicado |

## Navegación y comportamiento

- Orden de tabulación lógico; el enlace "Saltar al contenido" funciona.
- Menú del celular: abre y cierra, cierra con Escape y al elegir una sección, y avisa a los lectores de pantalla si está abierto o cerrado (`aria-expanded`).
- Todos los enlaces internos (`#seccion`) llevan a una sección que existe.
- Todos los enlaces externos usan `rel="noopener"`.
- El botón flotante de WhatsApp aparece al bajar y se oculta en la sección Contacto.
- Con "reducir movimiento" activado en el sistema, las animaciones se desactivan y todo el contenido es visible.

## Demo de inventarios

- Cada producto cuadra entre su stock (22 productos, 1678 movimientos) y su kardex, y el kardex nunca queda negativo.
- Costo promedio ponderado verificado a mano: (6 × 5 + 10 × 8) ÷ 16 = S/ 6,875.
- No se puede retirar más stock del disponible, ni siquiera con fechas pasadas.
- No se puede crear un producto con un código duplicado.
- Al eliminar un producto también se eliminan sus movimientos, sin dejar registros sueltos.
- Los cambios se guardan al recargar la página, y "Restablecer" vuelve a los datos originales.
- Los archivos Excel (inventario y kardex) y la base `.sqlite` se generan bien; se abrieron y revisaron con openpyxl y sqlite3.
- Si el navegador no permite WebAssembly, usa la versión JavaScript de SQLite y sigue funcionando.
- Si el navegador bloquea el almacenamiento (por ejemplo, en navegación privada estricta), la demo funciona y avisa que los cambios no se guardarán.

## Peso de las páginas

| Página | Sin comprimir | Con gzip (como en GitHub Pages) |
|---|---|---|
| Página principal | 161 KB, 14 archivos | ~158 KB (la mayor parte son las tipografías y la captura, que ya vienen comprimidas) |
| Demo de inventarios | ~1,1 MB | ~520 KB (327 KB son el motor SQLite) |

## Correcciones hechas en esta etapa

1. Se ajustaron el celeste de los textos (`#0077C8` → `#006CB5`) y el gris secundario (`#64748B` → `#5B6B80`) para alcanzar un contraste de 4,5:1.
2. Se cambió el texto legal del pie de página a un gris claro, legible sobre el fondo oscuro.
3. Todos los botones e inputs tienen ahora un `type` explícito, y se quitó un atributo no válido del campo antispam.
4. Los encabezados de tabla sin texto visible tienen ahora un texto para lectores de pantalla.
5. El aviso de la demo se movió dentro de la región principal (`<main>`).
6. En pantallas de 320 px se ajustaron el logotipo y los márgenes, y el botón del menú ya no se sale de la pantalla.
7. El selector del kardex ya no se sale de la pantalla en 320–360 px.
8. La firma del pie de página pasa a la línea siguiente en pantallas angostas.
9. En tablets, las tablas de la demo se muestran como tarjetas en dos columnas, sin desplazamiento horizontal.
10. Se agrandaron las zonas táctiles de "Cuéntame qué necesitas" y "Ver todos".
11. Rendimiento de la demo: los datos de ejemplo se insertan en lote (de 1,3 s a menos de 0,3 s en un celular lento simulado), el motor SQLite se descarga por adelantado y Chart.js se carga después de mostrar los datos.

## Nota sobre el rendimiento de la demo

La demo ejecuta una base de datos SQLite completa dentro del navegador. En la primera visita descarga el motor (327 KB comprimido) y genera unos 1700 movimientos de ejemplo. En un celular de gama baja con 4G lento (la simulación de Lighthouse), el dashboard aparece en unos 4 s; mientras tanto se muestra la pantalla "Preparando la base de datos…". En las visitas siguientes carga en 0,4 s. La página principal, que es la que ven primero los visitantes, obtiene 100 en rendimiento.

## Limitaciones de esta verificación

- **Navegadores:** las pruebas se hicieron en Chrome. No se pudieron descargar los motores de Firefox y Safari en el entorno de pruebas. Todo el código usa funciones compatibles con las versiones actuales de los tres navegadores, pero conviene abrir el sitio una vez en un iPhone (Safari) cuando esté publicado.
- **Formulario:** la conexión con Web3Forms se probó con respuestas simuladas. El envío real se confirmará en la Etapa 6.
- **Prueba intermitente:** en 2 de unas 20 ejecuciones de la suite de la demo, un producto recién creado no apareció, justo después de editar archivos con el servidor encendido. No se volvió a presentar en las 14 ejecuciones siguientes. Se mantiene en observación.
