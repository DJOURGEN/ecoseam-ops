import { createClient } from "npm:@supabase/supabase-js@2.57.0";
// SEAMX SAFE: los hallazgos son recomendaciones, nunca autorizan el inicio de trabajos.
// No habilitar verify_jwt=false: exige una identidad individual de Supabase Auth.
const HEADERS={"content-type":"application/json","cache-control":"no-store"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:HEADERS});
const rolesLectura=["admin","supervisor","supervisor_hse","jefatura","gerencia"];
function validImage(value:unknown):value is string{
 return typeof value==="string" && /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value) && value.length<=5500000;
}
function appKey(secret:string):string{return Deno.env.get(secret)||"";}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({error:"Método no permitido"},405);
 if(Number(req.headers.get("content-length")||0)>19000000)return json({error:"Demasiadas imágenes"},413);
 const supabaseUrl=appKey("SUPABASE_URL"),anon=appKey("SUPABASE_ANON_KEY");
 const service=appKey("SUPABASE_SERVICE_ROLE_KEY");
 const access=req.headers.get("Authorization")||"";
 if(!supabaseUrl||!anon||!service)return json({error:"Servicio incompleto"},503);
 const viewer=createClient(supabaseUrl,anon,{global:{headers:{Authorization:access}}});
 const {data:{user},error:authError}=await viewer.auth.getUser();
 if(authError||!user)return json({error:"Inicia sesión con Supabase Auth antes de enviar fotografías"},401);
 const claims=user.app_metadata||{};
 const login=String(claims.seamx_login||"").trim(),role=String(claims.seamx_role||"");
 if(!login||!role)return json({error:"Cuenta sin vinculación de rol SEAMX autorizada"},403);
 let body:Record<string,unknown>;
 try{body=await req.json();}catch{return json({error:"Solicitud inválida"},400);}
 const activityId=Number(body.activity_id);
 if(!Number.isSafeInteger(activityId)||activityId<=0)return json({error:"Actividad inválida"},400);
 const stages=["iperc","before","during","after"] as const;
 const images=stages.map(stage=>({stage,data:body[stage]})).filter(x=>x.data);
 if(images.length===0)return json({error:"Adjunta al menos una fotografía o IPERC"},400);
 if(images.length>4||images.some(x=>!validImage(x.data)))return json({error:"Solo imágenes JPEG, PNG o WebP de máximo 4 MB"},400);
 const admin=createClient(supabaseUrl,service);
 const {data:activity,error:activityError}=await admin.from("actividades").select("id,actividad,area,operador_login,fecha,guardia").eq("id",activityId).maybeSingle();
 if(activityError||!activity)return json({error:"Actividad no encontrada"},404);
 if(!rolesLectura.includes(role)&&login!==String(activity.operador_login||""))return json({error:"No eres responsable de esta actividad"},403);
 const apiKey=appKey("OPENAI_API_KEY");
 if(!apiKey)return json({error:"Falta configurar OPENAI_API_KEY en los secretos de Supabase"},503);
 const inputContent:Array<Record<string,unknown>>=[{type:"input_text",text:
 "Analiza exclusivamente evidencias reales de campo y el IPERC visible. Idioma: español. Actividad: "+String(activity.actividad)+
 "; área: "+String(activity.area)+"; fecha: "+String(activity.fecha)+
 ". No infieras que el riesgo desapareció porque no se ve. No inventes texto ilegible del IPERC, distancias, normas ni riesgos genéricos. "+
 "Compara antes/durante/después solo si las imágenes son comparables. Señala controles no verificables. "+
 "Marca urgencia si se observa una condición potencialmente crítica: indicar no iniciar/detener exposición y seguir procedimiento. "+
 "Nunca declares una actividad segura ni una corrección verificada sin confirmación humana."}];
 for(const img of images){inputContent.push({type:"input_text",text:"Evidencia: "+img.stage});inputContent.push({type:"input_image",image_url:img.data,detail:"high"});}
 const property=(type:string)=>({type});
 const findingSchema={type:"object",additionalProperties:false,required:["id","hazard","risk","iperc_control","visual_status","action","attention","status","visual_basis","change_description"],
  properties:{id:property("string"),hazard:property("string"),risk:property("string"),iperc_control:property("string"),visual_status:property("string"),action:property("string"),attention:{type:"string",enum:["crítico","alto","preventivo"]},status:{type:"string",enum:["Detectado","Pendiente de corrección","Cambio visual detectado","Pendiente de verificación","No verificable mediante imagen"]},visual_basis:property("string"),change_description:property("string")}};
 const response=await fetch("https://api.openai.com/v1/responses",{
  method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},
  body:JSON.stringify({model:appKey("OPENAI_MODEL")||"gpt-4.1-mini",max_output_tokens:3500,
   input:[{role:"user",content:inputContent}],
   text:{format:{type:"json_schema",name:"seamx_safe_findings",strict:true,
    schema:{type:"object",additionalProperties:false,required:["summary","reviewed_context","iperc_readable","iperc_summary","findings","comparison","urgent_action"],
     properties:{summary:property("string"),reviewed_context:property("string"),iperc_readable:property("boolean"),iperc_summary:property("string"),
      findings:{type:"array",items:findingSchema},
      comparison:{type:"object",additionalProperties:false,required:["conclusive","comment"],properties:{conclusive:property("boolean"),comment:property("string")}},
      urgent_action:property("boolean")}}}}})
 });
 if(!response.ok){console.error("OpenAI response status",response.status);return json({error:"El servicio de análisis no está disponible"},502);}
 const raw=await response.json();
 const text=(raw.output||[]).flatMap((x:any)=>x.content||[]).find((x:any)=>x.type==="output_text")?.text;
 if(!text)return json({error:"La IA no produjo un análisis válido"},502);
 let parsed:any;try{parsed=JSON.parse(text);}catch{return json({error:"Análisis no interpretable"},502);}
 if(!parsed||!Array.isArray(parsed.findings)||typeof parsed.reviewed_context!=="string")return json({error:"Estructura incorrecta"},502);
 const allowedStatus=["Detectado","Pendiente de corrección","Cambio visual detectado","Pendiente de verificación","No verificable mediante imagen"];
 const findings=parsed.findings.slice(0,18).filter((f:any)=>f&&typeof f.hazard==="string"&&typeof f.risk==="string"&&["crítico","alto","preventivo"].includes(f.attention)&&allowedStatus.includes(f.status))
  .map((f:any,i:number)=>({...f,id:"H-"+String(i+1).padStart(3,"0")}));
 const result={summary:parsed.summary,reviewed_context:parsed.reviewed_context,iperc_readable:parsed.iperc_readable,iperc_summary:parsed.iperc_summary,findings,comparison:parsed.comparison,urgent_action:parsed.urgent_action};
 const {data:record,error:insertError}=await admin.from("seamx_safe_analisis").insert({
 actividad_id:activityId,autor_uid:user.id,etapa:"evaluacion",resumen:result.summary,contexto:{reviewed_context:result.reviewed_context,iperc_readable:result.iperc_readable,iperc_summary:result.iperc_summary,comparison:result.comparison,urgent_action:result.urgent_action},hallazgos:findings,model_version:appKey("OPENAI_MODEL")||"gpt-4.1-mini",
 evidencias:{stages:images.map(i=>i.stage),nota:"Fotografías transmitidas para análisis; las originales permanecen en el registro de actividad."}
 }).select("id,created_at").single();
 if(insertError){console.error("SEAMX SAFE persistence error",insertError);return json({error:"No se pudo guardar el análisis"},500);}
 return json({...result,analysis_id:record.id,created_at:record.created_at});
});
