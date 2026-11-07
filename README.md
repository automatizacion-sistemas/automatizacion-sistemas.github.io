# Automatización & Sistemas — Portafolio comercial

Sitio web de **Jorge Luis Acaro Córdova**: *"Transformo procesos manuales en soluciones digitales inteligentes"*.

Es un sitio estático (HTML, CSS y JavaScript sin frameworks) que se puede publicar en GitHub Pages o en cualquier hosting estático.

## Estructura

```
jorgeluis-portafolio/
├── index.html                 Página principal (inicio, servicios, portafolio, sobre mí, contacto)
├── estilo/index.html          Guía de estilo interna (no se indexa en buscadores)
├── assets/
│   ├── css/  variables.css    Colores, tipografías y espacios de la marca
│   │         base.css         Estilos generales y utilidades
│   │         componentes.css  Botones, tarjetas, formularios, logo
│   │         secciones.css    Estilos de cada sección de la página principal
│   ├── js/   config.js        ← WhatsApp y clave de Web3Forms (lo único que hay que editar)
│   │         main.js          Menú, animaciones, enlaces de WhatsApp
│   │         portafolio.js    Genera las tarjetas desde data/proyectos.js
│   │         contacto.js      Validación y envío real del formulario
│   ├── fonts/                 Plus Jakarta Sans e Inter (licencia SIL OFL)
│   └── img/                   Logotipo, firma, capturas de las demos
├── data/proyectos.js          Las 8 tarjetas del portafolio
├── demos/
│   ├── comun/                 Piezas compartidas: motor SQLite, tablas, gráficos, estilos y librerías
│   ├── inventario/            Demo: sistema de inventarios (ver su README)
│   ├── ventas/                Demo: ventas y cobranzas (ver su README)
│   ├── asistencia/            Demo: control de asistencia (ver su README)
│   ├── personal/              Demo: gestión de personal (ver su README)
│   └── finanzas/              Demo: control de ingresos y gastos (ver su README)
└── README.md
```

## Ver el sitio en tu computadora

```bash
cd jorgeluis-portafolio
python -m http.server 8000
```

Abre `http://localhost:8000`. La página principal también funciona abriendo `index.html` con doble clic, pero las demos necesitan el servidor local.

## Configuración

Edita `assets/js/config.js`:

- `whatsapp`: número en formato internacional, sin "+" (ejemplo: `51901288798`).
- `web3formsKey`: Access Key de [Web3Forms](https://web3forms.com). Los mensajes del formulario llegan al correo con el que te registraste. Esta clave es **pública por diseño**: no es una contraseña.

## Agregar o activar una demo

En `data/proyectos.js`, cambia el proyecto a:

```js
estado: "disponible",
demo: "demos/nombre-carpeta/",
captura: "assets/img/capturas/nombre.webp",
```

## Publicar en GitHub Pages

1. Crea un repositorio y sube el contenido de esta carpeta (la raíz debe contener `index.html`).
2. En el repositorio, entra a **Settings → Pages → Source: Deploy from a branch → main / (root)**.
3. En 1 o 2 minutos el sitio estará disponible en `https://USUARIO.github.io/REPOSITORIO/`.
4. En Web3Forms, actualiza el "Website URL" del formulario con la dirección final.
5. Envía un mensaje de prueba desde el sitio publicado y confirma que te llega al correo.

## Seguridad

- No hay contraseñas ni credenciales en el código: la clave de Web3Forms es pública por diseño.
- El formulario tiene validación y un campo trampa contra spam (`botcheck`).
- Las demos guardan los datos solo en el navegador del visitante.

## Licencias de terceros

- Íconos [Lucide](https://lucide.dev) (ISC).
- Tipografías Plus Jakarta Sans e Inter (SIL OFL 1.1).
- Librerías de las demos: ver `demos/comun/lib/LICENCIAS.txt`.
