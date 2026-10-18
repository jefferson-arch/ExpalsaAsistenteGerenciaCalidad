/* Generador PDF vectorial independiente de servicios externos. Solo se ejecuta con datos
   calificados obtenidos por el administrador en su sesión autenticada. */
const W=595.28,H=841.89,L=45,R=45,usable=W-L-R;
const CP1252={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
function encode(s){const a=[];for(const c of String(s??'')){const p=c.codePointAt(0);a.push(p<=255?p:(CP1252[c]||63));}return new Uint8Array(a);}
const strBytes=s=>Array.from(encode(s));
function esc(s){let out='';for(const b of encode(s)){if(b===40||b===41||b===92)out+='\\'+String.fromCharCode(b);else if(b<32||b>126)out+='\\'+b.toString(8).padStart(3,'0');else out+=String.fromCharCode(b);}return out;}
const rgb=(hex)=>{const s=hex.replace('#','');return [0,2,4].map(i=>Number.parseInt(s.slice(i,i+2),16)/255).map(x=>x.toFixed(3)).join(' ');};
class Pdf{
 constructor(title){this.docTitle=title;this.pages=[];this.lines=[];this.y=0;this.newPage();}
 newPage(){if(this.lines.length)this.pages.push(this.lines.join('\n'));this.lines=[];this.y=46;const p=this.pages.length+1;this.rect(0,0,W,11,'#142d4e');this.rect(0,11,W,3,'#c52642');this.text('EXPALSA  /  ASEGURAMIENTO DE CALIDAD',L,32,9,true,'#142d4e');this.text('CONTROL DE COMPETENCIAS',W-R,32,8,false,'#667889','right');this.line(L,38,W-R,38,'#d7e1eb');this.text('Informe técnico · uso interno',L,H-24,8,false,'#667889');this.text('Página '+p,W-R,H-24,8,false,'#667889','right');}
 setY(y){this.y=y;}
 ensure(height){if(this.y+height>H-50)this.newPage();}
 rect(x,y,w,h,color){this.lines.push(`${rgb(color)} rg ${x.toFixed(2)} ${(H-y-h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);}
 line(x,y,x2,y2,color='#dae1e9',width=1){this.lines.push(`${rgb(color)} RG ${width} w ${x.toFixed(2)} ${(H-y).toFixed(2)} m ${x2.toFixed(2)} ${(H-y2).toFixed(2)} l S`);}
 text(s,x,y,size=10,bold=false,color='#26394d',align='left'){
  const estimated=String(s??'').length*size*(bold?.52:.48);
  let pos=x;if(align==='right')pos-=estimated;
  this.lines.push(`${rgb(color)} rg BT /${bold?'F2':'F1'} ${size} Tf 1 0 0 1 ${pos.toFixed(2)} ${(H-y-size).toFixed(2)} Tm (${esc(s)}) Tj ET`);
 }
 split(s,maxChars){const lines=[];for(const line of String(s??'').split('\n')){let b='';for(const word of line.split(/\s+/)){if(!word)continue;if((b+' '+word).length>maxChars && b){lines.push(b);b=word;}else b=b?b+' '+word:word;}lines.push(b||' ');}return lines;}
 para(s,{size=10,color='#293d53',gap=4,indent=0}={}){const lines=this.split(s,Math.max(18,Math.floor((usable-indent)/(size*.51))));this.ensure(lines.length*(size+5)+gap);for(const line of lines){this.text(line,L+indent,this.y,size,false,color);this.y+=size+5;}this.y+=gap;}
 title(s){this.ensure(47);this.text(s,L,this.y,21,true,'#132e4d');this.y+=34;this.line(L,this.y,W-R,this.y);this.y+=17;}
 head(s){this.ensure(35);this.y+=8;this.text(s,L,this.y,12,true,'#163454');this.y+=23;}
 chip(label,value){this.ensure(47);this.rect(L,this.y,usable,39,'#edf3f8');this.text(label,L+11,this.y+7,8,false,'#697c8b');this.text(value,L+11,this.y+19,12,true,'#193752');this.y+=49;}
 pair(k,v){this.ensure(25);this.text(k,L,this.y,9,true,'#4d6176');const s=String(v??'—');const l=this.split(s,76);for(let i=0;i<l.length;i++){if(i)this.ensure(17);this.text(l[i],L+137,this.y,9,false,'#20354d');this.y+=15;}this.line(L,this.y,W-R,this.y,'#edf0f3',.6);this.y+=7;}
 chart(name,value,description=''){this.ensure(43);const score=Math.max(0,Math.min(100,Number(value)||0));this.text(name.slice(0,72),L,this.y,9,true,'#34495e');this.text(Math.round(score)+' %',W-R,this.y,9,true,score>=85?'#18704b':score>=70?'#9a6518':'#ac3547','right');this.y+=17;this.rect(L,this.y,usable,9,'#e5ebf1');this.rect(L,this.y,usable*score/100,9,score>=85?'#1e6d58':score>=70?'#bf8d40':'#bc4555');this.y+=18;if(description){this.para(description,{size:8,color:'#647589',gap:0,indent:4});}}
 note(s){this.ensure(45);const lines=this.split(s,96);this.rect(L,this.y,usable,lines.length*14+16,'#f4f7fa');this.y+=11;for(const line of lines){this.text(line,L+9,this.y,8,false,'#586c80');this.y+=14;}this.y+=14;}
 blob(){if(this.lines.length)this.pages.push(this.lines.join('\n'));const contents=this.pages.map(x=>strBytes(x+'\n'));const N=this.pages.length;
  const objs=[];
  objs.push('<< /Type /Catalog /Pages 2 0 R >>');
  const refs=[];for(let i=0;i<N;i++) refs.push(`${5+i*2} 0 R`);
  objs.push(`<< /Type /Pages /Kids [${refs.join(' ')}] /Count ${N} >>`);
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  for(let i=0;i<N;i++){
   objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6+i*2} 0 R >>`);
   objs.push({content:contents[i]});
  }
  const out=[],push=s=>out.push(...strBytes(s));push('%PDF-1.4\n%PDFEXPALSA\n');const offsets=[0];
  for(let i=0;i<objs.length;i++){
    offsets.push(out.length);push(`${i+1} 0 obj\n`);
    if(typeof objs[i]==='string')push(objs[i]+'\n');else{
      const c=objs[i].content;push(`<< /Length ${c.length} >>\nstream\n`);out.push(...c);push('endstream\n');
    }
    push('endobj\n');
  }
  const xref=out.length;push(`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`);
  for(let i=1;i<offsets.length;i++)push(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
  push(`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob([new Uint8Array(out)],{type:'application/pdf'});
 }
}
const pct=x=>Math.round(Number(x)||0);
const dateValue=v=>v?.toDate?v.toDate().toLocaleDateString('es-EC'):v instanceof Date?v.toLocaleDateString('es-EC'):typeof v==='string'?v.slice(0,10):'—';
export function topicScores(attempt,bank,keys){const acc={};for(const q of bank?.questions||[]){const k=q.topic||'Otros';const r=acc[k]||(acc[k]={correct:0,total:0});r.total++;if(attempt.answers?.[q.id]===keys?.[q.id])r.correct++;}return Object.entries(acc).map(([name,v])=>({name,correct:v.correct,total:v.total,pct:v.total?Math.round(100*v.correct/v.total):0}));}
export function skillsResult(skills){const rows=Array.isArray(skills)?skills:[];if(!rows.length)return 0;return Math.round(rows.reduce((a,r)=>a+(Number(r.rating)||0),0)/(rows.length*4)*100);}
export function stageLevel(a){const criticalMissing=(a.skills||[]).some(x=>x.critical&&Number(x.rating)<3);if(a.status!=='graded')return 'Pendiente';if((a.score||0)>=85 && (a.skillScore||0)>=85 && !criticalMissing)return 'Competencia demostrada';if((a.score||0)>=70 && (a.skillScore||0)>=70)return 'En desarrollo';return 'Requiere refuerzo';}
export function downloadPdf(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
export function stagePdf({email,uid,program,stage,attempt,bank,keys}){
 if(attempt?.status!=='graded')throw Error('El PDF de etapa solo se emite cuando la calificación está completa.');
 const p=new Pdf('EXPALSA · Etapa '+stage);p.title(`RESULTADOS  /  ETAPA ${stage} DE 3`);
 p.para('Plan de desarrollo técnico de inspectores · ciclo de seis semanas · etapa '+stage+' al cierre de la semana '+stage*2+'.',{size:10});
 p.pair('Inspector (cuenta)',email);p.pair('UID autenticado',uid);p.pair('Inicio del plan',dateValue(program?.startAt));p.pair('Entrega',dateValue(attempt.submittedAt));p.pair('Calificación',dateValue(attempt.gradedAt));p.pair('Evaluador',attempt.gradedBy||'—');
 p.head('Indicadores de competencia de la etapa');p.chart('Prueba objetiva (conocimientos)',attempt.score);p.chart('Observación práctica (habilidades)',attempt.skillScore);p.chart('Índice integrado orientativo (60 % / 40 %)',attempt.integratedScore);
 p.chip('NIVEL DE COMPETENCIA DEMOSTRADO',stageLevel(attempt));
 p.note('El índice integrado es orientativo: 60 % conocimientos + 40 % práctica. La competencia exige ambos indicadores >=85 % y los controles críticos observados en nivel 3 o 4. La habilitación operacional requiere aprobación de Jefatura.');
 p.head('Análisis de conocimientos por tema');for(const row of topicScores(attempt,bank,keys))p.chart(row.name,row.pct,`${row.correct} de ${row.total} respuestas correctas`);
 p.head('Observación de habilidades en planta');for(const s of attempt.skills||[]){p.chart(`${s.label}${s.critical?' [crítico]':''}`,Number(s.rating)*25,`Nivel ${s.rating}/4. Evidencia: ${s.evidence}`);}
 p.head('Fortalezas y oportunidades');const topics=topicScores(attempt,bank,keys);const highs=topics.filter(t=>t.pct>=85).map(t=>t.name);const lows=topics.filter(t=>t.pct<85).map(t=>t.name);const weakSkills=(attempt.skills||[]).filter(s=>Number(s.rating)<3).map(s=>s.label);
 p.para('Fortalezas teóricas: '+(highs.join('; ')||'No se identificaron temas con 85 % o más.'));
 p.para('Temas para reforzar: '+(lows.join('; ')||'Sin brechas teóricas por debajo del umbral.'));
 p.para('Habilidades por reforzar: '+(weakSkills.join('; ')||'Ningún criterio observado por debajo de 3/4.'));
 p.para('Comentario del evaluador: '+(attempt.observation||'Sin comentarios adicionales.'));
 p.note('Documento emitido para análisis gerencial a partir de respuestas guardadas y observación de campo. Identidad fijada por la cuenta autenticada; no editable por el inspector.');
 return p.blob();
}
export function generalPdf({email,uid,program,attempts,banks,keysByStage}){
 if(attempts.length!==3||attempts.some(a=>a?.status!=='graded'))throw Error('El PDF general exige las tres etapas completadas y calificadas.');
 const p=new Pdf('EXPALSA · Informe consolidado');p.title('EVALUACIÓN INTEGRAL  /  6 SEMANAS');p.para('Informe consolidado para Gerencia de Calidad. Comparación longitudinal de conocimientos y habilidades en las tres evaluaciones obligatorias.',{size:11});
 p.pair('Inspector (cuenta)',email);p.pair('UID autenticado',uid);p.pair('Inicio del ciclo',dateValue(program?.startAt));p.pair('Etapas cerradas','3 / 3');
 const theory=Math.round(attempts.reduce((n,a)=>n+a.score,0)/3);const skills=Math.round(attempts.reduce((n,a)=>n+a.skillScore,0)/3);
 const integrated=Math.round(attempts.reduce((n,a)=>n+a.integratedScore,0)/3);
 const consistent=attempts.every(a=>stageLevel(a)==='Competencia demostrada');
 p.head('Indicadores del programa');p.chart('Promedio de conocimientos',theory);p.chart('Promedio de habilidades observadas',skills);p.chart('Índice promedio integrado',integrated);
 p.chip('LECTURA GERENCIAL',consistent?'Competencia consistente en las tres etapas':'Requiere seguimiento / refuerzo');
 p.note('La condición final no concede autonomía de forma automática. Se requiere comprobar además la matriz de desempeño C1-C10, eventos críticos, registros, prácticas y autorización formal de la Jefatura.');
 p.head('Evolución en seis semanas');
 for(let i=0;i<3;i++){const a=attempts[i];p.head(`ETAPA ${i+1} · SEMANA ${(i+1)*2}`);p.chart('Teoría',a.score);p.chart('Práctica',a.skillScore);p.para(`Índice: ${a.integratedScore}/100 · Nivel: ${stageLevel(a)} · Calificado el ${dateValue(a.gradedAt)}.`,{size:9});}
 p.head('Brechas y fortalezas por etapa');
 for(let i=0;i<3;i++){
  const a=attempts[i],topic=topicScores(a,banks[i],keysByStage[i]);
  p.head('Etapa '+(i+1));
  for(const t of topic)p.chart(t.name,t.pct,`${t.correct}/${t.total} respuestas correctas`);
  for(const s of a.skills||[])p.chart('Campo: '+s.label,Number(s.rating)*25,s.evidence);
  p.para('Observación del evaluador: '+(a.observation||'—'),{size:9});
 }
 p.head('Conclusiones y decisiones sugeridas');
 if(consistent)p.para('Los indicadores teóricos y prácticos cumplen el umbral propuesto de 85 % en las tres etapas, con criterios críticos de campo al menos en nivel 3. Validar continuidad y alcance de la autonomía con la Jefatura.');
 else p.para('Se detectan etapas o criterios con necesidad de refuerzo. Priorizar la práctica supervisada, la repetición de casos y la verificación documentada antes de considerar cualquier habilitación de autonomía.');
 p.para('Decisión sobre continuidad, reasignación o autonomía: responsabilidad de la Jefatura, no del algoritmo.');
 p.note('Informe generado desde Firestore por el administrador de EXPALSA. Incluye únicamente las evaluaciones efectivamente enviadas y calificadas; no sustituye auditoría de registros originales.');
 return p.blob();
}
