/* SEAMX actualización Nov 2026 */
(function(){
'use strict';
const el=id=>document.getElementById(id),role=()=>APP?.user?.role;
const ids=['ops-curve','ops-curve-hdpe','ops-trucks','ops-inbound','ops-outbound','ops-month-share','ops-value-share','ops-occupancy-heatmap','ops-material-composition','ops-gerencias-chart','ops-lead-radar'];
const titles=['Curva metálica','Curva HDPE','Camiones por día','Ingresos por día','Evacuaciones por día','Meta mensual','Meta valorizable','Ocupabilidad','Material pesado y liviano','Ingresos por gerencia','Liderazgo'];
let permits={};
const notify=(s,type='warning')=>typeof showToast==='function'?showToast(s,type):console.log(s);
function styling(){
if(el('nov26-styles'))return;
const s=document.createElement('style');s.id='nov26-styles';s.textContent='body.seamx-antamina #actividades-dashboard-slot,body.seamx-antamina #view-actividades>.page-header{display:none!important}#seamx-visibility-panel{padding:13px;border:1px solid #bfd5c5;background:#f1f9f4;margin:12px 0}#seamx-visibility-panel label{display:inline-flex;align-items:center;gap:5px;margin:6px 12px 6px 0;font-size:12px}#seamx-filter-box{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px;background:#e7f4ef;border-left:4px solid #197457;margin:8px 0}#seamx-filter-box input{padding:7px;border:1px solid #acc6b9}#view-programacion.nov26-readonly .prog-layout{display:block!important}#view-programacion.nov26-readonly #programacion-form-card,#view-programacion.nov26-readonly .seamx-reprog-entry{display:none!important}#view-programacion.nov26-readonly .seamx-doc-page td{overflow-wrap:anywhere!important;white-space:normal!important}#seamx-iperc-gallery{display:flex;flex-wrap:wrap;gap:9px}#seamx-iperc-gallery figure{margin:0}#seamx-iperc-gallery img{width:140px;height:110px;object-fit:cover}';
document.head.appendChild(s);
}
function applyRole(){
const ant=role()==='antamina';const slot=el('actividades-dashboard-slot');if(ant&&slot)slot.style.display='none';
const heading=el('activity-hero-title');if(ant&&heading)heading.textContent='Control visual de actividades';
const v=el('view-programacion');if(v)v.classList.toggle('nov26-readonly',ant);
if(ant&&typeof NAV_CONFIG!=='undefined'&&!NAV_CONFIG.antamina.includes('programacion')){NAV_CONFIG.antamina.splice(1,0,'programacion');if(typeof setupUI==='function')setupUI();if(slot)slot.style.display='none';}
}
async function loadPermits(){
try{const r=await db.from('seamx_dashboard_visibilidad').select('graficos').eq('id',1).maybeSingle();if(!r.error)permits=r.data?.graficos||{}}catch(e){console.warn(e)}
}
function applyPermits(){
ids.forEach(id=>{const p=el(id)?.closest('.seamx-ops-panel');if(p)p.style.display=role()==='antamina'&&permits[id]===false?'none':''});
}
function permissionEditor(){
if(role()!=='admin'||el('seamx-visibility-panel'))return;
const host=el('ops-metrics');if(!host)return;
const p=document.createElement('section');p.id='seamx-visibility-panel';p.innerHTML='<h3>Dashboard visible para Antamina</h3><p>Marca los gráficos autorizados para la cuenta Antamina (solo lectura).</p><div id="nov26-options"></div><button class="btn btn-primary" id="nov26-save-permits">Guardar selección</button>';host.before(p);
const box=el('nov26-options');
ids.forEach((id,i)=>{const l=document.createElement('label'),c=document.createElement('input');c.type='checkbox';c.dataset.chart=id;c.checked=permits[id]!==false;l.append(c,document.createTextNode(titles[i]));box.append(l)});
el('nov26-save-permits').onclick=async()=>{try{
const graficos=Object.fromEntries([...box.querySelectorAll('input')].map(c=>[c.dataset.chart,c.checked]));
const auth=await window.seamxExtrasEnsureAuth();const r=await auth.functions.invoke('seamx-visibilidad-admin',{body:{graficos}});
if(r.error||!r.data?.ok)throw Error(r.data?.error||r.error?.message);permits=graficos;notify('Selección de Antamina guardada','success');
}catch(e){notify('No se pudo guardar: '+e.message,'error')}};
}
function updateCompliance(){
const rows=[...document.querySelectorAll('#ops-metrics .seamx-ops-metric')],item=s=>rows.find(r=>r.querySelector('small')?.textContent?.trim().toLowerCase()===s),number=s=>Number.parseFloat(item(s)?.querySelector('strong')?.textContent)||0;
const p=number('evacuación programada'),v=number('evacuado'),target=item('cumplimiento')?.querySelector('strong');
if(target)target.textContent=p>0?(100*v/p).toFixed(1)+'%':'Sin programación';
}
function controlDates(){
if(el('seamx-filter-box'))return;
const charts=el('view-opsdashboard')?.querySelector('.seamx-ops-charts');if(!charts)return;
const p=document.createElement('div');p.id='seamx-filter-box';
p.innerHTML='<strong>Filtro de gráficos diarios</strong> <label>Desde <input id="nov26-from" type="date"></label> <label>Hasta <input id="nov26-to" type="date"></label> <button class="btn btn-primary" id="nov26-filter">Aplicar</button><small>Camiones, ingresos, evacuaciones, materiales y gerencias. Curvas S: filtro independiente.</small>';charts.before(p);
const today=new Date(),format=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
el('nov26-from').value=format(new Date(today.getFullYear(),today.getMonth(),1));el('nov26-to').value=format(today);
el('nov26-filter').onclick=filterCharts;
}
function draw(id,type,labels,data){if(typeof seamxOpsChart==='function')seamxOpsChart(id,type,labels,data)}
async function filterCharts(){
const from=el('nov26-from')?.value,to=el('nov26-to')?.value;if(!from||!to||from>to)return;
const first=Date.parse(from+'T12:00:00'),end=Date.parse(to+'T12:00:00'),count=(end-first)/86400000+1;if(count>366)return notify('Máximo 366 días');
const [a,b]=await Promise.all([db.from('evacuaciones_excel').select('fecha,ticket_balanza,peso_tn,peso_4388,descripcion,tipo_residuo').gte('fecha',from).lte('fecha',to).limit(10000),db.from('movimientos_material').select('fecha,movimiento,peso_tn,subclase,tipo_residuo,gerencia').eq('movimiento','ingreso').gte('fecha',from).lte('fecha',to).limit(10000)]);
if(a.error||b.error)return notify('No se pudieron cargar los gráficos','error');
const tickets=new Map(),out={},inc={},weights=[0,0,0,0],groups=new Map();let other=0;
for(const r of a.data||[]){const date=String(r.fecha).slice(0,10),v=seamxOpsPeso(r);out[date]=(out[date]||0)+v;const t=String(r.ticket_balanza||'');if(t)tickets.set(date+'|'+t,date)}
for(const r of b.data||[]){const date=String(r.fecha).slice(0,10),v=Number(r.peso_tn)||0;inc[date]=(inc[date]||0)+v;const type=String(r.tipo_residuo||'').toLowerCase(),sub=String(r.subclase||'').toLowerCase(),heavy=type.includes('pesad'),light=type.includes('livian'),non=/^no\s*met[aá]lico/.test(sub),metal=/^met[aá]lico/.test(sub);if((heavy||light)&&(non||metal))weights[(heavy?2:0)+(non?1:0)]+=v;else other+=v;const g=String(r.gerencia||'Sin gerencia');groups.set(g,(groups.get(g)||0)+v)}
const days=Array.from({length:count},(_,i)=>{const d=new Date(first+i*86400000);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')});
const labels=days.map(d=>d.slice(8)+'/'+d.slice(5,7)),counts={};for(const d of tickets.values())counts[d]=(counts[d]||0)+1;
draw('ops-trucks','bar',labels,[{label:'Tickets únicos',data:days.map(d=>counts[d]||0),backgroundColor:'#1688a3'}]);
draw('ops-inbound','bar',labels,[{label:'Ingreso (tn)',data:days.map(d=>inc[d]||0),backgroundColor:'#52b58d'}]);
draw('ops-outbound','bar',labels,[{label:'Evacuación (tn)',data:days.map(d=>out[d]||0),backgroundColor:'#22664b'}]);
const cv=el('ops-material-composition');if(cv&&typeof Chart!=='undefined'){Chart.getChart(cv)?.destroy();new Chart(cv,{type:'doughnut',data:{labels:['Liviano','Pesado'],datasets:[{data:[weights[0]+weights[1],weights[2]+weights[3]],backgroundColor:['#66c5a9','#195d49']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{tooltip:{callbacks:{label:c=>['Total '+Number(c.raw).toFixed(2)+' tn','Metálico '+weights[c.dataIndex?2:0].toFixed(2)+' tn','No metálico '+weights[c.dataIndex?3:1].toFixed(2)+' tn']}}}}});const note=cv.closest('.seamx-ops-panel')?.querySelector('.seamx-material-note');if(note)note.textContent='Sin clasificar: '+other.toFixed(2)+' tn'}
const bar=el('ops-gerencias-chart');if(bar){const rows=[...groups].sort((x,y)=>y[1]-x[1]),max=rows[0]?.[1]||1;bar.replaceChildren();for(const [name,v] of rows){const line=document.createElement('div');line.className='seamx-pyramid-row';const n=document.createElement('span');n.textContent=name;const val=document.createElement('div');val.className='seamx-pyramid-bar';val.style.width=Math.max(8,100*v/max)+'%';val.style.background='#267d60';val.textContent=v.toFixed(2)+' tn';line.append(n,val);bar.append(line)}}
applyPermits();
}
function hdpePanel(){
if(el('ops-curve-hdpe'))return;const main=el('ops-curve')?.closest('.seamx-ops-panel');if(!main)return;
const p=document.createElement('div');p.className='seamx-ops-panel';
p.innerHTML='<h3>Curva S · Tuberías HDPE</h3><p>Programado vs evacuado (tn) · periodo de la Curva S</p><div id="nov26-hdpe-edit"></div><p id="nov26-hdpe-note"></p><canvas id="ops-curve-hdpe"></canvas>';main.after(p);
if(role()==='admin'){el('nov26-hdpe-edit').innerHTML='<label>Fecha <input type="date" id="nov26-hdpe-date"></label> <label>Guardia <select id="nov26-hdpe-guard"><option>A</option><option>B</option></select></label> <label>Toneladas <input type="number" min="0" step=".01" id="nov26-hdpe-ton"></label> <button class="btn btn-outline" id="nov26-hdpe-save">Guardar programación HDPE</button>';el('nov26-hdpe-save').onclick=async()=>{try{const fecha=el('nov26-hdpe-date').value,guardia=el('nov26-hdpe-guard').value,toneladas=Number(el('nov26-hdpe-ton').value);if(!fecha||!Number.isFinite(toneladas)||toneladas<0)throw Error('Datos inválidos');const c=await window.seamxExtrasEnsureAuth(),r=await c.functions.invoke('seamx-curva-hdpe-admin',{body:{fecha,guardia,toneladas}});if(r.error||!r.data?.ok)throw Error(r.data?.error||r.error?.message);notify('HDPE guardado','success');hdpeChart()}catch(e){notify(e.message,'error')}}}
}
async function hdpeChart(){
const from=el('ops-curve-desde')?.value,to=el('ops-curve-hasta')?.value;if(!el('ops-curve-hdpe')||!from||!to||from>to)return;
const [a,b]=await Promise.all([db.from('evacuaciones_excel').select('fecha,peso_tn,peso_4388,descripcion,tipo_residuo').gte('fecha',from).lte('fecha',to).limit(10000),db.from('dashboard_programacion_hdpe').select('fecha,guardia,toneladas').gte('fecha',from).lte('fecha',to)]);
if(a.error||b.error)return;const actual={},plan={},g=el('ops-guardia')?.value||'';
for(const r of a.data||[])if(/hdpe|tuber[ií]a.*(pe|polietileno)/i.test(String(r.descripcion||'')+' '+String(r.tipo_residuo||'')))actual[r.fecha]=(actual[r.fecha]||0)+seamxOpsPeso(r);
for(const r of b.data||[])if(!g||g===r.guardia)plan[r.fecha]=(plan[r.fecha]||0)+Number(r.toneladas||0);
const first=Date.parse(from+'T12:00:00'),len=(Date.parse(to+'T12:00:00')-first)/86400000+1;if(len>366)return;
const labels=[],p=[],v=[];let x=0,y=0;for(let i=0;i<len;i++){const d=new Date(first+i*86400000),k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');x+=plan[k]||0;y+=actual[k]||0;labels.push(k.slice(8)+'/'+k.slice(5,7));p.push(x);v.push(y)}
draw('ops-curve-hdpe','line',labels,[{label:'Programado HDPE',data:p,borderColor:'#b98a25'},{label:'Evacuado HDPE',data:v,borderColor:'#1a86a0'}]);
el('nov26-hdpe-note').textContent='Programado: '+x.toFixed(2)+' tn · Evacuado: '+y.toFixed(2)+' tn';
}
function riskPanel(){
const p=el('seamx-safe-panel');if(!p)return;p.querySelector('h3').textContent='Registro de fotografías del IPERC';
p.querySelector('.seamx-safe-note').textContent='Guarda las fotos del IPERC completo. No se realiza análisis automático ni se generan recomendaciones.';
p.querySelector('.seamx-safe-actions').innerHTML='<button class="btn btn-primary" id="nov26-save-iperc">Guardar fotos de actividad e IPERC</button><button class="btn btn-outline" onclick="seamxSafeClear()">Limpiar selección</button>';
el('nov26-save-iperc').onclick=saveRisk;el('seamx-safe-output').textContent='Selecciona fotografías de antes, durante, después y del IPERC.';window.seamxSafePreviewIperc=function(input){const files=Array.from(input.files||[]);if(files.length>12||files.some(f=>!String(f.type).startsWith('image/')||f.size>12*1024*1024))return notify('Máximo 12 fotografías del IPERC; hasta 12 MB cada una');seamxSafe.iperc=files;const info=el('seamx-safe-iperc-info');if(info)info.textContent=files.length+' foto(s) seleccionadas';};
}
async function saveRisk(){
const id=el('evidence-activity-id')?.value,a=APP.data.actividades.find(x=>String(x.id)===String(id));if(!a)return;
if(activityIsFieldUser()&&!activityUserMatch(a))return notify('Actividad no asignada');
const files=Array.from(seamxSafe.iperc||[]);const fields={};const selected=[['before','foto_antes_url'],['during','foto_durante_url'],['after','foto_despues_url']];
const btn=el('nov26-save-iperc');btn.disabled=true;
try{
for(const [kind,key] of selected){const f=selectedActivityEvidenceFile(kind);if(f)fields[key]=await uploadActivityEvidence(f,a,kind)}
if(files.length){const prev=await db.from('actividades').select('fotos_iperc').eq('id',a.id).maybeSingle();if(prev.error)throw prev.error;const previous=Array.isArray(prev.data?.fotos_iperc)?prev.data.fotos_iperc:[];fields.fotos_iperc=[...previous,...await Promise.all(files.map((f,i)=>uploadActivityEvidence(f,a,'iperc-'+i)))]}
if(!Object.keys(fields).length)return notify('Selecciona fotografías para guardar');
const ids=activityGroupMembers(a).map(r=>r.id),r=await db.from('actividades').update(fields).in('id',ids);if(r.error)throw r.error;await loadAllData();closeModal('modal-actividad-evidencias');notify('Fotografías guardadas','success');
}catch(e){notify('No se pudo guardar: '+e.message,'error')}finally{btn.disabled=false}
}
function overrideRisk(){
window.openActivityRisk=function(id){if(role()==='antamina')return;openActivityEvidence(id);const p=el('seamx-safe-panel'),grid=document.querySelector('#modal-actividad-evidencias .evidence-grid'),btn=el('btn-save-evidence'),desc=el('evidence-description');if(p)p.style.display='';if(grid)grid.style.display='';if(btn)btn.style.display='none';if(desc?.closest('.form-group'))desc.closest('.form-group').style.display='none';};
window.seamxSafeAnalyze=saveRisk;
}
function viewPhotos(id){
const box=el('seamx-risk-brief');if(!box)return;
box.textContent='Consultando fotografías…';const a=APP.data.actividades.find(x=>String(x.id)===String(id));if(!a)return;
db.from('actividades').select('descripcion_cierre,foto_antes_url,foto_durante_url,foto_despues_url,fotos_iperc').in('id',activityGroupMembers(a).map(x=>x.id)).then(r=>{
if(r.error){box.textContent='No se pudo consultar IPERC';return}
const all=r.data||[],item=all.find(x=>x.fotos_iperc?.length)||all[0]||{};
box.replaceChildren();const h=document.createElement('h4');h.textContent='Evidencias de actividad e IPERC';box.append(h);const p=document.createElement('p');p.textContent=item.descripcion_cierre||'Sin descripción de cierre';box.append(p);
const gallery=document.createElement('div');gallery.id='seamx-iperc-gallery';box.append(gallery);
const photos=[['Antes',item.foto_antes_url],['Durante',item.foto_durante_url],['Después',item.foto_despues_url],...(item.fotos_iperc||[]).map((u,i)=>['IPERC '+(i+1),u])];
for(const [n,u] of photos){if(!/^https:\/\//.test(u||''))continue;const fig=document.createElement('figure'),img=document.createElement('img'),cap=document.createElement('figcaption');img.src=u;img.alt=n;img.loading='lazy';cap.textContent=n;fig.append(img,cap);gallery.append(fig)}
if(!gallery.children.length)gallery.textContent='Sin fotografías registradas';
});
}
function overrideEvidence(){
const old=window.viewActivityEvidence;if(typeof old!=='function')return;
window.viewActivityEvidence=function(id){const r=old(id);if(role()!=='operador'){let p=el('seamx-risk-brief');if(!p){p=document.createElement('section');p.id='seamx-risk-brief';p.style.cssText='padding:12px;border:1px solid #c4d8c9;margin:10px 0';el('activity-detail-review')?.before(p)}if(p){p.innerHTML='<button type="button" id="nov26-view-risk" class="btn btn-outline">Ver fotos e IPERC</button>';el('nov26-view-risk').onclick=()=>viewPhotos(id)}}return r};
}
function occupancy(){
const old=window.inferOccProfileFromIngreso;if(typeof old!=='function')return;
window.inferOccProfileFromIngreso=function(m){const t=String([m?.descripcion,m?.tipoResiduo,m?.subclase,m?.clase].join(' ')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
if(/alambre|fierro|caja|estructura|rejilla|varilla|baranda|perfil|calamina|perno|corrugado|chatarra|plancha metalica/.test(t)&&!/hdpe|polietileno|jebe|cobre|bronce/.test(t)){const area=getOccAreaById('chatarra_liviana');return{area,factor:/pesad/.test(t)?.75:.20,reason:'Chatarra liviana'}}
return old(m)};
}
async function install(){
styling();applyRole();riskPanel();overrideRisk();overrideEvidence();occupancy();await loadPermits();controlDates();hdpePanel();permissionEditor();applyPermits();
const old=window.seamxRenderOpsDashboard;
if(typeof old==='function'){window.seamxRenderOpsDashboard=async function(){const r=await old();controlDates();hdpePanel();permissionEditor();updateCompliance();await filterCharts();await hdpeChart();applyPermits();return r}}
const range=window.seamxRenderCurvaRango;if(typeof range==='function')window.seamxRenderCurvaRango=async function(){const r=await range();updateCompliance();await hdpeChart();return r};
const nav=window.navigateTo;if(typeof nav==='function')window.navigateTo=function(...args){const v=nav(...args);applyRole();applyPermits();return v};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();