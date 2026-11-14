# MI AGENCIA IA · Oficina virtual

Oficina virtual en 3D donde trabajan tres agentes de IA: **Valeria** (productora audiovisual), **Diego** (community manager) y **Sofía** (asistente comercial).

> Esta carpeta es temporal: el proyecto se moverá a su propio repositorio (`mi-agencia-ia`).

## Estado actual: Fase 1 de 7 (oficina virtual)

Incluye:
- Oficina 3D con escritorios, monitores, sillas, cubículos, lámparas, ventanas, estantería, estación de café, sala de reuniones y plantas.
- Tres personajes originales animados: escriben, respiran y hacen pausas para mirar alrededor.
- Etiqueta flotante y pantalla del monitor con el **estado real** de cada agente. Por ahora, "Disponible · 0 tareas".
- Clic en un personaje, en su etiqueta o en la barra inferior: la cámara se acerca y se abre su ficha (bandeja, especialidad, funciones, integraciones, historial).
- Sonidos de interfaz opcionales (desactivados por defecto; la preferencia se recuerda) y botón de vista general.
- Diseño adaptable: panel lateral en escritorio y hoja inferior en celular.

Todavía **no** hay tareas, IA ni integraciones; esas partes llegan a partir de la Fase 2. Las animaciones son ilustrativas y no representan trabajo en curso.

## Cómo ejecutarlo en tu computadora

Requisitos: [Node.js 20 o superior](https://nodejs.org).

```bash
cd agencia-ia
npm install
npm run dev
```

Luego abre http://localhost:5173

Otros comandos:
- `npm run build`: compila la versión de producción en `dist/`.
- `npm run preview`: sirve esa versión compilada.

## Tecnología

React 18 · TypeScript · Vite · Tailwind CSS · React Three Fiber + drei (Three.js) · Zustand.
Todas las texturas y sonidos se generan en el código: la oficina no descarga nada de internet.

## Estructura

```
src/
  data/agents.ts          Identidad, funciones e integraciones de cada agente
  store/useOfficeStore.ts Estado real de los agentes, selección, sonido
  scene/                  Oficina 3D (sala, puestos, personajes, cámara, texturas)
  ui/                     Barra del equipo, ficha del agente, avatares
  lib/sound.ts            Sonidos sintetizados con Web Audio
```
