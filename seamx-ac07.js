/* SEAMX AC-07 — control de cambios 29/10/2026 */
(function(){
'use strict';
const TARGET=new Set(['admin','jefatura','gerencia','supervisor_hse','operador','antamina','supervisor']);
let records=[],pending=null;
const E=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const msg=(s,type='warning')=>typeof showToast==='function'?showToast(s,type):alert(s);
function container(){
 let e=E('ac07-panel');if(e)return e;
 e=document.createElement('section');e.id='ac07-panel';e.style.cssText='margin:18px 0;padding:17px;border:1px solid #c6d4cb;border-radius:8px;background:#fff;color:#25352f;box-shadow:0 3px 14px #002b1810';
 const anchor=E('view-programacion')||E('view-programacion-diaria')||document.body;
 if(anchor===document.body){e.style.cssText+='position:fixed;right:18px;bottom:68px;z-index:8500;width:min(460px,90vw);max-height:65vh;overflow:auto;display:none';document.body.appendChild(e)}else anchor.appendChild(e);return e;
}
function state(){return APP?.user?.role||''}
function currentDate(){return E('prog-reporte-fecha')?.value||E('prog-fecha')?.value||new Date().toISOString().slice(0,10)}
async function load(){
 if(!TARGET.has(state()))return;
 try{const c=window.seamxSignatureDb;if(!c)return;const session=await c.auth.getSession();if(!session.data?.session)return;
 const r=await c.from('modificaciones_programacion').select('*').order('created_at',{ascending:false}).limit(300);
 if(!r.error){records=r.data||[];render();}
 }catch(e){console.warn('AC07',e)}
}
function currentRoleRows(){return records.filter(r=>['admin','supervisor'].includes(state())||r.destinatarios?.includes(state()))}
function render(){
 const e=container(),items=currentRoleRows(),read=JSON.parse(localStorage.getItem('seamx_ac07_vistos_'+(APP?.user?.login||''))||'[]');const unread=items.filter(x=>!read.includes(x.id));
 e.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><div><strong>Control de cambios · AC-07</strong><p style="margin:5px 0;font-size:12px;color:#64776c">Modificaciones y avisos registrados en Supabase</p></div><span style="background:#e8f2eb;padding:7px 11px;border-radius:6px;font-size:12px">'+unread.length+' aviso(s) nuevo(s)</span></div><div id="ac07-feed" style="max-height:370px;overflow:auto;margin-top:12px"></div>';
 const b=E('ac07-feed');
 b.innerHTML=items.length?items.slice(0,35).map(x=>'<article style="padding:11px;border-top:1px solid #e0e8e2"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>'+esc(x.tipo)+' · '+esc(x.fecha)+'</strong><small>'+esc(x.usuario)+' · '+new Date(x.created_at).toLocaleString('es-PE')+'</small></div><div style="font-size:12px;margin:7px 0">Motivo: '+esc(x.motivo)+'<br>Control: '+esc(x.controles)+'</div><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn btn-outline btn-sm" data-ac07="comm" data-id="'+x.id+'">Comunicado JPG</button><button class="btn btn-outline btn-sm" data-ac07="plan" data-id="'+x.id+'">Programación JPG</button><button class="btn btn-outline btn-sm" data-ac07="share" data-id="'+x.id+'">Compartir</button></div></article>').join(''):'<p style="color:#718477;font-size:12px">Sin modificaciones registradas.</p>';
 b.querySelectorAll('button[data-ac07]').forEach(btn=>btn.onclick=()=>{const rec=items.find(x=>x.id===btn.dataset.id);if(rec)produce(rec,btn.dataset.ac07)});
 localStorage.setItem('seamx_ac07_vistos_'+(APP?.user?.login||''),JSON.stringify(items.map(x=>x.id).slice(0,300)));
}
function dialogFor(data){
 return new Promise(resolve=>{
  const d=document.createElement('dialog');d.style.cssText='border:1px solid #c2d1c5;border-radius:10px;padding:24px;max-width:590px;width:94%;box-shadow:0 16px 60px #0004';
  d.innerHTML='<form id="ac07-form"><h3 style="margin:0 0 8px">¿Qué cambió en la programación?</h3><p style="font-size:12px;color:#52675a">Registro rápido del cambio. La autorización corresponde a tu sesión de supervisión.</p><label style="display:block;font-size:13px;margin:12px 0">Tipo de cambio<select name="tipo" required style="width:100%;padding:10px;margin-top:6px"><option value="actividad">Actividad</option><option value="personal">Personal</option><option value="horario">Horario</option><option value="zona">Zona</option><option value="equipo">Equipo</option><option value="metodo">Método de trabajo</option><option value="prioridad">Prioridad</option><option value="otro">Otro</option></select></label><label style="display:block;font-size:13px;margin:12px 0">¿Por qué se cambió?<textarea name="motivo" required minlength="5" rows="2" style="display:block;width:100%;box-sizing:border-box;padding:10px;margin-top:6px;border:1px solid #cad5cd;border-radius:5px" placeholder="Ej.: El equipo asignado entró a mantenimiento"></textarea></label><label style="display:block;font-size:13px;margin:12px 0">Riesgos del cambio y controles definidos<textarea name="control" required minlength="5" rows="3" style="display:block;width:100%;box-sizing:border-box;padding:10px;margin-top:6px;border:1px solid #cad5cd;border-radius:5px" placeholder="Ej.: Se verificó el nuevo equipo y se actualizó el IPERC con el personal"></textarea></label><div style="display:flex;justify-content:end;gap:9px;margin-top:16px"><button type="button" id="ac07-cancel" class="btn btn-outline">Cancelar</button><button type="submit" class="btn btn-primary">Registrar y comunicar cambio</button></div></form>';
  document.body.append(d);d.showModal();let ended=false;const done=v=>{if(ended)return;ended=true;d.close();d.remove();resolve(v)};
  E('ac07-cancel').onclick=()=>done(null);d.addEventListener('cancel',ev=>{ev.preventDefault();done(null)});
  E('ac07-form').onsubmit=ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget);done(Object.fromEntries(f.entries()))};
 });
}
function wrapSave(){
 if(typeof window.saveProgramacion!=='function'||window.saveProgramacion.__ac07)return;
 const original=window.saveProgramacion;
 async function wrapped(){
  const p=typeof getProgramacionFormData==='function'?getProgramacionFormData():null;
  if(!p?.id)return original.apply(this,arguments);
  if(!['admin','supervisor'].includes(state()))return msg('Solo Supervisión y Administración pueden modificar programación');
  if(!p.fecha||!p.actividades?.length||p.actividades.some(a=>!a.hse||!a.supervisor))return msg('Completa las actividades, supervisor y HSE');
  const m=await dialogFor(p);if(!m)return;
  try{
   const c=await window.seamxExtrasEnsureAuth();
   const nueva=appProgramacionToDb(p);
   const r=await c.rpc('seamx_ac07_registrar',{p_id:Number(p.id),p_nueva:nueva,p_tipo:m.tipo,p_motivo:m.motivo,p_justificacion:m.motivo,p_riesgos:m.control,p_controles:m.control,p_autorizado:(APP.user?.name||APP.user?.login||'Supervisor')});
   if(r.error)throw r.error;
   if(typeof syncProgramacionAssignments==='function')await syncProgramacionAssignments(p);
   if(E('prog-reporte-fecha'))E('prog-reporte-fecha').value=p.fecha;
   if(typeof resetProgramacionForm==='function')resetProgramacionForm(false);
   if(typeof loadAllData==='function')await loadAllData();
   await load();msg('Modificación guardada, autorizada y comunicada en SEAMX','success');
  }catch(err){msg('No se guardó la modificación: '+(err.message||err),'error')}
 }
 wrapped.__ac07=true;window.saveProgramacion=wrapped;
}
function rows(rec){
 const r=rec.actualizado||{};const a=r.actividades||[];
 return a.map((v,i)=>[(i+1)+'.',v.descripcion||v.actividad||'',v.area||'',v.supervisor||'']).slice(0,18);
}
function compose(rec,kind){
 const c=document.createElement('canvas');c.width=1500;c.height=kind==='plan'?2050:1680;
 const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.fillStyle='#143d2c';g.fillRect(0,0,1500,165);g.fillStyle='#fff';g.font='bold 55px Arial';g.fillText('SEAMX  |  ECOSEAM',80,83);g.font='24px Arial';g.fillText('GESTIÓN OPERACIONAL  ·  CONTROL DOCUMENTAL',82,128);
 let y=225;g.fillStyle='#143d2c';g.font='bold 40px Arial';g.fillText(kind==='plan'?'PROGRAMACIÓN DIARIA ACTUALIZADA':'COMUNICADO DE MODIFICACIÓN · AC-07',80,y);y+=40;g.fillStyle='#61746b';g.font='23px Arial';g.fillText('Fecha: '+rec.fecha+'   |   Emitido: '+new Date(rec.created_at).toLocaleString('es-PE')+'   |   Código: '+rec.id.slice(0,8).toUpperCase(),80,y);y+=58;
 function line(text,val){g.fillStyle='#eaf0ec';g.fillRect(77,y-35,1345,51);g.font='bold 23px Arial';g.fillStyle='#244d39';g.fillText(text,96,y);g.font='22px Arial';g.fillStyle='#263a30';write(val,440,y,950,35);y+=73}
 function write(str,x,yy,max,step=35){g.font='22px Arial';const words=String(str||'—').split(/\s+/);let row='';for(const w of words){if(g.measureText(row+' '+w).width>max){g.fillText(row,x,yy);yy+=step;row=w}else row+=(row?' ':'')+w}if(row)g.fillText(row,x,yy);return yy}
 if(kind==='comm'){line('Tipo de cambio',rec.tipo);line('Motivo',rec.motivo);line('Sustento',rec.justificacion);line('Riesgos reevaluados',rec.riesgos);line('Controles',rec.controles);line('Registrado por',rec.usuario);line('Autorizado por',rec.autorizado_por)}
 else{line('Registrado por',rec.usuario);line('Motivo del ajuste',rec.motivo);g.fillStyle='#143d2c';g.font='bold 28px Arial';g.fillText('ACTIVIDADES PROGRAMADAS',82,y+15);y+=75;for(const v of rows(rec)){g.fillStyle='#eef3f0';g.fillRect(76,y-26,1345,106);g.fillStyle='#243c2e';g.font='21px Arial';write(v[0]+' '+v[1],93,y,1150);g.font='19px Arial';g.fillText('Área: '+v[2]+'   |   Supervisor: '+v[3],93,y+49);y+=120;}}
 g.fillStyle='#a6b8ac';g.fillRect(75,c.height-125,1350,2);g.fillStyle='#5b6d62';g.font='21px Arial';g.fillText('Documento generado por SEAMX · Registro digital · Verificar instrucciones vigentes antes de ejecutar',80,c.height-82);
 return c;
}
async function produce(rec,action){
 const kind=action==='plan'?'plan':'comm',canvas=compose(rec,kind);
 const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',0.93));if(!blob)return msg('No se generó el archivo');
 const file=new File([blob],'SEAMX_'+(kind==='plan'?'Programacion':'Comunicado')+'_'+rec.fecha+'.jpg',{type:'image/jpeg'});
 if(action==='share'&&navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'Modificación de programación SEAMX'});return}catch(e){if(e.name==='AbortError')return}}
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
 if(action==='share')msg('JPG descargado. Adjunta el archivo en WhatsApp; no se requiere Business API.','success');
}
function boot(){wrapSave();E('ac07-panel')?.remove();E('ac07-programacion-shortcut')?.remove();E('ac07-notify-bell')?.remove();}

window.seamxAc07Refresh=load;
function initAc07(){setTimeout(boot,450);setInterval(()=>{boot();if(APP?.user&&TARGET.has(state()))load()},15000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initAc07,{once:true});else initAc07();
})();
