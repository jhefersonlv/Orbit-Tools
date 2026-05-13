'use strict';

/* ═══════════════════════════════════════════════════════════════
   ORBIT TOOLS — Kanban de Tarefas
   Storage: Firestore (quando logado) | localStorage (fallback)
   Log: cada ação registrada com nome do ator
   ═══════════════════════════════════════════════════════════════ */

const KB_KEY = 'orbit_kanban_v1';

const KB_COLS = [
  { id: 'ideias',     label: 'Ideias',       icon: 'ph-lightbulb',    color: '#f59e0b' },
  { id: 'afazer',     label: 'A Fazer',       icon: 'ph-list-checks',  color: '#3b82f6' },
  { id: 'andamento',  label: 'Em Andamento',  icon: 'ph-spinner-gap',  color: '#8b5cf6' },
  { id: 'concluidas', label: 'Concluídas',    icon: 'ph-check-circle', color: '#10b981' },
];

let kbCards          = [];
let _kbUnsubscribe   = null;
let _kbActUnsubscribe = null;
let _kbActivityOpen  = false;

// ─── UID E ATOR ───────────────────────────────────────────────────

function _kbUid() {
  if (typeof activeTenantUid !== 'undefined' && activeTenantUid) return activeTenantUid;
  if (typeof currentUser     !== 'undefined' && currentUser)     return currentUser.uid;
  return null;
}

function _kbIsReadOnly() {
  return (typeof activeTenantUid !== 'undefined' && activeTenantUid !== null);
}

function _kbActorName() {
  if (typeof currentUser === 'undefined' || !currentUser) return 'Desconhecido';
  return currentUser.displayName || currentUser.email?.split('@')[0] || 'Alguém';
}

// ─── REF FIRESTORE ───────────────────────────────────────────────

function _kbRef() {
  const uid = _kbUid();
  if (!uid || typeof db === 'undefined') return null;
  return db.collection('kanban').doc(uid);
}

function _kbActivityRef() {
  const uid = _kbUid();
  if (!uid || typeof db === 'undefined') return null;
  return db.collection('kanbanActivity').doc(uid).collection('entries');
}

// ─── LOG DE ATIVIDADE ─────────────────────────────────────────────

function _kbLog(action, details) {
  const ref = _kbActivityRef();
  if (!ref || typeof currentUser === 'undefined' || !currentUser) return;
  ref.add({
    action,
    details: details || {},
    actorName: _kbActorName(),
    actorUid:  currentUser.uid,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch(() => {});
}

const KB_ACTION_LABELS = {
  card_created:   (d) => `criou o card <strong>${kbEsc(d.cardTitle)}</strong> em <em>${_kbColLabel(d.col)}</em>`,
  card_deleted:   (d) => `excluiu o card <strong>${kbEsc(d.cardTitle)}</strong>`,
  card_moved:     (d) => `moveu <strong>${kbEsc(d.cardTitle)}</strong> de <em>${_kbColLabel(d.fromCol)}</em> para <em>${_kbColLabel(d.toCol)}</em>`,
  card_renamed:   (d) => `renomeou card de <strong>${kbEsc(d.oldTitle)}</strong> para <strong>${kbEsc(d.newTitle)}</strong>`,
  item_added:     (d) => `adicionou "<em>${kbEsc(d.itemText)}</em>" no card <strong>${kbEsc(d.cardTitle)}</strong>`,
  item_checked:   (d) => `marcou "<em>${kbEsc(d.itemText)}</em>" como concluído`,
  item_unchecked: (d) => `desmarcou "<em>${kbEsc(d.itemText)}</em>"`,
  item_deleted:   (d) => `removeu "<em>${kbEsc(d.itemText)}</em>" do card <strong>${kbEsc(d.cardTitle)}</strong>`,
};

function _kbColLabel(id) {
  return KB_COLS.find(c => c.id === id)?.label || id;
}

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────

function kbInit() {
  kbBuildBoard();
  kbStartSync();
  kbListenActivity();
}

function kbBuildBoard() {
  const board = document.getElementById('kb-board');
  if (!board || board.dataset.built === '1') return;
  board.dataset.built = '1';

  board.innerHTML = KB_COLS.map(col => `
    <div class="kb-col" id="kb-col-${col.id}" data-col="${col.id}">
      <div class="kb-col-header" style="--col-color:${col.color}">
        <div class="kb-col-header-left">
          <i class="ph ${col.icon}" style="color:${col.color};font-size:16px"></i>
          <span class="kb-col-title">${col.label}</span>
          <span class="kb-col-count" id="kb-count-${col.id}">0</span>
        </div>
        <button class="kb-add-card-btn" id="kb-add-${col.id}" title="Adicionar card">
          <i class="ph ph-plus"></i>
        </button>
      </div>
      <div class="kb-col-body" id="kb-body-${col.id}"></div>
    </div>`).join('');

  KB_COLS.forEach(col => {
    document.getElementById(`kb-add-${col.id}`)
      ?.addEventListener('click', () => kbAddCard(col.id));

    const body = document.getElementById(`kb-body-${col.id}`);
    body.addEventListener('dragover',  e => { e.preventDefault(); body.classList.add('kb-col-dragover'); });
    body.addEventListener('dragleave', e => { if (!body.contains(e.relatedTarget)) body.classList.remove('kb-col-dragover'); });
    body.addEventListener('drop',      e => { e.preventDefault(); body.classList.remove('kb-col-dragover'); kbOnDrop(e, col.id); });
  });
}

// ─── SINCRONIZAÇÃO KANBAN ─────────────────────────────────────────

function kbStartSync() {
  if (_kbUnsubscribe) { _kbUnsubscribe(); _kbUnsubscribe = null; }

  const ref = _kbRef();
  if (ref) {
    _kbUnsubscribe = ref.onSnapshot(snap => {
      kbCards = snap.exists ? (snap.data().cards || []) : [];
      kbRenderAll();
      kbUpdateCounts();
      kbUpdateReadOnlyUI();
    }, err => {
      console.warn('[Kanban] listener falhou, usando localStorage:', err.message);
      _kbLoadLocal();
      kbRenderAll();
      kbUpdateCounts();
    });
  } else {
    _kbLoadLocal();
    kbRenderAll();
    kbUpdateCounts();
  }
}

function _kbLoadLocal() {
  try { kbCards = JSON.parse(localStorage.getItem(KB_KEY) || '[]'); } catch { kbCards = []; }
}

function _kbSave() {
  const ref = _kbRef();
  if (ref) {
    ref.set({ cards: kbCards, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
       .catch(err => console.error('[Kanban] Erro ao salvar:', err));
  } else {
    localStorage.setItem(KB_KEY, JSON.stringify(kbCards));
  }
}

function kbUpdateReadOnlyUI() {
  const readonly = _kbIsReadOnly();
  document.querySelectorAll('.kb-add-card-btn').forEach(b => b.style.display = readonly ? 'none' : '');
}

// ─── LISTENER DE ATIVIDADES ──────────────────────────────────────

function kbListenActivity() {
  if (_kbActUnsubscribe) { _kbActUnsubscribe(); _kbActUnsubscribe = null; }

  const ref = _kbActivityRef();
  if (!ref) return;

  _kbActUnsubscribe = ref
    .orderBy('timestamp', 'desc')
    .limit(100)
    .onSnapshot(snap => {
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      kbRenderActivity(entries);
    }, () => {});
}

function kbRenderActivity(entries) {
  const list  = document.getElementById('kb-activity-list');
  const badge = document.getElementById('kb-activity-badge');
  if (!list) return;

  if (badge) {
    badge.textContent = entries.length;
    badge.hidden = entries.length === 0;
  }

  if (!entries.length) {
    list.innerHTML = '<p class="kb-act-empty">Nenhuma atividade registrada ainda.</p>';
    return;
  }

  list.innerHTML = entries.map(e => {
    const fn      = KB_ACTION_LABELS[e.action];
    const text    = fn ? fn(e.details || {}) : e.action;
    const initials = (e.actorName || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const time    = e.timestamp?.toDate ? _kbTimeAgo(e.timestamp.toDate()) : '';
    return `
      <div class="kb-act-item">
        <div class="kb-act-avatar">${initials}</div>
        <div class="kb-act-body">
          <span class="kb-act-name">${kbEsc(e.actorName)}</span>
          <span class="kb-act-text"> ${text}</span>
          ${time ? `<div class="kb-act-time">${time}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

function kbToggleActivity() {
  _kbActivityOpen = !_kbActivityOpen;
  const body  = document.getElementById('kb-activity-body');
  const caret = document.getElementById('kb-activity-caret');
  if (body)  body.hidden  = !_kbActivityOpen;
  if (caret) caret.style.transform = _kbActivityOpen ? 'rotate(180deg)' : '';
}

function _kbTimeAgo(date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)   return 'agora mesmo';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return date.toLocaleDateString('pt-BR');
}

// ─── RENDER COMPLETO ──────────────────────────────────────────────

function kbRenderAll() {
  KB_COLS.forEach(col => {
    const body  = document.getElementById(`kb-body-${col.id}`);
    const count = document.getElementById(`kb-count-${col.id}`);
    if (!body) return;

    const cards = kbCards
      .filter(c => c.col === col.id)
      .sort((a, b) => a.order - b.order);

    body.innerHTML = '';
    cards.forEach(card => body.appendChild(kbBuildCardEl(card)));
    if (count) count.textContent = cards.length;
  });
}

function kbRerenderCard(cardId) {
  const card  = kbCards.find(c => c.id === cardId);
  const oldEl = document.querySelector(`.kb-card[data-id="${cardId}"]`);
  if (!card || !oldEl) { kbRenderAll(); return; }
  oldEl.replaceWith(kbBuildCardEl(card));
}

// ─── CONSTRUÇÃO DO CARD ───────────────────────────────────────────

function kbBuildCardEl(card) {
  const colIdx   = KB_COLS.findIndex(c => c.id === card.col);
  const col      = KB_COLS[colIdx];
  const total    = card.checklist.length;
  const done     = card.checklist.filter(i => i.done).length;
  const pct      = total > 0 ? Math.round((done / total) * 100) : 0;
  const readonly = _kbIsReadOnly();

  const el = document.createElement('div');
  el.className  = 'kb-card';
  el.draggable  = !readonly;
  el.dataset.id = card.id;

  el.innerHTML = `
    <div class="kb-card-header">
      <div class="kb-card-title" ${readonly ? '' : 'contenteditable="true" spellcheck="false"'}
           data-orig="${kbEsc(card.title)}">${kbEsc(card.title)}</div>
      ${readonly ? '' : `<button class="kb-card-del" title="Excluir card"><i class="ph ph-trash"></i></button>`}
    </div>

    ${total > 0 ? `
      <div class="kb-progress-wrap">
        <div class="kb-progress"><div class="kb-progress-bar" style="width:${pct}%"></div></div>
        <span class="kb-progress-label">${done}/${total}</span>
      </div>` : ''}

    <ul class="kb-checklist">
      ${card.checklist.map(item => `
        <li class="kb-cl-item${item.done ? ' done' : ''}" data-iid="${item.id}">
          <label class="kb-cl-label">
            <input type="checkbox" class="kb-cl-check" ${item.done ? 'checked' : ''} data-iid="${item.id}" ${readonly ? 'disabled' : ''}>
            <span class="kb-cl-box"></span>
          </label>
          <span class="kb-cl-text" ${readonly ? '' : 'contenteditable="true" spellcheck="false"'} data-iid="${item.id}">${kbEsc(item.text)}</span>
          ${readonly ? '' : `<button class="kb-cl-del" data-iid="${item.id}"><i class="ph ph-x"></i></button>`}
        </li>`).join('')}
    </ul>

    ${readonly ? '' : `
    <div class="kb-add-item-row">
      <i class="ph ph-plus-circle" style="color:var(--c-light);font-size:14px;flex-shrink:0"></i>
      <input class="kb-add-item-input" type="text" placeholder="Adicionar item ao checklist...">
    </div>`}

    <div class="kb-card-footer">
      ${readonly ? '' : `<button class="kb-move-btn kb-move-prev" ${colIdx === 0 ? 'disabled' : ''}><i class="ph ph-arrow-left"></i></button>`}
      <span class="kb-col-pill" style="--pill-color:${col.color}">${col.label}</span>
      ${readonly ? '' : `<button class="kb-move-btn kb-move-next" ${colIdx === KB_COLS.length - 1 ? 'disabled' : ''}><i class="ph ph-arrow-right"></i></button>`}
    </div>`;

  if (readonly) return el;

  // Drag
  el.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', card.id);
    requestAnimationFrame(() => el.classList.add('kb-card--dragging'));
  });
  el.addEventListener('dragend', () => el.classList.remove('kb-card--dragging'));

  // Título editável
  const titleEl = el.querySelector('.kb-card-title');
  titleEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); } });
  titleEl.addEventListener('blur', () => {
    const newTitle = titleEl.innerText.trim() || 'Sem título';
    const oldTitle = titleEl.dataset.orig;
    const c = kbCards.find(c => c.id === card.id);
    if (c && newTitle !== oldTitle) {
      c.title = newTitle;
      titleEl.dataset.orig = newTitle;
      _kbSave();
      _kbLog('card_renamed', { oldTitle, newTitle });
    }
  });

  el.querySelector('.kb-card-del')?.addEventListener('click', () => kbDeleteCard(card.id));

  el.querySelectorAll('.kb-cl-check').forEach(cb => {
    cb.addEventListener('change', () => kbToggleItem(card.id, cb.dataset.iid, cb.checked, el));
  });

  el.querySelectorAll('.kb-cl-text').forEach(span => {
    span.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); span.blur(); } });
    span.addEventListener('blur', () => {
      const c    = kbCards.find(c => c.id === card.id);
      const item = c?.checklist.find(i => i.id === span.dataset.iid);
      if (item) { item.text = span.innerText.trim() || '...'; _kbSave(); }
    });
  });

  el.querySelectorAll('.kb-cl-del').forEach(btn => {
    btn.addEventListener('click', () => kbDeleteItem(card.id, btn.dataset.iid));
  });

  const addInput = el.querySelector('.kb-add-item-input');
  const doAdd = () => {
    const txt = addInput?.value.trim();
    if (!txt) return;
    addInput.value = '';
    kbAddItem(card.id, txt);
  };
  addInput?.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
  addInput?.addEventListener('blur',    () => doAdd());

  el.querySelector('.kb-move-prev')?.addEventListener('click', () => kbMoveCard(card.id, -1));
  el.querySelector('.kb-move-next')?.addEventListener('click', () => kbMoveCard(card.id, +1));

  return el;
}

// ─── DRAG & DROP ─────────────────────────────────────────────────

function kbOnDrop(e, destColId) {
  if (_kbIsReadOnly()) return;
  const cardId = e.dataTransfer.getData('text/plain');
  const card   = kbCards.find(c => c.id === cardId);
  if (!card || card.col === destColId) return;
  const fromCol = card.col;
  const destOrders = kbCards.filter(c => c.col === destColId).map(c => c.order);
  card.col   = destColId;
  card.order = destOrders.length ? Math.max(...destOrders) + 1 : 0;
  _kbSave();
  _kbLog('card_moved', { cardTitle: card.title, fromCol, toCol: destColId });
  kbRenderAll(); kbUpdateCounts();
}

// ─── OPERAÇÕES DE CARDS ───────────────────────────────────────────

function kbAddCard(colId) {
  if (_kbIsReadOnly()) return;
  const orders   = kbCards.filter(c => c.col === colId).map(c => c.order);
  const maxOrder = orders.length ? Math.max(...orders) : -1;
  kbCards.push({ id: kbGenId(), col: colId, title: 'Nova tarefa', checklist: [], createdAt: new Date().toISOString(), order: maxOrder + 1 });
  _kbSave();
  _kbLog('card_created', { cardTitle: 'Nova tarefa', col: colId });
  if (!_kbRef()) { kbRenderAll(); kbUpdateCounts(); }

  setTimeout(() => {
    const cards = document.getElementById(`kb-body-${colId}`)?.querySelectorAll('.kb-card');
    const title = cards?.[cards.length - 1]?.querySelector('.kb-card-title');
    if (title) {
      title.focus();
      const r = document.createRange();
      r.selectNodeContents(title);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    }
  }, 80);
}

function kbDeleteCard(cardId) {
  if (_kbIsReadOnly()) return;
  const card = kbCards.find(c => c.id === cardId);
  kbCards = kbCards.filter(c => c.id !== cardId);
  _kbSave();
  if (card) _kbLog('card_deleted', { cardTitle: card.title });
  if (!_kbRef()) { kbRenderAll(); kbUpdateCounts(); }
}

function kbMoveCard(cardId, dir) {
  if (_kbIsReadOnly()) return;
  const card   = kbCards.find(c => c.id === cardId);
  if (!card) return;
  const colIdx = KB_COLS.findIndex(c => c.id === card.col);
  const newIdx = colIdx + dir;
  if (newIdx < 0 || newIdx >= KB_COLS.length) return;
  const fromCol    = card.col;
  const destOrders = kbCards.filter(c => c.col === KB_COLS[newIdx].id).map(c => c.order);
  card.col   = KB_COLS[newIdx].id;
  card.order = destOrders.length ? Math.max(...destOrders) + 1 : 0;
  _kbSave();
  _kbLog('card_moved', { cardTitle: card.title, fromCol, toCol: card.col });
  if (!_kbRef()) { kbRenderAll(); kbUpdateCounts(); }
}

// ─── OPERAÇÕES DE CHECKLIST ───────────────────────────────────────

function kbAddItem(cardId, text) {
  if (_kbIsReadOnly()) return;
  const card = kbCards.find(c => c.id === cardId);
  if (!card) return;
  card.checklist.push({ id: kbGenId(), text, done: false });
  _kbSave();
  _kbLog('item_added', { itemText: text, cardTitle: card.title });
  if (!_kbRef()) kbRerenderCard(cardId);
}

function kbDeleteItem(cardId, itemId) {
  if (_kbIsReadOnly()) return;
  const card = kbCards.find(c => c.id === cardId);
  if (!card) return;
  const item = card.checklist.find(i => i.id === itemId);
  card.checklist = card.checklist.filter(i => i.id !== itemId);
  _kbSave();
  if (item) _kbLog('item_deleted', { itemText: item.text, cardTitle: card.title });
  if (!_kbRef()) kbRerenderCard(cardId);
}

function kbToggleItem(cardId, itemId, checked, cardEl) {
  if (_kbIsReadOnly()) return;
  const card = kbCards.find(c => c.id === cardId);
  if (!card) return;
  const item = card.checklist.find(i => i.id === itemId);
  if (!item) return;
  item.done = checked;
  _kbSave();
  _kbLog(checked ? 'item_checked' : 'item_unchecked', { itemText: item.text, cardTitle: card.title });

  const liEl = cardEl.querySelector(`[data-iid="${itemId}"]`)?.closest('.kb-cl-item');
  if (liEl) liEl.classList.toggle('done', checked);
  const total = card.checklist.length;
  const done  = card.checklist.filter(i => i.done).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const bar   = cardEl.querySelector('.kb-progress-bar');
  const label = cardEl.querySelector('.kb-progress-label');
  if (bar)   bar.style.width   = `${pct}%`;
  if (label) label.textContent = `${done}/${total}`;
}

// ─── CONTADORES ───────────────────────────────────────────────────

function kbUpdateCounts() {
  KB_COLS.forEach(col => {
    const el = document.getElementById(`kb-count-${col.id}`);
    if (el) el.textContent = kbCards.filter(c => c.col === col.id).length;
  });
}

// ─── UTILITÁRIOS ──────────────────────────────────────────────────

function kbGenId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function kbEsc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
