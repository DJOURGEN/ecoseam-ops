// Ejecutar solo en un equipo administrativo, nunca en el navegador ni en Netlify.
// Node 20+. DRY RUN por defecto; --apply requiere confirmación explícita.
// Archivo JSON de secretos (NUNCA subir a Git): {"jose.villanueva":"contraseña larga nueva", ...}
import { readFileSync, statSync } from "node:fs";

const base = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const domain = (process.env.SEAMX_AUTH_ALIAS_DOMAIN || "").trim().toLowerCase();
const filePath = process.env.SEAMX_NEW_PASSWORDS_FILE || "";
const apply = process.argv.includes("--apply");

if (!base.startsWith("https://") || !key ||
    !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain) ||
    domain.endsWith(".invalid") || domain.endsWith(".local") ||
    domain === "example.com") {
  throw Error("Falta URL, service role key o dominio técnico REAL bajo control de ECOSEAM.");
}
if (!filePath) throw Error("Falta SEAMX_NEW_PASSWORDS_FILE con credenciales nuevas.");
if (apply && process.env.SEAMX_PROVISION_CONFIRM !== "MIGRAR_CUENTAS_SEAMX") {
  throw Error("Para escribir, usar --apply y SEAMX_PROVISION_CONFIRM=MIGRAR_CUENTAS_SEAMX.");
}
const stat = statSync(filePath);
if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) {
  throw Error("El archivo de contraseñas debe tener permisos 600 (chmod 600).");
}
const secrets = JSON.parse(readFileSync(filePath, "utf8"));

async function api(method, path, body = undefined, prefer = undefined) {
  const res = await fetch(base + path, {
    method,
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw Error("Error HTTP " + res.status + " al solicitar " + path.split("?")[0]);
  const raw = await res.text();
  return raw ? JSON.parse(raw) : null;
}

const profiles = await api("GET", "/rest/v1/usuarios?select=id,login,activo,auth_user_id&order=id.asc");
const authList = await api("GET", "/auth/v1/admin/users?page=1&per_page=100");
const current = new Map((authList.users || []).map((u) => [u.email?.toLowerCase(), u]));

const pending = profiles.filter((p) => p.activo !== false);
if (pending.length > 100) throw Error("Script preparado para máximo 100 usuarios por ejecución.");
const names = new Set();
for (const p of pending) {
  if (names.has(p.login)) throw Error("Login duplicado en origen.");
  names.add(p.login);
  if (!Number.isSafeInteger(Number(p.id))) throw Error("ID de usuario inválido.");
  if (typeof secrets[p.login] !== "string" || secrets[p.login].length < 12 ||
      secrets[p.login].length > 128) {
    throw Error("Falta una contraseña nueva (12-128 caracteres) para " + p.login);
  }
  const alias = "seamx-" + p.id + "@" + domain;
  const existing = current.get(alias);
  if (p.auth_user_id && existing?.id !== p.auth_user_id) {
    throw Error("Identidad existente no coincide para " + p.login + ". Revisar antes de continuar.");
  }
}
console.log("Cuentas activas a revisar: " + pending.length);
console.log("Modo: " + (apply ? "ESCRITURA CONTROLADA" : "SOLO REVISIÓN"));
if (!apply) {
  console.log("Validación superada. Para crear cuentas ejecutar --apply con confirmación explícita.");
  process.exit(0);
}

for (const p of pending) {
  const email = "seamx-" + p.id + "@" + domain;
  let linked = current.get(email)?.id || null;
  if (!linked) {
    const created = await api("POST", "/auth/v1/admin/users", {
      email,
      password: secrets[p.login],
      email_confirm: true, // Cuenta técnica administrada; no hay buzón para confirmación.
    });
    linked = created?.id;
    if (!linked) throw Error("No se recibió el ID Auth para " + p.login);
  }
  if (p.auth_user_id && p.auth_user_id !== linked) {
    throw Error("Conflicto de ID Auth para " + p.login);
  }
  // Idempotente: si un paso falla, repetir después de resolver el error.
  await api("PATCH", "/rest/v1/usuarios?id=eq." + p.id,
    { auth_user_id: linked }, "return=minimal");
  await api("POST", "/rest/v1/seamx_auth_aliases?on_conflict=usuario_id", {
    usuario_id: p.id,
    login: p.login,
    auth_email: email,
    auth_user_id: linked,
  }, "resolution=merge-duplicates,return=minimal");
  console.log("Vínculo preparado: " + p.login);
}
console.log("Identidades enlazadas. AÚN NO retirar contraseñas anteriores ni activar Auth en SEAMX.");
