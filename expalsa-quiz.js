import {setupProgress,renderMyProgress} from './expalsa-avances.js';
import {isAdministratorAccount,publicResultOf,samePublicResult} from './expalsa-resultados.js';
import {setupTimedAttempt,attemptDeadline,timestampMillis,validTimeLimit} from './expalsa-intento.js';

import {stagePdf,generalPdf,downloadPdf} from './expalsa-reportes.js';
import {CRITERIA,hasFullMatrix,weightedMatrix,competenceLevel} from './expalsa-competencias.js';

export function setupExpalsaQuiz({db,auth,fs,adminEmail,getAdministrator}) {
 const $=id=>document.getElementById(id);
 const {doc,collection,getDoc,getDocs,setDoc,updateDoc,writeBatch,serverTimestamp,Timestamp,runTransaction,signOut}=fs;
 const DURATION=14*24*60*60*1000;
 const STAGES=[1,2,3];
 const pathBank=i=>doc(db,'expalsa_calidad_cuestionarios',String(i));
 const pathKey=i=>doc(db,'expalsa_calidad_claves',String(i));
 const pathProgram=uid=>doc(db,'expalsa_calidad_programas',uid);
 const pathAttempt=(uid,i)=>doc(db,'expalsa_calidad_etapas',uid,'entregas',String(i));
 const pathResult=(uid,i)=>doc(db,'expalsa_calidad_resultados',uid,'etapas',String(i));
 const at=()=>auth.currentUser;
 const isAdmin=()=>isAdministratorAccount(at(),getAdministrator?.());
 const safe=s=>String(s??'').trim();
 const fmt=t=>{const d=t?.toDate?.()||(t instanceof Date?t:null);return d?new Intl.DateTimeFormat('es-EC',{dateStyle:'short',timeStyle:'short',timeZone:'America/Guayaquil'}).format(d):'—';};
 const create=(tag,s='',c='')=>{const n=document.createElement(tag);if(s!==undefined)n.textContent=s;if(c)n.className=c;return n;};
 const clear=e=>e.replaceChildren();
 const button=(title,cb,kind='')=>{const b=create('button',title,kind);b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await cb();}catch(err){alert('EXPALSA: '+(err.message||err));}finally{b.disabled=false;}});return b;};
 const status=s=>{$('expalsaQuizStatus').textContent=s;};
 const aStatus=s=>{$('expalsaQuizAdminStatus').textContent=s;};
 const info=(title,detail)=>{const e=create('article',undefined,'quiz-question');e.append(create('h3',title),create('p',detail));return e;};
 const dateISO=d=>d instanceof Date?new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Guayaquil'}).format(d):'—';
 const dayStart=ymd=>new Date(`${ymd}T00:00:00-05:00`);
 const readyAt=(p,i)=>p?.startAt?.toDate?new Date(p.startAt.toDate().getTime()+i*DURATION):null;
 const stageStatus=(a)=>a?.status==='graded'?'Calificada':a?.status==='submitted'?'En revisión':a?.status==='in_progress'?'En curso':'Pendiente';
 let activeUser=null,attemptCache=[],bankCache={},keyCache={},accessCache=[],programCache={};

 $('expalsaQuizLogout').addEventListener('click',async()=>{timed.dispose();await signOut(auth);location.reload();});

 function titleFor(i){return `ETAPA ${i} · SEMANA ${i*2}`;}
 function cardForStage(i,a,unlocked,openDate){
  const row=create('section',undefined,'quiz-question quiz-stage');
  row.append(create('small',titleFor(i)));
  row.append(create('h3',a?stageStatus(a):unlocked?'Disponible':'Bloqueada'));
  const explanation=a?.status==='graded' ? `Conocimientos: ${a.score}/100 · Práctica: ${a.skillScore}/100 · Índice: ${a.integratedScore}/100`
     :a?.status==='submitted'?`Entregada: ${fmt(a.submittedAt)}`:a?.status==='in_progress'?'Intento iniciado'
     :unlocked?'Prueba disponible'
     :`Apertura: ${openDate?fmt(openDate):'pendiente'}`;
  row.append(create('p',explanation));return row;
 }
 const timed=setupTimedAttempt({db,auth,fs,onStatus:status,onFinished:()=>{$('expalsaQuizBody').replaceChildren();$('expalsaMyProgress').replaceChildren();}});
 const pathSession=(uid,i)=>doc(db,'expalsa_calidad_sesiones',uid,'etapas',String(i));
 async function showInspector(user){
  timed.dispose();activeUser=user;
  $('expalsaInspectorPortal').hidden=false;
  $('expalsaQuizUser').textContent=(user.email||'').toLowerCase();
  const body=$('expalsaQuizBody');clear(body);status('Consultando tu programa…');
  try{
   if(at()?.uid!==user.uid||isAdmin())throw Error('Acceso de inspector no válido.');
   const [pSnap,results,sessions]=await Promise.all([getDoc(pathProgram(user.uid)),Promise.all(STAGES.map(i=>getDoc(pathResult(user.uid,i)))),Promise.all(STAGES.map(i=>getDoc(pathSession(user.uid,i))))]);
   if(at()?.uid!==user.uid)return;
   const program=pSnap.exists()?pSnap.data():null;
   const attempts=Object.fromEntries(STAGES.map((i,j)=>[i,results[j].exists()?results[j].data():null]));
   renderMyProgress($('expalsaMyProgress'),attempts);
   if(!program){status('Programa pendiente de asignación.');return;}
   if(program.resultAccessVersion!==2){status('Programa pendiente de preparación por el administrador.');return;}
   body.append(info('Plan de seis semanas',`Inicio: ${fmt(program.startAt)} · Semanas 2, 4 y 6`));
   for(const i of STAGES){
    const a=attempts[i],session=sessions[i-1].exists()?sessions[i-1].data():null,open=readyAt(program,i);
    const available=program.active===true&&!!open&&Date.now()>=open.getTime()&&(i===1||attempts[i-1]?.status==='graded')&&!a&&!session;
    const card=cardForStage(i,a,available,open);body.append(card);
    if(session?.status==='active'&&a?.status==='in_progress'){
     status('Reanudando el mismo intento…');
     await timed.startOrResume({user,program,stage:i,session,target:body});return;
    }
    if(available){
     const minutes=Number(program.timeLimits?.[String(i)]);
     if(!validTimeLimit(minutes)){card.append(create('p','Tiempo pendiente de asignación.'));continue;}
     card.append(create('p',minutes+' minutos · Un intento'));
     card.append(button('Iniciar evaluación',async()=>{
      if(!confirm(`¿Iniciar la etapa ${i}? Dispones de ${minutes} minutos y un solo intento. El tiempo continúa si sales o recargas.`))return;
      try{await timed.startOrResume({user,program,stage:i,target:body});}catch(e){status('No se pudo abrir el intento: '+(e.message||e));}
     },'button secondary'));
    }
   }
   status(STAGES.every(i=>attempts[i]?.status==='graded')?'Programa finalizado.':STAGES.some(i=>attempts[i]?.status==='submitted')?'Calificación pendiente.':'');
  }catch(e){status('No se pudo consultar el programa: '+(e.message||e));}
 }

 const dialog=$('expalsaQuizAdminDialog');
 $('expalsaQuizAdminOpen').addEventListener('click',async()=>{if(!isAdmin())return;dialog.showModal();try{await refreshAdmin();}catch(e){aStatus(e.message||String(e));}});
 $('expalsaQuizAdminClose').addEventListener('click',()=>dialog.close());
 $('expalsaQuizAdminCloseBottom').addEventListener('click',()=>dialog.close());
 $('expalsaQuizRefresh').addEventListener('click',async()=>{try{await refreshAdmin();}catch(e){aStatus(e.message||String(e));}});

 async function refreshAdmin(){
  if(!isAdmin())throw Error('Acceso administrativo exclusivo.');
  aStatus('Consultando tres cuestionarios, inspectores y resultados…');
  const [bankSnaps,keySnaps,users]=await Promise.all([
   Promise.all(STAGES.map(i=>getDoc(pathBank(i)))),
   Promise.all(STAGES.map(i=>getDoc(pathKey(i)))),
   getDocs(collection(db,'expalsa_calidad_accesos'))
  ]);
  bankCache=Object.fromEntries(STAGES.map((i,j)=>[i,bankSnaps[j].exists()?bankSnaps[j].data():null]));
  keyCache=Object.fromEntries(STAGES.map((i,j)=>[i,keySnaps[j].exists()?keySnaps[j].data():null]));
  accessCache=users.docs.filter(s=>s.id!==getAdministrator?.()?.uid).map(s=>({...s.data(),uid:s.id,role:'inspector'}));
  const records=await Promise.all(accessCache.map(async user=>{
   const [p,docs,sessions]=await Promise.all([getDoc(pathProgram(user.uid)),Promise.all(STAGES.map(i=>getDoc(pathAttempt(user.uid,i)))),Promise.all(STAGES.map(i=>getDoc(pathSession(user.uid,i))))]);
   return {...user,program:p.exists()?p.data():null,attempts:Object.fromEntries(STAGES.map((i,j)=>[i,docs[j].exists()?docs[j].data():null])),sessions:Object.fromEntries(STAGES.map((i,j)=>[i,sessions[j].exists()?sessions[j].data():null]))};
  }));
  await synchronizePublicResults(records);
  attemptCache=records;
  const bankPanel=$('expalsaQuizAdminBank');clear(bankPanel);
  for(const i of STAGES)bankPanel.append(info(titleFor(i),bankCache[i]?`${bankCache[i].questions?.length||0} preguntas publicadas`:'Sin publicar'));

  const enroll=$('expalsaQuizAdminEnroll');clear(enroll);
  if(!records.length)enroll.append(info('Sin inspectores aprobados','Primero autoriza las cuentas en el módulo «Administrar accesos».'));
  for(const r of records){
   const row=create('div',undefined,'quiz-admin-row');
   row.append(create('b',r.email));
   if(r.active===false)row.append(create('span','Acceso suspendido','pill warn'));
   if(r.program)row.append(create('p',`Inicio: ${fmt(r.program.startAt)} · ${r.program.active?'Activo':'Suspendido'}`));
   else if(r.active!==false){
    const label=create('label',undefined,'quiz-date');label.append(create('span','Fecha de inicio del ciclo (Ecuador)'));const date=create('input');date.type='date';date.value=dateISO(new Date());label.append(date);row.append(label);
    row.append(button('Asignar plan de 6 semanas',async()=>{
       if(!date.value||Number.isNaN(dayStart(date.value).getTime()))throw Error('Indica una fecha válida.');
       if(!confirm(`¿Iniciar el programa de ${r.email} el ${date.value}? Esta fecha definirá las aperturas de semanas 2, 4 y 6.`))return;
       await setDoc(pathProgram(r.uid),{uid:r.uid,email:r.email,startAt:Timestamp.fromDate(dayStart(date.value)),active:true,resultAccessVersion:2,timeLimits:{'1':30,'2':30,'3':30},createdAt:serverTimestamp(),createdBy:adminEmail});
       await refreshAdmin();
    }));
   }
   if(r.program){
    const limits=create('div',undefined,'quiz-time-limits'),inputs={};
    for(const i of STAGES){
     const label=create('label'),input=create('input');label.append(create('span',`Etapa ${i} · minutos`));input.type='number';input.min='1';input.max='180';input.step='1';input.value=String(r.program.timeLimits?.[String(i)]??30);input.disabled=!!r.sessions?.[i]||!!r.attempts[i];label.append(input);limits.append(label);inputs[i]=input;
    }
    limits.append(button('Guardar tiempos',async()=>{
     const timeLimits=Object.fromEntries(STAGES.map(i=>[String(i),Number(inputs[i].value)]));
     if(!STAGES.every(i=>validTimeLimit(timeLimits[String(i)])))throw Error('Indica entre 1 y 180 minutos por etapa.');
     await updateDoc(pathProgram(r.uid),{timeLimits});await refreshAdmin();
    }));row.append(limits);
   }
   enroll.append(row);
  }
  const answersPanel=$('expalsaQuizAdminAttempts');clear(answersPanel);
  if(!records.length)answersPanel.append(create('p','No hay inspectores con acceso vigente.'));
  for(const r of records){
   const row=create('section',undefined,'quiz-admin-row');row.append(create('h3',r.email));
   
   if(!r.program){row.append(create('p','Programa por asignar.'));answersPanel.append(row);continue;}
   for(const i of STAGES){
    const a=r.attempts[i];const line=create('div',undefined,'quiz-admin-attempt');line.append(create('b',`Etapa ${i} / Semana ${2*i}: ${stageStatus(a)}`));
    if(a?.status==='graded'){
      line.append(create('p',`Teoría ${a.score}/100 · C1–C10 ${a.skillScore}/100 · ${competenceLevel(a)}`));
      line.append(button('PDF etapa '+i,()=>downloadStage(r,i)));
    }else if(a?.status==='submitted'){
      line.append(button('Ver respuestas',()=>showAnswers(r,i)));
      line.append(button('Calificar teoría + C1–C10',()=>showGrade(r,i)));
    }
    row.append(line);
   }
   if(STAGES.every(i=>r.attempts[i]?.status==='graded' && hasFullMatrix(r.attempts[i]?.skills)))row.append(button('GENERAR PDF GENERAL · 3 ETAPAS',()=>downloadGeneral(r),'quiz-primary'));
   
   answersPanel.append(row);
  }
  const complete=records.filter(r=>STAGES.every(i=>r.attempts[i]?.status==='graded'&&hasFullMatrix(r.attempts[i]?.skills))).length;
  renderExecutive(records);
  progress.render(records);
  aStatus(`${records.length} inspector(es) · ${complete} programas completos`);
 }

 async function synchronizePublicResults(records){
  if(!isAdmin())throw Error('Acceso administrativo exclusivo.');
  for(const r of records){
   for(const i of STAGES){
    if(!r.attempts[i])continue;
    if(r.attempts[i].status==='in_progress'&&r.sessions?.[i]?.status==='active'){
     await updateDoc(pathSession(r.uid,i),{checkedAt:serverTimestamp()});
     const session=await (fs.getDocFromServer||getDoc)(pathSession(r.uid,i));
     if(session.exists())r.sessions[i]=session.data();
    }
    r.attempts[i]=await runTransaction(db,async tx=>{
     const [source,summary]=await Promise.all([tx.get(pathAttempt(r.uid,i)),tx.get(pathResult(r.uid,i))]);
     if(!source.exists())return null;
     let original=source.data();
     if(original.status==='in_progress'&&r.sessions?.[i]?.status==='active'&&timestampMillis(r.sessions[i].checkedAt)>=attemptDeadline(r.sessions[i])){
      const submittedAt=serverTimestamp();original={...original,status:'submitted',submissionKind:'expired',submittedAt};
      tx.update(pathAttempt(r.uid,i),{status:'submitted',submissionKind:'expired',submittedAt});
      tx.update(pathSession(r.uid,i),{status:'closed'});
     }
     const visible=publicResultOf(original);
     if(!summary.exists()||!samePublicResult(summary.data(),visible))tx.set(pathResult(r.uid,i),visible);
     return original;
    });
   }
   if(r.program&&r.program.resultAccessVersion!==2){
    const timeLimits=r.program.timeLimits||{'1':30,'2':30,'3':30};
    await updateDoc(pathProgram(r.uid),{resultAccessVersion:2,timeLimits});
    r.program={...r.program,resultAccessVersion:2,timeLimits};
   }
  }
 }


 function renderExecutive(records){
   const board=$('expalsaExecutiveDashboard');if(!board)return;
   const pending=records.flatMap(r=>STAGES.filter(i=>r.attempts[i]?.status==='submitted').map(i=>({r,i})));
   const graded=records.reduce((n,r)=>n+STAGES.filter(i=>r.attempts[i]?.status==='graded').length,0);
   const done=records.filter(r=>STAGES.every(i=>r.attempts[i]?.status==='graded'&&hasFullMatrix(r.attempts[i].skills))).length;
   for(const [id,value] of [['expalsaMetricInspectors',records.filter(r=>r.active!==false).length],['expalsaMetricPending',pending.length],['expalsaMetricGraded',graded],['expalsaMetricComplete',done]]){$(id).textContent=value;}
   const target=$('expalsaPendingEvaluations');clear(target);
   if(!pending.length)target.append(create('p','No hay evaluaciones enviadas pendientes de calificar.','quiz-admin-note'));
   for(const {r,i} of pending){
     const row=create('div',undefined,'expalsa-work-row');row.append(create('div',undefined,'expalsa-work-ident'));
     row.firstChild.append(create('b',r.email),create('small',`Etapa ${i} · semana ${i*2} · enviada ${fmt(r.attempts[i].submittedAt)}`));
     row.append(button('Revisar y calificar C1–C10',()=>{showGrade(r,i);dialog.showModal();},'quiz-primary'));target.append(row);
   }
   const table=$('expalsaInspectorProgress');clear(table);
   if(!records.length)table.append(create('p','Todavía no hay inspectores autorizados. Usa «Administrar accesos».'));
   for(const r of records){
     const row=create('div',undefined,'expalsa-progress-row');const user=create('div',undefined,'expalsa-progress-name');
     user.append(create('b',r.email),create('small',r.program?`Inicio ${fmt(r.program.startAt)}`:'Programa pendiente de asignación'));row.append(user);
     for(const i of STAGES){
        const a=r.attempts[i],cell=create('div',undefined,'expalsa-progress-cell');
        cell.append(create('small',`SEMANA ${2*i}`),create('b',stageStatus(a)));
        if(a?.status==='graded'){cell.append(create('span',`Teoría ${a.score} · C1–C10 ${hasFullMatrix(a.skills)?a.skillScore:'sin integrar'}`));cell.append(button('PDF etapa '+i,()=>downloadStage(r,i)));}
        if(a?.status==='submitted')cell.append(button('Calificar',()=>{showGrade(r,i);dialog.showModal();}));
        row.append(cell);
     }
     const action=create('div',undefined,'expalsa-progress-general');
     if(STAGES.every(i=>r.attempts[i]?.status==='graded')&&STAGES.every(i=>hasFullMatrix(r.attempts[i]?.skills)))action.append(button('PDF general',()=>downloadGeneral(r),'quiz-primary'));
     else action.append(create('small',STAGES.filter(i=>r.attempts[i]?.status==='graded').length+'/3 calificadas'));
     row.append(action);table.append(row);
   }
 }


 function showAnswers(r,i){
  if(!isAdmin())throw Error('Acceso restringido.');
  const a=r.attempts[i],bank=bankCache[i],key=keyCache[i];if(!a||!bank||!key)throw Error('Faltan banco, respuestas o clave de la etapa.');
  const panel=$('expalsaQuizAdminReview');clear(panel);
  panel.append(create('h3',`Respuestas · ${r.email} · Etapa ${i}`));
  for(const [j,q] of bank.questions.entries()){
    const expected=key.keys[q.id],v=a.answers?.[q.id];
    panel.append(create('p',`${j+1}. ${q.text}\nRespondió: ${q.options[v]||'Sin respuesta'}\nCriterio: ${q.options[expected]} · ${v===expected?'CORRECTA':'INCORRECTA'}`,'quiz-admin-row'));
  }
  panel.scrollIntoView({behavior:'smooth',block:'start'});
 }
 function scoreQuiz(a,bank,secret){
  if(a.version===''&&a.submissionKind==='expired'&&Object.keys(a.answers||{}).length===0&&bank&&secret&&bank.version===secret.version)return {correct:0,total:bank.questions.length,score:0};
  if(!bank||!secret||bank.version!==secret.version||a.version!==bank.version)throw Error('La versión del banco no corresponde con las respuestas enviadas.');
  const correct=bank.questions.filter(q=>a.answers?.[q.id]===secret.keys[q.id]).length;
  return {correct,total:bank.questions.length,score:Math.round(correct/bank.questions.length*100)};
 }
 function showGrade(r,i){
  if(!isAdmin())throw Error('No eres administrador de EXPALSA.');
  const a=r.attempts[i],bank=bankCache[i],secret=keyCache[i];if(a?.status!=='submitted')throw Error('La entrega no está pendiente.');
  const calc=scoreQuiz(a,bank,secret),area=$('expalsaQuizAdminReview');clear(area);
  const form=create('form');form.id='expalsaSkillsForm';
  form.append(create('h3',`Calificar etapa ${i}: ${r.email}`),
    create('p',`Conocimientos: ${calc.score}/100 · ${calc.correct}/${calc.total} respuestas correctas`));
  for(const item of CRITERIA){
   const section=create('fieldset',undefined,'quiz-admin-skill');section.append(create('legend',`${item.id} · ${item.label} · ${item.weight}%${item.critical?' · CRÍTICO':''}`),create('p',item.conduct,'quiz-admin-note'));
   const select=create('select');select.name=item.id+'_rating';select.required=true;
   const blank=create('option','Selecciona nivel de competencia observado');blank.value='';select.append(blank);
   for(let rating=0;rating<=4;rating++){const x=create('option',`${rating} / 4`);x.value=String(rating);select.append(x);}
   const evidence=create('textarea');evidence.name=item.id+'_evidence';evidence.required=true;evidence.minLength=20;evidence.maxLength=1000;evidence.rows=2;evidence.placeholder='Evidencia de campo · mínimo 20 caracteres';
   section.append(select,evidence);form.append(section);
  }
  const note=create('textarea');note.name='observation';note.required=true;note.minLength=12;note.rows=3;note.maxLength=1200;note.placeholder='Observación del evaluador';form.append(note);
  const submit=create('button','Guardar calificación');submit.type='submit';form.append(submit);area.append(form);area.scrollIntoView({behavior:'smooth',block:'nearest'});
  form.addEventListener('submit',async e=>{
   e.preventDefault();const values=new FormData(form),skills=[];
   for(const item of CRITERIA){
    const rating=Number(values.get(item.id+'_rating')),evidence=safe(values.get(item.id+'_evidence'));
    if(!Number.isInteger(rating)||rating<0||rating>4||evidence.length<20)return aStatus('Faltan evidencias o calificaciones de '+item.label);
    skills.push({id:item.id,label:item.label,weight:item.weight,critical:!!item.critical,rating,evidence});
   }
   const observation=safe(values.get('observation'));if(observation.length<12)return aStatus('Agrega conclusiones técnicas.');
   const skillScore=weightedMatrix(skills),integratedScore=Math.round(calc.score*.6+skillScore*.4);
   if(!confirm(`¿Cerrar y calificar la etapa ${i} de ${r.email}? Teoría ${calc.score}/100 · matriz C1–C10 ${skillScore}/100.`))return;
   submit.disabled=true;
   try{
    await runTransaction(db,async tx=>{
      const latest=await tx.get(pathAttempt(r.uid,i));
      if(!latest.exists()||latest.data().status!=='submitted')throw Error('La evaluación cambió o ya fue calificada. Actualiza el panel.');
      const grade={
        status:'graded',score:calc.score,correctCount:calc.correct,total:calc.total,
        skillScore,skills,integratedScore,observation,
        gradedAt:serverTimestamp(),gradedBy:adminEmail
      };
      tx.update(pathAttempt(r.uid,i),grade);
      tx.set(pathResult(r.uid,i),publicResultOf({...latest.data(),...grade}));
    });
    await refreshAdmin();area.replaceChildren(create('p','Calificación guardada.','quiz-admin-score'));
   }catch(err){submit.disabled=false;aStatus('No se pudo calificar: '+err.message);}
  });
 }
 function downloadStage(r,i){
  if(!isAdmin()||r.attempts[i]?.status!=='graded')throw Error('El informe por etapa requiere calificación cerrada.');
  const blob=stagePdf({email:r.email,uid:r.uid,program:r.program,stage:i,attempt:r.attempts[i],bank:bankCache[i],keys:keyCache[i]?.keys});
  downloadPdf(blob,`EXPALSA_Informe_Etapa_${i}_${r.uid.slice(0,12)}.pdf`);
 }
 function downloadGeneral(r){
  if(!isAdmin()||!STAGES.every(i=>r.attempts[i]?.status==='graded' && hasFullMatrix(r.attempts[i]?.skills)))throw Error('No están calificadas las tres evaluaciones.');
  const blob=generalPdf({email:r.email,uid:r.uid,program:r.program,
   attempts:STAGES.map(i=>r.attempts[i]),banks:STAGES.map(i=>bankCache[i]),keysByStage:STAGES.map(i=>keyCache[i]?.keys)});
  downloadPdf(blob,`EXPALSA_Informe_General_6_Semanas_${r.uid.slice(0,12)}.pdf`);
 }

 const openReview=(r,i,grade=false)=>{
  if(!isAdmin())throw Error('Acceso restringido.');
  if(!dialog.open)dialog.showModal();
  if(grade)showGrade(r,i);else showAnswers(r,i);
 };
 const progress=setupProgress({isAdmin,refresh:refreshAdmin,onReview:(r,i)=>openReview(r,i),onGrade:(r,i)=>openReview(r,i,true),onStagePdf:downloadStage,onGeneralPdf:downloadGeneral});
 const selectInspectorTab=selected=>{
  for(const [id,panel] of [['inspectorTestsTab','expalsaQuizBody'],['inspectorProgressTab','expalsaMyProgress']]){
   const active=id===selected;$(id).setAttribute('aria-selected',String(active));$(id).tabIndex=active?0:-1;$(panel).hidden=!active;
  }
 };
 const refreshMyProgress=async()=>{
  if(!activeUser||at()?.uid!==activeUser.uid||isAdmin())return;
  const uid=activeUser.uid,tab=$('inspectorProgressTab');tab.disabled=true;
  try{
   const snaps=await Promise.all(STAGES.map(i=>getDoc(pathResult(uid,i))));
   if(at()?.uid!==uid)return;
   renderMyProgress($('expalsaMyProgress'),Object.fromEntries(STAGES.map((i,j)=>[i,snaps[j].exists()?snaps[j].data():null])));
  }catch(e){$('expalsaMyProgress').append(create('p','No se pudieron actualizar los avances. Intenta de nuevo.','quiz-status'));}
  finally{tab.disabled=false;}
 };
 for(const id of ['inspectorTestsTab','inspectorProgressTab']){
  $(id).addEventListener('click',async()=>{selectInspectorTab(id);if(id==='inspectorProgressTab')await refreshMyProgress();});
  $(id).addEventListener('keydown',e=>{
   if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
    e.preventDefault();const target=e.key==='Home'?'inspectorTestsTab':e.key==='End'?'inspectorProgressTab':id==='inspectorTestsTab'?'inspectorProgressTab':'inspectorTestsTab';selectInspectorTab(target);$(target).focus();
   }
  });
 }

 const reset=()=>{
  timed.dispose();activeUser=null;attemptCache=[];bankCache={};keyCache={};accessCache=[];
  for(const id of ['expalsaQuizBody','expalsaMyProgress','expalsaQuizAdminReview','expalsaQuizAdminAttempts','expalsaQuizAdminBank','expalsaQuizAdminEnroll','expalsaProgressTable','expalsaProgressDetail','expalsaInspectorProgress','expalsaPendingEvaluations'])$(id).replaceChildren();
  if(dialog.open)dialog.close();
 };
 return {showInspector,refreshAdmin,reset};
}
