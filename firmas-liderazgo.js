/* SEAMX Liderazgo: firmas personales autenticadas.
   La sesión heredada de SEAMX NO autoriza firmas; requiere Supabase Auth. */
(function(){
'use strict';
const by=id=>document.getElementById(id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sessionUser=null, personalSignature=null, pending=[];
async function authenticated(){
  if(typeof db==='undefined'||!db.auth)return null;
  const r=await db.auth.getUser();
  return r.error?null:r.data?.user||null;
}
function notice(message){const el=by('seamx-signature-status');if(el)el.textContent=message}
async function refresh(){
  if(!by('seamx-signature-panel'))return;
  try{
    sessionUser=await authenticated();
    if(!sessionUser){
      notice('La firma aún no está habilitada para las cuentas antiguas. Se requiere migrar el inicio de sesión a Supabase Auth.');
      by('seamx-signature-actions').innerHTML='';
      by('seamx-signature-pending').innerHTML='';
      const banner=by('seamx-firma-alerta');if(banner)banner.style.display='none';
      return;
    }
    const p=await db.from('liderazgo_firmas_perfil').select('imagen_data').eq('auth_user_id',sessionUser.id).maybeSingle();
    if(p.error)throw p.error;
    personalSignature=p.data?.imagen_data||null;
    by('seamx-signature-actions').innerHTML='<label style="display:block;font-weight:600;margin-bottom:8px">Mi firma guardada (PNG o JPG, máximo 180 KB)</label><input type="file" id="seamx-signature-file" accept="image/png,image/jpeg" aria-label="Subir mi firma"><p style="margin:8px 0 12px;font-size:12px;color:#536b61">La imagen solo se podrá usar con tu aceptación explícita en cada evaluación.</p>'+(personalSignature?'<img src="'+personalSignature+'" alt="Mi firma registrada" style="display:block;width:180px;max-height:80px;object-fit:contain;border:1px solid #ddd;background:#fff;margin-bottom:12px">':'<p>No tienes una firma registrada.</p>');
    by('seamx-signature-file').addEventListener('change',onUpload);
    const res=await db.from('liderazgo_solicitudes_firma').select('id,evaluacion_id,creada_at').eq('supervisor_auth_uid',sessionUser.id).order('creada_at',{ascending:false});
    if(res.error)throw res.error;
    const requests=res.data||[];
    const signatures=await db.from('liderazgo_confirmaciones_firma').select('solicitud_id,confirmada_at').in('solicitud_id',requests.map(r=>r.id).length?requests.map(r=>r.id):['00000000-0000-0000-0000-000000000000']);
    if(signatures.error)throw signatures.error;
    const signed=new Set((signatures.data||[]).map(x=>x.solicitud_id));
    pending=requests.filter(x=>!signed.has(x.id));
    const box=by('seamx-signature-pending');
    if(box)box.innerHTML='<h4>Mis evaluaciones pendientes: '+pending.length+'</h4>'+pending.map(x=>'<div style="padding:12px;border:1px solid #c9dad1;margin-bottom:10px"><b>Evaluación #'+safe(x.evaluacion_id)+'</b><p style="margin:6px 0">Lee tu evaluación y confirma personalmente su revisión.</p><label>Observaciones (opcional)<textarea data-obs="'+safe(x.id)+'" style="display:block;width:100%;min-height:55px"></textarea></label><button type="button" data-sign="'+safe(x.id)+'" style="margin-top:9px;padding:9px 14px;background:#176e64;color:white;border:0;cursor:pointer">Aceptar y firmar</button></div>').join('');
    box?.querySelectorAll('[data-sign]').forEach(button=>button.addEventListener('click',()=>sign(button.dataset.sign)));
    const banner=by('seamx-firma-alerta');if(banner){banner.style.display=pending.length?'block':'none';banner.innerHTML=pending.length?'<b>Tienes '+pending.length+' evaluación(es) pendiente(s) de firma.</b> <button type="button" id="seamx-firma-go" style="margin-left:10px">Revisar evaluaciones</button>':'';by('seamx-firma-go')?.addEventListener('click',()=>navigateTo('liderazgo'));}
    notice(personalSignature?'Firma personal registrada.':'Carga tu firma para poder aceptar evaluaciones.');
  }catch(e){console.error('Firmas SEAMX',e);notice('No se pudieron consultar las firmas. Verifica la sesión y los permisos.');}
}
async function onUpload(e){
 const f=e.target.files?.[0];if(!f)return;
 if(!['image/jpeg','image/png'].includes(f.type)||f.size>180000)return notice('Usa una imagen PNG/JPG de hasta 180 KB.');
 const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(f)});
 if(!/^data:image\/(png|jpeg);base64,/.test(data))return notice('Imagen no válida.');
 const r=await db.from('liderazgo_firmas_perfil').upsert({auth_user_id:sessionUser.id,imagen_data:data,actualizada_at:new Date().toISOString()},{onConflict:'auth_user_id'});
 if(r.error)return notice('No se pudo guardar tu firma: '+r.error.message);
 await refresh();
}
async function sign(id){
 if(!personalSignature)return notice('Antes debes registrar una imagen de tu firma.');
 const request=pending.find(x=>x.id===id);if(!request)return;
 if(!confirm('Confirma que revisaste la evaluación #'+request.evaluacion_id+'. Se insertará tu firma personal y quedará registrada la fecha de aceptación.'))return;
 const observation=by('seamx-signature-pending')?.querySelector('[data-obs="'+id+'"]')?.value||'';
 const r=await db.from('liderazgo_confirmaciones_firma').insert({solicitud_id:id,firmante_auth_uid:sessionUser.id,firma_snapshot:personalSignature,observacion:observation});
 if(r.error)return notice('La firma no se guardó: '+r.error.message);
 await refresh();notice('Evaluación firmada correctamente.');
}
window.seamxLiderazgoFirmasRefresh=refresh;
document.addEventListener('DOMContentLoaded',()=>{refresh();});
})();
