# Migración SEAMX: usuario + contraseña nueva con Supabase Auth

## Decisión funcional
El trabajador seguirá introduciendo su identificador existente (`login`, p.ej. `jose.villanueva`) y una contraseña NUEVA. El identificador de texto **no cambia** y las referencias históricas a `usuarios.id` y `*_login` se conservan.

## Arquitectura segura
1. `public.usuarios`: agregar `auth_user_id uuid UNIQUE` y `email text UNIQUE`, sin tocar `id`, `login`, `rol`, `guardia`, `activo` ni registros históricos.
2. El administrador recoge un correo real y verificable de cada usuario para su identidad Auth. No inventar correos ni copiar las contraseñas antiguas. Si se requiere operación sin correo, primero hay que definir y probar un mecanismo equivalente de recuperación administrada.
3. Crear/invitar cada identidad **mediante servidor administrativo** de Supabase Auth; nunca exponer `service_role` en HTML/JS o Netlify público. El administrador asigna contraseña temporal aleatoria, exige cambio inicial y enlaza `auth.users.id` a `usuarios.auth_user_id` con correspondencia auditada `login`↔`email`.
4. Pantalla de acceso conserva `login`. Backend autenticador protegido resuelve `login`→`email` sin exponer un directorio público, y realiza el inicio de sesión Supabase Auth o devuelve un flujo autenticado. Aplicar límites de intento, respuesta uniforme y auditoría sin contraseñas. **No** hacer un `select login,email` público desde navegador, ni derivar un correo ficticio a partir del usuario.
5. Tras recibir el JWT, recuperar el perfil exclusivamente por `auth_user_id = auth.uid()` y `activo = true`. No confiar en `localStorage`, metadatos editables ni el rol enviado por navegador para autorizar acciones.
6. Diseñar y probar políticas RLS por tabla y perfil: operario solo sus actividades, controlador sus registros, supervisor/admin modificaciones permitidas, jefatura/gerencia lectura según requisitos, mantenimiento sus módulos. Probar expresamente acceso lateral por API, no solo botones.
7. Antes de activar RLS en producción, verificar que todos los módulos funcionan en staging, incluidas fotos, firmas, dashboard, ocupabilidad, programación y entrega de guardia.
8. Cambio controlado: asignar nuevas contraseñas, revocar sesiones antiguas, retirar TODAS las consultas a `usuarios.pass`, eliminar la columna `pass` después de verificar el corte y rotar credenciales expuestas. No migrar contraseñas antiguas.

## Verificaciones iniciales (2026-10-27)
- `public.usuarios`: 29 filas.
- `auth.users`: 0 filas.
- `usuarios.login` con formato correo: 0 filas.
- `usuarios.pass`: texto plano (riesgo alto); `usuarios` sin RLS.
- `index.html`: frontend monolítico grande; requiere revisión completa antes de cambiar el formulario/login. No se ha desplegado ni modificado.

## Puertas antes de habilitar Auth en producción
- Copia de seguridad consistente de la BD y plan probado de reversión.
- Correos/identidades de los 29 usuarios obtenidos y validados.
- Prueba real con usuario operador y administrador, y pruebas negativas de todas las funciones.
- Todas las tablas expuestas con políticas RLS correctas y auditadas.
- Nuevo mecanismo de restablecimiento de contraseña y sesiones validado.
- Ventana de puesta en marcha definida; no habilitar autenticación mixta indefinidamente.
