# EXPALSA · Sistema de gestión de calidad

El portal incluye la plataforma de evaluación de inspectores y el **Reporte de inspección de instalaciones**.

## Reporte de inspección

Abre [`inspecciones.html`](inspecciones.html) desde el sitio. Usa cuentas EXPALSA existentes y autorizadas.

- Dashboard con indicadores de cumple, no cumple, parcial y nuevas observaciones.
- Vistas de Planta, Exteriores, Bodegas, Desechos, Despacho, Otros y General.
- Historial con filtros por estado, departamento, fechas y texto.
- Evidencia fotográfica desde la cámara trasera o galería, almacenada en Firebase Storage.
- Observaciones sincronizadas en Firestore y exportación PDF AutoTable por vista con miniaturas de las fotos.

El modelo de datos, campos y estados parte de los formularios de inspección de Galpón 1, Galpón 2 y exteriores. Los antecedentes de los PDF no se importan automáticamente.

Consulta [INSPECCIONES.md](INSPECCIONES.md) para arquitectura, reglas y publicación en Firebase.

