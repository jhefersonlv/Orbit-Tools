'use strict';

/* ═══════════════════════════════════════════════════════════════
   ORBIT TOOLS — Gerenciamento de Equipe
   Cria contas para membros sem deslogar o dono (instância secundária)
   ═══════════════════════════════════════════════════════════════ */

let _teamMembers    = [];
let _secondaryApp   = null;
let _secondaryAuth  = null;

// ─── INSTÂNCIA SECUNDÁRIA DO FIREBASE ────────────────────────────
// Usada para criar contas sem afetar a sessão atual do dono

function _getSecondaryAuth() {
  if (_secondaryAuth) return _secondaryAuth;
  try {
    _secondaryApp = firebase.initializeApp(FIREBASE_CONFIG, 'teamCreator');
  } catch (_) {
    _secondaryApp = firebase.app('teamCreator');
  }
  _secondaryAuth = _secondaryApp.auth();
  return _secondaryAuth;
}

// ─── HELPERS DE SESSÃO ───────────────────────────────────────────

function _teamOwnerUid() {
  return typeof currentUser !== 'undefined' && currentUser ? currentUser.uid : null;
}

function _teamOwnerName() {
  if (typeof currentUser === 'undefined' || !currentUser) return 'Alguém';
  return currentUser.displayName || currentUser.email?.split('@')[0] || 'Alguém';
}

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────

function teamInit() {
  const uid = _teamOwnerUid();
  if (!uid) {
    const list = document.getElementById('team-members-list');
    if (list) list.innerHTML = `
      <div class="team-empty">
        <i class="ph ph-lock"></i>
        <p>Faça login para gerenciar sua equipe.</p>
      </div>`;
    return;
  }
  _teamLoad(uid);
}

async function _teamLoad(uid) {
  const list = document.getElementById('team-members-list');
  if (list) list.innerHTML = `<div class="team-loading"><i class="ph ph-circle-notch adm-spinning"></i> Carregando...</div>`;
  try {
    const snap  = await db.collection('users').doc(uid).get();
    _teamMembers = snap.data()?.teamMembers || [];
    _teamRender();
  } catch (err) {
    if (list) list.innerHTML = `<div class="team-empty"><i class="ph ph-warning-circle"></i><p>Erro ao carregar equipe.</p></div>`;
  }
}

// ─── CRIAR CONTA PARA O MEMBRO ────────────────────────────────────
// Usa instância secundária — não desloga o dono

async function teamCreateAccount() {
  const nameEl     = document.getElementById('team-input-name');
  const emailEl    = document.getElementById('team-input-email');
  const passEl     = document.getElementById('team-input-password');
  const errEl      = document.getElementById('team-add-error');
  const btn        = document.getElementById('team-btn-create');

  errEl.hidden = true;

  const name     = nameEl?.value.trim();
  const email    = emailEl?.value.trim().toLowerCase();
  const password = passEl?.value;

  if (!name) { _teamErr(errEl, 'Informe o nome do membro.'); return; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { _teamErr(errEl, 'Informe um e-mail válido.'); return; }
  if (!password || password.length < 6) { _teamErr(errEl, 'A senha precisa ter pelo menos 6 caracteres.'); return; }
  if (_teamMembers.some(m => m.email === email)) { _teamErr(errEl, 'Este e-mail já está na equipe.'); return; }

  const ownerUid  = _teamOwnerUid();
  const ownerName = _teamOwnerName();
  if (!ownerUid) return;

  btn.disabled  = true;
  btn.innerHTML = '<i class="ph ph-circle-notch adm-spinning"></i> Criando conta...';

  try {
    // 1. Cria o usuário na instância secundária (não afeta sessão atual)
    const secondaryAuth = _getSecondaryAuth();
    const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    const memberUid = cred.user.uid;

    // 2. Salva perfil do membro no Firestore
    await db.collection('users').doc(memberUid).set({
      email,
      name,
      plan:                'free',
      onboardingCompleted: true,
      createdAt:           firebase.firestore.FieldValue.serverTimestamp(),
    });

    // 3. Desloga da instância secundária (importante!)
    await secondaryAuth.signOut();

    // 4. Registra acesso: membro poderá ver os dados do dono
    await _teamRegisterAccess(email, name, ownerUid, ownerName, memberUid);

    // Limpa form e mostra sucesso
    nameEl.value = emailEl.value = passEl.value = '';
    _teamShowSuccess(`
      <i class="ph ph-check-circle"></i>
      Conta criada! Passe as credenciais para <strong>${_teamEsc(name)}</strong>:<br>
      <div class="team-credentials">
        <span><strong>E-mail:</strong> ${_teamEsc(email)}</span>
        <span><strong>Senha:</strong> ${_teamEsc(password)}</span>
      </div>
    `);

  } catch (err) {
    const msg = _teamAuthErr(err.code) || err.message;
    _teamErr(errEl, msg);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="ph ph-user-plus"></i> Criar conta';
  }
}

// ─── REGISTRAR ACESSO NO FIRESTORE ───────────────────────────────

async function _teamRegisterAccess(email, name, ownerUid, ownerName, memberUid) {
  const newMember = { email, name, addedAt: new Date().toISOString(), uid: memberUid || null };

  // Adiciona na lista do dono
  await db.collection('users').doc(ownerUid).set(
    { teamMembers: firebase.firestore.FieldValue.arrayUnion(newMember) },
    { merge: true }
  );

  // Registra quais donos o membro pode ver (usado ao logar)
  await db.collection('teamByEmail').doc(email).set(
    {
      owners:    firebase.firestore.FieldValue.arrayUnion({ uid: ownerUid, name: ownerName }),
      ownerUids: firebase.firestore.FieldValue.arrayUnion(ownerUid),
    },
    { merge: true }
  );

  _teamMembers.push(newMember);
  _teamRender();
}

// ─── REMOVER MEMBRO ───────────────────────────────────────────────

async function teamRemoveMember(idx) {
  const member = _teamMembers[idx];
  if (!member) return;
  const ownerUid = _teamOwnerUid();
  if (!ownerUid) return;

  try {
    await db.collection('users').doc(ownerUid).update({
      teamMembers: firebase.firestore.FieldValue.arrayRemove(member),
    });

    const ref  = db.collection('teamByEmail').doc(member.email);
    const snap = await ref.get();
    if (snap.exists) {
      const owners    = (snap.data().owners    || []).filter(o => o.uid !== ownerUid);
      const ownerUids = (snap.data().ownerUids || []).filter(id => id !== ownerUid);
      await ref.update({ owners, ownerUids });
    }

    _teamMembers.splice(idx, 1);
    _teamRender();
  } catch (err) {
    console.error('[Team] removeMember:', err);
  }
}

// ─── RENDER DA LISTA ─────────────────────────────────────────────

function _teamRender() {
  const list = document.getElementById('team-members-list');
  if (!list) return;

  if (!_teamMembers.length) {
    list.innerHTML = `
      <div class="team-empty">
        <i class="ph ph-users-three"></i>
        <p>Nenhum membro adicionado ainda.<br>Crie a conta pelo formulário acima.</p>
      </div>`;
    return;
  }

  list.innerHTML = _teamMembers.map((m, idx) => {
    const initials = (m.name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const date     = m.addedAt ? new Date(m.addedAt).toLocaleDateString('pt-BR') : '—';
    return `
      <div class="team-member-item">
        <div class="team-member-avatar">${initials}</div>
        <div class="team-member-info">
          <div class="team-member-name">${_teamEsc(m.name)}</div>
          <div class="team-member-email">${_teamEsc(m.email)}</div>
          <div class="team-member-date">Adicionado em ${date}</div>
        </div>
        <div class="team-member-status">
          <span class="team-status-badge team-status-badge--active">
            <i class="ph ph-check-circle"></i> Conta ativa
          </span>
        </div>
        <button class="team-member-del" onclick="teamRemoveMember(${idx})" title="Remover acesso">
          <i class="ph ph-trash"></i>
        </button>
      </div>`;
  }).join('');
}

// ─── TOGGLE SENHA ────────────────────────────────────────────────

function teamTogglePassword() {
  const input  = document.getElementById('team-input-password');
  const icon   = document.getElementById('team-pass-icon');
  if (!input) return;
  const isText = input.type === 'text';
  input.type   = isText ? 'password' : 'text';
  if (icon) icon.className = `ph ${isText ? 'ph-eye' : 'ph-eye-slash'}`;
}

// ─── HELPERS ─────────────────────────────────────────────────────

function _teamShowSuccess(html) {
  const el = document.getElementById('team-success-msg');
  if (!el) return;
  el.innerHTML = html;
  el.hidden = false;
}

function _teamErr(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}

function _teamEsc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _teamAuthErr(code) {
  const map = {
    'auth/email-already-in-use': 'Este e-mail já tem uma conta. Remova e crie outra, ou use outro e-mail.',
    'auth/invalid-email':        'E-mail inválido.',
    'auth/weak-password':        'Senha muito fraca. Use ao menos 6 caracteres.',
    'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
  };
  return map[code] || null;
}
