
export const CRITERIA = Object.freeze([
  {
    "id": "C1",
    "label": "BPM POES y EPP",
    "weight": 15,
    "critical": true,
    "conduct": "Verifica BPM, POES y EPP; usa y controla palas por área y función, retira utensilios no conformes y segrega producto caído."
  },
  {
    "id": "C2",
    "label": "Conocimiento del camarón y defectos",
    "weight": 10,
    "critical": false,
    "conduct": "Distingue melanosis, deterioro, muda, flacidez y defectos de presentación mediante definiciones aprobadas."
  },
  {
    "id": "C3",
    "label": "Muestreo cuenta y uniformidad",
    "weight": 15,
    "critical": false,
    "conduct": "Obtiene muestra representativa, selecciona extremos sin sesgo, calcula e interpreta cuenta y uniformidad."
  },
  {
    "id": "C4",
    "label": "Balanzas tara y peso neto",
    "weight": 15,
    "critical": false,
    "conduct": "Verifica equipo, usa tara real y método de peso aprobado con cronómetro y contrasta producto empacado."
  },
  {
    "id": "C5",
    "label": "Ficha técnica orden y laboratorio",
    "weight": 10,
    "critical": true,
    "conduct": "Confirma pedido, destino, ficha y resultados requeridos del lote y punto de muestreo antes de autorizar avance dentro de su función."
  },
  {
    "id": "C6",
    "label": "Cadena de frío y flujo",
    "weight": 10,
    "critical": false,
    "conduct": "Mide y registra tiempo y temperatura, evita esperas y actúa ante pérdida de condiciones."
  },
  {
    "id": "C7",
    "label": "HACCP y control específico del área",
    "weight": 10,
    "critical": true,
    "conduct": "Reconoce los PCC del plan vigente y ejecuta monitoreo, pruebas autorizadas y respuesta a desviaciones de su área."
  },
  {
    "id": "C8",
    "label": "Contención trazabilidad y cierre",
    "weight": 10,
    "critical": true,
    "conduct": "Detecta, solicita contención, notifica, verifica, escala por la ruta interna y sigue el caso hasta comprobar eficacia y disposición."
  },
  {
    "id": "C9",
    "label": "Cobertura relevo y comunicación",
    "weight": 3,
    "critical": false,
    "conduct": "Cumple cobertura, recibe y entrega relevo con pendientes, comunica oportunamente y mantiene seguimiento después de solicitar apoyo."
  },
  {
    "id": "C10",
    "label": "Registros e integridad de datos",
    "weight": 2,
    "critical": true,
    "conduct": "Registra al momento el hallazgo, cada monitoreo, personas notificadas, horas, respuestas, decisiones y disposición sin ocultar el dato original."
  }
]);
export const hasFullMatrix = skills => Array.isArray(skills) && skills.length===10 && CRITERIA.every((c,i)=>skills[i]?.id===c.id && Number.isInteger(Number(skills[i]?.rating)) && Number(skills[i]?.rating)>=0 && Number(skills[i]?.rating)<=4);
export function weightedMatrix(skills){
 if(!hasFullMatrix(skills))throw Error('Las diez competencias C1-C10 deben tener una calificación válida.');
 return Math.round(CRITERIA.reduce((sum,c,i)=>sum+c.weight*Number(skills[i].rating)/4,0));
}
export function competenceLevel(a){
 if(a?.status!=='graded')return 'Pendiente';
 if(!hasFullMatrix(a.skills))return 'Registro anterior sin matriz C1-C10';
 const low=a.skills.some((x,i)=>Number(x.rating)<3);
 if(Number(a.score)>=85 && Number(a.skillScore)>=85 && !low)return 'Competencia demostrada';
 if(Number(a.score)>=70 && Number(a.skillScore)>=70 && !a.skills.some((x,i)=>CRITERIA[i].critical && Number(x.rating)<3))return 'En desarrollo';
 return 'Requiere refuerzo';
}
