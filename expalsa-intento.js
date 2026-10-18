import {publicResultOf} from './expalsa-resultados.js';

export const timestampMillis=t=>t?.toMillis?.()??t?.toDate?.().getTime()??(t instanceof Date?t.getTime():NaN);
export const attemptDeadline=s=>timestampMillis(s?.startedAt)+Number(s?.durationMinutes)*60000;
export function validTimeLimit(n){return Number.isInteger(n)&&n>=1&&n<=180;}

export function setupTimedAttempt({db,auth,fs,onFinished,onStatus}){
 const {doc,getDocFromServer,getDoc,updateDoc,writeBatch,serverTimestamp,onSnapshot,signOut}=fs;
 const serverGet=getDocFromServer||getDoc;
 const sessionPath=(uid,i)=>doc(db,'expalsa_calidad_sesiones',uid,'etapas',String(i));
 const attemptPath=(uid,i)=>doc(db,'expalsa_calidad_etapas',uid,'entregas',String(i));
 const resultPath=(uid,i)=>doc(db,'expalsa_calidad_resultados',uid,'etapas',String(i));
 const bankPath=i=>doc(db,'expalsa_calidad_cuestionarios',String(i));
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 let state=null,timer=null,unsubscribe=null,saveTail=Promise.resolve();
 function dispose(){if(timer!==null)clearInterval(timer);timer=null;unsubscribe?.();unsubscribe=null;state=null;}
 function wipe(){if(!state)return;state.target.replaceChildren();state.target.append(node('p','Finalizando evaluación…','quiz-status'));}
 async function logout(){dispose();await onFinished?.();await signOut(auth);location.reload();}
 async function expire(user,stage,session,target){
  if(auth.currentUser?.uid!==user.uid)return;
  const submittedAt=serverTimestamp(),base={uid:user.uid,email:user.email.trim().toLowerCase(),stage,status:'submitted',startedAt:session.startedAt,durationMinutes:session.durationMinutes,submittedAt};
  const batch=writeBatch(db);
  batch.update(attemptPath(user.uid,stage),{status:'submitted',submittedAt,submissionKind:'expired'});
  batch.update(sessionPath(user.uid,stage),{status:'closed'});
  batch.set(resultPath(user.uid,stage),publicResultOf(base));
  if(target){target.replaceChildren();target.append(node('p','Tiempo agotado. Guardando entrega…','quiz-status'));}
  await batch.commit();await logout();
 }
 async function finish(kind='manual'){
  const current=state;if(!current||current.finishing)return;
  if(auth.currentUser?.uid!==current.user.uid){wipe();dispose();return;}
  if(kind==='manual'&&current.bank.questions.some(q=>!Number.isInteger(current.answers[q.id])||current.answers[q.id]<0))return onStatus('Responde todas las preguntas antes de enviar.');
  if(kind==='manual'&&!confirm('¿Enviar definitivamente la evaluación y cerrar sesión?'))return;
  current.finishing=true;wipe();onStatus(kind==='expired'?'Tiempo agotado. Guardando entrega…':'Guardando entrega…');
  try{
   if(kind==='expired'){await expire(current.user,current.stage,current.session,current.target);return;}
   await saveTail;
   if(performance.now()>=current.expiresAt){await expire(current.user,current.stage,current.session,current.target);return;}
   const submittedAt=serverTimestamp(),changes={answers:{...current.answers},version:current.bank.version,status:'submitted',submittedAt,submissionKind:'manual'};
   const batch=writeBatch(db);
   batch.update(attemptPath(current.user.uid,current.stage),changes);
   batch.update(sessionPath(current.user.uid,current.stage),{status:'closed'});
   batch.set(resultPath(current.user.uid,current.stage),publicResultOf({...current.original,...changes}));
   await batch.commit();await logout();
  }catch(e){
   if(state!==current)return;
   try{
    const saved=await serverGet(resultPath(current.user.uid,current.stage));
    if(saved.exists()&&saved.data().status!=='in_progress'){await logout();return;}
   }catch{}
   if(kind==='manual'&&performance.now()>=current.expiresAt){current.finishing=false;await finish('expired');return;}
   current.finishing=false;current.target.replaceChildren();
   current.target.append(node('p','No se pudo confirmar la entrega. Reintenta para finalizar.','quiz-status'));
   const retry=node('button','Reintentar entrega','button secondary');retry.type='button';retry.addEventListener('click',()=>finish(performance.now()>=current.expiresAt?'expired':kind));current.target.append(retry);
   onStatus('Entrega pendiente de confirmación.');
  }
 }
 function save(){
  const current=state;if(!current||current.finishing)return;
  const answers={...current.answers};
  saveTail=saveTail.catch(()=>{}).then(async()=>{
   if(state!==current||current.finishing)return;
   try{await updateDoc(attemptPath(current.user.uid,current.stage),{answers,version:current.bank.version});if(state===current&&!current.finishing)current.saveStatus.textContent='Guardado';}
   catch(e){if(state===current&&!current.finishing)current.saveStatus.textContent='Guardado pendiente. Revisa la conexión.';}
  });
 }
 async function startOrResume({user,program,stage,session,target}){
  dispose();saveTail=Promise.resolve();
  if(auth.currentUser?.uid!==user.uid)throw Error('La sesión cambió.');
  if(!session){
   const durationMinutes=Number(program.timeLimits?.[String(stage)]);
   if(!validTimeLimit(durationMinutes))throw Error('El administrador debe asignar el tiempo de esta evaluación.');
   const startedAt=serverTimestamp(),base={uid:user.uid,email:user.email.trim().toLowerCase(),stage,startedAt,durationMinutes};
   const original={...base,status:'in_progress',version:'',answers:{}};
   const batch=writeBatch(db);
   batch.set(sessionPath(user.uid,stage),{...base,status:'active',checkedAt:startedAt});
   batch.set(attemptPath(user.uid,stage),original);
   batch.set(resultPath(user.uid,stage),publicResultOf(original));
   await batch.commit();
  }else await updateDoc(sessionPath(user.uid,stage),{checkedAt:serverTimestamp()});
  const sessionSnap=await serverGet(sessionPath(user.uid,stage));
  if(!sessionSnap.exists())throw Error('No se pudo verificar el intento.');
  session=sessionSnap.data();
  if(session.status!=='active'){target.replaceChildren();await logout();return;}
  const remaining=attemptDeadline(session)-timestampMillis(session.checkedAt);
  if(!Number.isFinite(remaining))throw Error('No se pudo verificar el tiempo del intento.');
  if(remaining<=0){await expire(user,stage,session,target);return;}
  const expiresAt=performance.now()+remaining;
  let bankSnap,attemptSnap;
  try{[bankSnap,attemptSnap]=await Promise.all([serverGet(bankPath(stage)),serverGet(attemptPath(user.uid,stage))]);}
  catch(e){
   await updateDoc(sessionPath(user.uid,stage),{checkedAt:serverTimestamp()});
   const check=(await serverGet(sessionPath(user.uid,stage))).data();
   if(attemptDeadline(check)<=timestampMillis(check.checkedAt)){await expire(user,stage,check,target);return;}
   throw e;
  }
  if(!bankSnap.exists()||!attemptSnap.exists())throw Error('Evaluación no disponible.');
  const bank=bankSnap.data(),original=attemptSnap.data();
  if(!Array.isArray(bank.questions)||bank.questions.length!==12)throw Error('Cuestionario no válido.');
  if(original.status!=='in_progress'){target.replaceChildren();await logout();return;}
  if(auth.currentUser?.uid!==user.uid)return;
  const answers=Object.fromEntries(bank.questions.map(q=>[q.id,Number.isInteger(original.answers?.[q.id])?original.answers[q.id]:-1]));
  state={user,program,stage,session,target,bank,original,answers,expiresAt,finishing:false};
  target.replaceChildren();
  const form=node('form');form.id='expalsaQuizForm';
  const clock=node('div',undefined,'quiz-clock');clock.setAttribute('role','timer');clock.setAttribute('aria-label','Tiempo restante');
  clock.append(node('span','Tiempo restante'));const remainingLabel=node('strong');clock.append(remainingLabel);form.append(clock);
  for(const [index,q] of bank.questions.entries()){
   const box=node('fieldset',undefined,'quiz-question');box.append(node('small',`${q.topic} · ${index+1} / ${bank.questions.length}`),node('h3',q.text));
   for(let j=0;j<q.options.length;j++){
    const label=node('label',undefined,'quiz-choice'),radio=node('input');radio.type='radio';radio.name=q.id;radio.value=String(j);radio.required=true;radio.checked=answers[q.id]===j;
    radio.addEventListener('change',()=>{if(!state||state.finishing)return;state.answers[q.id]=j;state.saveStatus.textContent='Guardando…';save();});
    label.append(radio,node('span',`${String.fromCharCode(65+j)}. ${q.options[j]}`));box.append(label);
   }
   form.append(box);
  }
  const foot=node('div',undefined,'quiz-controls'),saveStatus=node('span','Guardado');state.saveStatus=saveStatus;foot.append(saveStatus);
  const send=node('button','Enviar evaluación y cerrar sesión','button');send.type='submit';foot.append(send);form.append(foot);target.append(form);
  form.addEventListener('submit',e=>{e.preventDefault();finish('manual');});
  const tick=()=>{
   if(!state)return;const left=Math.max(0,Math.ceil((state.expiresAt-performance.now())/1000));
   remainingLabel.textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
   if(left<=0){if(timer!==null)clearInterval(timer);timer=null;finish('expired');}
  };
  tick();timer=setInterval(tick,250);save();
  if(onSnapshot)unsubscribe=onSnapshot(resultPath(user.uid,stage),snap=>{
   if(snap.metadata?.hasPendingWrites)return;
   if(snap.exists()&&snap.data().status!=='in_progress'&&state&&!state.finishing){wipe();logout().catch(()=>{});}
  },()=>{if(state){wipe();dispose();onStatus('La sesión requiere verificación. Vuelve a ingresar.');}});
  onStatus('Etapa '+stage+' · Un intento');
 }
 globalThis.addEventListener?.('pagehide',()=>{wipe();dispose();});
 globalThis.addEventListener?.('pageshow',e=>{if(e.persisted)location.reload();});
 return {startOrResume,expire,dispose};
}
