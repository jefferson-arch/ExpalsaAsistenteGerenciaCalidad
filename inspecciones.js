const COLLECTION = 'expalsa_calidad_inspecciones';
const AREAS = ['PLANTA', 'EXTERIORES', 'BODEGAS', 'DESECHOS', 'DESPACHO', 'OTROS'];
const STATUS = { cumple: 'Cumple', no_cumple: 'No cumple', parcial: 'Parcial', nueva: 'Nueva observación' };
const LOCATIONS = {
  PLANTA: ['Vestidores / Ingreso a Planta', 'Recepción de materia prima', 'Descabezado (Planta baja)', 'Lavado de materiales', 'Precajas #1', 'Máquinas clasificadoras', 'Lavado de gavetas y canastillas', 'Brines #1 y #2', 'Brines #3, #4 y #5', 'Cuarto de salmuera', 'Precámara', 'Cámaras #1, #2 y #3', 'Cámaras #4, #5 y #6', 'Túneles', 'Decorado', 'Silo de hielo', 'Laboratorio de recepción'],
  EXTERIORES: ['Comedor', 'Lavandería', 'Baños del personal', 'Baño de mujeres de máquinas clasificadoras', 'Baño de mujeres de supervisoras', 'Baño de hombres', 'Pre-cajas #2', 'Exteriores de planta'],
  BODEGAS: ['Bodega de materiales', 'Bodega de químicos y repuestos', 'Bodega de metabisulfito'],
  DESECHOS: ['Brines #1 y #2', 'Cámaras #1, #2 y #3', 'Lavado de gavetas y bines', 'Área de disposición de desechos'],
  DESPACHO: ['Silo de hielo 2', 'Silo de hielo 3', 'Silo de hielo 4', 'Lavado de gavetas y bines', 'Muelle de despacho'],
  OTROS: ['Laboratorio de recepción', 'Servicios generales', 'Planta de agua', 'Otra área']
};
const DEMO_RECORDS = [
  { id: 'demo-001', area: 'PLANTA', inspectedAt: '2026-09-12', location: 'Vestidores / Ingreso a Planta', description: 'Lámpara atrapa insectos N.º 5 apagada o con tubos quemados.', department: 'MANTENIMIENTO - CALIDAD', notificationDate: '2026-09-12', status: 'nueva', notes: 'Nueva observación registrada en la inspección del 12/09/2026.', photos: [{ previewUrl: 'demo-evidence/planta.jpg', name: 'evidencia-lampara.jpg' }] },
  { id: 'demo-002', area: 'PLANTA', inspectedAt: '2026-09-12', location: 'Máquinas clasificadoras', description: 'Condensación en el tumbado y presencia de moho.', department: 'MANTENIMIENTO', notificationDate: '2026-09-12', status: 'nueva', notes: '', photos: [{ previewUrl: 'demo-evidence/galpon2.jpg', name: 'evidencia-condensacion.jpg' }] },
  { id: 'demo-003', area: 'PLANTA', inspectedAt: '2026-09-12', location: 'Brines #3, #4 y #5', description: 'Boquillas de la salmuera con presencia de óxido.', department: 'PRODUCCIÓN', notificationDate: '2026-09-12', status: 'parcial', notes: '' },
  { id: 'demo-004', area: 'EXTERIORES', inspectedAt: '2026-09-12', location: 'Baños del personal', description: 'Tachos de basura sin pedales; el personal no debe tener contacto con la mano.', department: 'SERVICIO GENERAL', notificationDate: '2026-09-12', status: 'nueva', notes: '', photos: [{ previewUrl: 'demo-evidence/exteriores.jpg', name: 'evidencia-tacho.jpg' }] },
  { id: 'demo-005', area: 'BODEGAS', inspectedAt: '2026-09-12', location: 'Bodega de materiales', description: 'Daño en la rastrera.', department: 'BODEGA', notificationDate: '2026-06-13', status: 'cumple', notes: 'Estado consignado como cumplido en el reporte.' },
  { id: 'demo-006', area: 'DESECHOS', inspectedAt: '2026-09-12', location: 'Brines #1 y #2', description: 'Se evidencia base dañada utilizada como recipiente para desechos.', department: 'PRODUCCIÓN', notificationDate: '2026-06-12', status: 'cumple', notes: '' },
  { id: 'demo-007', area: 'DESPACHO', inspectedAt: '2026-09-12', location: 'Silo de hielo 3', description: 'Chute: puertas con presencia de óxido.', department: 'DESPACHO Y LOGÍSTICA', notificationDate: '2026-09-12', status: 'nueva', notes: '', photos: [{ previewUrl: 'demo-evidence/despacho.jpg', name: 'evidencia-chute.jpg' }] },
  { id: 'demo-008', area: 'OTROS', inspectedAt: '2026-09-12', location: 'Laboratorio de recepción', description: 'Puerta de emergencia desprendida.', department: 'MANTENIMIENTO', notificationDate: '2026-03-09', status: 'no_cumple', notes: '' }
].map(row => ({ ...row, photos: (row.photos || []).map(photo => ({ ...photo })), source: 'ejemplo_inspeccion_2026-09-12' }));
const SECTIONS = [
  { id: 'Inicio', icon: '⌂', title: 'Inicio', description: 'Resumen de hallazgos y acciones de inspección.' },
  ...AREAS.map(area => ({ id: area, icon: ({ PLANTA: '▦', EXTERIORES: '⌂', BODEGAS: '▤', DESECHOS: '♲', DESPACHO: '⇧', OTROS: '⋯' })[area], title: area[0] + area.slice(1).toLowerCase(), description: `Observaciones registradas en ${area.toLowerCase()}.` })),
  { id: 'General', icon: '▧', title: 'General', description: 'Observaciones consolidadas de todas las instalaciones.' },
  { id: 'Historial', icon: '◷', title: 'Historial', description: 'Busca, filtra y revisa las inspecciones anteriores.' }
];

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const elapsedDays = value => value ? Math.floor((Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) - Date.parse(`${value}T00:00:00Z`)) / 86400000) : '—';
const state = { user: null, role: '', demo: false, tab: 'Inicio', records: [], unsubscribe: null, pendingPhotos: [], editingPhotos: [], toastTimer: null };
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
  const options = LOCATIONS[area] || LOCATIONS.OTROS;
  select.replaceChildren(new Option('Selecciona una ubicación', ''), ...options.map(value => new Option(value, value)), new Option('Otra ubicación…', '__other__'));
  if (selected && !options.includes(selected)) { select.value = '__other__'; other.value = selected; }
  else { select.value = selected; other.value = ''; }
  syncOtherChoice(select, other);
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
  $('sectionNav').innerHTML = SECTIONS.map(item => `<button class="nav-button${state.tab === item.id ? ' active' : ''}" data-tab="${item.id}" type="button"><span class="nav-icon">${item.icon}</span><span>${item.title}</span></button>`).join('');
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

function render() {
  if (!state.user) return;
  drawNavigation();
  const selected = SECTIONS.find(item => item.id === state.tab) || SECTIONS[0];
  $('currentCrumb').textContent = selected.title;
  $('pageTitle').textContent = selected.title;
  $('pageDescription').textContent = selected.description;
  $('pageEyebrow').textContent = state.tab === 'Historial' ? 'CONSULTA Y SEGUIMIENTO' : 'CONTROL DE INSTALACIONES';
  $('dashboardView').hidden = state.tab !== 'Inicio';
  $('listView').hidden = state.tab === 'Inicio';
  $('listScope').textContent = AREAS.includes(state.tab) ? selected.title : 'Todas las áreas';
  const filtered = recordsForView();
  $('resultCount').textContent = `${filtered.length} ${filtered.length === 1 ? 'observación' : 'observaciones'}`;
  $('recordsBody').innerHTML = filtered.map(row => `<tr>
    <td><div class="date-area"><strong>${escapeHtml(dateLabel(row.inspectedAt))}</strong><span>${escapeHtml(row.area)} · ${escapeHtml(row.location)}</span></div></td>
    <td><span class="finding-title">${escapeHtml(row.description)}</span>${row.notes ? `<span class="finding-note">${escapeHtml(row.notes)}</span>` : ''}</td>
    <td class="department-cell">${escapeHtml(row.department || '—')}</td>
    <td>${escapeHtml(elapsedDays(row.notificationDate))}</td>
    <td><span class="status-pill status-${escapeHtml(row.status)}">${escapeHtml(STATUS[row.status] || 'Sin estado')}</span></td>
    <td><span class="photo-count">${(row.photos || []).length ? `▧ ${(row.photos || []).length} foto${row.photos.length > 1 ? 's' : ''}` : '—'}</span></td>
    <td><button class="row-actions" data-edit="${escapeHtml(row.id)}" type="button" aria-label="Editar observación">↗</button></td>
  </tr>`).join('');
  $('emptyState').hidden = filtered.length > 0;
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
    const count = rows.filter(row => row.area === area).length;
    const pct = rows.length ? count / rows.length * 100 : 0;
    return `<div class="category-row"><span>${areaTitle(area)}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><b>${count}</b></div>`;
  }).join('');
  const recent = [...rows].sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt)).slice(0, 5);
  $('recentRows').innerHTML = recent.length ? `<div class="recent-list">${recent.map(row => `<div class="recent-row"><span class="recent-date">${escapeHtml(dateLabel(row.inspectedAt))}</span><span class="recent-finding">${escapeHtml(row.description)}</span><span class="recent-location">${escapeHtml(row.area)} · ${escapeHtml(row.location)}</span><span class="status-pill status-${escapeHtml(row.status)}">${escapeHtml(STATUS[row.status] || '')}</span><button class="row-actions" type="button" data-edit="${escapeHtml(row.id)}" aria-label="Editar observación">↗</button></div>`).join('')}</div>` : '<div class="empty-state"><div class="empty-glyph">▧</div><h3>Tu historial empieza aquí</h3><p>Las observaciones guardadas aparecerán en este resumen.</p></div>';
}

function areaTitle(area) { return area ? area[0] + area.slice(1).toLowerCase() : ''; }

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
    if (access.active === true && access.deleted !== true && String(access.email).toLowerCase() === String(user.email).toLowerCase()) return 'inspector';
  }
  throw new Error('La cuenta requiere aprobación del administrador de EXPALSA Calidad.');
}

function startRecordsListener() {
  const { db, collection, onSnapshot } = firebaseApi;
  if (state.unsubscribe) state.unsubscribe();
  state.unsubscribe = onSnapshot(collection(db, COLLECTION), snapshot => {
    state.records = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    state.records.sort((a, b) => (b.inspectedAt || '').localeCompare(a.inspectedAt || ''));
    setConnection(true, 'Datos sincronizados con Firebase');
    $('updatedAtLabel').textContent = `Actualizado ${new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`;
    render();
  }, error => { setConnection(false, 'Sin acceso a los datos'); showToast(friendlyError(error), true); });
}

function startApp(user, role) {
  state.user = user; state.role = role; state.demo = false;
  $('userEmail').textContent = user.email || 'Inspector';
  $('userInitial').textContent = (user.email || 'I').charAt(0).toUpperCase();
  $('resetDemoButton').hidden = true;
  $('logoutButton').textContent = 'Salir';
  $('authGate').hidden = true; $('appShell').hidden = false;
  startRecordsListener();
}

function enterDemo() {
  if (state.unsubscribe) state.unsubscribe(); state.unsubscribe = null;
  state.user = { uid: 'demo-local', email: 'ejemplo@expalsa.local', displayName: 'Ejemplo local' };
  state.role = 'demo'; state.demo = true; state.tab = 'Inicio'; state.records = DEMO_RECORDS.map(row => ({ ...row, photos: row.photos.map(photo => ({ ...photo })) }));
  $('userEmail').textContent = 'Modo ejemplo'; $('userInitial').textContent = 'E';
  $('updatedAtLabel').textContent = 'Ejemplo local · no se guarda en Firebase';
  $('authGate').hidden = true; $('appShell').hidden = false;
  $('resetDemoButton').hidden = false; $('logoutButton').textContent = 'Salir del ejemplo';
  setConnection(true, 'Ejemplo local · sin Firebase'); render();
}

function resetDemo() {
  if (!state.demo) return;
  state.records = DEMO_RECORDS.map(row => ({ ...row, photos: row.photos.map(photo => ({ ...photo })) })); state.tab = 'Inicio';
  $('quickSearch').value = '';
  for (const id of ['filterStatus', 'filterDepartment', 'filterFrom', 'filterTo']) $(id).value = '';
  $('filterOrder').value = 'desc'; render(); showToast('Ejemplo recargado.');
}

function exitDemo() {
  state.demo = false; state.user = null; state.records = []; state.tab = 'Inicio';
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

function openNewDialog(area = AREAS.includes(state.tab) ? state.tab : 'PLANTA') {
  const form = $('inspectionForm'); form.reset(); form.elements.id.value = '';
  form.elements.area.value = area; fillLocationOptions(area); fillDepartment();
  form.elements.inspectedAt.value = new Date().toLocaleDateString('en-CA'); form.elements.status.value = 'nueva';
  state.pendingPhotos = []; state.editingPhotos = [];
  $('dialogTitle').textContent = 'Nueva observación'; $('saveInspection').textContent = 'Guardar observación';
  $('saveHint').textContent = `Inspector: ${state.user.email || 'Cuenta autorizada'}`;
  drawPhotoPreview(); $('inspectionDialog').showModal();
}

async function openEditDialog(id) {
  const row = state.records.find(item => item.id === id); if (!row) return;
  const form = $('inspectionForm'); form.reset(); form.elements.id.value = row.id;
  for (const key of ['area', 'inspectedAt', 'description', 'notificationDate', 'status', 'notes']) form.elements[key].value = row[key] || '';
  fillLocationOptions(row.area, row.location); fillDepartment(row.department);
  state.pendingPhotos = []; state.editingPhotos = (row.photos || []).map(photo => ({ ...photo }));
  $('dialogTitle').textContent = 'Editar observación'; $('saveInspection').textContent = 'Guardar cambios';
  $('saveHint').textContent = `Creado por ${row.inspectorEmail || row.inspectorName || 'inspector'}`;
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
    if (state.demo) {
      const photos = [...state.editingPhotos, ...state.pendingPhotos.map(photo => ({ preview: photo.preview, name: photo.name, origin: photo.origin }))];
      const record = { ...fields, id, photos, source: 'ejemplo_inspeccion_2026-09-12', inspectorName: 'Ejemplo local', inspectorEmail: state.user.email, inspectorUid: state.user.uid };
      const index = state.records.findIndex(item => item.id === id);
      if (index >= 0) state.records[index] = record; else state.records.unshift(record);
      $('inspectionDialog').close(); state.pendingPhotos = []; render(); showToast('Observación guardada en el ejemplo local.');
      return;
    }
    const { db, doc, collection, setDoc, serverTimestamp, ref, uploadBytes } = firebaseApi;
    const photos = [...state.editingPhotos];
    for (const file of state.pendingPhotos) {
      const path = `expalsa_inspecciones/${state.user.uid}/${id}/${crypto.randomUUID()}.jpg`;
      await uploadBytes(ref(firebaseApi.storage, path), file.blob, { contentType: 'image/jpeg', customMetadata: { origin: file.origin, uploadedBy: state.user.uid } });
      photos.push({ path, name: file.name.slice(0, 120), uploadedBy: state.user.uid, origin: file.origin });
    }
    const payload = {
      ...fields, photos, inspectorName: current?.inspectorName || state.user.displayName || state.user.email.split('@')[0],
      inspectorEmail: current?.inspectorEmail || state.user.email, inspectorUid: current?.inspectorUid || state.user.uid,
      createdBy: current?.createdBy || state.user.uid, createdAt: current?.createdAt || serverTimestamp(),
      updatedBy: state.user.uid, updatedAt: serverTimestamp(),
      source: current?.source || 'app'
    };
    await setDoc(doc(db, COLLECTION, id), payload);
    $('inspectionDialog').close(); showToast(current ? 'La observación fue actualizada.' : 'Observación guardada en Firebase.');
  } catch (error) { showToast(friendlyError(error), true); }
  finally { saveButton.disabled = false; saveButton.textContent = form.elements.id.value ? 'Guardar cambios' : 'Guardar observación'; }
}

async function exportPdf() {
  const rows = recordsForView();
  if (!rows.length) { showToast('No hay observaciones para exportar.'); return; }
  const button = $('exportButton'); button.disabled = true;
  try {
    await loadPdfLibraries();
    const Pdf = globalThis.jspdf?.jsPDF;
    if (!Pdf || !Pdf.API.autoTable) throw new Error('No se pudo cargar el módulo PDF.');
    const pdf = new Pdf({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const title = state.tab === 'Historial' ? 'Historial de inspecciones' : state.tab === 'General' ? 'Todas las áreas' : areaTitle(state.tab);
    const generated = new Date().toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
    const palette = {
      olive: [61, 71, 39], oliveMid: [106, 116, 68], oliveSoft: [229, 233, 218],
      brown: [126, 91, 62], sand: [239, 231, 216], paper: [250, 248, 243],
      ink: [55, 51, 43], muted: [117, 108, 94], line: [222, 216, 204], white: [255, 255, 255]
    };
    const statusColors = {
      cumple: { fill: [224, 235, 216], text: [58, 91, 48], accent: [91, 124, 62] },
      no_cumple: { fill: [240, 225, 216], text: [128, 72, 51], accent: [154, 91, 63] },
      parcial: { fill: [243, 233, 208], text: [126, 94, 46], accent: [172, 132, 59] },
      nueva: { fill: [235, 235, 225], text: [85, 89, 65], accent: [121, 124, 91] }
    };
    const counts = Object.fromEntries(Object.keys(STATUS).map(key => [key, rows.filter(row => row.status === key).length]));
    let logoData = null;
    try {
      const response = await fetch('logoexpalsa.png');
      if (response.ok) logoData = await dataUrl(await response.blob());
    } catch { /* continue with the text brand if the logo is unavailable */ }

    const drawHeader = () => {
      pdf.setFillColor(...palette.olive); pdf.rect(0, 0, 297, 36, 'F');
      pdf.setFillColor(...palette.oliveMid); pdf.rect(0, 34, 297, 2, 'F');
      pdf.setFillColor(...palette.white); pdf.roundedRect(13, 7, 43, 21, 2, 2, 'F');
      if (logoData) {
        try { pdf.addImage(logoData, 'PNG', 15, 12, 39, 10, undefined, 'FAST'); } catch { /* keep the report usable without the logo */ }
      }
      pdf.setTextColor(...palette.white); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8);
      pdf.text('EXPALSA  /  SISTEMA DE GESTIÓN DE CALIDAD', 64, 11);
      pdf.setFontSize(16); pdf.text('REPORTE DE INSPECCIÓN', 64, 21);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(232, 229, 214);
      pdf.text(title.toLocaleUpperCase('es-EC'), 64, 29);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(230, 225, 209);
      pdf.text('INSPECCIÓN INTERNA', 283, 12, { align: 'right' });
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...palette.white);
      pdf.text(dateLabel(rows[0]?.inspectedAt) === '—' ? 'Fecha no registrada' : `Inspección: ${dateLabel(rows[0]?.inspectedAt)}`, 283, 20, { align: 'right' });
      pdf.setTextColor(230, 225, 209); pdf.setFontSize(7);
      pdf.text(`Generado ${generated}`, 283, 28, { align: 'right' });
    };
    drawHeader();

    const metrics = [
      { label: 'HALLAZGOS', value: rows.length, color: palette.brown },
      { label: 'CUMPLE', value: counts.cumple, color: statusColors.cumple.accent },
      { label: 'NO CUMPLE', value: counts.no_cumple, color: statusColors.no_cumple.accent },
      { label: 'PARCIAL', value: counts.parcial, color: statusColors.parcial.accent },
      { label: 'NUEVAS', value: counts.nueva, color: statusColors.nueva.accent }
    ];
    const metricGap = 3, metricX = 14, metricY = 41, metricH = 18;
    const metricW = (269 - metricGap * (metrics.length - 1)) / metrics.length;
    metrics.forEach((metric, index) => {
      const x = metricX + index * (metricW + metricGap);
      pdf.setFillColor(...palette.paper); pdf.setDrawColor(...palette.line); pdf.setLineWidth(.2);
      pdf.roundedRect(x, metricY, metricW, metricH, 1.8, 1.8, 'FD');
      pdf.setFillColor(...metric.color); pdf.roundedRect(x, metricY, 1.6, metricH, .8, .8, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5); pdf.setTextColor(...palette.muted);
      pdf.text(metric.label, x + 4, metricY + 6.5);
      pdf.setFontSize(13); pdf.setTextColor(...palette.ink);
      pdf.text(String(metric.value), x + metricW - 3, metricY + 14, { align: 'right' });
    });
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...palette.olive);
    pdf.text('DETALLE DE HALLAZGOS', 14, 66);
    pdf.setDrawColor(...palette.line); pdf.setLineWidth(.35); pdf.line(14, 68, 283, 68);

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
      startY: 72, showHead: 'everyPage', head: [['FECHA', 'ÁREA / UBICACIÓN', 'HALLAZGO / ACCIÓN / SEGUIMIENTO', 'RESPONSABLE', 'DÍAS', 'ESTADO', 'EVIDENCIA FOTOGRÁFICA']],
      body: rows.map(row => [dateLabel(row.inspectedAt), `${row.area}\n${row.location}`, `${row.description}${row.notes ? `\nSeguimiento: ${row.notes}` : ''}`, row.department || '—', elapsedDays(row.notificationDate), STATUS[row.status] || '—', (row.photos || []).length ? '' : 'Sin evidencia']),
      theme: 'grid', styles: { font: 'helvetica', fontSize: 7.4, cellPadding: 2.4, textColor: palette.ink, lineColor: palette.line, lineWidth: .2, minCellHeight: 16, valign: 'middle', overflow: 'linebreak' },
      headStyles: { fillColor: palette.olive, textColor: palette.white, fontSize: 7, fontStyle: 'bold', halign: 'left', cellPadding: 3 },
      alternateRowStyles: { fillColor: [248, 246, 239] },
      columnStyles: {
        0: { cellWidth: 22, fontSize: 7 }, 1: { cellWidth: 43, fontStyle: 'bold' }, 2: { cellWidth: 77 },
        3: { cellWidth: 32, fontSize: 7 }, 4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 26, halign: 'center', fontStyle: 'bold' }, 6: { cellWidth: 50, halign: 'center', fontSize: 6.5, textColor: palette.muted }
      },
      margin: { top: 40, left: 14, right: 14, bottom: 18 },
      willDrawPage: () => drawHeader(),
      didParseCell: data => {
        if (data.section !== 'body') return;
        const row = rows[data.row.index];
        if (data.column.index === 5) {
          const color = statusColors[row?.status] || statusColors.nueva;
          data.cell.styles.fillColor = color.fill; data.cell.styles.textColor = color.text;
          data.cell.styles.fontStyle = 'bold'; data.cell.styles.halign = 'center';
        }
        if (data.column.index === 6) {
          const photos = (row?.photos || []).slice(0, 6).filter(photo => imageData.get(photo.path || photo.previewUrl || photo.name));
          const lines = Math.ceil(photos.length / 3);
          data.cell.styles.minCellHeight = Math.max(16, lines ? 4.5 + lines * 10 + (lines - 1) * 1.5 : 16);
          if (!photos.length) { data.cell.styles.fontStyle = 'italic'; data.cell.styles.textColor = palette.muted; }
        }
      },
      didDrawCell: data => {
        if (data.section !== 'body' || data.column.index !== 6) return;
        const photos = (rows[data.row.index]?.photos || []).slice(0, 6).filter(photo => imageData.get(photo.path || photo.previewUrl || photo.name));
        photos.forEach((photo, index) => {
          const key = photo.path || photo.previewUrl || photo.name, source = imageData.get(key);
          const col = index % 3, line = Math.floor(index / 3), boxW = 13, boxH = 10, gapX = 1.5, gapY = 1.5;
          const rowW = 3 * boxW + 2 * gapX, startX = data.cell.x + Math.max(2, (data.cell.width - rowW) / 2);
          const x = startX + col * (boxW + gapX), y = data.cell.y + 2.2 + line * (boxH + gapY);
          try {
            pdf.setDrawColor(...palette.line); pdf.setFillColor(...palette.white); pdf.roundedRect(x, y, boxW, boxH, 1, 1, 'FD');
            const properties = pdf.getImageProperties(source), scale = Math.min((boxW - 1) / properties.width, (boxH - 1) / properties.height);
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
      pdf.setPage(page); pdf.setDrawColor(...palette.line); pdf.setLineWidth(.3); pdf.line(14, 199, 283, 199);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(...palette.muted);
      pdf.text('EXPALSA  ·  Sistema de gestión de calidad', 14, 204);
      pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...palette.olive);
      pdf.text(`PÁGINA ${page} DE ${pages}`, 283, 204, { align: 'right' });
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
  if (nav) { state.tab = nav.dataset.tab; $('sidebar').classList.remove('open'); render(); return; }
  const edit = event.target.closest('[data-edit]'); if (edit) { openEditDialog(edit.dataset.edit); return; }
  if (event.target.closest('[data-create]')) { openNewDialog(); return; }
  const tabLink = event.target.closest('[data-open-tab]'); if (tabLink) { state.tab = tabLink.dataset.openTab; render(); return; }
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
$('newInspection').addEventListener('click', () => openNewDialog());
$('exportButton').addEventListener('click', exportPdf);
$('inspectionForm').addEventListener('submit', saveInspection);
$('inspectionForm').elements.area.addEventListener('change', event => fillLocationOptions(event.currentTarget.value));
$('locationSelect').addEventListener('change', () => syncOtherChoice($('locationSelect'), $('locationOther')));
$('departmentSelect').addEventListener('change', () => syncOtherChoice($('departmentSelect'), $('departmentOther')));
$('closeDialog').addEventListener('click', () => $('inspectionDialog').close());
$('cancelDialog').addEventListener('click', () => $('inspectionDialog').close());
$('filtersToggle').addEventListener('click', () => $('advancedFilters').hidden = !$('advancedFilters').hidden);
$('clearFilters').addEventListener('click', () => { for (const id of ['filterStatus', 'filterDepartment', 'filterFrom', 'filterTo']) $(id).value = ''; $('quickSearch').value = ''; $('filterOrder').value = 'desc'; render(); });
for (const id of ['quickSearch', 'filterStatus', 'filterDepartment', 'filterFrom', 'filterTo', 'filterOrder']) $(id).addEventListener('input', render);
$('cameraInput').addEventListener('change', event => handlePhotoFiles(event.currentTarget));
$('galleryInput').addEventListener('change', event => handlePhotoFiles(event.currentTarget));
$('mobileMenu').addEventListener('click', () => $('sidebar').classList.toggle('open'));
document.addEventListener('keydown', event => { if (event.key === 'Escape') $('sidebar').classList.remove('open'); });

initialize();

