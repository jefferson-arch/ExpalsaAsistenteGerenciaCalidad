/* EXPALSA · Firebase Auth + Firestore, módulos oficiales de la CDN.
   Requiere configurar firebase-config.js antes de publicar. */
const el = id => document.getElementById(id);
const info = text => { el('expalsaAuthMessage').textContent = text; };
const gate = el('expalsaAuthGate');
const uiStatus = (message, failed = false) => {
  el('cloudConnection').textContent = message;
  const s = el('saveStatus');
  if (s) { s.textContent = message; s.classList.toggle('error', failed); }
  el('cloudRetry').hidden = !failed;
};
const cfg = window.EXPALSA_FIREBASE_CONFIG;
if (!cfg || !cfg.apiKey || cfg.apiKey.includes('PEGAR_') || !cfg.appId || cfg.appId.includes('PEGAR_') || cfg.projectId !== 'oceantreasure-app') {
  info('Falta completar firebase-config.js. Obtén la configuración de la aplicación web EXPALSA en Firebase Console; esta página no almacena datos hasta que se configure.');
  el('expalsaLoginButton').disabled = true;
} else {
  try {
    const V = '13.0.0';
    const [{ initializeApp }, { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence }, { getFirestore, collection, getDocs, doc, getDoc, runTransaction, serverTimestamp }] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)
    ]);
    const app = initializeApp(cfg, 'expalsa-calidad-web');
    const auth = getAuth(app);
    const db = getFirestore(app);
    await setPersistence(auth, browserSessionPersistence);
    const allowedKinds = new Set(Object.keys(window.EXPALSA_DATA.schemas));
    let loggedUser = null;
    let role = null;
    let started = false;
    let flushTimer = null;
    let sending = false;
    let dirty = false;
    let lastCommitted = new Map();
    let wanted = null;

    // Orden estable para detectar cambios o conflictos de edición sin depender del orden de las claves.
    const stable = value => JSON.stringify(value, function (_key, val) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        return Object.fromEntries(Object.keys(val).sort().map(k => [k, val[k]]));
      }
      return val;
    });
    const sourceMap = data => {
      const out = new Map();
      for (const profile of data.profiles) {
        const id = profile.id;
        if (typeof id !== 'string' || !id || id.includes('/')) throw Error('Identificador de expediente no admitido: ' + id);
        out.set('p:' + id, { id, payload: profile, collection: 'expalsa_calidad_perfiles' });
      }
      for (const [kind, rows] of Object.entries(data.logs)) {
        if (!allowedKinds.has(kind)) continue;
        for (const row of rows) {
          const id = row.id;
          if (typeof id !== 'string' || !id || id.includes('/')) throw Error('Identificador de registro no admitido: ' + id);
          if (out.has('r:' + id)) throw Error('ID de registro duplicado entre formularios: ' + id);
          out.set('r:' + id, { id, payload: row, kind, collection: 'expalsa_calidad_registros' });
        }
      }
      return out;
    };

    async function loadCloud() {
      // No lee ni escribe colecciones existentes de OCEANTREASURE.
      const [pSnap, rSnap] = await Promise.all([
        getDocs(collection(db, 'expalsa_calidad_perfiles')),
        getDocs(collection(db, 'expalsa_calidad_registros'))
      ]);
      const initial = window.ExpalsaCore.emptyState();
      for (const row of pSnap.docs) initial.profiles.push(row.data().payload);
      for (const row of rSnap.docs) {
        const data = row.data();
        if (!allowedKinds.has(data.kind)) throw Error('Se encontró un formulario no reconocido: ' + data.kind);
        initial.logs[data.kind].push(data.payload);
      }
      const normalized = window.ExpalsaCore.validateState(initial);
      lastCommitted = new Map([...sourceMap(normalized)].map(([key, item]) => [key, stable(item.payload)]));
      return normalized;
    }

    function requestSync(snapshot) {
      if (role !== 'admin' && role !== 'editor') throw Error('La cuenta no está autorizada para escribir.');
      const valid = window.ExpalsaCore.validateState(snapshot);
      const map = sourceMap(valid);
      // Previene enviar un documento mayor que el límite de Firestore.
      for (const item of map.values()) if (new Blob([JSON.stringify(item.payload)]).size > 850000) {
        throw Error('Un documento supera el tamaño recomendado para Firestore. Exporta un respaldo JSON.');
      }
      wanted = valid;
      dirty = true;
      uiStatus('Cambios pendientes de sincronización…');
      clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, 950);
    }

    async function flush() {
      if (sending || !wanted || !loggedUser) return;
      sending = true;
      const current = wanted;
      let total = 0;
      try {
        const target = sourceMap(current);
        for (const [key, item] of target) {
          const encoded = stable(item.payload);
          const previous = lastCommitted.get(key);
          if (encoded === previous) continue;
          const docRef = doc(db, item.collection, item.id);
          // Evita sobrescribir una edición que otra persona realizó tras nuestra carga.
          await runTransaction(db, async t => {
            const latest = await t.get(docRef);
            const serverValue = latest.exists() ? stable(latest.data().payload) : undefined;
            if (serverValue !== previous) {
              throw Error('CONFLICTO: ' + item.id + ' fue modificado en otro equipo. Descarga un respaldo JSON, luego actualiza desde Firestore antes de continuar.');
            }
            t.set(docRef, {
              payload: item.payload,
              updatedBy: loggedUser.email || '',
              changedAt: serverTimestamp(),
              ...(item.kind ? {kind: item.kind} : {})
            });
          });
          lastCommitted.set(key, encoded);
          total++;
        }
        if (wanted === current) {
          wanted = null;
          dirty = false;
          uiStatus('Sincronizado con Firestore · ' + new Date().toLocaleTimeString('es-EC'));
        } else {
          uiStatus('Sincronizando cambios nuevos…');
        }
      } catch (error) {
        console.error('EXPALSA Firestore:', error);
        dirty = true;
        uiStatus('Error de sincronización: ' + error.message, true);
      } finally {
        sending = false;
        if (wanted && wanted !== current) flushTimer = setTimeout(flush, 200);
      }
    }

    function errorText(error) {
      const code = error?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'Usuario o contraseña incorrectos.';
      if (code === 'auth/invalid-email') return 'El formato del correo es incorrecto.';
      if (code === 'auth/too-many-requests') return 'Demasiados intentos. Intenta más tarde.';
      if (code === 'permission-denied') return 'Acceso denegado por las reglas de Firestore. Verifica que estén publicadas y que la cuenta tenga permisos.';
      return (error?.message || 'Error desconocido').slice(0, 400);
    }

    el('expalsaLoginForm').addEventListener('submit', async event => {
      event.preventDefault();
      el('expalsaLoginButton').disabled = true;
      info('Verificando las credenciales…');
      try {
        await signInWithEmailAndPassword(auth, el('expalsaEmail').value.trim(), el('expalsaPassword').value);
        el('expalsaPassword').value = '';
      } catch (err) {
        info(errorText(err));
        el('expalsaLoginButton').disabled = false;
      }
    });

    onAuthStateChanged(auth, async user => {
      if (!user) {
        loggedUser = null;
        role = null;
        gate.style.display = 'flex';
        el('cloudBar').style.display = 'none';
        el('expalsaLoginButton').disabled = false;
        info('Inicia sesión con una cuenta autorizada por Calidad.');
        return;
      }
      try {
        info('Comprobando permisos de EXPALSA…');
        // La cuenta administradora es la que ya figura en las reglas existentes.
        if (user.email === 'jeffersonfigueroa@oceantreasure.local') role = 'admin';
        else {
          const access = await getDoc(doc(db, 'expalsa_calidad_accesos', user.uid));
          const data = access.exists() ? access.data() : null;
          if (!data || data.active !== true || !['admin', 'editor'].includes(data.role)) throw Error('Esta cuenta no tiene acceso EXPALSA. Debe autorizarse por UID en expalsa_calidad_accesos.');
          role = data.role;
        }
        info('Descargando expedientes de Firestore…');
        const cloudData = await loadCloud();
        loggedUser = user;
        el('cloudUser').textContent = user.email + ' · ' + role;
        if (!started) {
          window.ExpalsaStart(cloudData, requestSync);
          started = true;
        }
        gate.style.display = 'none';
        el('cloudBar').style.display = 'flex';
        uiStatus('Conectado a Firestore · ' + cloudData.profiles.length + ' expedientes');
      } catch (err) {
        console.error('Inicio EXPALSA:', err);
        const message = errorText(err);
        loggedUser = null;
        role = null;
        gate.style.display = 'flex';
        el('cloudBar').style.display = 'none';
        try { await signOut(auth); } catch (signOutError) { console.warn('No se pudo cerrar sesión:', signOutError); }
        info(message);
        el('expalsaLoginButton').disabled = false;
      }
    });

    el('cloudRetry').addEventListener('click', () => {if (dirty && wanted) flush();});
    el('cloudReload').addEventListener('click', () => {
      if (dirty && !confirm('Existen cambios pendientes. Descarga un respaldo JSON antes de recargar. ¿Descartar lo no sincronizado?')) return;
      location.reload();
    });
    el('cloudLogout').addEventListener('click', async () => {
      if (dirty) {alert('Hay cambios sin sincronizar. Espera «Sincronizado» o descarga un respaldo JSON.');return;}
      await signOut(auth);location.reload();
    });
    window.addEventListener('beforeunload', event => {
      if (dirty) {event.preventDefault(); event.returnValue = '';}
    });
  } catch (err) {
    console.error('Error de inicialización Firebase:', err);
    info('No se pudo iniciar Firebase: ' + (err.message || String(err)) + '. Verifica Internet, configuración y acceso a los dominios de Firebase.');
    el('expalsaLoginButton').disabled = true;
  }
}
