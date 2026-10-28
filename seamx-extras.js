/* SEAMX · Ajustes operativos 28/10/2026 (sin alterar login heredado) */
(function(){
'use strict';
const $=id=>document.getElementById(id);
let sharedPlan=[],remoteReviews=null,radarChart=null;
const localStore=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}};
const clean=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
function toast(message,type='warning'){if(typeof showToast==='function')showToast(message,type);else alert(message)}
async function requireAuth(){
 const app=APP;
 const c=window.seamxSignatureDb;
 if(!app?.user?.id||!c)throw Error('Inicia sesión en SEAMX.');
 let u=await c.auth.getUser();
 if(u.data?.user?.id){
   const p=await c.from('usuarios').select('id,auth_user_id,activo').eq('id',app.user.id).eq('activo',true).maybeSingle();
   if(!p.error&&p.data?.auth_user_id===u.data.user.id)return c;
   await c.auth.signOut({scope:'local'});
 }
 return new Promise((resolve,reject)=>{
   const d=document.createElement('dialog');
   d.style.cssText='max-width:440px;width:92vw;padding:20px;border:1px solid #b4c8ba;border-radius:10px;box-shadow:0 16px 45px #0004';
   d.innerHTML='<form id="seamx-verify-form"><h3 style="margin-top:0">Verificar identidad SEAMX</h3><p style="font-size:13px">Escribe tu contraseña NUEVA de Supabase Auth. No necesitas otro usuario.</p><input type="password" autocomplete="current-password" required id="seamx-verify-password" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #b4c8ba"><p id="seamx-verify-error" role="status" style="color:#a33;font-size:12px"></p><div style="display:flex;gap:8px;margin-top:14px"><button type="button" id="seamx-verify-cancel">Cancelar</button><button type="submit" id="seamx-verify-ok" style="background:#16623c;color:white;border:0;padding:10px">Verificar</button></div></form>';
   document.body.appendChild(d);let closed=false;
   const finish=error=>{if(closed)return;closed=true;d.close();d.remove();if(error)reject(error);else resolve(c)};
   d.querySelector('#seamx-verify-cancel').onclick=()=>finish(new Error('Verificación cancelada'));
   d.addEventListener('cancel',e=>{e.preventDefault();finish(new Error('Verificación cancelada'))});
   d.querySelector('#seamx-verify-form').onsubmit=async e=>{
     e.preventDefault();const pass=d.querySelector('#seamx-verify-password'),btn=d.querySelector('#seamx-verify-ok');btn.disabled=true;
     try{
       const email=app.user.login==='admin'?'admin@ecoseam.com.pe':'seamx-'+app.user.id+'@ecoseam.com.pe';
       const result=await c.auth.signInWithPassword({email,password:pass.value});pass.value='';
       if(result.error||!result.data?.user?.id)throw Error('Contraseña nueva incorrecta');
       const p=await c.from('usuarios').select('auth_user_id,activo').eq('id',app.user.id).eq('activo',true).maybeSingle();
       if(p.error||p.data?.auth_user_id!==result.data.user.id)throw Error('Esta cuenta no corresponde al usuario de SEAMX');
       finish();
     }catch(error){await c.auth.signOut({scope:'local'}).catch(()=>{});d.querySelector('#seamx-verify-error').textContent=error.message||'Acceso no autorizado';btn.disabled=false}
   };
   d.showModal();d.querySelector('#seamx-verify-password').focus();
 });
}
window.seamxExtrasEnsureAuth=requireAuth;
async function readPlan(){
 const result=await db.from('dashboard_programacion').select('fecha,guardia,toneladas').order('fecha',{ascending:true}).limit(3000);
 if(result.error){toast('No se pudo consultar la programación compartida');return sharedPlan}
 sharedPlan=(result.data||[]).map(x=>({...x,toneladas:Number(x.toneladas)||0}));
 return sharedPlan;
}
async function writePlan(body){
 if(APP?.user?.role!=='admin')return toast('Solo el Administrador puede editar la Curva S');
 const c=await requireAuth();
 const result=await c.functions.invoke('seamx-curva-admin',{body});
 if(result.error||!result.data?.ok)throw Error(result.data?.error||result.error?.message||'No se pudo actualizar');
 await readPlan();
 await window.seamxRenderOpsDashboard();
 await window.seamxRenderCurvaRango();
}
function hideControls(){
 const isAdmin=APP?.user?.role==='admin';
 const launch=document.querySelector('.seamx-program-launch');
 const panel=$('seamx-program-dialog');
 if(launch)launch.style.display=isAdmin?'':'none';
 if(panel)panel.style.display=isAdmin?'':'none';
}
function radarRecords(){
 const raw=Array.isArray(remoteReviews)?remoteReviews:localStore('seamx_liderazgo_borradores_v1');
 return raw.filter(x=>x&&Array.isArray(x.respuestas||x.answers)&&((x.respuestas||x.answers).length===18));
}
function radarPanel(){
 const charts=document.querySelector('#view-opsdashboard .seamx-ops-charts');
 if(!charts||$('ops-lead-radar'))return;
 const el=document.createElement('section');el.className='seamx-ops-panel';el.innerHTML='<h3>Desempeño del personal evaluado · gráfico radial</h3><label style="font-size:12px">Supervisor <select id="ops-lead-radar-select" style="width:100%;padding:8px;margin:7px 0"></select></label><canvas id="ops-lead-radar"></canvas><p id="ops-lead-radar-note" style="font-size:11px;color:#61776b">Resultados registrados en el módulo de Liderazgo.</p><button id="ops-lead-radar-load" type="button" class="btn btn-outline btn-sm">Consultar evaluaciones compartidas</button>';
 charts.appendChild(el);
 $('ops-lead-radar-select').addEventListener('change',drawRadar);
 $('ops-lead-radar-load').addEventListener('click',()=>loadRadar(true));
}
function drawRadar(){
 const items=radarRecords(), select=$('ops-lead-radar-select'),note=$('ops-lead-radar-note'),canvas=$('ops-lead-radar');
 if(!select||!canvas)return;
 const people=new Map();
 for(const r of items){const id=String(r.id??r.supervisor_id??r.supervisorId??''),sup=r.supervisor||r.nombre||r.supervisor_nombre||'Supervisor';if(id&&sup){const key=String(r.supervisor_id||r.id||r.supervisorId);if(!people.has(key))people.set(key,{name:sup,rows:[]});people.get(key).rows.push(r)}}
 const prev=select.value;
 select.innerHTML=[...people].map(([k,v])=>'<option value="'+clean(k)+'">'+clean(v.name)+'</option>').join('');
 if(prev&&people.has(prev))select.value=prev;
 if(!people.size){note.textContent='Todavía no existen evaluaciones registradas para visualizar.';if(radarChart){radarChart.destroy();radarChart=null}return}
 const sample=people.get(select.value)?.rows||[];
 const scores=Array.from({length:6},(_,i)=>{
  let sum=0,count=0;
  for(const row of sample){
   const all=row.respuestas||row.answers||[];
   for(const a of all.slice(i*3,i*3+3)){const val=String(a?.v??a?.value??'NA');if(['0','1','2'].includes(val)){sum+=Number(val)*50;count++}}
  }
  return count?Math.round(sum/count):0;
 });
 if(radarChart)radarChart.destroy();
 radarChart=new Chart(canvas,{type:'radar',data:{labels:['Preparación','Riesgos e IPERC','Área y equipos','Comunicación','Intervención','Seguimiento'],datasets:[{label:'Cumplimiento (%)',data:scores,backgroundColor:'rgba(30,112,72,.18)',borderColor:'#196a48',pointBackgroundColor:'#196a48',borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,scales:{r:{min:0,max:100,ticks:{stepSize:25},pointLabels:{font:{size:10}}}},plugins:{legend:{display:false}}}});
 note.textContent=sample.length+' evaluación(es) · '+(remoteReviews?'Datos compartidos en Supabase':'Datos de este navegador')+' · 6 grupos de criterios';
}
async function loadRadar(interactive){
 try{
  const c=interactive?await requireAuth():window.seamxSignatureDb;
  if(!c)return;
  const sess=await c.auth.getSession();if(!sess.data?.session)return;
  const r=await c.functions.invoke('seamx-reportes',{body:{type:'radar'}});
  if(r.error||!r.data?.ok)throw Error(r.data?.error||r.error?.message||'No disponible');
  remoteReviews=r.data.items;drawRadar();
 }catch(e){if(interactive)toast(e.message||'No se pudieron cargar las evaluaciones')}
}
async function loadRiskReport(id){
 const box=$('seamx-risk-brief');
 if(!box)return;box.textContent='Consultando análisis de riesgos…';
 try{
  const c=await requireAuth();
  const r=await c.functions.invoke('seamx-reportes',{body:{type:'activity',id}});
  if(r.error||!r.data?.ok)throw Error(r.data?.error||r.error?.message||'No disponible');
  box.replaceChildren();
  const title=document.createElement('h4');title.textContent='Reporte breve de actividad y riesgos';box.appendChild(title);
  const desc=document.createElement('p');desc.textContent='Trabajo realizado: '+(r.data.descripcion||'Sin descripción de cierre');box.appendChild(desc);
  if(r.data.fotos?.length){const wrap=document.createElement('div');wrap.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
    for(const url of r.data.fotos){if(!/^https:\/\//i.test(url))continue;const img=document.createElement('img');img.src=url;img.alt='Evidencia de trabajo';img.style.cssText='max-width:135px;max-height:120px;object-fit:cover;border-radius:6px';wrap.appendChild(img)}
    box.appendChild(wrap);
  }
  if(!r.data.informes?.length){const p=document.createElement('p');p.textContent='Sin análisis IA registrado para esta actividad.';box.appendChild(p);return}
  for(const report of r.data.informes.slice(0,2)){
   const p=document.createElement('p');p.textContent='Análisis: '+report.resumen;box.appendChild(p);
   if(report.iperc){const ip=document.createElement('p');ip.textContent='IPERC: '+report.iperc;box.appendChild(ip)}
   const list=document.createElement('ul');
   for(const h of report.hallazgos.slice(0,4)){const li=document.createElement('li');li.textContent=h.riesgo+' · Control: '+h.control+' · '+h.estado;list.appendChild(li)}
   box.appendChild(list);
  }
 }catch(e){box.textContent='No se pudo consultar el reporte: '+(e.message||e)}
}
function install(){
 const own=$('lead-owner'),due=$('lead-due');own?.closest('label')?.remove();due?.closest('label')?.remove();
 const oldLocal=window.seamxOpsLocal;
 if(typeof oldLocal==='function')window.seamxOpsLocal=function(key){return key==='seamx_ops_programacion_v1'?sharedPlan:oldLocal(key)};
 const originalDashboard=window.seamxRenderOpsDashboard;
 if(typeof originalDashboard==='function')window.seamxRenderOpsDashboard=async function(){await readPlan();hideControls();const result=await originalDashboard();hideControls();radarPanel();drawRadar();await loadRadar(false);return result};
 const originalRange=window.seamxRenderCurvaRango;
 if(typeof originalRange==='function')window.seamxRenderCurvaRango=async function(){await readPlan();return originalRange()};
 window.seamxGuardarPrograma=async function(){
  if(APP?.user?.role!=='admin')return toast('Solo Administración puede programar');
  const fecha=$('ops-fecha')?.value,guardia=$('ops-guardia-edit')?.value,toneladas=Number($('ops-toneladas')?.value);
  if(!fecha||!Number.isFinite(toneladas)||toneladas<0)return toast('Fecha y tonelaje inválidos');
  try{await writePlan({action:'save',fecha,guardia,toneladas});toast('Programación compartida actualizada','success')}catch(e){toast(e.message||'No se pudo guardar','error')}
 };
 window.seamxBorrarProgramacion=async function(){
  if(APP?.user?.role!=='admin')return toast('Solo Administración puede borrar');
  if(!confirm('¿Eliminar TODA la programación compartida de la Curva S?'))return;
  try{await writePlan({action:'clear'});toast('Programación compartida eliminada','success')}catch(e){toast(e.message||'No se pudo borrar','error')}
 };
 window.seamxImportarPlanAnterior=async function(){
  if(APP?.user?.role!=='admin')return;
  const rows=localStore('seamx_ops_programacion_v1');
  if(!rows.length)return toast('No existe programación anterior en este equipo');
  if(!confirm('¿Importar '+rows.length+' registros del navegador a Supabase para compartirlos?'))return;
  try{await writePlan({action:'import',rows});localStorage.removeItem('seamx_ops_programacion_v1');toast('Programación anterior compartida','success')}catch(e){toast(e.message||'No se pudo importar','error')}
 };
 const program=$('seamx-program-dialog');
 if(program&&!$('seamx-plan-import')){const btn=document.createElement('button');btn.id='seamx-plan-import';btn.type='button';btn.className='btn btn-outline';btn.textContent='Importar programación anterior';btn.addEventListener('click',window.seamxImportarPlanAnterior);program.appendChild(btn)}
 const originalOpen=window.openActivityEvidence;
 if(typeof originalOpen==='function')window.openActivityEvidence=function(id){
  const result=originalOpen(id),grid=document.querySelector('#modal-actividad-evidencias .evidence-grid'),field=typeof activityIsFieldUser==='function'&&activityIsFieldUser();
  if(grid)grid.style.display=field?'none':'';
  const hint=$('evidence-upload-hint');if(hint&&field)hint.textContent='Para finalizar solo debes describir el trabajo. Las fotografías son opcionales.';
  let switcher=$('seamx-photo-toggle');
  if(!switcher&&grid){switcher=document.createElement('button');switcher.id='seamx-photo-toggle';switcher.type='button';switcher.className='btn btn-outline btn-sm';switcher.textContent='Añadir fotos opcionales';grid.parentNode.insertBefore(switcher,grid);switcher.onclick=()=>{grid.style.display=grid.style.display==='none'?'grid':'none'};}
  if(switcher)switcher.style.display=field?'':'none';
  return result;
 };
 const originalView=window.viewActivityEvidence;
 if(typeof originalView==='function')window.viewActivityEvidence=function(id){
  const result=originalView(id);
  const grid=document.querySelector('#modal-actividad-evidencias .evidence-grid');if(grid)grid.style.display='';
  const switcher=$('seamx-photo-toggle');if(switcher)switcher.style.display='none';
  let box=$('seamx-risk-brief');
  if(!box){box=document.createElement('section');box.id='seamx-risk-brief';box.style.cssText='margin:12px 0;padding:12px;border:1px solid #c3d5c7;background:#f7faf7;border-radius:6px;font-size:12px';const modal=$('modal-actividad-evidencias');modal?.querySelector('#activity-detail-review')?.before(box)}
  box.innerHTML='<button type="button" class="btn btn-outline btn-sm" id="seamx-risk-load">Ver reporte breve de riesgos e IPERC</button>';
  $('seamx-risk-load').onclick=()=>loadRiskReport(id);
  return result;
 };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
