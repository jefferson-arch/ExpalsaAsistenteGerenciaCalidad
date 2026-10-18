import {hasFullMatrix,competenceLevel} from './expalsa-competencias.js';

const STAGES=[1,2,3];
const delivered=a=>a?.status==='submitted'||a?.status==='graded';
const graded=a=>a?.status==='graded';
export function progressOf(record){
 const attempts=record.attempts||{};
 const sent=STAGES.filter(i=>delivered(attempts[i])).length;
 const closed=STAGES.filter(i=>graded(attempts[i])).length;
 const pending=STAGES.filter(i=>attempts[i]?.status==='submitted').length;
 const running=STAGES.filter(i=>attempts[i]?.status==='in_progress').length;
 const complete=STAGES.every(i=>graded(attempts[i])&&hasFullMatrix(attempts[i].skills));
 return {sent,closed,pending,running,complete,percent:Math.round(sent/3*100)};
}
export function summarizeProgress(records){
 return records.reduce((total,r)=>{
  const p=progressOf(r);
  total.started+=Number(p.sent>0||p.running>0);total.sent+=p.sent;total.closed+=p.closed;total.pending+=p.pending;total.complete+=Number(p.complete);
  return total;
 },{started:0,sent:0,closed:0,pending:0,complete:0});
}
export function filterProgress(records,query='',filter='all'){
 const q=query.trim().toLocaleLowerCase('es');
 return records.filter(r=>{
  if(!String(r.email||'').toLocaleLowerCase('es').includes(q))return false;
  const p=progressOf(r);
  return filter==='started'?p.sent>0||p.running>0:filter==='pending'?p.pending>0:filter==='complete'?p.complete:filter==='no-tests'?p.sent===0&&p.running===0:filter==='suspended'?r.active===false:true;
 }).sort((a,b)=>(a.email||'').localeCompare(b.email||'','es'));
}
export function evolutionOf(record){
 const complete=STAGES.map(i=>({i,a:record.attempts?.[i]})).filter(x=>graded(x.a));
 if(complete.length<2)return null;
 const first=complete[0],last=complete[complete.length-1];
 const delta=(key)=>Number.isFinite(first.a[key])&&Number.isFinite(last.a[key])?last.a[key]-first.a[key]:null;
 return {from:first.i,to:last.i,theory:delta('score'),practice:hasFullMatrix(first.a.skills)&&hasFullMatrix(last.a.skills)?delta('skillScore'):null};
}
const stamp=v=>v?.toDate?.()||(v instanceof Date?v:null);
const date=v=>{const d=stamp(v);return d&&!Number.isNaN(d.getTime())?new Intl.DateTimeFormat('es-EC',{dateStyle:'short',timeStyle:'short',timeZone:'America/Guayaquil'}).format(d):'—';};
const stageName=i=>'Etapa '+i+' · Semana '+i*2;
const stageState=a=>graded(a)?'Calificada':a?.status==='submitted'?'Por calificar':a?.status==='in_progress'?'En curso':'Sin entrega';
const create=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const badge=a=>create('span',stageState(a),'pill '+(graded(a)?'good':a?.status==='submitted'?'warn':''));
const score=n=>Number.isFinite(n)?n+'/100':'—';
const action=(title,cb,kind='quiet')=>{
 const b=create('button',title,'button small '+kind);b.type='button';
 b.addEventListener('click',async()=>{b.disabled=true;try{await cb();}catch(e){alert('EXPALSA: '+(e.message||e));}finally{b.disabled=false;}});
 return b;
};
const pair=(dl,label,value)=>{dl.append(create('dt',label),create('dd',value));};
const bar=(count,label)=>{
 const b=create('div',undefined,'progress');b.setAttribute('role','progressbar');b.setAttribute('aria-label',label);b.setAttribute('aria-valuemin','0');b.setAttribute('aria-valuemax','3');b.setAttribute('aria-valuenow',String(count));const fill=create('span');fill.style.width=(count/3*100)+'%';b.append(fill);return b;
};

export function setupProgress({isAdmin,refresh,onReview,onGrade,onStagePdf,onGeneralPdf}){
 const $=id=>document.getElementById(id);
 let records=[],selected=null,updated=null;
 const status=s=>{$('expalsaProgressStatus').textContent=s;};
 $('expalsaProgressSearch').addEventListener('input',renderTable);
 $('expalsaProgressFilter').addEventListener('change',renderTable);
 $('expalsaProgressRefresh').addEventListener('click',async()=>{
  if(!isAdmin())return;
  const b=$('expalsaProgressRefresh');b.disabled=true;status('Actualizando…');
  try{await refresh();}catch(e){status('No se pudieron cargar los avances: '+(e.message||e));}finally{b.disabled=false;}
 });
 function renderTable(){
  if(!isAdmin())return;
  const list=filterProgress(records,$('expalsaProgressSearch').value,$('expalsaProgressFilter').value);
  const area=$('expalsaProgressTable');area.replaceChildren();
  status(list.length+' inspector(es)'+(updated?' · Actualizado '+date(updated):''));
  if(!list.length){area.append(create('p','Sin inspectores en esta vista.','progress-empty'));return;}
  const table=create('table');table.append(create('caption','Avances de las tres etapas por inspector','srOnly'));
  const head=create('thead'),titles=create('tr');
  for(const label of ['Inspector','Entregadas','Calificadas','Semana 2','Semana 4','Semana 6','Detalle']){const th=create('th',label);th.scope='col';titles.append(th);}head.append(titles);table.append(head);
  const body=create('tbody');
  for(const r of list){
   const row=create('tr'),p=progressOf(r);row.dataset.uid=r.uid;
   const name=create('td',undefined,'progress-name');name.append(create('strong',r.email));
   name.append(create('small',r.program?'Inicio '+date(r.program.startAt):'Sin programa','recordMeta'));
   if(r.active===false)name.append(create('span','Acceso suspendido','pill warn'));
   row.append(name);
   const sent=create('td');sent.append(create('span',p.sent+'/3','progress-fraction'),bar(p.sent,'Pruebas entregadas de '+r.email));row.append(sent);
   const closed=create('td');closed.append(create('span',p.closed+'/3','progress-fraction'));row.append(closed);
   for(const i of STAGES){
    const a=r.attempts?.[i],cell=create('td',undefined,'progress-stage');cell.append(badge(a));
    if(delivered(a))cell.append(create('small',date(a.submittedAt)));
    if(graded(a)){cell.append(create('small','Teoría '+score(a.score)),create('small','Práctica '+(hasFullMatrix(a.skills)?score(a.skillScore):'Matriz incompleta')));}
    row.append(cell);
   }
   const detail=create('td');detail.append(action('Ver detalle',()=>{selected=r.uid;renderDetail(true);}));row.append(detail);body.append(row);
  }
  table.append(body);area.append(table);
 }
 function renderDetail(focus=false){
  if(!isAdmin())return;
  const area=$('expalsaProgressDetail'),r=records.find(x=>x.uid===selected);area.replaceChildren();area.hidden=!r;
  if(!r)return;
  const head=create('div',undefined,'progress-detail-head');
  const title=create('div');title.append(create('span','AVANCE INDIVIDUAL','exec-eyebrow'),create('h2',r.email));
  head.append(title,action('Cerrar detalle',()=>{selected=null;renderDetail();$('expalsaProgressSearch').focus();}));area.append(head);
  const p=progressOf(r);area.append(create('p',p.sent+'/3 entregadas · '+p.closed+'/3 calificadas · '+p.pending+' por calificar','quiz-status'));
  const grid=create('div',undefined,'progress-detail-grid');
  for(const i of STAGES){
   const a=r.attempts?.[i],card=create('section',undefined,'progress-detail-stage');card.append(create('h3',stageName(i)),badge(a));
   const dl=create('dl');
   if(delivered(a))pair(dl,'Entrega',date(a.submittedAt));
   else if(r.program?.startAt?.toDate)pair(dl,'Apertura programada',date(new Date(r.program.startAt.toDate().getTime()+i*14*86400000)));
   if(graded(a)){
    pair(dl,'Calificación',date(a.gradedAt));pair(dl,'Conocimientos',score(a.score));
    pair(dl,'Matriz C1–C10',hasFullMatrix(a.skills)?score(a.skillScore):'Matriz incompleta');
    pair(dl,'Índice integrado',score(a.integratedScore));pair(dl,'Resultado',competenceLevel(a));
    if(a.observation)pair(dl,'Observación del evaluador',a.observation);
   }
   card.append(dl);const buttons=create('div',undefined,'progress-actions');
   if(a?.status==='submitted')buttons.append(action('Ver respuestas',()=>onReview(r,i)),action('Calificar',()=>onGrade(r,i),'secondary'));
   if(graded(a))buttons.append(action('PDF etapa '+i,()=>onStagePdf(r,i),'secondary'));
   card.append(buttons);grid.append(card);
  }
  area.append(grid);
  const change=evolutionOf(r);
  if(change){
   const panel=create('div',undefined,'progress-evolution');panel.append(create('span','Cambio: etapa '+change.from+' a etapa '+change.to));
   for(const [label,value] of [['Conocimientos',change.theory],['Práctica',change.practice]])if(value!==null){const x=create('div');x.append(create('strong',(value>0?'+':'')+value+' p.p.'),create('small',label));panel.append(x);}area.append(panel);
  }
  if(p.complete){const foot=create('div',undefined,'progress-actions');foot.append(action('PDF general · 6 semanas',()=>onGeneralPdf(r),'secondary'));area.append(foot);}
  if(focus){area.focus({preventScroll:true});area.scrollIntoView({behavior:'smooth',block:'start'});}
 }
 function render(next){
  if(!isAdmin())return;
  records=next;updated=new Date();const total=summarizeProgress(records),metrics=$('expalsaProgressMetrics');metrics.replaceChildren();
  for(const [value,label] of [[total.started,'Inspectores con pruebas'],[total.sent,'Pruebas entregadas'],[total.pending,'Pendientes de calificar'],[total.complete,'Programas completos']]){const e=create('div',undefined,'exec-stat');e.append(create('strong',String(value)),create('span',label));metrics.append(e);}
  renderTable();renderDetail();
 }
 return {render};
}

export function renderMyProgress(target,attempts){
 target.replaceChildren();const p=progressOf({attempts});
 const summary=create('div',undefined,'my-progress-summary');
 for(const [value,label] of [[p.sent+'/3','Pruebas entregadas'],[p.closed+'/3','Etapas calificadas'],[String(p.pending),'Por calificar']]){const e=create('div');e.append(create('strong',value),create('span',label));summary.append(e);}target.append(summary,bar(p.sent,'Mis pruebas entregadas'));
 const grid=create('div',undefined,'progress-detail-grid');
 for(const i of STAGES){
  const a=attempts[i],card=create('section',undefined,'progress-detail-stage');card.append(create('h3',stageName(i)),badge(a));
  const dl=create('dl');if(delivered(a))pair(dl,'Enviada',date(a.submittedAt));
  if(graded(a)){pair(dl,'Conocimientos',score(a.score));pair(dl,'Práctica C1–C10',score(a.skillScore));pair(dl,'Índice integrado',score(a.integratedScore));}
  card.append(dl);grid.append(card);
 }target.append(grid);
}
