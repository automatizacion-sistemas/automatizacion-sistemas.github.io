# Demo · Sistema de control de asistencia

Demostración funcional para una empresa ficticia, "Servicios Integrales del Sur SAC", con 18 trabajadores inventados en 4 áreas y 3 horarios. Funciona **completamente en el navegador**, con SQLite real. Las marcaciones usan la hora real del dispositivo.

## Qué hace

| Módulo | Funciones |
|---|---|
| **Hoy** | Programados, presentes, tardanzas, faltas y permisos del día; gráfico de tardanzas y faltas de los últimos 20 días laborables; puntualidad por área; lista del día con filtros |
| **Marcar asistencia** | Quiosco con reloj en vivo: el trabajador escribe su DNI y marca entrada o salida; muestra al instante si llegó puntual o con tardanza, y las horas trabajadas al salir |
| **Registro mensual** | Cuadrícula de trabajadores por días con códigos de color (asistió, tardanza, falta, vacaciones, descanso médico, permiso, licencia, descanso); al tocar un día se ve el detalle, se corrige la marcación con su motivo o se registra un permiso |
| **Reporte para planillas** | Por trabajador: días laborables, asistencias, tardanzas (veces y minutos), faltas, permisos, horas trabajadas, horas extra, puntualidad y descuento referencial; exportación a Excel con un resumen y el detalle diario |
| **Personal y permisos** | Alta y edición de trabajadores (DNI, área, cargo, horario, sueldo, ingreso), bajas, y registro de vacaciones, descansos médicos, permisos y licencias |

## Reglas de calificación

- **Tardanza:** la entrada es posterior a la hora de ingreso más la tolerancia (10 min). Los minutos se cuentan desde la hora de ingreso: llegar 09:11 a un horario de 09:00 son 11 minutos de tardanza, y 09:10 se considera puntual.
- **Falta:** día laborable sin marcación ni permiso. Hoy solo se califica como falta cuando ya pasó la tolerancia; antes figura como "por llegar".
- **Horas trabajadas:** salida − entrada − refrigerio. El refrigerio solo se descuenta en jornadas de más de 5 horas.
- **Horas extra:** tiempo después de la hora de salida, a partir de 15 minutos. Si el trabajador asiste en su día de descanso, todas las horas cuentan como extra.
- **Permisos:** las vacaciones, los descansos médicos y los permisos con goce no generan descuento. La licencia sin goce sí. No se pueden registrar permisos con fechas que se crucen.
- **Correcciones:** exigen un motivo y quedan marcadas como "Corrección", para dejar rastro de auditoría.
- **Descuento referencial:** minuto = sueldo ÷ 30 ÷ 8 ÷ 60; falta o licencia sin goce = sueldo ÷ 30. Las reglas exactas dependen del reglamento interno de cada empresa.

## Modelo de datos

```sql
horarios     (id, nombre, entrada, salida, refrigerio_min, tolerancia_min, dias)
trabajadores (id, dni UNIQUE, nombre, area, cargo, horario_id → horarios, sueldo, ingreso, activo)
marcaciones  (id, trabajador_id → trabajadores, fecha, entrada, salida, origen, observacion,
              UNIQUE(trabajador_id, fecha))
permisos     (id, trabajador_id → trabajadores, tipo, desde, hasta, observacion)
```

## Archivos

```
asistencia/
├── index.html            Pantallas y diálogos
├── css/asistencia.css    Quiosco, cuadrícula mensual y códigos de color
├── js/db.js              Tablas, calificación de cada día, reportes y validaciones
├── js/datos-ejemplo.js   Datos ficticios (dos meses y medio, con hábitos distintos)
└── js/app.js             Lógica de cada pantalla
```

Para ejecutarla en tu computadora, sirve la carpeta del proyecto con `python -m http.server 8000` y abre `http://localhost:8000/demos/asistencia/`.
