const BASE=['uid','email','stage','status'];
const SCORES=['score','skillScore','integratedScore','gradedAt'];

export function isAdministratorAccount(user,administrator){
 return !!user?.uid&&!!administrator?.uid&&user.uid===administrator.uid&&
  String(user.email||'').toLowerCase()===String(administrator.email||'').toLowerCase();
}

export function isApprovedInspector(user,access){
 return !!user?.uid&&access?.active===true&&
  String(access.email||'').toLowerCase()===String(user.email||'').toLowerCase();
}

export function publicResultOf(attempt){
 if(!attempt||!['in_progress','submitted','graded'].includes(attempt.status))throw Error('Estado de entrega inválido.');
 const fields=[...BASE];
 if(attempt.status!=='in_progress')fields.push('submittedAt');
 if(attempt.status==='in_progress'||attempt.startedAt!==undefined)fields.push('startedAt','durationMinutes');
 if(attempt.status==='graded')fields.push(...SCORES);
 const result={};
 for(const field of fields){
  if(attempt[field]===undefined)throw Error('La entrega no tiene el campo '+field+'.');
  result[field]=attempt[field];
 }
 return result;
}

export function samePublicResult(a,b){
 if(!a||!b)return false;
 const keys=Object.keys(b);
 const value=x=>x?.toMillis?.()??x?.toDate?.().getTime()??x;
 return Object.keys(a).length===keys.length&&keys.every(k=>value(a[k])===value(b[k]));
}
