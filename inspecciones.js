const COLLECTION = 'expalsa_calidad_inspecciones';
const RUNS = 'expalsa_calidad_inspecciones_runs';
const CORRECTIONS = 'expalsa_calidad_acciones_correctivas';
const PROGRESS = 'expalsa_calidad_inspecciones_progreso';
const AREAS = ['PLANTA', 'EXTERIORES', 'BODEGAS', 'DESECHOS', 'DESPACHO', 'SILO DE HIELO', 'OTROS'];
const STATUS = { cumple: 'Cumple', no_cumple: 'No cumple', parcial: 'Parcial', nueva: 'Nueva observación' };
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
const SECTIONS = [
  { id: 'Inicio', icon: '⌂', title: 'Inicio', description: 'Resumen de hallazgos y acciones de inspección.' },
  { id: 'Alertas', icon: '⚑', title: 'Alertas', description: 'Seguimiento prioritario de incumplimientos y observaciones parciales.' },
  ...AREAS.map(area => ({ id: area, icon: ({ PLANTA: '▦', EXTERIORES: '⌂', BODEGAS: '▤', DESECHOS: '♲', DESPACHO: '⇧', 'SILO DE HIELO': '❄', OTROS: '⋯' })[area], title: areaTitle(area), description: `Observaciones registradas en ${area.toLowerCase()}.` })),
  { id: 'General', icon: '▧', title: 'General', description: 'Observaciones consolidadas de todas las instalaciones.' },
  { id: 'Historial', icon: '◷', title: 'Historial', description: 'Busca, filtra y revisa las inspecciones anteriores.' }
];

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const elapsedDays = value => value ? Math.floor((Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) - Date.parse(`${value}T00:00:00Z`)) / 86400000) : '—';
const daysOpen = row => Number.isFinite(row.daysOpenSnapshot) ? row.daysOpenSnapshot : elapsedDays(row.notificationDate);
const state = { user: null, role: '', demo: false, tab: 'Inicio', selectedInspectionDate: null, selectedInspectionId: null, activeInspectionId: null, activeInspectionNumber: null, records: [], inspectionRuns: [], corrections: [], progress: {}, unsubscribe: null, pendingPhotos: [], editingPhotos: [], correctionPhotos: [], correctingObservationId: null, viewingPhoto: null, toastTimer: null };
let firebaseApi;
let inspectionModulesPromise;
let pdfLibrariesPromise;

function syncOtherChoice(select, input) {
  const custom = select.value === '__other__';
  input.hidden = !custom; input.disabled = !custom; input.required = custom;
  if (!custom) input.value = '';
}

function fillLocationOptions(area, selected = '') {
  const select = $('locationSelect'), other = $('locationOther');
  const used = state.demo ? new Set() : new Set(state.records
    .filter(row => row.area === area && normalizeLocation(row.location) !== normalizeLocation(selected))
    .map(row => normalizeLocation(row.location)));
  const options = (LOCATIONS[area] || LOCATIONS.OTROS).filter(value => !used.has(normalizeLocation(value)));
  select.replaceChildren(new Option(options.length ? 'Selecciona una ubicación disponible' : 'No hay ubicaciones disponibles; registra otra', ''), ...options.map(value => new Option(value, value)), new Option('Otra ubicación…', '__other__'));
  if (selected && !options.includes(selected)) { select.value = '__other__'; other.value = selected; }
  else { select.value = selected; other.value = ''; }
  syncOtherChoice(select, other);
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
  const alerts = state.records.filter(row => row.status === 'no_cumple' || row.status === 'parcial').length;
  $('sectionNav').innerHTML = SECTIONS.map(item => `<button class="nav-button${state.tab === item.id ? ' active' : ''}" data-tab="${item.id}" type="button"><span class="nav-icon">${item.icon}</span><span>${item.title}</span>${item.id === 'Alertas' && alerts ? `<span class="nav-alert-count">${alerts}</span>` : ''}</button>`).join('');
}

function recordsForView() {
  let records = state.records;
  if (AREAS.includes(state.tab)) records = records.filter(row => row.area === state.tab);
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
  const selected = SECTIONS.find(item => item.id === state.tab) || SECTIONS[0];
  const selectedInspection = state.tab === 'Historial' && (state.selectedInspectionId !== null || state.selectedInspectionDate !== null);
  const selectedRun = state.inspectionRuns.find(run => run.id === state.selectedInspectionId);
  const selectedInspectionDate = selectedRun?.inspectedAt || state.selectedInspectionDate;
  const inspectionRows = selectedInspection ? recordsForView().filter(row => selectedRun ? row.inspectionId === selectedRun.id : (row.inspectedAt || '') === state.selectedInspectionDate) : [];
  const number = selectedInspection ? selectedRun ? inspectionNumber(selectedRun) : inspectionNumber(state.selectedInspectionDate) : '';
  $('currentCrumb').textContent = selectedInspection ? number : selected.title;
  $('pageTitle').textContent = selectedInspection ? number : selected.title;
  $('pageDescription').textContent = selectedInspection
    ? `${selectedInspectionDate ? dateLabel(selectedInspectionDate) : 'Fecha no registrada'} · ${inspectionRows.length} hallazgos · ${selectedRun?.status === 'en_curso' ? 'En curso' : 'Terminada'} · detalle por área`
    : selected.description;
  $('pageEyebrow').textContent = state.tab === 'Historial' ? 'CONSULTA Y SEGUIMIENTO' : 'CONTROL DE INSTALACIONES';
  $('dashboardView').hidden = state.tab !== 'Inicio';
  $('alertsView').hidden = state.tab !== 'Alertas';
  $('listView').hidden = ['Inicio', 'Alertas'].includes(state.tab);
  $('listScope').textContent = selectedInspection ? 'Detalle de inspección' : state.tab === 'Historial' ? 'Inspecciones por fecha' : AREAS.includes(state.tab) ? selected.title : 'Todas las áreas';
  $('backToHistory').hidden = !selectedInspection;
  const activeRun = state.inspectionRuns.find(run => run.id === state.activeInspectionId);
  const active = state.demo ? !!state.activeInspectionId : activeRun?.status === 'en_curso';
  $('activeInspectionBadge').hidden = !active;
  $('activeInspectionBadge').textContent = active ? `${state.activeInspectionNumber || inspectionNumber(activeRun)} · EN CURSO` : '';
  $('saveAreaButton').hidden = !AREAS.includes(state.tab) || !active;
  $('closeInspectionButton').hidden = !active;
  const savedArea = state.progress[`${state.activeInspectionId}:${state.tab}`];
  $('saveAreaButton').textContent = savedArea ? `Guardado ✓ · ${savedArea.savedByName || userLabel()}` : 'Guardar pestaña';
  $('newInspection').textContent = ['Inicio', 'Alertas', 'Historial'].includes(state.tab) ? '＋ Nueva inspección' : '＋ Nueva observación';
  const filtered = recordsForView();
  if (state.tab === 'Alertas') {
    $('resultCount').textContent = '';
    $('recordsBody').innerHTML = '';
  } else if (state.tab === 'Historial' && !selectedInspection) {
    const groups = groupInspections(filtered);
    $('resultCount').textContent = `${groups.length} ${groups.length === 1 ? 'inspección' : 'inspecciones'}`;
    $('recordsHead').innerHTML = '<tr><th>N.º DE INSPECCIÓN</th><th>FECHA</th><th>ÁREAS INSPECCIONADAS</th><th>HALLAZGOS</th><th>ESTADOS</th><th>ABRIR</th></tr>';
    $('recordsBody').innerHTML = groups.map(group => {
      const statusSummary = Object.entries(group.statuses).filter(([, count]) => count).map(([status, count]) => `<span class="status-pill status-${escapeHtml(status)}">${escapeHtml(STATUS[status])}: ${count}</span>`).join(' ');
      const areas = [...group.areas].map(areaTitle).join(' · ');
      const groupNumber = group.run.id?.startsWith('demo-') ? inspectionNumber(group.run) : group.run.inspectionNumber ? inspectionNumber(group.run) : inspectionNumber(group.date);
      const statusText = group.run.status === 'en_curso' ? '<span class="run-status run-open">En curso</span>' : '<span class="run-status run-closed">Terminada</span>';
      return `<tr class="inspection-group-row"><td><strong class="inspection-number">${escapeHtml(groupNumber)}</strong></td><td><strong>${escapeHtml(group.date ? dateLabel(group.date) : 'Sin fecha registrada')}</strong><div>${statusText}</div></td><td>${escapeHtml(areas || '—')}</td><td><strong>${group.rows.length}</strong></td><td><div class="inspection-statuses">${statusSummary}</div></td><td><button class="button secondary open-inspection" data-open-inspection="${escapeHtml(group.id)}" type="button">${group.run.status === 'en_curso' ? 'Continuar' : 'Abrir detalle'} <span aria-hidden="true">→</span></button></td></tr>`;
    }).join('');
  } else {
    const detailRows = selectedInspection ? inspectionRows : filtered;
    $('resultCount').textContent = `${detailRows.length} ${detailRows.length === 1 ? 'observación' : 'observaciones'}`;
    $('recordsHead').innerHTML = '<tr><th>FECHA / ÁREA</th><th>HALLAZGO</th><th>RESPONSABLE</th><th>REGISTRÓ</th><th>DÍAS ABIERTOS</th><th>ESTADO</th><th>EVIDENCIA</th><th></th></tr>';
    $('recordsBody').innerHTML = detailRows.map(row => `<tr>
      <td><div class="date-area"><strong>${escapeHtml(dateLabel(row.inspectedAt))}</strong><span>${escapeHtml(areaTitle(row.area))}${row.sourceSection ? ` · ${escapeHtml(row.sourceSection)}` : ''} · ${escapeHtml(row.location)}</span></div></td>
      <td><span class="finding-title">${escapeHtml(row.description)}</span>${row.notes ? `<span class="finding-note">${escapeHtml(row.notes)}</span>` : ''}</td>
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
  renderDashboard();
}

function activeFilterCount() {
  return Number(!!$('filterStatus').value) + Number(!!$('filterDepartment').value.trim()) + Number(!!$('filterFrom').value) + Number(!!$('filterTo').value) + Number(!!$('quickSearch').value.trim());
}

function renderDashboard() {
  const rows = state.records;
  const counts = Object.fromEntries(Object.keys(STATUS).map(key => [key, rows.filter(row => row.status === key).length]));
  $('statTotal').textContent = rows.length;
  $('statCompliant').textContent = counts.cumple;
  $('statFailed').textContent = counts.no_cumple;
  $('statPartial').textContent = counts.parcial;
  $('donutTotal').textContent = rows.length;
  $('legendCompliant').textContent = counts.cumple;
  $('legendFailed').textContent = counts.no_cumple;
  $('legendPartial').textContent = counts.parcial;
  $('legendNew').textContent = counts.nueva;
  const total = rows.length || 1;
  const first = counts.cumple / total * 100;
  const second = first + counts.no_cumple / total * 100;
  const third = second + counts.parcial / total * 100;
  $('statusDonut').style.background = rows.length ? `conic-gradient(#3b9875 0% ${first}%,#cd5a55 ${first}% ${second}%,#ca9039 ${second}% ${third}%,#8997a7 ${third}% 100%)` : 'conic-gradient(#e2e8ed 0% 100%)';
   $('categorySummary').innerHTML = AREAS.map(area => {
     const areaRows = rows.filter(row => row.area === area), count = areaRows.length;
     const segments = ['cumple','no_cumple','parcial','nueva'].map(status => {
       const value = areaRows.filter(row => row.status === status).length;
       return `<span class="bar-segment segment-${status}" style="width:${count ? value / count * 100 : 0}%" title="${escapeHtml(STATUS[status])}: ${value}"></span>`;
     }).join('');
     const label = ['cumple','no_cumple','parcial','nueva'].map(status => `${STATUS[status]}: ${areaRows.filter(row => row.status === status).length}`).join(', ');
     return `<div class="category-row"><span>${escapeHtml(areaTitle(area))}</span><div class="bar-track segmented-bar" role="img" aria-label="${escapeHtml(areaTitle(area))}: ${escapeHtml(label)}">${segments}</div><b>${count}</b></div>`;
   }).join('');
  const recent = [...rows].sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt)).slice(0, 5);
  $('recentRows').innerHTML = recent.length ? `<div class="recent-list">${recent.map(row => `<div class="recent-row"><span class="recent-date">${escapeHtml(dateLabel(row.inspectedAt))}</span><span class="recent-finding">${escapeHtml(row.description)}</span><span class="recent-location">${escapeHtml(row.area)} · ${escapeHtml(row.location)}</span><span class="status-pill status-${escapeHtml(row.status)}">${escapeHtml(STATUS[row.status] || '')}</span><button class="row-actions" type="button" data-edit="${escapeHtml(row.id)}" aria-label="Editar observación">↗</button></div>`).join('')}</div>` : '<div class="empty-state"><div class="empty-glyph">▧</div><h3>Tu historial empieza aquí</h3><p>Las observaciones guardadas aparecerán en este resumen.</p></div>';
  const priorities = rows.filter(row => row.status === 'no_cumple' || row.status === 'parcial').sort((a, b) => (a.status === b.status ? (b.inspectedAt || '').localeCompare(a.inspectedAt || '') : a.status === 'no_cumple' ? -1 : 1));
  $('alertTotal').textContent = priorities.length;
  $('alertsBody').innerHTML = priorities.map(row => `<tr><td><span class="priority-mark ${row.status === 'no_cumple' ? 'priority-high' : 'priority-medium'}">${row.status === 'no_cumple' ? 'Alta' : 'Media'}</span></td><td><strong>${escapeHtml(row.inspectionNumber || inspectionNumber(row.inspectedAt))}</strong></td><td>${escapeHtml(areaTitle(row.area))}<span class="table-secondary">${escapeHtml(row.sourceSection ? `${row.sourceSection} · ` : '')}${escapeHtml(row.location)}</span></td><td><span class="finding-title">${escapeHtml(row.description)}</span></td><td><span class="status-pill status-${escapeHtml(row.status)}">${escapeHtml(STATUS[row.status])}</span></td><td><button class="button corrective-action-button" data-correct="${escapeHtml(row.id)}" type="button">Registrar corrección</button></td></tr>`).join('');
  $('alertsEmpty').hidden = priorities.length > 0;
  const actions = state.corrections;
  $('correctionTotal').textContent = `${actions.length} ${actions.length === 1 ? 'acción' : 'acciones'}`;
  $('correctionsBody').innerHTML = actions.map(action => { const actionDate = action.createdAt?.toDate?.(); const finding = state.records.find(row => row.id === action.observationId) || action; return `<tr><td>${escapeHtml(actionDate ? actionDate.toLocaleDateString('es-EC') : dateLabel(action.actionDate))}</td><td><strong>${escapeHtml(finding.inspectionNumber || action.inspectionNumber || '—')}</strong><span class="table-secondary">${escapeHtml(areaTitle(finding.area))} · ${escapeHtml(finding.location || '')}</span><span class="table-secondary">${escapeHtml(finding.description || '')}</span></td><td><span class="finding-title">${escapeHtml(action.note || '')}</span><span class="table-secondary">${(action.photos || []).length} evidencia${(action.photos || []).length === 1 ? '' : 's'}</span></td><td><span class="status-pill status-${escapeHtml(action.previousStatus)}">${escapeHtml(STATUS[action.previousStatus] || '')}</span> → <span class="status-pill status-${escapeHtml(action.newStatus)}">${escapeHtml(STATUS[action.newStatus] || '')}</span></td><td>${escapeHtml(action.byName || '—')}</td></tr>`; }).join('');
  $('correctionsEmpty').hidden = actions.length > 0;
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
    render();
  }, error => { setConnection(false, 'Sin acceso a los datos'); showToast(friendlyError(error), true); }));
  listen(COLLECTION, rows => { state.records = rows.sort((a, b) => (b.inspectedAt || '').localeCompare(a.inspectedAt || '')); });
  listen(RUNS, rows => { state.inspectionRuns = rows.sort((a, b) => (b.inspectedAt || '').localeCompare(a.inspectedAt || '')); });
  listen(CORRECTIONS, rows => { state.corrections = rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); });
  listen(PROGRESS, rows => { state.progress = Object.fromEntries(rows.map(row => [`${row.inspectionId}:${row.area}`, row])); });
  state.unsubscribe = () => stops.forEach(stop => stop());
}

function startApp(user, role) {
  state.user = user; state.role = role; state.demo = false;
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
      return rows;
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
    state.role = 'demo'; state.demo = true; state.tab = 'Inicio'; state.selectedInspectionDate = null; state.selectedInspectionId = null;
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
    const records = await loadDemoRecords(); state.tab = 'Inicio'; state.selectedInspectionDate = null; state.selectedInspectionId = null; state.activeInspectionId = null; state.activeInspectionNumber = null; state.corrections = []; state.progress = {};
    state.inspectionRuns = [{ id: 'demo-run-20260912', inspectionNumber: 'INS-20260912-DEMO', inspectedAt: '2026-09-12', status: 'terminada', openedByName: 'Anthony Cobos y Michelle Loor', openedByEmail: 'calidad@expalsa.local', participants: ['Anthony Cobos', 'Michelle Loor'] }];
    state.records = records.map(row => ({ ...row, inspectionId: state.inspectionRuns[0].id, inspectionNumber: state.inspectionRuns[0].inspectionNumber }));
    $('quickSearch').value = '';
    for (const id of ['filterStatus', 'filterDepartment', 'filterFrom', 'filterTo']) $(id).value = '';
    $('filterOrder').value = 'desc'; render(); showToast('Ejemplo completo recargado.');
  } catch (error) { showToast(error.message || 'No se pudo recargar el ejemplo.', true); }
}

async function createInspection(area = 'PLANTA', openForm = true) {
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
    state.activeInspectionId = null; state.activeInspectionNumber = null; render(); showToast(`Inspección ${inspectionNumber(run)} terminada.`);
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
  state.demo = false; state.user = null; state.records = []; state.inspectionRuns = []; state.corrections = []; state.progress = {}; state.activeInspectionId = null; state.activeInspectionNumber = null; state.selectedInspectionId = null; state.tab = 'Inicio';
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
    }
  } catch (error) {
    $('photoViewerCaption').textContent = friendlyError(error);
  }
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
    const actionId = `local-${crypto.randomUUID()}`, name = userLabel(), date = new Date().toLocaleDateString('en-CA');
    const action = { id: actionId, inspectionId: row.inspectionId || row.id, inspectionNumber: row.inspectionNumber || inspectionNumber(row.inspectedAt), observationId: row.id, area: row.area, location: row.location, description: row.description, previousStatus: row.status, newStatus, note, photos: [], byUid: state.user.uid, byName: name, byEmail: state.user.email, actionDate: date };
    if (state.demo) {
      action.photos = state.correctionPhotos.map(photo => ({ preview: photo.preview, name: photo.name }));
      row.status = newStatus; row.lastCorrectionId = actionId; row.updatedByName = name;
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
  const run = state.inspectionRuns.find(item => item.id === state.activeInspectionId);
  form.elements.inspectedAt.value = run?.inspectedAt || new Date().toLocaleDateString('en-CA'); form.elements.inspectedAt.disabled = true; form.elements.status.value = 'nueva'; form.elements.status.disabled = false;
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
  for (const key of ['area', 'inspectedAt', 'description', 'notificationDate', 'status', 'notes']) form.elements[key].value = row[key] || '';
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
      department: formValue(form, 'department', 'departmentOther'), notificationDate: form.elements.notificationDate.value,
      status: form.elements.status.value, notes: form.elements.notes.value.trim()
    };
    const id = form.elements.id.value || (state.demo ? `demo-${crypto.randomUUID()}` : firebaseApi.doc(firebaseApi.collection(firebaseApi.db, COLLECTION)).id);
    const current = state.records.find(item => item.id === id);
    const run = state.inspectionRuns.find(item => item.id === (current?.inspectionId || state.activeInspectionId));
    if (!state.demo && (!run || run.status !== 'en_curso')) throw new Error('Guarda las observaciones dentro de una inspección en curso.');
    if (!state.demo && !current && state.records.some(row => row.area === fields.area && normalizeLocation(row.location) === normalizeLocation(fields.location))) {
      fillLocationOptions(fields.area);
      throw new Error('Esa ubicación o proceso ya tiene una observación registrada. Selecciona una ubicación disponible.');
    }
    if (run?.inspectedAt) fields.inspectedAt = run.inspectedAt;
    if (state.demo) {
      const photos = [...state.editingPhotos, ...state.pendingPhotos.map(photo => ({ preview: photo.preview, name: photo.name, origin: photo.origin }))];
      const run = state.inspectionRuns.find(item => item.id === (current?.inspectionId || state.activeInspectionId));
      const record = { ...current, ...fields, id, inspectionId: run?.id || current?.inspectionId, inspectionNumber: run?.inspectionNumber || current?.inspectionNumber, photos, source: current?.source || 'app', inspectorName: current?.inspectorName || userLabel(), inspectorEmail: current?.inspectorEmail || state.user.email, inspectorUid: current?.inspectorUid || state.user.uid, createdByName: current?.createdByName || userLabel(), updatedByName: userLabel() };
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
    const payload = {
      ...fields, inspectionId: current?.inspectionId || run.id, inspectionNumber: current?.inspectionNumber || run.inspectionNumber,
      photos, inspectorName: current?.inspectorName || userLabel(),
      inspectorEmail: current?.inspectorEmail || state.user.email, inspectorUid: current?.inspectorUid || state.user.uid,
      createdBy: current?.createdBy || state.user.uid, createdAt: current?.createdAt || serverTimestamp(),
      updatedBy: state.user.uid, updatedByName: userLabel(), updatedAt: serverTimestamp(),
      source: current?.source || 'app'
    };
    await setDoc(doc(db, COLLECTION, id), payload);
    await updateDoc(doc(db, RUNS, run.id), { participants: arrayUnion(userLabel()), updatedBy: state.user.uid, updatedByName: userLabel(), updatedAt: serverTimestamp() });
    $('inspectionDialog').close(); showToast(current ? 'La observación fue actualizada.' : 'Observación guardada en Firebase.');
  } catch (error) { showToast(friendlyError(error), true); }
  finally { saveButton.disabled = false; saveButton.textContent = form.elements.id.value ? 'Guardar cambios' : 'Guardar observación'; }
}

async function exportPdf() {
  const selectedRun = state.tab === 'Historial' ? state.inspectionRuns.find(run => run.id === state.selectedInspectionId) : null;
  const rows = state.tab === 'Inicio' || state.tab === 'General'
    ? [...state.records].sort((a, b) => (b.inspectedAt || '').localeCompare(a.inspectedAt || ''))
    : state.tab === 'Historial' && selectedRun
      ? recordsForView().filter(row => row.inspectionId === selectedRun.id)
      : state.tab === 'Historial' && state.selectedInspectionDate !== null
        ? recordsForView().filter(row => (row.inspectedAt || '') === state.selectedInspectionDate)
      : recordsForView();
  if (!rows.length) { showToast('No hay observaciones para exportar.'); return; }
  const button = $('exportButton'); button.disabled = true;
  try {
    await loadPdfLibraries();
    const Pdf = globalThis.jspdf?.jsPDF;
    if (!Pdf || !Pdf.API.autoTable) throw new Error('No se pudo cargar el módulo PDF.');
    const pdf = new Pdf({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const title = state.tab === 'Inicio' ? 'Inspección completa' : selectedRun ? inspectionNumber(selectedRun) : state.tab === 'Historial' && state.selectedInspectionDate !== null ? inspectionNumber(state.selectedInspectionDate) : state.tab === 'Historial' ? 'Historial de inspecciones' : state.tab === 'General' ? 'Reporte general de inspección' : areaTitle(state.tab);
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
      { label: 'CUMPLE', value: counts.cumple, color: statusColors.cumple.accent },
      { label: 'NO CUMPLE', value: counts.no_cumple, color: statusColors.no_cumple.accent },
      { label: 'PARCIAL', value: counts.parcial, color: statusColors.parcial.accent },
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
      startY: tableStartY, showHead: 'everyPage', head: [['FECHA / NOTIFICACIÓN', 'ÁREA / UBICACIÓN', 'HALLAZGO / ACCIÓN / SEGUIMIENTO', 'RESPONSABLE', 'REGISTRÓ', 'DÍAS', 'ESTADO', 'FOTOS']],
      body: rows.map(row => [`${dateLabel(row.inspectedAt)}\nNotif.: ${row.notificationDateSource || dateLabel(row.notificationDate)}`, `${areaTitle(row.area)}${row.sourceSection ? `\n${row.sourceSection}` : ''}\n${row.location}`, `${row.description}${row.notes ? `\n${row.notes}` : ''}`, row.department || '—', row.inspectorName || row.createdByName || '—', daysOpen(row), STATUS[row.status] || '—', (row.photos || []).length ? '' : 'Sin evidencia']),
      theme: 'grid', styles: { font: 'helvetica', fontSize: 6.5, cellPadding: 1.8, textColor: palette.ink, lineColor: palette.line, lineWidth: .18, minCellHeight: 16, valign: 'middle', overflow: 'linebreak' },
      headStyles: { fillColor: palette.darkBlue, textColor: palette.white, fontSize: 6.1, fontStyle: 'bold', halign: 'left', cellPadding: 2.3 },
      alternateRowStyles: { fillColor: palette.pale },
      columnStyles: {
        0: { cellWidth: 18, fontSize: 5.5 }, 1: { cellWidth: 26, fontStyle: 'bold', fontSize: 5.8 }, 2: { cellWidth: 37, fontSize: 5.8 },
        3: { cellWidth: 19, fontSize: 5.5 }, 4: { cellWidth: 18, fontSize: 5.5 }, 5: { cellWidth: 10, halign: 'center', fontSize: 5.8 },
        6: { cellWidth: 21, halign: 'center', fontStyle: 'bold', fontSize: 5.8 }, 7: { cellWidth: 43, halign: 'center', fontSize: 5.8, textColor: palette.muted }
      },
      margin: { top: 38, left: 9, right: 9, bottom: 19 },
      willDrawPage: () => drawHeader(),
      didParseCell: data => {
        if (data.section !== 'body') return;
        const row = rows[data.row.index];
        if (data.column.index === 6) {
          const color = statusColors[row?.status] || statusColors.nueva;
          data.cell.styles.fillColor = color.fill; data.cell.styles.textColor = color.text;
          data.cell.styles.fontStyle = 'bold'; data.cell.styles.halign = 'center';
        }
        if (data.column.index === 7) {
          const photos = (row?.photos || []).slice(0, 6).filter(photo => imageData.get(photo.path || photo.previewUrl || photo.name));
          const lines = Math.ceil(photos.length / 2);
          data.cell.styles.minCellHeight = Math.max(16, lines ? 4 + lines * 9 + (lines - 1) * 1.2 : 16);
          if (!photos.length) { data.cell.styles.fontStyle = 'italic'; data.cell.styles.textColor = palette.muted; }
        }
      },
      didDrawCell: data => {
        if (data.section !== 'body' || data.column.index !== 7) return;
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
    const slug = state.tab.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    pdf.save(`reporte-inspeccion-${slug}-${new Date().toLocaleDateString('en-CA')}.pdf`);
  } catch (error) { showToast(`No se pudo generar el PDF: ${friendlyError(error)}`, true); }
  finally { button.disabled = false; }
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

document.addEventListener('click', event => {
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
$('logoutButton').addEventListener('click', () => state.demo ? exitDemo() : firebaseApi.signOut(firebaseApi.auth));
$('newInspection').addEventListener('click', async () => {
  const area = AREAS.includes(state.tab) ? state.tab : 'PLANTA';
  const selectedRun = state.tab === 'Historial' ? state.inspectionRuns.find(run => run.id === state.selectedInspectionId) : null;
  if (selectedRun?.status === 'en_curso') { state.activeInspectionId = selectedRun.id; state.activeInspectionNumber = selectedRun.inspectionNumber; openNewDialog(area); return; }
  const activeRun = state.inspectionRuns.find(run => run.id === state.activeInspectionId);
  if (activeRun?.status === 'en_curso' && !selectedRun) { openNewDialog(area); return; }
  try { await createInspection(area, true); } catch (error) { showToast(friendlyError(error), true); }
});
$('saveAreaButton').addEventListener('click', saveAreaProgress);
$('closeInspectionButton').addEventListener('click', closeInspection);
$('exportButton').addEventListener('click', exportPdf);
$('inspectionForm').addEventListener('submit', saveInspection);
$('correctionForm').addEventListener('submit', saveCorrection);
$('photoClose').addEventListener('click', () => $('photoDialog').close());
$('photoPrevious').addEventListener('click', () => stepPhoto(-1));
$('photoNext').addEventListener('click', () => stepPhoto(1));
$('photoReplaceButton').addEventListener('click', () => $('photoReplaceInput').click());
$('photoReplaceInput').addEventListener('change', event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) changeCurrentPhoto(file); });
$('photoDeleteButton').addEventListener('click', () => { if (window.confirm('¿Eliminar esta foto de la evidencia de la observación?')) changeCurrentPhoto(); });
$('photoDialog').addEventListener('close', () => { state.viewingPhoto = null; $('photoViewerImage').removeAttribute('src'); });
$('correctionCamera').addEventListener('change', event => handleCorrectionPhotoFiles(event.currentTarget));
$('correctionGallery').addEventListener('change', event => handleCorrectionPhotoFiles(event.currentTarget));
$('correctionPhotoPreview').addEventListener('click', event => { const remove = event.target.closest('[data-remove-correction-photo]'); if (remove) { state.correctionPhotos.splice(Number(remove.dataset.removeCorrectionPhoto), 1); drawCorrectionPhotoPreview(); } });
$('inspectionForm').elements.area.addEventListener('change', event => fillLocationOptions(event.currentTarget.value));
$('locationSelect').addEventListener('change', () => syncOtherChoice($('locationSelect'), $('locationOther')));
$('departmentSelect').addEventListener('change', () => syncOtherChoice($('departmentSelect'), $('departmentOther')));
$('closeDialog').addEventListener('click', () => $('inspectionDialog').close());
$('cancelDialog').addEventListener('click', () => $('inspectionDialog').close());
$('closeCorrection').addEventListener('click', () => $('correctionDialog').close());
$('cancelCorrection').addEventListener('click', () => $('correctionDialog').close());
$('filtersToggle').addEventListener('click', () => $('advancedFilters').hidden = !$('advancedFilters').hidden);
$('clearFilters').addEventListener('click', () => { for (const id of ['filterStatus', 'filterDepartment', 'filterFrom', 'filterTo']) $(id).value = ''; $('quickSearch').value = ''; $('filterOrder').value = 'desc'; render(); });
for (const id of ['quickSearch', 'filterStatus', 'filterDepartment', 'filterFrom', 'filterTo', 'filterOrder']) $(id).addEventListener('input', render);
$('cameraInput').addEventListener('change', event => handlePhotoFiles(event.currentTarget));
$('galleryInput').addEventListener('change', event => handlePhotoFiles(event.currentTarget));
$('mobileMenu').addEventListener('click', () => $('sidebar').classList.toggle('open'));
document.addEventListener('keydown', event => { if (event.key === 'Escape') $('sidebar').classList.remove('open'); });

initialize();

