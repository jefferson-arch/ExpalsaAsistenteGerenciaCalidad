import {PDF_LOGO,PDF_WIDTHS} from './expalsa-marca.js';
import {CRITERIA,hasFullMatrix,weightedMatrix,competenceLevel} from './expalsa-competencias.js';

const W=595.28,H=841.89,L=45,R=45,usable=W-L-R;
const CP1252={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
function encode(s){const a=[];for(const c of String(s??'')){const p=c.codePointAt(0);a.push(p<=255?p:(CP1252[c]||63));}return new Uint8Array(a);}
const strBytes=s=>Array.from(encode(s));
function esc(s){let out='';for(const b of encode(s)){if(b===40||b===41||b===92)out+='\\'+String.fromCharCode(b);else if(b<32||b>126)out+='\\'+b.toString(8).padStart(3,'0');else out+=String.fromCharCode(b);}return out;}
const rgb=(hex)=>{const s=hex.replace('#','');return [0,2,4].map(i=>Number.parseInt(s.slice(i,i+2),16)/255).map(x=>x.toFixed(3)).join(' ');};
const textWidth=(s,size,bold=false)=>Array.from(encode(s)).reduce((n,b)=>n+(PDF_WIDTHS[bold?'bold':'normal'][b]||0),0)*size;
class Pdf{
 constructor(title){this.docTitle=title;this.pages=[];this.lines=[];this.y=0;this.newPage();}
 newPage(){if(this.lines.length)this.pages.push(this.lines.join('\n'));this.lines=[];this.y=94;const p=this.pages.length+1;this.rect(0,0,W,6,'#142d4e');this.rect(0,6,W,3,'#c52642');const width=158,height=width*PDF_LOGO.height/PDF_LOGO.width;this.lines.push(`q ${width} 0 0 ${height.toFixed(3)} ${L} ${(H-23-height).toFixed(3)} cm /Logo Do Q`);this.text('ASEGURAMIENTO DE CALIDAD',W-R,30,9,true,'#142d4e','right');this.text('CONTROL DE COMPETENCIAS',W-R,47,8,false,'#667889','right');this.line(L,76,W-R,76,'#d7e1eb');this.text('Informe técnico · uso interno',L,H-24,8,false,'#667889');this.text('Página '+p,W-R,H-24,8,false,'#667889','right');}
 setY(y){this.y=y;}
 ensure(height){if(this.y+height>H-50)this.newPage();}
 rect(x,y,w,h,color){this.lines.push(`${rgb(color)} rg ${x.toFixed(2)} ${(H-y-h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);}
 line(x,y,x2,y2,color='#dae1e9',width=1){this.lines.push(`${rgb(color)} RG ${width} w ${x.toFixed(2)} ${(H-y).toFixed(2)} m ${x2.toFixed(2)} ${(H-y2).toFixed(2)} l S`);}
 text(s,x,y,size=10,bold=false,color='#26394d',align='left'){
  const estimated=textWidth(s,size,bold);
  let pos=x;if(align==='right')pos-=estimated;
  this.lines.push(`${rgb(color)} rg BT /${bold?'F2':'F1'} ${size} Tf 1 0 0 1 ${pos.toFixed(2)} ${(H-y-size).toFixed(2)} Tm (${esc(s)}) Tj ET`);
 }
 split(s,maxWidth,size=10,bold=false){const lines=[];for(const line of String(s??'').split('\n')){let b='';for(let word of line.split(/\s+/)){if(!word)continue;if(b&&textWidth(b+' '+word,size,bold)>maxWidth){lines.push(b);b='';}while(textWidth(word,size,bold)>maxWidth){let cut=word.length-1;while(cut>1&&textWidth(word.slice(0,cut),size,bold)>maxWidth)cut--;lines.push(word.slice(0,cut));word=word.slice(cut);}b=b?b+' '+word:word;}lines.push(b||' ');}return lines;}
 para(s,{size=10,color='#293d53',gap=4,indent=0}={}){const lines=this.split(s,usable-indent,size);for(const line of lines){this.ensure(size+5);this.text(line,L+indent,this.y,size,false,color);this.y+=size+5;}this.y+=gap;}
 title(s){this.ensure(47);this.text(s,L,this.y,21,true,'#132e4d');this.y+=34;this.line(L,this.y,W-R,this.y);this.y+=17;}
 head(s){this.ensure(35);this.y+=8;this.text(s,L,this.y,12,true,'#163454');this.y+=23;}
 chip(label,value){this.ensure(47);this.rect(L,this.y,usable,39,'#edf3f8');this.text(label,L+11,this.y+7,8,false,'#697c8b');this.text(value,L+11,this.y+19,12,true,'#193752');this.y+=49;}
 pair(k,v){const lines=this.split(String(v??'—'),usable-137,9);this.ensure(lines.length*15+7);this.text(k,L,this.y,9,true,'#4d6176');for(const line of lines){this.text(line,L+137,this.y,9,false,'#20354d');this.y+=15;}this.line(L,this.y,W-R,this.y,'#edf0f3',.6);this.y+=7;}
 chart(name,value,description=''){const labels=this.split(name,usable-56,9,true);this.ensure(labels.length*13+28);const score=Math.max(0,Math.min(100,Number(value)||0));this.text(Math.round(score)+' %',W-R,this.y,9,true,score>=85?'#18704b':score>=70?'#9a6518':'#ac3547','right');for(const line of labels){this.text(line,L,this.y,9,true,'#34495e');this.y+=13;}this.y+=4;this.rect(L,this.y,usable,9,'#e5ebf1');this.rect(L,this.y,usable*score/100,9,score>=85?'#1e6d58':score>=70?'#bf8d40':'#bc4555');this.y+=18;if(description){this.para(description,{size:8,color:'#647589',gap:0,indent:4});}}
 note(s){const lines=this.split(s,usable-18,8);this.ensure(lines.length*14+30);this.rect(L,this.y,usable,lines.length*14+16,'#f4f7fa');this.y+=11;for(const line of lines){this.text(line,L+9,this.y,8,false,'#586c80');this.y+=14;}this.y+=14;}
 blob(){
  const pages=this.lines.length?[...this.pages,this.lines.join('\n')]:this.pages;
  const contents=pages.map(x=>encode(x+'\n')),N=pages.length;
  const logo=Uint8Array.from(atob(PDF_LOGO.jpeg),c=>c.charCodeAt(0));
  const objs=[
   '<< /Type /Catalog /Pages 2 0 R >>',
   `<< /Type /Pages /Kids [${Array.from({length:N},(_,i)=>`${6+i*2} 0 R`).join(' ')}] /Count ${N} >>`,
   '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
   '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
   {content:logo,dict:`/Type /XObject /Subtype /Image /Width ${PDF_LOGO.width} /Height ${PDF_LOGO.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`}
  ];
  for(let i=0;i<N;i++){
   objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Logo 5 0 R >> >> /Contents ${7+i*2} 0 R >>`);
   objs.push({content:contents[i]});
  }
  const chunks=[];let length=0;
  const raw=b=>{chunks.push(b);length+=b.length;},push=s=>raw(encode(s));
  push('%PDF-1.4\n%PDFEXPALSA\n');const offsets=[0];
  for(let i=0;i<objs.length;i++){
   offsets.push(length);push(`${i+1} 0 obj\n`);
   if(typeof objs[i]==='string')push(objs[i]+'\n');
   else{const o=objs[i];push(`<< ${o.dict||''} /Length ${o.content.length} >>\nstream\n`);raw(o.content);push('\nendstream\n');}
   push('endobj\n');
  }
  const xref=length;push(`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`);
  for(let i=1;i<offsets.length;i++)push(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
  push(`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks,{type:'application/pdf'});
 }

}
const pct=x=>Math.round(Number(x)||0);
const dateValue=v=>v?.toDate?v.toDate().toLocaleDateString('es-EC'):v instanceof Date?v.toLocaleDateString('es-EC'):typeof v==='string'?v.slice(0,10):'—';
export function topicScores(attempt,bank,keys){const acc={};for(const q of bank?.questions||[]){const k=q.topic||'Otros';const r=acc[k]||(acc[k]={correct:0,total:0});r.total++;if(attempt.answers?.[q.id]===keys?.[q.id])r.correct++;}return Object.entries(acc).map(([name,v])=>({name,correct:v.correct,total:v.total,pct:v.total?Math.round(100*v.correct/v.total):0}));}
export function skillsResult(skills){return hasFullMatrix(skills)?weightedMatrix(skills):null;}
export function stageLevel(a){return competenceLevel(a);}
export function downloadPdf(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
export function stagePdf({email,uid,program,stage,attempt,bank,keys}){
 if(attempt?.status!=='graded')throw Error('El PDF de etapa solo se emite cuando la calificación está completa.');
 const p=new Pdf('EXPALSA · Etapa '+stage);p.title(`RESULTADOS  /  ETAPA ${stage} DE 3`);
 p.para('Plan de desarrollo técnico de inspectores · ciclo de seis semanas · etapa '+stage+' al cierre de la semana '+stage*2+'.',{size:10});
 p.pair('Inspector (cuenta)',email);p.pair('UID autenticado',uid);p.pair('Inicio del plan',dateValue(program?.startAt));p.pair('Entrega',dateValue(attempt.submittedAt));p.pair('Calificación',dateValue(attempt.gradedAt));p.pair('Evaluador',attempt.gradedBy||'—');
 p.head('Indicadores de competencia de la etapa');p.chart('Prueba objetiva (conocimientos)',attempt.score);p.chart('Matriz práctica C1–C10 ponderada',attempt.skillScore);p.chart('Índice integrado orientativo (60 % / 40 %)',attempt.integratedScore);
 p.chip('NIVEL DE COMPETENCIA DEMOSTRADO',stageLevel(attempt));
 p.note('Índice orientativo: 60 % teoría y 40 % matriz C1-C10 ponderada. Competencia: teoría >=85, práctica >=85 y C1-C10 en nivel 3 o 4, incluidos los criterios críticos. No concede autonomía sin autorización de Jefatura.');
 p.head('Análisis de conocimientos por tema');for(const row of topicScores(attempt,bank,keys))p.chart(row.name,row.pct,`${row.correct} de ${row.total} respuestas correctas`);
 p.head('Matriz C1-C10 observada en planta');if(!hasFullMatrix(attempt.skills))p.para('REGISTRO ANTERIOR: no incluye las diez competencias. Se requiere valoración integral adicional.',{size:10});for(const s of attempt.skills||[]){p.chart(`${s.id} · ${s.label} (${s.weight||0}%)${s.critical?' [CRÍTICO]':''}`,Number(s.rating)*25,`Nivel ${s.rating}/4. Evidencia: ${s.evidence}`);}
 p.head('Fortalezas y oportunidades');const topics=topicScores(attempt,bank,keys);const highs=topics.filter(t=>t.pct>=85).map(t=>t.name);const lows=topics.filter(t=>t.pct<85).map(t=>t.name);const weakSkills=(attempt.skills||[]).filter(s=>Number(s.rating)<3).map(s=>s.id+' '+s.label);
 p.para('Fortalezas teóricas: '+(highs.join('; ')||'No se identificaron temas con 85 % o más.'));
 p.para('Temas para reforzar: '+(lows.join('; ')||'Sin brechas teóricas por debajo del umbral.'));
 p.para('Habilidades por reforzar: '+(weakSkills.join('; ')||'Ningún criterio observado por debajo de 3/4.'));
 p.para('Comentario del evaluador: '+(attempt.observation||'Sin comentarios adicionales.'));
 p.note('Documento emitido para análisis gerencial a partir de respuestas guardadas y observación de campo. Identidad fijada por la cuenta autenticada; no editable por el inspector.');
 return p.blob();
}
export function generalPdf({email,uid,program,attempts,banks,keysByStage}){
 if(attempts.length!==3||attempts.some(a=>a?.status!=='graded'||!hasFullMatrix(a.skills)))throw Error('El PDF general exige las tres etapas calificadas con C1-C10 completas.');
 const p=new Pdf('EXPALSA · Informe consolidado');p.title('EVALUACIÓN INTEGRAL  /  6 SEMANAS');p.para('Informe consolidado para Gerencia de Calidad. Comparación longitudinal de conocimientos y habilidades en las tres evaluaciones obligatorias.',{size:11});
 p.pair('Inspector (cuenta)',email);p.pair('UID autenticado',uid);p.pair('Inicio del ciclo',dateValue(program?.startAt));p.pair('Etapas cerradas','3 / 3');
 const theory=Math.round(attempts.reduce((n,a)=>n+a.score,0)/3);const skills=Math.round(attempts.reduce((n,a)=>n+a.skillScore,0)/3);
 const integrated=Math.round(attempts.reduce((n,a)=>n+a.integratedScore,0)/3);
 const consistent=attempts.every(a=>stageLevel(a)==='Competencia demostrada');
 p.head('Indicadores del programa');p.chart('Promedio de conocimientos',theory);p.chart('Promedio de habilidades observadas',skills);p.chart('Índice promedio integrado',integrated);
 p.chip('LECTURA GERENCIAL',consistent?'Competencia consistente en las tres etapas':'Requiere seguimiento / refuerzo');
 p.note('Cada etapa contiene diez criterios C1-C10 con evidencias y pesos aprobados de la matriz. Los resultados no conceden autonomía automática; verificar eventos críticos y autorización formal de Jefatura.');
 p.head('Evolución en seis semanas');
 for(let i=0;i<3;i++){const a=attempts[i];p.head(`ETAPA ${i+1} · SEMANA ${(i+1)*2}`);p.chart('Teoría',a.score);p.chart('Práctica',a.skillScore);p.para(`Índice: ${a.integratedScore}/100 · Nivel: ${stageLevel(a)} · Calificado el ${dateValue(a.gradedAt)}.`,{size:9});}
 p.head('Comparativo de competencias C1-C10 / Etapas 1, 2 y 3');
 for(const c of CRITERIA){const vals=attempts.map(a=>a.skills.find(s=>s.id===c.id)?.rating*25||0);p.para(`${c.id} · ${c.label} (${c.weight}%) · semana 2: ${vals[0]} % | semana 4: ${vals[1]} % | semana 6: ${vals[2]} % | cambio: ${vals[2]-vals[0]>=0?'+':''}${vals[2]-vals[0]} p.p.`,{size:9});p.chart('Nivel final · '+c.id,vals[2]);}
 p.head('Brechas y fortalezas por etapa');
 for(let i=0;i<3;i++){
  const a=attempts[i],topic=topicScores(a,banks[i],keysByStage[i]);
  p.head('Etapa '+(i+1));
  for(const t of topic)p.chart(t.name,t.pct,`${t.correct}/${t.total} respuestas correctas`);
  for(const s of a.skills||[])p.chart(s.id+' · '+s.label+' ('+(s.weight||0)+'%)',Number(s.rating)*25,s.evidence);
  p.para('Observación del evaluador: '+(a.observation||'—'),{size:9});
 }
 p.head('Conclusiones y decisiones sugeridas');
 if(consistent)p.para('Los indicadores teóricos y prácticos cumplen el umbral propuesto de 85 % en las tres etapas, con criterios críticos de campo al menos en nivel 3. Validar continuidad y alcance de la autonomía con la Jefatura.');
 else p.para('Se detectan etapas o criterios con necesidad de refuerzo. Priorizar la práctica supervisada, la repetición de casos y la verificación documentada antes de considerar cualquier habilitación de autonomía.');
 p.para('Decisión sobre continuidad, reasignación o autonomía: responsabilidad de la Jefatura, no del algoritmo.');
 p.note('Informe emitido por Aseguramiento de Calidad a partir de las evaluaciones enviadas y calificadas.');
 return p.blob();
}
