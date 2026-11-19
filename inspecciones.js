const COLLECTION = 'expalsa_calidad_inspecciones';
const RUNS = 'expalsa_calidad_inspecciones_runs';
const CORRECTIONS = 'expalsa_calidad_acciones_correctivas';
const PROGRESS = 'expalsa_calidad_inspecciones_progreso';
const AREAS = ['PLANTA', 'EXTERIORES', 'BODEGAS', 'DESECHOS', 'DESPACHO', 'SILO DE HIELO', 'OTROS'];
const STATUS = { cumple: 'Cerrado', no_cumple: 'Abierto', parcial: 'En curso', nueva: 'Nueva observación' };
const DEFAULT_COMPLIANCE_DAYS = { no_cumple: 180, parcial: 120, nueva: 90 };
const LOCATIONS = {
  PLANTA: ['Vestidores / Ingreso a Planta', 'Recepción', 'Recepción de Materia Prima', 'Recepción, Tolva #5', 'Descabezado', 'Descabezado (Planta baja)', 'Lavado de Materiales', 'Lavado de gavetas y canastillas', 'Pre-cajas 2', 'Precajas #1', 'Máquina 2', 'Máquina 5', 'Máquina 5, 7 y 9', 'Máquina 7', 'Máquina 7 y 9', 'Máquina 9', 'Máquina 10', 'Máquinas 10', 'Máquinas 6, 8 y 2', 'Máquinas 6, 8, 2 y 10', 'Máquinas 7, 5 y 9', 'Brine #1 y 2', 'Brine 3, 4 y 5', 'Brine 4', 'Cuarto de salmuera Brine #1 y 2', 'Cuarto de salmuera Brine 3-4-5', 'Cámaras 1, 2 y 3', 'Cámaras 4, 5 y 6', 'Pasillo de los túneles', 'Puesto de supervisor de túneles', 'Precámara', 'Decorado'],
  EXTERIORES: ['Comedor', 'Lavandería', 'Baños del personal', 'Baños', 'Baño de mujeres', 'Baño de mujeres de máquinas clasificadora', 'Baño de mujeres de supervisoras', 'Baño de hombres', 'Baño de hombres de mantenimiento', 'Baño de mantenimiento', 'Exteriores'],
  BODEGAS: ['Bodega de materiales', 'Bodega de químicos y repuestos', 'Bodega de metabisulfito'],
  DESECHOS: ['Baños', 'Brine #1 y 2', 'Cámaras 1', 'Cámaras 1, 2 y 3', 'Máquinas 6, 8 y 2', 'Lavado de gavetas y bines', 'Área de disposición de desechos'],
  DESPACHO: ['Lavado de Bines', 'Lavado de Gavetas, Bines', 'Muelle 2 Cámaras 4, 5 y 6', 'Muelle de Cámaras 1, 2 y 3', 'Muelle de despacho'],
  'SILO DE HIELO': ['Silo de Hielo', 'Silo de Hielo 2', 'Silo de Hielo 3', 'Silo de Hielo 3-4', 'Silo de Hielo 4', 'Silo de Hielo 5'],
  OTROS: ['Laboratorio de recepción', 'Servicios generales', 'Planta de agua', 'Otra área']
};
let demoRecordsPromise;
const BASE_SECTIONS = [
  { id: 'Inicio', icon: '⌂', title: 'Inicio', description: 'Resumen de hallazgos y acciones de inspección.' },
  { id: 'Alertas', icon: '⚑', title: 'Alertas', description: 'Seguimiento prioritario de hallazgos abiertos y en curso.' },
  { id: 'General', icon: '▧', title: 'General', description: 'Observaciones consolidadas de todas las instalaciones.' },
  { id: 'Historial', icon: '◷', title: 'Historial', description: 'Busca, filtra y revisa las inspecciones anteriores.' }
];
const COMPLIANCE_SECTION = { id: 'Cumplimientos', icon: '◷', title: 'Cumplimientos', description: 'Plazos, vencimientos y efectividad de los departamentos responsables.' };
const DEPARTMENT_ICON = '▦';
const DEPARTMENT_NAMES = ['MANTENIMIENTO', 'PRODUCCIÓN', 'CALIDAD', 'SISTEMAS', 'DESPACHO Y LOGÍSTICA', 'SERVICIO GENERAL', 'BODEGA', 'RRHH', 'SEGURIDAD INDUSTRIAL', 'REFRIGERACIÓN'];

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const todayIso = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
function datePlusDays(value, days) {
  if (!value || !Number.isFinite(days)) return '';
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function defaultComplianceDueDate(status, startDate) {
  const days = DEFAULT_COMPLIANCE_DAYS[status];
  return days ? datePlusDays(startDate, days) : '';
}
function updateDefaultDeadline(force = false) {
  const form = $('inspectionForm');
  const dueField = form.elements.complianceDueDate;
  if (dueField.disabled) return;
  if (!force && !dueField.dataset.autoDefault) return;
  const status = form.elements.status.value;
  const startDate = form.elements.notificationDate.value || form.elements.inspectedAt.value;
  const value = defaultComplianceDueDate(status, startDate);
  dueField.value = value;
  dueField.dataset.autoDefault = value ? 'true' : '';
  $('complianceDueDateHint').textContent = value
    ? `Plazo predeterminado de ${DEFAULT_COMPLIANCE_DAYS[status]} días desde la fecha de notificación (editable).`
    : 'Opcional; necesaria para medir el plazo y la efectividad.';
}
const dateDelta = (from, to) => from && to ? Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) : null;
const elapsedDays = value => value ? Math.floor((Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) - Date.parse(`${value}T00:00:00Z`)) / 86400000) : '—';
const daysOpen = row => elapsedDays(row.notificationDate || row.inspectedAt);
function inferImportance(row = {}) {
  const text = `${row.description || ''} ${row.notes || ''} ${row.location || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  if (/cable|electri|gote|filtraci|fuga|plaga|cucaracha|roedor|vidrio|emergencia|incendio|contamin|riesgo|sin base|producto.{0,40}(direct|sin proteccion|desproteg|expuesto|piso|suelo)|direct.{0,25}producto|sin proteccion|sin film|tornillo.{0,30}expuesto|hueco.{0,35}(suelo|piso)|acumulacion.{0,30}desecho|pallet.{0,25}madera|madera.{0,30}(area|producto)|maquina.{0,50}desplazamiento|improvisad.{0,30}movimiento|desprendimiento de concreto/.test(text)) return 'alta';
  if (/suci|limpieza|sarro|moho|condens|oxido|oxidaci|desprend|danad|deterior|malla|tapa|ilumin|lampara|puerta|ventil|grieta|pintura|rotul|corrosion|contacto|cortina|mal estado|banda|canast|pedal|pared.{0,30}dan|esquinero|escarcha|abertura|desactualizad|proteccion/.test(text)) return 'media';
  return 'baja';
}
const importanceOf = row => ['alta', 'media', 'baja'].includes(row?.importance) ? row.importance : inferImportance(row);
const importanceLabel = value => ({ alta: 'Alta', media: 'Media', baja: 'Baja' })[value] || 'Baja';
function alertPriority(row) {
  const severity = { baja: 1, media: 2, alta: 3 }[importanceOf(row)] || 1;
  const age = Math.max(0, Number(daysOpen(row)) || 0);
  const ageFactor = age >= 180 ? 3 : age >= 90 ? 2 : age >= 30 ? 1 : 0;
  const score = severity + ageFactor;
  return severity === 3 || score >= 5 ? 'alta' : score >= 2 ? 'media' : 'baja';
}
const priorityOrder = { alta: 3, media: 2, baja: 1 };
const state = { user: null, role: '', demo: false, tab: 'Inicio', selectedInspectionDate: null, selectedInspectionId: null, activeInspectionId: null, activeInspectionNumber: null, records: [], inspectionRuns: [], corrections: [], progress: {}, unsubscribe: null, pendingPhotos: [], editingPhotos: [], correctionPhotos: [], correctingObservationId: null, viewingPhoto: null, pivotFilter: { status: '', area: '', departmentKey: '' }, complianceFilter: '', toastTimer: null };
let firebaseApi;
let inspectionModulesPromise;
let pdfLibrariesPromise;
let xlsxLibraryPromise;

function syncOtherChoice(select, input) {
  const custom = select.value === '__other__';
  input.hidden = !custom; input.disabled = !custom; input.required = custom;
  if (!custom) input.value = '';
}

function fillLocationOptions(area, selected = '') {
  const select = $('locationSelect'), other = $('locationOther');
  const used = state.demo ? new Set() : new Set(state.records
    .filter(row => row.area === area && row.inspectionId === state.activeInspectionId && normalizeLocation(row.location) !== normalizeLocation(selected))
    .map(row => normalizeLocation(row.location)));
  const options = (LOCATIONS[area] || LOCATIONS.OTROS).filter(value => !used.has(normalizeLocation(value)));
  select.replaceChildren(new Option(options.length ? 'Selecciona una ubicación disponible' : 'No hay ubicaciones disponibles; registra otra', ''), ...options.map(value => new Option(value, value)), new Option('Otra ubicación…', '__other__'));
  if (selected && !options.includes(selected)) { select.value = '__other__'; other.value = selected; }
  else { select.value = selected; other.value = ''; }
  syncOtherChoice(select, other);
}

function updateRecurrenceChoices() {
  const form = $('inspectionForm'), area = form.elements.area.value;
  const location = form.elements.location.value === '__other__' ? form.elements.locationOther.value.trim() : form.elements.location.value;
  const department = form.elements.department.value === '__other__' ? form.elements.departmentOther.value.trim() : form.elements.department.value;
  const selected = form.elements.reincidenceOf.value;
  const departmentKeys = new Set(rowDepartments({ department }).map(item => item.key));
  const candidates = state.records.filter(row => ['no_cumple', 'parcial'].includes(row.status) && row.complianceDueDate && complianceResult(row).kind === 'vencido'
    && row.area === area && normalizeLocation(row.location) === normalizeLocation(location)
    && (!departmentKeys.size || rowDepartments(row).some(item => departmentKeys.has(item.key))))
    .sort((a, b) => (b.inspectedAt || '').localeCompare(a.inspectedAt || ''));
  const field = $('recurrenceField'), select = $('reincidenceSelect');
  field.hidden = !candidates.length;
  select.replaceChildren(new Option('No es una reincidencia', ''), ...candidates.map(row => new Option(`${row.inspectionNumber || inspectionNumber(row.inspectedAt)} · ${dateLabel(row.inspectedAt)} · ${row.description.slice(0, 90)}`, row.id)));
  if (candidates.some(row => row.id === selected)) select.value = selected;
}

function normalizeLocation(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

function fillDepartment(selected = '') {
  const select = $('departmentSelect'), other = $('departmentOther');
  const found = [...select.options].some(option => option.value === selected);
  select.value = found ? selected : (selected ? '__other__' : '');
  other.value = found ? '' : selected;
  syncOtherChoice(select, other);
}

function formValue(form, name, otherName) {
  return form.elements[name].value === '__other__' ? form.elements[otherName].value.trim() : form.elements[name].value.trim();
}

function showToast(message, error = false) {
  const toast = $('toast'); toast.textContent = message; toast.classList.toggle('error', error); toast.classList.add('show');
  clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function friendlyError(error) {
  const code = error?.code || '';
  if (code.includes('permission-denied')) return 'Tu cuenta no tiene autorización para consultar esta información.';
  if (code.includes('storage/unauthorized')) return 'No tienes autorización para acceder a la evidencia fotográfica.';
  if (code.includes('auth/invalid-credential') || code.includes('auth/invalid-login-credentials')) return 'El correo o la contraseña no son correctos.';
  if (code.includes('auth/too-many-requests')) return 'Se realizaron muchos intentos. Espera un momento y vuelve a intentarlo.';
  return error?.message || 'No se pudo completar la operación. Intenta de nuevo.';
}

function setConnection(connected, label = '') {
  $('connectionLabel').textContent = label || (connected ? 'Conectado a Firebase' : 'Conexión pendiente');
  const dot = document.querySelector('.side-bottom .live-dot');
  if (dot) { dot.style.background = connected ? '#53b694' : '#d09a49'; dot.style.boxShadow = connected ? '0 0 0 3px rgba(83,182,148,.12)' : '0 0 0 3px rgba(208,154,73,.13)'; }
}

function drawNavigation() {
  $('sectionNav').className = 'side-nav';
  const statusCounts = Object.fromEntries(Object.keys(STATUS).map(key => [key, 0]));
  const departmentCounts = new Map();
  let overdue = 0;
  for (const row of state.records) {
    if (statusCounts[row.status] !== undefined) statusCounts[row.status]++;
    if (['no_cumple', 'parcial', 'nueva'].includes(row.status) && row.complianceDueDate && complianceResult(row).kind === 'vencido') overdue++;
    for (const department of rowDepartments(row)) departmentCounts.set(department.key, (departmentCounts.get(department.key) || 0) + 1);
  }
  const alerts = statusCounts.no_cumple + statusCounts.parcial;
  $('sectionNav').innerHTML = getSections().map(item => `<button class="nav-button${state.tab === item.id ? ' active' : ''}" data-tab="${escapeHtml(item.id)}" type="button"><span class="nav-icon">${item.icon}</span><span>${escapeHtml(item.title)}</span>${item.id === 'Alertas' && alerts ? `<span class="nav-alert-count">${alerts}</span>` : item.id === 'Cumplimientos' && overdue ? `<span class="nav-alert-count">${overdue}</span>` : item.departmentKey ? `<span class="nav-alert-count department-count">${departmentCounts.get(item.departmentKey) || 0}</span>` : ''}</button>`).join('');
}

function getSections() {
  const departments = new Map();
  for (const row of state.records) for (const department of rowDepartments(row)) {
    if (!departments.has(department.key)) departments.set(department.key, department.name);
  }
  const cards = [...departments].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([key, name]) => {
    const title = departmentTitle(name);
    return { id: `Departamento:${key}`, departmentKey: key, icon: DEPARTMENT_ICON, title, description: `Hallazgos asignados al departamento ${title}.` };
  });
  return [...BASE_SECTIONS.slice(0, 2), COMPLIANCE_SECTION, ...cards, ...BASE_SECTIONS.slice(2)];
}

function complianceResult(row, today = todayIso()) {
  if (!row.complianceDueDate) return { kind: 'sin_plazo', days: null };
  const dueDate = row.complianceDueDate;
  if (row.status === 'cumple') {
    const completionAction = state.corrections.find(action => action.observationId === row.id && action.newStatus === 'cumple');
    const completionValue = completionAction?.createdAt || completionAction?.actionDate || row.complianceCompletedAt;
    const completedDate = completionValue?.toDate ? completionValue.toDate().toLocaleDateString('en-CA') : completionValue || row.inspectedAt || '';
    const delta = dateDelta(dueDate, completedDate);
    return { kind: delta !== null && delta <= 0 ? 'a_tiempo' : 'tarde', days: delta !== null && delta > 0 ? delta : 0, completedDate };
  }
  if (!['no_cumple', 'parcial', 'nueva'].includes(row.status)) return { kind: 'no_evaluable', days: null };
  const remaining = dateDelta(today, dueDate);
  return remaining < 0 ? { kind: 'vencido', days: -remaining } : { kind: remaining === 0 ? 'vence_hoy' : 'abierto', days: remaining };
}

const COMPLIANCE_FILTER_LABELS = {
  con_plazo: 'Con plazo',
  a_tiempo: 'Cerrados a tiempo',
  abierto: 'Abiertos a tiempo',
  vencido: 'Vencidos abiertos',
  tarde: 'Cerrados tarde',
  retraso: 'Retraso abierto (días)'
};

function complianceRowsForFilter(filter, today = todayIso()) {
  const eligible = state.records.filter(row => row.complianceDueDate && ['no_cumple', 'parcial', 'nueva', 'cumple'].includes(row.status));
  if (filter === 'con_plazo') return eligible.filter(row => complianceResult(row, today).kind !== 'vencido');
  if (filter === 'a_tiempo') return eligible.filter(row => complianceResult(row, today).kind === 'a_tiempo');
  if (filter === 'abierto') return eligible.filter(row => ['abierto', 'vence_hoy'].includes(complianceResult(row, today).kind));
  if (filter === 'vencido' || filter === 'retraso') return eligible.filter(row => complianceResult(row, today).kind === 'vencido');
  if (filter === 'tarde') return eligible.filter(row => complianceResult(row, today).kind === 'tarde');
  return [];
}

function departmentTitle(value) {
  return String(value || '').toLocaleLowerCase('es').split(' ').map((word, index) => {
    if (word === 'rrhh') return 'RRHH';
    if (index && ['y', 'de'].includes(word)) return word;
    return word ? word[0].toLocaleUpperCase('es') + word.slice(1) : word;
  }).join(' ');
}

function normalizeDepartment(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('es').replace(/MANTENIMIE\s*NTO/g, 'MANTENIMIENTO').replace(/SERVICIO\s+GENERALES/g, 'SERVICIO GENERAL').replace(/\s+/g, ' ').trim();
}

function rowDepartments(row) {
  const raw = normalizeDepartment(row.department);
  if (!raw) return [];
  const aliases = [...DEPARTMENT_NAMES].sort((a, b) => normalizeDepartment(b).length - normalizeDepartment(a).length);
  const found = new Map();
  for (const name of aliases) {
    const normalized = normalizeDepartment(name);
    const pattern = normalized.split(' ').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
    if (new RegExp(`(^|[^A-Z0-9])${pattern}([^A-Z0-9]|$)`).test(raw)) found.set(normalized, name);
  }
  if (!found.size) {
    for (const part of raw.split(/\s*(?:[-–—/;,|+])\s*/).filter(Boolean)) found.set(part, part);
  }
  return [...found].map(([key, name]) => ({ key, name }));
}

function responsibleDepartmentGroup(row) {
  const departments = rowDepartments(row).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  if (!departments.length) return { key: 'SIN_DEPARTAMENTO_ASIGNADO', name: 'Sin departamento asignado' };
  return {
    key: departments.map(department => department.key).join('|'),
    name: departments.map(department => departmentTitle(department.name)).join(' + ')
  };
}

function recordsForView() {
  let records = state.records;
  if (AREAS.includes(state.tab)) records = records.filter(row => row.area === state.tab);
  if (state.tab.startsWith('Departamento:')) {
    const departmentKey = state.tab.slice('Departamento:'.length);
    records = records.filter(row => rowDepartments(row).some(department => department.key === departmentKey));
  }
  const q = $('quickSearch').value.trim().toLocaleLowerCase('es');
  const status = $('filterStatus').value;
  const department = $('filterDepartment').value.trim().toLocaleLowerCase('es');
  const from = $('filterFrom').value;
  const to = $('filterTo').value;
  if (q) records = records.filter(row => [row.location, row.description, row.department, row.notes, row.area].some(value => String(value || '').toLocaleLowerCase('es').includes(q)));
  if (status) records = records.filter(row => row.status === status);
  if (department) records = records.filter(row => String(row.department || '').toLocaleLowerCase('es').includes(department));
  if (from) records = records.filter(row => row.inspectedAt >= from);
  if (to) records = records.filter(row => row.inspectedAt <= to);
  return [...records].sort((a, b) => $('filterOrder').value === 'asc' ? a.inspectedAt.localeCompare(b.inspectedAt) : b.inspectedAt.localeCompare(a.inspectedAt));
}

function userLabel(user = state.user) {
  const email = String(user?.email || '').toLowerCase();
  if (email === 'jefferson@expalsaevaluations.com') return 'Jefferson Figueroa';
  if (email === 'fabio@expalsaevaluations.com') return 'Fabio';
  if (email === 'karina@expalsaevaluations.com') return 'Karina';
  return user?.displayName || email.split('@')[0] || 'Inspector';
}

function inspectionNumber(value) {
  if (value && typeof value === 'object') return value.inspectionNumber || `INS-${String(value.inspectedAt || '').replace(/\D/g, '')}`;
  return value ? `INS-${String(value).replace(/\D/g, '')}` : 'INS-SF-001';
}

function groupInspections(records) {
  const groups = new Map();
  for (const run of state.inspectionRuns) {
    const rows = records.filter(row => row.inspectionId === run.id);
    groups.set(run.id, { id: run.id, run, date: run.inspectedAt || '', rows, areas: new Set(rows.map(row => row.area)), statuses: Object.fromEntries(Object.keys(STATUS).map(status => [status, rows.filter(row => row.status === status).length])) });
  }
  const legacy = new Map();
  for (const row of records.filter(item => !item.inspectionId)) {
    const key = row.inspectedAt || '';
    if (!legacy.has(key)) legacy.set(key, { id: `legacy:${key}`, date: key, rows: [], areas: new Set(), statuses: Object.fromEntries(Object.keys(STATUS).map(status => [status, 0])), run: { status: 'terminada' } });
    const group = legacy.get(key); group.rows.push(row); group.areas.add(row.area); if (group.statuses[row.status] !== undefined) group.statuses[row.status]++;
  }
  for (const [id, group] of legacy) groups.set(id, group);
  const values = [...groups.values()].filter(group => group.rows.length || !activeFilterCount());
  return values.sort((a, b) => $('filterOrder').value === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
}

function render() {
  if (!state.user) return;
  drawNavigation();
  const sections = getSections();
  const selected = sections.find(item => item.id === state.tab) || sections[0];
  const selectedInspection = state.tab === 'Historial' && (state.selectedInspectionId !== null || state.selectedInspectionDate !== null);
  const selectedRun = state.inspectionRuns.find(run => run.id === state.selectedInspectionId);
  const selectedInspectionDate = selectedRun?.inspectedAt || state.selectedInspectionDate;
  const inspectionRows = selectedInspection ? recordsForView().filter(row => selectedRun ? row.inspectionId === selectedRun.id : (row.inspectedAt || '') === state.selectedInspectionDate) : [];
  const number = selectedInspection ? selectedRun ? inspectionNumber(selectedRun) : inspectionNumber(state.selectedInspectionDate) : '';
  $('pageTitle').textContent = selectedInspection ? number : selected.title;
  $('pageDescription').textContent = selectedInspection
    ? `${selectedInspectionDate ? dateLabel(selectedInspectionDate) : 'Fecha no registrada'} · ${inspectionRows.length} hallazgos · ${selectedRun?.status === 'en_curso' ? 'En curso' : 'Terminada'} · detalle por área`
    : selected.description;
  $('pageEyebrow').textContent = state.tab === 'Historial' ? 'CONSULTA Y SEGUIMIENTO' : 'CONTROL DE INSTALACIONES';
  $('dashboardView').hidden = state.tab !== 'Inicio';
  $('alertsView').hidden = state.tab !== 'Alertas';
  $('complianceView').hidden = state.tab !== 'Cumplimientos';
  $('listView').hidden = ['Inicio', 'Alertas', 'Cumplimientos'].includes(state.tab);
  $('listScope').textContent = selectedInspection ? 'Detalle de inspección' : state.tab === 'Historial' ? 'Inspecciones por fecha' : selected.departmentKey ? `Departamento responsable · ${selected.title}` : 'Todas las áreas';
  $('backToHistory').hidden = !selectedInspection;
  const activeRun = state.inspectionRuns.find(run => run.id === state.activeInspectionId);
  const active = state.demo ? !!state.activeInspectionId : activeRun?.status === 'en_curso';
  $('activeInspectionBadge').hidden = !active;
  $('activeInspectionBadge').textContent = active ? `${state.activeInspectionNumber || inspectionNumber(activeRun)} · EN CURSO` : '';
  $('saveAreaButton').hidden = !AREAS.includes(state.tab) || !active;
  $('closeInspectionButton').hidden = !active;
  $('closeInspectionButton').textContent = 'Inspección finalizada';
  const savedArea = state.progress[`${state.activeInspectionId}:${state.tab}`];
  $('saveAreaButton').textContent = savedArea ? `Guardado ✓ · ${savedArea.savedByName || userLabel()}` : 'Guardar pestaña';
  $('newInspection').textContent = active ? '＋ HALLAZGOS' : '＋ Nueva inspección';
  $('newInspection').setAttribute('aria-label', active ? 'Registrar hallazgos en la inspección activa' : 'Iniciar nueva inspección');
  const filtered = recordsForView();
  if (state.tab === 'Alertas') {
    $('resultCount').textContent = '';
    $('recordsBody').innerHTML = '';
  } else if (state.tab === 'Historial' && !selectedInspection) {
    const groups = groupInspections(filtered);
    $('resultCount').textContent = `${groups.length} ${groups.length === 1 ? 'inspección' : 'inspecciones'}`;
    $('recordsHead').innerHTML = '<tr><th>N.º DE INSPECCIÓN</th><th>FECHA</th><th>ÁREAS INSPECCIONADAS</th><th>HALLAZGOS</th><th>ESTADOS</th><th>ACCIONES</th></tr>';
    $('recordsBody').innerHTML = groups.map(group => {
      const statusSummary = Object.entries(group.statuses).filter(([, count]) => count).map(([status, count]) => `<span class="status-pill status-${escapeHtml(status)}">${escapeHtml(STATUS[status])}: ${count}</span>`).join(' ');
      const areas = [...group.areas].map(areaTitle).join(' · ');
      const groupNumber = group.run.id?.startsWith('demo-') ? inspectionNumber(group.run) : group.run.inspectionNumber ? inspectionNumber(group.run) : inspectionNumber(group.date);
      const statusText = group.run.status === 'en_curso' ? '<span class="run-status run-open">En curso</span>' : '<span class="run-status run-closed">Terminada</span>';
      return `<tr class="inspection-group-row"><td><strong class="inspection-number">${escapeHtml(groupNumber)}</strong></td><td><strong>${escapeHtml(group.date ? dateLabel(group.date) : 'Sin fecha registrada')}</strong><div>${statusText}</div></td><td>${escapeHtml(areas || '—')}</td><td><strong>${group.rows.length}</strong></td><td><div class="inspection-statuses">${statusSummary}</div></td><td><button class="button secondary open-inspection" data-open-inspection="${escapeHtml(group.id)}" type="button">${group.run.status === 'en_curso' ? 'Continuar' : 'Abrir detalle'} <span aria-hidden="true">→</span></button><button class="button danger delete-inspection" data-delete-inspection="${escapeHtml(group.id)}" type="button" ${state.demo || state.role === 'admin' ? '' : 'disabled'}>Eliminar</button></td></tr>`;
    }).join('');
  } else {
    const detailRows = selectedInspection ? inspectionRows : filtered;
    $('resultCount').textContent = `${detailRows.length} ${detailRows.length === 1 ? 'observación' : 'observaciones'}`;
    $('recordsHead').innerHTML = '<tr><th>FECHA / ÁREA</th><th>HALLAZGO</th><th>IMPORTANCIA</th><th>RESPONSABLE</th><th>REGISTRÓ</th><th>DÍAS ABIERTOS</th><th>ESTADO</th><th>EVIDENCIA</th><th></th></tr>';
    $('recordsBody').innerHTML = detailRows.map(row => `<tr>
      <td><div class="date-area"><strong>${escapeHtml(dateLabel(row.inspectedAt))}</strong><span>${escapeHtml(areaTitle(row.area))}${row.sourceSection ? ` · ${escapeHtml(row.sourceSection)}` : ''} · ${escapeHtml(row.location)}</span></div></td>
      <td><span class="finding-title">${escapeHtml(row.description)}</span>${row.notes ? `<span class="finding-note">${escapeHtml(row.notes)}</span>` : ''}</td>
      <td><span class="importance-mark importance-${importanceOf(row)}">${importanceLabel(importanceOf(row))}</span></td>
      <td class="department-cell">${escapeHtml(row.department || '—')}</td>
      <td class="department-cell">${escapeHtml(row.inspectorName || row.createdByName || '—')}</td>
      <td>${escapeHtml(daysOpen(row))}</td>
      <td><span class="status-pill status-${escapeHtml(row.status)}">${escapeHtml(STATUS[row.status] || 'Sin estado')}</span></td>
      <td>${(row.photos || []).length ? `<button class="photo-count photo-open-button" type="button" data-view-photo="${escapeHtml(row.id)}">▧ ${(row.photos || []).length} foto${row.photos.length > 1 ? 's' : ''}</button>` : '<span class="photo-count">—</span>'}</td>
      <td><button class="row-actions" data-edit="${escapeHtml(row.id)}" type="button" aria-label="${row.status === 'no_cumple' || row.status === 'parcial' ? 'Registrar acción correctiva' : 'Ver observación'}">${row.status === 'no_cumple' || row.status === 'parcial' ? '⚑' : '↗'}</button></td>
    </tr>`).join('');
  }
  const visibleCount = $('recordsBody').children.length;
  $('emptyState').hidden = visibleCount > 0;
  $('filterCount').hidden = activeFilterCount() === 0;
  $('filterCount').textContent = activeFilterCount();
  if (state.tab === 'Inicio') renderDashboard();
  if (state.tab === 'Alertas') renderAlerts();
  if (state.tab === 'Cumplimientos') renderCompliance();
}

function activeFilterCount() {
  return Number(!!$('filterStatus').value) + Number(!!$('filterDepartment').value.trim()) + Number(!!$('filterFrom').value) + Number(!!$('filterTo').value) + Number(!!$('quickSearch').value.trim());
}

function renderDashboard() {
  const rows = state.records;
  const counts = Object.fromEntries(Object.keys(STATUS).map(key => [key, 0]));
  const areaCounts = Object.fromEntries(AREAS.map(area => [area, { total: 0, ...Object.fromEntries(Object.keys(STATUS).map(key => [key, 0])) }]));
  for (const row of rows) {
    if (counts[row.status] !== undefined) counts[row.status]++;
    const area = areaCounts[row.area];
    if (area) { area.total++; if (area[row.status] !== undefined) area[row.status]++; }
  }
  $('statTotal').textContent = rows.length;
  $('statCompliant').textContent = counts.cumple;
  $('statFailed').textContent = counts.no_cumple;
  $('statPartial').textContent = counts.parcial;
  const { status: pivotStatus, area: pivotArea, departmentKey: pivotDepartmentKey } = state.pivotFilter;
  const donutRows = rows.filter(row => (!pivotStatus || row.status === pivotStatus)
    && (!pivotArea || row.area === pivotArea)
    && (!pivotDepartmentKey || responsibleDepartmentGroup(row).key === pivotDepartmentKey));
  $('donutTotal').textContent = donutRows.length;
  $('donutLabel').textContent = pivotStatus ? STATUS[pivotStatus] : pivotArea ? areaTitle(pivotArea) : pivotDepartmentKey ? 'departamento' : 'hallazgos';
  $('legendCompliant').textContent = counts.cumple;
  $('legendFailed').textContent = counts.no_cumple;
  $('legendPartial').textContent = counts.parcial;
  $('legendNew').textContent = counts.nueva;
  const total = rows.length || 1;
  const first = counts.cumple / total * 100;
  const second = first + counts.no_cumple / total * 100;
  const third = second + counts.parcial / total * 100;
  const baseChartColors = { cumple: '#3b9875', no_cumple: '#cd5a55', parcial: '#ca9039', nueva: '#8997a7' };
  const mutedChartColors = { cumple: '#c8d9d0', no_cumple: '#dfc8c5', parcial: '#e3d9c5', nueva: '#d1d6dc' };
  const selectedStatus = state.pivotFilter.status;
  const chartColors = Object.fromEntries(Object.entries(baseChartColors).map(([key, color]) => [key, selectedStatus && key !== selectedStatus ? mutedChartColors[key] : color]));
  $('statusDonut').style.background = rows.length ? `conic-gradient(${chartColors.cumple} 0% ${first}%,${chartColors.no_cumple} ${first}% ${second}%,${chartColors.parcial} ${second}% ${third}%,${chartColors.nueva} ${third}% 100%)` : 'conic-gradient(#e2e8ed 0% 100%)';
  $('statusDonut').classList.toggle('is-pivot-selected', !!selectedStatus);
  $('statusDonut').style.setProperty('--pivot-highlight', baseChartColors[selectedStatus] || 'transparent');
  const selectedSummary = pivotStatus || pivotArea || pivotDepartmentKey
    ? ` Selección actual: ${donutRows.length} hallazgos${pivotStatus ? ` en estado ${STATUS[pivotStatus]}` : ''}${pivotArea ? ` del área ${areaTitle(pivotArea)}` : ''}.`
    : '';
  $('statusDonut').setAttribute('aria-label', `Gráfico de estado general: ${Object.entries(counts).map(([key, value]) => `${STATUS[key]} ${value}`).join(', ')}.${selectedSummary} Haz clic en un segmento para filtrar.`);
  document.querySelectorAll('.legend-filter').forEach(button => {
    const selected = state.pivotFilter.status === button.dataset.pivotStatus && !state.pivotFilter.area && !state.pivotFilter.departmentKey;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
   $('categorySummary').innerHTML = AREAS.map(area => {
     const areaCountsForRow = areaCounts[area], count = areaCountsForRow.total;
     const segments = ['cumple','no_cumple','parcial','nueva'].map(status => {
       const value = areaCountsForRow[status];
       const selected = state.pivotFilter.area === area && state.pivotFilter.status === status && !state.pivotFilter.departmentKey;
       return `<button class="bar-segment segment-${status}${selected ? ' is-active' : ''}" data-pivot-area="${area}" data-pivot-status="${status}" style="width:${rows.length ? value / rows.length * 100 : 0}%" title="Filtrar ${escapeHtml(areaTitle(area))} · ${escapeHtml(STATUS[status])}: ${value}" aria-label="Filtrar ${escapeHtml(areaTitle(area))}, ${escapeHtml(STATUS[status])}: ${value}" aria-pressed="${selected}" type="button"></button>`;
     }).join('');
     const label = ['cumple','no_cumple','parcial','nueva'].map(status => `${STATUS[status]}: ${areaCountsForRow[status]}`).join(', ');
     return `<div class="category-row"><button class="category-area-filter${state.pivotFilter.area === area && !state.pivotFilter.status ? ' is-active' : ''}" data-pivot-area="${area}" type="button" aria-pressed="${state.pivotFilter.area === area && !state.pivotFilter.status}">${escapeHtml(areaTitle(area))}</button><div class="bar-track segmented-bar" role="group" aria-label="${escapeHtml(areaTitle(area))}: ${escapeHtml(label)}">${segments}</div><b>${count}</b></div>`;
   }).join('');
  renderPivotTable();
  const recent = [...rows].sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt)).slice(0, 5);
  $('recentRows').innerHTML = recent.length ? `<div class="recent-list"><div class="recent-header" aria-hidden="true"><span>Fecha</span><span>Hallazgo</span><span class="recent-location">Área / ubicación</span><span>Estado</span><span>Registró</span><span></span></div>${recent.map(row => `<div class="recent-row"><span class="recent-date">${escapeHtml(dateLabel(row.inspectedAt))}</span><span class="recent-finding">${escapeHtml(row.description)}</span><span class="recent-location">${escapeHtml(row.area)} · ${escapeHtml(row.location)}</span><span class="status-pill status-${escapeHtml(row.status)}">${escapeHtml(STATUS[row.status] || '')}</span><span class="recent-registered" title="${escapeHtml(row.inspectorName || row.createdByName || '—')}">${escapeHtml(row.inspectorName || row.createdByName || '—')}</span><button class="row-actions" type="button" data-edit="${escapeHtml(row.id)}" aria-label="Editar observación">↗</button></div>`).join('')}</div>` : '<div class="empty-state"><div class="empty-glyph">▧</div><h3>Tu historial empieza aquí</h3><p>Las observaciones guardadas aparecerán en este resumen.</p></div>';
}

function renderAlerts() {
  const rows = state.records;
  const priorities = rows.filter(row => row.status === 'no_cumple' || row.status === 'parcial').sort((a, b) => priorityOrder[alertPriority(b)] - priorityOrder[alertPriority(a)] || (Number(daysOpen(b)) || 0) - (Number(daysOpen(a)) || 0));
  $('alertTotal').textContent = priorities.length;
  $('alertsBody').innerHTML = priorities.map(row => `<tr><td><span class="priority-mark priority-${alertPriority(row)}">${importanceLabel(alertPriority(row))}</span>${row.reincidenceOf ? '<span class="table-secondary recurrence-alert-note">Reincidencia</span>' : ''}</td><td><span class="importance-mark importance-${importanceOf(row)}">${importanceLabel(importanceOf(row))}</span></td><td><strong>${escapeHtml(row.inspectionNumber || inspectionNumber(row.inspectedAt))}</strong></td><td>${escapeHtml(areaTitle(row.area))}<span class="table-secondary">${escapeHtml(row.sourceSection ? `${row.sourceSection} · ` : '')}${escapeHtml(row.location)}</span></td><td><span class="finding-title">${escapeHtml(row.description)}</span>${row.reincidenceOf ? '<span class="table-secondary recurrence-alert-note">Vuelve a registrarse un hallazgo pendiente.</span>' : ''}</td><td>${escapeHtml(daysOpen(row))}</td><td><span class="status-pill status-${escapeHtml(row.status)}">${escapeHtml(STATUS[row.status])}</span></td><td><button class="button corrective-action-button" data-correct="${escapeHtml(row.id)}" type="button">Registrar corrección</button></td></tr>`).join('');
  $('alertsEmpty').hidden = priorities.length > 0;
  const actions = state.corrections;
  $('correctionTotal').textContent = `${actions.length} ${actions.length === 1 ? 'acción' : 'acciones'}`;
  $('correctionsBody').innerHTML = actions.map(action => { const actionDate = action.createdAt?.toDate?.(); const finding = state.records.find(row => row.id === action.observationId) || action; return `<tr><td>${escapeHtml(actionDate ? actionDate.toLocaleDateString('es-EC') : dateLabel(action.actionDate))}</td><td><strong>${escapeHtml(finding.inspectionNumber || action.inspectionNumber || '—')}</strong><span class="table-secondary">${escapeHtml(areaTitle(finding.area))} · ${escapeHtml(finding.location || '')}</span><span class="table-secondary">${escapeHtml(finding.description || '')}</span></td><td><span class="finding-title">${escapeHtml(action.note || '')}</span><span class="table-secondary">${(action.photos || []).length} evidencia${(action.photos || []).length === 1 ? '' : 's'}</span></td><td><span class="status-pill status-${escapeHtml(action.previousStatus)}">${escapeHtml(STATUS[action.previousStatus] || '')}</span> → <span class="status-pill status-${escapeHtml(action.newStatus)}">${escapeHtml(STATUS[action.newStatus] || '')}</span></td><td>${escapeHtml(action.byName || '—')}</td></tr>`; }).join('');
  $('correctionsEmpty').hidden = actions.length > 0;
}

function renderCompliance() {
  const today = todayIso();
  const eligibleRows = state.records.filter(row => row.complianceDueDate && ['no_cumple', 'parcial', 'nueva', 'cumple'].includes(row.status));
  const openRows = state.records.filter(row => ['no_cumple', 'parcial', 'nueva'].includes(row.status))
    .sort((a, b) => (a.complianceDueDate || '9999-12-31').localeCompare(b.complianceDueDate || '9999-12-31') || (b.inspectedAt || '').localeCompare(a.inspectedAt || ''));
  const overall = eligibleRows.map(row => complianceResult(row, today));
  const onTime = overall.filter(item => item.kind === 'a_tiempo').length;
  const overdue = openRows.filter(row => row.complianceDueDate && complianceResult(row, today).kind === 'vencido').length;
  $('complianceOpenTotal').textContent = openRows.length;
  $('complianceOverdueTotal').textContent = overdue;
  $('complianceOnTimeTotal').textContent = onTime;
  $('complianceEffectiveness').textContent = eligibleRows.length ? `${Math.round(onTime / eligibleRows.length * 100)}%` : '—';
  const missingDeadline = state.records.filter(row => ['no_cumple', 'parcial', 'nueva'].includes(row.status) && !row.complianceDueDate).length;
  $('complianceEffectivenessHint').textContent = eligibleRows.length ? `${eligibleRows.length} hallazgos evaluables · ${missingDeadline} abiertos sin plazo` : `${missingDeadline} abiertos sin plazo registrado`;
  $('compliancePendingCount').textContent = `${openRows.length} ${openRows.length === 1 ? 'observación' : 'observaciones'}`;

  const departments = new Map();
  for (const row of eligibleRows) {
    const owners = rowDepartments(row);
    const assigned = owners.length ? owners : [{ key: 'SIN_DEPARTAMENTO_ASIGNADO', name: 'Sin departamento asignado' }];
    const result = complianceResult(row, today);
    for (const owner of assigned) {
      if (!departments.has(owner.key)) departments.set(owner.key, { name: departmentTitle(owner.name), scheduled: 0, onTime: 0, open: 0, overdue: 0, late: 0, delayDays: 0 });
      const summary = departments.get(owner.key);
      summary.scheduled++;
      if (result.kind === 'a_tiempo') summary.onTime++;
      else if (result.kind === 'abierto' || result.kind === 'vence_hoy') summary.open++;
      else if (result.kind === 'vencido') { summary.overdue++; summary.delayDays += result.days; }
      else if (result.kind === 'tarde') summary.late++;
    }
  }
  const orderedDepartments = [...departments.values()].sort((a, b) => b.overdue - a.overdue || b.delayDays - a.delayDays || a.name.localeCompare(b.name, 'es'));
  const selectedCell = key => state.complianceFilter === key ? ' class="compliance-filter-selected"' : '';
  $('complianceDepartmentBody').innerHTML = orderedDepartments.map(item => `<tr><td><strong>${escapeHtml(item.name)}</strong></td><td${selectedCell('con_plazo')}>${item.scheduled}</td><td${selectedCell('a_tiempo')}>${item.onTime}</td><td${selectedCell('abierto')}>${item.open}</td><td class="${item.overdue ? 'deadline-overdue ' : ''}${state.complianceFilter === 'vencido' ? 'compliance-filter-selected' : ''}">${item.overdue}</td><td${selectedCell('tarde')}>${item.late}</td><td class="${item.delayDays ? 'deadline-overdue ' : ''}${state.complianceFilter === 'retraso' ? 'compliance-filter-selected' : ''}">${item.delayDays}</td><td><strong>${Math.round(item.onTime / item.scheduled * 100)}%</strong></td></tr>`).join('');
  $('complianceDepartmentEmpty').hidden = orderedDepartments.length > 0;
  const filter = state.complianceFilter;
  const followupRows = filter ? complianceRowsForFilter(filter, today) : openRows;
  $('compliancePendingEyebrow').textContent = filter ? 'RESULTADOS DEL INDICADOR' : 'SEGUIMIENTO ACTIVO';
  $('compliancePendingTitle').textContent = filter ? `Hallazgos: ${COMPLIANCE_FILTER_LABELS[filter]}` : 'Observaciones pendientes y vencimientos';
  $('compliancePendingCount').textContent = `${followupRows.length} ${followupRows.length === 1 ? 'hallazgo' : 'hallazgos'}`;
  $('clearComplianceFilter').hidden = !filter;
  document.querySelectorAll('[data-compliance-filter]').forEach(button => {
    const active = button.dataset.complianceFilter === filter;
    button.setAttribute('aria-pressed', String(active));
    button.closest('th')?.classList.toggle('is-selected', active);
  });
  $('compliancePendingBody').innerHTML = followupRows.map(row => {
    const result = complianceResult(row, today);
    const deadlineText = result.kind === 'sin_plazo' ? 'Sin plazo asignado' : result.kind === 'vencido'
      ? `${result.days} ${result.days === 1 ? 'día' : 'días'} de retraso`
      : result.kind === 'vence_hoy' ? 'Vence hoy'
        : result.kind === 'a_tiempo' ? 'Cumplido a tiempo'
          : result.kind === 'tarde' ? `Cumplido ${result.days} ${result.days === 1 ? 'día' : 'días'} tarde`
            : result.kind === 'abierto' ? `Quedan ${result.days} ${result.days === 1 ? 'día' : 'días'}` : '—';
    const linked = state.records.find(item => item.id === row.reincidenceOf);
    return `<tr><td>${escapeHtml(rowDepartments(row).map(item => departmentTitle(item.name)).join(' + ') || 'Sin departamento asignado')}</td><td><span class="finding-title">${escapeHtml(row.description)}</span><span class="table-secondary">${escapeHtml(row.inspectionNumber || inspectionNumber(row.inspectedAt))}</span></td><td>${escapeHtml(areaTitle(row.area))}<span class="table-secondary">${escapeHtml(row.location)}</span></td><td>${row.complianceDueDate ? escapeHtml(dateLabel(row.complianceDueDate)) : '—'}</td><td class="${result.kind === 'vencido' ? 'deadline-overdue' : result.kind === 'vence_hoy' ? 'deadline-today' : result.kind === 'sin_plazo' ? 'deadline-missing' : 'deadline-safe'}">${deadlineText}</td><td><span class="status-pill status-${escapeHtml(row.status)}">${escapeHtml(STATUS[row.status])}</span></td><td>${linked ? `<strong class="recurrence-badge">Reincidencia</strong><span class="table-secondary">Desde ${escapeHtml(linked.inspectionNumber || inspectionNumber(linked.inspectedAt))}</span>` : '—'}</td><td><button class="button secondary compliance-edit-button" data-edit="${escapeHtml(row.id)}" type="button" aria-label="Editar observación">Editar</button></td></tr>`;
  }).join('');
  $('compliancePendingEmpty').textContent = filter ? `No hay hallazgos para “${COMPLIANCE_FILTER_LABELS[filter]}”.` : 'No hay observaciones abiertas. Los registros sin plazo aparecerán aquí como “Sin plazo”.';
  $('compliancePendingEmpty').hidden = followupRows.length > 0;
}

function renderPivotTable() {
  const { status, area, departmentKey } = state.pivotFilter;
  const rows = state.records.filter(row => (!status || row.status === status) && (!area || row.area === area));
  const totals = new Map();
  for (const row of rows) {
    const registrant = String(row.inspectorName || row.createdByName || 'Sin nombre registrado').trim() || 'Sin nombre registrado';
    const group = responsibleDepartmentGroup(row);
    if (departmentKey && group.key !== departmentKey) continue;
    const groupKey = `${group.key}\u0000${registrant.toLocaleLowerCase('es')}`;
    if (!totals.has(groupKey)) totals.set(groupKey, { key: group.key, name: group.name, registrant, total: 0, statuses: Object.fromEntries(Object.keys(STATUS).map(key => [key, 0])) });
    const item = totals.get(groupKey);
    item.total++;
    if (item.statuses[row.status] !== undefined) item.statuses[row.status]++;
  }
  const departments = [...totals.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'));
  const active = !!(status || area || departmentKey);
  $('pivotAreaBadge').hidden = !area;
  $('pivotAreaBadge').textContent = area ? `Área: ${areaTitle(area)}` : '';
  const parts = [status && `Estado: ${STATUS[status]}`, departmentKey && `Departamento: ${departmentTitle(departments[0]?.name || departmentKey)}`].filter(Boolean);
  const visibleCount = departmentKey ? rows.filter(row => responsibleDepartmentGroup(row).key === departmentKey).length : rows.length;
  const countLabel = `${visibleCount} ${visibleCount === 1 ? 'hallazgo' : 'hallazgos'}`;
  $('pivotCaption').textContent = parts.length ? `${parts.join(' · ')} · ${countLabel}` : active ? countLabel : `Todos los estados y todas las áreas · ${countLabel}`;
  $('clearPivotFilter').hidden = !active;
  $('pivotTableHead').innerHTML = status
    ? `<tr><th>DEPARTAMENTO(S) RESPONSABLE(S)</th><th>${escapeHtml(STATUS[status].toLocaleUpperCase('es'))}</th><th>REGISTRÓ</th></tr>`
    : '<tr><th>DEPARTAMENTO(S) RESPONSABLE(S)</th><th>HALLAZGOS / OBSERVACIONES</th><th>CERRADO</th><th>ABIERTO</th><th>EN CURSO</th><th>NUEVA OBSERVACIÓN</th><th>REGISTRÓ</th></tr>';
  $('pivotTableBody').innerHTML = departments.map(item => {
    const department = `<button class="pivot-department-filter" data-pivot-department="${escapeHtml(item.key)}" type="button" aria-pressed="${departmentKey === item.key}">${escapeHtml(departmentTitle(item.name))}</button>`;
    return status
      ? `<tr class="pivot-department-row${departmentKey === item.key ? ' is-active' : ''}"><td>${department}</td><td><strong>${item.statuses[status]}</strong></td><td>${escapeHtml(item.registrant)}</td></tr>`
      : `<tr class="pivot-department-row${departmentKey === item.key ? ' is-active' : ''}"><td>${department}</td><td><strong>${item.total}</strong></td><td>${item.statuses.cumple}</td><td>${item.statuses.no_cumple}</td><td>${item.statuses.parcial}</td><td>${item.statuses.nueva}</td><td>${escapeHtml(item.registrant)}</td></tr>`;
  }).join('');
  $('pivotEmpty').hidden = departments.length > 0;
}

function setPivotStatus(status, area = '') {
  const current = state.pivotFilter;
  state.pivotFilter = current.status === status && current.area === area && !current.departmentKey
    ? { status: '', area: '', departmentKey: '' }
    : { status, area, departmentKey: '' };
  renderDashboard();
}

function statusAtDonutPoint(event) {
  const rect = $('statusDonut').getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2), dy = event.clientY - (rect.top + rect.height / 2);
  if (Math.hypot(dx, dy) < Math.min(rect.width, rect.height) * .36) return;
  const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
  const keys = Object.keys(STATUS), counts = Object.fromEntries(keys.map(key => [key, state.records.filter(row => row.status === key).length]));
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (!total) return;
  let cursor = 0;
  for (const key of keys) {
    cursor += counts[key] / total * 360;
    if (angle < cursor) { setPivotStatus(key); return; }
  }
}

function areaTitle(area) { return area === 'SILO DE HIELO' ? 'Silo de hielo' : area ? area[0] + area.slice(1).toLowerCase() : ''; }

async function verifyRole(user) {
  const { db, doc, getDoc } = firebaseApi;
  try {
    const adminSnapshot = await getDoc(doc(db, 'expalsa_calidad_config', 'administrador'));
    if (adminSnapshot.exists()) {
      const admin = adminSnapshot.data();
      if (admin.uid === user.uid && String(admin.email).toLowerCase() === String(user.email).toLowerCase()) return 'admin';
    }
  } catch (error) {
    if (error?.code !== 'permission-denied') throw error;
  }
  const accessSnapshot = await getDoc(doc(db, 'expalsa_calidad_accesos', user.uid));
  if (accessSnapshot.exists()) {
    const access = accessSnapshot.data();
    if (access.active === true && access.deleted !== true && String(access.email).toLowerCase() === String(user.email).toLowerCase()) {
      return ['fabio@expalsaevaluations.com', 'karina@expalsaevaluations.com'].includes(String(user.email).toLowerCase()) ? 'admin' : 'inspector';
    }
  }
  throw new Error('La cuenta requiere aprobación del administrador de EXPALSA Calidad.');
}

function startRecordsListener() {
  const { db, collection, onSnapshot } = firebaseApi;
  if (state.unsubscribe) state.unsubscribe();
  const stops = [];
  const listen = (name, onData) => stops.push(onSnapshot(collection(db, name), snapshot => {
    onData(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
    setConnection(true, 'Datos sincronizados con Firebase');
    $('updatedAtLabel').textContent = `Actualizado ${new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`;
    scheduleRender();
  }, error => { setConnection(false, 'Sin acceso a los datos'); showToast(friendlyError(error), true); }));
  listen(COLLECTION, rows => { state.records = rows.sort((a, b) => (b.inspectedAt || '').localeCompare(a.inspectedAt || '')); });
  listen(RUNS, rows => { state.inspectionRuns = rows.sort((a, b) => (b.inspectedAt || '').localeCompare(a.inspectedAt || '')); });
  listen(CORRECTIONS, rows => { state.corrections = rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); });
  listen(PROGRESS, rows => { state.progress = Object.fromEntries(rows.map(row => [`${row.inspectionId}:${row.area}`, row])); });
  state.unsubscribe = () => stops.forEach(stop => stop());
}

let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}

function startApp(user, role) {
  state.user = user; state.role = role; state.demo = false; state.pivotFilter = { status: '', area: '', departmentKey: '' };
  $('userEmail').textContent = userLabel(user);
  $('userInitial').textContent = (user.email || 'I').charAt(0).toUpperCase();
  $('resetDemoButton').hidden = true;
  $('logoutButton').textContent = 'Salir';
  $('authGate').hidden = true; $('appShell').hidden = false;
  startRecordsListener();
}

async function loadDemoRecords() {
  if (!demoRecordsPromise) {
    demoRecordsPromise = fetch('demo-inspection-full.json').then(response => {
      if (!response.ok) throw new Error('No se pudo cargar el ejemplo de inspección.');
      return response.json();
    }).then(rows => {
      if (!Array.isArray(rows) || rows.length !== 158) throw new Error('El archivo de ejemplo está incompleto.');
      return rows.map(row => ({ ...row, importance: row.importance || inferImportance(row), complianceDueDate: row.complianceDueDate || defaultComplianceDueDate(row.status, row.notificationDate || row.inspectedAt) }));
    }).catch(error => { demoRecordsPromise = null; throw error; });
  }
  const rows = await demoRecordsPromise;
  return rows.map(row => ({ ...row, photos: (row.photos || []).map(photo => ({ ...photo })) }));
}

async function enterDemo() {
  const button = $('demoButton');
  button.disabled = true; button.textContent = 'Cargando ejemplo…';
  try {
    const records = await loadDemoRecords();
    if (state.unsubscribe) state.unsubscribe(); state.unsubscribe = null;
    const demoRun = { id: 'demo-run-20260912', inspectionNumber: 'INS-20260912-DEMO', inspectedAt: '2026-09-12', status: 'terminada', openedByName: 'Anthony Cobos y Michelle Loor', openedByEmail: 'calidad@expalsa.local', participants: ['Anthony Cobos', 'Michelle Loor'] };
    state.user = { uid: 'demo-local', email: 'ejemplo@expalsa.local', displayName: 'Ejemplo local' };
    state.role = 'demo'; state.demo = true; state.tab = 'Inicio'; state.selectedInspectionDate = null; state.selectedInspectionId = null; state.pivotFilter = { status: '', area: '', departmentKey: '' };
    state.activeInspectionId = null; state.activeInspectionNumber = null; state.inspectionRuns = [demoRun]; state.corrections = []; state.progress = {};
    state.records = records.map(row => ({ ...row, inspectionId: demoRun.id, inspectionNumber: demoRun.inspectionNumber }));
    $('userEmail').textContent = 'Modo ejemplo'; $('userInitial').textContent = 'E';
    $('updatedAtLabel').textContent = 'Ejemplo local · 158 hallazgos · no se guarda en Firebase';
    $('authGate').hidden = true; $('appShell').hidden = false;
    $('resetDemoButton').hidden = false; $('logoutButton').textContent = 'Salir del ejemplo';
    setConnection(true, 'Ejemplo local · sin Firebase'); render();
  } catch (error) {
    $('authMessage').textContent = error.message || 'No se pudo cargar el ejemplo.'; $('authMessage').classList.add('error');
  } finally {
    button.disabled = false; button.textContent = 'Cargar ejemplo de inspección';
  }
}

async function resetDemo() {
  if (!state.demo) return;
  try {
    const records = await loadDemoRecords(); state.tab = 'Inicio'; state.selectedInspectionDate = null; state.selectedInspectionId = null; state.activeInspectionId = null; state.activeInspectionNumber = null; state.corrections = []; state.progress = {}; state.pivotFilter = { status: '', area: '', departmentKey: '' };
    state.inspectionRuns = [{ id: 'demo-run-20260912', inspectionNumber: 'INS-20260912-DEMO', inspectedAt: '2026-09-12', status: 'terminada', openedByName: 'Anthony Cobos y Michelle Loor', openedByEmail: 'calidad@expalsa.local', participants: ['Anthony Cobos', 'Michelle Loor'] }];
    state.records = records.map(row => ({ ...row, inspectionId: state.inspectionRuns[0].id, inspectionNumber: state.inspectionRuns[0].inspectionNumber }));
    $('quickSearch').value = '';
    for (const id of ['filterStatus', 'filterDepartment', 'filterFrom', 'filterTo']) $(id).value = '';
    $('filterOrder').value = 'desc'; render(); showToast('Ejemplo completo recargado.');
  } catch (error) { showToast(error.message || 'No se pudo recargar el ejemplo.', true); }
}

async function createInspection(area = 'PLANTA', openForm = false) {
  const inspectedAt = new Date().toLocaleDateString('en-CA');
  const name = userLabel();
  if (state.demo) {
    const id = `demo-run-${crypto.randomUUID()}`;
    const run = { id, inspectionNumber: `INS-${inspectedAt.replace(/\D/g, '')}-${id.slice(-4).toUpperCase()}`, inspectedAt, status: 'en_curso', openedByUid: state.user.uid, openedByEmail: state.user.email, openedByName: name, participants: [name] };
    state.inspectionRuns.unshift(run); state.activeInspectionId = id; state.activeInspectionNumber = run.inspectionNumber;
  } else {
    const { db, doc, collection, setDoc, serverTimestamp } = firebaseApi;
    const runRef = doc(collection(db, RUNS));
    const inspectionNo = `INS-${inspectedAt.replace(/\D/g, '')}-${runRef.id.slice(0, 5).toUpperCase()}`;
    const run = { inspectionNumber: inspectionNo, inspectedAt, status: 'en_curso', openedByUid: state.user.uid, openedByEmail: state.user.email, openedByName: name, participants: [name], createdBy: state.user.uid, createdAt: serverTimestamp(), updatedBy: state.user.uid, updatedByName: name, updatedAt: serverTimestamp() };
    await setDoc(runRef, run);
    state.inspectionRuns.unshift({ id: runRef.id, ...run, inspectionNumber: inspectionNo });
    state.activeInspectionId = runRef.id; state.activeInspectionNumber = inspectionNo;
  }
  state.tab = area; state.selectedInspectionId = null; state.selectedInspectionDate = null; render();
  if (openForm) openNewDialog(area);
  else showToast(`Inspección ${state.activeInspectionNumber} iniciada.`);
}

async function closeInspection() {
  const run = state.inspectionRuns.find(item => item.id === state.activeInspectionId);
  if (!run || run.status !== 'en_curso') return;
  try {
    const name = userLabel();
    if (state.demo) run.status = 'terminada';
    else {
      const { db, doc, updateDoc, serverTimestamp } = firebaseApi;
      await updateDoc(doc(db, RUNS, run.id), { status: 'terminada', closedAt: serverTimestamp(), closedByUid: state.user.uid, closedByName: name, updatedAt: serverTimestamp(), updatedBy: state.user.uid, updatedByName: name, participants: firebaseApi.arrayUnion(name) });
      run.status = 'terminada';
    }
    state.activeInspectionId = null; state.activeInspectionNumber = null; state.selectedInspectionId = null; state.selectedInspectionDate = null; state.tab = 'Inicio'; render(); showToast(`Inspección ${inspectionNumber(run)} terminada.`);
  } catch (error) { showToast(friendlyError(error), true); }
}

async function saveAreaProgress() {
  const run = state.inspectionRuns.find(item => item.id === state.activeInspectionId);
  if (!run || run.status !== 'en_curso') { showToast('Abre una inspección en curso para guardar esta pestaña.', true); return; }
  const area = state.tab, name = userLabel();
  try {
    if (state.demo) state.progress[`${run.id}:${area}`] = { inspectionId: run.id, area, savedByName: name, savedAt: new Date() };
    else {
      const { db, doc, setDoc, serverTimestamp } = firebaseApi;
      const ref = doc(db, PROGRESS, `${run.id}_${area.replaceAll(' ', '-')}`);
      await setDoc(ref, { inspectionId: run.id, inspectionNumber: run.inspectionNumber, area, savedByUid: state.user.uid, savedByEmail: state.user.email, savedByName: name, savedAt: serverTimestamp() });
      state.progress[`${run.id}:${area}`] = { inspectionId: run.id, area, savedByName: name, savedAt: new Date() };
    }
    render(); showToast(`${areaTitle(area)} guardada. Las observaciones quedan asociadas a ${run.inspectionNumber}.`);
  } catch (error) { showToast(friendlyError(error), true); }
}

function exitDemo() {
  state.demo = false; state.user = null; state.records = []; state.inspectionRuns = []; state.corrections = []; state.progress = {}; state.activeInspectionId = null; state.activeInspectionNumber = null; state.selectedInspectionId = null; state.tab = 'Inicio'; state.pivotFilter = { status: '', area: '', departmentKey: '' };
  $('appShell').hidden = true; $('authGate').hidden = false;
  $('resetDemoButton').hidden = true; $('logoutButton').textContent = 'Salir';
  setConnection(false, 'Conexión pendiente');
}

async function fileAsJpeg(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1680 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  let quality = 0.82;
  let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  while (blob && blob.size > 1_350_000 && quality > 0.5) {
    quality -= 0.08;
    blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  }
  if (!blob) throw new Error('No se pudo procesar la foto.');
  if (blob.size > 1_450_000) throw new Error('La foto supera el límite de almacenamiento. Elige una imagen más pequeña.');
  return blob;
}

function dataUrl(blob) {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
}

async function whiteTransparentLogo() {
  const response = await fetch('logoexpalsa.png');
  if (!response.ok) throw new Error('No se pudo cargar el logo EXPALSA.');
  const image = await createImageBitmap(await response.blob());
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    if (pixels.data[index + 3] > 0) pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = 255;
  }
  context.putImageData(pixels, 0, 0); image.close();
  return canvas.toDataURL('image/png');
}

function loadPdfLibraries() {
  if (globalThis.jspdf?.jsPDF?.API?.autoTable) return Promise.resolve();
  if (!pdfLibrariesPromise) {
    pdfLibrariesPromise = new Promise((resolve, reject) => {
      const load = (src, next) => {
        const script = document.createElement('script'); script.src = src; script.async = true;
        script.onload = next; script.onerror = () => reject(new Error('No se pudo cargar el módulo PDF. Revisa tu conexión e inténtalo de nuevo.'));
        document.head.append(script);
      };
      load('https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js', () => load('https://cdn.jsdelivr.net/npm/jspdf-autotable@5.0.8/dist/jspdf.plugin.autotable.min.js', () => {
        globalThis.jspdf?.jsPDF?.API?.autoTable ? resolve() : reject(new Error('No se pudo iniciar el módulo PDF.'));
      }));
    }).catch(error => { pdfLibrariesPromise = null; throw error; });
  }
  return pdfLibrariesPromise;
}

function loadXlsxLibrary() {
  if (globalThis.XLSX?.writeFile) return Promise.resolve(globalThis.XLSX);
  if (!xlsxLibraryPromise) {
    xlsxLibraryPromise = import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs')
      .catch(error => { xlsxLibraryPromise = null; throw new Error(`No se pudo cargar el módulo Excel: ${friendlyError(error)}`); });
  }
  return xlsxLibraryPromise;
}

function loadInspectionModules() {
  if (firebaseApi?.db && firebaseApi?.storage) return Promise.resolve();
  if (!inspectionModulesPromise) {
    const V = '13.0.0';
    inspectionModulesPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-storage.js`)
    ]).then(([dbModule, storageModule]) => {
      const db = dbModule.getFirestore(firebaseApi.app), storage = storageModule.getStorage(firebaseApi.app);
      Object.assign(firebaseApi, dbModule, storageModule, { db, storage });
    }).catch(error => { inspectionModulesPromise = null; throw error; });
  }
  return inspectionModulesPromise;
}

function drawPhotoPreview() {
  const preview = $('photoPreview');
  preview.innerHTML = [...state.editingPhotos.map(photo => ({ ...photo, existing: true })), ...state.pendingPhotos].map((photo, index) => `<div class="photo-thumb"><img src="${escapeHtml(photo.preview || photo.previewUrl)}" alt="Evidencia ${index + 1}">${photo.existing ? '' : `<button type="button" data-remove-photo="${index - state.editingPhotos.length}" aria-label="Quitar foto">×</button>`}</div>`).join('');
}

function canManagePhoto(row, photo) {
  const run = state.inspectionRuns.find(item => item.id === row?.inspectionId);
  return !state.demo && run?.status === 'en_curso' && (state.role === 'admin' || photo?.uploadedBy === state.user?.uid);
}

async function openPhotoViewer(rowId, photoIndex = 0) {
  const row = state.records.find(item => item.id === rowId), photos = row?.photos || [];
  if (!row || !photos.length) return;
  const index = Math.max(0, Math.min(Number(photoIndex) || 0, photos.length - 1));
  const token = crypto.randomUUID();
  state.viewingPhoto = { rowId, index, token };
  $('photoViewerImage').removeAttribute('src');
  $('photoViewerImage').style.width = '';
  $('photoDownloadButton').disabled = true;
  $('photoViewerImage').alt = `Evidencia fotográfica de ${row.location}`;
  $('photoViewerCaption').textContent = `${areaTitle(row.area)} · ${row.location} · Foto ${index + 1} de ${photos.length}`;
  $('photoViewerPosition').textContent = `${index + 1} / ${photos.length}`;
  $('photoPrevious').disabled = index === 0;
  $('photoNext').disabled = index >= photos.length - 1;
  const photo = photos[index], editable = canManagePhoto(row, photo);
  $('photoReplaceButton').hidden = !editable;
  $('photoDeleteButton').hidden = !editable;
  $('photoManageHint').textContent = state.demo ? 'Vista de ejemplo; no modifica datos de Firebase.' : editable ? 'La sustitución o eliminación actualiza la evidencia de esta observación.' : 'La evidencia solo puede modificarse en una inspección en curso, por quien la cargó o un administrador.';
  if (!$('photoDialog').open) $('photoDialog').showModal();
  try {
    let source = photo.preview || '';
    if (!source && photo.previewUrl) {
      const response = await fetch(photo.previewUrl);
      if (!response.ok) throw new Error('No se pudo abrir la evidencia de ejemplo.');
      source = await dataUrl(await response.blob());
    }
    if (!source && photo.path) {
      await loadInspectionModules();
      const bytes = await firebaseApi.getBytes(firebaseApi.ref(firebaseApi.storage, photo.path));
      source = await dataUrl(new Blob([bytes], { type: 'image/jpeg' }));
    }
    if (state.viewingPhoto?.token === token) {
      if (!source) throw new Error('La foto no tiene una ruta de evidencia válida.');
      $('photoViewerImage').src = source;
      $('photoViewerImage').onload = () => {
        if (state.viewingPhoto?.token !== token) return;
        $('photoViewerImage').style.width = `${$('photoViewerImage').naturalWidth * 2}px`;
        $('photoDownloadButton').disabled = false;
      };
    }
  } catch (error) {
    $('photoViewerCaption').textContent = friendlyError(error);
  }
}

async function downloadCurrentPhoto() {
  const current = state.viewingPhoto;
  const row = state.records.find(item => item.id === current?.rowId);
  const photo = row?.photos?.[current?.index];
  const image = $('photoViewerImage');
  if (!row || !photo || !image.src) return;
  const button = $('photoDownloadButton');
  button.disabled = true;
  try {
    const response = await fetch(image.src);
    if (!response.ok) throw new Error('No se pudo preparar la descarga de la foto.');
    const blob = await response.blob();
    const extension = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '');
    const fallback = `${row.inspectionNumber || inspectionNumber(row.inspectedAt)}-${row.location || 'evidencia'}-foto-${current.index + 1}`;
    const baseName = String(photo.name || fallback).replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, '-');
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `${baseName}.${extension}`; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { showToast(friendlyError(error), true); }
  finally { button.disabled = false; }
}

async function changeCurrentPhoto(replacement = null) {
  const current = state.viewingPhoto, row = state.records.find(item => item.id === current?.rowId), photo = row?.photos?.[current?.index];
  if (!row || !photo || !canManagePhoto(row, photo)) { showToast('Solo el autor o un administrador puede cambiar esta foto en una inspección en curso.', true); return; }
  const button = replacement ? $('photoReplaceButton') : $('photoDeleteButton');
  button.disabled = true;
  try {
    const { db, doc, updateDoc, serverTimestamp, ref, uploadBytes, deleteObject } = firebaseApi;
    const photos = [...row.photos];
    let replacementPath = '';
    if (replacement) {
      const blob = await fileAsJpeg(replacement), name = replacement.name || 'evidencia.jpg';
      replacementPath = `expalsa_inspecciones/${state.user.uid}/${row.id}/${crypto.randomUUID()}.jpg`;
      await uploadBytes(ref(firebaseApi.storage, replacementPath), blob, { contentType: 'image/jpeg', customMetadata: { origin: 'gallery', uploadedBy: state.user.uid } });
      photos[current.index] = { path: replacementPath, name: name.slice(0, 120), uploadedBy: state.user.uid, origin: 'gallery' };
    } else {
      photos.splice(current.index, 1);
    }
    try {
      await updateDoc(doc(db, COLLECTION, row.id), { photos, updatedBy: state.user.uid, updatedByName: userLabel(), updatedAt: serverTimestamp() });
    } catch (error) {
      if (replacementPath) await deleteObject(ref(firebaseApi.storage, replacementPath)).catch(() => {});
      throw error;
    }
    row.photos = photos; row.updatedBy = state.user.uid; row.updatedByName = userLabel(); row.updatedAt = new Date();
    if (photo.path) await deleteObject(ref(firebaseApi.storage, photo.path)).catch(() => {});
    if (!photos.length) { $('photoDialog').close(); state.viewingPhoto = null; }
    else { state.viewingPhoto.index = Math.min(current.index, photos.length - 1); await openPhotoViewer(row.id, state.viewingPhoto.index); }
    render(); showToast(replacement ? 'Foto reemplazada en Firebase.' : 'Foto eliminada de la evidencia.');
  } catch (error) { showToast(friendlyError(error), true); }
  finally { button.disabled = false; }
}

function stepPhoto(direction) {
  if (!state.viewingPhoto) return;
  openPhotoViewer(state.viewingPhoto.rowId, state.viewingPhoto.index + direction);
}

async function handlePhotoFiles(input) {
  const files = [...(input.files || [])]; input.value = '';
  if (!files.length) return;
  const available = 6 - state.editingPhotos.length - state.pendingPhotos.length;
  for (const file of files.slice(0, Math.max(0, available))) {
    if (!file.type.startsWith('image/')) continue;
    try { const blob = await fileAsJpeg(file); state.pendingPhotos.push({ blob, preview: await dataUrl(blob), origin: input.id === 'cameraInput' ? 'camera' : 'gallery', name: file.name || 'evidencia.jpg' }); }
    catch (error) { showToast(friendlyError(error), true); }
  }
  if (files.length > available) showToast('Cada observación admite hasta 6 fotos.');
  drawPhotoPreview();
}

function drawCorrectionPhotoPreview() {
  $('correctionPhotoPreview').innerHTML = state.correctionPhotos.map((photo, index) => `<div class="photo-thumb"><img src="${escapeHtml(photo.preview)}" alt="Evidencia de corrección ${index + 1}"><button type="button" data-remove-correction-photo="${index}" aria-label="Quitar foto">×</button></div>`).join('');
}

async function handleCorrectionPhotoFiles(input) {
  const files = [...(input.files || [])]; input.value = '';
  if (!files.length) return;
  const available = 6 - state.correctionPhotos.length;
  for (const file of files.slice(0, Math.max(0, available))) {
    if (!file.type.startsWith('image/')) continue;
    try { const blob = await fileAsJpeg(file); state.correctionPhotos.push({ blob, preview: await dataUrl(blob), origin: input.id === 'correctionCamera' ? 'camera' : 'gallery', name: file.name || 'correccion.jpg' }); }
    catch (error) { showToast(friendlyError(error), true); }
  }
  if (files.length > available) showToast('Cada acción correctiva admite hasta 6 fotos.');
  drawCorrectionPhotoPreview();
}

function openCorrectionDialog(id) {
  const row = state.records.find(item => item.id === id);
  if (!row || !['no_cumple', 'parcial'].includes(row.status)) return;
  state.correctingObservationId = id; state.correctionPhotos = [];
  $('correctionTitle').textContent = `Corregir ${row.inspectionNumber || inspectionNumber(row.inspectedAt)}`;
  $('correctionFinding').textContent = `${areaTitle(row.area)} · ${row.location}: ${row.description}`;
  $('correctionStatus').value = 'cumple';
  $('correctionNote').value = ''; drawCorrectionPhotoPreview(); $('correctionDialog').showModal();
}

async function saveCorrection(event) {
  event.preventDefault();
  const row = state.records.find(item => item.id === state.correctingObservationId);
  const note = $('correctionNote').value.trim(), newStatus = $('correctionStatus').value;
  if (!row || !note) { $('correctionForm').reportValidity(); return; }
  if (!state.correctionPhotos.length) { showToast('Adjunta al menos una foto de la corrección.', true); return; }
  if (newStatus === row.status) { showToast('Selecciona un estado distinto al actual.', true); return; }
  const button = $('saveCorrection'); button.disabled = true; button.textContent = 'Guardando…';
  try {
  const actionId = `local-${crypto.randomUUID()}`, name = userLabel(), date = todayIso();
    const completedAt = newStatus === 'cumple' ? date : '';
    const action = { id: actionId, inspectionId: row.inspectionId || row.id, inspectionNumber: row.inspectionNumber || inspectionNumber(row.inspectedAt), observationId: row.id, area: row.area, location: row.location, description: row.description, previousStatus: row.status, newStatus, note, photos: [], byUid: state.user.uid, byName: name, byEmail: state.user.email, actionDate: date, complianceCompletedAt: completedAt };
    if (state.demo) {
      action.photos = state.correctionPhotos.map(photo => ({ preview: photo.preview, name: photo.name }));
      row.status = newStatus; row.complianceCompletedAt = completedAt; row.lastCorrectionId = actionId; row.updatedByName = name;
      state.corrections.unshift(action);
    } else {
      const { db, doc, collection, ref, uploadBytes, serverTimestamp, runTransaction } = firebaseApi;
      const storageRunId = row.inspectionId || row.id;
      for (const file of state.correctionPhotos) {
        const path = `expalsa_inspecciones/${state.user.uid}/${storageRunId}/${crypto.randomUUID()}.jpg`;
        await uploadBytes(ref(firebaseApi.storage, path), file.blob, { contentType: 'image/jpeg', customMetadata: { origin: file.origin, uploadedBy: state.user.uid } });
        action.photos.push({ path, name: file.name.slice(0, 120), uploadedBy: state.user.uid, origin: file.origin });
      }
      const observationRef = doc(db, COLLECTION, row.id), actionRef = doc(collection(db, CORRECTIONS));
      await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(observationRef);
        if (!snapshot.exists() || !['no_cumple', 'parcial'].includes(snapshot.data().status)) throw new Error('La alerta ya fue actualizada por otro usuario. Recarga e inténtalo de nuevo.');
        const previousStatus = snapshot.data().status;
        if (newStatus === previousStatus) throw new Error('Esta observación ya tiene el estado seleccionado.');
        transaction.update(observationRef, { status: newStatus, lastCorrectionId: actionRef.id, lastCorrectionNote: note, updatedBy: state.user.uid, updatedByName: name, updatedAt: serverTimestamp() });
        transaction.set(actionRef, { observationId: row.id, previousStatus, newStatus, note, photos: action.photos, byUid: state.user.uid, byName: name, createdAt: serverTimestamp() });
      });
    }
    $('correctionDialog').close(); state.correctionPhotos = []; state.correctingObservationId = null; render(); showToast(`Acción correctiva guardada. Estado actualizado a ${STATUS[newStatus]}.`);
  } catch (error) { showToast(friendlyError(error), true); }
  finally { button.disabled = false; button.textContent = 'Guardar corrección'; }
}

function openNewDialog(area = AREAS.includes(state.tab) ? state.tab : 'PLANTA') {
  if (!state.activeInspectionId) {
    if (state.demo) { createInspection(area, true); return; }
    showToast('Inicia una inspección antes de agregar observaciones.', true); return;
  }
  const form = $('inspectionForm'); form.reset(); form.elements.id.value = '';
  form.elements.area.value = area; fillLocationOptions(area); fillDepartment();
  form.elements.complianceDueDate.disabled = false;
  $('complianceDueDateHint').textContent = 'Opcional; necesaria para medir el plazo y la efectividad.';
  $('recurrenceField').hidden = true; updateRecurrenceChoices();
  const run = state.inspectionRuns.find(item => item.id === state.activeInspectionId);
  form.elements.inspectedAt.value = run?.inspectedAt || new Date().toLocaleDateString('en-CA'); form.elements.inspectedAt.disabled = true; form.elements.status.value = 'nueva'; form.elements.status.disabled = false;
  form.elements.importance.value = 'media';
  form.elements.complianceDueDate.dataset.autoDefault = 'true'; updateDefaultDeadline(true);
  state.pendingPhotos = []; state.editingPhotos = [];
  $('dialogTitle').textContent = 'Nueva observación'; $('saveInspection').textContent = 'Guardar observación';
  $('saveHint').textContent = `Inspección ${state.activeInspectionNumber || inspectionNumber(run)} · registra ${userLabel()}`;
  drawPhotoPreview(); $('inspectionDialog').showModal();
}

async function openEditDialog(id) {
  const row = state.records.find(item => item.id === id); if (!row) return;
  if (row.status === 'no_cumple' || row.status === 'parcial') { openCorrectionDialog(id); return; }
  const run = state.inspectionRuns.find(item => item.id === row.inspectionId);
  if (!state.demo && (!row.inspectionId || row.inspectionId !== state.activeInspectionId || run?.status !== 'en_curso')) { showToast('Las inspecciones terminadas se pueden consultar, pero no editar.', true); return; }
  const form = $('inspectionForm'); form.reset(); form.elements.id.value = row.id;
  for (const key of ['area', 'inspectedAt', 'description', 'notificationDate', 'complianceDueDate', 'status', 'notes']) form.elements[key].value = row[key] || '';
  form.elements.importance.value = importanceOf(row);
  form.elements.complianceDueDate.disabled = true;
  $('complianceDueDateHint').textContent = 'La fecha límite queda fijada al registrar el hallazgo.';
  $('recurrenceField').hidden = true;
  form.elements.inspectedAt.disabled = true; form.elements.status.disabled = true;
  fillLocationOptions(row.area, row.location); fillDepartment(row.department);
  state.pendingPhotos = []; state.editingPhotos = (row.photos || []).map(photo => ({ ...photo }));
  $('dialogTitle').textContent = 'Editar observación'; $('saveInspection').textContent = 'Guardar cambios';
  $('saveHint').textContent = `Registró ${row.inspectorName || row.inspectorEmail || 'inspector'} · edita ${userLabel()}`;
  drawPhotoPreview(); $('inspectionDialog').showModal();
  for (const [i, photo] of state.editingPhotos.entries()) {
    if (state.demo || photo.preview) continue;
    try { const bytes = await firebaseApi.getBytes(firebaseApi.ref(firebaseApi.storage, photo.path)); photo.preview = await dataUrl(new Blob([bytes], { type: 'image/jpeg' })); }
    catch { photo.preview = ''; }
    const image = $('photoPreview').querySelectorAll('img')[i]; if (image) image.src = photo.preview || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="67" height="56"%3E%3Crect width="100%25" height="100%25" fill="%23edf1f4"/%3E%3C/svg%3E';
  }
}

async function saveInspection(event) {
  event.preventDefault();
  const form = $('inspectionForm'); if (!form.reportValidity()) return;
  const saveButton = $('saveInspection'); saveButton.disabled = true; saveButton.textContent = 'Guardando…';
  try {
    const fields = {
      area: form.elements.area.value, inspectedAt: form.elements.inspectedAt.value,
      location: formValue(form, 'location', 'locationOther'), description: form.elements.description.value.trim(),
      importance: form.elements.importance.value,
      department: formValue(form, 'department', 'departmentOther'), notificationDate: form.elements.notificationDate.value,
      complianceDueDate: form.elements.complianceDueDate.value, reincidenceOf: form.elements.reincidenceOf.value,
      status: form.elements.status.value, notes: form.elements.notes.value.trim()
    };
    const id = form.elements.id.value || (state.demo ? `demo-${crypto.randomUUID()}` : firebaseApi.doc(firebaseApi.collection(firebaseApi.db, COLLECTION)).id);
    const current = state.records.find(item => item.id === id);
    fields.reincidenceOf = current?.reincidenceOf || fields.reincidenceOf;
    const run = state.inspectionRuns.find(item => item.id === (current?.inspectionId || state.activeInspectionId));
    if (!state.demo && (!run || run.status !== 'en_curso')) throw new Error('Guarda las observaciones dentro de una inspección en curso.');
    if (fields.complianceDueDate && fields.complianceDueDate < fields.inspectedAt) throw new Error('La fecha límite no puede ser anterior a la fecha de inspección.');
    if (!state.demo && !current && state.records.some(row => row.inspectionId === run.id && row.area === fields.area && normalizeLocation(row.location) === normalizeLocation(fields.location))) {
      fillLocationOptions(fields.area);
      throw new Error('Esa ubicación o proceso ya tiene una observación registrada. Selecciona una ubicación disponible.');
    }
    if (run?.inspectedAt) fields.inspectedAt = run.inspectedAt;
    if (state.demo) {
      const photos = [...state.editingPhotos, ...state.pendingPhotos.map(photo => ({ preview: photo.preview, name: photo.name, origin: photo.origin }))];
      const run = state.inspectionRuns.find(item => item.id === (current?.inspectionId || state.activeInspectionId));
      const record = { ...current, ...fields, complianceCompletedAt: current?.complianceCompletedAt || (fields.status === 'cumple' ? fields.inspectedAt : ''), id, inspectionId: run?.id || current?.inspectionId, inspectionNumber: run?.inspectionNumber || current?.inspectionNumber, photos, source: current?.source || 'app', inspectorName: current?.inspectorName || userLabel(), inspectorEmail: current?.inspectorEmail || state.user.email, inspectorUid: current?.inspectorUid || state.user.uid, createdByName: current?.createdByName || userLabel(), updatedByName: userLabel() };
      const index = state.records.findIndex(item => item.id === id);
      if (index >= 0) state.records[index] = record; else state.records.unshift(record);
      $('inspectionDialog').close(); state.pendingPhotos = []; render(); showToast('Observación guardada en el ejemplo local.');
      return;
    }
    const { db, doc, collection, setDoc, updateDoc, serverTimestamp, ref, uploadBytes, arrayUnion } = firebaseApi;
    const photos = [...state.editingPhotos];
    for (const file of state.pendingPhotos) {
      const path = `expalsa_inspecciones/${state.user.uid}/${id}/${crypto.randomUUID()}.jpg`;
      await uploadBytes(ref(firebaseApi.storage, path), file.blob, { contentType: 'image/jpeg', customMetadata: { origin: file.origin, uploadedBy: state.user.uid } });
      photos.push({ path, name: file.name.slice(0, 120), uploadedBy: state.user.uid, origin: file.origin });
    }
    const { complianceDueDate, reincidenceOf, ...inspectionFields } = fields;
    const payload = {
      ...inspectionFields, inspectionId: current?.inspectionId || run.id, inspectionNumber: current?.inspectionNumber || run.inspectionNumber,
      photos, inspectorName: current?.inspectorName || userLabel(),
      inspectorEmail: current?.inspectorEmail || state.user.email, inspectorUid: current?.inspectorUid || state.user.uid,
      createdBy: current?.createdBy || state.user.uid, createdAt: current?.createdAt || serverTimestamp(),
      updatedBy: state.user.uid, updatedByName: userLabel(), updatedAt: serverTimestamp(),
      source: current?.source || 'app'
    };
    if (!current) { payload.complianceDueDate = complianceDueDate; payload.reincidenceOf = reincidenceOf || ''; }
    await setDoc(doc(db, COLLECTION, id), payload, { merge: true });
    await updateDoc(doc(db, RUNS, run.id), { participants: arrayUnion(userLabel()), updatedBy: state.user.uid, updatedByName: userLabel(), updatedAt: serverTimestamp() });
    $('inspectionDialog').close(); showToast(current ? 'La observación fue actualizada.' : 'Observación guardada en Firebase.');
  } catch (error) { showToast(friendlyError(error), true); }
  finally { saveButton.disabled = false; saveButton.textContent = form.elements.id.value ? 'Guardar cambios' : 'Guardar observación'; }
}

function exportRowsForCurrentView() {
  const selectedRun = state.tab === 'Historial' ? state.inspectionRuns.find(run => run.id === state.selectedInspectionId) : null;
  return state.tab === 'Cumplimientos'
    ? state.records.filter(row => ['no_cumple', 'parcial'].includes(row.status))
    : state.tab === 'Inicio' || state.tab === 'General'
    ? [...state.records].sort((a, b) => (b.inspectedAt || '').localeCompare(a.inspectedAt || ''))
    : state.tab === 'Historial' && selectedRun
      ? recordsForView().filter(row => row.inspectionId === selectedRun.id)
      : state.tab === 'Historial' && state.selectedInspectionDate !== null
        ? recordsForView().filter(row => (row.inspectedAt || '') === state.selectedInspectionDate)
      : recordsForView();
}

function exportTitleForCurrentView() {
  const selectedRun = state.tab === 'Historial' ? state.inspectionRuns.find(run => run.id === state.selectedInspectionId) : null;
  const sectionTitle = getSections().find(section => section.id === state.tab)?.title || 'Reporte de inspección';
  return state.tab === 'Inicio' ? 'Inspección completa' : selectedRun ? inspectionNumber(selectedRun) : state.tab === 'Historial' && state.selectedInspectionDate !== null ? inspectionNumber(state.selectedInspectionDate) : state.tab === 'Historial' ? 'Historial de inspecciones' : state.tab === 'General' ? 'Reporte general de inspección' : sectionTitle;
}

function exportSlug() {
  return state.tab.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function exportExcel() {
  const rows = exportRowsForCurrentView();
  if (!rows.length) { showToast('No hay observaciones para exportar.'); return; }
  const button = $('exportExcelButton'); button.disabled = true;
  try {
    const XLSX = await loadXlsxLibrary();
    const data = rows.map(row => ({
      'N.º de inspección': row.inspectionNumber || inspectionNumber(row.inspectedAt),
      'Fecha de inspección': row.inspectedAt || '',
      Área: areaTitle(row.area),
      'Sección de origen': row.sourceSection || '',
      Ubicación: row.location || '',
      'Hallazgo / observación': row.description || '',
      'Importancia': importanceLabel(importanceOf(row)),
      'Departamento responsable': row.department || '',
      'Registró': row.inspectorName || row.createdByName || '',
      'Fecha de notificación': row.notificationDateSource || row.notificationDate || '',
      'Fecha límite de cumplimiento': row.complianceDueDate || '',
      'Estado del plazo': row.complianceDueDate ? complianceResult(row).kind : 'Sin plazo',
      'Días de retraso': row.complianceDueDate && complianceResult(row).kind === 'vencido' ? complianceResult(row).days : 0,
      'Reincidencia vinculada': row.reincidenceOf ? 'Sí' : 'No',
      'Días abiertos': daysOpen(row),
      Estado: STATUS[row.status] || 'Sin estado',
      'Acción / comentarios': row.notes || '',
      Evidencias: (row.photos || []).length
    }));
    const sheet = XLSX.utils.json_to_sheet(data);
    sheet['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 35 }, { wch: 70 }, { wch: 14 }, { wch: 30 }, { wch: 24 }, { wch: 20 }, { wch: 24 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 60 }, { wch: 14 }];
    if (sheet['!ref']) sheet['!autofilter'] = { ref: sheet['!ref'] };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Hallazgos');
    workbook.Props = { Title: exportTitleForCurrentView(), Subject: 'Inspección de instalaciones EXPALSA', Author: 'EXPALSA' };
    XLSX.writeFile(workbook, `reporte-inspeccion-${exportSlug()}-${new Date().toLocaleDateString('en-CA')}.xlsx`, { bookType: 'xlsx', compression: true });
    showToast('Archivo Excel descargado.');
  } catch (error) { showToast(`No se pudo generar el archivo Excel: ${friendlyError(error)}`, true); }
  finally { button.disabled = false; }
}

async function exportPdf() {
  const rows = exportRowsForCurrentView();
  if (!rows.length) { showToast('No hay observaciones para exportar.'); return; }
  const selectedRun = state.tab === 'Historial' ? state.inspectionRuns.find(run => run.id === state.selectedInspectionId) : null;
  const button = $('exportButton'); button.disabled = true;
  try {
    await loadPdfLibraries();
    const Pdf = globalThis.jspdf?.jsPDF;
    if (!Pdf || !Pdf.API.autoTable) throw new Error('No se pudo cargar el módulo PDF.');
    const pdf = new Pdf({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const title = exportTitleForCurrentView();
    const generated = new Date().toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
    const inspectionDates = rows.map(row => row.inspectedAt).filter(Boolean).sort();
    const dateRange = inspectionDates.length > 1 && inspectionDates[0] !== inspectionDates.at(-1)
      ? `${dateLabel(inspectionDates[0])} – ${dateLabel(inspectionDates.at(-1))}`
      : inspectionDates.length ? dateLabel(inspectionDates[0]) : 'Sin fecha registrada';
    const palette = {
      navy: [14, 37, 67], darkBlue: [25, 62, 103], blue: [43, 111, 170],
      sky: [112, 177, 220], pastel: [223, 240, 250], pale: [241, 248, 252],
      ink: [31, 52, 75], muted: [91, 113, 136], line: [207, 224, 237], white: [255, 255, 255]
    };
    const statusColors = {
      cumple: { fill: [222, 243, 239], text: [28, 104, 102], accent: [44, 148, 145] },
      no_cumple: { fill: [250, 229, 233], text: [145, 57, 75], accent: [181, 78, 96] },
      parcial: { fill: [255, 243, 218], text: [143, 103, 28], accent: [190, 144, 49] },
      nueva: { fill: [225, 239, 250], text: [41, 86, 137], accent: [75, 133, 190] }
    };
    const counts = Object.fromEntries(Object.keys(STATUS).map(key => [key, rows.filter(row => row.status === key).length]));
    const areaCounts = Object.fromEntries(AREAS.map(area => [area, rows.filter(row => row.area === area).length]));
    let logoData = null;
    try { logoData = await whiteTransparentLogo(); }
    catch { /* continue with the text brand if the logo is unavailable */ }

    const drawHeader = () => {
      pdf.setFillColor(...palette.navy); pdf.rect(0, 0, 210, 36, 'F');
      pdf.setFillColor(...palette.sky); pdf.rect(0, 34, 210, 2, 'F');
      if (logoData) {
        try {
          const logo = pdf.getImageProperties(logoData), scale = Math.min(50 / logo.width, 15 / logo.height);
          const width = logo.width * scale, height = logo.height * scale;
          pdf.addImage(logoData, 'PNG', 37 - width / 2, 17.5 - height / 2, width, height, undefined, 'FAST');
        } catch { /* keep the report usable without the logo */ }
      }
      pdf.setTextColor(...palette.pastel); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7);
      pdf.text('SISTEMA DE GESTIÓN DE CALIDAD', 71, 11);
      pdf.setTextColor(...palette.white); pdf.setFontSize(14);
      pdf.text('REPORTE DE INSPECCIÓN', 71, 20);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...palette.pastel);
      pdf.text(title.toLocaleUpperCase('es-EC'), 71, 28);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5); pdf.setTextColor(...palette.sky);
      pdf.text('REPORTE', 199, 11, { align: 'right' });
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(...palette.white);
      pdf.text(dateRange, 199, 19, { align: 'right' });
      pdf.setTextColor(...palette.pastel); pdf.setFontSize(6.3);
      pdf.text(`Emitido ${generated}`, 199, 27, { align: 'right' });
      const metadata = rows[0];
      if (selectedRun?.openedByName) {
        const participants = [...new Set([selectedRun.openedByName, ...(selectedRun.participants || []), ...rows.map(row => row.inspectorName).filter(Boolean)])];
        pdf.setFontSize(5.1); pdf.text(`Inició: ${selectedRun.openedByName} · Participaron: ${participants.join(', ')}`, 71, 33, { maxWidth: 128 });
      } else if (metadata?.inspectorName || metadata?.reviewerName || metadata?.approverName) {
        pdf.setFontSize(5.1);
        pdf.text(`Elaborado: ${metadata.inspectorName || '—'}  ·  Revisado: ${metadata.reviewerName || '—'}  ·  Aprobado: ${metadata.approverName || '—'}`, 71, 33);
      }
    };
    drawHeader();

    const metrics = [
      { label: 'HALLAZGOS', value: rows.length, color: palette.darkBlue },
      { label: 'CERRADO', value: counts.cumple, color: statusColors.cumple.accent },
      { label: 'ABIERTO', value: counts.no_cumple, color: statusColors.no_cumple.accent },
      { label: 'EN CURSO', value: counts.parcial, color: statusColors.parcial.accent },
      { label: 'NUEVAS', value: counts.nueva, color: statusColors.nueva.accent }
    ];
    const metricGap = 2.5, metricX = 9, metricY = 42, metricH = 19;
    const metricW = (192 - metricGap * (metrics.length - 1)) / metrics.length;
    metrics.forEach((metric, index) => {
      const x = metricX + index * (metricW + metricGap);
      pdf.setFillColor(...palette.pale); pdf.setDrawColor(...palette.line); pdf.setLineWidth(.2);
      pdf.roundedRect(x, metricY, metricW, metricH, 1.8, 1.8, 'FD');
      pdf.setFillColor(...metric.color); pdf.roundedRect(x, metricY, 1.6, metricH, .8, .8, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5); pdf.setTextColor(...palette.muted);
      pdf.text(metric.label, x + 4, metricY + 6.5);
      pdf.setFontSize(12); pdf.setTextColor(...palette.navy);
      pdf.text(String(metric.value), x + metricW - 3, metricY + 15, { align: 'right' });
    });
    const isConsolidated = state.tab === 'Inicio' || state.tab === 'General';
    if (isConsolidated) {
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(...palette.darkBlue);
      pdf.text('DISTRIBUCIÓN POR ÁREA Y UBICACIÓN', 9, 68);
      const summaryCards = AREAS.map(area => ({ label: areaTitle(area), value: areaCounts[area] }));
      summaryCards.forEach((card, index) => {
        const col = index % 3, row = Math.floor(index / 3), x = 9 + col * 65, y = 71 + row * 13;
        pdf.setFillColor(...palette.pale); pdf.setDrawColor(...palette.line); pdf.roundedRect(x, y, 62, 11, 1.5, 1.5, 'FD');
        pdf.setFillColor(...palette.blue); pdf.circle(x + 4, y + 5.5, 1.1, 'F');
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(...palette.ink);
        pdf.text(card.label, x + 7, y + 6.7);
        pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...palette.darkBlue);
        pdf.text(String(card.value), x + 58, y + 6.7, { align: 'right' });
      });
    }
    const tableTitleY = isConsolidated ? 116 : 68;
    const tableStartY = isConsolidated ? 120 : 72;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.setTextColor(...palette.darkBlue);
    pdf.text('DETALLE DE HALLAZGOS', 9, tableTitleY);
    pdf.setDrawColor(...palette.line); pdf.setLineWidth(.35); pdf.line(9, tableTitleY + 2, 201, tableTitleY + 2);

    const imageData = new Map(), photosByKey = new Map();
    for (const row of rows) for (const photo of (row.photos || []).slice(0, 6)) photosByKey.set(photo.path || photo.previewUrl || photo.name, photo);
    await Promise.all([...photosByKey].map(async ([key, photo]) => {
      if (photo.preview) { imageData.set(key, photo.preview); return; }
      try {
        if (photo.previewUrl) {
          const response = await fetch(photo.previewUrl);
          if (!response.ok) throw new Error('No se encontró la evidencia');
          imageData.set(key, await dataUrl(await response.blob())); return;
        }
        const bytes = await firebaseApi.getBytes(firebaseApi.ref(firebaseApi.storage, photo.path));
        imageData.set(key, await dataUrl(new Blob([bytes], { type: 'image/jpeg' })));
      } catch { imageData.set(key, null); }
    }));
    pdf.autoTable({
      startY: tableStartY, showHead: 'everyPage', head: [['FECHA / NOTIFICACIÓN', 'ÁREA / UBICACIÓN', 'HALLAZGO / ACCIÓN / SEGUIMIENTO', 'RESPONSABLE', 'REGISTRÓ', 'IMPORTANCIA', 'DÍAS', 'ESTADO', 'FOTOS']],
      body: rows.map(row => [`${dateLabel(row.inspectedAt)}\nNotif.: ${row.notificationDateSource || dateLabel(row.notificationDate)}`, `${areaTitle(row.area)}${row.sourceSection ? `\n${row.sourceSection}` : ''}\n${row.location}`, `${row.description}${row.notes ? `\n${row.notes}` : ''}`, row.department || '—', row.inspectorName || row.createdByName || '—', importanceLabel(importanceOf(row)), daysOpen(row), STATUS[row.status] || '—', (row.photos || []).length ? '' : 'Sin evidencia']),
      theme: 'grid', styles: { font: 'helvetica', fontSize: 6.5, cellPadding: 1.8, textColor: palette.ink, lineColor: palette.line, lineWidth: .18, minCellHeight: 16, valign: 'middle', overflow: 'linebreak' },
      headStyles: { fillColor: palette.darkBlue, textColor: palette.white, fontSize: 6.1, fontStyle: 'bold', halign: 'left', cellPadding: 2.3 },
      alternateRowStyles: { fillColor: palette.pale },
      columnStyles: {
        0: { cellWidth: 16, fontSize: 5.5 }, 1: { cellWidth: 24, fontStyle: 'bold', fontSize: 5.8 }, 2: { cellWidth: 31, fontSize: 5.8 },
        3: { cellWidth: 17, fontSize: 5.5 }, 4: { cellWidth: 16, fontSize: 5.5 }, 5: { cellWidth: 14, halign: 'center', fontSize: 5.4 },
        6: { cellWidth: 8, halign: 'center', fontSize: 5.8 }, 7: { cellWidth: 19, halign: 'center', fontStyle: 'bold', fontSize: 5.8 }, 8: { cellWidth: 47, halign: 'center', fontSize: 5.8, textColor: palette.muted }
      },
      margin: { top: 38, left: 9, right: 9, bottom: 19 },
      didParseCell: data => {
        if (data.section !== 'body') return;
        const row = rows[data.row.index];
        if (data.column.index === 7) {
          const color = statusColors[row?.status] || statusColors.nueva;
          data.cell.styles.fillColor = color.fill; data.cell.styles.textColor = color.text;
          data.cell.styles.fontStyle = 'bold'; data.cell.styles.halign = 'center';
        }
        if (data.column.index === 8) {
          const photos = (row?.photos || []).slice(0, 6).filter(photo => imageData.get(photo.path || photo.previewUrl || photo.name));
          const lines = Math.ceil(photos.length / 2);
          data.cell.styles.minCellHeight = Math.max(16, lines ? 4 + lines * 9 + (lines - 1) * 1.2 : 16);
          if (!photos.length) { data.cell.styles.fontStyle = 'italic'; data.cell.styles.textColor = palette.muted; }
        }
      },
      didDrawCell: data => {
        if (data.section !== 'body' || data.column.index !== 8) return;
        const photos = (rows[data.row.index]?.photos || []).slice(0, 6).filter(photo => imageData.get(photo.path || photo.previewUrl || photo.name));
        photos.forEach((photo, index) => {
          const key = photo.path || photo.previewUrl || photo.name, source = imageData.get(key);
          const col = index % 2, line = Math.floor(index / 2), boxW = 15.5, boxH = 8, gapX = 1, gapY = 1.2;
          const rowW = 2 * boxW + gapX, startX = data.cell.x + Math.max(1, (data.cell.width - rowW) / 2);
          const x = startX + col * (boxW + gapX), y = data.cell.y + 1.7 + line * (boxH + gapY);
          try {
            pdf.setDrawColor(...palette.line); pdf.setFillColor(...palette.white); pdf.roundedRect(x, y, boxW, boxH, .8, .8, 'FD');
            const properties = pdf.getImageProperties(source), scale = Math.min((boxW - .8) / properties.width, (boxH - .8) / properties.height);
            const w = properties.width * scale, h = properties.height * scale, imageX = x + (boxW - w) / 2, imageY = y + (boxH - h) / 2;
            const format = source.startsWith('data:image/png') ? 'PNG' : 'JPEG';
            pdf.addImage(source, format, imageX, imageY, w, h, undefined, 'FAST');
          } catch { /* omit an unreadable thumbnail */ }
        });
      },
      rowPageBreak: 'avoid'
    });
    const pages = pdf.internal.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      pdf.setPage(page); pdf.setDrawColor(...palette.line); pdf.setLineWidth(.3); pdf.line(9, 283, 201, 283);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(...palette.muted);
      pdf.text('EXPALSA  ·  Sistema de gestión de calidad', 9, 289);
      pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...palette.darkBlue);
      pdf.text(`PÁGINA ${page} DE ${pages}`, 201, 289, { align: 'right' });
    }
    pdf.setProperties({ title: `Reporte de inspección · ${title}`, subject: 'Inspección de instalaciones EXPALSA', author: 'EXPALSA · Sistema de gestión de calidad' });
    const slug = exportSlug();
    pdf.save(`reporte-inspeccion-${slug}-${new Date().toLocaleDateString('en-CA')}.pdf`);
  } catch (error) { showToast(`No se pudo generar el PDF: ${friendlyError(error)}`, true); }
  finally { button.disabled = false; }
}

async function deleteInspection(runId) {
  if (state.demo) {
    const findings = state.records.filter(row => row.inspectionId === runId);
    const corrections = state.corrections.filter(action => findings.some(row => row.id === action.observationId));
    const progress = Object.values(state.progress).filter(item => item.inspectionId === runId);
    const run = state.inspectionRuns.find(item => item.id === runId);
    if (!run) return;
    const number = inspectionNumber(run);
    const message = `¿Eliminar la inspección ${number} del ejemplo? Se quitarán ${findings.length} hallazgos, ${corrections.length} acciones correctivas y ${progress.length} avances guardados. Esta acción no se puede deshacer.`;
    if (!window.confirm(message)) return;
    const findingIds = new Set(findings.map(row => row.id));
    state.inspectionRuns = state.inspectionRuns.filter(item => item.id !== runId);
    state.records = state.records.filter(row => row.inspectionId !== runId);
    state.corrections = state.corrections.filter(action => !findingIds.has(action.observationId));
    state.progress = Object.fromEntries(Object.entries(state.progress).filter(([, item]) => item.inspectionId !== runId));
    if (state.selectedInspectionId === runId) state.selectedInspectionId = null;
    if (state.activeInspectionId === runId) { state.activeInspectionId = null; state.activeInspectionNumber = null; }
    render(); showToast('Inspección eliminada del ejemplo local.');
    return;
  }
  if (state.role !== 'admin') { showToast('Solo un administrador puede eliminar inspecciones.', true); return; }
  const run = state.inspectionRuns.find(item => item.id === runId);
  if (!run || runId.startsWith('legacy:')) { showToast('No se encontró el registro principal de esta inspección.', true); return; }
  const findings = state.records.filter(row => row.inspectionId === runId);
  const findingIds = new Set(findings.map(row => row.id));
  const corrections = state.corrections.filter(action => findingIds.has(action.observationId));
  const progress = Object.values(state.progress).filter(item => item.inspectionId === runId);
  const message = `¿Eliminar la inspección ${inspectionNumber(run)}? Se borrarán permanentemente ${findings.length} hallazgos, ${corrections.length} acciones correctivas, ${progress.length} avances guardados y sus fotos de evidencia. Esta acción no se puede deshacer.`;
  if (!window.confirm(message)) return;
  const documents = [
    ...findings.map(row => [COLLECTION, row.id]),
    ...corrections.map(action => [CORRECTIONS, action.id]),
    ...progress.map(item => [PROGRESS, item.id]),
    [RUNS, runId]
  ];
  if (documents.length > 500) { showToast('La inspección tiene más de 500 registros relacionados; no se eliminó. Solicita una eliminación controlada.', true); return; }
  const photos = [...findings.flatMap(row => row.photos || []), ...corrections.flatMap(action => action.photos || [])].filter(photo => photo.path);
  try {
    await loadInspectionModules();
    const batch = firebaseApi.writeBatch(firebaseApi.db);
    for (const [collectionName, id] of documents) batch.delete(firebaseApi.doc(firebaseApi.db, collectionName, id));
    await batch.commit();
    const photoCleanup = await Promise.allSettled(photos.map(photo => firebaseApi.deleteObject(firebaseApi.ref(firebaseApi.storage, photo.path))));
    const failedPhotoDeletes = photoCleanup.filter(result => result.status === 'rejected').length;
    if (state.selectedInspectionId === runId) state.selectedInspectionId = null;
    if (state.activeInspectionId === runId) { state.activeInspectionId = null; state.activeInspectionNumber = null; }
    render();
    showToast(failedPhotoDeletes ? `Inspección eliminada; ${failedPhotoDeletes} foto(s) requieren limpieza manual.` : 'Inspección y registros asociados eliminados.');
  } catch (error) { showToast(`No se pudo eliminar la inspección: ${friendlyError(error)}`, true); }
}

async function initialize() {
  const cfg = window.EXPALSA_FIREBASE_CONFIG;
  if (!cfg?.appId || !cfg?.apiKey || cfg.projectId !== 'oceantreasure-app') { $('authMessage').textContent = 'No se encontró la configuración Firebase de EXPALSA.'; $('authMessage').classList.add('error'); return; }
  try {
    const V = '13.0.0';
    const [appModule, authModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`)
    ]);
    const app = appModule.initializeApp(cfg, 'expalsa-inspecciones');
    const auth = authModule.getAuth(app);
    firebaseApi = { ...authModule, auth, app };
    $('authMessage').textContent = 'Conexión lista. Inicia sesión con tu cuenta autorizada.';
    authModule.onAuthStateChanged(auth, async user => {
      if (!user) {
        if (state.unsubscribe) state.unsubscribe(); state.unsubscribe = null; state.user = null; state.records = [];
        $('appShell').hidden = true; $('authGate').hidden = false; setConnection(false, 'Conexión pendiente'); return;
      }
      try { await loadInspectionModules(); const role = await verifyRole(user); startApp(user, role); }
      catch (error) { await authModule.signOut(auth); $('authMessage').textContent = friendlyError(error); $('authMessage').classList.add('error'); }
    });
  } catch (error) { $('authMessage').textContent = friendlyError(error); $('authMessage').classList.add('error'); }
}

document.addEventListener('click', async event => {
  if (event.target.closest('#clearComplianceFilter')) { state.complianceFilter = ''; renderCompliance(); return; }
  const complianceFilter = event.target.closest('[data-compliance-filter]');
  if (complianceFilter) {
    const filter = complianceFilter.dataset.complianceFilter;
    state.complianceFilter = state.complianceFilter === filter ? '' : filter;
    renderCompliance(); return;
  }
  if (event.target.closest('#clearPivotFilter')) { state.pivotFilter = { status: '', area: '', departmentKey: '' }; renderDashboard(); return; }
  const pivotDepartment = event.target.closest('[data-pivot-department]');
  if (pivotDepartment) {
    const departmentKey = pivotDepartment.dataset.pivotDepartment;
    state.pivotFilter.departmentKey = state.pivotFilter.departmentKey === departmentKey ? '' : departmentKey;
    renderDashboard(); return;
  }
  const pivotArea = event.target.closest('[data-pivot-area]');
  const pivotStatus = event.target.closest('[data-pivot-status]');
  if (pivotArea || pivotStatus) {
    const area = pivotArea?.dataset.pivotArea || '';
    const status = pivotArea?.dataset.pivotStatus || pivotStatus?.dataset.pivotStatus || '';
    if (status) setPivotStatus(status, area);
    else {
      state.pivotFilter = state.pivotFilter.area === area && !state.pivotFilter.status && !state.pivotFilter.departmentKey
        ? { status: '', area: '', departmentKey: '' }
        : { status: '', area, departmentKey: '' };
      renderDashboard();
    }
    return;
  }
  const nav = event.target.closest('[data-tab]');
  if (nav) { state.tab = nav.dataset.tab; if (state.tab === 'Historial') { state.selectedInspectionDate = null; state.selectedInspectionId = null; } $('sidebar').classList.remove('open'); render(); return; }
  const openInspection = event.target.closest('[data-open-inspection]');
  if (openInspection) {
    const key = openInspection.dataset.openInspection;
    state.tab = 'Historial'; state.selectedInspectionDate = key.startsWith('legacy:') ? key.slice(7) : null;
    state.selectedInspectionId = key.startsWith('legacy:') ? null : key;
    const run = state.inspectionRuns.find(item => item.id === key);
    if (run?.status === 'en_curso') { state.activeInspectionId = run.id; state.activeInspectionNumber = run.inspectionNumber; }
    render(); return;
  }
  const deleteInspectionButton = event.target.closest('[data-delete-inspection]');
  if (deleteInspectionButton) { await deleteInspection(deleteInspectionButton.dataset.deleteInspection); return; }
  const viewPhoto = event.target.closest('[data-view-photo]');
  if (viewPhoto) { openPhotoViewer(viewPhoto.dataset.viewPhoto); return; }
  if (event.target.closest('#backToHistory')) { state.selectedInspectionDate = null; state.selectedInspectionId = null; render(); return; }
  const edit = event.target.closest('[data-edit]'); if (edit) { openEditDialog(edit.dataset.edit); return; }
  const correct = event.target.closest('[data-correct]'); if (correct) { openCorrectionDialog(correct.dataset.correct); return; }
  if (event.target.closest('[data-create]')) { openNewDialog(); return; }
  const tabLink = event.target.closest('[data-open-tab]'); if (tabLink) { state.tab = tabLink.dataset.openTab; if (state.tab === 'Historial') { state.selectedInspectionDate = null; state.selectedInspectionId = null; } render(); return; }
  const removePhoto = event.target.closest('[data-remove-photo]'); if (removePhoto) { state.pendingPhotos.splice(Number(removePhoto.dataset.removePhoto), 1); drawPhotoPreview(); }
});
$('loginForm').addEventListener('submit', async event => {
  event.preventDefault(); $('authMessage').classList.remove('error'); $('authMessage').textContent = 'Verificando cuenta…';
  if (!firebaseApi) { $('authMessage').textContent = 'La conexión aún está iniciando. Intenta de nuevo en un momento.'; return; }
  const data = new FormData(event.currentTarget);
  try { await firebaseApi.signInWithEmailAndPassword(firebaseApi.auth, data.get('email'), data.get('password')); }
  catch (error) { $('authMessage').textContent = friendlyError(error); $('authMessage').classList.add('error'); }
});
$('demoButton').addEventListener('click', enterDemo);
$('resetDemoButton').addEventListener('click', resetDemo);
$('statusDonut').addEventListener('click', statusAtDonutPoint);
$('logoutButton').addEventListener('click', () => state.demo ? exitDemo() : firebaseApi.signOut(firebaseApi.auth));
$('newInspection').addEventListener('click', async () => {
  const area = AREAS.includes(state.tab) ? state.tab : 'PLANTA';
  const selectedRun = state.tab === 'Historial' ? state.inspectionRuns.find(run => run.id === state.selectedInspectionId) : null;
  if (selectedRun?.status === 'en_curso') { state.activeInspectionId = selectedRun.id; state.activeInspectionNumber = selectedRun.inspectionNumber; state.tab = area; state.selectedInspectionId = null; state.selectedInspectionDate = null; render(); openNewDialog(area); return; }
  const activeRun = state.inspectionRuns.find(run => run.id === state.activeInspectionId);
  if (activeRun?.status === 'en_curso') { state.tab = area; state.selectedInspectionId = null; state.selectedInspectionDate = null; render(); openNewDialog(area); return; }
  try { await createInspection(area, false); } catch (error) { showToast(friendlyError(error), true); }
});
$('saveAreaButton').addEventListener('click', saveAreaProgress);
$('closeInspectionButton').addEventListener('click', closeInspection);
$('exportButton').addEventListener('click', exportPdf);
$('exportExcelButton').addEventListener('click', exportExcel);
$('inspectionForm').addEventListener('submit', saveInspection);
$('inspectionForm').elements.status.addEventListener('change', () => updateDefaultDeadline());
$('inspectionForm').elements.notificationDate.addEventListener('input', () => updateDefaultDeadline());
$('inspectionForm').elements.complianceDueDate.addEventListener('input', event => { event.currentTarget.dataset.autoDefault = ''; });
$('correctionForm').addEventListener('submit', saveCorrection);
$('photoClose').addEventListener('click', () => $('photoDialog').close());
$('photoPrevious').addEventListener('click', () => stepPhoto(-1));
$('photoNext').addEventListener('click', () => stepPhoto(1));
$('photoDownloadButton').addEventListener('click', downloadCurrentPhoto);
$('photoReplaceButton').addEventListener('click', () => $('photoReplaceInput').click());
$('photoReplaceInput').addEventListener('change', event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) changeCurrentPhoto(file); });
$('photoDeleteButton').addEventListener('click', () => { if (window.confirm('¿Eliminar esta foto de la evidencia de la observación?')) changeCurrentPhoto(); });
$('photoDialog').addEventListener('close', () => { state.viewingPhoto = null; $('photoViewerImage').removeAttribute('src'); });
$('correctionCamera').addEventListener('change', event => handleCorrectionPhotoFiles(event.currentTarget));
$('correctionGallery').addEventListener('change', event => handleCorrectionPhotoFiles(event.currentTarget));
$('correctionPhotoPreview').addEventListener('click', event => { const remove = event.target.closest('[data-remove-correction-photo]'); if (remove) { state.correctionPhotos.splice(Number(remove.dataset.removeCorrectionPhoto), 1); drawCorrectionPhotoPreview(); } });
$('inspectionForm').elements.area.addEventListener('change', event => { fillLocationOptions(event.currentTarget.value); updateRecurrenceChoices(); });
$('locationSelect').addEventListener('change', () => { syncOtherChoice($('locationSelect'), $('locationOther')); updateRecurrenceChoices(); });
$('departmentSelect').addEventListener('change', () => { syncOtherChoice($('departmentSelect'), $('departmentOther')); updateRecurrenceChoices(); });
$('locationOther').addEventListener('input', updateRecurrenceChoices);
$('departmentOther').addEventListener('input', updateRecurrenceChoices);
$('closeDialog').addEventListener('click', () => $('inspectionDialog').close());
$('cancelDialog').addEventListener('click', () => $('inspectionDialog').close());
$('closeCorrection').addEventListener('click', () => $('correctionDialog').close());
$('cancelCorrection').addEventListener('click', () => $('correctionDialog').close());
$('filtersToggle').addEventListener('click', () => $('advancedFilters').hidden = !$('advancedFilters').hidden);
$('clearFilters').addEventListener('click', () => { for (const id of ['filterStatus', 'filterDepartment', 'filterFrom', 'filterTo']) $(id).value = ''; $('quickSearch').value = ''; $('filterOrder').value = 'desc'; render(); });
let searchRenderTimer;
for (const id of ['quickSearch', 'filterDepartment']) $(id).addEventListener('input', () => {
  clearTimeout(searchRenderTimer);
  searchRenderTimer = setTimeout(render, 160);
});
for (const id of ['filterStatus', 'filterFrom', 'filterTo', 'filterOrder']) $(id).addEventListener('change', render);
$('cameraInput').addEventListener('change', event => handlePhotoFiles(event.currentTarget));
$('galleryInput').addEventListener('change', event => handlePhotoFiles(event.currentTarget));
$('mobileMenu').addEventListener('click', () => $('sidebar').classList.toggle('open'));
document.addEventListener('keydown', event => { if (event.key === 'Escape') $('sidebar').classList.remove('open'); });
setInterval(() => {
  if (!state.user) return;
  drawNavigation();
  if (state.tab === 'Cumplimientos') renderCompliance();
  if (state.tab === 'Alertas') renderAlerts();
}, 60000);

initialize();

