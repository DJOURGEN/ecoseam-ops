-- SEAMX: preparación NO destructiva de migración a Supabase Auth.
-- NO ejecutar en producción sin copia de seguridad y revisión del flujo de login.
-- No crea cuentas ni modifica contraseñas. Mantiene todas las relaciones históricas por id/login.
BEGIN;
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS email text;
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_auth_user_id_unique
  ON public.usuarios(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_lower_unique
  ON public.usuarios(lower(email)) WHERE email IS NOT NULL;
-- El correo y auth_user_id se rellenarán con valores verificados durante la migración.
-- NO activar RLS todavía: exige políticas específicas para cada tabla y rol.
-- NO eliminar public.usuarios.pass todavía: el inicio de sesión antiguo sigue en uso.
COMMIT;
