/* ═══════════════════════════════════════════════════════════════
   Orbit Tools — Script
   WordVirtua · 2026
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─── FIREBASE — inicializado em firebase-config.js ─────────── */

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════════════════ */

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
window.addEventListener('resize', () => { if (window.innerWidth > 768) closeSidebar(); });

/* ─── Troca de ferramenta (sidebar) ─────────────────────────── */
function loadTool(toolId, linkEl) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  if (linkEl) linkEl.classList.add('active');

  document.querySelectorAll('.tool-view').forEach(v => v.classList.add('hidden'));

  const target = document.getElementById(`tool-${toolId}`);
  if (target) target.classList.remove('hidden');
  else document.getElementById('tool-coming-soon').classList.remove('hidden');

  /* Hooks de inicialização por ferramenta */
  if (toolId === 'sched') {
    schedRenderCalendar();
    schedRenderServices();
  }
  if (toolId === 'admin') {
    if (typeof admLoadUsers === 'function') admLoadUsers();
  }

  if (window.innerWidth <= 768) closeSidebar();
}

/* ═══════════════════════════════════════════════════════════════
   TABS DA CALCULADORA DE KM (Calculadora / Histórico / Ajustes)
   ═══════════════════════════════════════════════════════════════ */

const KM_TAB_PANELS = {
  calc:     { panel: 'panel-calc',     label: 'Calculadora' },
  history:  { panel: 'panel-history',  label: 'Histórico'   },
  settings: { panel: 'panel-settings', label: 'Ajustes'     },
};

function switchKmTab(tab, el) {
  /* Atualiza pills */
  document.querySelectorAll('.pill-item').forEach(p => {
    p.classList.remove('active');
    p.setAttribute('aria-selected', 'false');
  });
  if (el) {
    el.classList.add('active');
    el.setAttribute('aria-selected', 'true');
  }

  /* Troca painel visível */
  Object.values(KM_TAB_PANELS).forEach(({ panel }) => {
    document.getElementById(panel).classList.add('hidden');
  });
  const target = KM_TAB_PANELS[tab];
  if (target) document.getElementById(target.panel).classList.remove('hidden');

  /* Atualiza breadcrumb */
  const bc = document.getElementById('km-breadcrumb');
  if (bc && target) bc.textContent = target.label;

  /* Ao abrir histórico, re-renderiza */
  if (tab === 'history') renderHistory();
}

/* ═══════════════════════════════════════════════════════════════
   CALCULADORA DE DESLOCAMENTO
   ═══════════════════════════════════════════════════════════════ */

let isRoundtrip  = false;
let _lastCalc    = null;   // último cálculo realizado (para salvar no histórico)

/* ─── Toggle ida e volta ─────────────────────────────────────── */
function toggleRoundtrip() {
  isRoundtrip = !isRoundtrip;
  const toggle = document.getElementById('roundtrip-toggle');
  const label  = document.getElementById('roundtrip-label');
  toggle.setAttribute('aria-checked', String(isRoundtrip));
  label.textContent = isRoundtrip ? 'Ida e Volta' : 'Somente Ida';
  updateKmPreview();
}

function updateKmPreview() {
  const dist     = parseFloat(document.getElementById('distance').value);
  const preview  = document.getElementById('km-preview');
  const previewVal = document.getElementById('km-preview-val');
  if (dist > 0) {
    previewVal.textContent = formatKm(isRoundtrip ? dist * 2 : dist);
    preview.hidden = false;
  } else {
    preview.hidden = true;
  }
}

document.getElementById('distance').addEventListener('input', updateKmPreview);

/* ─── Cálculo principal ──────────────────────────────────────── */
function calcularKM() {
  const distance    = parseFloat(document.getElementById('distance').value)    || 0;
  const consumption = parseFloat(document.getElementById('consumption').value) || 10;
  const fuelPrice   = parseMasked('fuel-price')  || 5.80;
  const ratePerKm   = parseMasked('rate-per-km') || 2.10;
  const origin      = document.getElementById('origin').value.trim();
  const destination = document.getElementById('destination').value.trim();

  if (distance <= 0) {
    shakeField('distance');
    alert('Informe a distância de ida em KM.');
    return;
  }

  const totalKm  = isRoundtrip ? distance * 2 : distance;
  const realCost = (totalKm / consumption) * fuelPrice;
  const charge   = totalKm * ratePerKm;
  const profit   = charge - realCost;

  document.getElementById('result-cost').textContent   = formatBRL(realCost);
  document.getElementById('result-charge').textContent = formatBRL(charge);
  document.getElementById('result-profit').textContent = formatBRL(profit);

  const tripLabel  = isRoundtrip ? 'ida e volta' : 'somente ida';
  const routeLabel = (origin && destination)
    ? `de <strong>${origin}</strong> até <strong>${destination}</strong>`
    : 'do trajeto informado';

  const summaryLines = [
    `Trajeto ${routeLabel} (${tripLabel}): <strong>${formatKm(totalKm)}</strong>`,
    `Consumo: <strong>${consumption} km/L</strong> · Combustível: <strong>${formatBRL(fuelPrice)}/L</strong>`,
    `Valor cobrado: <strong>${formatBRL(ratePerKm)}/km</strong>`,
  ];

  if (profit < 0) {
    summaryLines.push(`⚠️ Atenção: valor cobrado por km está abaixo do custo de combustível.`);
  } else {
    const margin = charge > 0 ? ((profit / charge) * 100).toFixed(1) : 0;
    summaryLines.push(`Margem sobre a cobrança: <strong>${margin}%</strong>`);
  }

  document.getElementById('results-summary').innerHTML = summaryLines.join('<br>');
  document.getElementById('results-area').hidden = false;
  document.getElementById('results-area').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  /* Guarda para o botão "Salvar no Histórico" */
  _lastCalc = { origin, destination, totalKm, tripLabel, realCost, charge, profit,
                ratePerKm, consumption, fuelPrice, savedAt: null };
}

/* ─── Resetar formulário ─────────────────────────────────────── */
function resetCalc() {
  document.getElementById('origin').value      = '';
  document.getElementById('destination').value = '';
  document.getElementById('distance').value    = '';
  document.getElementById('consumption').value = '10';
  document.getElementById('fuel-price').value  = '5,80';
  document.getElementById('rate-per-km').value = '2,10';
  if (isRoundtrip) toggleRoundtrip();
  document.getElementById('results-area').hidden = true;
  document.getElementById('km-preview').hidden   = true;
  _lastCalc = null;
  document.getElementById('origin').focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ─── Enter nos inputs dispara cálculo ───────────────────────── */
['distance','consumption','fuel-price','rate-per-km'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') calcularKM();
  });
});

/* ─── Salva settings ao alterar consumo/combustível/taxa ──────── */
['consumption','fuel-price','rate-per-km'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => {
    clearTimeout(_settingsSaveTimer);
    _settingsSaveTimer = setTimeout(() => {
      if (typeof saveKmSettingsToFirestore === 'function') saveKmSettingsToFirestore();
    }, 1500);
  });
});

/* ═══════════════════════════════════════════════════════════════
   HISTÓRICO
   ═══════════════════════════════════════════════════════════════ */

let kmHistory = [];   // array de cálculos salvos na sessão

function saveToHistory() {
  if (!_lastCalc) return;

  const entry = { ..._lastCalc, id: Date.now(), savedAt: new Date() };
  kmHistory.unshift(entry);   // mais recente primeiro
  _lastCalc = null;

  /* Persiste no Firestore se logado */
  if (typeof currentUser !== 'undefined' && currentUser) {
    db.collection('users').doc(currentUser.uid).collection('km_history').add({
      origin:      entry.origin,
      destination: entry.destination,
      totalKm:     entry.totalKm,
      tripLabel:   entry.tripLabel,
      realCost:    entry.realCost,
      charge:      entry.charge,
      profit:      entry.profit,
      ratePerKm:   entry.ratePerKm,
      consumption: entry.consumption,
      fuelPrice:   entry.fuelPrice,
      savedAt:     firebase.firestore.FieldValue.serverTimestamp(),
      expiresAt:   new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    }).then(ref => { entry.firestoreId = ref.id; });
  }

  /* Atualiza badge na pill */
  updateHistoryBadge();

  /* Feedback no botão */
  const btn = document.querySelector('.btn-save-history');
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="ph ph-check"></i> Salvo!';
  btn.disabled  = true;
  setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 1800);
}

function updateHistoryBadge() {
  const badge = document.getElementById('history-badge');
  if (kmHistory.length > 0) {
    badge.textContent = kmHistory.length;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

function clearHistory() {
  if (kmHistory.length === 0) return;
  if (!confirm('Limpar todo o histórico?')) return;

  /* Deleta do Firestore se logado */
  if (typeof currentUser !== 'undefined' && currentUser) {
    const col = db.collection('users').doc(currentUser.uid).collection('km_history');
    kmHistory.forEach(e => { if (e.firestoreId) col.doc(e.firestoreId).delete(); });
  }

  kmHistory = [];
  updateHistoryBadge();
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('history-list');

  if (kmHistory.length === 0) {
    list.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon"><i class="ph ph-clock-clockwise"></i></div>
        <h3>Nenhum cálculo salvo ainda</h3>
        <p>Faça um cálculo e clique em <strong>"Salvar no Histórico"</strong> para registrá-lo aqui.</p>
      </div>`;
    return;
  }

  list.innerHTML = '';
  kmHistory.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'history-card';

    const route = (entry.origin && entry.destination)
      ? `${entry.origin} → ${entry.destination}`
      : 'Trajeto sem endereço';

    const _now1  = new Date();
    const _isToday1 = entry.savedAt.toDateString() === _now1.toDateString();
    const time = _isToday1
      ? entry.savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : entry.savedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
        entry.savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const profitClass = entry.profit >= 0 ? 'history-profit--pos' : 'history-profit--neg';

    card.innerHTML = `
      <div class="history-card-header">
        <div class="history-card-route">
          <i class="ph ph-map-pin"></i>
          <span>${route}</span>
          <span class="history-trip-badge">${entry.tripLabel}</span>
        </div>
        <div class="history-card-meta">
          <span class="history-time"><i class="ph ph-clock"></i> ${time}</span>
          <button class="btn-history-delete" onclick="deleteHistoryEntry(${entry.id})" title="Remover">
            <i class="ph ph-x"></i>
          </button>
        </div>
      </div>
      <div class="history-card-values">
        <div class="history-val history-val--km">
          <span class="hv-label">Distância</span>
          <strong class="hv-value">${formatKm(entry.totalKm)}</strong>
        </div>
        <div class="history-val history-val--cost">
          <span class="hv-label">Custo</span>
          <strong class="hv-value">${formatBRL(entry.realCost)}</strong>
        </div>
        <div class="history-val history-val--charge">
          <span class="hv-label">Cobrança</span>
          <strong class="hv-value">${formatBRL(entry.charge)}</strong>
        </div>
        <div class="history-val history-val--profit ${profitClass}">
          <span class="hv-label">Lucro</span>
          <strong class="hv-value">${formatBRL(entry.profit)}</strong>
        </div>
      </div>
    `;
    list.appendChild(card);
  });
}

function deleteHistoryEntry(id) {
  const entry = kmHistory.find(e => String(e.id) === String(id));
  if (entry && entry.firestoreId && typeof currentUser !== 'undefined' && currentUser) {
    db.collection('users').doc(currentUser.uid).collection('km_history').doc(entry.firestoreId).delete();
  }
  kmHistory = kmHistory.filter(e => String(e.id) !== String(id));
  updateHistoryBadge();
  renderHistory();
}

/* ═══════════════════════════════════════════════════════════════
   AJUSTES — TABELA DE CUSTO POR KM
   ═══════════════════════════════════════════════════════════════ */

const KM_DEFAULTS = {
  fuel: 0.65, tires: 0.06, maintenance: 0.10, insurance: 0.25, depreciation: 0.40,
};

let _kmTotal = 1.46;
let _settingsSaveTimer = null;

function recalcKmTable() {
  const fuel         = parseFloat(document.getElementById('ki-fuel').value)         || 0;
  const tires        = parseFloat(document.getElementById('ki-tires').value)        || 0;
  const maintenance  = parseFloat(document.getElementById('ki-maintenance').value)  || 0;
  const insurance    = parseFloat(document.getElementById('ki-insurance').value)    || 0;
  const depreciation = parseFloat(document.getElementById('ki-depreciation').value) || 0;

  const subtotal = fuel + tires + maintenance + insurance;
  _kmTotal       = subtotal + depreciation;

  document.getElementById('ki-subtotal').textContent = formatBRL(subtotal);
  document.getElementById('ki-total').textContent    = formatBRL(_kmTotal);

  /* Salva settings no Firestore com debounce de 1,5s */
  clearTimeout(_settingsSaveTimer);
  _settingsSaveTimer = setTimeout(() => {
    if (typeof saveKmSettingsToFirestore === 'function') saveKmSettingsToFirestore();
  }, 1500);
}

function resetKmTable() {
  document.getElementById('ki-fuel').value         = KM_DEFAULTS.fuel;
  document.getElementById('ki-tires').value        = KM_DEFAULTS.tires;
  document.getElementById('ki-maintenance').value  = KM_DEFAULTS.maintenance;
  document.getElementById('ki-insurance').value    = KM_DEFAULTS.insurance;
  document.getElementById('ki-depreciation').value = KM_DEFAULTS.depreciation;
  recalcKmTable();
}

function applyKmRate() {
  document.getElementById('rate-per-km').value = _kmTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (typeof saveKmSettingsToFirestore === 'function') saveKmSettingsToFirestore();

  /* Volta para a aba Calculadora */
  const calcPill = document.querySelector('.pill-item');
  switchKmTab('calc', calcPill);

  /* Pulso no campo aplicado */
  setTimeout(() => {
    const wrap = document.getElementById('rate-per-km').closest('.input-currency');
    wrap.style.transition  = 'box-shadow 0.2s';
    wrap.style.boxShadow   = '0 0 0 4px rgba(20,71,230,0.25)';
    setTimeout(() => { wrap.style.boxShadow = ''; }, 1200);
  }, 200);
}

/* ═══════════════════════════════════════════════════════════════
   COMPARADOR CLT × PJ
   ═══════════════════════════════════════════════════════════════ */

let cltPjRegime  = 'simples';
let _lastCltCalc = null;
let cltHistory   = [];

/* ─── Troca de aba (Comparador / Histórico) ─────────────────── */
function switchCltTab(tab, el) {
  document.querySelectorAll('#tool-clt-pj .pill-item').forEach(p => {
    p.classList.remove('active');
    p.setAttribute('aria-selected', 'false');
  });
  if (el) { el.classList.add('active'); el.setAttribute('aria-selected', 'true'); }

  document.getElementById('panel-compare').classList.toggle('hidden', tab !== 'compare');
  document.getElementById('panel-history-clt').classList.toggle('hidden', tab !== 'history');

  const bc = document.getElementById('clt-breadcrumb');
  if (bc) bc.textContent = tab === 'history' ? 'Histórico' : 'Comparador';

  if (tab === 'history') renderHistoryCLT();
}

/* ─── Badge ──────────────────────────────────────────────────── */
function updateCltBadge() {
  const badge = document.getElementById('clt-history-badge');
  if (cltHistory.length > 0) {
    badge.textContent = cltHistory.length;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

/* ─── Salvar ─────────────────────────────────────────────────── */
function saveToHistoryCLT() {
  if (!_lastCltCalc) return;
  const entry = { ..._lastCltCalc, id: Date.now(), savedAt: new Date() };
  cltHistory.unshift(entry);
  _lastCltCalc = null;

  /* Persiste no Firestore se logado */
  if (typeof currentUser !== 'undefined' && currentUser) {
    db.collection('users').doc(currentUser.uid).collection('clt_history').add({
      regime:   entry.regime,
      sal:      entry.sal,
      totalCLT: entry.totalCLT,
      totalPJ:  entry.totalPJ,
      diff:     entry.diff,
      savedAt:  firebase.firestore.FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    }).then(ref => { entry.firestoreId = ref.id; });
  }

  updateCltBadge();

  const btn = document.getElementById('btn-save-clt');
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="ph ph-check"></i> Salvo!';
  btn.disabled  = true;
  setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 1800);
}

/* ─── Limpar ─────────────────────────────────────────────────── */
function clearHistoryCLT() {
  if (cltHistory.length === 0) return;
  if (!confirm('Limpar todo o histórico?')) return;

  if (typeof currentUser !== 'undefined' && currentUser) {
    const col = db.collection('users').doc(currentUser.uid).collection('clt_history');
    cltHistory.forEach(e => { if (e.firestoreId) col.doc(e.firestoreId).delete(); });
  }

  cltHistory = [];
  updateCltBadge();
  renderHistoryCLT();
}

/* ─── Deletar entrada ────────────────────────────────────────── */
function deleteHistoryCLT(id) {
  const entry = cltHistory.find(e => String(e.id) === String(id));
  if (entry && entry.firestoreId && typeof currentUser !== 'undefined' && currentUser) {
    db.collection('users').doc(currentUser.uid).collection('clt_history').doc(entry.firestoreId).delete();
  }
  cltHistory = cltHistory.filter(e => String(e.id) !== String(id));
  updateCltBadge();
  renderHistoryCLT();
}

/* ─── Renderizar ─────────────────────────────────────────────── */
function renderHistoryCLT() {
  const list = document.getElementById('clt-history-list');

  if (cltHistory.length === 0) {
    list.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon"><i class="ph ph-clock-clockwise"></i></div>
        <h3>Nenhuma comparação salva ainda</h3>
        <p>Faça uma comparação e clique em <strong>"Salvar no Histórico"</strong> para registrá-la aqui.</p>
      </div>`;
    return;
  }

  list.innerHTML = '';
  cltHistory.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'history-card';
    const _now2  = new Date();
    const _isToday2 = entry.savedAt.toDateString() === _now2.toDateString();
    const time = _isToday2
      ? entry.savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : entry.savedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
        entry.savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const regimeLabel = entry.regime === 'lucro' ? 'Lucro Real/Presumido' : 'Simples Nacional';
    const diffClass   = entry.diff <= 0 ? 'history-profit--pos' : 'history-profit--neg';
    const diffLabel   = entry.diff > 0 ? `CLT custa mais` : entry.diff < 0 ? `PJ custa mais` : `Custo equivalente`;

    card.innerHTML = `
      <div class="history-card-header">
        <div class="history-card-route">
          <i class="ph ph-scales"></i>
          <span>Salário ${formatBRL(entry.sal)}</span>
          <span class="history-trip-badge">${regimeLabel}</span>
        </div>
        <div class="history-card-meta">
          <span class="history-time"><i class="ph ph-clock"></i> ${time}</span>
          <button class="btn-history-delete" onclick="deleteHistoryCLT(${entry.id})" title="Remover">
            <i class="ph ph-x"></i>
          </button>
        </div>
      </div>
      <div class="history-card-values">
        <div class="history-val history-val--cost">
          <span class="hv-label">Custo CLT</span>
          <strong class="hv-value">${formatBRL(entry.totalCLT)}</strong>
        </div>
        <div class="history-val history-val--charge">
          <span class="hv-label">Custo PJ</span>
          <strong class="hv-value">${formatBRL(entry.totalPJ)}</strong>
        </div>
        <div class="history-val history-val--profit ${diffClass}">
          <span class="hv-label">Diferença</span>
          <strong class="hv-value">${formatBRL(Math.abs(entry.diff))}</strong>
        </div>
        <div class="history-val">
          <span class="hv-label">Veredito</span>
          <strong class="hv-value" style="font-size:.8rem">${diffLabel}</strong>
        </div>
      </div>
    `;
    list.appendChild(card);
  });
}

function selectCltRegime(r) {
  cltPjRegime = r;
  document.getElementById('opt-simples').classList.toggle('selected', r === 'simples');
  document.getElementById('opt-lucro').classList.toggle('selected', r === 'lucro');
}

function calcularCLTPJ() {
  const sal    = parseMasked('clt-salario');
  if (sal <= 0) { shakeField('clt-salario'); alert('Informe o salário bruto do funcionário.'); return; }

  const vrVal  = parseMasked('clt-vr');
  const vtVal  = parseMasked('clt-vt');
  const cesta  = parseMasked('clt-cesta');
  const bonus  = parseMasked('clt-bonus');
  const outros = parseMasked('clt-outros');
  const pjNF   = parseMasked('pj-valor');
  const pjBenef= parseMasked('pj-benef');

  const base = sal + bonus;

  let inssP = 0, sistS = 0;
  if (cltPjRegime === 'lucro') { inssP = base * 0.20; sistS = base * 0.07; }

  const fgts   = base * 0.08;
  const decimo = base * 0.0833;
  const ferias = base * 0.1111;
  const multa  = fgts * 0.40 / 12;

  const totalCLT = sal + inssP + sistS + fgts + decimo + ferias + multa + vrVal + vtVal + cesta + bonus + outros;
  const totalPJ  = pjNF + pjBenef;
  const diff     = totalCLT - totalPJ;
  const pct      = ((totalCLT - sal) / sal * 100).toFixed(1);

  const set = (id, val) => { document.getElementById(id).textContent = val; };

  set('r-clt-total', formatBRL(totalCLT));
  set('r-pj-total',  formatBRL(totalPJ));
  set('r-clt-pct',   pct + '% acima do salário bruto');
  set('r-diff',      formatBRL(Math.abs(diff)));
  set('r-diff-sub',  diff > 0 ? 'CLT custa mais' : diff < 0 ? 'PJ custa mais' : 'Custo equivalente');

  set('bd-salario', formatBRL(sal));

  if (cltPjRegime === 'simples') {
    set('bd-inss-pat', 'No DAS');
    document.getElementById('bd-inss-pat').className = 'bk-val bk-val--muted';
    document.getElementById('txt-inss-pat').textContent = 'Incluso no DAS — Simples Nacional';
  } else {
    set('bd-inss-pat', formatBRL(inssP));
    document.getElementById('bd-inss-pat').className = 'bk-val bk-val--red';
    document.getElementById('txt-inss-pat').textContent = '20% sobre salário + comissão';
  }

  set('bd-fgts',           formatBRL(fgts));
  set('bd-sistema-s',      formatBRL(sistS));
  set('bd-decimo',         formatBRL(decimo));
  set('bd-ferias',         formatBRL(ferias));
  set('bd-multa',          formatBRL(multa));
  set('bd-vr',             formatBRL(vrVal));
  set('bd-vt',             formatBRL(vtVal));
  set('bd-cesta',          formatBRL(cesta));
  set('bd-bonus',          formatBRL(bonus));
  set('bd-outros',         formatBRL(outros));
  set('bd-pj-nf',          formatBRL(pjNF));
  set('bd-pj-benef-extra', formatBRL(pjBenef));
  set('bd-total-clt',      formatBRL(totalCLT));
  set('bd-total-pj',       formatBRL(totalPJ));

  document.getElementById('bk-row-sistema-s').hidden = (cltPjRegime === 'simples');

  const alertEl   = document.getElementById('clt-alert');
  const alertText = document.getElementById('clt-alert-text');
  if (diff > 0) {
    alertEl.className = 'clt-alert clt-alert--amber';
    alertText.innerHTML = `<strong>CLT custa ${formatBRL(diff)} a mais por mês</strong> (${formatBRL(diff * 12)} por ano). Para que valha a pena, o funcionário precisa gerar esse valor adicional em produtividade, segurança jurídica ou continuidade.`;
  } else if (diff < 0) {
    alertEl.className = 'clt-alert clt-alert--green';
    alertText.innerHTML = `<strong>Neste cenário o PJ custa ${formatBRL(Math.abs(diff))} a mais por mês.</strong> Revise o valor do contrato PJ ou avalie se os benefícios da relação CLT justificam a diferença.`;
  } else {
    alertEl.className = 'clt-alert clt-alert--green';
    alertText.innerHTML = 'Os dois modelos apresentam custo equivalente neste cenário.';
  }

  /* Guarda para o botão "Salvar no Histórico" */
  _lastCltCalc = { regime: cltPjRegime, sal, totalCLT, totalPJ, diff };

  const resultsEl = document.getElementById('clt-results');
  resultsEl.hidden = false;
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ═══════════════════════════════════════════════════════════════
   DISPARO WHATSAPP
   ═══════════════════════════════════════════════════════════════ */

const DISPARO_PAL = [
  ['#0d4a3a','#00d4aa'], ['#0c2a4a','#4fa8e8'], ['#3a0f2e','#d47ab0'],
  ['#2d1a04','#f0a040'], ['#1a1040','#8b7fe8'], ['#0d2a20','#3db87a'],
];

const DISPARO_TMPL = `Olá, {nome}! Tudo bem?\n\nVi você no grupo {grupo} e queria me apresentar.\n\nSou o Jheferson da WordVirtua — desenvolvemos o Orbit, um sistema de governança feito para donos de empresas de serviços que querem sair das planilhas e ter controle real do negócio.\n\nVocê teria 15 minutos para eu te mostrar? Pode ser aqui pelo WhatsApp mesmo.`;

const DISPARO_FREE_LIMIT = 100;

let disparoContacts   = [];
let disparoSel        = null;
let disparoNid        = 1;
let _disparoTagFilter = null;   // string ou null
let _disparoFUFilter  = null;   // 'today' | 'overdue' | null

const disparoInitials = n => (n || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

/* disparoPal aceita ID numérico ou string (Firestore docId) */
const disparoPal = id => {
  const n = typeof id === 'number' ? id
    : String(id).split('').reduce((h, c) => Math.imul(31, h) + c.charCodeAt(0) | 0, 0);
  return DISPARO_PAL[Math.abs(n) % DISPARO_PAL.length];
};

function disparoUpdateStats() {
  const t = disparoContacts.length;
  const s = disparoContacts.filter(c => c.status === 'sent').length;
  const pct = t ? Math.round(s / t * 100) : 0;
  document.getElementById('dst').textContent = t;
  document.getElementById('dss').textContent = s;
  document.getElementById('dsp').textContent = t - s;
  document.getElementById('disparo-pf').style.width = pct + '%';
  document.getElementById('disparo-pl').textContent = s + ' / ' + t + ' enviados';
}

function disparoRenderList(list) {
  const el = document.getElementById('disparo-cl');

  if (!list.length) {
    const hasContacts = disparoContacts.length > 0;
    el.innerHTML = hasContacts
      ? '<div class="disparo-clist-empty">Nenhum resultado para a busca.</div>'
      : `<div class="disparo-clist-empty disparo-clist-empty--main">
           <i class="ph ph-users"></i>
           <p>Nenhum contato ainda.</p>
           <p>Clique em <strong>Novo Contato</strong> para começar.</p>
         </div>`;
    return;
  }

  const plan = (typeof _userPlan !== 'undefined') ? _userPlan : 'free';
  const pct  = plan !== 'orbit' ? Math.round(list.length / DISPARO_FREE_LIMIT * 100) : 0;

  el.innerHTML = list.map(c => {
    const [bg, fg]  = disparoPal(c.id);
    const isActive  = String(c.id) === String(disparoSel);
    const msgs      = c.messages || [];
    const lastMsg   = msgs.length > 0 ? msgs[msgs.length - 1] : null;
    const fuStatus  = _getFollowUpStatus(c.followUpDate);

    const metaLine = lastMsg
      ? `<div class="disparo-ci-meta"><i class="ph ph-paper-plane-tilt"></i> ${_formatRelativeDate(new Date(lastMsg.date))} · ${msgs.length} msg${msgs.length !== 1 ? 's' : ''}</div>`
      : '';

    const tagsEl = (c.tags || []).length > 0
      ? `<div class="disparo-ci-tags">${(c.tags).slice(0, 2).map(t => `<span class="disparo-ci-tag">${_esc(t)}</span>`).join('')}${c.tags.length > 2 ? `<span class="disparo-ci-tag disparo-ci-tag--more">+${c.tags.length - 2}</span>` : ''}</div>`
      : '';

    const fuDot = fuStatus === 'overdue' ? '<span class="disparo-fu-dot disparo-fu-dot--overdue" title="Follow-up atrasado"></span>'
                : fuStatus === 'today'   ? '<span class="disparo-fu-dot disparo-fu-dot--today"   title="Follow-up hoje"></span>'
                : '';

    return `<div class="disparo-ci${isActive ? ' active' : ''}${c.status === 'sent' ? ' faded' : ''}${fuStatus ? ` disparo-ci--fu-${fuStatus}` : ''}" onclick="disparoSelectContact('${c.id}')">
      <div class="disparo-av" style="background:${bg};color:${fg};">${disparoInitials(c.name)}</div>
      <div class="disparo-ci-info">
        <div class="disparo-ci-name">${c.name} ${fuDot}</div>
        <div class="disparo-ci-sub">${c.company} · ${c.group}</div>
        ${metaLine}
        ${tagsEl}
      </div>
      <div class="disparo-dot${c.status === 'sent' ? ' disparo-dot--sent' : ' disparo-dot--pending'}"></div>
    </div>`;
  }).join('');
}

function disparoFilter() {
  const q = (document.getElementById('disparo-si').value || '').toLowerCase();
  const today = new Date().toISOString().split('T')[0];

  let list = disparoContacts.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.company.toLowerCase().includes(q) ||
    c.group.toLowerCase().includes(q)
  );

  if (_disparoTagFilter) {
    list = list.filter(c => (c.tags || []).includes(_disparoTagFilter));
  }

  if (_disparoFUFilter === 'today') {
    list = list.filter(c => c.followUpDate === today);
  } else if (_disparoFUFilter === 'overdue') {
    list = list.filter(c => c.followUpDate && c.followUpDate < today);
  }

  disparoRenderList(list);
}

function disparoGetTemplate() {
  const ta = document.getElementById('disparo-ta');
  return ta ? ta.value : DISPARO_TMPL;
}

function disparoBuildMsg(c) {
  return disparoGetTemplate()
    .replace(/{nome}/g,      c.name.split(' ')[0])
    .replace(/{empresa}/g,   c.company)
    .replace(/{grupo}/g,     c.group)
    .replace(/{segmento}/g,  c.segment);
}

function disparoSelectContact(id) {
  disparoSel = String(id);
  const c = disparoContacts.find(x => String(x.id) === String(id));
  if (!c) return;
  disparoFilter();
  const [bg, fg] = disparoPal(c.id);
  const s   = disparoContacts.filter(x => x.status === 'sent').length;
  const t   = disparoContacts.length;
  const pct = t ? Math.round(s / t * 100) : 0;
  const statusBadge = c.status === 'sent'
    ? '<span class="disparo-badge disparo-badge--sent">Enviado</span>'
    : '<span class="disparo-badge disparo-badge--pending">Pendente</span>';

  const sid  = String(id);
  const msgs = c.messages || [];
  const msgsBadge = msgs.length > 0
    ? `<span class="disparo-msg-badge">${msgs.length}</span>`
    : '';
  const msgsHtml = msgs.length === 0
    ? `<div class="disparo-msg-empty"><i class="ph ph-chat-slash"></i> Nenhuma mensagem enviada ainda. Clique em <strong>Abrir no WhatsApp</strong> para registrar.</div>`
    : [...msgs].reverse().map(m => {
        const d       = new Date(m.date);
        const dateStr = d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return `<div class="disparo-msg-entry">
          <div class="disparo-msg-entry-header">
            <span class="disparo-msg-tmpl"><i class="ph ph-file-text"></i> ${_esc(m.templateName)}</span>
            <span class="disparo-msg-date"><i class="ph ph-clock"></i> ${dateStr}</span>
          </div>
          <p class="disparo-msg-preview">${_esc(m.preview)}${m.preview.length >= 120 ? '…' : ''}</p>
        </div>`;
      }).join('');

  document.getElementById('disparo-main').innerHTML = `
    <div class="disparo-mheader">
      <div class="disparo-mtitle">${c.name} ${statusBadge}</div>
      <div class="disparo-msub">${c.company} · ${c.segment} · ${c.group} · +${c.phone}</div>
    </div>
    <div class="disparo-mbody">
      <div class="card disparo-hero-row">
        <div class="disparo-av disparo-av--lg" style="background:${bg};color:${fg};">${disparoInitials(c.name)}</div>
        <div style="flex:1;min-width:0;">
          <div class="disparo-hero-name">${c.name}</div>
          <div class="disparo-hero-chips">
            <span class="disparo-chip">🏢 ${c.company}</span>
            <span class="disparo-chip">🔧 ${c.segment}</span>
            <span class="disparo-chip">👥 ${c.group}</span>
            <span class="disparo-chip">📱 +${c.phone}</span>
          </div>
        </div>
        <button class="disparo-btn-edit-contact" onclick="disparoOpenEditModal('${sid}')" title="Editar contato">
          <i class="ph ph-pencil-simple"></i> Editar
        </button>
      </div>

      <div class="card disparo-org-card">
        <div class="disparo-org-row">
          <span class="disparo-org-label"><i class="ph ph-tag"></i> Etiquetas</span>
          <div class="disparo-org-tags" id="disparo-tags-${sid}">
            ${(c.tags || []).map(t => `<span class="disparo-tag-chip">${_esc(t)}<button onclick="disparoRemoveTag('${sid}','${_esc(t)}')" title="Remover"><i class="ph ph-x"></i></button></span>`).join('')}
            <div class="disparo-tag-add-wrap">
              <input list="disparo-tags-datalist-${sid}" class="disparo-tag-input" id="disparo-tag-input-${sid}"
                placeholder="+ etiqueta"
                onkeydown="if(event.key==='Enter'){disparoAddTag('${sid}');event.preventDefault();}">
              <datalist id="disparo-tags-datalist-${sid}">${_allTagsDatalist()}</datalist>
            </div>
          </div>
        </div>
        <div class="disparo-org-row">
          <span class="disparo-org-label"><i class="ph ph-calendar-check"></i> Follow-up</span>
          <div class="disparo-followup-row" id="disparo-followup-row-${sid}">
            <input type="date" class="disparo-followup-input" id="disparo-followup-${sid}"
              value="${c.followUpDate || ''}"
              onchange="disparoSaveFollowUp('${sid}')">
            ${c.followUpDate ? `<button class="disparo-followup-clear" onclick="disparoClearFollowUp('${sid}')" title="Remover follow-up"><i class="ph ph-x"></i></button>` : ''}
            ${c.followUpDate ? `<span class="disparo-followup-status disparo-followup-status--${_getFollowUpStatus(c.followUpDate) || 'upcoming'}">${_followUpLabel(c.followUpDate)}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="disparo-notes-section">
        <div class="disparo-sec-lbl" style="margin-bottom:8px;"><i class="ph ph-note-pencil"></i> Anotações</div>
        <textarea class="disparo-notes-ta" id="disparo-notes-${sid}"
          placeholder="Contexto da conversa, respostas recebidas, próximos passos..."
          oninput="disparoNoteInput('${sid}')">${_esc(c.notes || '')}</textarea>
        <div class="disparo-notes-status" id="disparo-notes-status-${sid}"></div>
      </div>

      <div class="disparo-prog-row">
        <div class="disparo-prog-bg"><div class="disparo-prog-fill" style="width:${pct}%"></div></div>
        <span class="disparo-prog-lbl">${s} / ${t} (${pct}%)</span>
      </div>

      <div>
        <div class="disparo-tmpl-selector-row">
          <span class="disparo-sec-lbl" style="margin:0;">Template</span>
          <div class="disparo-tmpl-pills" id="disparo-tmpl-pills">
            ${_renderTmplPills(sid)}
          </div>
          <button class="disparo-tmpl-manage" onclick="switchDisparoTab('templates', document.querySelectorAll('#tool-disparo .pill-item')[1])">
            <i class="ph ph-pencil-simple"></i> Gerenciar
          </button>
        </div>
        <div class="disparo-tbox">
          <textarea class="disparo-ta" id="disparo-ta" oninput="disparoLivePreview('${sid}')">${DISPARO_TMPL}</textarea>
          <div class="disparo-tbar">
            <div class="disparo-var-chips">
              <button class="disparo-vc" onclick="disparoInsertVar('{nome}')">+ nome</button>
              <button class="disparo-vc" onclick="disparoInsertVar('{empresa}')">+ empresa</button>
              <button class="disparo-vc" onclick="disparoInsertVar('{grupo}')">+ grupo</button>
              <button class="disparo-vc" onclick="disparoInsertVar('{segmento}')">+ segmento</button>
            </div>
            <span class="disparo-cc" id="disparo-cc">${DISPARO_TMPL.length} chars</span>
          </div>
        </div>
      </div>

      <div>
        <div class="disparo-sec-lbl">Preview — como ${c.name.split(' ')[0]} vai receber</div>
        <div class="disparo-pbubble" id="disparo-pb">${disparoBuildMsg(c)}</div>
        <div class="disparo-phint"><i class="ph ph-info"></i> O WhatsApp abre com a mensagem pronta — você só aperta Enviar</div>
      </div>

      <div class="disparo-arow">
        <button class="disparo-btn-whatsapp" onclick="disparoOpenWhatsApp('${sid}')">
          <i class="ph ph-whatsapp-logo"></i> Abrir no WhatsApp
        </button>
        ${c.status !== 'sent'
          ? `<button class="disparo-btn-success" onclick="disparoMarkSent('${sid}')"><i class="ph ph-check"></i> Marcar enviado</button>`
          : `<button class="disparo-btn-ghost" onclick="disparoMarkPending('${sid}')"><i class="ph ph-arrow-counter-clockwise"></i> Desmarcar</button>`}
        <button class="disparo-btn-danger" onclick="disparoRemoveContact('${sid}')"><i class="ph ph-trash"></i> Remover</button>
      </div>

      <div class="disparo-msg-history">
        <div class="disparo-sec-lbl" style="margin-bottom:12px;">
          <i class="ph ph-paper-plane-tilt"></i> Mensagens enviadas ${msgsBadge}
        </div>
        ${msgsHtml}
      </div>

    </div>`;
}

function disparoLivePreview(id) {
  const c = disparoContacts.find(x => String(x.id) === String(id)); if (!c) return;
  const pb = document.getElementById('disparo-pb');
  const cc = document.getElementById('disparo-cc');
  const ta = document.getElementById('disparo-ta');
  if (pb) pb.textContent = disparoBuildMsg(c);
  if (cc && ta) cc.textContent = ta.value.length + ' chars';
}

function disparoInsertVar(v) {
  const ta = document.getElementById('disparo-ta'); if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  ta.value = ta.value.slice(0, s) + v + ta.value.slice(e);
  ta.selectionStart = ta.selectionEnd = s + v.length;
  ta.focus();
  if (disparoSel) disparoLivePreview(disparoSel);
}

function _disparoGetActiveTemplateName() {
  const pill = document.querySelector('#disparo-tmpl-pills .disparo-tmpl-pill.active');
  if (!pill || !pill.dataset.tmpl) return 'Padrão';
  const t = disparoTemplates.find(x => x.id === pill.dataset.tmpl);
  return t ? t.name : 'Padrão';
}

function _formatRelativeDate(date) {
  const diff = Math.floor((Date.now() - date) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff < 7)  return diff + 'd atrás';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function disparoOpenWhatsApp(id) {
  const c = disparoContacts.find(x => String(x.id) === String(id)); if (!c) return;

  const msg = disparoBuildMsg(c);

  /* Registra no histórico de mensagens */
  const entry = {
    date:         new Date().toISOString(),
    templateName: _disparoGetActiveTemplateName(),
    preview:      msg.slice(0, 120),
  };
  if (!c.messages) c.messages = [];
  c.messages.push(entry);

  if (typeof currentUser !== 'undefined' && currentUser) {
    db.collection('users').doc(currentUser.uid).collection('disparo_contacts').doc(String(id))
      .update({ messages: c.messages }).catch(() => {});
  }

  const url = 'https://api.whatsapp.com/send?phone=' + c.phone.replace(/\D/g,'') + '&text=' + encodeURIComponent(msg);
  window.open(url, '_blank');
  disparoMarkSent(id);
  disparoShowToast('WhatsApp aberto! Só apertar Enviar.');
}

function disparoMarkSent(id) {
  const c = disparoContacts.find(x => String(x.id) === String(id));
  if (!c) return;
  c.status = 'sent';
  if (typeof currentUser !== 'undefined' && currentUser) {
    db.collection('users').doc(currentUser.uid).collection('disparo_contacts').doc(String(id))
      .update({ status: 'sent' }).catch(() => {});
  }
  disparoUpdateStats(); disparoSelectContact(id); disparoFilter();
}

function disparoMarkPending(id) {
  const c = disparoContacts.find(x => String(x.id) === String(id));
  if (!c) return;
  c.status = 'pending';
  if (typeof currentUser !== 'undefined' && currentUser) {
    db.collection('users').doc(currentUser.uid).collection('disparo_contacts').doc(String(id))
      .update({ status: 'pending' }).catch(() => {});
  }
  disparoUpdateStats(); disparoSelectContact(id); disparoFilter();
}

function disparoRemoveContact(id) {
  if (!confirm('Remover este contato?')) return;
  if (typeof currentUser !== 'undefined' && currentUser) {
    db.collection('users').doc(currentUser.uid).collection('disparo_contacts').doc(String(id))
      .delete().catch(() => {});
  }
  disparoContacts = disparoContacts.filter(c => String(c.id) !== String(id));
  disparoSel = null;
  document.getElementById('disparo-main').innerHTML = `
    <div class="disparo-empty">
      <div class="disparo-empty-icon"><i class="ph ph-chat-circle-dots"></i></div>
      <div class="disparo-empty-t">Nenhum contato selecionado</div>
      <div class="disparo-empty-s">Selecione um contato para personalizar e disparar a mensagem pelo WhatsApp</div>
    </div>`;
  disparoUpdateStats(); disparoFilter(); _disparoUpdateLimitBar();
  if (typeof renderCRM === 'function') renderCRM();
}

/* ─── Troca de painel (Central / Templates) ─────────────────── */
function switchDisparoTab(tab, el) {
  document.querySelectorAll('#tool-disparo .pill-item').forEach(p => {
    p.classList.remove('active');
    p.setAttribute('aria-selected', 'false');
  });
  if (el) { el.classList.add('active'); el.setAttribute('aria-selected', 'true'); }

  document.getElementById('panel-disparo-central').hidden   = (tab !== 'central');
  document.getElementById('panel-disparo-templates').hidden = (tab !== 'templates');

  if (tab === 'templates') renderDisparoTemplates();
}

let _disparoEditId = null;   // null = novo contato, string = editar

function disparoOpenModal() {
  _disparoEditId = null;
  document.getElementById('disparo-modal-title').textContent = 'Adicionar Contato';
  const btn = document.getElementById('disparo-modal-confirm-btn');
  btn.innerHTML = '<i class="ph ph-plus"></i> Adicionar';
  btn.onclick = disparoAddContact;
  document.getElementById('disparo-ov').classList.add('open');
}

function disparoOpenEditModal(id) {
  const c = disparoContacts.find(x => String(x.id) === String(id));
  if (!c) return;
  _disparoEditId = String(id);

  document.getElementById('disparo-modal-title').textContent = 'Editar Contato';
  document.getElementById('d-fn').value   = c.name    !== '—' ? c.name    : '';
  document.getElementById('d-fc').value   = c.company !== '—' ? c.company : '';
  document.getElementById('d-fseg').value = c.segment !== '—' ? c.segment : '';
  document.getElementById('d-fg').value   = c.group   !== '—' ? c.group   : '';
  document.getElementById('d-fp').value   = c.phone;

  const btn = document.getElementById('disparo-modal-confirm-btn');
  btn.innerHTML = '<i class="ph ph-check"></i> Salvar alterações';
  btn.onclick = disparoSaveEdit;

  document.getElementById('disparo-ov').classList.add('open');
}

function disparoSaveEdit() {
  const name  = document.getElementById('d-fn').value.trim();
  const phone = document.getElementById('d-fp').value.trim();
  if (!name || !phone) { disparoShowToast('Nome e WhatsApp são obrigatórios.', true); return; }

  const c = disparoContacts.find(x => String(x.id) === String(_disparoEditId));
  if (!c) return;

  c.name    = name;
  c.company = document.getElementById('d-fc').value.trim()   || '—';
  c.segment = document.getElementById('d-fseg').value.trim() || '—';
  c.group   = document.getElementById('d-fg').value.trim()   || '—';
  c.phone   = phone;

  disparoCloseModal();

  if (typeof currentUser !== 'undefined' && currentUser) {
    db.collection('users').doc(currentUser.uid).collection('disparo_contacts').doc(String(c.id))
      .update({ name: c.name, company: c.company, segment: c.segment, group: c.group, phone: c.phone })
      .catch(() => { disparoShowToast('Erro ao salvar. Tente novamente.', true); });
  }

  disparoShowToast('Contato atualizado!');
  disparoFilter();
  disparoSelectContact(c.id);
  if (typeof renderCRM === 'function') renderCRM();
}

function disparoCloseModal() {
  _disparoEditId = null;
  document.getElementById('disparo-ov').classList.remove('open');
  ['d-fn','d-fc','d-fseg','d-fg','d-fp'].forEach(id => { document.getElementById(id).value = ''; });
}

function disparoCloseOverlay(e) {
  if (e.target.id === 'disparo-ov') disparoCloseModal();
}

function disparoAddContact() {
  const name  = document.getElementById('d-fn').value.trim();
  const phone = document.getElementById('d-fp').value.trim();
  if (!name || !phone) { disparoShowToast('Nome e WhatsApp são obrigatórios.', true); return; }

  /* Verifica limite do plano free */
  const plan = (typeof _userPlan !== 'undefined') ? _userPlan : 'free';
  if (plan !== 'orbit' && disparoContacts.length >= DISPARO_FREE_LIMIT) {
    disparoShowToast(`Limite de ${DISPARO_FREE_LIMIT} contatos atingido no plano gratuito.`, true);
    return;
  }

  const contact = {
    name,
    company:  document.getElementById('d-fc').value.trim()   || '—',
    segment:  document.getElementById('d-fseg').value.trim() || '—',
    group:    document.getElementById('d-fg').value.trim()   || '—',
    phone,
    status:       'pending',
    stage:        'novo',
    history:      [],
    messages:     [],
    notes:        '',
    tags:         [],
    followUpDate: null,
  };

  disparoCloseModal();

  if (typeof currentUser !== 'undefined' && currentUser) {
    /* Salva no Firestore — o ID do doc vira o ID do contato */
    db.collection('users').doc(currentUser.uid).collection('disparo_contacts').add({
      ...contact,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .then(ref => {
      contact.id = ref.id;
      disparoContacts.push(contact);
      disparoUpdateStats();
      disparoFilter();
      disparoShowToast('Contato adicionado!');
      _disparoUpdateLimitBar();
      if (typeof renderCRM === 'function') renderCRM();
    })
    .catch(() => { disparoShowToast('Erro ao salvar contato.', true); });
  } else {
    /* Sem login — salva só localmente */
    contact.id = disparoNid++;
    disparoContacts.push(contact);
    disparoUpdateStats();
    disparoFilter();
    disparoShowToast('Contato adicionado! Faça login para salvar permanentemente.');
    _disparoUpdateLimitBar();
    if (typeof renderCRM === 'function') renderCRM();
  }
}

/* Atualiza indicador de limite na barra lateral */
function _disparoUpdateLimitBar() {
  const plan  = (typeof _userPlan !== 'undefined') ? _userPlan : 'free';
  const wrap  = document.getElementById('disparo-limit-wrap');
  const el    = document.getElementById('disparo-limit-bar');
  const label = document.getElementById('disparo-limit-label');
  if (!wrap || !el || !label) return;

  if (plan === 'orbit') {
    wrap.hidden = true;
    return;
  }

  wrap.hidden = false;
  const used = disparoContacts.length;
  const pct  = Math.min(Math.round(used / DISPARO_FREE_LIMIT * 100), 100);
  el.style.width       = pct + '%';
  el.style.background  = pct >= 90 ? 'var(--c-red)' : pct >= 70 ? 'var(--c-amber)' : 'var(--c-blue)';
  label.textContent    = `${used} / ${DISPARO_FREE_LIMIT} contatos`;
}

function disparoShowToast(msg, err = false) {
  const el = document.getElementById('disparo-toast');
  document.getElementById('disparo-tm').textContent = msg;
  el.className = 'disparo-toast disparo-toast--show' + (err ? ' disparo-toast--err' : '');
  el.querySelector('i').className = err ? 'ph ph-warning' : 'ph ph-check-circle';
  setTimeout(() => { el.className = 'disparo-toast'; }, 3000);
}

/* ═══════════════════════════════════════════════════════════════
   ANOTAÇÕES RÁPIDAS POR CONTATO
   ═══════════════════════════════════════════════════════════════ */

let _disparoNotesTimer = null;

function disparoNoteInput(id) {
  clearTimeout(_disparoNotesTimer);
  const statusEl = document.getElementById('disparo-notes-status-' + id);
  if (statusEl) { statusEl.textContent = ''; statusEl.className = 'disparo-notes-status'; }
  _disparoNotesTimer = setTimeout(() => disparoSaveNote(id), 1500);
}

function disparoSaveNote(id) {
  const c  = disparoContacts.find(x => String(x.id) === String(id)); if (!c) return;
  const ta = document.getElementById('disparo-notes-' + id);         if (!ta) return;
  c.notes  = ta.value;

  const statusEl = document.getElementById('disparo-notes-status-' + id);
  const ok = () => {
    if (!statusEl) return;
    statusEl.textContent = 'Salvo ✓';
    statusEl.className   = 'disparo-notes-status disparo-notes-status--ok';
    setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'disparo-notes-status'; }, 2000);
  };
  const fail = () => {
    if (!statusEl) return;
    statusEl.textContent = 'Erro ao salvar';
    statusEl.className   = 'disparo-notes-status disparo-notes-status--err';
  };

  if (typeof currentUser !== 'undefined' && currentUser) {
    db.collection('users').doc(currentUser.uid).collection('disparo_contacts').doc(String(id))
      .update({ notes: c.notes }).then(ok).catch(fail);
  } else {
    ok();
  }
}

/* ═══════════════════════════════════════════════════════════════
   ETIQUETAS (TAGS)
   ═══════════════════════════════════════════════════════════════ */

function _allTagsDatalist() {
  const all = new Set();
  disparoContacts.forEach(c => (c.tags || []).forEach(t => all.add(t)));
  return [...all].map(t => `<option value="${_esc(t)}">`).join('');
}

function disparoAddTag(id) {
  const c     = disparoContacts.find(x => String(x.id) === String(id)); if (!c) return;
  const input = document.getElementById('disparo-tag-input-' + id);     if (!input) return;
  const tag   = input.value.trim().toLowerCase();
  if (!tag || (c.tags || []).includes(tag)) { input.value = ''; return; }

  if (!c.tags) c.tags = [];
  c.tags.push(tag);
  input.value = '';

  if (typeof currentUser !== 'undefined' && currentUser) {
    db.collection('users').doc(currentUser.uid).collection('disparo_contacts').doc(String(id))
      .update({ tags: c.tags }).catch(() => {});
  }

  _renderContactTags(id);
  _updateTagFilterChips();
  disparoFilter();
}

function disparoRemoveTag(id, tag) {
  const c = disparoContacts.find(x => String(x.id) === String(id)); if (!c) return;
  c.tags  = (c.tags || []).filter(t => t !== tag);

  if (typeof currentUser !== 'undefined' && currentUser) {
    db.collection('users').doc(currentUser.uid).collection('disparo_contacts').doc(String(id))
      .update({ tags: c.tags }).catch(() => {});
  }

  _renderContactTags(id);
  _updateTagFilterChips();
  if (_disparoTagFilter && !c.tags.includes(_disparoTagFilter)) disparoFilter();
}

function _renderContactTags(id) {
  const c         = disparoContacts.find(x => String(x.id) === String(id)); if (!c) return;
  const container = document.getElementById('disparo-tags-' + id);          if (!container) return;
  container.innerHTML =
    (c.tags || []).map(t =>
      `<span class="disparo-tag-chip">${_esc(t)}<button onclick="disparoRemoveTag('${id}','${_esc(t)}')" title="Remover"><i class="ph ph-x"></i></button></span>`
    ).join('') +
    `<div class="disparo-tag-add-wrap">
       <input list="disparo-tags-datalist-${id}" class="disparo-tag-input" id="disparo-tag-input-${id}"
         placeholder="+ etiqueta"
         onkeydown="if(event.key==='Enter'){disparoAddTag('${id}');event.preventDefault();}">
       <datalist id="disparo-tags-datalist-${id}">${_allTagsDatalist()}</datalist>
     </div>`;
}

function _updateTagFilterChips() {
  const wrap = document.getElementById('disparo-tag-filter-wrap'); if (!wrap) return;
  const all  = new Set();
  disparoContacts.forEach(c => (c.tags || []).forEach(t => all.add(t)));

  if (all.size === 0) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = [...all].map(t =>
    `<button class="disparo-fchip disparo-fchip--tag${_disparoTagFilter === t ? ' active' : ''}"
       data-tag="${_esc(t)}" onclick="disparoSetTagFilter('${_esc(t)}')">
       <i class="ph ph-tag"></i> ${_esc(t)}
     </button>`
  ).join('');
}

function disparoSetTagFilter(tag) {
  _disparoTagFilter = (_disparoTagFilter === tag) ? null : tag;
  document.querySelectorAll('.disparo-fchip--tag').forEach(el =>
    el.classList.toggle('active', el.dataset.tag === _disparoTagFilter)
  );
  disparoFilter();
}

/* ═══════════════════════════════════════════════════════════════
   FOLLOW-UP
   ═══════════════════════════════════════════════════════════════ */

function _getFollowUpStatus(dateStr) {
  if (!dateStr) return null;
  const today = new Date().toISOString().split('T')[0];
  if (dateStr < today) return 'overdue';
  if (dateStr === today) return 'today';
  return 'upcoming';
}

function _followUpLabel(dateStr) {
  const status = _getFollowUpStatus(dateStr);
  if (status === 'overdue') {
    const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
    return `Atrasado ${days}d`;
  }
  if (status === 'today') return 'Hoje';
  const days = Math.floor((new Date(dateStr) - Date.now()) / 86400000) + 1;
  return `Em ${days}d`;
}

function disparoSaveFollowUp(id) {
  const c     = disparoContacts.find(x => String(x.id) === String(id)); if (!c) return;
  const input = document.getElementById('disparo-followup-' + id);      if (!input) return;
  c.followUpDate = input.value || null;

  /* Atualiza o botão limpar e o label de status inline */
  const row = document.getElementById('disparo-followup-row-' + id);
  if (row) {
    /* Remove botão e label anteriores se existirem */
    row.querySelectorAll('.disparo-followup-clear, .disparo-followup-status').forEach(el => el.remove());
    if (c.followUpDate) {
      const btn = document.createElement('button');
      btn.className = 'disparo-followup-clear';
      btn.title = 'Remover follow-up';
      btn.innerHTML = '<i class="ph ph-x"></i>';
      btn.onclick = () => disparoClearFollowUp(id);
      row.appendChild(btn);

      const lbl = document.createElement('span');
      const st  = _getFollowUpStatus(c.followUpDate) || 'upcoming';
      lbl.className   = `disparo-followup-status disparo-followup-status--${st}`;
      lbl.textContent = _followUpLabel(c.followUpDate);
      row.appendChild(lbl);
    }
  }

  if (typeof currentUser !== 'undefined' && currentUser) {
    db.collection('users').doc(currentUser.uid).collection('disparo_contacts').doc(String(id))
      .update({ followUpDate: c.followUpDate }).catch(() => {});
  }

  disparoFilter();
  disparoShowToast(c.followUpDate ? 'Follow-up agendado!' : 'Follow-up removido.');
}

function disparoClearFollowUp(id) {
  const input = document.getElementById('disparo-followup-' + id);
  if (input) input.value = '';
  disparoSaveFollowUp(id);
}

function disparoToggleFUFilter(type) {
  _disparoFUFilter = (_disparoFUFilter === type) ? null : type;
  document.getElementById('fchip-today').classList.toggle('active',   _disparoFUFilter === 'today');
  document.getElementById('fchip-overdue').classList.toggle('active', _disparoFUFilter === 'overdue');
  disparoFilter();
}

/* ═══════════════════════════════════════════════════════════════
   IMPORTAÇÃO DE CONTATOS VIA CSV
   ═══════════════════════════════════════════════════════════════ */

let _importParsed = [];

function disparoOpenImportModal() {
  _importParsed = [];
  document.getElementById('disparo-import-ta').value       = '';
  document.getElementById('disparo-import-preview').innerHTML = '';
  document.getElementById('disparo-import-confirm-btn').hidden = true;
  document.getElementById('disparo-import-ov').classList.add('open');
}

function disparoCloseImportModal() {
  document.getElementById('disparo-import-ov').classList.remove('open');
}

function disparoCloseImportOverlay(e) {
  if (e.target.id === 'disparo-import-ov') disparoCloseImportModal();
}

function disparoParseImport() {
  const raw   = document.getElementById('disparo-import-ta').value.trim();
  const prev  = document.getElementById('disparo-import-preview');
  const btn   = document.getElementById('disparo-import-confirm-btn');
  _importParsed = [];

  if (!raw) {
    prev.innerHTML = '<p class="import-hint-error">Cole o conteúdo da planilha acima.</p>';
    btn.hidden = true;
    return;
  }

  /* Detecta separador */
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const sep   = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';

  const errors = [];

  lines.forEach((line, i) => {
    const cols    = line.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
    const [name, phone, company, segment, group] = cols;

    /* Pula linha de cabeçalho (sem dígitos no campo phone) */
    if (i === 0 && phone && !/\d/.test(phone)) return;
    if (!name && !phone) return;

    if (!name)  { errors.push(`Linha ${i + 1}: nome ausente`);     return; }
    if (!phone) { errors.push(`Linha ${i + 1}: WhatsApp ausente`); return; }

    _importParsed.push({
      name,
      phone:   phone.replace(/\D/g, ''),
      company: company || '—',
      segment: segment || '—',
      group:   group   || '—',
    });
  });

  const plan      = (typeof _userPlan !== 'undefined') ? _userPlan : 'free';
  const available = plan === 'orbit' ? Infinity : Math.max(0, DISPARO_FREE_LIMIT - disparoContacts.length);
  const toImport  = plan === 'orbit' ? _importParsed.length : Math.min(_importParsed.length, available);
  const skipped   = _importParsed.length - toImport;

  let html = '';

  if (_importParsed.length === 0) {
    html = '<p class="import-hint-error">Nenhum contato válido encontrado. Verifique o formato.</p>';
    btn.hidden = true;
  } else {
    html += `<div class="import-summary">
      <span class="import-summary-count"><i class="ph ph-check-circle"></i> ${toImport} contato${toImport !== 1 ? 's' : ''} prontos para importar</span>
      ${skipped > 0 ? `<span class="import-summary-warn"><i class="ph ph-warning"></i> ${skipped} ignorado${skipped !== 1 ? 's' : ''} (limite do plano gratuito)</span>` : ''}
    </div>
    <div class="import-preview-wrap">
      <table class="import-preview-table">
        <thead><tr><th>Nome</th><th>WhatsApp</th><th>Empresa</th><th>Grupo</th></tr></thead>
        <tbody>
          ${_importParsed.slice(0, toImport).map(c =>
            `<tr><td>${_esc(c.name)}</td><td>${_esc(c.phone)}</td><td>${_esc(c.company)}</td><td>${_esc(c.group)}</td></tr>`
          ).join('')}
        </tbody>
      </table>
    </div>`;

    btn.hidden      = false;
    btn.textContent = `Importar ${toImport} contato${toImport !== 1 ? 's' : ''}`;
  }

  if (errors.length) {
    html += `<div class="import-errors"><strong>Linhas ignoradas:</strong> ${errors.join(' · ')}</div>`;
  }

  prev.innerHTML = html;
}

function disparoConfirmImport() {
  const plan      = (typeof _userPlan !== 'undefined') ? _userPlan : 'free';
  const available = plan === 'orbit' ? Infinity : Math.max(0, DISPARO_FREE_LIMIT - disparoContacts.length);
  const toImport  = _importParsed.slice(0, plan === 'orbit' ? _importParsed.length : available);

  if (!toImport.length) return;

  const btn    = document.getElementById('disparo-import-confirm-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-circle-notch auth-spin"></i> Importando...';

  let done = 0;
  const finish = () => { done++; if (done === toImport.length) _afterImport(done); };

  toImport.forEach(contact => {
    const c = { ...contact, status: 'pending', stage: 'novo', history: [], messages: [], notes: '' };

    if (typeof currentUser !== 'undefined' && currentUser) {
      db.collection('users').doc(currentUser.uid).collection('disparo_contacts').add({
        ...c, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      }).then(ref => { c.id = ref.id; disparoContacts.push(c); finish(); })
        .catch(finish);
    } else {
      c.id = disparoNid++;
      disparoContacts.push(c);
      finish();
    }
  });
}

function _afterImport(count) {
  disparoCloseImportModal();
  disparoUpdateStats();
  disparoFilter();
  _disparoUpdateLimitBar();
  _updateTagFilterChips();
  if (typeof renderCRM === 'function') renderCRM();
  disparoShowToast(`${count} contato${count !== 1 ? 's' : ''} importado${count !== 1 ? 's' : ''}!`);
  _importParsed = [];
}

/* Inicializa ao carregar */
disparoUpdateStats();
disparoFilter();

/* ═══════════════════════════════════════════════════════════════
   TEMPLATES DE DISPARO
   ═══════════════════════════════════════════════════════════════ */

let disparoTemplates  = [];
let _tmplEditId       = null;   // null = modo novo, string = modo editar
const DISPARO_TMPL_LIMIT_FREE = 3;

/* ─── Pills de seleção de template no painel do contato ──────── */
function _renderTmplPills(contactId) {
  const pills = [{ id: '', name: 'Padrão' }, ...disparoTemplates];
  return pills.map(t =>
    `<button class="disparo-tmpl-pill" data-tmpl="${t.id}"
       onclick="disparoApplyTemplate('${t.id}','${contactId}',this)">
       ${t.name}
     </button>`
  ).join('');
}

function disparoApplyTemplate(tmplId, contactId, btn) {
  /* Marca pill ativa */
  document.querySelectorAll('.disparo-tmpl-pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const ta = document.getElementById('disparo-ta');
  if (!ta) return;

  if (!tmplId) {
    ta.value = DISPARO_TMPL;
  } else {
    const t = disparoTemplates.find(x => x.id === tmplId);
    if (t) ta.value = t.body;
  }

  if (contactId) disparoLivePreview(contactId);
}

/* ─── Badge na pill nav ──────────────────────────────────────── */
function _tmplUpdateBadge() {
  const badge = document.getElementById('disparo-tmpl-badge');
  if (!badge) return;
  if (disparoTemplates.length > 0) {
    badge.textContent = disparoTemplates.length;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

/* ─── Label de limite ────────────────────────────────────────── */
function tmplUpdateLimitLabel() {
  const el   = document.getElementById('tmpl-limit-label');
  const btn  = document.getElementById('tmpl-new-btn');
  if (!el) return;
  const plan = (typeof _userPlan !== 'undefined') ? _userPlan : 'free';

  if (plan === 'orbit') {
    el.textContent = 'Plano Orbit — templates ilimitados';
    if (btn) btn.disabled = false;
    return;
  }

  const used = disparoTemplates.length;
  el.textContent = `Plano gratuito: ${used} / ${DISPARO_TMPL_LIMIT_FREE} templates`;
  if (btn) btn.disabled = (used >= DISPARO_TMPL_LIMIT_FREE);
}

/* ─── Renderizar lista de templates ──────────────────────────── */
function renderDisparoTemplates() {
  const list = document.getElementById('tmpl-list');
  if (!list) return;
  tmplUpdateLimitLabel();

  if (disparoTemplates.length === 0) {
    list.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon"><i class="ph ph-files"></i></div>
        <h3>Nenhum template criado ainda</h3>
        <p>Clique em <strong>"Novo Template"</strong> para criar sua primeira mensagem personalizada.</p>
      </div>`;
    return;
  }

  list.innerHTML = disparoTemplates.map(t => `
    <div class="tmpl-card" id="tmpl-card-${t.id}">
      <div class="tmpl-card-header">
        <span class="tmpl-card-name"><i class="ph ph-file-text"></i> ${_esc(t.name)}</span>
        <div class="tmpl-card-actions">
          <button class="tmpl-btn-edit"  onclick="tmplStartEdit('${t.id}')" title="Editar">
            <i class="ph ph-pencil-simple"></i>
          </button>
          <button class="tmpl-btn-del"   onclick="tmplDelete('${t.id}')" title="Excluir">
            <i class="ph ph-trash"></i>
          </button>
        </div>
      </div>
      <p class="tmpl-card-preview">${_esc(t.body.slice(0, 120))}${t.body.length > 120 ? '…' : ''}</p>
    </div>`
  ).join('');
}

/* ─── Abrir formulário de novo template ──────────────────────── */
function tmplOpenNewForm() {
  const plan = (typeof _userPlan !== 'undefined') ? _userPlan : 'free';
  if (plan !== 'orbit' && disparoTemplates.length >= DISPARO_TMPL_LIMIT_FREE) {
    disparoShowToast(`Limite de ${DISPARO_TMPL_LIMIT_FREE} templates no plano gratuito.`, true);
    return;
  }
  _tmplEditId = null;
  document.getElementById('tmpl-form-title').innerHTML = '<i class="ph ph-plus"></i> Novo Template';
  document.getElementById('tmpl-save-btn').innerHTML   = '<i class="ph ph-check"></i> Salvar template';
  document.getElementById('tmpl-name').value  = '';
  document.getElementById('tmpl-body').value  = '';
  document.getElementById('tmpl-cc').textContent = '0 chars';
  document.getElementById('tmpl-form-card').hidden = false;
  document.getElementById('tmpl-name').focus();
  document.getElementById('tmpl-form-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function tmplCancelForm() {
  _tmplEditId = null;
  document.getElementById('tmpl-form-card').hidden = true;
}

/* ─── Abrir formulário de edição ─────────────────────────────── */
function tmplStartEdit(id) {
  const t = disparoTemplates.find(x => x.id === id);
  if (!t) return;
  _tmplEditId = id;
  document.getElementById('tmpl-form-title').innerHTML = '<i class="ph ph-pencil-simple"></i> Editar Template';
  document.getElementById('tmpl-save-btn').innerHTML   = '<i class="ph ph-check"></i> Atualizar template';
  document.getElementById('tmpl-name').value = t.name;
  document.getElementById('tmpl-body').value = t.body;
  tmplUpdateCounter();
  document.getElementById('tmpl-form-card').hidden = false;
  document.getElementById('tmpl-form-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ─── Salvar (novo ou edição) ─────────────────────────────────── */
function tmplSaveForm() {
  const name = document.getElementById('tmpl-name').value.trim();
  const body = document.getElementById('tmpl-body').value.trim();
  if (!name || !body) { disparoShowToast('Preencha o nome e a mensagem.', true); return; }

  const btn = document.getElementById('tmpl-save-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-circle-notch auth-spin"></i> Salvando...';

  if (_tmplEditId) {
    /* Edição */
    const idx = disparoTemplates.findIndex(x => x.id === _tmplEditId);
    if (idx !== -1) disparoTemplates[idx] = { ...disparoTemplates[idx], name, body };

    if (typeof currentUser !== 'undefined' && currentUser) {
      db.collection('users').doc(currentUser.uid).collection('disparo_templates').doc(_tmplEditId)
        .update({ name, body, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
        .then(() => _tmplAfterSave('Template atualizado!'))
        .catch(() => _tmplSaveError(btn));
    } else {
      _tmplAfterSave('Template atualizado!');
    }

  } else {
    /* Novo */
    const tmpl = { name, body };

    if (typeof currentUser !== 'undefined' && currentUser) {
      db.collection('users').doc(currentUser.uid).collection('disparo_templates').add({
        ...tmpl,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
      .then(ref => {
        tmpl.id = ref.id;
        disparoTemplates.push(tmpl);
        _tmplAfterSave('Template salvo!');
      })
      .catch(() => _tmplSaveError(btn));
    } else {
      tmpl.id = 'local_' + Date.now();
      disparoTemplates.push(tmpl);
      _tmplAfterSave('Template salvo! Faça login para manter.');
    }
  }
}

function _tmplAfterSave(msg) {
  _tmplEditId = null;
  document.getElementById('tmpl-form-card').hidden = true;
  renderDisparoTemplates();
  _tmplUpdateBadge();
  disparoShowToast(msg);
}

function _tmplSaveError(btn) {
  btn.disabled = false;
  btn.innerHTML = '<i class="ph ph-check"></i> Salvar template';
  disparoShowToast('Erro ao salvar. Tente novamente.', true);
}

/* ─── Excluir template ───────────────────────────────────────── */
function tmplDelete(id) {
  if (!confirm('Excluir este template?')) return;

  if (typeof currentUser !== 'undefined' && currentUser) {
    db.collection('users').doc(currentUser.uid).collection('disparo_templates').doc(id)
      .delete().catch(() => {});
  }

  disparoTemplates = disparoTemplates.filter(t => t.id !== id);
  if (_tmplEditId === id) {
    _tmplEditId = null;
    document.getElementById('tmpl-form-card').hidden = true;
  }
  renderDisparoTemplates();
  _tmplUpdateBadge();
  disparoShowToast('Template removido.');
}

/* ─── Contador de caracteres no form ─────────────────────────── */
function tmplUpdateCounter() {
  const ta = document.getElementById('tmpl-body');
  const cc = document.getElementById('tmpl-cc');
  if (ta && cc) cc.textContent = ta.value.length + ' chars';
}

/* ─── Inserir variável no textarea do form ───────────────────── */
function tmplInsertVar(v) {
  const ta = document.getElementById('tmpl-body'); if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  ta.value = ta.value.slice(0, s) + v + ta.value.slice(e);
  ta.selectionStart = ta.selectionEnd = s + v.length;
  ta.focus();
  tmplUpdateCounter();
}

/* ═══════════════════════════════════════════════════════════════
   UTILITÁRIOS
   ═══════════════════════════════════════════════════════════════ */

/* ─── Escape HTML (evita XSS ao injetar conteúdo do usuário) ─── */
function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─── Máscara de moeda (BRL) ─────────────────────────────────── */
const CURRENCY_FIELDS = [
  'fuel-price', 'rate-per-km',
  'clt-salario', 'clt-vr', 'clt-vt', 'clt-cesta', 'clt-bonus', 'clt-outros',
  'pj-valor', 'pj-benef',
];

function applyMask(el) {
  el.addEventListener('input', function () {
    const pos   = this.selectionStart;
    const before = this.value.length;
    const digits = this.value.replace(/\D/g, '');
    if (!digits) { this.value = ''; return; }
    const num = parseInt(digits, 10) / 100;
    this.value = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    /* mantém cursor aproximado após reformatação */
    const after = this.value.length;
    this.setSelectionRange(pos + (after - before), pos + (after - before));
  });
}

/* Converte valor mascarado ("1.500,50") de volta para número */
function parseMasked(id) {
  const raw = (document.getElementById(id).value || '')
    .replace(/\./g, '')
    .replace(',', '.');
  return parseFloat(raw) || 0;
}

CURRENCY_FIELDS.forEach(id => {
  const el = document.getElementById(id);
  if (el) applyMask(el);
});

function formatBRL(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

function formatKm(km) {
  return km.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km';
}

function shakeField(id) {
  const el = document.getElementById(id);
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'shake 0.35s ease';
  el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
}

const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    20%     { transform: translateX(-6px); }
    40%     { transform: translateX(6px); }
    60%     { transform: translateX(-4px); }
    80%     { transform: translateX(4px); }
  }
`;
document.head.appendChild(shakeStyle);

/* ═══════════════════════════════════════════════════════════════
   FIRESTORE — Carga de dados ao fazer login
   ═══════════════════════════════════════════════════════════════ */

function loadKmHistoryFromFirestore(uid) {
  db.collection('users').doc(uid).collection('km_history')
    .orderBy('savedAt', 'desc')
    .limit(100)
    .get()
    .then(snap => {
      if (snap.empty) return; // nada no Firestore → preserva histórico local da sessão

      const fsEntries = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id:          doc.id,
          firestoreId: doc.id,
          origin:      d.origin      || '',
          destination: d.destination || '',
          totalKm:     d.totalKm     || 0,
          tripLabel:   d.tripLabel   || 'ida',
          realCost:    d.realCost    || 0,
          charge:      d.charge      || 0,
          profit:      d.profit      || 0,
          ratePerKm:   d.ratePerKm   || 0,
          consumption: d.consumption || 0,
          fuelPrice:   d.fuelPrice   || 0,
          savedAt:     d.savedAt ? d.savedAt.toDate() : new Date(),
        };
      });

      /* Mantém entradas locais ainda não sincronizadas (sem firestoreId) */
      const localOnly = kmHistory.filter(e => !e.firestoreId);
      kmHistory = [...fsEntries, ...localOnly];

      updateHistoryBadge();
      renderHistory();
    })
    .catch(() => {});
}

function loadCltHistoryFromFirestore(uid) {
  db.collection('users').doc(uid).collection('clt_history')
    .orderBy('savedAt', 'desc')
    .limit(100)
    .get()
    .then(snap => {
      if (snap.empty) return; // preserva histórico local da sessão

      const fsEntries = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id:          doc.id,
          firestoreId: doc.id,
          regime:   d.regime   || 'simples',
          sal:      d.sal      || 0,
          totalCLT: d.totalCLT || 0,
          totalPJ:  d.totalPJ  || 0,
          diff:     d.diff     || 0,
          savedAt:  d.savedAt ? d.savedAt.toDate() : new Date(),
        };
      });

      const localOnly = cltHistory.filter(e => !e.firestoreId);
      cltHistory = [...fsEntries, ...localOnly];

      updateCltBadge();
      renderHistoryCLT();
    })
    .catch(() => {});
}

function loadKmSettingsFromFirestore(uid) {
  db.collection('users').doc(uid).collection('settings').doc('km').get()
    .then(snap => {
      if (!snap.exists) return;
      const d = snap.data();
      if (d.fuel         != null) document.getElementById('ki-fuel').value         = d.fuel;
      if (d.tires        != null) document.getElementById('ki-tires').value        = d.tires;
      if (d.maintenance  != null) document.getElementById('ki-maintenance').value  = d.maintenance;
      if (d.insurance    != null) document.getElementById('ki-insurance').value    = d.insurance;
      if (d.depreciation != null) document.getElementById('ki-depreciation').value = d.depreciation;
      if (d.consumption  != null) document.getElementById('consumption').value     = d.consumption;
      if (d.fuelPrice    != null) {
        document.getElementById('fuel-price').value =
          parseFloat(d.fuelPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      if (d.ratePerKm    != null) {
        document.getElementById('rate-per-km').value =
          parseFloat(d.ratePerKm).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      recalcKmTable();
    })
    .catch(() => {});
}

function loadDisparoContactsFromFirestore(uid) {
  db.collection('users').doc(uid).collection('disparo_contacts')
    .orderBy('createdAt', 'asc')
    .get()
    .then(snap => {
      disparoContacts = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id:           doc.id,
          name:         d.name         || '',
          company:      d.company      || '—',
          segment:      d.segment      || '—',
          group:        d.group        || '—',
          phone:        d.phone        || '',
          status:       d.status       || 'pending',
          stage:        d.stage        || 'novo',
          history:      d.history      || [],
          messages:     d.messages     || [],
          notes:        d.notes        || '',
          tags:         d.tags         || [],
          followUpDate: d.followUpDate || null,
        };
      });
      disparoUpdateStats();
      disparoFilter();
      _disparoUpdateLimitBar();
      _updateTagFilterChips();
    })
    .catch(() => {});
}

function saveKmSettingsToFirestore() {
  if (typeof currentUser === 'undefined' || !currentUser) return;
  db.collection('users').doc(currentUser.uid).collection('settings').doc('km').set({
    fuel:         parseFloat(document.getElementById('ki-fuel').value)         || 0,
    tires:        parseFloat(document.getElementById('ki-tires').value)        || 0,
    maintenance:  parseFloat(document.getElementById('ki-maintenance').value)  || 0,
    insurance:    parseFloat(document.getElementById('ki-insurance').value)    || 0,
    depreciation: parseFloat(document.getElementById('ki-depreciation').value) || 0,
    consumption:  parseFloat(document.getElementById('consumption').value)     || 10,
    fuelPrice:    parseMasked('fuel-price'),
    ratePerKm:    parseMasked('rate-per-km'),
    updatedAt:    firebase.firestore.FieldValue.serverTimestamp(),
  });
}

function loadDisparoTemplatesFromFirestore(uid) {
  db.collection('users').doc(uid).collection('disparo_templates')
    .orderBy('createdAt', 'asc')
    .get()
    .then(snap => {
      disparoTemplates = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id:   doc.id,
          name: d.name || '',
          body: d.body || '',
        };
      });
      _tmplUpdateBadge();
      tmplUpdateLimitLabel();
    })
    .catch(() => {});
}

/* ═══════════════════════════════════════════════════════════════
   CRM E LEADS (KANBAN INTEGRADO)
   ═══════════════════════════════════════════════════════════════ */

let crmDraggedCard = null;
let crmPendingLeadId = null;
let crmPendingStage = null;

const CRM_STAGES = ['novo', 'contato', 'orcamento', 'followup', 'fechado', 'perdido'];

function renderCRM() {
  /* Reseta os contadores e as colunas */
  CRM_STAGES.forEach(stage => {
    const col = document.getElementById(`col-${stage}`);
    const cnt = document.getElementById(`count-${stage}`);
    if (col) col.innerHTML = '';
    if (cnt) cnt.textContent = '0';
  });

  /* Mapeia os contatos de disparoContacts para as colunas */
  disparoContacts.forEach(c => {
    const stage = CRM_STAGES.includes(c.stage) ? c.stage : 'novo';
    const col = document.getElementById(`col-${stage}`);
    if (!col) return;

    /* Aumenta contador do DB */
    const cnt = document.getElementById(`count-${stage}`);
    cnt.textContent = parseInt(cnt.textContent) + 1;

    /* Extrai primeira linha da ultima nota, se houver */
    let lastNoteLine = 'Sem histórico ainda.';
    if (c.history && c.history.length > 0) {
      const last = c.history[c.history.length - 1];
      if (last.note) {
        lastNoteLine = last.note.split('\n')[0];
      } else {
        lastNoteLine = `Movido para ${last.targetStage}`;
      }
    }

    const [bg, fg] = disparoPal(c.id);

    const card = document.createElement('div');
    card.className = 'crm-card';
    card.draggable = true;
    card.dataset.id = c.id;

    /* Drag Events */
    card.addEventListener('dragstart', (e) => {
      crmDraggedCard = card;
      setTimeout(() => card.style.opacity = '0.5', 0);
    });
    card.addEventListener('dragend', () => {
      crmDraggedCard = null;
      card.style.opacity = '1';
    });

    card.innerHTML = `
      <div class="crm-card-header">
        <div>
          <div class="crm-card-name">${c.name}</div>
          <div class="crm-card-company">${c.company}</div>
        </div>
        <div class="crm-card-actions">
          <button class="crm-btn-action" onclick="crmOpenHistoryModal('${c.id}')" title="Ver Histórico">
            <i class="ph ph-clock-counter-clockwise"></i>
          </button>
        </div>
      </div>
      
      <!-- Dropdown Mobile Fallback -->
      <select class="crm-stage-select" onchange="crmHandleSelectMove('${c.id}', this.value)">
        <option value="novo" ${stage === 'novo' ? 'selected' : ''}>Novo Lead</option>
        <option value="contato" ${stage === 'contato' ? 'selected' : ''}>1º Contato</option>
        <option value="orcamento" ${stage === 'orcamento' ? 'selected' : ''}>Orçamento Enviado</option>
        <option value="followup" ${stage === 'followup' ? 'selected' : ''}>Follow Up</option>
        <option value="fechado" ${stage === 'fechado' ? 'selected' : ''}>Fechado</option>
        <option value="perdido" ${stage === 'perdido' ? 'selected' : ''}>Não Convertido</option>
      </select>

      <div class="crm-card-footer" onclick="crmOpenHistoryModal('${c.id}')" style="cursor:pointer;" title="Clique para ver o histórico completo">
        <i class="ph ph-note"></i> ${lastNoteLine}
      </div>
    `;

    col.appendChild(card);
  });
}

/* Inicializando Dropzones de Colunas */
document.addEventListener('DOMContentLoaded', () => {
  CRM_STAGES.forEach(stage => {
    const col = document.getElementById(`col-${stage}`);
    if (!col) return;
    
    col.addEventListener('dragover', e => {
      e.preventDefault();
      col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', e => {
      col.classList.remove('drag-over');
    });

    col.addEventListener('drop', e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      if (crmDraggedCard) {
        const leadId = crmDraggedCard.dataset.id;
        if (!leadId) return;
        crmOpenTransitionModal(leadId, stage);
      }
    });
  });
});

/* Modal Actions */
function crmHandleSelectMove(leadId, targetStage) {
  const c = disparoContacts.find(x => String(x.id) === String(leadId));
  if (c && c.stage === targetStage) return; /* Mesma coluna */
  crmOpenTransitionModal(leadId, targetStage);
}

const CRM_STAGE_LABELS = {
  'novo': 'Novo Lead',
  'contato': '1º Contato',
  'orcamento': 'Orçamento Enviado',
  'followup': 'Follow Up',
  'fechado': 'Negócio Fechado',
  'perdido': 'Não Convertido'
};

function crmOpenTransitionModal(leadId, targetStage) {
  const c = disparoContacts.find(x => String(x.id) === String(leadId));
  if (!c || c.stage === targetStage) return; /* Mesma coluna */

  crmPendingLeadId = leadId;
  crmPendingStage = targetStage;

  const currentLabel = CRM_STAGE_LABELS[c.stage] || 'Desconhecido';
  const targetLabel = CRM_STAGE_LABELS[targetStage] || 'Desconhecido';

  document.getElementById('crm-transition-desc').innerHTML = 
    `Movendo <strong>${c.name}</strong><br> De: <span class="badge-stage">${currentLabel}</span> → Para: <span class="badge-stage">${targetLabel}</span>`;
  
  document.getElementById('crm-transition-note').value = '';
  document.getElementById('crm-transition-modal').classList.add('open');
  document.getElementById('crm-transition-note').focus();
}

function crmCloseTransitionModal(e) {
  if (e && e.target.id !== 'crm-transition-modal') return;
  document.getElementById('crm-transition-modal').classList.remove('open');
  crmPendingLeadId = null;
  crmPendingStage = null;
  
  /* Retorna cards ao visual orginal pois o cancelamento os deixa no lugar visual onde caíram */
  renderCRM(); 
}

function crmConfirmTransition() {
  if (!crmPendingLeadId || !crmPendingStage) return;

  const c = disparoContacts.find(x => String(x.id) === String(crmPendingLeadId));
  if (!c) return;
  
  const noteText = document.getElementById('crm-transition-note').value.trim();
  const oldStage = c.stage || 'novo';
  
  c.stage = crmPendingStage;
  
  const historyEntry = {
    date: new Date().toISOString(),
    oldStage: oldStage,
    targetStage: crmPendingStage,
    note: noteText,
  };

  if (!c.history) c.history = [];
  c.history.push(historyEntry);

  /* Atualiza BD */
  if (typeof currentUser !== 'undefined' && currentUser) {
    db.collection('users').doc(currentUser.uid).collection('disparo_contacts').doc(String(c.id))
      .update({
        stage: c.stage,
        history: c.history
      }).catch(err => console.error("Erro salvando CRM", err));
  }

  document.getElementById('crm-transition-modal').classList.remove('open');
  crmPendingLeadId = null;
  crmPendingStage = null;

  renderCRM();
}

/* Mostrar Modal de Historico */
function crmOpenHistoryModal(leadId) {
  const c = disparoContacts.find(x => String(x.id) === String(leadId));
  if (!c) return;

  document.getElementById('crm-history-title').textContent = `Histórico: ${c.name}`;
  
  const list = document.getElementById('crm-history-list');
  if (!c.history || c.history.length === 0) {
    list.innerHTML = `<p style="font-size:0.8rem;color:var(--c-muted);">Ainda não há histórico de interações para este lead.</p>`;
  } else {
    /* Ordena mais recente primeiro */
    const reversed = [...c.history].reverse();
    list.innerHTML = reversed.map(h => {
      const d = new Date(h.date);
      const time = d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
      const lblTarget = CRM_STAGE_LABELS[h.targetStage] || h.targetStage;
      return `
        <div class="timeline-event">
          <div class="timeline-icon">
             <i class="ph ph-git-commit"></i>
          </div>
          <div class="timeline-content">
             <div class="timeline-meta">
               <span>Movido para <strong>${lblTarget}</strong></span>
               <span>${time}</span>
             </div>
             ${h.note ? `<div class="timeline-note">${h.note.replace(/\n/g, '<br>')}</div>` : `<div class="timeline-note" style="color:var(--c-muted);font-style:italic;">Sem anotação extra.</div>`}
          </div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('crm-history-modal').classList.add('open');
}

function crmCloseHistoryModal(e) {
  if (e && e.target.id !== 'crm-history-modal') return;
  document.getElementById('crm-history-modal').classList.remove('open');
}

/* Garante a primeira renderização do painel ao carregar se já existirem contatos */
window.addEventListener('load', () => { setTimeout(() => { renderCRM(); }, 500); });

/* ═══════════════════════════════════════════════════════════════
   AGENDAMENTOS — Module
   ═══════════════════════════════════════════════════════════════ */

/* ─── Estado ──────────────────────────────────────────────────── */
let schedConfig   = { workDays: [1,2,3,4,5], defaultTimes: ['08:00','09:00','10:00','11:00','14:00','15:00','16:00','17:00'], whatsapp: '' };
let schedServices = [];
let schedBookings = [];
let schedDays     = {};   /* { 'YYYY-MM-DD': { blocked: bool, times: [], reason: '' } } */

/* Retorna o UID correto: tenant ativo ou conta própria */
function _schedUid() {
  return (typeof activeTenantUid !== 'undefined' && activeTenantUid)
    ? activeTenantUid
    : (currentUser ? currentUser.uid : null);
}

let _schedCalYear  = new Date().getFullYear();
let _schedCalMonth = new Date().getMonth(); /* 0-indexed */
let _schedSelDate  = null; /* 'YYYY-MM-DD' */
let _schedSvcEditId = null;
let _schedBkEditId  = null;

/* ─── Helpers ─────────────────────────────────────────────────── */
function _schedDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function _schedFmt(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function _schedTodayStr() { return _schedDateStr(new Date()); }

function _schedStatusLabel(s) {
  return { pending: 'Pendente', confirmed: 'Confirmado', done: 'Concluído', cancelled: 'Cancelado' }[s] || s;
}

/* ─── Tabs ────────────────────────────────────────────────────── */
function switchSchedTab(tab, el) {
  document.querySelectorAll('#tool-sched .pill-item').forEach(p => {
    p.classList.remove('active');
    p.setAttribute('aria-selected', 'false');
  });
  if (el) { el.classList.add('active'); el.setAttribute('aria-selected', 'true'); }

  ['agenda','services','config'].forEach(t => {
    document.getElementById('sched-panel-' + t).classList.toggle('hidden', t !== tab);
  });

  const labels = { agenda: 'Agenda', services: 'Serviços', config: 'Configurações' };
  const bc = document.getElementById('sched-breadcrumb');
  if (bc) bc.textContent = labels[tab] || tab;

  if (tab === 'agenda') schedRenderCalendar();
}

/* ═══════════════════════════════════════════════════════════════
   CALENDAR RENDER
   ═══════════════════════════════════════════════════════════════ */

function schedRenderCalendar() {
  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const label = document.getElementById('sched-cal-month-label');
  if (label) label.textContent = `${monthNames[_schedCalMonth]} ${_schedCalYear}`;

  const grid = document.getElementById('sched-cal-grid');
  if (!grid) return;

  const todayStr = _schedTodayStr();
  const firstDay = new Date(_schedCalYear, _schedCalMonth, 1);
  const lastDay  = new Date(_schedCalYear, _schedCalMonth + 1, 0);

  let cells = '';

  /* Empty cells before first weekday */
  for (let i = 0; i < firstDay.getDay(); i++) {
    cells += `<div class="sched-cal-cell sched-cal-cell--offmonth"></div>`;
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dt     = new Date(_schedCalYear, _schedCalMonth, d);
    const dateStr = _schedDateStr(dt);
    const isToday = dateStr === todayStr;
    const isSel   = dateStr === _schedSelDate;
    const dayOfWeek = dt.getDay();
    const isOffDay  = !schedConfig.workDays.includes(dayOfWeek);
    const dayData   = schedDays[dateStr] || {};
    const isBlocked = dayData.blocked;

    /* Count bookings for this day */
    const dayBookings = schedBookings.filter(b => b.date === dateStr && b.status !== 'cancelled');
    let dotsHtml = '';
    if (dayBookings.length > 0) {
      const dotCount = Math.min(dayBookings.length, 3);
      dotsHtml = `<div class="sched-cal-dot-row">${'<div class="sched-cal-dot"></div>'.repeat(dotCount)}</div>`;
    }

    let cls = 'sched-cal-cell';
    if (isBlocked)       cls += ' sched-cal-cell--blocked';
    else if (isSel)      cls += ' sched-cal-cell--selected';
    else if (isToday)    cls += ' sched-cal-cell--today';
    else if (isOffDay)   cls += ' sched-cal-cell--offday';

    cells += `<div class="${cls}" onclick="schedSelectDate('${dateStr}')">${d}${dotsHtml}</div>`;
  }

  grid.innerHTML = cells;
}

function schedCalPrev() {
  _schedCalMonth--;
  if (_schedCalMonth < 0) { _schedCalMonth = 11; _schedCalYear--; }
  schedRenderCalendar();
}

function schedCalNext() {
  _schedCalMonth++;
  if (_schedCalMonth > 11) { _schedCalMonth = 0; _schedCalYear++; }
  schedRenderCalendar();
}

/* ─── Select date → render day panel ─────────────────────────── */
function schedSelectDate(dateStr) {
  _schedSelDate = dateStr;
  schedRenderCalendar();
  schedRenderDayPanel(dateStr);
}

function schedRenderDayPanel(dateStr) {
  const titleEl = document.getElementById('sched-day-title');
  const blockBtn = document.getElementById('sched-day-block-btn');
  const blockLabel = document.getElementById('sched-day-block-label');
  const container = document.getElementById('sched-day-bookings');

  if (titleEl) titleEl.textContent = `Agendamentos — ${_schedFmt(dateStr)}`;
  if (blockBtn) blockBtn.hidden = false;

  const dayData   = schedDays[dateStr] || {};
  const isBlocked = dayData.blocked;

  if (blockBtn) {
    blockBtn.classList.toggle('sched-day-block-btn--blocked', isBlocked);
  }
  if (blockLabel) blockLabel.textContent = isBlocked ? 'Desbloquear dia' : 'Bloquear dia';

  const dayBookings = schedBookings
    .filter(b => b.date === dateStr)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  if (!container) return;

  if (isBlocked) {
    container.innerHTML = `
      <div class="sched-day-empty">
        <i class="ph ph-lock-simple" style="color:var(--c-red)"></i>
        <p>Este dia está bloqueado para agendamentos.<br>${dayData.reason ? `<em>${_esc(dayData.reason)}</em>` : ''}</p>
      </div>`;
    return;
  }

  if (dayBookings.length === 0) {
    container.innerHTML = `
      <div class="sched-day-empty">
        <i class="ph ph-calendar-blank"></i>
        <p>Nenhum agendamento para este dia.</p>
        <button class="sched-btn-add-booking" style="margin-top:8px;" onclick="schedOpenBookingModal('${dateStr}')">
          <i class="ph ph-plus"></i> Novo Agendamento
        </button>
      </div>`;
    return;
  }

  container.innerHTML = dayBookings.map(b => {
    const svcChips = (b.services || []).map(s => `<span class="sched-bk-svc-chip">${_esc(s)}</span>`).join('');
    const cls = `sched-booking-card sched-booking-card--${b.status || 'pending'}`;
    const statusCls = `sched-status-badge sched-status-badge--${b.status || 'pending'}`;
    const phoneLink = b.phone ? `<a href="https://wa.me/${b.phone.replace(/\D/g,'')}" target="_blank" class="sched-bk-phone"><i class="ph ph-whatsapp-logo"></i>${_esc(b.phone)}</a>` : '';
    return `
      <div class="${cls}">
        <div class="sched-bk-card-top">
          <span class="sched-bk-time-badge"><i class="ph ph-clock"></i>${_esc(b.time || '—')}</span>
          <span class="${statusCls}">${_schedStatusLabel(b.status || 'pending')}</span>
        </div>
        <div class="sched-bk-client">${_esc(b.clientName || '—')}</div>
        ${phoneLink}
        ${svcChips ? `<div class="sched-bk-svcs">${svcChips}</div>` : ''}
        ${b.notes ? `<div style="font-size:.8rem;color:var(--c-mid);">${_esc(b.notes)}</div>` : ''}
        <div class="sched-bk-card-actions">
          <button class="sched-bk-action-btn" onclick="schedOpenBookingModal('${dateStr}', '${b.id}')"><i class="ph ph-pencil"></i> Editar</button>
          ${b.phone ? `<a href="https://wa.me/${b.phone.replace(/\D/g,'')}" target="_blank" class="sched-bk-action-btn sched-bk-action-btn--wa"><i class="ph ph-whatsapp-logo"></i> WhatsApp</a>` : ''}
          <button class="sched-bk-action-btn sched-bk-action-btn--danger" onclick="schedDeleteBooking('${b.id}')"><i class="ph ph-trash"></i> Excluir</button>
        </div>
      </div>`;
  }).join('');
}

/* ─── Toggle day block ────────────────────────────────────────── */
function schedToggleDayBlock() {
  const uid = _schedUid();
  if (!_schedSelDate || !uid) return;
  const dayData   = schedDays[_schedSelDate] || {};
  const newBlocked = !dayData.blocked;

  schedDays[_schedSelDate] = { ...dayData, blocked: newBlocked };

  const ref = db.collection('users').doc(uid)
                .collection('sched_days').doc(_schedSelDate);
  ref.set({ blocked: newBlocked, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
    .then(() => {
      schedRenderCalendar();
      schedRenderDayPanel(_schedSelDate);
    });
}

/* ═══════════════════════════════════════════════════════════════
   BOOKING MODAL
   ═══════════════════════════════════════════════════════════════ */

function schedOpenBookingModal(dateStr, bookingId) {
  _schedBkEditId = bookingId || null;

  const ov = document.getElementById('sched-booking-ov');
  const titleEl = document.getElementById('sched-booking-modal-title');
  const saveBtnEl = document.getElementById('sched-bk-save-btn');

  if (titleEl) titleEl.innerHTML = bookingId
    ? '<i class="ph ph-pencil"></i> Editar Agendamento'
    : '<i class="ph ph-calendar-plus"></i> Novo Agendamento';

  /* Populate time select */
  const timeSelect = document.getElementById('sched-bk-time');
  if (timeSelect) {
    const times = schedConfig.defaultTimes || [];
    timeSelect.innerHTML = '<option value="">Selecione...</option>' +
      times.map(t => `<option value="${t}">${t}</option>`).join('');
  }

  /* Populate services checkboxes */
  const svcList = document.getElementById('sched-bk-services-list');
  if (svcList) {
    if (schedServices.length === 0) {
      svcList.innerHTML = '<span class="sched-bk-no-svc">Nenhum serviço cadastrado.</span>';
    } else {
      svcList.innerHTML = schedServices.map(s =>
        `<label class="sched-bk-svc-check">
           <input type="checkbox" value="${_esc(s.name)}" id="sched-bk-svc-${s.id}" />
           ${_esc(s.name)}${s.price ? ` — R$ ${Number(s.price).toFixed(2)}` : ''}
         </label>`
      ).join('');
    }
  }

  /* Set date */
  const dateInput = document.getElementById('sched-bk-date');
  if (dateInput) dateInput.value = dateStr || _schedSelDate || _schedTodayStr();

  /* If editing, pre-fill */
  if (bookingId) {
    const bk = schedBookings.find(b => b.id === bookingId);
    if (bk) {
      document.getElementById('sched-bk-name').value   = bk.clientName || '';
      document.getElementById('sched-bk-phone').value  = bk.phone || '';
      if (dateInput) dateInput.value = bk.date || '';
      if (timeSelect) timeSelect.value = bk.time || '';
      document.getElementById('sched-bk-notes').value  = bk.notes || '';
      document.getElementById('sched-bk-status').value = bk.status || 'pending';
      /* Check services */
      (bk.services || []).forEach(sName => {
        const found = schedServices.find(s => s.name === sName);
        if (found) {
          const cb = document.getElementById(`sched-bk-svc-${found.id}`);
          if (cb) cb.checked = true;
        }
      });
    }
  } else {
    /* Clear fields */
    ['sched-bk-name','sched-bk-phone','sched-bk-notes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const statusSel = document.getElementById('sched-bk-status');
    if (statusSel) statusSel.value = 'pending';
  }

  const errEl = document.getElementById('sched-bk-error');
  if (errEl) { errEl.textContent = ''; errEl.hidden = true; }

  if (ov) ov.classList.add('open');
}

function schedCloseBookingModal() {
  const ov = document.getElementById('sched-booking-ov');
  if (ov) ov.classList.remove('open');
  _schedBkEditId = null;
}

function schedCloseBookingOverlay(e) {
  if (e.target.id === 'sched-booking-ov') schedCloseBookingModal();
}

function schedSaveBooking() {
  if (!currentUser) {
    const errEl = document.getElementById('sched-bk-error');
    if (errEl) { errEl.textContent = 'Você precisa estar logado para salvar.'; errEl.hidden = false; }
    return;
  }

  const clientName = document.getElementById('sched-bk-name').value.trim();
  const phone      = document.getElementById('sched-bk-phone').value.trim();
  const date       = document.getElementById('sched-bk-date').value;
  const time       = document.getElementById('sched-bk-time').value;
  const notes      = document.getElementById('sched-bk-notes').value.trim();
  const status     = document.getElementById('sched-bk-status').value;

  if (!clientName || !date || !time) {
    const errEl = document.getElementById('sched-bk-error');
    if (errEl) { errEl.textContent = 'Nome, data e horário são obrigatórios.'; errEl.hidden = false; }
    return;
  }

  /* Collect checked services */
  const services = schedServices
    .filter(s => { const cb = document.getElementById(`sched-bk-svc-${s.id}`); return cb && cb.checked; })
    .map(s => s.name);

  const payload = { clientName, phone, date, time, notes, status, services, source: 'admin', updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  const col = db.collection('users').doc(_schedUid()).collection('sched_bookings');

  const btn = document.getElementById('sched-bk-save-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ph ph-circle-notch auth-spin"></i> Salvando...'; }

  const promise = _schedBkEditId
    ? col.doc(_schedBkEditId).update(payload)
    : col.add({ ...payload, createdAt: firebase.firestore.FieldValue.serverTimestamp() });

  promise.then(docRef => {
    if (_schedBkEditId) {
      const idx = schedBookings.findIndex(b => b.id === _schedBkEditId);
      if (idx >= 0) schedBookings[idx] = { ...schedBookings[idx], ...payload };
    } else {
      schedBookings.push({ id: docRef.id, ...payload });
    }
    schedCloseBookingModal();
    schedRenderCalendar();
    if (_schedSelDate === date) schedRenderDayPanel(date);
    else schedSelectDate(date);
  }).catch(() => {
    const errEl = document.getElementById('sched-bk-error');
    if (errEl) { errEl.textContent = 'Erro ao salvar. Tente novamente.'; errEl.hidden = false; }
  }).finally(() => {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ph ph-floppy-disk"></i> Salvar'; }
  });
}

function schedDeleteBooking(id) {
  const uid = _schedUid();
  if (!uid) return;
  if (!confirm('Excluir este agendamento?')) return;
  db.collection('users').doc(uid).collection('sched_bookings').doc(id).delete()
    .then(() => {
      schedBookings = schedBookings.filter(b => b.id !== id);
      schedRenderCalendar();
      if (_schedSelDate) schedRenderDayPanel(_schedSelDate);
    });
}

/* ═══════════════════════════════════════════════════════════════
   SERVICES CRUD
   ═══════════════════════════════════════════════════════════════ */

function schedRenderServices() {
  const list = document.getElementById('sched-svc-list');
  const count = document.getElementById('sched-svc-count');
  if (count) count.textContent = schedServices.length || '';

  if (!list) return;
  if (schedServices.length === 0) {
    list.innerHTML = '<div class="sched-svc-empty">Nenhum serviço cadastrado ainda.</div>';
    return;
  }

  list.innerHTML = schedServices.map(s => {
    const meta = [s.category, s.duration ? `${s.duration} min` : ''].filter(Boolean).join(' · ');
    const imgThumb = s.imageUrl
      ? `<img src="${_esc(s.imageUrl)}" alt="${_esc(s.name)}" class="sched-svc-card-thumb" />`
      : `<div class="sched-svc-card-thumb sched-svc-card-thumb--empty"><i class="ph ph-image"></i></div>`;
    const pkgBadge = s.isPackage ? `<span class="sched-svc-pkg-tag">Pacote</span>` : '';
    const siteBadge = s.badge ? `<span class="sched-svc-highlight-tag">${_esc(s.badge)}</span>` : '';
    return `
      <div class="sched-svc-card">
        ${imgThumb}
        <div class="sched-svc-card-info">
          <div class="sched-svc-card-name">${_esc(s.name)} ${pkgBadge} ${siteBadge}</div>
          ${meta ? `<div class="sched-svc-card-meta">${_esc(meta)}</div>` : ''}
        </div>
        ${s.price ? `<div class="sched-svc-card-price">R$ ${Number(s.price).toFixed(2)}</div>` : ''}
        <div class="sched-svc-card-actions">
          <button class="sched-svc-btn" onclick="schedSvcEdit('${s.id}')"><i class="ph ph-pencil"></i></button>
          <button class="sched-svc-btn sched-svc-btn--del" onclick="schedSvcDelete('${s.id}')"><i class="ph ph-trash"></i></button>
        </div>
      </div>`;
  }).join('');
}

/* ─── Preview thumbnail ao digitar URL ───────────────────────── */
function schedSvcPreviewImg(input, previewId) {
  const el = document.getElementById(previewId);
  if (!el) return;
  const url = input.value.trim();
  if (url) {
    el.innerHTML = `<img src="${url}" alt="preview" onerror="this.parentElement.innerHTML='<i class=\\'ph ph-image-broken\\'></i>'" />`;
  } else {
    el.innerHTML = '<i class="ph ph-image"></i>';
  }
}

/* ─── Toggle pacote ───────────────────────────────────────────── */
let _schedSvcIsPackage = false;
function schedSvcTogglePackage() {
  _schedSvcIsPackage = !_schedSvcIsPackage;
  const toggle = document.getElementById('sched-svc-pkg-toggle');
  const label  = document.getElementById('sched-svc-pkg-label');
  if (toggle) toggle.setAttribute('aria-checked', String(_schedSvcIsPackage));
  if (toggle) toggle.classList.toggle('active', _schedSvcIsPackage);
  if (label)  label.textContent = _schedSvcIsPackage ? 'Pacote' : 'Serviço avulso';
}

function schedSvcSave() {
  if (!currentUser) return;
  const name     = document.getElementById('sched-svc-name').value.trim();
  const category = document.getElementById('sched-svc-category').value.trim();
  const price    = parseFloat(document.getElementById('sched-svc-price').value) || 0;
  const duration = parseInt(document.getElementById('sched-svc-duration').value) || 0;

  if (!name) return;

  const payload = { name, category, price, duration, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  const col = db.collection('users').doc(_schedUid()).collection('sched_services');

  const btn = document.getElementById('sched-svc-save-btn');
  if (btn) btn.disabled = true;

  const promise = _schedSvcEditId
    ? col.doc(_schedSvcEditId).update(payload)
    : col.add({ ...payload, createdAt: firebase.firestore.FieldValue.serverTimestamp() });

  promise.then(docRef => {
    if (_schedSvcEditId) {
      const idx = schedServices.findIndex(s => s.id === _schedSvcEditId);
      if (idx >= 0) schedServices[idx] = { ...schedServices[idx], ...payload };
    } else {
      schedServices.push({ id: docRef.id, ...payload });
    }
    schedSvcCancelEdit();
    schedRenderServices();
  }).finally(() => {
    if (btn) btn.disabled = false;
  });
}

function schedSvcEdit(id) {
  const s = schedServices.find(x => x.id === id);
  if (!s) return;
  _schedSvcEditId = id;
  document.getElementById('sched-svc-name').value     = s.name     || '';
  document.getElementById('sched-svc-category').value = s.category || '';
  document.getElementById('sched-svc-price').value    = s.price    || '';
  document.getElementById('sched-svc-duration').value = s.duration || '';
  const titleEl = document.getElementById('sched-svc-form-title');
  if (titleEl) titleEl.textContent = 'Editar Serviço';
  const cancelBtn = document.getElementById('sched-svc-cancel-btn');
  if (cancelBtn) cancelBtn.hidden = false;
  document.getElementById('sched-svc-name').scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('sched-svc-name').focus();
}

function schedSvcCancelEdit() {
  _schedSvcEditId = null;
  ['sched-svc-name','sched-svc-category','sched-svc-price','sched-svc-duration'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const titleEl = document.getElementById('sched-svc-form-title');
  if (titleEl) titleEl.textContent = 'Novo Serviço';
  const cancelBtn = document.getElementById('sched-svc-cancel-btn');
  if (cancelBtn) cancelBtn.hidden = true;
}

function schedSvcDelete(id) {
  const uid = _schedUid();
  if (!uid) return;
  if (!confirm('Excluir este serviço?')) return;
  db.collection('users').doc(uid).collection('sched_services').doc(id).delete()
    .then(() => {
      schedServices = schedServices.filter(s => s.id !== id);
      schedRenderServices();
    });
}

/* ═══════════════════════════════════════════════════════════════
   CONFIG
   ═══════════════════════════════════════════════════════════════ */

function schedToggleWorkday(day) {
  const btn = document.querySelector(`.sched-day-pill[data-day="${day}"]`);
  if (!btn) return;
  const idx = schedConfig.workDays.indexOf(day);
  if (idx >= 0) {
    schedConfig.workDays.splice(idx, 1);
    btn.classList.remove('active');
  } else {
    schedConfig.workDays.push(day);
    btn.classList.add('active');
  }
}

function schedSaveConfig() {
  if (!currentUser) return;

  const timesRaw = document.getElementById('sched-times-ta').value;
  schedConfig.defaultTimes = timesRaw.split('\n')
    .map(t => t.trim())
    .filter(t => /^\d{2}:\d{2}$/.test(t));
  schedConfig.whatsapp = document.getElementById('sched-whatsapp').value.trim();

  const statusEl = document.getElementById('sched-cfg-status');

  db.collection('users').doc(_schedUid())
    .collection('sched_config').doc('main')
    .set({ ...schedConfig, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    .then(() => {
      if (statusEl) { statusEl.textContent = 'Configurações salvas!'; setTimeout(() => { statusEl.textContent = ''; }, 2500); }
    })
    .catch(() => {
      if (statusEl) { statusEl.textContent = 'Erro ao salvar.'; statusEl.style.color = 'var(--c-red)'; }
    });
}

function _schedApplyConfigToUI() {
  /* Work days */
  document.querySelectorAll('.sched-day-pill').forEach(btn => {
    const day = parseInt(btn.dataset.day);
    btn.classList.toggle('active', schedConfig.workDays.includes(day));
  });
  /* Times */
  const ta = document.getElementById('sched-times-ta');
  if (ta) ta.value = (schedConfig.defaultTimes || []).join('\n');
  /* WhatsApp */
  const wa = document.getElementById('sched-whatsapp');
  if (wa) wa.value = schedConfig.whatsapp || '';
}

/* ═══════════════════════════════════════════════════════════════
   FIRESTORE — load / save
   ═══════════════════════════════════════════════════════════════ */

function loadSchedDataFromFirestore(uid) {
  /* Config */
  db.collection('users').doc(uid).collection('sched_config').doc('main').get()
    .then(snap => {
      if (snap.exists) {
        const d = snap.data();
        schedConfig.workDays    = d.workDays    || [1,2,3,4,5];
        schedConfig.defaultTimes = d.defaultTimes || ['08:00','09:00','10:00','11:00','14:00','15:00','16:00','17:00'];
        schedConfig.whatsapp    = d.whatsapp    || '';
        _schedApplyConfigToUI();
      }
    });

  /* Services */
  db.collection('users').doc(uid).collection('sched_services').get()
    .then(snap => {
      schedServices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      schedRenderServices();
    })
    .catch(err => console.error('[Orbit] sched_services load falhou:', err));

  /* Bookings — last 90 days + future */
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const sinceStr = _schedDateStr(since);
  db.collection('users').doc(uid).collection('sched_bookings')
    .where('date', '>=', sinceStr)
    .orderBy('date')
    .get()
    .then(snap => {
      schedBookings = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
      schedRenderCalendar();
    })
    .catch(err => console.error('[Orbit] sched_bookings load falhou:', err));

  /* Day overrides — current and future month */
  const thisMonth = `${_schedCalYear}-${String(_schedCalMonth + 1).padStart(2,'0')}`;
  db.collection('users').doc(uid).collection('sched_days')
    .where(firebase.firestore.FieldPath.documentId(), '>=', thisMonth)
    .get()
    .then(snap => {
      snap.docs.forEach(d => { schedDays[d.id] = d.data(); });
      schedRenderCalendar();
    });
}

/* Initialize calendar on page load if module is active */
window.addEventListener('load', () => {
  setTimeout(() => {
    if (!document.getElementById('tool-sched').classList.contains('hidden')) {
      schedRenderCalendar();
    }
  }, 200);
});

/* ═══════════════════════════════════════════════════════════════
   TENANT SWITCHER
   ═══════════════════════════════════════════════════════════════ */

/* ─── Estado ──────────────────────────────────────────────────── */
let managedTenants   = [];   /* [{ uid, name, avatar? }] */
let activeTenantUid  = null; /* null = conta própria */
let activeTenantName = null;

/* ─── Abrir / fechar dropdown ─────────────────────────────────── */
function toggleTenantDropdown() {
  const dd  = document.getElementById('tenant-dropdown');
  const btn = document.getElementById('tenant-switcher-btn');
  const isOpen = dd.classList.toggle('open');
  btn.setAttribute('aria-expanded', String(isOpen));
}

document.addEventListener('click', function (e) {
  const sw = document.getElementById('tenant-switcher');
  const dd = document.getElementById('tenant-dropdown');
  if (sw && dd && !sw.contains(e.target)) {
    dd.classList.remove('open');
    const btn = document.getElementById('tenant-switcher-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
});

/* ─── Renderizar lista do dropdown ────────────────────────────── */
function renderTenantDropdown() {
  const list = document.getElementById('tenant-list');
  if (!list) return;

  /* Primeiro item: conta própria */
  const ownActive = activeTenantUid === null;
  const userName  = document.getElementById('auth-user-name')?.textContent || 'Minha conta';

  let html = `
    <button class="tenant-item ${ownActive ? 'tenant-item--active' : ''}" onclick="switchTenant(null, null)">
      <div class="tenant-item-icon"><i class="ph ph-user-circle"></i></div>
      <div class="tenant-item-info">
        <div class="tenant-item-name">${_esc(userName)}</div>
        <div class="tenant-item-sub">Conta própria</div>
      </div>
      ${ownActive ? '<i class="ph ph-check tenant-item-check"></i>' : ''}
    </button>`;

  managedTenants.forEach(t => {
    const isActive = activeTenantUid === t.uid;
    const initials = t.name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
    html += `
      <button class="tenant-item ${isActive ? 'tenant-item--active' : ''}" onclick="switchTenant('${_esc(t.uid)}', '${_esc(t.name)}')">
        <div class="tenant-item-icon">${t.avatar ? `<img src="${_esc(t.avatar)}" alt="${_esc(t.name)}" />` : `<span style="font-size:.7rem;font-weight:700;">${initials}</span>`}</div>
        <div class="tenant-item-info">
          <div class="tenant-item-name">${_esc(t.name)}</div>
          <div class="tenant-item-sub">Cliente</div>
        </div>
        ${isActive ? '<i class="ph ph-check tenant-item-check"></i>' : ''}
      </button>`;
  });

  list.innerHTML = html;
}

/* ─── Trocar tenant ───────────────────────────────────────────── */
function switchTenant(uid, name) {
  activeTenantUid  = uid;
  activeTenantName = name;

  /* Atualiza botão */
  const nameEl  = document.getElementById('tenant-switcher-name');
  const iconEl  = document.getElementById('tenant-switcher-icon');
  const ownName = document.getElementById('auth-user-name')?.textContent || 'Minha conta';

  if (uid) {
    if (nameEl) nameEl.textContent = name;
    if (iconEl) {
      const t = managedTenants.find(x => x.uid === uid);
      const initials = name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
      iconEl.innerHTML = t?.avatar
        ? `<img src="${_esc(t.avatar)}" alt="${_esc(name)}" />`
        : `<span style="font-size:.65rem;font-weight:700;">${initials}</span>`;
    }
  } else {
    if (nameEl) nameEl.textContent = ownName;
    if (iconEl) iconEl.innerHTML = '<i class="ph ph-user-circle"></i>';
  }

  /* Fecha dropdown */
  const dd  = document.getElementById('tenant-dropdown');
  const btn = document.getElementById('tenant-switcher-btn');
  if (dd)  dd.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');

  /* Recarrega dados para o tenant selecionado */
  const targetUid = uid || (currentUser ? currentUser.uid : null);
  if (!targetUid) return;

  /* Reset e recarga do módulo de Agendamentos */
  schedBookings = []; schedServices = []; schedDays = {};
  schedRenderCalendar();
  schedRenderServices();
  loadSchedDataFromFirestore(targetUid);

  renderTenantDropdown();
}

/* ─── Carregar tenants do Firestore ───────────────────────────── */
function loadManagedTenants(uid) {
  db.collection('users').doc(uid).get()
    .then(snap => {
      const data = snap.exists ? snap.data() : {};
      managedTenants = data.managedTenants || [];

      const switcher = document.getElementById('tenant-switcher');
      if (switcher) switcher.hidden = false;

      /* Atualiza nome próprio no botão */
      const nameEl = document.getElementById('tenant-switcher-name');
      if (nameEl && !activeTenantUid) {
        nameEl.textContent = document.getElementById('auth-user-name')?.textContent || 'Minha conta';
      }

      renderTenantDropdown();
    });
}

/* ─── Modal de gerenciar tenants ──────────────────────────────── */
function openTenantModal() {
  /* Fecha dropdown antes */
  document.getElementById('tenant-dropdown')?.classList.remove('open');
  document.getElementById('tenant-switcher-btn')?.setAttribute('aria-expanded', 'false');

  renderTenantManagedList();
  document.getElementById('tenant-modal-ov').classList.add('open');
}

function closeTenantModal() {
  document.getElementById('tenant-modal-ov').classList.remove('open');
}

function closeTenantModalOverlay(e) {
  if (e.target.id === 'tenant-modal-ov') closeTenantModal();
}

function renderTenantManagedList() {
  const list = document.getElementById('tenant-managed-list');
  if (!list) return;
  if (managedTenants.length === 0) {
    list.innerHTML = '<p style="font-size:.84rem;color:var(--c-mid);">Nenhum cliente adicionado ainda.</p>';
    return;
  }
  list.innerHTML = managedTenants.map((t, i) => `
    <div class="tenant-managed-item">
      <div style="flex:1;min-width:0;">
        <div class="tenant-managed-item-name">${_esc(t.name)}</div>
        <div class="tenant-managed-item-uid">${_esc(t.uid)}</div>
      </div>
      <button class="tenant-managed-item-del" onclick="tenantRemove(${i})" title="Remover">
        <i class="ph ph-trash"></i>
      </button>
    </div>`).join('');
}

function tenantAddNew() {
  const nameEl  = document.getElementById('tenant-input-name');
  const uidEl   = document.getElementById('tenant-input-uid');
  const errEl   = document.getElementById('tenant-form-error');
  const name    = nameEl.value.trim();
  const uid     = uidEl.value.trim();

  if (!name || !uid) {
    errEl.textContent = 'Preencha nome e UID.';
    errEl.hidden = false;
    return;
  }
  if (managedTenants.some(t => t.uid === uid)) {
    errEl.textContent = 'Este UID já está na lista.';
    errEl.hidden = false;
    return;
  }
  errEl.hidden = true;

  managedTenants.push({ uid, name });
  _saveManagedTenants(() => {
    nameEl.value = '';
    uidEl.value  = '';
    renderTenantManagedList();
    renderTenantDropdown();
  });
}

function tenantRemove(idx) {
  managedTenants.splice(idx, 1);
  /* Se o tenant removido era o ativo, volta para conta própria */
  if (activeTenantUid && !managedTenants.some(t => t.uid === activeTenantUid)) {
    switchTenant(null, null);
  }
  _saveManagedTenants(() => {
    renderTenantManagedList();
    renderTenantDropdown();
  });
}

function _saveManagedTenants(cb) {
  if (!currentUser) return;
  /* managedTenantUids é um array simples de strings — usado nas Firestore Rules */
  const managedTenantUids = managedTenants.map(t => t.uid);
  db.collection('users').doc(currentUser.uid)
    .update({ managedTenants, managedTenantUids })
    .then(() => { if (cb) cb(); })
    .catch(() => { if (cb) cb(); });
}
