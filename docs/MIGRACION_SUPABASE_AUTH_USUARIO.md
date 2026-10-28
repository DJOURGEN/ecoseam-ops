# SEAMX: migración de acceso por NOMBRE DE USUARIO a Supabase Auth

## Decisión confirmada
Los trabajadores **solo usan nombres de usuario**. SEAMX conserva el formulario `login` + contraseña NUEVA, sin solicitar correos personales.

**Limitación de Supabase:** Auth NO admite usuario+contraseña de forma nativa; el login de contraseña se asocia a un correo o teléfono. Para conservar la UX de SEAMX se crea una **identidad técnica no personal**, con alias de correo en un dominio REAL controlado por la organización, y una pasarela Edge que lo resuelve en servidor. Los empleados nunca verán ni ingresarán ese alias.

## Archivos propuestos (todos en rama de preparación; NO DESPLEGADOS)
- `supabase/migrations-preparacion/01_preparar_auth_usuarios.sql`: columna `usuarios.auth_user_id` + tablas protegidas `seamx_auth_aliases` y `seamx_login_attempts`. Mantiene `usuarios.id`, `login`, `rol`, `guardia`, `activo` e históricos.
- `supabase/functions/seamx-login/index.ts`: función que recibe `{username,password}`, resuelve alias con clave de servidor, autentica contra Supabase Auth, comprueba perfil activo y devuelve una sesión. HMAC de usuario/IP para límites básicos; errores genéricos y CORS explícito.
- `supabase/config.toml`: autoriza invocación de `seamx-login` sin JWT inicial (requerido para iniciar sesión).
- `scripts/seamx-provision-auth.mjs`: preparación de cuentas desde un equipo administrativo, con **modo solo validación por defecto**; la opción `--apply` requiere confirmación y variables de entorno.

## Fase 1: seguridad antes del corte
1. Respaldar BD íntegra, confirmar restauración y revisar todas las dependencias de `usuarios.pass` en `index.html` y módulos.
2. Conseguir un subdominio real de uso administrativo controlado por ECOSEAM, para alias del tipo `seamx-<ID>@<dominio>` (sin buzón para el trabajador). No usar dominios públicos ajenos, inventados ni personales.
3. Aplicar y comprobar el SQL **en entorno de ensayo** antes de producción. No activar RLS inmediatamente en `usuarios` sin reemplazar previamente el login legado.
4. Establecer un correo técnico/identidad Auth por usuario ACTIVO, con contraseñas nuevas, individuales y fuertes. Nunca reutilizar el valor de `usuarios.pass`.
5. Definir mecanismo administrativo de recuperación de contraseña: como no hay buzón del empleado, no funciona el restablecimiento por email; un administrador autorizado deberá verificar identidad y asignar una contraseña nueva de forma privada.

## Fase 2: aprovisionamiento de cuentas
El archivo local de contraseñas **NO puede subirse al repositorio ni enviarse por chat**:
```json
{
  "jose.villanueva": "UNA_CONTRASEÑA_NUEVA_FUERTE_Y_UNICA",
  "otro.usuario": "OTRA_CONTRASEÑA_NUEVA_FUERTE_Y_UNICA"
}
```
Debe incluir una contraseña nueva para cada usuario ACTIVO. En Linux/macOS: `chmod 600 /ruta/clave-usuarios.json`.

Variables necesarias en equipo administrativo:
- `SUPABASE_URL` (URL real del proyecto).
- `SUPABASE_SERVICE_ROLE_KEY` (secreta, solo equipo administrativo o entorno servidor).
- `SEAMX_AUTH_ALIAS_DOMAIN` (subdominio real controlado por ECOSEAM, por ejemplo, un nombre propio que de verdad posea; no inventarlo).
- `SEAMX_NEW_PASSWORDS_FILE` (ruta local al archivo JSON).

Modo de comprobación: `node scripts/seamx-provision-auth.mjs`.
Modo de escritura solo tras revisión: `SEAMX_PROVISION_CONFIRM=MIGRAR_CUENTAS_SEAMX node scripts/seamx-provision-auth.mjs --apply`.
**No ejecutar --apply actualmente**: requiere aprobación de esquema en staging y políticas de seguridad. El script utiliza la API administrativa para crear cuentas de Auth y asociar `auth_user_id` sin alterar registros históricos.

## Fase 3: servidor y navegador
Configurar secretos de la función `seamx-login`:
- `SEAMX_ALLOWED_ORIGINS`: orígenes completos y exactos de Netlify/ensayo separados por coma.
- `SEAMX_LOGIN_RATE_SALT`: cadena aleatoria de al menos 32 caracteres.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: Supabase facilita variables en su infraestructura; nunca copiar una clave secreta a `index.html`.

La pantalla SEAMX conservará login+contraseña, hará POST al endpoint, y tras éxito inicializará el SDK cliente con `supabase.auth.setSession({access_token,refresh_token})`. El perfil y permiso efectivo deben resolverse por `usuarios.auth_user_id = auth.uid()` y `activo=true`; nunca por el rol que declare el navegador. Al cerrar sesión, `supabase.auth.signOut()`. **La integración de `index.html` todavía NO está implementada**; su archivo actual supera 1,6 MB y no se ha modificado.

## Fase 4: políticas de permisos y pruebas
- Proteger `usuarios` con RLS y limitar columnas confidenciales; no exponer passwords ni alias técnicos.
- Todas las tablas expuestas del sistema deben tener RLS con políticas específicas para Operario, Controlador, Supervisor, Administrador, Jefatura, Gerencia y Mantenimiento. `TO authenticated` a secas NO es autorización suficiente.
- Verificar los flujos: actividad propia, aprobación, fotografía, firmas, programación diaria, patio, ocupabilidad, mantenimiento, dashboards y demás módulos; probar que usuarios no autorizados tampoco accedan por API.
- Atender hallazgos actuales del Security Advisor: RLS ausente en `usuarios`, `actividades`, `programaciones_diarias` y `mantenimiento_registros`; vistas `SECURITY DEFINER` expuestas.
- Probar reconexión de sesiones y acceso en móvil/PWA.
- Solo entonces cambiar a Auth en producción, rotar todas las contraseñas antiguas expuestas, revocar sesiones, retirar consultas a `pass` y eliminar esa columna cuando no la utilice ninguna función.

## Estado verificado
Al revisar el proyecto: `public.usuarios` tiene 29 filas, `auth.users` tiene 0 filas. **Ninguna contraseña se ha cambiado ni ninguna cuenta se ha migrado todavía**. La rama contiene preparación, no un despliegue operativo. No fusionar la PR hasta superar la validación técnica y de seguridad.

Referencias:
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/users
- https://supabase.com/docs/guides/database/postgres/row-level-security
