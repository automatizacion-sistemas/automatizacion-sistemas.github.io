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
- **Prueba intermitente (resuelta):** en algunas ejecuciones de la demo de inventarios, un producto recién creado no aparecía. Se encontró la causa: al abrir un formulario, el cursor se movía al primer campo con un pequeño retraso, y si para entonces ya se estaba escribiendo en otro campo, el texto terminaba en el lugar equivocado (por ejemplo, el precio "12" se agregaba al código). Ahora el cursor se ubica de inmediato. Después del arreglo, la suite pasó en 6 de 6 ejecuciones seguidas.

---

# Demo de ventas y cobranzas (agregada después de la Etapa 5)

| Verificación | Resultado |
|---|---|
| Cuadre contable de los datos de ejemplo | ✅ Ventas (S/ 174 377,20) − cobros (S/ 126 368,00) = por cobrar (S/ 48 009,20) = suma de los tramos de antigüedad |
| Integridad | ✅ Sin saldos negativos, sin cobros anteriores a su venta, sin fechas futuras, sin facturas a clientes con DNI y sin saltos en la numeración |
| Reglas de negocio | ✅ 12 grupos de pruebas, 3 de 3 ejecuciones completas sin fallos |
| Accesibilidad (axe-core) | ✅ 0 problemas en las 5 pantallas |
| Adaptación a pantallas | ✅ Sin desbordes de 320 a 1440 px |
| Exportaciones | ✅ Registro de ventas, antigüedad de saldos (2 hojas) y estado de cuenta; abiertos y revisados con openpyxl |

Casos probados: validación de RUC/DNI, documento duplicado y celular; factura solo con RUC (en el formulario la opción se desactiva); desglose de IGV (800,00 = 677,97 + 122,03); bloqueo al superar la línea de crédito y su liberación después de un cobro; cobro mayor que el saldo; cobro con fecha anterior a la venta; cobro parcial; estado de cuenta; recordatorio por WhatsApp; bloqueo al eliminar un cliente con ventas; filtros; guardado al recargar; restablecer.

También en esta etapa: las piezas que comparten las demos (motor SQLite, tablas, gráficos, estilos y librerías) se movieron a `demos/comun/`. La demo de inventarios volvió a pasar todas sus pruebas después del cambio.

---

# Demo de control de asistencia

| Verificación | Resultado |
|---|---|
| Reglas de calificación | ✅ 11 casos controlados: tolerancia exacta = puntual; un minuto después = 11 min de tardanza; horas con refrigerio; horas extra; falta; descanso dominical; vacaciones sin descuento; licencia sin goce con descuento; día sin salida; "por llegar" hoy dentro de la tolerancia y falta pasada la tolerancia |
| Integridad de los datos de ejemplo | ✅ 917 marcaciones sin salidas anteriores a la entrada, sin fechas futuras, sin marcaciones antes del ingreso y sin marcaciones en días con permiso |
| Flujo completo | ✅ Marcación con DNI (entrada, salida, jornada completa, DNI inexistente, salida en el mismo minuto); corrección con validaciones y motivo obligatorio; permisos que se cruzan y fechas invertidas; DNI duplicado; baja que impide marcar; reporte y Excel (2 hojas); guardado al recargar y restablecer |
| Accesibilidad (axe-core) | ✅ 0 problemas en las 5 pantallas |
| Adaptación a pantallas | ✅ Sin desbordes de 320 a 1440 px (se corrigió el ancho del quiosco en celulares) |

Mejora general: al cambiar de pantalla se cierra cualquier ventana que hubiera quedado abierta (se aplicó en las 3 demos). Después del cambio, las suites de inventarios, ventas y asistencia volvieron a pasar completas.

---

# Demo de gestión de personal

| Verificación | Resultado |
|---|---|
| Cálculos verificados a mano | ✅ 11 casos: récord vacacional (3 periodos, saldo de 90 días, 2 periodos vencidos, fecha límite de goce), vacaciones truncas (2,5 días por mes), antigüedad, fin de mes (31/01 + 1 mes = 28/02) y RMV por fecha (S/ 1 130 hasta el 30/09/2026 y S/ 1 230 desde el 01/10/2026, D.S. 015-2026-TR) |
| Integridad de los datos de ejemplo | ✅ 72 contratos sin cruces ni huecos entre renovaciones; vacaciones sin cruces y con los días bien calculados |
| Alertas | ✅ Se generan los 9 tipos: contrato vencido, por vencer, superó 5 años a plazo fijo, cerca del límite, sueldo bajo la RMV, vacaciones vencidas, vacaciones por vencer, fin del periodo de prueba y legajo incompleto |
| Validaciones | ✅ Más de 5 años a plazo fijo, monto menor a la RMV, cruce de contratos, edad mínima (18 años, o 16 para modalidad formativa), DNI duplicado, vacaciones mayores al saldo, bloque de menos de 7 días (pide confirmar el acuerdo escrito) y vacaciones que se cruzan |
| Flujo completo | ✅ Renovación desde la alerta (propone el día siguiente al vencimiento y plazo indeterminado si se acerca a 5 años), alta con contrato y lista de documentos, documentos marcados como entregados, cese (recorta el contrato), filtros, 3 exportaciones a Excel, guardado y restablecer |
| Accesibilidad (axe-core) | ✅ 0 problemas en las 4 pantallas |
| Adaptación a pantallas | ✅ Sin desbordes de 320 a 1440 px |

También se actualizó a S/ 1 230 el sueldo sugerido al registrar un trabajador en la demo de asistencia.

---

# Demo de control de ingresos y gastos

| Verificación | Resultado |
|---|---|
| Cuadre contable | ✅ El estado de resultados coincide con los totales de la base de datos; utilidad = ingresos − gastos y "queda en el negocio" = utilidad − retiros, mes a mes |
| Saldos | ✅ Recalculados en orden cronológico, ninguna cuenta queda en negativo en los 1 551 movimientos de ejemplo; los saldos calculados coinciden con los mostrados |
| Lectura de extractos | ✅ 9 casos: montos "1.026,30", "-312,40", "1,234.56" y "S/ 50"; fechas dd/mm/aa y AAAA-MM-DD; rechazo de 31/02/2026 y de textos no numéricos; normalización de tildes |
| Importación | ✅ De 11 líneas: 2 detectadas como ya registradas, 7 categorizadas automáticamente, 2 obligan a elegir categoría antes de importar; al volver a analizar el mismo extracto, las 11 aparecen como duplicadas; "RETIRO CAJERO" se clasifica como retiro personal y no como gasto |
| Validaciones | ✅ Categoría obligatoria y del tipo correcto, saldo insuficiente, transferencia a la misma cuenta, fecha futura, eliminar un ingreso que dejaría la cuenta en negativo y regla duplicada |
| Otros | ✅ Edición del presupuesto en la misma tabla, estados "dentro del presupuesto" y "podría excederse", mensaje cuando los retiros superan la utilidad, filtros, 2 exportaciones a Excel, guardado y restablecer |
| Accesibilidad (axe-core) | ✅ 0 problemas en las 5 pantallas (las tablas anchas ahora se pueden recorrer con el teclado, mejora aplicada a todas las demos) |
| Adaptación a pantallas | ✅ Sin desbordes de 320 a 1440 px (barra superior más compacta en celulares muy angostos, mejora aplicada a todas las demos) |

Después de los cambios compartidos, las suites de las 5 demos volvieron a pasar completas.

---

# Demo de seguimiento de clientes

| Verificación | Resultado |
|---|---|
| Integridad de los datos | ✅ Toda oportunidad abierta tiene seguimiento y próxima acción; las cerradas tienen fecha de cierre; las perdidas tienen motivo; ningún contacto está fuera de rango; la última etapa del historial coincide con la etapa actual; los 72 celulares y todos los RUC son válidos |
| RUC | ✅ Dígito verificador probado con RUC válidos e inválidos y con longitud incorrecta |
| Agenda | ✅ Los contadores de vencidos, hoy, próximos y sin contacto coinciden con la base de datos; el filtro por vendedor muestra solo sus oportunidades |
| Validaciones del cliente | ✅ Celular corto o fijo, RUC inválido, RUC sin razón social, correo mal escrito, origen vacío y duplicados por celular (aunque se escriba con +51 y espacios), RUC y correo (sin importar mayúsculas); si falla la oportunidad, no se guarda el cliente |
| Registro de contactos | ✅ Rechaza nota vacía, seguimiento pasado, acción vacía, fecha futura y fecha anterior a la oportunidad; los atajos de fecha funcionan; el seguimiento se reprograma |
| Etapas | ✅ Exige acción y fecha válida al avanzar, motivo al perder y monto mayor a cero al ganar; al ganar se cierra, se bloquean los cambios y sube «Ganado este mes» por el monto exacto; una oportunidad cerrada no se puede reabrir |
| Arrastrar y soltar | ✅ Al soltar una tarjeta en otra columna se piden los datos de la etapa y la tarjeta se mueve; las tarjetas cerradas no se pueden arrastrar |
| WhatsApp | ✅ Enlace `wa.me/51…` con el mensaje de la plantilla y el nombre del cliente; el texto editado se respeta; al abrirlo se prepara el registro del contacto |
| Reportes | ✅ El embudo de conversión siempre decrece; los totales por origen y por vendedor suman el total de oportunidades; las ventas por mes cuadran con SQL |
| Otros | ✅ Edición de cliente, eliminación en cascada (oportunidades e historial), 2 exportaciones a Excel, guardado al recargar y restablecer |
| Accesibilidad (axe-core) | ✅ 0 problemas en las 4 pantallas y en las fichas de oportunidad y de cliente y el formulario de cliente |
| Adaptación a pantallas | ✅ Sin desbordes de 320 a 1440 px; áreas táctiles de al menos 32 px |

---

# Demo de Excel con Python

| Verificación | Resultado |
|---|---|
| Pruebas del programa (pytest) | ✅ 23 pruebas: lectura de montos y fechas en distintos formatos, comprobantes, encabezados, nombre de la sucursal, resultado exacto sobre los 7 ejemplos, estructura del Excel, período forzado, fecha futura y archivos inválidos o dañados |
| Fórmulas del Excel | ✅ Recalculado con LibreOffice: la venta total, los SUMIFS por sucursal, los totales y la participación coinciden con lo que calcula Python (S/ 58,193.81) |
| Paquete descargable | ✅ El .zip se descomprime, sus pruebas pasan y `ejecutar.sh` genera el consolidado con los ejemplos incluidos |
| Python en el navegador | ✅ Pyodide 314.0.7 (Python 3.14) y openpyxl se cargan desde el propio sitio; con todas las conexiones externas bloqueadas, la demo funciona igual (0 solicitudes externas) |
| Resultado en el navegador | ✅ Igual al de la computadora: 559 líneas, S/ 58,193.81, 8 excluidas, 1 corregida, 10 nombres unificados; el Excel descargado tiene las 4 hojas, la tabla filtrable y el gráfico |
| Casos de uso | ✅ Solo un archivo, ningún archivo (botón deshabilitado), solo el archivo que no es de ventas (mensaje claro), archivo propio con otros encabezados y fila de TOTAL (se procesa y la sucursal sale del nombre), archivo que no es .xlsx y nombre repetido (se rechazan) |
| Accesibilidad (axe-core) | ✅ 0 problemas en las 3 pantallas y en el resultado; al marcar archivos no se pierde el foco del teclado |
| Adaptación a pantallas | ✅ Sin desbordes de 320 a 1440 px (el código se desplaza dentro de su recuadro) |
