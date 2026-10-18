/* EXPALSA · Firebase Auth + Firestore, módulos oficiales de la CDN.
   Acceso administrador o correo @expalsaevaluations.com verificado. */
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
    const [{ initializeApp }, { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence, sendEmailVerification, reload }, { getFirestore, collection, getDocs, doc, runTransaction, serverTimestamp }] = await Promise.all([
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

    const OWNER_EMAIL = 'jeffersonfigueroa@oceantreasure.local';
    const EXPALSA_DOMAIN = '@expalsaevaluations.com';
    const isExpalsaDomain = address =>
      typeof address === 'string' && address.trim().toLowerCase().endsWith(EXPALSA_DOMAIN);
    const showLogin = () => {
      gate.style.display = 'flex';
      el('expalsaLoginForm').hidden = false;
      el('expalsaVerifyBox').hidden = true;
      el('expalsaLoginButton').disabled = false;
    };
    const showVerify = () => {
      gate.style.display = 'flex';
      el('expalsaLoginForm').hidden = true;
      el('expalsaVerifyBox').hidden = false;
      el('cloudBar').style.display = 'none';
      info('Cuenta reconocida. Falta verificar el correo antes de acceder a los expedientes.');
    };
    const rejectLogin = async err => {
      console.error('Inicio EXPALSA:', err);
      const message = errorText(err);
      loggedUser = null;
      role = null;
      el('cloudBar').style.display = 'none';
      try { await signOut(auth); } catch (signOutError) { console.warn('Cierre de sesión:', signOutError); }
      showLogin();
      info(message);
    };

    async function authorizeAccount(user) {
      try {
        info('Comprobando permisos de EXPALSA…');
        const userEmail = (user.email || '').trim().toLowerCase();
        if (userEmail === OWNER_EMAIL) {
          role = 'admin';
        } else if (isExpalsaDomain(userEmail)) {
          // El cliente refleja la misma comprobación obligatoria en Firestore.
          // El refresco del token actualiza el claim email_verified tras confirmar el enlace.
          await reload(user);
          await user.getIdToken(true);
          if (!user.emailVerified) { showVerify(); return; }
          role = 'editor';
        } else {
          throw Error('Acceso reservado a cuentas @expalsaevaluations.com verificadas y al administrador.');
        }
        info('Descargando expedientes de Firestore…');
        const cloudData = await loadCloud();
        loggedUser = user;
        el('cloudUser').textContent = user.email + ' · ' + role;
        if (!started) {
          window.ExpalsaStart(cloudData, requestSync);
          started = true;
        }
        el('expalsaVerifyBox').hidden = true;
        gate.style.display = 'none';
        el('cloudBar').style.display = 'flex';
        uiStatus('Conectado a Firestore · ' + cloudData.profiles.length + ' expedientes');
      } catch (err) {
        await rejectLogin(err);
      }
    }

    onAuthStateChanged(auth, async user => {
      if (!user) {
        loggedUser = null;
        role = null;
        showLogin();
        el('cloudBar').style.display = 'none';
        info('Inicia sesión con una cuenta EXPALSA verificada.');
        return;
      }
      await authorizeAccount(user);
    });

    el('expalsaSendVerify').addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user || !isExpalsaDomain(user.email)) return;
      const button = el('expalsaSendVerify');
      button.disabled = true;
      try {
        await sendEmailVerification(user);
        info('Se envió el enlace de verificación. Revisa el buzón, confirma el correo y pulsa «Ya verifiqué mi correo».');
      } catch (err) {
        info('No se pudo enviar el correo: ' + errorText(err));
      } finally { button.disabled = false; }
    });

    el('expalsaCheckVerify').addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user) { showLogin(); return; }
      const button = el('expalsaCheckVerify');
      button.disabled = true;
      try {
        await reload(user);
        await user.getIdToken(true);
        if (!user.emailVerified) {
          info('El correo todavía no está verificado. Abre el enlace recibido y vuelve a intentarlo.');
        } else await authorizeAccount(user);
      } catch (err) { info(errorText(err)); }
      finally { button.disabled = false; }
    });

    el('expalsaSwitchAccount').addEventListener('click', async () => {
      await signOut(auth);
      showLogin();
      info('Introduce las credenciales de la nueva cuenta.');
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
