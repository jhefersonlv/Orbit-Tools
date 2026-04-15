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

let disparoContacts = [];   // sem contatos de exemplo
let disparoSel      = null;
let disparoNid      = 1;    // fallback para usuários não logados

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
    const [bg, fg] = disparoPal(c.id);
    const isActive = String(c.id) === String(disparoSel);
    return `<div class="disparo-ci${isActive ? ' active' : ''}${c.status === 'sent' ? ' faded' : ''}" onclick="disparoSelectContact('${c.id}')">
      <div class="disparo-av" style="background:${bg};color:${fg};">${disparoInitials(c.name)}</div>
      <div class="disparo-ci-info">
        <div class="disparo-ci-name">${c.name}</div>
        <div class="disparo-ci-sub">${c.company} · ${c.group}</div>
      </div>
      <div class="disparo-dot${c.status === 'sent' ? ' disparo-dot--sent' : ' disparo-dot--pending'}"></div>
    </div>`;
  }).join('');
}

function disparoFilter() {
  const q = (document.getElementById('disparo-si').value || '').toLowerCase();
  disparoRenderList(disparoContacts.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.company.toLowerCase().includes(q) ||
    c.group.toLowerCase().includes(q)
  ));
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

  const sid = String(id);   // ID seguro para uso em template literals

  document.getElementById('disparo-main').innerHTML = `
    <div class="disparo-mheader">
      <div class="disparo-mtitle">${c.name} ${statusBadge}</div>
      <div class="disparo-msub">${c.company} · ${c.segment} · ${c.group} · +${c.phone}</div>
    </div>
    <div class="disparo-mbody">
      <div class="card disparo-hero-row">
        <div class="disparo-av disparo-av--lg" style="background:${bg};color:${fg};">${disparoInitials(c.name)}</div>
        <div>
          <div class="disparo-hero-name">${c.name}</div>
          <div class="disparo-hero-chips">
            <span class="disparo-chip">🏢 ${c.company}</span>
            <span class="disparo-chip">🔧 ${c.segment}</span>
            <span class="disparo-chip">👥 ${c.group}</span>
            <span class="disparo-chip">📱 +${c.phone}</span>
          </div>
        </div>
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

function disparoOpenWhatsApp(id) {
  const c = disparoContacts.find(x => String(x.id) === String(id)); if (!c) return;
  const url = 'https://api.whatsapp.com/send?phone=' + c.phone.replace(/\D/g,'') + '&text=' + encodeURIComponent(disparoBuildMsg(c));
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

function disparoOpenModal() {
  document.getElementById('disparo-ov').classList.add('open');
}

function disparoCloseModal() {
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
    status: 'pending',
    stage: 'novo',
    history: []
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
          id:      doc.id,
          name:    d.name    || '',
          company: d.company || '—',
          segment: d.segment || '—',
          group:   d.group   || '—',
          phone:   d.phone   || '',
          status:  d.status  || 'pending',
          stage:   d.stage   || 'novo',
          history: d.history || [],
        };
      });
      disparoUpdateStats();
      disparoFilter();
      _disparoUpdateLimitBar();
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
