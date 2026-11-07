# Demo · Sistema de gestión de personal

Demostración funcional para un área de Recursos Humanos de una empresa ficticia, "Comercial Los Andes SAC", con 22 trabajadores inventados. Funciona **completamente en el navegador**, con SQLite real.

> Las reglas laborales son **referenciales** (régimen laboral privado del Perú) y sirven para mostrar cómo un sistema puede anticipar contingencias. En una implementación real se ajustan a la situación de cada empresa con su asesor laboral.

## Qué hace

| Módulo | Funciones |
|---|---|
| **Panel y alertas** | Trabajadores activos, planilla mensual, alertas críticas, contratos por renovar y rotación de los últimos 12 meses; lista de alertas por prioridad, cada una con su acción; personal por área; cumpleaños del mes |
| **Personal** | Directorio en tarjetas, con búsqueda y filtros por área, tipo de contrato y estado; **legajo digital** con datos personales y laborales, historial de contratos, periodos vacacionales y documentos entregados o pendientes; alta, edición y cese |
| **Contratos** | Contratos vigentes ordenados por urgencia, plazo fijo acumulado y sueldo frente a la RMV; renovación con atajos de 3, 6 y 12 meses |
| **Vacaciones** | Récord vacacional por trabajador: periodos ganados, saldo, días truncos y estado (al día, por vencer o vencidas); registro de vacaciones |

## Reglas que aplica

- **RMV por fecha:** S/ 1 130 desde el 01/01/2025 y S/ 1 230 desde el 01/10/2026 (D.S. 015-2026-TR). La tabla `RMV` en `js/db.js` permite agregar el siguiente tramo (S/ 1 300, previsto para el primer semestre de 2027).
- **Periodo de prueba:** 3 meses desde el ingreso; se avisa 15 días antes de que termine.
- **Contratos a plazo fijo:** se avisa 30 días antes del vencimiento; se marca como crítico si el trabajador sigue laborando con el contrato vencido; se avisa cuando la suma de contratos a plazo fijo pasa de 4,5 años y se bloquea un contrato que supere los 5 años.
- **Vacaciones:** 30 días por cada año completo de servicios. Cada periodo debe gozarse dentro del año siguiente; si vence con saldo, se alerta el riesgo de indemnización vacacional. Los días gozados se descuentan del periodo más antiguo. No se pueden tomar más días que el saldo ganado, y los bloques de menos de 7 días piden confirmar que hay un acuerdo escrito.
- **Edad mínima:** 18 años (16 para modalidades formativas).
- **Legajo:** 7 documentos obligatorios (DNI, CV, antecedentes policiales, declaración jurada de domicilio, contrato firmado, elección de sistema de pensiones y alta en T-Registro).

## Modelo de datos

```sql
trabajadores (id, dni UNIQUE, nombres, apellidos, nacimiento, telefono, correo, area, cargo,
              pension, ingreso, cese_fecha, cese_motivo)
contratos    (id, trabajador_id → trabajadores, tipo, inicio, fin, sueldo)
vacaciones   (id, trabajador_id → trabajadores, desde, hasta, dias, observacion)
documentos   (trabajador_id → trabajadores, documento, entregado, fecha)
```

## Archivos

```
personal/
├── index.html            Pantallas y diálogos
├── css/personal.css      Tarjetas, legajo, avatares y estados
├── js/db.js              Tablas, reglas laborales, alertas, récord vacacional
├── js/datos-ejemplo.js   Datos ficticios con casos para cada alerta
└── js/app.js             Lógica de cada pantalla
```

Para ejecutarla en tu computadora, sirve la carpeta del proyecto con `python -m http.server 8000` y abre `http://localhost:8000/demos/personal/`.
