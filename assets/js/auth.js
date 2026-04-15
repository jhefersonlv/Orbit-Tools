/* ═══════════════════════════════════════════════════════════════
   Orbit Tools — Auth
   WordVirtua · 2026
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─── Estado global ───────────────────────────────────────────── */
let currentUser = null;
let _userPlan   = 'free';

/* ─── Helpers ─────────────────────────────────────────────────── */
function _authInitials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function _authDisplayName(user) {
  return user.displayName || user.email.split('@')[0];
}

/* ═══════════════════════════════════════════════════════════════
   TOPBAR UI
   ═══════════════════════════════════════════════════════════════ */

function updateAuthUI(user) {
  const btnLogin   = document.getElementById('auth-btn-login');
  const userArea   = document.getElementById('auth-user-area');
  const userName   = document.getElementById('auth-user-name');
  const userAvatar = document.getElementById('auth-user-avatar');

  if (user) {
    const name = _authDisplayName(user);
    btnLogin.hidden        = true;
    userArea.hidden        = false;
    userName.textContent   = name;
    userAvatar.textContent = _authInitials(name);
  } else {
    btnLogin.hidden  = false;
    userArea.hidden  = true;
  }
}

/* ═══════════════════════════════════════════════════════════════
   MODAL — abrir / fechar / alternar modo
   ═══════════════════════════════════════════════════════════════ */

function openAuthModal(mode) {
  document.getElementById('auth-modal').classList.add('open');
  _setAuthView(mode || 'login');
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.remove('open');
  setTimeout(() => {
    _setAuthView('login');
    ['auth-email','auth-password','auth-name','auth-email-reg','auth-password-reg']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    clearAuthErrors();
  }, 250);
}

function switchAuthMode(mode) {
  _setAuthView(mode);
  clearAuthErrors();
}

function _setAuthView(mode) {
  const views = ['login', 'register', 'onboarding', 'success'];
  views.forEach(v => {
    const el = document.getElementById('auth-view-' + v);
    if (el) el.hidden = (v !== mode);
  });

  const el = document.getElementById('auth-modal-terms');
  if (el) el.hidden = (mode === 'success' || mode === 'onboarding');

  const titles = {
    login:      { h: 'Entrar na sua conta',    sub: 'Salve históricos e configurações em qualquer dispositivo.' },
    register:   { h: 'Criar conta gratuita',   sub: 'Comece agora. Seus dados ficam salvos por 90 dias.' },
    onboarding: { h: 'Complete seu perfil',     sub: 'Precisamos de mais algumas informações para finalizar seu cadastro.' },
    success:    { h: '',                         sub: '' },
  };
  const t = titles[mode] || titles.login;
  const titleEl    = document.getElementById('auth-modal-title');
  const subtitleEl = document.getElementById('auth-modal-subtitle');
  if (titleEl)    titleEl.textContent    = t.h;
  if (subtitleEl) subtitleEl.textContent = t.sub;
}

/* ═══════════════════════════════════════════════════════════════
   ESTADO: erros e loading
   ═══════════════════════════════════════════════════════════════ */

function clearAuthErrors() {
  document.querySelectorAll('.auth-error').forEach(el => {
    el.textContent = '';
    el.hidden = true;
  });
}

function showAuthError(elId, msg) {
  const el = document.getElementById(elId);
  if (el) { el.textContent = msg; el.hidden = false; }
}

function _setLoading(btnId, on) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = on;
  if (on) {
    btn.dataset.origHtml = btn.innerHTML;
    btn.innerHTML = '<i class="ph ph-circle-notch auth-spin"></i> Aguarde...';
  } else if (btn.dataset.origHtml) {
    btn.innerHTML = btn.dataset.origHtml;
  }
}

/* ═══════════════════════════════════════════════════════════════
   AUTH: Email / Senha — Login
   ═══════════════════════════════════════════════════════════════ */

function authLogin() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  if (!email || !password) {
    showAuthError('auth-error-login', 'Preencha e-mail e senha.');
    return;
  }

  clearAuthErrors();
  _setLoading('auth-btn-submit-login', true);

  auth.signInWithEmailAndPassword(email, password)
    .catch(err => {
      _setLoading('auth-btn-submit-login', false);
      showAuthError('auth-error-login', _authErrorMsg(err.code));
    });
}

/* ═══════════════════════════════════════════════════════════════
   AUTH: Email / Senha — Cadastro
   ═══════════════════════════════════════════════════════════════ */

function authRegister() {
  const name     = document.getElementById('auth-name').value.trim();
  const email    = document.getElementById('auth-email-reg').value.trim();
  const password = document.getElementById('auth-password-reg').value;

  if (!name || !email || !password) {
    showAuthError('auth-error-register', 'Preencha todos os campos.');
    return;
  }
  if (password.length < 6) {
    showAuthError('auth-error-register', 'A senha precisa ter ao menos 6 caracteres.');
    return;
  }

  clearAuthErrors();
  _setLoading('auth-btn-submit-register', true);

  auth.createUserWithEmailAndPassword(email, password)
    .then(cred =>
      cred.user.updateProfile({ displayName: name }).then(() =>
        db.collection('users').doc(cred.user.uid).set({
          email,
          name,
          plan:                'free',
          onboardingCompleted: false,
          createdAt:           firebase.firestore.FieldValue.serverTimestamp(),
          expiresAt:           new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        })
      )
    )
    .catch(err => {
      _setLoading('auth-btn-submit-register', false);
      showAuthError('auth-error-register', _authErrorMsg(err.code));
    });
}

/* ═══════════════════════════════════════════════════════════════
   AUTH: Google
   ═══════════════════════════════════════════════════════════════ */

function authWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();

  auth.signInWithPopup(provider)
    .then(result => {
      const user       = result.user;
      const profileRef = db.collection('users').doc(user.uid);
      return profileRef.get().then(snap => {
        if (!snap.exists) {
          return profileRef.set({
            email:               user.email,
            name:                user.displayName || '',
            plan:                'free',
            onboardingCompleted: false,
            createdAt:           firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt:           new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          });
        }
      });
    })
    .catch(err => {
      if (err.code !== 'auth/popup-closed-by-user') {
        showAuthError('auth-error-login', _authErrorMsg(err.code));
      }
    });
}

/* ═══════════════════════════════════════════════════════════════
   ONBOARDING — preenchimento de perfil pós-cadastro
   ═══════════════════════════════════════════════════════════════ */

function authCompleteOnboarding() {
  const fullName   = document.getElementById('ob-fullname').value.trim();
  const whatsapp   = document.getElementById('ob-whatsapp').value.trim();
  const profession = document.getElementById('ob-profession').value.trim();
  const company    = document.getElementById('ob-company').value.trim();

  if (!fullName || !whatsapp || !profession) {
    showAuthError('auth-error-onboarding', 'Nome, WhatsApp e profissão são obrigatórios.');
    return;
  }

  clearAuthErrors();
  _setLoading('auth-btn-submit-onboarding', true);

  db.collection('users').doc(currentUser.uid).update({
    fullName,
    whatsapp,
    profession,
    company,
    onboardingCompleted: true,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  })
  .then(() => {
    const primeiro = fullName.split(' ')[0];
    document.getElementById('auth-success-name').textContent = `Tudo certo, ${primeiro}!`;
    _setAuthView('success');
    setTimeout(() => closeAuthModal(), 1600);
  })
  .catch(() => {
    _setLoading('auth-btn-submit-onboarding', false);
    showAuthError('auth-error-onboarding', 'Erro ao salvar. Tente novamente.');
  });
}

/* ─── Verifica se onboarding foi concluído ────────────────────── */
function _checkOnboarding(user, openModalIfNeeded) {
  db.collection('users').doc(user.uid).get()
    .then(snap => {
      const data = snap.exists ? snap.data() : {};

      /* Atualiza plano global */
      _userPlan = data.plan || 'free';
      if (typeof _disparoUpdateLimitBar === 'function') _disparoUpdateLimitBar();

      if (data.onboardingCompleted) return;

      // Pré-preenche nome se disponível
      const el = document.getElementById('ob-fullname');
      if (el && !el.value) el.value = data.fullName || data.name || user.displayName || '';

      _setAuthView('onboarding');
      if (openModalIfNeeded) {
        document.getElementById('auth-modal').classList.add('open');
      }
    })
    .catch(() => { if (openModalIfNeeded) closeAuthModal(); });
}

/* ═══════════════════════════════════════════════════════════════
   LOGOUT + DROPDOWN
   ═══════════════════════════════════════════════════════════════ */

function authLogout() {
  document.getElementById('auth-dropdown').classList.remove('open');
  auth.signOut().then(() => {
    _userPlan = 'free';
    if (typeof kmHistory         !== 'undefined') { kmHistory         = []; typeof updateHistoryBadge === 'function' && updateHistoryBadge();  typeof renderHistory    === 'function' && renderHistory();    }
    if (typeof cltHistory        !== 'undefined') { cltHistory        = []; typeof updateCltBadge    === 'function' && updateCltBadge();      typeof renderHistoryCLT === 'function' && renderHistoryCLT(); }
    if (typeof disparoContacts   !== 'undefined') { disparoContacts   = []; typeof disparoUpdateStats === 'function' && disparoUpdateStats(); typeof disparoFilter    === 'function' && disparoFilter();    }
    if (typeof _disparoUpdateLimitBar === 'function') _disparoUpdateLimitBar();
  });
}

function toggleUserDropdown() {
  document.getElementById('auth-dropdown').classList.toggle('open');
}

document.addEventListener('click', function (e) {
  const area = document.getElementById('auth-user-area');
  const dd   = document.getElementById('auth-dropdown');
  if (area && dd && !area.contains(e.target)) dd.classList.remove('open');
});

/* ═══════════════════════════════════════════════════════════════
   TRADUÇÃO DE ERROS
   ═══════════════════════════════════════════════════════════════ */

function _authErrorMsg(code) {
  const msgs = {
    'auth/user-not-found':         'Nenhuma conta com este e-mail.',
    'auth/wrong-password':         'Senha incorreta.',
    'auth/invalid-email':          'E-mail inválido.',
    'auth/email-already-in-use':   'Este e-mail já está cadastrado.',
    'auth/weak-password':          'Senha muito fraca. Use ao menos 6 caracteres.',
    'auth/too-many-requests':      'Muitas tentativas. Aguarde alguns minutos.',
    'auth/invalid-credential':     'E-mail ou senha incorretos.',
    'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
    'auth/user-disabled':          'Esta conta foi desativada.',
  };
  return msgs[code] || 'Ocorreu um erro. Tente novamente.';
}

/* ═══════════════════════════════════════════════════════════════
   OBSERVER — ponto central de controle de estado
   ═══════════════════════════════════════════════════════════════ */

auth.onAuthStateChanged(function (user) {
  currentUser = user;
  updateAuthUI(user);

  if (user) {
    const modal       = document.getElementById('auth-modal');
    const modalAberto = modal && modal.classList.contains('open');

    if (modalAberto) {
      // Acabou de fazer login/cadastro pelo modal
      // Mostra sucesso brevemente e depois verifica onboarding
      const nome = _authDisplayName(user).split(' ')[0];
      document.getElementById('auth-success-name').textContent = `Bem-vindo, ${nome}!`;
      _setAuthView('success');

      setTimeout(() => {
        _checkOnboarding(user, false); // abre onboarding dentro do modal ou fecha
      }, 1200);

      setTimeout(() => {
        // Se onboarding não abriu (usuário já completou), fecha o modal
        const view = document.getElementById('auth-view-success');
        if (view && !view.hidden) closeAuthModal();
      }, 2000);

    } else {
      // Usuário já estava logado (refresh de página) — verifica onboarding silenciosamente
      _checkOnboarding(user, true);
    }

    // Carrega dados do Firestore
    if (typeof loadKmHistoryFromFirestore      === 'function') loadKmHistoryFromFirestore(user.uid);
    if (typeof loadCltHistoryFromFirestore     === 'function') loadCltHistoryFromFirestore(user.uid);
    if (typeof loadKmSettingsFromFirestore     === 'function') loadKmSettingsFromFirestore(user.uid);
    if (typeof loadDisparoContactsFromFirestore === 'function') loadDisparoContactsFromFirestore(user.uid);
  }
});
