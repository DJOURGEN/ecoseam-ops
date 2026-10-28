-- PREPARACIÓN (NO EJECUTADA) DE LOGIN POR NOMBRE DE USUARIO.
-- La tabla histórica mantiene id, login, rol, guardia y registros relacionados.
BEGIN;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS auth_user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_auth_user_id_unique
  ON public.usuarios(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Tabla interna: el navegador NUNCA consulta los alias técnicos.
CREATE TABLE IF NOT EXISTS public.seamx_auth_aliases (
  usuario_id bigint PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  login text NOT NULL UNIQUE,
  auth_email text NOT NULL UNIQUE,
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  creado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.seamx_auth_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seamx_auth_aliases FROM anon, authenticated;

-- Limitación adicional de intentos en Edge Function; sin acceso público a la tabla.
CREATE TABLE IF NOT EXISTS public.seamx_login_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  login_hash text NOT NULL,
  ip_hash text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seamx_login_attempts_login_idx
  ON public.seamx_login_attempts(login_hash, creado_en DESC);
CREATE INDEX IF NOT EXISTS seamx_login_attempts_ip_idx
  ON public.seamx_login_attempts(ip_hash, creado_en DESC);
ALTER TABLE public.seamx_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seamx_login_attempts FROM anon, authenticated;
-- Service role solo en la función servidor: nunca publicar su clave en index.html.
COMMIT;
-- No ejecutar el resto del corte aún: revisar políticas RLS de los módulos,
-- probar acceso y reemplazar login legado antes de retirar usuarios.pass.
