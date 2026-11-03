/* SEAMX · Ajustes operativos 28/10/2026 (sin alterar login heredado) */
(function(){
'use strict';
const $=id=>document.getElementById(id);
let sharedPlan=[],remoteReviews=null,radarChart=null;
const localStore=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}};
const clean=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
function toast(message,type='warning'){if(typeof showToast==='function')showToast(message,type);else alert(message)}
async function requireAuth(){
 const c=window.seamxSignatureDb;
 if(!APP?.user?.id||!c)throw Error('Sesión SEAMX no disponible.');
 const u=await c.auth.getUser();
 if(!u.data?.user?.id)throw Error('Esta operación necesita una sesión segura activa; no se solicitará una segunda contraseña.');
 const p=await c.from('usuarios').select('auth_user_id,activo').eq('id',APP.user.id).eq('activo',true).maybeSingle();
 if(p.error||p.data?.auth_user_id!==u.data.user.id)throw Error('La sesión no corresponde a este usuario.');
 return c;
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
  const c=window.seamxSignatureDb;
  if(!c)return;
  const sess=await c.auth.getSession();if(!sess.data?.session)return;
  const r=await c.functions.invoke('seamx-reportes',{body:{type:'radar'}});
  if(r.error||!r.data?.ok)throw Error(r.data?.error||r.error?.message||'No disponible');
  remoteReviews=r.data.items;drawRadar();
 }catch(e){if(interactive)toast(e.message||'No se pudieron cargar las evaluaciones')}
}
async function loadRiskReport(id){
 const box=$('seamx-risk-brief');if(!box)return;
 box.textContent='Consultando fotografías de actividad e IPERC…';
 try{
 const act=(APP?.data?.actividades||[]).find(a=>String(a.id)===String(id));
 if(!act)throw Error('Actividad no encontrada');
 const ids=activityGroupMembers(act).map(a=>a.id);
 const r=await db.from('actividades').select('descripcion_cierre,foto_antes_url,foto_durante_url,foto_despues_url,fotos_iperc').in('id',ids).limit(100);
 if(r.error)throw r.error;
 const rows=r.data||[],item=rows.find(x=>Array.isArray(x.fotos_iperc)&&x.fotos_iperc.length)||rows[0]||{};
 box.replaceChildren();
 const heading=document.createElement('h4');heading.textContent='Evidencias fotográficas';box.append(heading);
 const desc=document.createElement('p');desc.textContent='Trabajo realizado: '+(item.descripcion_cierre||'Sin descripción de cierre');box.append(desc);
 const gallery=document.createElement('div');gallery.style.cssText='display:flex;flex-wrap:wrap;gap:10px';
 const pics=[['Antes',item.foto_antes_url],['Durante',item.foto_durante_url],['Después',item.foto_despues_url],...(item.fotos_iperc||[]).map((u,i)=>['IPERC '+(i+1),u])];
 for(const [name,url] of pics){if(!/^https:\/\//.test(url||''))continue;const f=document.createElement('figure');f.style.cssText='margin:0;width:145px';const im=document.createElement('img');im.src=url;im.alt=name;im.loading='lazy';im.style.cssText='width:145px;height:110px;object-fit:cover';const cap=document.createElement('figcaption');cap.textContent=name;f.append(im,cap);gallery.append(f)}
 if(!gallery.childElementCount)gallery.textContent='No hay fotografías guardadas';
 box.append(gallery);
 }catch(e){box.textContent='No se pudo consultar: '+(e.message||e)}
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
 /* El modal de riesgos y el de cierre los controla index.html.
    Nunca presentar informes IPERC al operario desde Detalle. */
 const originalView=window.viewActivityEvidence;
 if(typeof originalView==='function')window.viewActivityEvidence=function(id){
   const result=originalView(id);
   const box=$('seamx-risk-brief');if(box)box.remove();
   if(APP?.user?.role!=='operador'){
     let report=$('seamx-risk-brief');
     if(!report){report=document.createElement('section');report.id='seamx-risk-brief';report.style.cssText='margin:12px 0;padding:12px;border:1px solid #c3d5c7;background:#f7faf7;border-radius:6px;font-size:12px';$('modal-actividad-evidencias')?.querySelector('#activity-detail-review')?.before(report);}
     if(report){report.innerHTML='<button type="button" class="btn btn-outline btn-sm" id="seamx-risk-load">Ver reporte breve de riesgos e IPERC</button>';$('seamx-risk-load').onclick=()=>loadRiskReport(id);}
   }
   return result;
 };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();


(function(){const s=document.createElement('script');s.src='seamx-nov26.js?v=20261103-fix-runtime-v1';document.head.appendChild(s)})();
