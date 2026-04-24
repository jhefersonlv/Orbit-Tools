/* ═══════════════════════════════════════════════════════════════
   Orbit Tools — Gerador de Sites
   WordVirtua · 2026
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ═══ DEFAULTS POR TEMPLATE ══════════════════════════════════════ */

const GEN_DEFAULTS = {
  barber: {
    heroHeading:    'A Barbearia que Respeita seu Tempo',
    heroSubheading: 'Cada corte é uma obra de arte. Técnica, cuidado e estilo em cada visita.',
    aboutTitle:     'Nossa História',
    aboutText:      'Fundada com a missão de elevar a experiência masculina, nossa barbearia combina técnicas tradicionais com as tendências mais modernas. Cada detalhe é pensado para que você saia se sentindo o melhor de si.',
    stats: [
      { value: '3+',  label: 'Anos de Experiência' },
      { value: '500+', label: 'Clientes Satisfeitos' },
      { value: '5★',  label: 'Avaliação no Google' },
    ],
    testimonials: [
      { name: 'Carlos Silva',   text: 'Melhor barbearia da cidade! Atendimento impecável e resultado perfeito.',    stars: 5 },
      { name: 'Marcos Souza',   text: 'Profissionais incríveis, sempre saio satisfeito. Recomendo demais!',         stars: 5 },
      { name: 'Pedro Almeida',  text: 'Ambiente incrível e serviço de qualidade premium. Vale cada centavo.',       stars: 5 },
    ],
    colors: {
      primary:      '#C9A84C',
      primaryLight: '#e0c06a',
      primaryDark:  '#9a7930',
      accent:       '#3D4430',
      accentDark:   '#1A222E',
      bg:           '#0A0B0D',
      surface:      '#121417',
      textMain:     '#F5F7F9',
      textMuted:    '#8E9196',
    },
    colorLabels: {
      primary:      'Cor Principal (Dourado)',
      primaryLight: 'Cor Principal Clara',
      primaryDark:  'Cor Principal Escura',
      accent:       'Cor de Destaque (Verde)',
      accentDark:   'Destaque Escuro / Azul',
      bg:           'Fundo do Site',
      surface:      'Fundo dos Cards',
      textMain:     'Texto Principal',
      textMuted:    'Texto Secundário',
    },
    presets: [
      { name: 'Dourado Clássico', colors: { primary: '#C9A84C', primaryLight: '#e0c06a', primaryDark: '#9a7930', accent: '#3D4430', accentDark: '#1A222E', bg: '#0A0B0D', surface: '#121417', textMain: '#F5F7F9', textMuted: '#8E9196' } },
      { name: 'Prata Moderno',    colors: { primary: '#A0A8B8', primaryLight: '#c8cfd9', primaryDark: '#6b7280', accent: '#2d3748', accentDark: '#1a202c', bg: '#0D0D0F', surface: '#171921', textMain: '#F0F2F5', textMuted: '#8A8F9A' } },
      { name: 'Vinho Refinado',   colors: { primary: '#9B4F63', primaryLight: '#bf7a8e', primaryDark: '#6b2e3f', accent: '#2d1a22', accentDark: '#1a0d14', bg: '#0D0508', surface: '#150A0E', textMain: '#F5EEF1', textMuted: '#947585' } },
      { name: 'Azul Naval',       colors: { primary: '#4A7FB5', primaryLight: '#7aaad9', primaryDark: '#2d5a8a', accent: '#1a2a3e', accentDark: '#0d1a2e', bg: '#080C12', surface: '#101520', textMain: '#EEF2F7', textMuted: '#7A90A8' } },
    ],
  },
  kamilly: {
    heroHeading:    'Arte nas suas Mãos',
    heroSubheading: 'Nail art profissional com amor e dedicação em cada detalhe. Venha se sentir especial.',
    aboutTitle:     'Sobre Mim',
    aboutText:      'Apaixonada por nail art desde sempre, meu trabalho é transformar suas unhas em verdadeiras obras de arte. Cada cliente recebe atenção personalizada para um resultado único e deslumbrante.',
    stats: [
      { value: '3+',  label: 'Anos de Experiência' },
      { value: '300+', label: 'Clientes Atendidas' },
      { value: '5★',  label: 'Avaliação no Google' },
    ],
    testimonials: [
      { name: 'Ana Paula',    text: 'Trabalho maravilhoso! Minhas unhas nunca ficaram tão bonitas. Super recomendo!', stars: 5 },
      { name: 'Julia Matos',  text: 'Super caprichosa e atenciosa. O resultado superou todas as expectativas!',       stars: 5 },
      { name: 'Maria Clara',  text: 'Resultados incríveis, sempre supera minhas expectativas. Amei demais!',          stars: 5 },
    ],
    colors: {
      primary:      '#D79EA1',
      primaryLight: '#F5DADA',
      primaryDark:  '#C47C80',
      accent:       '#9E5558',
      accentDark:   '#2C1F20',
      bg:           '#FFFFFF',
      surface:      '#FDF6F6',
      textMain:     '#2C1F20',
      textMuted:    '#7A5A5C',
    },
    colorLabels: {
      primary:      'Cor Principal (Rosa)',
      primaryLight: 'Cor Principal Clara',
      primaryDark:  'Cor Principal Escura',
      accent:       'Cor de Destaque',
      accentDark:   'Texto Escuro / Fundo',
      bg:           'Fundo do Site',
      surface:      'Fundo dos Cards',
      textMain:     'Texto Principal',
      textMuted:    'Texto Secundário',
    },
    presets: [
      { name: 'Rosa Clássico',   colors: { primary: '#D79EA1', primaryLight: '#F5DADA', primaryDark: '#C47C80', accent: '#9E5558', accentDark: '#2C1F20', bg: '#FFFFFF', surface: '#FDF6F6', textMain: '#2C1F20', textMuted: '#7A5A5C' } },
      { name: 'Lilás Delicado',  colors: { primary: '#B8A0C8', primaryLight: '#E5D8F0', primaryDark: '#8A6BAA', accent: '#6B4E7A', accentDark: '#2A1A32', bg: '#FDFAFF', surface: '#F5EFFA', textMain: '#2A1A32', textMuted: '#7A5A8A' } },
      { name: 'Nude Elegante',   colors: { primary: '#C4A882', primaryLight: '#E8D8C0', primaryDark: '#9A7A55', accent: '#7A5A38', accentDark: '#2C1F10', bg: '#FDFAF5', surface: '#F5F0E8', textMain: '#2C1F10', textMuted: '#7A6A55' } },
      { name: 'Coral Vibrante',  colors: { primary: '#E88080', primaryLight: '#FFCECE', primaryDark: '#C85A5A', accent: '#A83A3A', accentDark: '#2C0D0D', bg: '#FFFFFF', surface: '#FFF5F5', textMain: '#2C0D0D', textMuted: '#8A5A5A' } },
    ],
  },
};

/* ═══ STATE ══════════════════════════════════════════════════════ */

let genCurrentStep = 1;
let genData = genEmptyData();

function genEmptyData() {
  return {
    template:       null,
    name:           '',
    tagline:        '',
    phone:          '',
    whatsapp:       '',
    instagram:      '',
    address:        '',
    mapsUrl:        '',
    colors:         {},
    heroHeading:    '',
    heroSubheading: '',
    aboutTitle:     '',
    aboutText:      '',
    stats:          [],
    testimonials:   [],
    apiUrl:         '',
    apiKey:         '',
    apiSecret:      '',
  };
}

/* ═══ INIT ═══════════════════════════════════════════════════════ */

function genInit() {
  genCurrentStep = 1;
  genData = genEmptyData();
  _genShowStep(1);
  _genUpdateStepIndicators(1);
}

/* ═══ TEMPLATE SELECTION ═════════════════════════════════════════ */

function genSelectTemplate(tpl) {
  genData.template = tpl;
  const defaults = GEN_DEFAULTS[tpl];

  // Pre-fill content with defaults only if blank
  if (!genData.heroHeading)    genData.heroHeading    = defaults.heroHeading;
  if (!genData.heroSubheading) genData.heroSubheading = defaults.heroSubheading;
  if (!genData.aboutTitle)     genData.aboutTitle     = defaults.aboutTitle;
  if (!genData.aboutText)      genData.aboutText      = defaults.aboutText;
  if (!genData.stats.length)   genData.stats          = defaults.stats.map(s => ({ ...s }));
  if (!genData.testimonials.length) genData.testimonials = defaults.testimonials.map(t => ({ ...t }));
  if (!Object.keys(genData.colors).length) genData.colors = { ...defaults.colors };

  document.querySelectorAll('.gen-tpl-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.tpl === tpl);
  });

  const nextBtn = document.getElementById('gen-next-1');
  if (nextBtn) nextBtn.disabled = false;
}

/* ═══ STEP NAVIGATION ════════════════════════════════════════════ */

function genGoToStep(n) {
  if (n < 1 || n > 5) return;
  if (n > genCurrentStep) {
    if (!_genValidateStep(genCurrentStep)) return;
    _genSaveStep(genCurrentStep);
  } else {
    _genSaveStep(genCurrentStep);
  }
  genCurrentStep = n;
  _genShowStep(n);
  _genUpdateStepIndicators(n);
  _genPopulateStep(n);

  // Scroll to top of tool view
  const toolEl = document.getElementById('tool-generator');
  if (toolEl) toolEl.scrollTop = 0;
  const contentArea = document.getElementById('content-area');
  if (contentArea) contentArea.scrollTop = 0;
}

function _genShowStep(n) {
  for (let i = 1; i <= 5; i++) {
    const panel = document.getElementById(`gen-panel-${i}`);
    if (panel) panel.hidden = (i !== n);
  }
}

function _genUpdateStepIndicators(active) {
  document.querySelectorAll('.gen-step-indicator').forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.toggle('active', s === active);
    el.classList.toggle('done',   s < active);
    el.classList.toggle('todo',   s > active);
  });
  const breadcrumbs = ['', 'Modelo', 'Identidade', 'Aparência', 'Conteúdo', 'Gerar'];
  const bc = document.getElementById('gen-breadcrumb');
  if (bc) bc.textContent = breadcrumbs[active] || '';
}

function _genValidateStep(step) {
  if (step === 1 && !genData.template) {
    orbitAlert('Selecione um modelo para continuar.', 'Atenção');
    return false;
  }
  if (step === 2) {
    const name = document.getElementById('gen-name')?.value?.trim();
    if (!name) {
      orbitAlert('Informe o nome do seu negócio para continuar.', 'Atenção');
      return false;
    }
  }
  return true;
}

function _genSaveStep(step) {
  switch (step) {
    case 2: _genSaveIdentity(); break;
    case 3: _genSaveColors();   break;
    case 4: _genSaveContent();  break;
    case 5: _genSaveApi();      break;
  }
}

function _genPopulateStep(step) {
  switch (step) {
    case 2: _genPopulateIdentity(); break;
    case 3: _genPopulateColors();   break;
    case 4: _genPopulateContent();  break;
    case 5: _genPopulateApi(); _genRenderSummary(); break;
  }
}

/* ═══ STEP 2: IDENTIDADE ══════════════════════════════════════════ */

function _genPopulateIdentity() {
  _genSetVal('gen-name',      genData.name);
  _genSetVal('gen-tagline',   genData.tagline);
  _genSetVal('gen-phone',     genData.phone);
  _genSetVal('gen-whatsapp',  genData.whatsapp);
  _genSetVal('gen-instagram', genData.instagram);
  _genSetVal('gen-address',   genData.address);
  _genSetVal('gen-maps',      genData.mapsUrl);
}

function _genSaveIdentity() {
  genData.name      = _genGetVal('gen-name');
  genData.tagline   = _genGetVal('gen-tagline');
  genData.phone     = _genGetVal('gen-phone');
  genData.whatsapp  = _genGetVal('gen-whatsapp');
  genData.instagram = _genGetVal('gen-instagram');
  genData.address   = _genGetVal('gen-address');
  genData.mapsUrl   = _genGetVal('gen-maps');
}

/* ═══ STEP 3: APARÊNCIA ══════════════════════════════════════════ */

function _genPopulateColors() {
  const tpl     = genData.template || 'barber';
  const defaults = GEN_DEFAULTS[tpl];
  const colors   = Object.keys(genData.colors).length ? genData.colors : defaults.colors;
  const labels   = defaults.colorLabels;

  // Build color pickers
  const list = document.getElementById('gen-color-list');
  if (!list) return;
  list.innerHTML = '';
  Object.entries(colors).forEach(([key, value]) => {
    const row = document.createElement('div');
    row.className = 'gen-color-row';
    row.innerHTML = `
      <label class="gen-color-label" for="gen-color-${key}">${labels[key] || key}</label>
      <div class="gen-color-input-wrap">
        <input type="color" id="gen-color-${key}" value="${value}"
               oninput="genOnColorChange('${key}', this.value)" />
        <input type="text" class="gen-color-hex" id="gen-color-hex-${key}"
               value="${value}" placeholder="#000000"
               oninput="genOnColorHexChange('${key}', this.value)"
               maxlength="7" />
        <span class="gen-color-swatch" id="gen-color-swatch-${key}" style="background:${value}"></span>
      </div>
    `;
    list.appendChild(row);
  });

  // Build presets
  const presetsEl = document.getElementById('gen-presets-btns');
  if (presetsEl) {
    presetsEl.innerHTML = '';
    defaults.presets.forEach(preset => {
      const btn = document.createElement('button');
      btn.className = 'gen-preset-btn';
      btn.textContent = preset.name;
      btn.onclick = () => genApplyPreset(preset.colors);
      presetsEl.appendChild(btn);
    });
  }

  genData.colors = { ...colors };
  _genUpdateColorPreview();
}

function _genSaveColors() {
  const tpl = genData.template || 'barber';
  const keys = Object.keys(GEN_DEFAULTS[tpl].colors);
  genData.colors = {};
  keys.forEach(key => {
    const input = document.getElementById(`gen-color-${key}`);
    if (input) genData.colors[key] = input.value;
  });
}

function genOnColorChange(key, value) {
  if (!genData.colors) genData.colors = {};
  genData.colors[key] = value;
  const hex = document.getElementById(`gen-color-hex-${key}`);
  if (hex) hex.value = value;
  const swatch = document.getElementById(`gen-color-swatch-${key}`);
  if (swatch) swatch.style.background = value;
  _genUpdateColorPreview();
}

function genOnColorHexChange(key, value) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(value)) return;
  if (!genData.colors) genData.colors = {};
  genData.colors[key] = value;
  const picker = document.getElementById(`gen-color-${key}`);
  if (picker) picker.value = value;
  const swatch = document.getElementById(`gen-color-swatch-${key}`);
  if (swatch) swatch.style.background = value;
  _genUpdateColorPreview();
}

function genApplyPreset(colors) {
  genData.colors = { ...colors };
  const tpl = genData.template || 'barber';
  const keys = Object.keys(GEN_DEFAULTS[tpl].colors);
  keys.forEach(key => {
    const val = colors[key];
    if (!val) return;
    const picker = document.getElementById(`gen-color-${key}`);
    const hex    = document.getElementById(`gen-color-hex-${key}`);
    const swatch = document.getElementById(`gen-color-swatch-${key}`);
    if (picker) picker.value = val;
    if (hex)    hex.value    = val;
    if (swatch) swatch.style.background = val;
  });
  _genUpdateColorPreview();
}

function _genUpdateColorPreview() {
  const preview = document.getElementById('gen-color-preview');
  if (!preview) return;
  const c = genData.colors;
  if (!c || !c.primary) return;

  preview.style.setProperty('--gp-primary',  c.primary);
  preview.style.setProperty('--gp-bg',       c.bg      || '#000');
  preview.style.setProperty('--gp-surface',  c.surface || c.bg || '#000');
  preview.style.setProperty('--gp-text',     c.textMain || '#fff');
  preview.style.setProperty('--gp-muted',    c.textMuted || '#aaa');
  preview.style.setProperty('--gp-accent',   c.accent  || c.primary);

  // Update preview heading with business name if filled
  const previewH = document.getElementById('gen-prev-heading');
  if (previewH) previewH.textContent = genData.name || document.getElementById('gen-name')?.value || 'Nome do Negócio';
}

/* ═══ STEP 4: CONTEÚDO ═══════════════════════════════════════════ */

function _genPopulateContent() {
  const d = genData;
  const defaults = GEN_DEFAULTS[d.template || 'barber'];

  _genSetVal('gen-hero-heading',    d.heroHeading    || defaults.heroHeading);
  _genSetVal('gen-hero-subheading', d.heroSubheading || defaults.heroSubheading);
  _genSetVal('gen-about-title',     d.aboutTitle     || defaults.aboutTitle);
  _genSetVal('gen-about-text',      d.aboutText      || defaults.aboutText);

  // Stats
  const statsContainer = document.getElementById('gen-stats-container');
  if (statsContainer) {
    statsContainer.innerHTML = '';
    const stats = d.stats.length ? d.stats : defaults.stats;
    stats.forEach(s => _genAddStatRow(s.value, s.label));
  }

  // Testimonials
  const testsContainer = document.getElementById('gen-tests-container');
  if (testsContainer) {
    testsContainer.innerHTML = '';
    const tests = d.testimonials.length ? d.testimonials : defaults.testimonials;
    tests.forEach(t => _genAddTestimonialRow(t.name, t.text));
  }
}

function _genSaveContent() {
  genData.heroHeading    = _genGetVal('gen-hero-heading');
  genData.heroSubheading = _genGetVal('gen-hero-subheading');
  genData.aboutTitle     = _genGetVal('gen-about-title');
  genData.aboutText      = _genGetVal('gen-about-text');

  genData.stats = [];
  document.querySelectorAll('.gen-stat-row').forEach(row => {
    const v = row.querySelector('.gen-stat-value')?.value?.trim();
    const l = row.querySelector('.gen-stat-label')?.value?.trim();
    if (v || l) genData.stats.push({ value: v || '', label: l || '' });
  });

  genData.testimonials = [];
  document.querySelectorAll('.gen-testimonial-row').forEach(row => {
    const n = row.querySelector('.gen-test-name')?.value?.trim();
    const t = row.querySelector('.gen-test-text')?.value?.trim();
    if (n || t) genData.testimonials.push({ name: n || '', text: t || '', stars: 5 });
  });
}

function _genAddStatRow(value = '', label = '') {
  const container = document.getElementById('gen-stats-container');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'gen-stat-row';
  row.innerHTML = `
    <input type="text" class="gen-stat-value" placeholder="Ex: 500+" value="${_esc(value)}" />
    <input type="text" class="gen-stat-label" placeholder="Ex: Clientes Atendidos" value="${_esc(label)}" />
    <button class="btn-icon-sm" onclick="this.parentElement.remove()" title="Remover">
      <i class="ph ph-trash"></i>
    </button>
  `;
  container.appendChild(row);
}

function genAddStat() {
  const container = document.getElementById('gen-stats-container');
  const count = container?.querySelectorAll('.gen-stat-row').length || 0;
  if (count >= 4) { orbitAlert('Máximo de 4 estatísticas.', 'Limite atingido'); return; }
  _genAddStatRow();
}

function _genAddTestimonialRow(name = '', text = '') {
  const container = document.getElementById('gen-tests-container');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'gen-testimonial-row';
  row.innerHTML = `
    <div class="gen-test-row-inner">
      <div class="gen-test-stars"><i class="ph ph-star-fill"></i><i class="ph ph-star-fill"></i><i class="ph ph-star-fill"></i><i class="ph ph-star-fill"></i><i class="ph ph-star-fill"></i></div>
      <input type="text" class="gen-test-name" placeholder="Nome do cliente" value="${_esc(name)}" />
      <button class="btn-icon-sm" onclick="this.closest('.gen-testimonial-row').remove()" title="Remover">
        <i class="ph ph-trash"></i>
      </button>
    </div>
    <textarea class="gen-test-text" placeholder="Depoimento do cliente..." rows="2">${_esc(text)}</textarea>
  `;
  container.appendChild(row);
}

function genAddTestimonial() {
  const container = document.getElementById('gen-tests-container');
  const count = container?.querySelectorAll('.gen-testimonial-row').length || 0;
  if (count >= 6) { orbitAlert('Máximo de 6 depoimentos.', 'Limite atingido'); return; }
  _genAddTestimonialRow();
}

/* ═══ STEP 5: API & GERAR ════════════════════════════════════════ */

function _genPopulateApi() {
  _genSetVal('gen-api-url',    genData.apiUrl);
  _genSetVal('gen-api-key',    genData.apiKey);
  _genSetVal('gen-api-secret', genData.apiSecret);
}

function _genSaveApi() {
  genData.apiUrl    = _genGetVal('gen-api-url');
  genData.apiKey    = _genGetVal('gen-api-key');
  genData.apiSecret = _genGetVal('gen-api-secret');

  /* Persiste credenciais no Firestore para que a agenda possa buscar agendamentos externos */
  if (genData.apiUrl && genData.apiKey && genData.apiSecret && typeof currentUser !== 'undefined' && currentUser) {
    const uid = currentUser.uid;
    db.collection('users').doc(uid).update({
      orbitApi: { url: genData.apiUrl, key: genData.apiKey, secret: genData.apiSecret }
    }).catch(() => {/* silencioso */});
  }
}

function _genRenderSummary() {
  const summary = document.getElementById('gen-summary');
  if (!summary) return;
  const tplName  = genData.template === 'barber' ? 'Modelo Escuro (Barber 47)' : 'Modelo Claro (Kamilly)';
  const apiStatus = genData.apiUrl ? `<span class="gen-sum-ok"><i class="ph ph-check-circle"></i> Configurada</span>` : `<span class="gen-sum-warn"><i class="ph ph-warning"></i> Modo demonstração</span>`;

  summary.innerHTML = `
    <div class="gen-summary-grid">
      <div class="gen-summary-item"><span class="gen-sum-label">Modelo</span><span class="gen-sum-val">${_esc(tplName)}</span></div>
      <div class="gen-summary-item"><span class="gen-sum-label">Negócio</span><span class="gen-sum-val">${_esc(genData.name || '—')}</span></div>
      <div class="gen-summary-item"><span class="gen-sum-label">Slogan</span><span class="gen-sum-val">${_esc(genData.tagline || '—')}</span></div>
      <div class="gen-summary-item"><span class="gen-sum-label">Telefone</span><span class="gen-sum-val">${_esc(genData.phone || '—')}</span></div>
      <div class="gen-summary-item"><span class="gen-sum-label">WhatsApp</span><span class="gen-sum-val">${_esc(genData.whatsapp || '—')}</span></div>
      <div class="gen-summary-item"><span class="gen-sum-label">Instagram</span><span class="gen-sum-val">${_esc(genData.instagram || '—')}</span></div>
      <div class="gen-summary-item"><span class="gen-sum-label">Endereço</span><span class="gen-sum-val">${_esc(genData.address || '—')}</span></div>
      <div class="gen-summary-item"><span class="gen-sum-label">API Orbit</span><span class="gen-sum-val">${apiStatus}</span></div>
      <div class="gen-summary-item"><span class="gen-sum-label">Depoimentos</span><span class="gen-sum-val">${genData.testimonials.length} cadastrado(s)</span></div>
      <div class="gen-summary-item"><span class="gen-sum-label">Estatísticas</span><span class="gen-sum-val">${genData.stats.length} cadastrada(s)</span></div>
    </div>
    <div class="gen-color-palette-preview">
      ${Object.entries(genData.colors || {}).slice(0, 6).map(([k, v]) => `<span class="gen-pal-dot" style="background:${v}" title="${k}: ${v}"></span>`).join('')}
    </div>
  `;
}

/* ═══ GERAR CONFIG.JS ════════════════════════════════════════════ */

function _genBuildConfigContent() {
  _genSaveStep(genCurrentStep);
  const d   = genData;
  const tpl = d.template || 'barber';
  const def = GEN_DEFAULTS[tpl];

  const colors = (d.colors && Object.keys(d.colors).length) ? d.colors : def.colors;
  const stats  = d.stats.length  ? d.stats  : def.stats;
  const tests  = d.testimonials.length ? d.testimonials : def.testimonials;

  return `// ═══════════════════════════════════════════════════════════════
// siteconfig.js — Gerado pelo Orbit Tools
// WordVirtua · ${new Date().toLocaleDateString('pt-BR')}
// ─────────────────────────────────────────────────────────────
// Coloque este arquivo na pasta raiz do seu site (mesma pasta do index.html).
// ═══════════════════════════════════════════════════════════════

window.SITE_CONFIG = {

  // ─── Modelo ──────────────────────────────────────────────────
  template: ${JSON.stringify(tpl)},

  // ─── Identidade do Negócio ───────────────────────────────────
  name:      ${JSON.stringify(d.name      || '')},
  tagline:   ${JSON.stringify(d.tagline   || '')},
  phone:     ${JSON.stringify(d.phone     || '')},
  whatsapp:  ${JSON.stringify(d.whatsapp  || '')},
  instagram: ${JSON.stringify(d.instagram || '')},
  address:   ${JSON.stringify(d.address   || '')},
  mapsUrl:   ${JSON.stringify(d.mapsUrl   || '')},

  // ─── Conteúdo ────────────────────────────────────────────────
  heroHeading:    ${JSON.stringify(d.heroHeading    || def.heroHeading)},
  heroSubheading: ${JSON.stringify(d.heroSubheading || def.heroSubheading)},
  aboutTitle:     ${JSON.stringify(d.aboutTitle     || def.aboutTitle)},
  aboutText:      ${JSON.stringify(d.aboutText      || def.aboutText)},

  stats: ${JSON.stringify(stats, null, 4).replace(/\n/g, '\n  ')},

  testimonials: ${JSON.stringify(tests, null, 4).replace(/\n/g, '\n  ')},

  // ─── Paleta de Cores ─────────────────────────────────────────
  colors: ${JSON.stringify(colors, null, 4).replace(/\n/g, '\n  ')},

  // ─── API Orbit ───────────────────────────────────────────────
  // Preencha com as credenciais do Orbit para ativar serviços e
  // agendamentos automáticos. Deixe em branco para modo demonstração.
  api: {
    url:    ${JSON.stringify(d.apiUrl    || '')},
    key:    ${JSON.stringify(d.apiKey    || '')},
    secret: ${JSON.stringify(d.apiSecret || '')},
  },

};
`;
}

function genDownloadConfig() {
  _genSaveStep(genCurrentStep);
  if (!genData.template) {
    orbitAlert('Selecione um modelo antes de gerar.', 'Atenção');
    return;
  }

  const content = _genBuildConfigContent();
  const blob    = new Blob([content], { type: 'application/javascript;charset=utf-8' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href     = url;
  a.download = 'siteconfig.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ═══ HELPERS ════════════════════════════════════════════════════ */

function _genGetVal(id) {
  return document.getElementById(id)?.value?.trim() || '';
}
function _genSetVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}
function _esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
