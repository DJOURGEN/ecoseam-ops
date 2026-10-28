// Aprovisionamiento SEAMX mediante API Auth ADMINISTRATIVA (solo en equipo privado).
// Dry run por defecto. NUNCA introducir SUPABASE_SERVICE_ROLE_KEY en GitHub o navegador.
import { readFileSync, statSync } from "node:fs";

const base=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
const key=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
const domain=(process.env.SEAMX_AUTH_ALIAS_DOMAIN||"").trim().toLowerCase();
const file=process.env.SEAMX_NEW_PASSWORDS_FILE||"";
const apply=process.argv.includes("--apply");
if(!base.startsWith("https://") || !key ||
 !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain) ||
 domain.endsWith(".invalid")||domain.endsWith(".local")||domain==="example.com")
 throw Error("Faltan URL, clave administrativa o un dominio REAL bajo control de ECOSEAM.");
if(!file)throw Error("Falta SEAMX_NEW_PASSWORDS_FILE.");
if(apply && process.env.SEAMX_PROVISION_CONFIRM!=="MIGRAR_CUENTAS_SEAMX")
 throw Error("La escritura exige confirmación explícita.");
if(process.platform!=="win32" && (statSync(file).mode&0o077)!==0)
 throw Error("Proteger archivo JSON: chmod 600.");
const secrets=JSON.parse(readFileSync(file,"utf8"));
async function api(method,path,body=undefined,prefer=undefined){
 const res=await fetch(base+path,{method,headers:{apikey:key,Authorization:"Bearer "+key,
  "Content-Type":"application/json",...(prefer?{Prefer:prefer}:{})},
  body:body===undefined?undefined:JSON.stringify(body)});
 if(!res.ok)throw Error("Solicitud administrativa HTTP "+res.status+" en "+path.split("?")[0]);
 const raw=await res.text();return raw?JSON.parse(raw):null;
}
const profiles=await api("GET","/rest/v1/usuarios?select=id,login,activo,auth_user_id&order=id.asc");
const authList=await api("GET","/auth/v1/admin/users?page=1&per_page=200");
const existingById=new Map((authList.users||[]).map(u=>[u.id,u]));
const existingByEmail=new Map((authList.users||[]).map(u=>[u.email?.toLowerCase(),u]));
const active=profiles.filter(p=>p.activo===true);
const pending=active.filter(p=>!p.auth_user_id);
if(active.length>100)throw Error("Límite de seguridad: 100 usuarios.");
const usernames=new Set();
for(const p of active){
 if(usernames.has(p.login))throw Error("Nombre de usuario duplicado.");
 usernames.add(p.login);
 if(!Number.isSafeInteger(Number(p.id)))throw Error("ID de usuario inválido.");
 if(p.auth_user_id){
  const existing=existingById.get(p.auth_user_id);
  if(!existing)throw Error("El vínculo Auth existente de "+p.login+" no se encuentra.");
  continue; // El admin ya migrado nunca se duplica ni cambia de contraseña.
 }
 const passwd=secrets[p.login];
 if(typeof passwd!=="string" || passwd.length<12 || passwd.length>128)
  throw Error("Falta contraseña nueva de 12-128 caracteres para "+p.login);
 const email="seamx-"+p.id+"@"+domain;
 const existing=existingByEmail.get(email);
 if(existing && (existing.app_metadata?.seamx_profile_id!==p.id ||
   existing.app_metadata?.seamx_login!==p.login))
  throw Error("Alias técnico existente sin correspondencia verificable: "+p.login);
}
for(const username of Object.keys(secrets)){
 if(!pending.some(p=>p.login===username))
  throw Error("Credenciales excedentes/no activas en el archivo: "+username);
}
console.log("Cuentas activas:",active.length,"Ya enlazadas:",active.length-pending.length,"Pendientes:",pending.length);
console.log("Modo:",apply?"ESCRITURA CONTROLADA":"SOLO LECTURA");
if(!apply){console.log("Validación completada. No se ha creado ni cambiado ninguna cuenta.");process.exit(0);}
for(const p of pending){
 const email="seamx-"+p.id+"@"+domain;
 let user=existingByEmail.get(email);
 if(!user){
  const result=await api("POST","/auth/v1/admin/users",{
   email,password:secrets[p.login],email_confirm:true,
   app_metadata:{seamx_profile_id:p.id,seamx_login:p.login}
  });
  user=result?.user??result;
  if(!user?.id)throw Error("No se recibió UID para "+p.login);
 }
 await api("PATCH","/rest/v1/usuarios?id=eq."+p.id,{auth_user_id:user.id},"return=minimal");
 await api("POST","/rest/v1/seamx_auth_aliases?on_conflict=usuario_id",{
  usuario_id:p.id,login:p.login,auth_email:email,auth_user_id:user.id
 },"resolution=merge-duplicates,return=minimal");
 console.log("Enlazado:",p.login);
}
console.log("Cuentas aprovisionadas. NO activar frontend antes de completar políticas RLS y pruebas.");
