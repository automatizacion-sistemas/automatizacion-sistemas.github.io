# MI AGENCIA IA · Oficina virtual

Oficina virtual en 3D donde trabajan tres agentes de IA: **Valeria** (productora audiovisual), **Diego** (community manager) y **Sofía** (asistente comercial).

## Modo gratuito

Todo lo siguiente funciona **sin pagar nada** y los datos se guardan en tu computadora:

- **Oficina 3D** con Valeria, Diego y Sofía. La etiqueta de cada uno muestra su estado real.
- **Negocios y clientes**: ficha con logotipo, servicios, público, colores, redes y objetivos. Nada se mezcla entre negocios.
- **CRM comercial (Sofía)**: prospectos con todos sus datos, clasificación (caliente/tibio/frío), 7 estados comerciales, próximos seguimientos con alertas de vencidos y de "hoy", historial de seguimientos por canal y plantillas de mensajes con variables (`{nombre}`, `{empresa}`, `{servicio}`, `{negocio}`).
- **WhatsApp sin costo**: el botón abre WhatsApp en tu dispositivo con el mensaje listo (enlace oficial wa.me) y **tú decides si lo envías**.
- **Informe**: embudo por estado, tasa de cierre y descarga a Excel (CSV).
- **Calendario editorial (Diego)**: vista de mes y de lista; publicaciones para Facebook, Instagram, TikTok y YouTube con fecha, hora, responsable, texto, hashtags y material; contador de caracteres y hashtags según la red; horarios sugeridos como punto de partida.
- **Aprobación obligatoria**: Borrador → Pendiente de aprobación → Aprobado → Programado → Publicado (o Error). Si se modifica algo ya aprobado o programado, vuelve a pedir aprobación. La publicación la haces tú con las herramientas gratuitas de cada red (Meta Business Suite, TikTok Studio, YouTube Studio); la app copia el texto, abre la herramienta y registra el enlace.
- **Bitácora de actividad** por agente, sonidos opcionales y diseño adaptable a celular.

- **Tablero de tareas y coordinación** (botón **ASIGNAR NUEVA TAREA**): escribe lo que necesitas (por ejemplo, "un video para promocionar mis servicios contables") y elige un flujo. El trabajo se reparte en pasos encadenados: Sofía define la oferta → Valeria produce el video → Diego prepara las publicaciones → tú apruebas → Diego publica, y Sofía prepara el seguimiento. Cada paso se habilita cuando el anterior entrega su trabajo y tú lo apruebas; la entrega pasa al siguiente. También hay tareas individuales, un tablero con columnas (Pendiente, En curso, En revisión, Terminada) y el historial de cada tarea.
- **Estudio de video (Valeria)**: une clips e imágenes en orden, recorta cada clip, ajusta el encuadre (fondo difuminado, rellenar o barras de color), agrega música con volumen y fundido, y subtítulos (uno por uno o pegando el guion, que se reparte solo). Exporta en **vertical 9:16, horizontal 16:9 y cuadrado 1:1** (1080p o borrador 720p) con barra de progreso, y descarga los subtítulos en .srt. Todo se procesa en tu computadora con FFmpeg, que se instala solo con `npm install`. No genera video con IA: usa el material que subas.
- **Importar desde Claude (gratis)**: trae lo que ya trabajaste en tu chat o proyecto de claude.ai. En el calendario, las tareas, los prospectos, las plantillas de WhatsApp y la ficha del negocio hay un botón **Importar desde Claude**: copias la instrucción, la pegas en tu chat de Claude, pegas su respuesta en la app, revisas la vista previa e importas todo de una vez. Usa tu cuenta de Claude, no la API de pago. (La app no puede leer tus chats por sí sola: el copiar y pegar lo haces tú.)
- **Centro de control**: tareas pendientes, en curso, por revisar y terminadas; publicaciones por aprobar y programadas; prospectos y seguimientos del día. Cada cifra abre su sección, y las etiquetas de los agentes muestran su bandeja real.

En modo gratuito el trabajo de cada paso lo haces tú (o tu equipo): el tablero ordena quién hace qué, en qué orden y qué se entregó. Los personajes no ejecutan nada por sí solos.

**Opcional y de pago:** el chat con IA de los agentes necesita una clave de la API de Claude con saldo (ver más abajo). Sin ella, la app funciona igual y lo indica claramente.


## Instalación (Windows, Mac o Linux)

1. Instala [Node.js 22 LTS](https://nodejs.org) (versión 22.13 o superior).
2. Descarga este repositorio (botón verde **Code → Download ZIP**, y descomprímelo) o clónalo con Git.
3. Abre una terminal en la carpeta del proyecto y ejecuta:
   ```bash
   npm install
   ```
4. (Opcional, de pago) Configura tu clave de Claude (ver abajo).
5. Inicia la app:
   ```bash
   npm run dev
   ```
6. Abre **http://localhost:5173** en tu navegador.

Para detenerla: `Ctrl + C` en la terminal.

**Si `npm install` muestra `npm warn install-scripts`:** las versiones nuevas de npm bloquean la descarga automática de FFmpeg (necesario para el estudio de video). Ejecuta una sola vez:
```bash
npm install-scripts approve ffmpeg-static
npm rebuild ffmpeg-static
```

## Ver la oficina desde el celular (misma red Wi-Fi)

1. En la laptop, en lugar de `npm run dev`, ejecuta:
   ```bash
   npm run celular
   ```
2. La ventana negra muestra una dirección como `http://192.168.1.25:5173` y un **PIN de acceso**.
3. Si Windows pregunta por el **Firewall**, marca **Redes privadas** y pulsa **Permitir acceso**.
4. En el celular, conectado al **mismo Wi-Fi**, abre esa dirección en Chrome o Safari y escribe el PIN.

Solo funciona dentro de tu red de casa u oficina. Desde datos móviles o fuera de casa no se puede todavía (eso requiere publicar la app en internet). La laptop debe estar encendida con la app abierta.

## (Opcional, de pago) Cómo activar el chat con IA

1. Entra a **https://console.anthropic.com** y crea una cuenta (no es la misma que claude.ai).
2. En **Settings → Billing**, agrega saldo prepagado (por ejemplo, US$ 10). Sin saldo, la API no responde.
3. En **Settings → API Keys**, pulsa **Create Key**, ponle un nombre (por ejemplo "Mi Agencia IA") y **copia la clave**. Empieza con `sk-ant-` y solo se muestra una vez.
4. En la carpeta del proyecto, copia el archivo `.env.example` y renombra la copia a `.env`.
   - Windows: si el Explorador no te deja, usa la terminal: `copy .env.example .env`
   - Mac/Linux: `cp .env.example .env`
5. Abre `.env` con el Bloc de notas y pega tu clave después de `ANTHROPIC_API_KEY=` (sin comillas ni espacios).
6. Reinicia la app (`Ctrl + C` y otra vez `npm run dev`).
7. En la oficina abre **Integraciones** (icono del enchufe) y pulsa **Verificar conexión**. Debe decir **Conectado**.

**Seguridad**
- La clave solo vive en tu computadora, dentro de `.env`. Ese archivo no se sube a GitHub y el navegador nunca la ve.
- No compartas la clave ni la pegues en chats. Si se filtra, revócala en la consola y crea otra.
- En **Settings → Limits** de la consola puedes fijar un tope de gasto mensual.

## Costos

Con `claude-opus-5-5` (US$ 4 por millón de tokens de entrada y US$ 20 por millón de salida), una respuesta típica cuesta entre US$ 0.01 y US$ 0.05. En **Integraciones** ves el gasto estimado del mes. La factura real está en console.anthropic.com. Si quieres gastar menos, cambia `AGENT_MODEL` a `claude-sonnet-5-5` en `.env`.

## Estructura

```
web/        Interfaz (React + TypeScript + Vite + Tailwind + React Three Fiber)
server/     Servidor local (Node + Fastify + SQLite integrado + SDK de Anthropic)
data/       Base de datos, logotipos, clips y videos exportados (se crea sola; no se sube a GitHub)
.env        Tus claves (lo creas tú a partir de .env.example)
```

Comandos:
- `npm run dev`: servidor y web en modo desarrollo.
- `npm run build`: compila ambos.
- `npm run typecheck`: verificación de tipos.
