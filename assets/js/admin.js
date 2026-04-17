/* ═══════════════════════════════════════════════════════════════
   Orbit Tools — Admin Panel (inline)
   WordVirtua · 2026
   ═══════════════════════════════════════════════════════════════ */

'use strict';

let _admUsers      = [];
let _admSiteHasSite = false;
let _admPlan        = 'free';

/* ═══════════════════════════════════════════════════════════════
   CARREGAR USUÁRIOS
   ═══════════════════════════════════════════════════════════════ */

function admLoadUsers() {
  const tbody = document.getElementById('adm-users-tbody');
  tbody.innerHTML = `<tr><td colspan="7" class="table-status">
    <i class="ph ph-circle-notch adm-spinning"></i> Carregando...
  </td></tr>`;

  db.collection('users')
    .orderBy('createdAt', 'desc')
    .get()
    .then(snap => {
      _admUsers = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      admUpdateStats(_admUsers);
      admRenderTable(_admUsers);
    })
    .catch(err => {
      tbody.innerHTML = `<tr><td colspan="7" class="table-status">
        <i class="ph ph-warning-circle"></i>
        Erro ao carregar usuários. Verifique as regras do Firestore.
      </td></tr>`;
      console.error('[Admin] loadUsers falhou:', err);
    });
}

/* ═══════════════════════════════════════════════════════════════
   STATS
   ═══════════════════════════════════════════════════════════════ */

function admUpdateStats(users) {
  const onboarded = users.filter(u => u.onboardingCompleted).length;
  const orbit     = users.filter(u => u.plan === 'orbit').length;
  const free      = users.filter(u => u.plan !== 'orbit').length;
  const withSite  = users.filter(u => u.hasSite).length;

  document.getElementById('adm-stat-total').textContent     = users.length;
  document.getElementById('adm-stat-onboarded').textContent = onboarded;
  document.getElementById('adm-stat-orbit').textContent     = orbit;
  document.getElementById('adm-stat-free').textContent      = free;
  document.getElementById('adm-stat-site').textContent      = withSite;
}

/* ═══════════════════════════════════════════════════════════════
   FILTRO / BUSCA
   ═══════════════════════════════════════════════════════════════ */

function admFilterUsers() {
  const q          = document.getElementById('adm-search').value.toLowerCase();
  const planFilter = document.getElementById('adm-filter-plan').value;
  const siteFilter = document.getElementById('adm-filter-site').value;

  const filtered = _admUsers.filter(u => {
    const matchQ = !q || [u.fullName, u.name, u.email, u.profession, u.company, u.whatsapp]
      .some(v => v && v.toLowerCase().includes(q));

    const matchPlan = !planFilter ||
      (planFilter === 'orbit' ? u.plan === 'orbit' : u.plan !== 'orbit');

    const matchSite = !siteFilter ||
      (siteFilter === 'active' ? u.hasSite : !u.hasSite);

    return matchQ && matchPlan && matchSite;
  });

  admRenderTable(filtered);
}

/* ═══════════════════════════════════════════════════════════════
   RENDERIZAR TABELA
   ═══════════════════════════════════════════════════════════════ */

function admRenderTable(users) {
  const tbody = document.getElementById('adm-users-tbody');

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-status">
      <i class="ph ph-users"></i> Nenhum usuário encontrado.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const name       = u.fullName || u.name || '—';
    const email      = u.email || '—';
    const profession = u.profession || '—';
    const company    = u.company ? ` · ${u.company}` : '';
    const createdAt  = u.createdAt
      ? _admFmtDate(u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt))
      : '—';
    const plan      = u.plan === 'orbit' ? 'orbit' : 'free';
    const planLabel = plan === 'orbit' ? 'Orbit' : 'Gratuito';
    const obDone    = u.onboardingCompleted;
    const initials  = _admInitials(name);
    const avatarBg  = _admAvatarColor(u.uid || '');
    const hasSite   = !!u.hasSite;
    const siteUrl   = u.siteUrl || '';

    /* Serializa dados para o onclick sem quebrar as aspas */
    const data = _admEsc(JSON.stringify({ uid: u.uid, name, plan, hasSite, siteUrl }));

    return `<tr>
      <td>
        <div class="user-cell">
          <div class="user-avatar" style="background:${avatarBg}">${initials}</div>
          <div>
            <div class="user-name">${_admEsc(name)}</div>
            <div class="user-email">${_admEsc(email)}</div>
          </div>
        </div>
      </td>
      <td>
        ${profession !== '—'
          ? `<span style="font-size:.85rem">${_admEsc(profession)}${_admEsc(company)}</span>`
          : '<span style="color:var(--c-light)">—</span>'}
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
      <td>
        <span class="site-toggle ${hasSite ? 'site-toggle--active' : 'site-toggle--inactive'}">
          <i class="ph ${hasSite ? 'ph-globe' : 'ph-globe-x'}"></i>
          ${hasSite ? 'Ativo' : 'Inativo'}
        </span>
        ${hasSite && siteUrl
          ? `<a href="${_admEsc(siteUrl)}" target="_blank" class="site-url-link">${_admEsc(siteUrl)}</a>`
          : ''}
      </td>
      <td>
        <button class="adm-edit-btn" onclick="admOpenEditModal('${_admEsc(u.uid)}')">
          <i class="ph ph-pencil-simple"></i> Editar
        </button>
      </td>
    </tr>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════
   EXPORTAR CSV
   ═══════════════════════════════════════════════════════════════ */

function admExportCSV() {
  const headers = ['Nome', 'Email', 'WhatsApp', 'Profissão', 'Empresa', 'Plano', 'Cadastro', 'Perfil Completo', 'Site Ativo', 'URL do Site'];

  const rows = _admUsers.map(u => [
    u.fullName || u.name || '',
    u.email || '',
    u.whatsapp || '',
    u.profession || '',
    u.company || '',
    u.plan || 'free',
    u.createdAt ? _admFmtDate(u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt)) : '',
    u.onboardingCompleted ? 'Sim' : 'Não',
    u.hasSite ? 'Sim' : 'Não',
    u.siteUrl || '',
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
   MODAL — EDITAR USUÁRIO
   ═══════════════════════════════════════════════════════════════ */

function admOpenEditModal(uid) {
  const u = _admUsers.find(x => x.uid === uid);
  if (!u) return;

  _admSiteHasSite = !!u.hasSite;
  _admPlan        = u.plan === 'orbit' ? 'orbit' : 'free';

  document.getElementById('adm-site-uid').value              = uid;
  document.getElementById('adm-site-modal-title').textContent = u.email || u.name || uid;
  document.getElementById('adm-site-url').value              = u.siteUrl || '';
  document.getElementById('adm-site-error').hidden           = true;

  _admUpdatePlanBtns(_admPlan);
  _admUpdateSiteStatusBtns(_admSiteHasSite);
  _admToggleSiteUrlField(_admSiteHasSite);

  document.getElementById('adm-site-modal').classList.add('open');
}

/* Mantém compatibilidade com o botão antigo (caso ainda exista em algum lugar) */
function admOpenSiteModal(uid, name, hasSite, siteUrl) {
  admOpenEditModal(uid);
}

function admCloseSiteModal() {
  document.getElementById('adm-site-modal').classList.remove('open');
}

function admCloseSiteOverlay(e) {
  if (e.target === document.getElementById('adm-site-modal')) admCloseSiteModal();
}

/* ── Plano ─────────────────────────────────────────────────── */

function admSetPlan(plan) {
  _admPlan = plan;
  _admUpdatePlanBtns(plan);
}

function _admUpdatePlanBtns(plan) {
  const btnFree  = document.getElementById('adm-plan-btn-free');
  const btnOrbit = document.getElementById('adm-plan-btn-orbit');
  const isFree   = plan !== 'orbit';

  btnFree.style.borderColor  = isFree  ? 'var(--c-border)' : 'var(--c-border)';
  btnFree.style.background   = isFree  ? 'var(--c-bg)'     : '';
  btnFree.style.color        = isFree  ? 'var(--c-dark)'   : 'var(--c-mid)';
  btnFree.style.fontWeight   = isFree  ? '700'             : '500';

  btnOrbit.style.borderColor = !isFree ? 'var(--c-blue)'   : 'var(--c-border)';
  btnOrbit.style.background  = !isFree ? 'var(--c-blue-lt)': '';
  btnOrbit.style.color       = !isFree ? 'var(--c-blue)'   : 'var(--c-mid)';
  btnOrbit.style.fontWeight  = !isFree ? '700'             : '500';
}

/* ── Site ──────────────────────────────────────────────────── */

function admSetSiteStatus(value) {
  _admSiteHasSite = value;
  _admUpdateSiteStatusBtns(value);
  _admToggleSiteUrlField(value);
}

function _admUpdateSiteStatusBtns(hasSite) {
  const btnOn  = document.getElementById('adm-site-btn-on');
  const btnOff = document.getElementById('adm-site-btn-off');

  btnOn.style.borderColor  = hasSite  ? 'var(--c-green)'  : 'var(--c-border)';
  btnOn.style.background   = hasSite  ? '#d1fae5'         : '';
  btnOn.style.color        = hasSite  ? '#065f46'         : 'var(--c-mid)';
  btnOn.style.fontWeight   = hasSite  ? '700'             : '500';

  btnOff.style.borderColor = !hasSite ? 'var(--c-red)'    : 'var(--c-border)';
  btnOff.style.background  = !hasSite ? '#fee2e2'         : '';
  btnOff.style.color       = !hasSite ? '#991b1b'         : 'var(--c-mid)';
  btnOff.style.fontWeight  = !hasSite ? '700'             : '500';
}

function _admToggleSiteUrlField(hasSite) {
  const field = document.getElementById('adm-site-url-field');
  if (field) field.style.display = hasSite ? '' : 'none';
}

/* ── Salvar ────────────────────────────────────────────────── */

function admSaveSiteConfig() {
  const uid     = document.getElementById('adm-site-uid').value;
  const siteUrl = document.getElementById('adm-site-url').value.trim();
  const hasSite = _admSiteHasSite;
  const plan    = _admPlan;
  const errEl   = document.getElementById('adm-site-error');
  const saveBtn = document.getElementById('adm-site-save-btn');

  if (hasSite && !siteUrl) {
    errEl.textContent = 'Informe a URL do site para ativar.';
    errEl.hidden = false;
    return;
  }

  errEl.hidden      = true;
  saveBtn.disabled  = true;
  saveBtn.innerHTML = '<i class="ph ph-circle-notch adm-spinning"></i> Salvando...';

  db.collection('users').doc(uid).update({ plan, hasSite, siteUrl })
    .then(() => {
      const u = _admUsers.find(x => x.uid === uid);
      if (u) { u.plan = plan; u.hasSite = hasSite; u.siteUrl = siteUrl; }
      admUpdateStats(_admUsers);
      admRenderTable(_admUsers);
      admCloseSiteModal();
    })
    .catch(err => {
      errEl.textContent = 'Erro ao salvar: ' + err.message;
      errEl.hidden = false;
    })
    .finally(() => {
      saveBtn.disabled  = false;
      saveBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> Salvar alterações';
    });
}

/* ═══════════════════════════════════════════════════════════════
   UTILITÁRIOS
   ═══════════════════════════════════════════════════════════════ */

function _admInitials(name) {
  return (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function _admAvatarColor(uid) {
  const colors = ['#223B71','#0d4a3a','#3a0f2e','#1a1040','#2d1a04','#0c2a4a'];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function _admFmtDate(date) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function _admEsc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
