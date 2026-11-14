# MI AGENCIA IA · Oficina virtual

Oficina virtual en 3D donde trabajan tres agentes de IA: **Valeria** (productora audiovisual), **Diego** (community manager) y **Sofía** (asistente comercial).

## Estado: Fase 2 de 7

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Oficina 3D y personajes animados | ✅ |
| 2 | Agentes con IA real, negocios/clientes, integraciones | ✅ |
| 3 | Sistema de tareas y coordinación entre agentes | Pendiente |
| 4 | Generación y edición de video | Pendiente |
| 5 | Calendario editorial y publicación | Pendiente |
| 6 | CRM comercial | Pendiente |
| 7 | Seguridad, pruebas y publicación en internet | Pendiente |

**Qué funciona hoy**
- Oficina 3D con tres personajes animados. La etiqueta, la pantalla del monitor y el panel muestran el **estado real** que informa el servidor: *Disponible*, *Trabajando* (mientras Claude responde) o *Error*.
- **Negocios y clientes**: ficha con logotipo, descripción, productos y servicios, público objetivo, colores, redes y objetivos. Cada negocio tiene sus propias conversaciones y nada se mezcla.
- **Chat con cada agente** usando la API de Claude, con respuestas en vivo y la ficha del negocio como contexto. Cada respuesta muestra los tokens usados y su costo estimado.
- **Integraciones**: estado verificado de Claude (conectado / desconectado / error de autenticación / permisos insuficientes) y requisitos de las integraciones de las próximas fases.
- **Bitácora de actividad** por agente: respuestas, errores y cambios en negocios.
- Sonidos opcionales y diseño adaptable a celular.

Los agentes todavía **no** generan videos, no publican y no envían mensajes; lo dicen claramente si se les pide.

## Instalación (Windows, Mac o Linux)

1. Instala [Node.js 22 LTS](https://nodejs.org) (versión 22.13 o superior).
2. Descarga este repositorio (botón verde **Code → Download ZIP**, y descomprímelo) o clónalo con Git.
3. Abre una terminal en la carpeta del proyecto y ejecuta:
   ```bash
   npm install
   ```
4. Configura tu clave de Claude (ver abajo).
5. Inicia la app:
   ```bash
   npm run dev
   ```
6. Abre **http://localhost:5173** en tu navegador.

Para detenerla: `Ctrl + C` en la terminal.

## Cómo obtener y guardar tu clave de Claude

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
data/       Base de datos y logotipos (se crea sola; no se sube a GitHub)
.env        Tus claves (lo creas tú a partir de .env.example)
```

Comandos:
- `npm run dev`: servidor y web en modo desarrollo.
- `npm run build`: compila ambos.
- `npm run typecheck`: verificación de tipos.
