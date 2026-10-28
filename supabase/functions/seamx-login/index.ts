// SEAMX | Pasarela de inicio de sesión por usuario para Supabase Auth.
// No desplegar sin ejecutar SQL preparatorio, cargar alias en Auth,
// configurar secretos y cerrar RLS de todos los módulos.
// Requiere npm:@supabase/supabase-js@2.95.0 (versión fijada).
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const url = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const auditSalt = Deno.env.get("SEAMX_LOGIN_RATE_SALT") || serviceKey;
const origins = (Deno.env.get("SEAMX_ALLOWED_ORIGINS") || "https://ecoseam.netlify.app")
  .split(",").map((value) => value.trim()).filter(Boolean);

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function reply(payload: unknown, status: number, origin: string | null): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
  });
  if (origin && (origins.includes(origin) || /^https:\/\/deploy-preview-\d+--ecoseam\.netlify\.app$/.test(origin))) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "content-type, authorization, apikey, x-client-info");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

async function fingerprint(text: string): Promise<string> {
  // HMAC para que IPs y usuarios no queden guardados en texto plano.
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(auditSalt),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(text),
  ));
  return Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
}

async function consumeAttempt(username: string, ip: string): Promise<boolean> {
  const loginHash = await fingerprint("login:" + username);
  const ipHash = await fingerprint("ip:" + ip);
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const [byLogin, byIp] = await Promise.all([
    admin.from("seamx_login_attempts").select("id", { head: true, count: "exact" })
      .eq("login_hash", loginHash).gte("creado_en", since),
    admin.from("seamx_login_attempts").select("id", { head: true, count: "exact" })
      .eq("ip_hash", ipHash).gte("creado_en", since),
  ]);
  if (byLogin.error || byIp.error) throw new Error("Error de control de intentos");
  if ((byLogin.count ?? 0) >= 7 || (byIp.count ?? 0) >= 35) return false;
  const { error } = await admin.from("seamx_login_attempts")
    .insert({ login_hash: loginHash, ip_hash: ipHash });
  if (error) throw new Error("No se pudo registrar el intento");
  return true;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (!url || !serviceKey || !anonKey || auditSalt.length < 32 || !origins.length) {
    return reply({ error: "Servicio no configurado" }, 503, origin);
  }
  if (!origin || !(origins.includes(origin) || /^https:\/\/deploy-preview-\d+--ecoseam\.netlify\.app$/.test(origin))) {
    return reply({ error: "Origen no autorizado" }, 403, null);
  }
  if (req.method === "OPTIONS") return reply({}, 200, origin);
  if (req.method !== "POST") return reply({ error: "Método no permitido" }, 405, origin);
  if (Number(req.headers.get("content-length") || 0) > 4096) {
    return reply({ error: "Solicitud inválida" }, 413, origin);
  }

  let username: string;
  let password: string;
  try {
    const raw = await req.json();
    username = String(raw?.username || "").trim().toLowerCase();
    password = typeof raw?.password === "string" ? raw.password : "";
    if (!/^[\p{L}\p{N}._-]{2,80}$/u.test(username) ||
        password.length < 8 || password.length > 256) {
      return reply({ error: "Usuario o contraseña incorrectos" }, 401, origin);
    }
  } catch {
    return reply({ error: "Solicitud inválida" }, 400, origin);
  }

  try {
    // Supabase Auth incluye sus propios límites de contraseña por identidad;
    // este control agrega un umbral básico por usuario e IP.
    const forwarded = req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!await consumeAttempt(username, forwarded)) {
      return reply({ error: "Demasiados intentos; intenta más tarde" }, 429, origin);
    }

    // Consulta privilegiada solo en servidor, nunca en el navegador.
    const { data: alias, error: aliasError } = await admin
      .from("seamx_auth_aliases").select("usuario_id,login,auth_email,auth_user_id")
      .eq("login", username).maybeSingle();
    if (aliasError) throw aliasError;
    if (!alias) return reply({ error: "Usuario o contraseña incorrectos" }, 401, origin);

    const { data: profile, error: profileError } = await admin
      .from("usuarios").select("id,auth_user_id,activo").eq("id", alias.usuario_id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || !profile.activo || profile.auth_user_id !== alias.auth_user_id) {
      return reply({ error: "Usuario o contraseña incorrectos" }, 401, origin);
    }

    // Cliente distinto al privilegiado: inicio de sesión contra GoTrue.
    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await authClient.auth.signInWithPassword({
      email: alias.auth_email, password,
    });
    if (error || !data.session || data.user?.id !== alias.auth_user_id) {
      return reply({ error: "Usuario o contraseña incorrectos" }, 401, origin);
    }
    return reply({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      token_type: "bearer",
    }, 200, origin);
  } catch {
    // Nunca registrar contraseñas ni tokens en logs.
    return reply({ error: "No se pudo iniciar sesión" }, 503, origin);
  }
});
