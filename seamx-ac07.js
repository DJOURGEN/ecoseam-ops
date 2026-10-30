/* SEAMX · Reprogramación operacional · 29-10-2026 */
(function(){
'use strict';
const $=id=>document.getElementById(id), can=()=>['admin','supervisor'].includes((typeof APP!=='undefined'?APP?.user?.role:null));
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;', '"':'&quot;',"'":'&#39;'}[c]));
const say=(s,t='warning')=>typeof showToast==='function'?showToast(s,t):alert(s);
const name=a=>String(a?.descripcion||a?.actividad||'Actividad sin descripción');
let reports=[];
function plans(){return (APP?.data?.programaciones||[]).filter(p=>p?.id&&Array.isArray(p.actividades)&&p.actividades.length);}
function selectedPlans(){const date=$('prog-reporte-fecha')?.value||$('prog-fecha')?.value;return plans().filter(p=>!date||p.fecha===date)}
function install(){
 const view=$('view-programacion');if(!view)return;
 const primary=$('seamx-reprogramar-principal');
 if(primary){
  primary.style.display=can()?'':'none';
  primary.onclick=open;
  primary.disabled=!can();
  let hist=$('seamx-reprogramacion-history');
  if(!hist){
   hist=document.createElement('div');hist.id='seamx-reprogramacion-history';
   hist.style.cssText='margin:10px 0';
   primary.closest('.seamx-reprog-entry')?.after(hist);
  }
  return;
 }
 if($('seamx-reprogramar')){ $('seamx-reprogramar').style.display=can()?'':'none';return; }
 const b=document.createElement('button');b.id='seamx-reprogramar';b.type='button';b.className='btn btn-outline';b.style.cssText='margin:12px 0;background:#174f37;color:#fff;border-radius:4px;font-weight:600';b.textContent='↻ Reprogramación';b.onclick=open;
 const h=view.querySelector('.page-header');if(h)h.after(b);else view.prepend(b);
 const hist=document.createElement('div');hist.id='seamx-reprogramacion-history';hist.style.cssText='margin:10px 0';b.after(hist);
 b.style.display=can()?'':'none';
}
function open(){
 if(!can())return say('Solo Supervisión y Administración pueden reprogramar');
 const list=selectedPlans();if(!list.length)return say('No hay una programación guardada en la fecha seleccionada');
 const d=document.createElement('dialog');d.id='seamx-reprog-modal';d.style.cssText='max-width:720px;width:calc(100% - 32px);max-height:90vh;overflow:auto;border:1px solid #bacdc1;border-radius:6px;padding:0;box-shadow:0 25px 80px #0006';
 const select=(n,items)=>'<label>'+n+'<select name="'+(n==='Programación'?'plan':'actividad')+'" required style="width:100%;padding:10px;margin:5px 0 12px;border:1px solid #ced8d0"></select></label>';
 d.innerHTML='<div style="background:#174f37;color:white;padding:18px 20px;display:flex;align-items:center;justify-content:space-between"><strong style="font-size:19px">Reprogramación diaria</strong><button type="button" id="sr-close" aria-label="Cerrar ventana" style="border:0;background:transparent;color:white;font-size:28px;cursor:pointer">×</button></div><form id="sr-form" style="padding:20px;display:grid;gap:9px"><label>Programación del día<select required id="sr-plan" style="width:100%;padding:10px"></select></label><label>Actividad programada<select required id="sr-activity" style="width:100%;padding:10px"></select></label><label>Actividad reprogramada / nueva instrucción<textarea required minlength="5" name="nueva" rows="2" style="width:100%;box-sizing:border-box;padding:10px"></textarea></label><label>Desviación, inconveniente o motivo<textarea required minlength="5" name="motivo" rows="2" style="width:100%;box-sizing:border-box;padding:10px"></textarea></label><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px"><label>Quién dio la orden<input required name="ordeno" style="width:100%;padding:10px;box-sizing:border-box"></label><label>Quién autorizó<input required name="autorizo" style="width:100%;padding:10px;box-sizing:border-box"></label><label>Hora de comunicación<input required name="hora" type="time" style="width:100%;padding:10px;box-sizing:border-box"></label><label>Supervisor operativo a cargo<input required name="supervisor" list="sr-supervisors" style="width:100%;padding:10px;box-sizing:border-box"></label><label>Ingeniero HSE a cargo<input required name="hse" list="sr-hse-list" style="width:100%;padding:10px;box-sizing:border-box"></label></div><datalist id="sr-supervisors"></datalist><datalist id="sr-hse-list"></datalist><p style="font-size:12px;color:#576e5e">La nueva instrucción sustituirá la actividad seleccionada. El cambio quedará registrado junto con la programación anterior.</p><button class="btn btn-primary" type="submit" id="sr-submit">Guardar reprogramación y generar reporte</button></form>';
 document.body.appendChild(d);const pl=$('sr-plan'),act=$('sr-activity');
 pl.innerHTML=list.map(p=>'<option value="'+p.id+'">'+safe(p.fecha)+' · '+p.actividades.length+' actividad(es) · N.º '+p.id+'</option>').join('');
 const fill=()=>{const p=list.find(x=>String(x.id)===pl.value);act.innerHTML=(p?.actividades||[]).map((a,i)=>'<option value="'+i+'">'+safe((i+1)+'. '+name(a))+'</option>').join('');defaults()};
 const defaults=()=>{const p=list.find(x=>String(x.id)===pl.value);const a=p?.actividades?.[Number(act.value)];if(!a)return;d.querySelector('[name="nueva"]').value=name(a);d.querySelector('[name="supervisor"]').value=a.supervisor||'';d.querySelector('[name="hse"]').value=a.hse||''};
 pl.onchange=fill;act.onchange=defaults;fill();
 const users=APP?.data?.usuarios||[];
 $('sr-supervisors').innerHTML=users.filter(x=>x.rol==='supervisor'&&x.activo!==false).map(x=>'<option value="'+safe([x.nombre,x.apellido].filter(Boolean).join(' '))+'"></option>').join('');
 $('sr-hse-list').innerHTML=users.filter(x=>x.rol==='supervisor_hse'&&x.activo!==false).map(x=>'<option value="'+safe([x.nombre,x.apellido].filter(Boolean).join(' '))+'"></option>').join('');
 const close=()=>{d.close();d.remove()};$('sr-close').onclick=close;d.oncancel=e=>{e.preventDefault();close()};
 $('sr-form').onsubmit=async e=>{
  e.preventDefault();
  const form=e.currentTarget;
  const button=$('sr-submit');
  button.disabled=true;
  try{
   // Capture all form values before awaiting: currentTarget becomes null after event dispatch.
   // Read form controls directly; avoid a stale FormData constructor path in the PWA.
   const fields={};
   for(const key of ['nueva','motivo','ordeno','autorizo','hora','supervisor','hse']){
    const input=form.elements.namedItem(key);
    if(!input || !('value' in input))throw new Error('Falta el campo: '+key);
    fields[key]=String(input.value||'').trim();
    if(!fields[key])throw new Error('Complete el campo: '+key);
   }
   const f={get:key=>fields[key]??''};
   const p=list.find(x=>String(x.id)===pl.value),i=Number(act.value);
   if(!p||!p.actividades?.[i])throw new Error('No se encontró la actividad programada');
   const old=p.actividades[i];
   const c=await window.seamxExtrasEnsureAuth();
   const newActivities=p.actividades.map((a,j)=>j===i?{...a,descripcion:String(f.get('nueva')).trim(),supervisor:String(f.get('supervisor')).trim(),hse:String(f.get('hse')).trim()}:a);
   const person=[...new Set(newActivities.flatMap(a=>a.personal||[]))];
   const nueva={fecha:p.fecha,descripcion:newActivities[0]?.descripcion||'',personal:person,charla_seguridad:(p.charlas||[p.charla]).filter(Boolean).join('\n'),hse:newActivities[0]?.hse||'',supervisor:newActivities[0]?.supervisor||'',area:newActivities[0]?.area||'',actividades:newActivities,creado_por:p.creadoPor||APP.user?.login||''};
   const detalle={indice:i,actividad_original:name(old),actividad_nueva:String(f.get('nueva')).trim(),motivo:String(f.get('motivo')).trim(),ordeno:String(f.get('ordeno')).trim(),autorizo:String(f.get('autorizo')).trim(),hora_comunicacion:String(f.get('hora')).trim(),supervisor:String(f.get('supervisor')).trim(),hse:String(f.get('hse')).trim()};
   const res=await c.rpc('seamx_reprogramar',{p_id:Number(p.id),p_nueva:nueva,p_detalle:detalle});
   if(res.error)throw res.error;
   const rec={id:res.data,fecha:p.fecha,created_at:new Date().toISOString(),original:{actividades:p.actividades},actualizado:nueva,detalle_reprogramacion:detalle,usuario:APP.user?.login||'',motivo:detalle.motivo};
   if(typeof loadAllData==='function')await loadAllData();
   await load();close();say('Reprogramación registrada y comunicada','success');await report(rec,'share');
  }catch(err){say('No se pudo reprogramar: '+(err.message||err),'error')}finally{button.disabled=false}
 };
 d.showModal();
}
async function load(){
 try{const c=window.seamxSignatureDb,session=await c?.auth?.getSession();if(!session?.data?.session)return;
 const r=await c.from('modificaciones_programacion').select('*').order('created_at',{ascending:false}).limit(100);if(r.error)return;
 reports=(r.data||[]).filter(x=>x.detalle_reprogramacion?.actividad_original);
 const div=$('seamx-reprogramacion-history');if(!div)return;
 div.innerHTML=reports.length?'<details><summary style="cursor:pointer;font-size:13px;color:#315942">Historial de reprogramaciones ('+reports.length+')</summary><div style="display:grid;gap:8px;margin-top:10px">'+reports.slice(0,25).map(x=>'<div style="border:1px solid #dbe5dd;padding:10px"><strong>'+safe(x.fecha)+' · '+safe(x.detalle_reprogramacion.actividad_original)+'</strong><p style="font-size:12px;margin:6px 0">'+safe(x.motivo)+'</p><button type="button" class="btn btn-outline btn-sm" data-report="'+x.id+'">Reporte comparativo JPG / WhatsApp</button></div>').join('')+'</div></details>':'';
 div.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>report(reports.find(x=>x.id===b.dataset.report),'share'));
 }catch(err){console.warn('Reprogramación',err)}
}
function createImage(rec){
 const c=document.createElement('canvas');c.width=1400;c.height=1850;const g=c.getContext('2d');
 g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.fillStyle='#184a34';g.fillRect(0,0,1400,155);
 g.fillStyle='#fff';g.font='bold 51px Arial';g.fillText('ECOSEAM  /  SEAMX',72,75);g.font='23px Arial';g.fillText('REPORTE GERENCIAL · REPROGRAMACIÓN OPERATIVA',74,118);
 const d=rec.detalle_reprogramacion||{},old=rec.original?.actividades||[],now=rec.actualizado?.actividades||[];
 let y=220;
 function words(t,x,yy,w,lh=30){const parts=String(t||'—').split(/\s+/);let row='';g.font='23px Arial';for(const v of parts){if(g.measureText(row+' '+v).width>w){g.fillText(row,x,yy);yy+=lh;row=v}else row+=(row?' ':'')+v}if(row)g.fillText(row,x,yy);return yy}
 function section(title){g.fillStyle='#e8f0ea';g.fillRect(65,y-33,1270,48);g.font='bold 25px Arial';g.fillStyle='#184a34';g.fillText(title,82,y);y+=48;g.fillStyle='#263e30'}
 function line(label,value){g.font='bold 21px Arial';g.fillStyle='#24533c';g.fillText(label,82,y);g.fillStyle='#23372b';y=Math.max(y,words(value,430,y,880))+36}
 section('DATOS DE REPROGRAMACIÓN');line('Fecha',rec.fecha);line('Hora comunicación',d.hora_comunicacion);line('Orden impartida por',d.ordeno);line('Autorizado por',d.autorizo);line('Supervisor operativo',d.supervisor);line('Ingeniero HSE',d.hse);
 section('COMPARATIVO DE ACTIVIDADES');
 const idx=Number(d.indice||0);
 for(let i=0;i<Math.max(old.length,now.length);i++){const before=old[i],after=now[i];if(!before&&!after)continue;g.font='bold 21px Arial';g.fillStyle='#24533c';g.fillText('ACTIVIDAD '+(i+1)+(i===idx?' · REPROGRAMADA':''),82,y);y+=33;g.fillStyle='#6a6f6a';g.font='19px Arial';g.fillText('ANTERIOR',85,y);g.fillStyle='#273b30';y=words(name(before),290,y,1030)+37;g.fillStyle='#6a6f6a';g.font='19px Arial';g.fillText('NUEVA',85,y);g.fillStyle='#273b30';y=words(name(after),290,y,1030)+51;if(y>1450)break}
 section('DESVIACIÓN / INCONVENIENTE / MOTIVO');y=words(d.motivo,82,y+8,1200)+55;
 g.fillStyle='#b6c6bb';g.fillRect(65,1740,1270,2);g.fillStyle='#50685a';g.font='20px Arial';g.fillText('Registro generado por SEAMX · Trazabilidad de programación original y modificada',75,1780);
 return c;
}
async function report(rec,mode){
 if(!rec)return;const canvas=createImage(rec),blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',0.94));if(!blob)return say('No se pudo generar JPG');
 const file=new File([blob],'SEAMX_Reprogramacion_'+rec.fecha+'.jpg',{type:'image/jpeg'});
 if(mode==='share'&&navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'Reporte de reprogramación SEAMX'});return}catch(e){if(e.name==='AbortError')return}}
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 say('JPG descargado. Puedes adjuntarlo en WhatsApp o compartirlo desde tu dispositivo.','success');
}
window.seamxAbrirReprogramacion=open;
function start(){
 install();
 load();
 let lastRefresh=0;
 setInterval(()=>{
  install();
  if($('view-programacion')?.style.display!=='none' && document.visibilityState==='visible' && Date.now()-lastRefresh>60000){
   lastRefresh=Date.now();
   load();
  }
 },3000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
