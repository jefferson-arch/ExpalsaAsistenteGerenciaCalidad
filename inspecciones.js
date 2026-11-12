const COLLECTION = 'expalsa_calidad_inspecciones';
const AREAS = ['PLANTA', 'EXTERIORES', 'BODEGAS', 'DESECHOS', 'DESPACHO', 'OTROS'];
const STATUS = { cumple: 'Cumple', no_cumple: 'No cumple', parcial: 'Parcial', nueva: 'Nueva observación' };
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
const state = { user: null, role: '', tab: 'Inicio', records: [], unsubscribe: null, pendingPhotos: [], editingPhotos: [], toastTimer: null };
let firebaseApi;

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
  state.user = user; state.role = role;
  $('userEmail').textContent = user.email || 'Inspector';
  $('userInitial').textContent = (user.email || 'I').charAt(0).toUpperCase();
  $('authGate').hidden = true; $('appShell').hidden = false;
  startRecordsListener();
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

function drawPhotoPreview() {
  const preview = $('photoPreview');
  preview.innerHTML = [...state.editingPhotos.map(photo => ({ ...photo, existing: true })), ...state.pendingPhotos].map((photo, index) => `<div class="photo-thumb"><img src="${escapeHtml(photo.preview)}" alt="Evidencia ${index + 1}">${photo.existing ? '' : `<button type="button" data-remove-photo="${index - state.editingPhotos.length}" aria-label="Quitar foto">×</button>`}</div>`).join('');
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
  form.elements.area.value = area; form.elements.inspectedAt.value = new Date().toLocaleDateString('en-CA'); form.elements.status.value = 'nueva';
  state.pendingPhotos = []; state.editingPhotos = [];
  $('dialogTitle').textContent = 'Nueva observación'; $('saveInspection').textContent = 'Guardar observación';
  $('saveHint').textContent = `Inspector: ${state.user.email || 'Cuenta autorizada'}`;
  drawPhotoPreview(); $('inspectionDialog').showModal();
}

async function openEditDialog(id) {
  const row = state.records.find(item => item.id === id); if (!row) return;
  const form = $('inspectionForm'); form.reset(); form.elements.id.value = row.id;
  for (const key of ['area', 'inspectedAt', 'location', 'description', 'department', 'notificationDate', 'status', 'notes']) form.elements[key].value = row[key] || '';
  state.pendingPhotos = []; state.editingPhotos = (row.photos || []).map(photo => ({ ...photo }));
  $('dialogTitle').textContent = 'Editar observación'; $('saveInspection').textContent = 'Guardar cambios';
  $('saveHint').textContent = `Creado por ${row.inspectorEmail || row.inspectorName || 'inspector'}`;
  drawPhotoPreview(); $('inspectionDialog').showModal();
  for (const [i, photo] of state.editingPhotos.entries()) {
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
    const { db, doc, collection, setDoc, serverTimestamp, ref, uploadBytes } = firebaseApi;
    const id = form.elements.id.value || doc(collection(db, COLLECTION)).id;
    const current = state.records.find(item => item.id === id);
    const photos = [...state.editingPhotos];
    for (const file of state.pendingPhotos) {
      const path = `expalsa_inspecciones/${state.user.uid}/${id}/${crypto.randomUUID()}.jpg`;
      await uploadBytes(ref(firebaseApi.storage, path), file.blob, { contentType: 'image/jpeg', customMetadata: { origin: file.origin, uploadedBy: state.user.uid } });
      photos.push({ path, name: file.name.slice(0, 120), uploadedBy: state.user.uid, origin: file.origin });
    }
    const fields = Object.fromEntries(['area', 'inspectedAt', 'location', 'description', 'department', 'notificationDate', 'status', 'notes'].map(key => [key, form.elements[key].value.trim()]));
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
  const Pdf = globalThis.jspdf?.jsPDF;
  if (!Pdf || !Pdf.API.autoTable) { showToast('No se pudo cargar el módulo PDF. Revisa tu conexión e inténtalo de nuevo.', true); return; }
  const rows = recordsForView();
  if (!rows.length) { showToast('No hay observaciones para exportar.'); return; }
  const button = $('exportButton'); button.disabled = true;
  try {
    const pdf = new Pdf({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const title = state.tab === 'Historial' ? 'Historial de inspecciones' : `Reporte de inspección · ${state.tab === 'General' ? 'General' : areaTitle(state.tab)}`;
    pdf.setFillColor(18, 38, 63); pdf.rect(0, 0, 297, 40, 'F');
    pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.text('EXPALSA · SISTEMA DE GESTIÓN DE CALIDAD', 14, 15);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11); pdf.text(title, 14, 24);
    pdf.setTextColor(204, 218, 230); pdf.setFontSize(8); pdf.text(`Generado ${new Date().toLocaleString('es-EC')}   ·   ${rows.length} observaciones`, 14, 32);
    const imageData = new Map();
    for (const row of rows) for (const photo of (row.photos || []).slice(0, 6)) {
      if (!imageData.has(photo.path)) {
        try { const bytes = await firebaseApi.getBytes(firebaseApi.ref(firebaseApi.storage, photo.path)); imageData.set(photo.path, await dataUrl(new Blob([bytes], { type: 'image/jpeg' }))); }
        catch { imageData.set(photo.path, null); }
      }
    }
    pdf.autoTable({
      startY: 45, head: [['FECHA', 'ÁREA / UBICACIÓN', 'HALLAZGO / ACCIÓN', 'DEPARTAMENTO', 'DÍAS', 'ESTADO', 'EVIDENCIA']],
      body: rows.map(row => [dateLabel(row.inspectedAt), `${row.area} · ${row.location}`, `${row.description}${row.notes ? `\nAcción: ${row.notes}` : ''}`, row.department || '—', elapsedDays(row.notificationDate), STATUS[row.status] || '—', (row.photos || []).length ? ' ' : 'Sin fotos']),
      theme: 'grid', styles: { font: 'helvetica', fontSize: 7.2, cellPadding: 3, textColor: [50, 68, 86], lineColor: [225, 231, 236], lineWidth: .15, minCellHeight: 31, valign: 'middle' },
      headStyles: { fillColor: [30, 63, 91], textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 249, 250] },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 43 }, 2: { cellWidth: 83 }, 3: { cellWidth: 38 }, 4: { cellWidth: 15, halign: 'center' }, 5: { cellWidth: 28, halign: 'center' }, 6: { cellWidth: 43, halign: 'center' } },
      didDrawCell: data => {
        if (data.section !== 'body' || data.column.index !== 6) return;
        const photos = (rows[data.row.index]?.photos || []).slice(0, 6).filter(photo => imageData.get(photo.path));
        photos.forEach((photo, index) => {
          const col = index % 3, line = Math.floor(index / 3);
          try { pdf.addImage(imageData.get(photo.path), 'JPEG', data.cell.x + 2 + col * 14, data.cell.y + 2 + line * 13, 12, 10, undefined, 'FAST'); } catch { /* omit an unreadable thumbnail */ }
        });
      },
      margin: { left: 12, right: 12, bottom: 15 }, rowPageBreak: 'avoid'
    });
    const pages = pdf.internal.getNumberOfPages();
    for (let page = 1; page <= pages; page++) { pdf.setPage(page); pdf.setFontSize(7); pdf.setTextColor(127, 140, 153); pdf.text(`EXPALSA · Calidad e inocuidad`, 12, 204); pdf.text(`${page} / ${pages}`, 285, 204, { align: 'right' }); }
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
    const [appModule, authModule, dbModule, storageModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-storage.js`)
    ]);
    const app = appModule.initializeApp(cfg, 'expalsa-inspecciones');
    const auth = authModule.getAuth(app);
    const db = dbModule.getFirestore(app);
    const storage = storageModule.getStorage(app);
    firebaseApi = { ...authModule, ...dbModule, ...storageModule, auth, db, storage };
    $('authMessage').textContent = 'Conexión lista. Inicia sesión con tu cuenta autorizada.';
    authModule.onAuthStateChanged(auth, async user => {
      if (!user) {
        if (state.unsubscribe) state.unsubscribe(); state.unsubscribe = null; state.user = null; state.records = [];
        $('appShell').hidden = true; $('authGate').hidden = false; setConnection(false, 'Conexión pendiente'); return;
      }
      try { const role = await verifyRole(user); startApp(user, role); }
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
  const data = new FormData(event.currentTarget);
  try { await firebaseApi.signInWithEmailAndPassword(firebaseApi.auth, data.get('email'), data.get('password')); }
  catch (error) { $('authMessage').textContent = friendlyError(error); $('authMessage').classList.add('error'); }
});
$('logoutButton').addEventListener('click', () => firebaseApi.signOut(firebaseApi.auth));
$('newInspection').addEventListener('click', () => openNewDialog());
$('exportButton').addEventListener('click', exportPdf);
$('inspectionForm').addEventListener('submit', saveInspection);
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

