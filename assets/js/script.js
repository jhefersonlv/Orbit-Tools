/* ═══════════════════════════════════════════════════════════════
   Orbit Tools — Script
   WordVirtua · 2026
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─── FIREBASE (estrutura inicial) ───────────────────────────── */
/*
const FIREBASE_CONFIG = {
  apiKey:            "...",
  authDomain:        "....firebaseapp.com",
  projectId:         "...",
  storageBucket:     "....appspot.com",
  messagingSenderId: "...",
  appId:             "..."
};
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();
*/

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

/* ═══════════════════════════════════════════════════════════════
   HISTÓRICO
   ═══════════════════════════════════════════════════════════════ */

let kmHistory = [];   // array de cálculos salvos na sessão

function saveToHistory() {
  if (!_lastCalc) return;

  const entry = { ..._lastCalc, id: Date.now(), savedAt: new Date() };
  kmHistory.unshift(entry);   // mais recente primeiro
  _lastCalc = null;

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
  if (!confirm('Limpar todo o histórico desta sessão?')) return;
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

    const time = entry.savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
  kmHistory = kmHistory.filter(e => e.id !== id);
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
  cltHistory.unshift({ ..._lastCltCalc, id: Date.now(), savedAt: new Date() });
  _lastCltCalc = null;
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
  if (!confirm('Limpar todo o histórico desta sessão?')) return;
  cltHistory = [];
  updateCltBadge();
  renderHistoryCLT();
}

/* ─── Deletar entrada ────────────────────────────────────────── */
function deleteHistoryCLT(id) {
  cltHistory = cltHistory.filter(e => e.id !== id);
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
    const time        = entry.savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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

let disparoContacts = [
  { id:1, name:'Ricardo Mendes',  company:'Mendes Reformas', segment:'Construção',  group:'IBBC',    phone:'5511991234567', status:'pending' },
  { id:2, name:'Ana Paula Costa', company:'Costa Limpeza',   segment:'Facilities',  group:'Evolua+', phone:'5511992345678', status:'pending' },
  { id:3, name:'Carlos Eduardo',  company:'CE Serviços',     segment:'Manutenção',  group:'IBBC',    phone:'5511993456789', status:'pending' },
];
let disparoSel = null;
let disparoNid  = 4;

const disparoInitials = n => n.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
const disparoPal      = id => DISPARO_PAL[id % DISPARO_PAL.length];

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
    el.innerHTML = '<div class="disparo-clist-empty">Nenhum resultado</div>';
    return;
  }
  el.innerHTML = list.map(c => {
    const [bg, fg] = disparoPal(c.id);
    return `<div class="disparo-ci${c.id === disparoSel ? ' active' : ''}${c.status === 'sent' ? ' faded' : ''}" onclick="disparoSelectContact(${c.id})">
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
  disparoSel = id;
  const c = disparoContacts.find(x => x.id === id);
  if (!c) return;
  disparoFilter();
  const [bg, fg] = disparoPal(c.id);
  const s = disparoContacts.filter(x => x.status === 'sent').length;
  const t = disparoContacts.length;
  const pct = t ? Math.round(s / t * 100) : 0;
  const statusBadge = c.status === 'sent'
    ? '<span class="disparo-badge disparo-badge--sent">Enviado</span>'
    : '<span class="disparo-badge disparo-badge--pending">Pendente</span>';

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
        <div class="disparo-sec-lbl">Template da mensagem</div>
        <div class="disparo-tbox">
          <textarea class="disparo-ta" id="disparo-ta" oninput="disparoLivePreview(${id})">${DISPARO_TMPL}</textarea>
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
        <button class="disparo-btn-whatsapp" onclick="disparoOpenWhatsApp(${id})">
          <i class="ph ph-whatsapp-logo"></i> Abrir no WhatsApp
        </button>
        ${c.status !== 'sent'
          ? `<button class="disparo-btn-success" onclick="disparoMarkSent(${id})"><i class="ph ph-check"></i> Marcar enviado</button>`
          : `<button class="disparo-btn-ghost" onclick="disparoMarkPending(${id})"><i class="ph ph-arrow-counter-clockwise"></i> Desmarcar</button>`}
        <button class="disparo-btn-danger" onclick="disparoRemoveContact(${id})"><i class="ph ph-trash"></i> Remover</button>
      </div>
    </div>`;
}

function disparoLivePreview(id) {
  const c = disparoContacts.find(x => x.id === id); if (!c) return;
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
  const c = disparoContacts.find(x => x.id === id); if (!c) return;
  const url = 'https://api.whatsapp.com/send?phone=' + c.phone.replace(/\D/g,'') + '&text=' + encodeURIComponent(disparoBuildMsg(c));
  window.open(url, '_blank');
  disparoMarkSent(id);
  disparoShowToast('WhatsApp aberto! Só apertar Enviar.');
}

function disparoMarkSent(id) {
  const c = disparoContacts.find(x => x.id === id);
  if (c) c.status = 'sent';
  disparoUpdateStats(); disparoSelectContact(id); disparoFilter();
}

function disparoMarkPending(id) {
  const c = disparoContacts.find(x => x.id === id);
  if (c) c.status = 'pending';
  disparoUpdateStats(); disparoSelectContact(id); disparoFilter();
}

function disparoRemoveContact(id) {
  disparoContacts = disparoContacts.filter(c => c.id !== id);
  disparoSel = null;
  document.getElementById('disparo-main').innerHTML = `
    <div class="disparo-empty">
      <div class="disparo-empty-icon"><i class="ph ph-chat-circle-dots"></i></div>
      <div class="disparo-empty-t">Nenhum contato selecionado</div>
      <div class="disparo-empty-s">Selecione um contato para personalizar e disparar a mensagem pelo WhatsApp</div>
    </div>`;
  disparoUpdateStats(); disparoFilter();
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
  disparoContacts.push({
    id: disparoNid++, name,
    company:  document.getElementById('d-fc').value.trim()   || '—',
    segment:  document.getElementById('d-fseg').value.trim() || '—',
    group:    document.getElementById('d-fg').value.trim()   || '—',
    phone, status: 'pending',
  });
  disparoCloseModal(); disparoUpdateStats(); disparoFilter();
  disparoShowToast('Contato adicionado!');
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
