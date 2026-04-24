/* ═══════════════════════════════════════════════════════════════
   Orbit Tools — Admin Panel (inline)
   WordVirtua · 2026
   ═══════════════════════════════════════════════════════════════ */

'use strict';

let _admUsers       = [];
let _admSiteHasSite = false;
let _admPlan        = 'free';

/* ─── Itens configuráveis do menu (tool → label + ícone) ───── */
const ADM_NAV_ITEMS = [
  { tool: 'dashboard', label: 'Dashboard',         icon: 'ph-chart-pie'      },
  { tool: 'crm',       label: 'CRM & Leads',       icon: 'ph-kanban'         },
  { tool: 'clientes',  label: 'Clientes',           icon: 'ph-users-three'    },
  { tool: 'disparo',   label: 'Disparo WhatsApp',   icon: 'ph-whatsapp-logo'  },
  { tool: 'clt-pj',   label: 'Custo CLT x PJ',     icon: 'ph-scales'         },
  { tool: 'km-calc',  label: 'Calc. de KM',         icon: 'ph-car'            },
  { tool: 'planos',    label: 'Planos',             icon: 'ph-squares-four'   },
  { tool: 'generator', label: 'Gerador de Sites',   icon: 'ph-magic-wand'     },
];

/* Estado local das permissões do usuário em edição */
let _admNavPerms = {};   /* { dashboard: true, crm: true, ... } true = visível */

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
    const navPerms  = u.navPermissions && typeof u.navPermissions === 'object' ? u.navPermissions : null;
    const hiddenCnt = navPerms ? ADM_NAV_ITEMS.filter(i => navPerms[i.tool] === false).length : 0;

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
        ${hiddenCnt > 0
          ? `<div style="font-size:.72rem;color:var(--c-light);margin-top:4px"><i class="ph ph-eye-slash"></i> ${hiddenCnt} oculto${hiddenCnt > 1 ? 's' : ''}</div>`
          : ''}
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

/* ═══════════════════════════════════════════════════════════════
   PERMISSÕES DE MENU (nav-items por usuário)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Renderiza o grid de toggles no modal de edição.
 * Lê _admNavPerms para o estado inicial de cada item.
 */
function admRenderNavPerms() {
  const grid = document.getElementById('adm-nav-perm-grid');
  if (!grid) return;

  grid.innerHTML = ADM_NAV_ITEMS.map(({ tool, label, icon }) => {
    const visible = _admNavPerms[tool] !== false; // default true
    return `
      <div class="adm-nav-perm-item ${visible ? '' : 'perm-off'}"
           id="adm-perm-item-${tool}"
           onclick="admToggleNavPerm('${tool}')"
           title="${label}">
        <div class="adm-nav-perm-left">
          <i class="ph ${icon}"></i>
          <span class="adm-nav-perm-label">${label}</span>
        </div>
        <div class="adm-nav-perm-pill"></div>
      </div>`;
  }).join('');
}

/** Alterna visibilidade de um item e atualiza o estado local. */
function admToggleNavPerm(tool) {
  const current  = _admNavPerms[tool] !== false; // true se visível
  _admNavPerms[tool] = !current;

  const item = document.getElementById(`adm-perm-item-${tool}`);
  if (item) item.classList.toggle('perm-off', current);
}

/* ═══════════════════════════════════════════════════════════════
   MODAL — EDITAR USUÁRIO
   ═══════════════════════════════════════════════════════════════ */

function admOpenEditModal(uid) {
  const u = _admUsers.find(x => x.uid === uid);
  if (!u) return;

  _admSiteHasSite = !!u.hasSite;
  _admPlan        = u.plan === 'orbit' ? 'orbit' : 'free';

  /* Carrega permissões salvas, ou padrão (todos visíveis) */
  _admNavPerms = {};
  if (u.navPermissions && typeof u.navPermissions === 'object') {
    Object.assign(_admNavPerms, u.navPermissions);
  }

  document.getElementById('adm-site-uid').value               = uid;
  document.getElementById('adm-site-modal-title').textContent  = u.email || u.name || uid;
  document.getElementById('adm-site-url').value               = u.siteUrl || '';
  document.getElementById('adm-site-error').hidden            = true;

  _admUpdatePlanBtns(_admPlan);
  _admUpdateSiteStatusBtns(_admSiteHasSite);
  _admToggleSiteUrlField(_admSiteHasSite);
  admRenderNavPerms();

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

  db.collection('users').doc(uid).update({ plan, hasSite, siteUrl, navPermissions: _admNavPerms })
    .then(() => {
      const u = _admUsers.find(x => x.uid === uid);
      if (u) { u.plan = plan; u.hasSite = hasSite; u.siteUrl = siteUrl; u.navPermissions = { ..._admNavPerms }; }
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
   CATÁLOGO DE PLANOS — CRUD
   ═══════════════════════════════════════════════════════════════ */

let _admEditingTemplateId = null;

function admLoadPlanTemplates() {
  if (typeof currentUser === 'undefined' || !currentUser) return;
  planTemplatesLoad(currentUser.uid).then(templates => admRenderPlanTemplates(templates));
}

function admRenderPlanTemplates(templates) {
  const wrap = document.getElementById('adm-plan-templates-list');
  if (!wrap) return;

  if (!templates || templates.length === 0) {
    wrap.innerHTML = `
      <div class="adm-tpl-empty">
        <i class="ph ph-file-x"></i>
        <p>Nenhum plano cadastrado ainda. Clique em <strong>+ Novo Plano</strong> para começar.</p>
      </div>`;
    return;
  }

  const fmtBRL = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  wrap.innerHTML = `
    <div class="adm-tpl-grid">
      ${templates.map(t => `
        <div class="adm-tpl-card">
          <div class="adm-tpl-card-header">
            <span class="adm-tpl-name">${_admEsc(t.name)}</span>
            <div class="adm-tpl-actions">
              <button class="adm-tpl-btn adm-tpl-btn--edit" onclick="admOpenPlanTemplateModal('${t.id}')" title="Editar">
                <i class="ph ph-pencil-simple"></i>
              </button>
              <button class="adm-tpl-btn adm-tpl-btn--del" onclick="admDeletePlanTemplate('${t.id}', '${_admEsc(t.name)}')" title="Excluir">
                <i class="ph ph-trash"></i>
              </button>
            </div>
          </div>
          <div class="adm-tpl-card-body">
            <div class="adm-tpl-detail">
              <i class="ph ph-coins"></i>
              <span>${t.credits} crédito${t.credits !== 1 ? 's' : ''}</span>
            </div>
            <div class="adm-tpl-detail">
              <i class="ph ph-money"></i>
              <span>${fmtBRL(t.price)}</span>
            </div>
            <div class="adm-tpl-detail">
              <i class="ph ph-calendar-blank"></i>
              <span>${t.durationDays || 30} dias</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>`;
}

function admOpenPlanTemplateModal(templateId) {
  _admEditingTemplateId = templateId || null;

  const errEl = document.getElementById('adm-tpl-modal-error');
  if (errEl) { errEl.textContent = ''; errEl.hidden = true; }

  if (templateId) {
    const t = (typeof _planTemplatesCache !== 'undefined' ? _planTemplatesCache : [])
      .find(x => x.id === templateId);
    if (t) {
      document.getElementById('adm-tpl-name').value         = t.name         || '';
      document.getElementById('adm-tpl-credits').value      = t.credits      || 1;
      document.getElementById('adm-tpl-price').value        = t.price        || 0;
      document.getElementById('adm-tpl-duration').value     = t.durationDays || 30;
    }
    const title = document.getElementById('adm-tpl-modal-title');
    if (title) title.textContent = 'Editar Plano';
  } else {
    document.getElementById('adm-tpl-name').value     = '';
    document.getElementById('adm-tpl-credits').value  = 4;
    document.getElementById('adm-tpl-price').value    = '';
    document.getElementById('adm-tpl-duration').value = 30;
    const title = document.getElementById('adm-tpl-modal-title');
    if (title) title.textContent = 'Novo Plano';
  }

  document.getElementById('adm-tpl-modal').classList.add('open');
}

function admClosePlanTemplateModal() {
  document.getElementById('adm-tpl-modal').classList.remove('open');
  _admEditingTemplateId = null;
}

function admSavePlanTemplate() {
  if (typeof currentUser === 'undefined' || !currentUser) return;

  const name        = (document.getElementById('adm-tpl-name').value        || '').trim();
  const credits     = parseInt(document.getElementById('adm-tpl-credits').value)  || 0;
  const price       = parseFloat(document.getElementById('adm-tpl-price').value)  || 0;
  const durationDays= parseInt(document.getElementById('adm-tpl-duration').value) || 30;
  const errEl       = document.getElementById('adm-tpl-modal-error');
  const saveBtn     = document.getElementById('adm-tpl-save-btn');

  if (!name) {
    if (errEl) { errEl.textContent = 'Informe o nome do plano.'; errEl.hidden = false; }
    return;
  }
  if (credits < 1) {
    if (errEl) { errEl.textContent = 'Créditos deve ser pelo menos 1.'; errEl.hidden = false; }
    return;
  }

  if (errEl) errEl.hidden = true;
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="ph ph-circle-notch adm-spinning"></i> Salvando...'; }

  planTemplateSave(currentUser.uid, _admEditingTemplateId, { name, credits, price, durationDays }, currentUser.uid)
    .then(() => {
      admClosePlanTemplateModal();
      admRenderPlanTemplates(_planTemplatesCache);
      if (typeof disparoShowToast === 'function') disparoShowToast('Plano salvo!');
    })
    .catch(err => {
      console.error('[Admin] admSavePlanTemplate erro:', err);
      if (errEl) { errEl.textContent = 'Erro ao salvar. Tente novamente.'; errEl.hidden = false; }
    })
    .finally(() => {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> Salvar'; }
    });
}

function admDeletePlanTemplate(templateId, templateName) {
  if (typeof currentUser === 'undefined' || !currentUser) return;
  if (!confirm(`Excluir o plano "${templateName}"?\n\nClientes com esse plano ativo não serão afetados.`)) return;

  planTemplateDelete(currentUser.uid, templateId)
    .then(() => {
      admRenderPlanTemplates(_planTemplatesCache);
      if (typeof disparoShowToast === 'function') disparoShowToast('Plano excluído.');
    })
    .catch(err => {
      console.error('[Admin] admDeletePlanTemplate erro:', err);
      if (typeof disparoShowToast === 'function') disparoShowToast('Erro ao excluir.', true);
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
