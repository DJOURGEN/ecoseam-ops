# Firma de liderazgo con Supabase Auth

Estado verificado el 28/10/2026: 26 cuentas de Auth vinculadas a 26 perfiles activos. La aplicación publicada usa login legado sin JWT; `firmas-liderazgo.js` exige `db.auth.getUser()`, por lo que no habilita la firma.

También `liderazgo.js` persiste evaluaciones en localStorage y no genera solicitudes en `liderazgo_solicitudes_firma`. Al recuperar el acceso autenticado se deberá sincronizar cada evaluación y crear una solicitud al supervisor correcto. Nunca crear cuentas adicionales ni generar firmas automáticamente.

Riesgo crítico: las tablas `usuarios`, `actividades`, `programaciones_diarias` y `mantenimiento_registros` aún carecen de RLS. No fusionar el inicio de sesión completo sin revisar sus políticas.
