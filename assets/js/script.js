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
  const fuelPrice   = parseFloat(document.getElementById('fuel-price').value)  || 5.80;
  const ratePerKm   = parseFloat(document.getElementById('rate-per-km').value) || 2.10;
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
  document.getElementById('fuel-price').value  = '5.80';
  document.getElementById('rate-per-km').value = '2.10';
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
  document.getElementById('rate-per-km').value = _kmTotal.toFixed(2);

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
   UTILITÁRIOS
   ═══════════════════════════════════════════════════════════════ */

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
