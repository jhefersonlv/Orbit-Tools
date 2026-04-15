/* ═══════════════════════════════════════════════════════════════
   Orbit Tools — Admin Panel
   WordVirtua · 2026
   ═══════════════════════════════════════════════════════════════ */

'use strict';

let _allUsers = [];

/* ═══════════════════════════════════════════════════════════════
   AUTH
   ═══════════════════════════════════════════════════════════════ */

function adminLoginGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => {
    if (err.code !== 'auth/popup-closed-by-user') {
      _showAdminError('Erro ao entrar: ' + err.message);
    }
  });
}

function adminLogout() {
  auth.signOut();
}

function _showAdminError(msg) {
  const el = document.getElementById('admin-auth-error');
  el.textContent = msg;
  el.style.display = 'block';
}

/* ═══════════════════════════════════════════════════════════════
   OBSERVER
   ═══════════════════════════════════════════════════════════════ */

auth.onAuthStateChanged(function (user) {
  if (!user) {
    document.getElementById('auth-guard').hidden  = false;
    document.getElementById('admin-panel').hidden = true;
    return;
  }

  // Verifica se é admin
  db.collection('users').doc(user.uid).get().then(snap => {
    const data = snap.exists ? snap.data() : {};

    if (!data.isAdmin) {
      auth.signOut();
      _showAdminError('Acesso negado. Esta conta não tem permissão de administrador.');
      return;
    }

    // Admin confirmado — exibe painel
    document.getElementById('auth-guard').hidden  = true;
    document.getElementById('admin-panel').hidden = false;
    document.getElementById('admin-user-name').textContent = user.displayName || user.email;

    loadUsers();
  }).catch(() => {
    auth.signOut();
    _showAdminError('Erro ao verificar permissões. Tente novamente.');
  });
});

/* ═══════════════════════════════════════════════════════════════
   CARREGAR USUÁRIOS
   ═══════════════════════════════════════════════════════════════ */

function loadUsers() {
  db.collection('users')
    .orderBy('createdAt', 'desc')
    .get()
    .then(snap => {
      _allUsers = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      updateStats(_allUsers);
      renderTable(_allUsers);
    })
    .catch(err => {
      document.getElementById('users-tbody').innerHTML = `
        <tr><td colspan="6" class="table-status">
          <i class="ph ph-warning-circle"></i>
          Erro ao carregar usuários. Verifique as regras do Firestore.
        </td></tr>`;
      console.error(err);
    });
}

/* ═══════════════════════════════════════════════════════════════
   STATS
   ═══════════════════════════════════════════════════════════════ */

function updateStats(users) {
  const onboarded = users.filter(u => u.onboardingCompleted).length;
  const orbit     = users.filter(u => u.plan === 'orbit').length;
  const free      = users.filter(u => u.plan !== 'orbit').length;

  document.getElementById('stat-total').textContent    = users.length;
  document.getElementById('stat-onboarded').textContent = onboarded;
  document.getElementById('stat-orbit').textContent    = orbit;
  document.getElementById('stat-free').textContent     = free;
}

/* ═══════════════════════════════════════════════════════════════
   FILTRO / BUSCA
   ═══════════════════════════════════════════════════════════════ */

function filterUsers() {
  const q          = document.getElementById('admin-search').value.toLowerCase();
  const planFilter = document.getElementById('admin-filter-plan').value;
  const obFilter   = document.getElementById('admin-filter-onboarding').value;

  const filtered = _allUsers.filter(u => {
    const matchQ = !q || [u.fullName, u.name, u.email, u.profession, u.company, u.whatsapp]
      .some(v => v && v.toLowerCase().includes(q));

    const matchPlan = !planFilter ||
      (planFilter === 'orbit' ? u.plan === 'orbit' : u.plan !== 'orbit');

    const matchOb = !obFilter ||
      (obFilter === 'done' ? u.onboardingCompleted : !u.onboardingCompleted);

    return matchQ && matchPlan && matchOb;
  });

  renderTable(filtered);
}

/* ═══════════════════════════════════════════════════════════════
   RENDERIZAR TABELA
   ═══════════════════════════════════════════════════════════════ */

function renderTable(users) {
  const tbody = document.getElementById('users-tbody');

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6" class="table-status">
        <i class="ph ph-users"></i>
        Nenhum usuário encontrado.
      </td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const name       = u.fullName || u.name || '—';
    const email      = u.email || '—';
    const whatsapp   = u.whatsapp || '—';
    const profession = u.profession || '—';
    const company    = u.company ? ` · ${u.company}` : '';
    const createdAt  = u.createdAt ? _fmtDate(u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt)) : '—';
    const plan       = u.plan === 'orbit' ? 'orbit' : 'free';
    const planLabel  = plan === 'orbit' ? 'Orbit' : 'Gratuito';
    const obDone     = u.onboardingCompleted;
    const initials   = _initials(name);
    const avatarBg   = _avatarColor(u.uid || '');

    return `<tr>
      <td>
        <div class="user-cell">
          <div class="user-avatar" style="background:${avatarBg}">${initials}</div>
          <div>
            <div class="user-name">${_esc(name)}</div>
            <div class="user-email">${_esc(email)}</div>
          </div>
        </div>
      </td>
      <td class="td-muted">
        ${whatsapp !== '—'
          ? `<a href="https://wa.me/${whatsapp.replace(/\D/g,'')}" target="_blank" style="color:var(--c-green)">
               <i class="ph ph-whatsapp-logo"></i>${_esc(whatsapp)}
             </a>`
          : '<span style="color:var(--c-light)">—</span>'}
      </td>
      <td>
        ${profession !== '—' ? `<span>${_esc(profession)}${_esc(company)}</span>` : '<span style="color:var(--c-light)">—</span>'}
      </td>
      <td class="td-muted">${createdAt}</td>
      <td>
        <span class="plan-badge plan-badge--${plan}">${planLabel}</span>
      </td>
      <td>
        ${obDone
          ? `<span class="onboarding-badge onboarding-badge--done"><i class="ph ph-check-circle"></i> Completo</span>`
          : `<span class="onboarding-badge onboarding-badge--pending"><i class="ph ph-clock"></i> Pendente</span>`}
      </td>
    </tr>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════
   EXPORTAR CSV
   ═══════════════════════════════════════════════════════════════ */

function exportCSV() {
  const headers = ['Nome', 'Email', 'WhatsApp', 'Profissão', 'Empresa', 'Plano', 'Cadastro', 'Perfil Completo'];

  const rows = _allUsers.map(u => [
    u.fullName || u.name || '',
    u.email || '',
    u.whatsapp || '',
    u.profession || '',
    u.company || '',
    u.plan || 'free',
    u.createdAt ? _fmtDate(u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt)) : '',
    u.onboardingCompleted ? 'Sim' : 'Não',
  ]);

  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `orbit-tools-usuarios-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════════════
   UTILITÁRIOS
   ═══════════════════════════════════════════════════════════════ */

function _initials(name) {
  return (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function _avatarColor(uid) {
  const colors = ['#223B71','#0d4a3a','#3a0f2e','#1a1040','#2d1a04','#0c2a4a'];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function _fmtDate(date) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function _esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
