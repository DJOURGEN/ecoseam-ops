(function(){
'use strict';
const LS='seamx_liderazgo_borradores_v1';
const CRITERIOS=[
'El supervisor está presente y conoce la actividad que se ejecutará.',
'Realiza o verifica la charla previa al trabajo.',
'Verifica que IPERC, PETS y permisos estén vigentes y correspondan a la tarea.',
'Confirma que el personal conoce los riesgos y controles críticos.',
'Verifica las competencias, autorizaciones y condiciones del personal asignado.',
'Confirma que equipos, herramientas y EPP sean adecuados y seguros.',
'Verifica la delimitación del área y el control de accesos.',
'Distribuye funciones y responsabilidades antes de iniciar.',
'Comprueba que la secuencia de trabajo esté definida y comprendida.',
'Mantiene comunicación efectiva con el personal durante la ejecución.',
'Escucha y atiende alertas o preocupaciones de los trabajadores.',
'Interviene oportunamente ante actos o condiciones inseguras.',
'Detiene la actividad cuando identifica un riesgo no controlado.',
'No presiona al personal para acelerar trabajos omitiendo controles.',
'Verifica nuevamente los riesgos cuando cambian las condiciones de trabajo.',
'Promueve el reporte de incidentes, cuasi accidentes y condiciones inseguras.',
'Corrige desviaciones y evita normalizar prácticas inseguras.',
'Verifica orden, limpieza y cierre seguro de la actividad.'
];
const PRIORITARIOS=[3,4,7,12,13,15];
let records=[],editing=null;
function get(){try{return JSON.parse(localStorage.getItem(LS)||'[]')}catch(e){return []}}
function persist(){try{localStorage.setItem(LS,JSON.stringify(records));return true}catch(e){alert('No se pudo guardar el registro localmente.');return false}}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','&#39;'}[c]}))}
function read(id){return document.getElementById(id)}
function val(id){return read(id)?.value?.trim()||''}
function isEvaluator(){return ['admin','gerencia','jefatura'].includes(APP.user?.role)}
function date(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function supervisorOptions(users){users=users||APP.data?.usuarios||[];users=users.filter(u=>{const role=String(u.rol||u.role||'').toLowerCase();return (role==='supervisor'||role==='supervisor_hse')&&(u.activo===true||u.activo===1||u.activo==='true'||u.activo==='t'||u.activo==null)});return users.map(u=>{const name=[u.nombre,u.apellido].filter(Boolean).join(' ')||u.name||u.login;return '<option value="'+esc(u.id)+'" data-name="'+esc(name)+'">'+esc(name)+'</option>'}).join('')}
async function setup(){
 const select=read('lead-supervisor');if(!select)return;
 {let users=APP.data?.usuarios||[];try{const r=await db.from('usuarios').select('id,login,nombre,apellido,rol,activo').in('rol',['supervisor','supervisor_hse']).eq('activo',true);if(!r.error&&r.data?.length)users=r.data}catch(e){console.warn('Lista de supervisores:',e)}const current=select.value;const allowed=users.filter(u=>String(u.rol||u.role||'').toLowerCase().includes('supervisor'));select.innerHTML='<option value="">Seleccionar supervisor</option>'+supervisorOptions(allowed);if(current)select.value=current;if(!select.value&&select.options.length===1){const opt=document.createElement('option');opt.textContent='No se encontraron supervisores activos';opt.disabled=true;select.appendChild(opt)}if(!allowed.length)console.warn('Sin supervisores disponibles en usuarios; revisar rol/activo y permisos de consulta')}
 if(!val('lead-date'))read('lead-date').value=date();
 read('lead-evaluator').textContent=APP.user?.name||APP.user?.nombre||APP.user?.login||'';
 read('lead-form').style.display=isEvaluator()?'block':'none';
 const tabs=document.querySelector('.lead-tabs');if(tabs)tabs.style.display=isEvaluator()?'flex':'none';
 const report=read('lead-report-tab');if(report&&!isEvaluator()){read('lead-eval-tab').hidden=true;report.hidden=false}
 read('lead-access').style.display=isEvaluator()?'none':'block';if(!isEvaluator())read('lead-access').textContent='Resultados y retroalimentación de tu evaluación. Solo se muestran registros disponibles para este usuario en este dispositivo.';
 if(!read('lead-criteria').children.length)read('lead-criteria').innerHTML=CRITERIOS.map((x,i)=>'<div class="lead-criterion"><div class="lead-criterion-label"><span class="lead-n">'+(i+1)+'</span>'+esc(x)+(PRIORITARIOS.includes(i+1)?'<span class="lead-critical-label">Criterio de control</span>':'')+'</div><div class="lead-options"><label><input type="radio" name="lead-q'+i+'" value="2" onchange="seamxLeadScore()">2</label><label><input type="radio" name="lead-q'+i+'" value="1" onchange="seamxLeadScore()">1</label><label><input type="radio" name="lead-q'+i+'" value="0" onchange="seamxLeadScore()">0</label><label><input type="radio" name="lead-q'+i+'" value="NA" onchange="seamxLeadScore()">N/A</label></div><input class="lead-note" id="lead-note-'+i+'" placeholder="Observación o evidencia (obligatoria para 0, 1 o N/A)"></div>').join('');
 seamxLeadScore();seamxLeadRender();
}
function scoreInfo(){
 const answers=CRITERIOS.map((_,i)=>{const el=document.querySelector('input[name="lead-q'+i+'"]:checked');return el?{v:el.value,note:val('lead-note-'+i)}:null});
 const applied=answers.filter(a=>a&&a.v!=='NA'), points=applied.reduce((n,a)=>n+Number(a.v),0),max=applied.length*2;
 const pct=max?100*points/max:null;
 const gaps=answers.filter(a=>a&&(a.v==='0'||a.v==='1'||a.v==='NA')&&!a.note);
 return{answers,points,max,pct,gaps};
}
window.seamxLeadScore=function(){const p=scoreInfo(),out=read('lead-score');if(out)out.textContent=p.pct===null?'Sin puntuación':p.points+' / '+p.max+' · '+p.pct.toFixed(1)+'%';const state=read('lead-level');if(state)state.textContent=p.pct===null?'Pendiente':p.pct>=90?'Satisfactorio':p.pct>=80?'Con oportunidades de mejora':'Requiere plan de mejora'};
window.seamxLeadSave=function(){
 if(!isEvaluator())return alert('Evaluación reservada para gerencia y administración.');
 const supervisor=read('lead-supervisor'),id=supervisor.value,name=supervisor.selectedOptions[0]?.dataset.name||'';
 const p=scoreInfo();
 if(!id||!val('lead-date')||!val('lead-activity')||!val('lead-area'))return alert('Indica supervisor, fecha, actividad y área.');
 if(p.answers.some(a=>a===null))return alert('Califica los 18 criterios. Utiliza N/A cuando no aplique.');
 if(!p.max)return alert('Debe existir al menos un criterio aplicable.');
 if(p.gaps.length)return alert('Justifica cada criterio con 0, 1 o N/A.');
 if(read('lead-critical').checked&&!val('lead-action'))return alert('Describe la acción inmediata ante una desviación crítica.');
 const newRec={id:editing||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),supervisor_id:id,supervisor:name,evaluator:read('lead-evaluator').textContent,fecha:val('lead-date'),area:val('lead-area'),actividad:val('lead-activity'),guardia:val('lead-shift'),fase:val('lead-phase'),answers:p.answers,points:p.points,max:p.max,pct:p.pct,crit:read('lead-critical').checked,action:val('lead-action'),strengths:val('lead-strengths'),improve:val('lead-improve'),commitment:val('lead-commitment'),owner:val('lead-owner'),due:val('lead-due'),next:val('lead-next'),verified:false,created:new Date().toISOString()};
 records=records.filter(r=>r.id!==newRec.id);records.push(newRec);
 if(!persist())return;
 editing=null;read('lead-form').querySelectorAll('input:not([type=radio]):not([type=checkbox]), textarea').forEach(el=>{if(el.id!=='lead-evaluator')el.value=''});read('lead-form').querySelectorAll('input[type=radio],input[type=checkbox]').forEach(el=>el.checked=false);read('lead-criteria').querySelectorAll('.lead-note').forEach(n=>n.value='');
 read('lead-date').value=date();read('lead-supervisor').value='';seamxLeadScore();seamxLeadRender();
 alert('Evaluación guardada como registro local. Aún no está sincronizada entre dispositivos.');
};
window.seamxLeadVerify=function(id){if(!isEvaluator())return;const x=records.find(r=>r.id===id);if(!x)return;if(!x.commitment)return alert('No existe compromiso asociado.');if(!confirm('¿Se verificó la implementación efectiva del compromiso en campo?'))return;x.verified=true;x.verifiedAt=new Date().toISOString();persist();seamxLeadRender()};
function grouped(){const map={};records.forEach(r=>{const n=r.supervisor||'Sin identificar';(map[n]??=[]).push(r)});return Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0]))}
window.seamxLeadRender=function(){
 records=get();
 const tbl=read('lead-supervisors');if(!tbl)return;
 const visible=isEvaluator()?records:records.filter(r=>String(r.supervisor_id)===String(APP.user?.id));
 const source=records;records=visible;
 const n=records.length,pending=records.filter(r=>r.commitment&&!r.verified).length,critical=records.filter(r=>r.crit&&!r.verified).length,avg=n?records.reduce((t,r)=>t+Number(r.pct||0),0)/n:null;
 read('lead-kpis').innerHTML=[['Evaluaciones',n],['Promedio',avg===null?'—':avg.toFixed(1)+'%'],['Compromisos pendientes',pending],['Críticos sin verificar',critical]].map(([l,v])=>'<div class="lead-kpi"><small>'+l+'</small><b>'+v+'</b></div>').join('');
 tbl.innerHTML=grouped().map(([name,a])=>{a.sort((x,y)=>x.fecha.localeCompare(y.fecha));const first=a[0],last=a[a.length-1],improvement=last.pct-first.pct,pending=a.filter(x=>x.commitment&&!x.verified).length,cr=a.filter(x=>x.crit&&!x.verified).length;return '<tr><td>'+esc(name)+'</td><td>'+a.length+'</td><td>'+last.pct.toFixed(1)+'%</td><td>'+(a.length>1?(improvement>=0?'+':'')+improvement.toFixed(1)+' pp':'—')+'</td><td>'+pending+'</td><td>'+cr+'</td></tr>'}).join('')||'<tr><td colspan="6">No existen evaluaciones registradas en este navegador.</td></tr>';
 read('lead-records').innerHTML=records.slice().sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(r=>'<tr><td>'+esc(r.fecha)+'</td><td>'+esc(r.supervisor)+'</td><td>'+r.pct.toFixed(1)+'%</td><td>'+esc(r.fase)+'</td><td>'+esc(r.commitment||'—')+'</td><td>'+(r.verified?'Verificado':r.commitment?'<button class="lead-btn-alt" onclick="seamxLeadVerify(\''+esc(r.id)+'\')">Verificar en campo</button>':'—')+'</td></tr>').join('')||'<tr><td colspan="6">Sin registros</td></tr>';
 records=source;
};
window.seamxLeadInit=setup;
window.seamxLeadExport=function(){if(!isEvaluator())return;const payload=JSON.stringify(get(),null,2),blob=new Blob([payload],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='seamx_evaluaciones_liderazgo_'+date()+'.json';a.click();URL.revokeObjectURL(url)};
})();