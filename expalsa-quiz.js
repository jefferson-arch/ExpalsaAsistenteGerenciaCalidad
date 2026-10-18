/* EXPALSA · Plan 6 semanas / 3 etapas.
  Identidad fijada por Firebase Authentication: ninguna entrada de nombre del inspector.
  Las claves solo se leen bajo sesión administradora. */
import {stagePdf,generalPdf,downloadPdf,stageLevel,skillsResult} from './expalsa-reportes.js';

export function setupExpalsaQuiz({db,auth,fs,adminEmail}) {
 const $=id=>document.getElementById(id);
 const {doc,collection,getDoc,getDocs,setDoc,updateDoc,writeBatch,serverTimestamp,Timestamp,runTransaction,signOut}=fs;
 const DURATION=14*24*60*60*1000;
 const STAGES=[1,2,3];
 const pathBank=i=>doc(db,'expalsa_calidad_cuestionarios',String(i));
 const pathKey=i=>doc(db,'expalsa_calidad_claves',String(i));
 const pathProgram=uid=>doc(db,'expalsa_calidad_programas',uid);
 const pathAttempt=(uid,i)=>doc(db,'expalsa_calidad_etapas',uid,'entregas',String(i));
 const at=()=>auth.currentUser;
 const isAdmin=()=>!!at()&&(at().email||'').toLowerCase()===adminEmail;
 const safe=s=>String(s??'').trim();
 const fmt=t=>t?.toDate?t.toDate().toLocaleString('es-EC'):t instanceof Date?t.toLocaleString('es-EC'):'—';
 const create=(tag,s='',c='')=>{const n=document.createElement(tag);if(s!==undefined)n.textContent=s;if(c)n.className=c;return n;};
 const clear=e=>e.replaceChildren();
 const button=(title,cb,kind='')=>{const b=create('button',title,kind);b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await cb();}catch(err){alert('EXPALSA: '+(err.message||err));}finally{b.disabled=false;}});return b;};
 const status=s=>{$('expalsaQuizStatus').textContent=s;};
 const aStatus=s=>{$('expalsaQuizAdminStatus').textContent=s;};
 const info=(title,detail)=>{const e=create('article',undefined,'quiz-question');e.append(create('h3',title),create('p',detail));return e;};
 const dateISO=d=>d instanceof Date?new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Guayaquil'}).format(d):'—';
 const dayStart=ymd=>new Date(`${ymd}T00:00:00-05:00`);
 const readyAt=(p,i)=>p?.startAt?.toDate?new Date(p.startAt.toDate().getTime()+i*DURATION):null;
 const stageStatus=(a)=>a?.status==='graded'?'Calificada':a?.status==='submitted'?'En revisión':'Pendiente';
 let activeUser=null,attemptCache=[],bankCache={},keyCache={},accessCache=[],programCache={};

 $('expalsaQuizLogout').addEventListener('click',async()=>{await signOut(auth);location.reload();});

 function titleFor(i){return `ETAPA ${i} · SEMANA ${i*2}`;}
 function cardForStage(i,a,unlocked,openDate){
  const row=create('section',undefined,'quiz-question quiz-stage');
  row.append(create('small',titleFor(i)));
  row.append(create('h3',a?stageStatus(a):unlocked?'Disponible':'Bloqueada'));
  const explanation=a?.status==='graded' ? `Conocimientos: ${a.score}/100 · Habilidades: ${a.skillScore}/100 · ${stageLevel(a)}`
     :a?.status==='submitted'?'Tu evaluación fue recibida. Solo el evaluador puede calificarla y habilitar la siguiente etapa.'
     :unlocked?'Puedes responder el cuestionario correspondiente a esta etapa.'
     :`Apertura programada: ${openDate?fmt(openDate):'pendiente'} · Además, la etapa anterior debe estar calificada.`;
  row.append(create('p',explanation));return row;
 }
 async function showInspector(user){
  activeUser=user;
  $('expalsaInspectorPortal').hidden=false;
  $('expalsaQuizUser').textContent=(user.email||'').toLowerCase();
  const identity=$('expalsaQuizIdentity');if(identity)identity.textContent=(user.email||'').toLowerCase()+'  ·  UID '+user.uid;
  const body=$('expalsaQuizBody');clear(body);
  status('Consultando tu programa de evaluación…');
  try{
   const [pSnap,...attemptSnaps]=await Promise.all([getDoc(pathProgram(user.uid)),...STAGES.map(i=>getDoc(pathAttempt(user.uid,i)))]);
   const program=pSnap.exists()?pSnap.data():null;
   const attempts=Object.fromEntries(STAGES.map((i,index)=>[i,attemptSnaps[index].exists()?attemptSnaps[index].data():null]));
   const summary=create('div',undefined,'quiz-question');
   summary.append(create('h3','Identificación automática y protegida'),create('p','Inspector evaluado: '+(user.email||'Cuenta sin correo')),
    create('p','La identidad de esta evaluación proviene de Firebase Authentication y no puede ser modificada en el formulario.'));
   body.append(summary);
   if(!program){body.append(info('Plan todavía no asignado','El administrador debe aprobar tu usuario, registrar la fecha de inicio y publicar las tres evaluaciones.'));status('Programa pendiente de asignación.');return;}
   const start=program.startAt?.toDate?.();
   body.append(info('Plan de seis semanas',`Inicio: ${start?fmt(start):'no establecido'}. Evaluaciones al finalizar las semanas 2, 4 y 6. Cada etapa siguiente exige la calificación de la anterior.`));
   let canStart=0;
   for(const i of STAGES){
     const open=readyAt(program,i);
     const due=!!open&&Date.now()>=open.getTime();
     const previous=i===1||attempts[i-1]?.status==='graded';
     const available=program.active===true && due && previous && !attempts[i];
     body.append(cardForStage(i,attempts[i],available,open));
     if(available) canStart=i;
   }
   if(!program.active){status('El programa está suspendido por el administrador.');return;}
   if(!canStart){
      const ungraded=STAGES.find(i=>attempts[i]?.status==='submitted');
      status(ungraded?'Evaluación enviada y pendiente de calificación.':STAGES.every(i=>attempts[i]?.status==='graded')?'Programa de tres etapas finalizado.':'Próxima etapa todavía bloqueada.');
      return;
   }
   const stage=canStart;
   const bankSnap=await getDoc(pathBank(stage));
   if(!bankSnap.exists()){status('El cuestionario de la etapa '+stage+' todavía no fue publicado.');return;}
   const bank=bankSnap.data();
   if(!Array.isArray(bank.questions)||!bank.questions.length)throw Error('El banco no contiene preguntas válidas.');
   const form=create('form');form.id='expalsaQuizForm';
   form.append(info(`Prueba objetiva · Etapa ${stage}`,`Semana ${stage*2}. ${bank.questions.length} preguntas de opción múltiple. Tu cuenta autenticada se asignará automáticamente; no existe campo para modificar el nombre.`));
   for(const [index,q] of bank.questions.entries()){
      const box=create('fieldset',undefined,'quiz-question');box.append(create('small',`${q.topic} · ${index+1} / ${bank.questions.length}`),create('h3',q.text));
      for(let j=0;j<q.options.length;j++){
       const label=create('label',undefined,'quiz-choice');const radio=create('input');radio.type='radio';radio.name=q.id;radio.value=String(j);radio.required=true;
       label.append(radio,create('span',`${String.fromCharCode(65+j)}. ${q.options[j]}`));box.append(label);
      }
      form.append(box);
   }
   const foot=create('div',undefined,'quiz-controls');foot.append(create('span','Envío único y definitivo por etapa. Verifica todas las respuestas antes de continuar.'));
   const send=create('button','Enviar evaluación de la etapa '+stage);send.type='submit';foot.append(send);form.append(foot);body.append(form);
   form.addEventListener('submit',async e=>{
    e.preventDefault();const formValues=new FormData(form),answers={};
    for(const q of bank.questions){const v=formValues.get(q.id);if(v===null){status('Todas las preguntas son obligatorias.');return;}answers[q.id]=Number(v);}
    if(!confirm('¿Confirmas el envío definitivo de la etapa '+stage+' para tu usuario '+user.email+'?'))return;
    send.disabled=true;status('Registrando entrega…');
    try{
     if(at()?.uid!==user.uid)throw Error('La sesión cambió. Vuelve a iniciar sesión.');
     // La regla de Firestore obliga a uid==auth.uid, correo==auth.token.email,
     // fecha >= 14/28/42 días, etapa previa calificada y create-only.
     await setDoc(pathAttempt(user.uid,stage),{
       uid:user.uid,email:(at().email||'').trim().toLowerCase(),stage,
       version:bank.version,answers,status:'submitted',submittedAt:serverTimestamp()
     });
     status('Respuestas enviadas correctamente.');await showInspector(user);
    }catch(err){send.disabled=false;status('No se pudo registrar la evaluación: '+(err.message||err));}
   });
   status('Etapa '+stage+' disponible · Identidad '+user.email);
  }catch(err){console.error(err);status('Error de acceso a la evaluación: '+(err.message||err));body.append(info('No se pudo consultar el programa','Revisa la conexión y las reglas de Firestore.'))}
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
  accessCache=users.docs.filter(s=>s.data().active===true && s.data().role==='inspector').map(s=>({uid:s.id,...s.data()}));
  const records=await Promise.all(accessCache.map(async user=>{
   const [p,...docs]=await Promise.all([getDoc(pathProgram(user.uid)),...STAGES.map(i=>getDoc(pathAttempt(user.uid,i)))]);
   return {...user,program:p.exists()?p.data():null,attempts:Object.fromEntries(STAGES.map((i,j)=>[i,docs[j].exists()?docs[j].data():null]))};
  }));
  attemptCache=records;
  const bankPanel=$('expalsaQuizAdminBank');clear(bankPanel);
  for(const i of STAGES)bankPanel.append(info(titleFor(i),bankCache[i]?`${bankCache[i].questions?.length||0} preguntas publicadas · claves privadas almacenadas en Firestore`:'Banco privado aún no publicado.'));
  $('expalsaQuizSeed').disabled=STAGES.some(i=>bankCache[i]);
  const enroll=$('expalsaQuizAdminEnroll');clear(enroll);
  if(!records.length)enroll.append(info('Sin inspectores aprobados','Primero autoriza las cuentas en el módulo «Administrar accesos».'));
  for(const r of records){
   const row=create('div',undefined,'quiz-admin-row');
   row.append(create('b',r.email),create('small','UID: '+r.uid));
   if(r.program)row.append(create('p',`Inicio: ${fmt(r.program.startAt)} · ${r.program.active?'Activo':'Suspendido'}`));
   else{
    const label=create('label',undefined,'quiz-date');label.append(create('span','Fecha de inicio del ciclo (Ecuador)'));const date=create('input');date.type='date';date.value=dateISO(new Date());label.append(date);row.append(label);
    row.append(button('Asignar plan de 6 semanas',async()=>{
       if(!date.value||Number.isNaN(dayStart(date.value).getTime()))throw Error('Indica una fecha válida.');
       if(!confirm(`¿Iniciar el programa de ${r.email} el ${date.value}? Esta fecha definirá las aperturas de semanas 2, 4 y 6.`))return;
       await setDoc(pathProgram(r.uid),{uid:r.uid,email:r.email,startAt:Timestamp.fromDate(dayStart(date.value)),active:true,createdAt:serverTimestamp(),createdBy:adminEmail});
       await refreshAdmin();
    }));
   }
   enroll.append(row);
  }
  const answersPanel=$('expalsaQuizAdminAttempts');clear(answersPanel);
  if(!records.length)answersPanel.append(create('p','No hay inspectores con acceso vigente.'));
  for(const r of records){
   const row=create('section',undefined,'quiz-admin-row');row.append(create('h3',r.email));
   row.append(create('small','Identificación vinculada a UID: '+r.uid));
   if(!r.program){row.append(create('p','Programa por asignar.'));answersPanel.append(row);continue;}
   for(const i of STAGES){
    const a=r.attempts[i];const line=create('div',undefined,'quiz-admin-attempt');line.append(create('b',`Etapa ${i} / Semana ${2*i}: ${stageStatus(a)}`));
    if(a?.status==='graded'){
      line.append(create('p',`Conocimiento ${a.score}/100 · práctica ${a.skillScore}/100 · ${stageLevel(a)}`));
      line.append(button('PDF etapa '+i,()=>downloadStage(r,i)));
    }else if(a?.status==='submitted'){
      line.append(button('Ver respuestas',()=>showAnswers(r,i)));
      line.append(button('Calificar + evaluar habilidades',()=>showGrade(r,i)));
    }
    row.append(line);
   }
   if(STAGES.every(i=>r.attempts[i]?.status==='graded'))row.append(button('GENERAR PDF GENERAL · 3 ETAPAS',()=>downloadGeneral(r),'quiz-primary'));
   else row.append(create('p','Informe general bloqueado hasta calificar las tres etapas.','quiz-admin-note'));
   answersPanel.append(row);
  }
  const complete=records.filter(r=>STAGES.every(i=>r.attempts[i]?.status==='graded')).length;
  aStatus(`${records.length} inspector(es) · ${complete} con 3 etapas calificadas. Los PDF por etapa solo aparecen después de calificar esa etapa.`);
 }

 $('expalsaQuizSeed').addEventListener('click',async()=>{
  if(!isAdmin())return;
  const f=$('expalsaQuizBankFile').files?.[0];if(!f)return aStatus('Selecciona el archivo PRIVADO BANCO_PRIVADO_TRES_ETAPAS.json.');
  if(f.size>300000)return aStatus('Banco demasiado grande.');
  try{
   const data=JSON.parse(await f.text());
   if(data.schema!=='expalsa-six-week-bank-v1'||!Array.isArray(data.stages)||data.stages.length!==3)throw Error('Formato de banco de tres etapas inválido.');
   for(const s of data.stages){
    if(!STAGES.includes(s.stage)||!Array.isArray(s.questions)||s.questions.length<8||!s.keys||!Array.isArray(s.skills)||s.skills.length!==4)throw Error('Configuración incompleta de etapa '+s.stage);
    const ids=new Set();for(const q of s.questions){if(ids.has(q.id)||!q.id||!q.text||!q.topic||q.options?.length!==4 || !q.options.every(x=>safe(x).length>0)|| ![0,1,2,3].includes(s.keys[q.id]))throw Error('Pregunta inválida: '+q.id);ids.add(q.id);}
   }
   for(const i of STAGES){if((await getDoc(pathBank(i))).exists())throw Error('La etapa '+i+' ya está publicada. No se reemplazará el banco para preservar entregas existentes.');}
   if(!confirm('¿Publicar los tres bancos con preguntas y claves privadas? Hazlo únicamente después de su validación técnica.'))return;
   const batch=writeBatch(db);
   for(const s of data.stages){
     batch.set(pathBank(s.stage),{stage:s.stage,version:s.version,title:s.title,questions:s.questions,skills:s.skills,updatedAt:serverTimestamp()});
     batch.set(pathKey(s.stage),{stage:s.stage,version:s.version,keys:s.keys,updatedAt:serverTimestamp()});
   }
   await batch.commit();$('expalsaQuizBankFile').value='';await refreshAdmin();
  }catch(e){aStatus('No se publicó el banco: '+(e.message||e));}
 });

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
    create('p',`Conocimientos: ${calc.score}/100 (${calc.correct}/${calc.total}). Califica las habilidades observadas en planta con evidencia específica. No deduzcas habilidades de la prueba escrita.`));
  for(const item of bank.skills){
   const section=create('fieldset',undefined,'quiz-admin-skill');section.append(create('legend',item.label+(item.critical?' · CRÍTICO':'')));
   const select=create('select');select.name=item.id+'_rating';select.required=true;
   const blank=create('option','Selecciona nivel observable');blank.value='';select.append(blank);
   for(let rating=0;rating<=4;rating++){const x=create('option',`${rating} / 4`);x.value=String(rating);select.append(x);}
   const evidence=create('textarea');evidence.name=item.id+'_evidence';evidence.required=true;evidence.minLength=15;evidence.maxLength=800;evidence.rows=2;evidence.placeholder='Qué hizo, cómo se verificó, área/lote y resultado (mínimo 15 caracteres)';
   section.append(select,evidence);form.append(section);
  }
  const note=create('textarea');note.name='observation';note.required=true;note.minLength=12;note.rows=3;note.maxLength=1200;note.placeholder='Conclusión sobre fortalezas, debilidades y seguimiento de la etapa';form.append(note);
  const submit=create('button','Guardar calificación y habilitar etapa siguiente');submit.type='submit';form.append(submit);area.append(form);area.scrollIntoView({behavior:'smooth',block:'nearest'});
  form.addEventListener('submit',async e=>{
   e.preventDefault();const values=new FormData(form),skills=[];
   for(const item of bank.skills){
    const rating=Number(values.get(item.id+'_rating')),evidence=safe(values.get(item.id+'_evidence'));
    if(!Number.isInteger(rating)||rating<0||rating>4||evidence.length<15)return aStatus('Faltan evidencias o calificaciones de '+item.label);
    skills.push({id:item.id,label:item.label,critical:!!item.critical,rating,evidence});
   }
   const observation=safe(values.get('observation'));if(observation.length<12)return aStatus('Agrega conclusiones técnicas.');
   const skillScore=skillsResult(skills),integratedScore=Math.round(calc.score*.6+skillScore*.4);
   if(!confirm(`¿Cerrar y calificar la etapa ${i} de ${r.email}? Teoría ${calc.score}/100 · habilidades ${skillScore}/100.`))return;
   submit.disabled=true;
   try{
    await runTransaction(db,async tx=>{
      const latest=await tx.get(pathAttempt(r.uid,i));
      if(!latest.exists()||latest.data().status!=='submitted')throw Error('La evaluación cambió o ya fue calificada. Actualiza el panel.');
      tx.update(pathAttempt(r.uid,i),{
        status:'graded',score:calc.score,correctCount:calc.correct,total:calc.total,
        skillScore,skills,integratedScore,observation,
        gradedAt:serverTimestamp(),gradedBy:adminEmail
      });
    });
    await refreshAdmin();
   }catch(err){submit.disabled=false;aStatus('No se pudo calificar: '+err.message);}
  });
 }
 function downloadStage(r,i){
  if(!isAdmin()||r.attempts[i]?.status!=='graded')throw Error('El informe por etapa requiere calificación cerrada.');
  const blob=stagePdf({email:r.email,uid:r.uid,program:r.program,stage:i,attempt:r.attempts[i],bank:bankCache[i],keys:keyCache[i]?.keys});
  downloadPdf(blob,`EXPALSA_Informe_Etapa_${i}_${r.uid.slice(0,12)}.pdf`);
 }
 function downloadGeneral(r){
  if(!isAdmin()||!STAGES.every(i=>r.attempts[i]?.status==='graded'))throw Error('No están calificadas las tres evaluaciones.');
  const blob=generalPdf({email:r.email,uid:r.uid,program:r.program,
   attempts:STAGES.map(i=>r.attempts[i]),banks:STAGES.map(i=>bankCache[i]),keysByStage:STAGES.map(i=>keyCache[i]?.keys)});
  downloadPdf(blob,`EXPALSA_Informe_General_6_Semanas_${r.uid.slice(0,12)}.pdf`);
 }
 return {showInspector,refreshAdmin};
}
