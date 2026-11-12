# Reporte de inspección de instalaciones EXPALSA

Aplicación web accesible desde `inspecciones.html` y desde el portal principal. Utiliza la app web Firebase existente `EXPALSA Calidad` del proyecto `oceantreasure-app`.

## Funciones

- Inicio con indicadores de cumple, no cumple, parcial y nuevas observaciones; distribuciones por área y lista reciente.
- Secciones para Planta, Exteriores, Bodegas, Desechos, Despacho, Otros y General.
- Historial con búsqueda, estado, departamento, periodo y orden cronológico.
- Alta y actualización de hallazgos con fecha, ubicación, responsable, seguimiento y estado.
- Captura desde cámara trasera del dispositivo o selección de imágenes. Las imágenes se convierten a JPEG y se guardan en Firebase Storage; las observaciones se guardan en Firestore.
- Exportación PDF por la pestaña actual, con tabla y miniaturas de las evidencias disponibles.
- Acceso con cuentas EXPALSA existentes que estén aprobadas como inspector o administrador. No se habilita el registro de cuentas desde esta pantalla.

## Datos y reglas

- Firestore: colección `expalsa_calidad_inspecciones` en la base `(default)`.
- Storage: objetos bajo `expalsa_inspecciones/{uid}/{inspectionId}/{photoFile}`.
- `firestore.rules` y `storage.rules` parten de las reglas vigentes de Firebase e incorporan validación de esquema, autorización de cuentas existentes y restricciones para fotos JPEG.
- La interfaz importa `firebase-config.js`, existente en este repositorio. La configuración web no contiene credenciales privadas.
- Los cuatro PDF fuente describen hallazgos previos; no se insertan automáticamente en producción. La aplicación inicia sin modificar datos y presenta el dashboard conforme se registren las observaciones.

## Firebase Hosting

`firebase.json` apunta al sitio Hosting existente `oceantreasure-app` y al repositorio completo como contenido estático. El sitio no se publica al guardar el código. Para publicar cambios de reglas y sitio, primero revisa el diff y despliega deliberadamente con Firebase CLI.

```powershell
firebase deploy --only firestore:rules,storage
firebase deploy --only hosting
```

