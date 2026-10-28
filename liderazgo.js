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
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function read(id){return document.getElementById(id)}
function val(id){return read(id)?.value?.trim()||''}
function isEvaluator(){return ['admin','gerencia','jefatura'].includes(APP.user?.role)}
function date(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function supervisorOptions(users){users=users||APP.data?.usuarios||[];users=users.filter(u=>{const role=String(u.rol||u.role||'').toLowerCase();return (role==='supervisor'||role==='supervisor_hse')&&(u.activo===true||u.activo===1||u.activo==='true'||u.activo==='t'||u.activo==null)});return users.map(u=>{const name=[u.nombre,u.apellido].filter(Boolean).join(' ')||u.name||u.login;return '<option value="'+esc(u.id)+'" data-name="'+esc(name)+'">'+esc(name)+'</option>'}).join('')}
async function setup(){
 const select=read('lead-supervisor');if(!select)return;
 const retained=select.value;
 select.disabled=true;select.innerHTML='<option value="">Consultando supervisores…</option>';
 let users=(APP.data?.usuarios||[]).filter(u=>['supervisor','supervisor_hse'].includes(String(u.rol||u.role||'').toLowerCase()));
 try{
  const {data,error}=await db.from('usuarios').select('id,login,nombre,apellido,rol,activo').in('rol',['supervisor','supervisor_hse']).order('nombre',{ascending:true});
  if(error)throw error;
  if(Array.isArray(data))users=data;
 }catch(error){console.error('SEAMX Liderazgo: no se pudo consultar supervisores',error);}
 const active=users.filter(u=>u.activo!==false&&u.activo!==0&&u.activo!=='false'&&u.activo!=='f').sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||''),'es'));
 select.innerHTML='<option value="">Seleccionar supervisor</option>'+supervisorOptions(active);
 select.disabled=active.length===0;
 const role=APP.user?.role;
 // La lista debe permitir seleccionar cualquiera de los supervisores activos a perfiles evaluadores.
 if(isEvaluator() && active.length)select.disabled=false;
 const userOnly=role==='supervisor'||role==='supervisor_hse';
 if(retained&&Array.from(select.options).some(o=>o.value===retained))select.value=retained;
 if(!active.length){select.innerHTML='<option value="">No se encontraron supervisores activos</option>';select.disabled=true;select.title='Verifica el acceso al listado de usuarios';}
 const hint=read('lead-supervisor-status');if(hint)hint.textContent=active.length?active.length+' supervisores activos disponibles':'No se pudieron cargar supervisores activos';
 if(!val('lead-date'))read('lead-date').value=date();
 read('lead-evaluator').textContent=APP.user?.name||APP.user?.nombre||APP.user?.login||'';
 read('lead-form').style.display=isEvaluator()?'block':'none';
 const tabs=document.querySelector('.lead-tabs');if(tabs)tabs.style.display=isEvaluator()?'flex':'none';
 const report=read('lead-report-tab');if(report&&!isEvaluator()){read('lead-eval-tab').hidden=true;report.hidden=false}
 const sTable=read('lead-supervisors')?.closest('.table-wrap');if(sTable)sTable.style.display=userOnly?'none':'';
 const recordList=read('lead-records')?.closest('.table-wrap');if(recordList)recordList.style.display=userOnly?'none':'';
 const privateIndicator=read('lead-private-indicator');if(privateIndicator)privateIndicator.style.display=userOnly?'block':'none';
 read('lead-access').style.display=isEvaluator()?'none':'block';if(!isEvaluator())read('lead-access').textContent='Resultados y retroalimentación de tu evaluación. Solo se muestran registros disponibles para este usuario en este dispositivo.';
 if(!read('lead-criteria').children.length)read('lead-criteria').innerHTML=CRITERIOS.map((x,i)=>{
 const radios=['2','1','0','NA'].map(v=>'<label title="'+({2:'Cumple',1:'Cumple parcialmente',0:'No cumple',NA:'No aplica'}[v])+'"><input type="radio" name="lead-q'+i+'" value="'+v+'" onchange="seamxLeadScore()">'+(v==='NA'?'N/A':v)+'</label>').join('');
 return '<div class="lead-criterion" role="row"><span class="lead-n" role="cell">'+(i+1)+'</span><div class="lead-criterion-label" role="cell">'+esc(x)+(PRIORITARIOS.includes(i+1)?'<span class="lead-critical-label">Control prioritario</span>':'')+'</div><div class="lead-options" role="cell">'+radios+'</div><div role="cell"><input class="lead-note" id="lead-note-'+i+'" aria-label="Observación o evidencia del criterio '+(i+1)+'" placeholder="Observaciones / evidencia (obligatoria para 0, 1 o N/A)"></div></div>';
 }).join('');
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
 if(!isEvaluator())return alert('Solo Gerencia, Jefatura y Administración pueden realizar evaluaciones.');
 const supervisor=read('lead-supervisor'),id=supervisor.value,name=supervisor.selectedOptions[0]?.dataset.name||'';
 const p=scoreInfo();
 if(!id||!val('lead-date')||!val('lead-activity')||!val('lead-area'))return alert('Indica supervisor, fecha, actividad y área.');
 if(p.answers.some(a=>a===null))return alert('Califica los 18 criterios. Utiliza N/A cuando no aplique.');
 if(!p.max)return alert('Debe existir al menos un criterio aplicable.');
 if(p.gaps.length)return alert('Justifica cada criterio con 0, 1 o N/A.');
 
 const newRec={firma_evaluador:val('lead-evaluator-signature')||read('lead-evaluator').textContent,firma_supervisor:val('lead-supervisor-signature'),id:editing||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),supervisor_id:id,supervisor:name,evaluator:read('lead-evaluator').textContent,fecha:val('lead-date'),area:val('lead-area'),actividad:val('lead-activity'),guardia:val('lead-shift'),fase:'Evaluación de campo',answers:p.answers,points:p.points,max:p.max,pct:p.pct,crit:false,action:'',strengths:val('lead-strengths'),improve:val('lead-improve'),commitment:val('lead-commitment'),owner:val('lead-owner'),due:val('lead-due'),next:val('lead-next'),verified:false,created:new Date().toISOString()};
 records=records.filter(r=>r.id!==newRec.id);records.push(newRec);
 if(!persist())return;
 editing=null;read('lead-form').querySelectorAll('input:not([type=radio]):not([type=checkbox]), textarea').forEach(el=>{if(el.id!=='lead-evaluator')el.value=''});read('lead-form').querySelectorAll('input[type=radio],input[type=checkbox]').forEach(el=>el.checked=false);read('lead-criteria').querySelectorAll('.lead-note').forEach(n=>n.value='');
 read('lead-date').value=date();read('lead-supervisor').value='';seamxLeadScore();seamxLeadRender();
 alert('Evaluación guardada como registro local. Aún no está sincronizada entre dispositivos.');
};


window.seamxLeadRequestSignature=async function(id){
 if(!isEvaluator())return alert('Solo Administración, Gerencia y Jefatura pueden solicitar firmas.');
 const r=get().find(x=>String(x.id)===String(id));
 if(!r)return alert('Evaluación no disponible en este equipo.');
 const session=await db.auth.getUser();
 if(session.error||!session.data?.user)return alert('Primero verifica tu cuenta de Supabase Auth en el panel de Firma electrónica.');
 const uid=session.data.user.id;
 const owner=await db.from('usuarios').select('id,login,rol,activo').eq('auth_user_id',uid).eq('activo',true).maybeSingle();
 if(owner.error||!owner.data||owner.data.id!==APP.user?.id||!['admin','gerencia','jefatura'].includes(owner.data.rol))
   return alert('La cuenta Auth no corresponde al evaluador que inició sesión.');
 const supervisor=await db.from('usuarios').select('id,nombre,apellido,activo,rol,auth_user_id')
   .eq('id',Number(r.supervisor_id)).eq('activo',true).maybeSingle();
 const p=supervisor.data;
 if(supervisor.error||!p?.auth_user_id||!['supervisor','supervisor_hse'].includes(p.rol))
   return alert('Este supervisor aún no tiene una identidad Auth disponible.');
 if(!confirm('¿Solicitar firma personal a '+p.nombre+'?'))return;
 const key=uid+':'+String(r.id);
 const lookup=await db.from('evaluaciones_liderazgo').select('id').eq('origen_cliente_key',key).maybeSingle();
 if(lookup.error)return alert('No se pudo verificar el registro: '+lookup.error.message);
 let rowId=lookup.data?.id;
 if(!rowId){
   const insert=await db.from('evaluaciones_liderazgo').insert({
     origen_cliente_key:key,supervisor_id:p.id,supervisor_nombre:[p.nombre,p.apellido].filter(Boolean).join(' '),
     evaluador_login:owner.data.login,evaluador_nombre:APP.user.name||owner.data.login,
     fecha:r.fecha,area:r.area,actividad:r.actividad,guardia:r.guardia||'',
     fase:'Evaluación de campo',respuestas:r.answers,puntaje_obtenido:r.points,
     puntaje_maximo:r.max,porcentaje:r.pct,riesgo_critico:!!r.crit,
     fortalezas:r.strengths||'',oportunidades:r.improve||'',
     compromisos:r.commitment?[{texto:r.commitment,responsable:r.owner||'',fecha:r.due||''}]:[],
     fecha_proxima:/^\d{4}-\d{2}-\d{2}$/.test(r.next||'')?r.next:null,
     observaciones:'Pendiente de firma personal'
   }).select('id').single();
   if(insert.error)return alert('No se pudo sincronizar la evaluación: '+insert.error.message);
   rowId=insert.data.id;
 }
 const request=await db.from('liderazgo_solicitudes_firma').upsert({
    evaluacion_id:rowId,supervisor_auth_uid:p.auth_user_id,evaluador_auth_uid:uid
 },{onConflict:'evaluacion_id',ignoreDuplicates:true});
 if(request.error)return alert('Evaluación registrada, pero no se pudo solicitar firma: '+request.error.message);
 alert('Solicitud enviada. El supervisor debe aceptarla personalmente al iniciar sesión con Supabase Auth.');
};

window.seamxLeadView=function(id){
 const r=get().find(x=>String(x.id)===String(id));if(!r)return alert('Evaluación no encontrada');
 const lines=['Supervisor: '+r.supervisor,'Fecha: '+r.fecha,'Área: '+r.area,'Actividad: '+r.actividad,'Resultado: '+Number(r.pct).toFixed(1)+'%','Fortalezas: '+(r.strengths||'—'),'Oportunidades: '+(r.improve||'—'),'Compromiso: '+(r.commitment||'—')];
 (r.answers||[]).forEach((a,i)=>lines.push((i+1)+'. '+CRITERIOS[i]+' — '+(a?.v||'—')+(a?.note?' | '+a.note:'')));
 const dlg=document.getElementById('seamx-lead-detail')||document.createElement('dialog');dlg.id='seamx-lead-detail';dlg.style.cssText='max-width:min(900px,92vw);max-height:86vh;overflow:auto;padding:22px;border:1px solid #8caf9b;background:#fff;color:#17432d';if(!dlg.parentNode)document.body.appendChild(dlg);
 dlg.innerHTML='<h2>Evaluación de liderazgo</h2><pre style="white-space:pre-wrap;font:13px/1.6 system-ui">'+esc(lines.join('\n'))+'</pre><button type="button">Cerrar</button>';dlg.querySelector('button').onclick=()=>dlg.close();dlg.showModal();
};
window.seamxLeadEdit=function(id){
 if(!isEvaluator())return alert('Solo Gerencia, Jefatura y Administración pueden editar');
 const r=get().find(x=>String(x.id)===String(id));if(!r)return alert('Evaluación no encontrada');
 editing=r.id;
 const fields={'lead-date':r.fecha,'lead-area':r.area,'lead-activity':r.actividad,'lead-shift':r.guardia,'lead-strengths':r.strengths,'lead-improve':r.improve,'lead-commitment':r.commitment,'lead-owner':r.owner,'lead-due':r.due,'lead-next':r.next,'lead-evaluator-signature':r.firma_evaluador,'lead-supervisor-signature':r.firma_supervisor};
 Object.entries(fields).forEach(([k,v])=>{const el=read(k);if(el)el.value=v||''});
 const sup=read('lead-supervisor');if(sup)sup.value=String(r.supervisor_id);
 (r.answers||[]).forEach((a,i)=>{const radio=document.querySelector('input[name="lead-q'+i+'"][value="'+a.v+'"]');if(radio)radio.checked=true;const note=read('lead-note-'+i);if(note)note.value=a.note||''});
 read('lead-eval-tab').hidden=false;read('lead-report-tab').hidden=true;seamxLeadScore();read('lead-eval-tab').scrollIntoView({behavior:'smooth'});
};

window.seamxLeadDelete=function(id){
 if(!['admin','gerencia','jefatura'].includes(APP.user?.role))return alert('No tienes permiso para eliminar evaluaciones.');
 const r=get().find(x=>String(x.id)===String(id));if(!r)return alert('No se encontró la evaluación.');
 if(!confirm('¿Eliminar la evaluación de '+r.supervisor+' del '+r.fecha+'? Esta acción no se puede deshacer en este navegador.'))return;
 records=get().filter(x=>String(x.id)!==String(id));
 if(!persist())return;
 if(editing===id)editing=null;
 seamxLeadRender();
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
 read('lead-records').innerHTML=records.slice().sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(r=>'<tr><td>'+esc(r.fecha)+'</td><td>'+esc(r.supervisor)+'</td><td>'+r.pct.toFixed(1)+'%</td><td>'+esc(r.commitment||'—')+'</td><td>'+(r.verified?'Verificado':r.commitment&&isEvaluator()?'<button class="lead-btn-alt" onclick="seamxLeadVerify(\''+esc(r.id)+'\')">Verificar en campo</button>':'—')+' <button class="lead-btn-alt" onclick="seamxLeadView(\''+esc(r.id)+'\')">Ver</button> '+(isEvaluator()?'<button class="lead-btn-alt" onclick="seamxLeadEdit(\''+esc(r.id)+'\')">Editar</button>':'')+(isEvaluator()?'<button class="lead-btn-alt" style="color:#a83232" onclick="seamxLeadDelete(\''+esc(r.id)+'\')">Eliminar</button>':'')+'</td></tr>').join('')||'<tr><td colspan="5">Sin registros</td></tr>';
 if(isEvaluator()){
   read('lead-records')?.querySelectorAll('tr').forEach((tr,i)=>{
     const r=records.slice().sort((a,b)=>b.fecha.localeCompare(a.fecha))[i];
     if(!r)return;
     const btn=document.createElement('button');btn.type='button';btn.className='lead-btn-alt';
     btn.textContent='Solicitar firma';
     btn.addEventListener('click',()=>window.seamxLeadRequestSignature(r.id));
     tr.lastElementChild?.append(' ',btn);
   });
 }
 records=source;
};
window.seamxLeadInit=setup;
window.seamxLeadPrint=function(){if(!isEvaluator())return;const v=read('lead-eval-tab');if(v)v.hidden=false;const rep=read('lead-report-tab');if(rep)rep.hidden=true;window.print()};
window.seamxLeadExport=function(){if(!isEvaluator())return;const payload=JSON.stringify(get(),null,2),blob=new Blob([payload],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='seamx_evaluaciones_liderazgo_'+date()+'.json';a.click();URL.revokeObjectURL(url)};
})();