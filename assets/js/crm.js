/* ═══════════════════════════════════════════════════════════════
   Orbit Tools — CRM Module (customers — Single Source of Truth)
   WordVirtua · 2026

   Regras de Governança:
   1. Entidade única: 'customers' é o SSOT. Disparo e Agendamentos
      consomem desta coleção.
   2. Dedup por telefone normalizado (normalizedPhone).
   3. Histórico de funil em subcoleção history (auditável).
   4. Toda escrita registra updatedBy (adminUid) + updatedAt.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   NORMALIZAÇÃO DE TELEFONE
   ═══════════════════════════════════════════════════════════════ */

/**
 * Normaliza um número de telefone para dígitos puros com DDI 55 (Brasil).
 * Ex.: "+55 (11) 9 8765-4321" → "5511987654321"
 */
function normalizePhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  /* Já tem DDI 55 */
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  /* Número com 11 dígitos (DDD + 9 dígitos) → adiciona 55 */
  if (digits.length === 11) return '55' + digits;
  /* Número com 10 dígitos (DDD + 8 dígitos) → adiciona 55 */
  if (digits.length === 10) return '55' + digits;
  return digits;
}

/**
 * Converte um objeto Date para string "YYYY-MM-DD" (input type="date").
 */
function _dateToInputVal(date) {
  if (!date || !(date instanceof Date) || isNaN(date)) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Converte string "YYYY-MM-DD" para Date (início do dia, horário local).
 */
function _inputValToDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/* ═══════════════════════════════════════════════════════════════
   LEITURA — CLIENTES
   ═══════════════════════════════════════════════════════════════ */

/**
 * Carrega todos os clientes do tenant ativo (ou conta própria)
 * e popula o array global disparoContacts usado pelo Disparo e CRM.
 */
function crmLoadCustomers(uid) {
  if (!uid) return;
  db.collection('users').doc(uid).collection('customers')
    .orderBy('createdAt', 'asc')
    .get()
    .then(snap => {
      disparoContacts = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id:               doc.id,
          name:             d.name              || '',
          company:          d.company            || '—',
          segment:          d.segment            || '—',
          group:            d.group              || '—',
          phone:            d.phone              || '',
          normalizedPhone:  d.normalizedPhone    || normalizePhone(d.phone || ''),
          email:            d.email              || '',
          birthday:         d.birthday           ? d.birthday.toDate()          : null,
          birthdayMonth:    d.birthdayMonth      || null,
          lastPurchaseDate: d.lastPurchaseDate   ? d.lastPurchaseDate.toDate()  : null,
          totalSpent:       d.totalSpent         || 0,
          purchaseCount:    d.purchaseCount      || 0,
          isClient:         d.isClient           === true,
          clientSince:      d.clientSince        ? d.clientSince.toDate()       : null,
          status:           d.status             || 'pending',
          stage:            d.stage              || 'novo',
          history:          [],   /* carregado sob demanda via subcoleção */
          messages:         d.messages           || [],
          notes:            d.notes              || '',
          tags:             d.tags               || [],
          followUpDate:     d.followUpDate       || null,
          origin:           d.origin             || 'manual',
          subscription:     d.subscription ? {
            planId:          d.subscription.planId          || '',
            planName:        d.subscription.planName        || '',
            totalCredits:    d.subscription.totalCredits    || 0,
            usedCredits:     d.subscription.usedCredits     || 0,
            price:           d.subscription.price           || 0,
            durationDays:    d.subscription.durationDays    || 30,
            status:          d.subscription.status          || 'active',
            startDate:       d.subscription.startDate
                               ? d.subscription.startDate.toDate()        : null,
            expiresAt:       d.subscription.expiresAt
                               ? d.subscription.expiresAt.toDate()        : null,
            nextBillingDate: d.subscription.nextBillingDate
                               ? d.subscription.nextBillingDate.toDate()  : null,
          } : null,
        };
      });

      if (typeof disparoUpdateStats     === 'function') disparoUpdateStats();
      if (typeof disparoFilter          === 'function') disparoFilter();
      if (typeof _disparoUpdateLimitBar === 'function') _disparoUpdateLimitBar();
      if (typeof _updateTagFilterChips  === 'function') _updateTagFilterChips();
      if (typeof renderCRM              === 'function') renderCRM();
      if (typeof clientesRenderTable    === 'function') clientesRenderTable();
      planCheckExpiredLocally();
      crmRenderInsights();
      planTemplatesLoad(uid);
    })
    .catch(err => console.error('[CRM] crmLoadCustomers erro:', err));
}

/**
 * Busca cliente pelo telefone normalizado (verificação de duplicidade).
 * Retorna a Promise<{id, ...data} | null>.
 */
function crmFindByPhone(uid, normalizedPhone) {
  if (!uid || !normalizedPhone) return Promise.resolve(null);
  return db.collection('users').doc(uid).collection('customers')
    .where('normalizedPhone', '==', normalizedPhone)
    .limit(1)
    .get()
    .then(snap => {
      if (snap.empty) return null;
      const doc = snap.docs[0];
      return { id: doc.id, ...doc.data() };
    });
}

/* ═══════════════════════════════════════════════════════════════
   ESCRITA — CLIENTES (com Auditoria)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Check-in de Contato:
 * - Se o telefone já existe → atualiza lastInteraction e retorna {id, duplicate: true}
 * - Se não existe → cria novo cliente e retorna {id, duplicate: false}
 *
 * Chame com await (função retorna Promise).
 */
function crmCreateOrLink(uid, data, adminUid) {
  if (!uid) return Promise.reject(new Error('uid obrigatório'));

  const normPhone = normalizePhone(data.phone);

  return crmFindByPhone(uid, normPhone).then(existing => {
    if (existing) {
      /* Já existe: registra interação */
      return db.collection('users').doc(uid).collection('customers')
        .doc(existing.id)
        .update({
          lastInteraction: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy:       adminUid || uid,
          updatedAt:       firebase.firestore.FieldValue.serverTimestamp(),
        })
        .then(() => ({ id: existing.id, duplicate: true }));
    }

    /* Não existe: cria */
    const birthdayDate   = data.birthday instanceof Date ? data.birthday : null;
    const lastPurchDate  = data.lastPurchaseDate instanceof Date ? data.lastPurchaseDate : null;

    const payload = {
      name:             data.name             || '',
      company:          data.company          || '—',
      segment:          data.segment          || '—',
      group:            data.group            || '—',
      phone:            data.phone            || '',
      normalizedPhone:  normPhone,
      email:            data.email            || '',
      birthday:         birthdayDate
                          ? firebase.firestore.Timestamp.fromDate(birthdayDate)
                          : null,
      birthdayMonth:    birthdayDate ? birthdayDate.getMonth() + 1 : null,
      lastPurchaseDate: lastPurchDate
                          ? firebase.firestore.Timestamp.fromDate(lastPurchDate)
                          : null,
      totalSpent:       Number(data.totalSpent) || 0,
      status:           'pending',
      stage:            data.stage            || 'novo',
      messages:         data.messages         || [],
      notes:            data.notes            || '',
      tags:             data.tags             || [],
      followUpDate:     data.followUpDate     || null,
      origin:           data.origin           || 'manual',
      createdAt:        firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy:        adminUid              || uid,
      updatedAt:        firebase.firestore.FieldValue.serverTimestamp(),
    };

    return db.collection('users').doc(uid).collection('customers')
      .add(payload)
      .then(ref => ({ id: ref.id, duplicate: false }));
  });
}

/**
 * Atualiza campos de um cliente com trilha de auditoria.
 */
function crmUpdateCustomer(uid, customerId, patch, adminUid) {
  if (!uid || !customerId) return Promise.resolve();
  const update = {
    ...patch,
    updatedBy: adminUid || uid,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  return db.collection('users').doc(uid).collection('customers')
    .doc(customerId)
    .update(update)
    .catch(err => console.error('[CRM] crmUpdateCustomer erro:', err));
}

/**
 * Remove um cliente.
 */
function crmDeleteCustomer(uid, customerId) {
  if (!uid || !customerId) return Promise.resolve();
  return db.collection('users').doc(uid).collection('customers')
    .doc(customerId)
    .delete()
    .catch(err => console.error('[CRM] crmDeleteCustomer erro:', err));
}

/* ═══════════════════════════════════════════════════════════════
   HISTÓRICO DE FUNIL (Subcoleção)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Grava uma entrada de histórico na subcoleção history do cliente.
 * Cada mudança de estágio gera um log imutável com adminUid.
 */
function crmWriteHistory(uid, customerId, entry, adminUid) {
  if (!uid || !customerId) return Promise.resolve();
  return db.collection('users').doc(uid)
    .collection('customers').doc(customerId)
    .collection('history')
    .add({
      date:        firebase.firestore.FieldValue.serverTimestamp(),
      type:        entry.type        || 'stage_change',
      oldStage:    entry.oldStage    || '',
      targetStage: entry.targetStage || '',
      note:        entry.note        || '',
      adminUid:    adminUid          || uid,
    })
    .catch(err => console.error('[CRM] crmWriteHistory erro:', err));
}

/**
 * Busca o histórico de um cliente (subcoleção) e chama callback(entries[]).
 */
function crmGetHistory(uid, customerId, callback) {
  if (!uid || !customerId) { callback([]); return; }
  db.collection('users').doc(uid)
    .collection('customers').doc(customerId)
    .collection('history')
    .orderBy('date', 'desc')
    .limit(100)
    .get()
    .then(snap => {
      const entries = snap.docs.map(doc => {
        const d = doc.data();
        return {
          date:        d.date ? d.date.toDate() : new Date(),
          type:        d.type        || 'stage_change',
          oldStage:    d.oldStage    || '',
          targetStage: d.targetStage || '',
          note:        d.note        || '',
          adminUid:    d.adminUid    || '',
        };
      });
      callback(entries);
    })
    .catch(() => callback([]));
}

/* ═══════════════════════════════════════════════════════════════
   QUERIES DE GOVERNANÇA
   ═══════════════════════════════════════════════════════════════ */

/**
 * Retorna clientes filtrados por janela de inatividade (lastPurchaseDate).
 * minDays: mínimo de dias sem compra.
 * maxDays: máximo de dias sem compra (null = sem limite superior).
 */
function crmQueryInactive(uid, minDays, maxDays, callback) {
  if (!uid) { callback([]); return; }
  const now   = new Date();
  const upper = new Date(now.getTime() - minDays * 86400000);

  let query = db.collection('users').doc(uid).collection('customers')
    .where('lastPurchaseDate', '<=', firebase.firestore.Timestamp.fromDate(upper))
    .orderBy('lastPurchaseDate', 'desc');

  if (maxDays !== null && maxDays !== undefined) {
    const lower = new Date(now.getTime() - maxDays * 86400000);
    query = db.collection('users').doc(uid).collection('customers')
      .where('lastPurchaseDate', '>=', firebase.firestore.Timestamp.fromDate(lower))
      .where('lastPurchaseDate', '<=', firebase.firestore.Timestamp.fromDate(upper))
      .orderBy('lastPurchaseDate', 'desc');
  }

  query.get()
    .then(snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    .catch(() => callback([]));
}

/**
 * Retorna clientes com aniversário no mês atual.
 * Requer campo birthdayMonth (1-12) no documento.
 */
function crmQueryBirthdays(uid, callback) {
  if (!uid) { callback([]); return; }
  const currentMonth = new Date().getMonth() + 1;
  db.collection('users').doc(uid).collection('customers')
    .where('birthdayMonth', '==', currentMonth)
    .get()
    .then(snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    .catch(() => callback([]));
}

/* ═══════════════════════════════════════════════════════════════
   RELATÓRIO DE INSIGHTS (Dashboard de Inatividade)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Renderiza o painel de insights de inatividade acima do Kanban.
 * Lê de disparoContacts (já em memória — evita queries extras).
 */
function crmRenderInsights() {
  const wrap = document.getElementById('crm-insights');
  if (!wrap) return;

  const now     = Date.now();
  const day     = 86400000;
  const contacts = typeof disparoContacts !== 'undefined' ? disparoContacts : [];

  const active  = contacts.filter(c =>
    c.lastPurchaseDate && (now - c.lastPurchaseDate.getTime()) < 30 * day
  ).length;

  const risk    = contacts.filter(c =>
    c.lastPurchaseDate &&
    (now - c.lastPurchaseDate.getTime()) >= 30 * day &&
    (now - c.lastPurchaseDate.getTime()) <  90 * day
  ).length;

  const asleep  = contacts.filter(c =>
    c.lastPurchaseDate &&
    (now - c.lastPurchaseDate.getTime()) >= 90 * day &&
    (now - c.lastPurchaseDate.getTime()) <  365 * day
  ).length;

  const dead    = contacts.filter(c =>
    c.lastPurchaseDate &&
    (now - c.lastPurchaseDate.getTime()) >= 365 * day
  ).length;

  const currentMonth  = new Date().getMonth() + 1;
  const birthdays     = contacts.filter(c => c.birthdayMonth === currentMonth).length;

  /* Planos expirando nos próximos 7 dias */
  const expiringPlans = (typeof planGetExpiringSoon === 'function') ? planGetExpiringSoon(7).length : 0;

  wrap.innerHTML = `
    <div class="crm-insight-card crm-insight--green crm-insight--clickable"
         onclick="clientesGoToFilter('active_30')"
         title="Ver clientes ativos nos últimos 30 dias">
      <i class="ph ph-check-circle"></i>
      <div>
        <div class="crm-insight-val">${active}</div>
        <div class="crm-insight-lbl">Ativos (30d)</div>
      </div>
      <i class="ph ph-arrow-right crm-insight-arrow"></i>
    </div>
    <div class="crm-insight-card crm-insight--amber crm-insight--clickable"
         onclick="clientesGoToFilter('risk')"
         title="Ver clientes em risco (30–90 dias sem compra)">
      <i class="ph ph-warning"></i>
      <div>
        <div class="crm-insight-val">${risk}</div>
        <div class="crm-insight-lbl">Em Risco (30–90d)</div>
      </div>
      <i class="ph ph-arrow-right crm-insight-arrow"></i>
    </div>
    <div class="crm-insight-card crm-insight--orange crm-insight--clickable"
         onclick="clientesGoToFilter('asleep')"
         title="Ver clientes adormecidos (3–12 meses sem compra)">
      <i class="ph ph-hourglass"></i>
      <div>
        <div class="crm-insight-val">${asleep}</div>
        <div class="crm-insight-lbl">Adormecidos (3–12m)</div>
      </div>
      <i class="ph ph-arrow-right crm-insight-arrow"></i>
    </div>
    <div class="crm-insight-card crm-insight--red crm-insight--clickable"
         onclick="clientesGoToFilter('dead')"
         title="Ver clientes inativos há mais de 1 ano">
      <i class="ph ph-skull"></i>
      <div>
        <div class="crm-insight-val">${dead}</div>
        <div class="crm-insight-lbl">Inativos (+1 ano)</div>
      </div>
      <i class="ph ph-arrow-right crm-insight-arrow"></i>
    </div>
    <div class="crm-insight-card crm-insight--blue crm-insight--clickable"
         onclick="clientesGoToFilter('birthdays')"
         title="Ver aniversariantes deste mês">
      <i class="ph ph-cake"></i>
      <div>
        <div class="crm-insight-val">${birthdays}</div>
        <div class="crm-insight-lbl">Aniversários (mês)</div>
      </div>
      <i class="ph ph-arrow-right crm-insight-arrow"></i>
    </div>
    ${expiringPlans > 0 ? `
    <div class="crm-insight-card crm-insight--purple crm-insight--clickable"
         onclick="loadTool('clientes', document.querySelector('[data-tool=clientes]'))"
         title="Planos vencendo nos próximos 7 dias">
      <i class="ph ph-credit-card"></i>
      <div>
        <div class="crm-insight-val">${expiringPlans}</div>
        <div class="crm-insight-lbl">Planos Expirando</div>
      </div>
      <i class="ph ph-arrow-right crm-insight-arrow"></i>
    </div>` : ''}
  `;

  /* Renderiza o Relatório de Ressurreição se o container existir */
  crmRenderResurrection();
}

/* ─── Relatório de Ressurreição ──────────────────────────────── */
function crmRenderResurrection() {
  const wrap = document.getElementById('crm-resurrection-list');
  if (!wrap) return;

  const now  = Date.now();
  const year = 365 * 86400000;
  const dead = (typeof disparoContacts !== 'undefined' ? disparoContacts : [])
    .filter(c => c.lastPurchaseDate && (now - c.lastPurchaseDate.getTime()) >= year)
    .sort((a, b) => a.lastPurchaseDate - b.lastPurchaseDate); /* mais antigos primeiro */

  const badge = document.getElementById('crm-resurrection-badge');
  if (badge) badge.textContent = dead.length || '';

  if (dead.length === 0) {
    wrap.innerHTML = `<p class="crm-resurrection-empty"><i class="ph ph-confetti"></i> Nenhum cliente inativo há mais de 1 ano. Continue assim!</p>`;
    return;
  }

  wrap.innerHTML = dead.map(c => {
    const diasInativos = Math.floor((now - c.lastPurchaseDate.getTime()) / 86400000);
    const phone        = (c.phone || '').replace(/\D/g, '');
    const waMsgTxt     = encodeURIComponent(
      `Olá, ${c.name.split(' ')[0]}! Tudo bem? 😊 Sentimos sua falta. Que tal passarmos um café e ver como podemos te ajudar novamente?`
    );
    const waUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${waMsgTxt}`;

    return `
      <div class="crm-resurrection-row">
        <div class="crm-resurrection-info">
          <div class="crm-resurrection-name">${_esc ? _esc(c.name) : c.name}</div>
          <div class="crm-resurrection-meta">${c.company !== '—' ? ((_esc ? _esc(c.company) : c.company) + ' · ') : ''}${diasInativos} dias inativo</div>
        </div>
        <a class="crm-btn-wa" href="${waUrl}" target="_blank" rel="noopener" title="Disparar WhatsApp de Ressurreição">
          <i class="ph ph-whatsapp-logo"></i> WhatsApp
        </a>
      </div>
    `;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════
   VINCULAÇÃO DE AGENDAMENTO → CLIENTE
   ═══════════════════════════════════════════════════════════════ */

/**
 * Ao criar um agendamento: verifica se o telefone já existe em customers.
 * - Se sim: retorna o customerId existente e registra interação.
 * - Se não: cria o cliente com origin 'site_agendamento' e retorna o novo id.
 *
 * Retorna Promise<string> com o customerId.
 */
function crmCheckInForAppointment(uid, clientName, phone, adminUid) {
  if (!uid || !phone) return Promise.resolve(null);
  const normPhone = normalizePhone(phone);

  return crmFindByPhone(uid, normPhone).then(existing => {
    if (existing) {
      /* Vincula ao existente: registra interação */
      return db.collection('users').doc(uid).collection('customers')
        .doc(existing.id)
        .update({
          lastInteraction: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy:       adminUid || uid,
          updatedAt:       firebase.firestore.FieldValue.serverTimestamp(),
        })
        .then(() => existing.id);
    }

    /* Cria novo cliente via agendamento */
    return crmCreateOrLink(uid, {
      name:    clientName,
      phone:   phone,
      origin:  'site_agendamento',
    }, adminUid).then(result => result.id);
  });
}

/* ═══════════════════════════════════════════════════════════════
   MIGRAÇÃO: disparo_contacts → customers
   ═══════════════════════════════════════════════════════════════ */

/**
 * Utilitário de migração: converte todos os documentos de
 * disparo_contacts para a coleção customers (com dedup por telefone).
 * Histórico de estágio é migrado para a subcoleção history.
 * Deve ser chamado uma única vez por tenant.
 */
function crmMigrateFromDisparo(uid, adminUid) {
  if (!uid) { alert('Usuário não autenticado.'); return; }
  if (!confirm(
    'Migrar contatos de disparo_contacts → customers?\n\n' +
    'Isso importará todos os contatos existentes para a nova estrutura de CRM.\n' +
    'Duplicatas (mesmo telefone) serão ignoradas.\n\n' +
    'A coleção disparo_contacts NÃO será apagada — ela servirá como backup.'
  )) return;

  const toast = msg => { if (typeof disparoShowToast === 'function') disparoShowToast(msg); };
  toast('Migração iniciada…');

  db.collection('users').doc(uid).collection('disparo_contacts')
    .orderBy('createdAt', 'asc')
    .get()
    .then(async snap => {
      if (snap.empty) { alert('Nenhum contato encontrado para migrar.'); return; }

      let created = 0, skipped = 0;
      const total = snap.docs.length;

      for (const doc of snap.docs) {
        const d = doc.data();
        const data = {
          name:         d.name        || '',
          company:      d.company     || '—',
          segment:      d.segment     || '—',
          group:        d.group       || '—',
          phone:        d.phone       || '',
          email:        d.email       || '',
          status:       d.status      || 'pending',
          stage:        d.stage       || 'novo',
          notes:        d.notes       || '',
          tags:         d.tags        || [],
          followUpDate: d.followUpDate || null,
          messages:     d.messages    || [],
          origin:       d.origin      || 'manual',
          totalSpent:   d.totalSpent  || 0,
        };

        let result;
        try {
          result = await crmCreateOrLink(uid, data, adminUid);
        } catch (e) {
          console.error('[CRM] Erro migrando', doc.id, e);
          continue;
        }

        if (result.duplicate) {
          skipped++;
        } else {
          created++;
          /* Migra histórico de estágio para a subcoleção */
          const histArr = d.history || [];
          for (const h of histArr) {
            try {
              await db.collection('users').doc(uid)
                .collection('customers').doc(result.id)
                .collection('history').add({
                  date:        h.date ? new Date(h.date) : firebase.firestore.FieldValue.serverTimestamp(),
                  oldStage:    h.oldStage    || '',
                  targetStage: h.targetStage || '',
                  note:        h.note        || '',
                  adminUid:    adminUid      || uid,
                });
            } catch (e) { /* ignora erros de histórico individual */ }
          }
        }
      }

      alert(
        `Migração concluída!\n` +
        `✅ Criados: ${created}\n` +
        `⏭ Ignorados (duplicata): ${skipped}\n` +
        `📦 Total processado: ${total}`
      );
      crmLoadCustomers(uid);
    })
    .catch(err => {
      console.error('[CRM] Erro na migração:', err);
      alert('Erro ao migrar. Veja o console para detalhes.');
    });
}

/* ═══════════════════════════════════════════════════════════════
   BASE DE CLIENTES — Promoção e Gestão
   ═══════════════════════════════════════════════════════════════ */

/**
 * Promove um lead/contato para Cliente confirmado.
 * Pode ser chamado via CRM (manual) ou Agendamento (automático).
 * opts.via = 'crm' | 'appointment'
 * opts.note = string extra para o histórico
 */
function promoverParaCliente(uid, customerId, adminUid, opts) {
  if (!uid || !customerId) return Promise.resolve();
  opts = opts || {};

  const patch = {
    isClient:    true,
    clientSince: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy:   adminUid || uid,
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (opts.via === 'crm') patch.stage = 'fechado';

  return db.collection('users').doc(uid).collection('customers').doc(customerId)
    .update(patch)
    .then(() => {
      /* Atualiza memória local */
      const c = (typeof disparoContacts !== 'undefined' ? disparoContacts : [])
        .find(x => x.id === customerId);
      if (c) {
        c.isClient    = true;
        c.clientSince = new Date();
        if (opts.via === 'crm') c.stage = 'fechado';
      }

      const via  = opts.via === 'crm' ? 'via CRM (manual)' : 'via Agendamento Concluído';
      const note = opts.note
        ? `${opts.note}\n${via}`
        : via;

      return crmWriteHistory(uid, customerId, {
        type: 'promoted_to_client',
        note,
      }, adminUid || uid);
    })
    .catch(err => console.error('[CRM] promoverParaCliente erro:', err));
}

/* ─── Helpers de frequência e aniversário ────────────────────── */

/**
 * Retorna badge de frequência baseado em purchaseCount e clientSince.
 * { label, cls }
 */
function _calcFrequencia(c) {
  const count = c.purchaseCount || 0;
  const since = c.clientSince instanceof Date ? c.clientSince : null;
  if (!since || count < 2) return { label: 'Novo', cls: 'freq--new' };

  const daysSince = (Date.now() - since.getTime()) / 86400000;
  const avgDays   = daysSince / count;

  if (avgDays <= 35)  return { label: 'Mensal',      cls: 'freq--monthly' };
  if (avgDays <= 100) return { label: 'Trimestral',  cls: 'freq--quarterly' };
  if (avgDays <= 200) return { label: 'Semestral',   cls: 'freq--biannual' };
  return               { label: 'Anual',             cls: 'freq--annual' };
}

/** Retorna true se hoje é o aniversário do cliente. */
function _isBirthdayToday(birthday) {
  if (!birthday || !(birthday instanceof Date)) return false;
  const today = new Date();
  return birthday.getDate() === today.getDate() &&
         birthday.getMonth() === today.getMonth();
}

/** Retorna true se o aniversário é este mês (mas não hoje). */
function _isBirthdayMonth(c) {
  if (!c.birthdayMonth) return false;
  return c.birthdayMonth === new Date().getMonth() + 1;
}

/** Formata data para exibição relativa: "3 dias atrás", "hoje", etc. */
function _fmtRelDate(date) {
  if (!date || !(date instanceof Date)) return '—';
  const diff = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diff === 0)  return 'Hoje';
  if (diff === 1)  return 'Ontem';
  if (diff < 30)   return `${diff}d atrás`;
  if (diff < 365)  return `${Math.floor(diff / 30)}m atrás`;
  return `${Math.floor(diff / 365)}a atrás`;
}

/* ─── Renderização da Tabela de Clientes ─────────────────────── */

/* 'all' | 'active' | 'birthdays' | 'active_30' | 'risk' | 'asleep' | 'dead' */
let _clientesFilter = 'all';

const _CLIENTES_FILTER_LABELS = {
  all:       'Todos',
  active:    'Ativos (90d)',
  birthdays: 'Aniversariantes',
  active_30: 'Ativos (30d)',
  risk:      'Em Risco (30–90d)',
  asleep:    'Adormecidos (3–12m)',
  dead:      'Inativos (+1 ano)',
};

let _clientesSort = 'last_visit'; /* 'last_visit' | 'name_az' | 'name_za' | 'spent_desc' | 'freq' */

function clientesSetFilter(filter, el) {
  _clientesFilter = filter;
  /* Atualiza chips */
  document.querySelectorAll('#tool-clientes .clientes-chip').forEach(p => {
    p.classList.remove('clientes-chip--active');
  });
  if (el) el.classList.add('clientes-chip--active');
  clientesRenderTable();
}

function clientesSetSort(sort) {
  _clientesSort = sort;
  clientesRenderTable();
}

/* Navega para a seção Clientes e aplica filtro — chamado pelos cards de insight */
function clientesGoToFilter(filter) {
  _clientesFilter = filter;

  const navEl = document.querySelector('.nav-item[data-tool="clientes"]');
  if (typeof loadTool === 'function') loadTool('clientes', navEl);

  /* Sincroniza chip ativo */
  document.querySelectorAll('#tool-clientes .clientes-chip').forEach(p => {
    const active = p.dataset.filter === filter;
    p.classList.toggle('clientes-chip--active', active);
  });

  clientesRenderTable();
}

function clientesRenderTable() {
  const wrap = document.getElementById('clientes-table-wrap');
  if (!wrap) return;

  const all = (typeof disparoContacts !== 'undefined' ? disparoContacts : [])
    .filter(c => c.isClient === true);

  /* Aplica filtro ativo */
  const now = Date.now();
  const day = 86400000;
  let list = all;
  if (_clientesFilter === 'active') {
    list = all.filter(c => c.lastPurchaseDate && (now - c.lastPurchaseDate.getTime()) < 90 * day);
  } else if (_clientesFilter === 'active_30') {
    list = all.filter(c => c.lastPurchaseDate && (now - c.lastPurchaseDate.getTime()) < 30 * day);
  } else if (_clientesFilter === 'risk') {
    list = all.filter(c => c.lastPurchaseDate &&
      (now - c.lastPurchaseDate.getTime()) >= 30 * day &&
      (now - c.lastPurchaseDate.getTime()) <  90 * day);
  } else if (_clientesFilter === 'asleep') {
    list = all.filter(c => c.lastPurchaseDate &&
      (now - c.lastPurchaseDate.getTime()) >= 90 * day &&
      (now - c.lastPurchaseDate.getTime()) <  365 * day);
  } else if (_clientesFilter === 'dead') {
    list = all.filter(c => c.lastPurchaseDate &&
      (now - c.lastPurchaseDate.getTime()) >= 365 * day);
  } else if (_clientesFilter === 'birthdays') {
    list = all.filter(c => _isBirthdayMonth(c));
  }

  /* Atualiza contadores nos chips */
  const _cnt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || ''; };
  _cnt('clientes-count-all',     all.length);
  _cnt('clientes-count-active30',all.filter(c => c.lastPurchaseDate && (now - c.lastPurchaseDate.getTime()) < 30 * day).length);
  _cnt('clientes-count-active',  all.filter(c => c.lastPurchaseDate && (now - c.lastPurchaseDate.getTime()) < 90 * day).length);
  _cnt('clientes-count-risk',    all.filter(c => c.lastPurchaseDate && (now - c.lastPurchaseDate.getTime()) >= 30*day && (now - c.lastPurchaseDate.getTime()) < 90*day).length);
  _cnt('clientes-count-asleep',  all.filter(c => c.lastPurchaseDate && (now - c.lastPurchaseDate.getTime()) >= 90*day && (now - c.lastPurchaseDate.getTime()) < 365*day).length);
  _cnt('clientes-count-dead',    all.filter(c => c.lastPurchaseDate && (now - c.lastPurchaseDate.getTime()) >= 365*day).length);
  _cnt('clientes-count-bday',    all.filter(c => _isBirthdayMonth(c)).length);

  if (list.length === 0) {
    wrap.innerHTML = `
      <div class="clientes-empty">
        <i class="ph ph-users-three"></i>
        <p>${_clientesFilter === 'all'
          ? 'Nenhum cliente ainda. Mova um lead para <strong>Fechado</strong> no CRM ou conclua um agendamento.'
          : 'Nenhum cliente neste filtro.'}</p>
      </div>`;
    return;
  }

  /* Ordena conforme seleção do usuário */
  const _freqOrder = { 'Mensal': 0, 'Trimestral': 1, 'Semestral': 2, 'Anual': 3, 'Novo': 4 };
  list.sort((a, b) => {
    /* Aniversariantes de hoje sempre sobem (independente do sort) */
    const aToday = _isBirthdayToday(a.birthday) ? -1 : 0;
    const bToday = _isBirthdayToday(b.birthday) ? -1 : 0;
    if (aToday !== bToday) return aToday - bToday;

    switch (_clientesSort) {
      case 'name_az':
        return (a.name || '').localeCompare(b.name || '', 'pt-BR');
      case 'name_za':
        return (b.name || '').localeCompare(a.name || '', 'pt-BR');
      case 'spent_desc':
        return (b.totalSpent || 0) - (a.totalSpent || 0);
      case 'freq': {
        const fa = _freqOrder[_calcFrequencia(a).label] ?? 4;
        const fb = _freqOrder[_calcFrequencia(b).label] ?? 4;
        return fa - fb;
      }
      default: /* last_visit */
        return (b.lastPurchaseDate ? b.lastPurchaseDate.getTime() : 0) -
               (a.lastPurchaseDate ? a.lastPurchaseDate.getTime() : 0);
    }
  });

  wrap.innerHTML = `
    <table class="clientes-table">
      <thead>
        <tr>
          <th>Cliente</th>
          <th>Telefone</th>
          <th>Última Visita</th>
          <th>Frequência</th>
          <th>Plano</th>
          <th class="clientes-th-center">Aniv.</th>
          <th class="clientes-th-center">Ações</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(c => _clientesRow(c)).join('')}
      </tbody>
    </table>`;
}

function _planCell(c) {
  const sub = c.subscription;
  const now = new Date();

  /* Sem plano ou cancelado */
  if (!sub || sub.status === 'canceled') {
    return `<button class="plan-add-btn" onclick="planOpenModal('${c.id}')" title="Criar plano">
              <i class="ph ph-plus"></i> Plano
            </button>`;
  }

  /* Verifica expiração local */
  const isExpired = (sub.expiresAt instanceof Date && sub.expiresAt < now) || sub.status === 'expired';
  const daysLeft  = sub.expiresAt instanceof Date
    ? Math.ceil((sub.expiresAt.getTime() - now.getTime()) / 86400000)
    : null;
  const isExpiringSoon = !isExpired && daysLeft !== null && daysLeft <= 7;

  const used  = sub.usedCredits  || 0;
  const total = sub.totalCredits || 1;
  const pct   = Math.min(100, Math.round((used / total) * 100));
  const full  = used >= total;
  const esc   = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const statusLabel = isExpired        ? 'Expirado'
                    : sub.status === 'overdue'   ? 'Atrasado'
                    : sub.status === 'canceled'  ? 'Cancelado'
                    : 'Ativo';
  const statusCls   = isExpired        ? 'plan-status--expired'
                    : sub.status === 'overdue'   ? 'plan-status--overdue'
                    : sub.status === 'canceled'  ? 'plan-status--canceled'
                    : 'plan-status--active';

  const expiryHint = isExpired
    ? `<span class="plan-expiry plan-expiry--expired"><i class="ph ph-warning"></i> Expirado</span>`
    : isExpiringSoon
    ? `<span class="plan-expiry plan-expiry--soon"><i class="ph ph-clock"></i> ${daysLeft}d</span>`
    : daysLeft !== null
    ? `<span class="plan-expiry">Expira ${sub.expiresAt.toLocaleDateString('pt-BR')}</span>`
    : '';

  const canUse = !full && !isExpired && sub.status === 'active';

  return `
    <div class="plan-cell ${isExpired ? 'plan-cell--expired' : isExpiringSoon ? 'plan-cell--expiring' : ''}">
      <div class="plan-cell-top">
        <span class="plan-name-lbl">${esc(sub.planName)}</span>
        <span class="plan-status ${statusCls}">${statusLabel}</span>
      </div>
      <div class="plan-progress-wrap" title="${used}/${total} créditos usados">
        <div class="plan-progress-bar">
          <div class="plan-progress-fill ${full ? 'plan-progress-fill--full' : ''}" style="width:${pct}%"></div>
        </div>
        <span class="plan-progress-lbl">${used}/${total}</span>
      </div>
      ${expiryHint}
      <div class="plan-cell-actions">
        ${isExpired
          ? `<button class="plan-action-btn plan-action-btn--renew" onclick="planResetCycleUI('${c.id}')" title="Renovar plano">
               <i class="ph ph-arrows-clockwise"></i> Renovar
             </button>`
          : `<button class="plan-action-btn plan-action-btn--use ${!canUse ? 'plan-action-btn--disabled' : ''}"
               onclick="planUseCreditUI('${c.id}')" title="Usar 1 crédito" ${!canUse ? 'disabled' : ''}>
               <i class="ph ph-minus-circle"></i> Usar
             </button>`
        }
        <button class="plan-action-btn" onclick="planOpenModal('${c.id}')" title="Editar plano">
          <i class="ph ph-pencil-simple"></i>
        </button>
      </div>
    </div>`;
}

function _clientesRow(c) {
  const freq    = _calcFrequencia(c);
  const isToday = _isBirthdayToday(c.birthday);
  const isMonth = _isBirthdayMonth(c);

  const bdayIcon = isToday
    ? `<span class="clientes-bday clientes-bday--today" title="Aniversário HOJE!"><i class="ph ph-cake"></i></span>`
    : isMonth
    ? `<span class="clientes-bday clientes-bday--month" title="Aniversário este mês"><i class="ph ph-gift"></i></span>`
    : `<span class="clientes-bday--none">—</span>`;

  const phone     = (c.phone || '').replace(/\D/g, '');
  const lastVisit = c.lastPurchaseDate
    ? `<span class="clientes-date-main">${_fmtRelDate(c.lastPurchaseDate)}</span>
       <span class="clientes-date-sub">${c.lastPurchaseDate.toLocaleDateString('pt-BR')}</span>`
    : '<span class="clientes-muted">Sem registro</span>';

  const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  return `
    <tr class="${isToday ? 'clientes-row--bday' : ''}">
      <td>
        <div class="clientes-name">${esc(c.name)}</div>
        ${c.company && c.company !== '—' ? `<div class="clientes-company">${esc(c.company)}</div>` : ''}
      </td>
      <td>
        ${phone
          ? `<a class="clientes-phone" href="https://wa.me/${phone}" target="_blank" rel="noopener">
               <i class="ph ph-whatsapp-logo"></i> ${esc(c.phone)}
             </a>`
          : '<span class="clientes-muted">—</span>'}
      </td>
      <td><div class="clientes-date-wrap">${lastVisit}</div></td>
      <td><span class="clientes-freq ${freq.cls}">${freq.label}</span></td>
      <td>${_planCell(c)}</td>
      <td class="clientes-td-center">${bdayIcon}</td>
      <td class="clientes-td-center">
        <div class="clientes-actions">
          ${phone
            ? `<a class="clientes-action-btn clientes-action-btn--wa" href="https://wa.me/${phone}" target="_blank" rel="noopener" title="WhatsApp">
                 <i class="ph ph-whatsapp-logo"></i>
               </a>`
            : ''}
          <button class="clientes-action-btn" onclick="crmOpenHistoryModal('${c.id}')" title="Ver Perfil">
            <i class="ph ph-clock-counter-clockwise"></i>
          </button>
        </div>
      </td>
    </tr>`;
}

/* ═══════════════════════════════════════════════════════════════
   MÓDULO DE RECORRÊNCIA E PLANOS
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   CATÁLOGO DE TEMPLATES DE PLANOS
   ═══════════════════════════════════════════════════════════════ */

let _planTemplatesCache = [];

/**
 * Carrega templates de planos do Firestore e popula o cache global.
 */
function planTemplatesLoad(uid) {
  if (!uid) return Promise.resolve([]);
  return db.collection('users').doc(uid).collection('planTemplates')
    .orderBy('name', 'asc')
    .get()
    .then(snap => {
      _planTemplatesCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return _planTemplatesCache;
    })
    .catch(err => {
      console.error('[Plan] planTemplatesLoad erro:', err);
      return [];
    });
}

/**
 * Cria ou atualiza um template de plano.
 * templateId = null → cria novo; templateId = string → atualiza existente.
 */
function planTemplateSave(uid, templateId, data, adminUid) {
  if (!uid) return Promise.reject('uid obrigatório');
  const payload = {
    name:         data.name                  || '',
    credits:      Number(data.credits)       || 1,
    price:        Number(data.price)         || 0,
    durationDays: Number(data.durationDays)  || 30,
    updatedBy:    adminUid                   || uid,
    updatedAt:    firebase.firestore.FieldValue.serverTimestamp(),
  };
  const col = db.collection('users').doc(uid).collection('planTemplates');
  if (templateId) {
    return col.doc(templateId).update(payload).then(() => {
      const idx = _planTemplatesCache.findIndex(t => t.id === templateId);
      if (idx > -1) _planTemplatesCache[idx] = { ..._planTemplatesCache[idx], ...payload };
      return templateId;
    });
  }
  payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  return col.add(payload).then(ref => {
    _planTemplatesCache.push({ id: ref.id, ...payload });
    _planTemplatesCache.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
    return ref.id;
  });
}

/**
 * Remove um template de plano.
 */
function planTemplateDelete(uid, templateId) {
  if (!uid || !templateId) return Promise.resolve();
  return db.collection('users').doc(uid).collection('planTemplates')
    .doc(templateId)
    .delete()
    .then(() => {
      _planTemplatesCache = _planTemplatesCache.filter(t => t.id !== templateId);
    });
}

/**
 * Grava registro de cobrança na subcoleção billingHistory (separado do history geral).
 */
function _billingWriteRecord(uid, customerId, type, sub, adminUid) {
  if (!uid || !customerId) return Promise.resolve();
  return db.collection('users').doc(uid)
    .collection('customers').doc(customerId)
    .collection('billingHistory')
    .add({
      type,
      planId:     sub.planId      || '',
      planName:   sub.planName    || '',
      price:      sub.price       || 0,
      credits:    sub.totalCredits || 0,
      cycleStart: sub.startDate instanceof Date
                    ? firebase.firestore.Timestamp.fromDate(sub.startDate) : null,
      cycleEnd:   sub.expiresAt instanceof Date
                    ? firebase.firestore.Timestamp.fromDate(sub.expiresAt) : null,
      recordedBy: adminUid || uid,
      recordedAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .catch(err => console.error('[Plan] _billingWriteRecord erro:', err));
}

/* ═══════════════════════════════════════════════════════════════
   MÓDULO DE RECORRÊNCIA E PLANOS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Salva ou atualiza o plano de assinatura de um cliente.
 * isNewAcquisition = true → novo plano: reseta créditos, define startDate/expiresAt e registra venda.
 * planData deve conter: planId, planName, totalCredits, price, durationDays, startDate (opcional).
 */
function planSave(uid, customerId, planData, adminUid, isNewAcquisition) {
  if (!uid || !customerId) return Promise.reject('ids ausentes');

  const duration   = Number(planData.durationDays) || 30;
  const startDate  = planData.startDate instanceof Date ? planData.startDate : new Date();
  const expiresAt  = new Date(startDate.getTime() + duration * 86400000);

  const sub = {
    planId:          planData.planId          || '',
    planName:        planData.planName        || '',
    totalCredits:    Number(planData.totalCredits) || 0,
    usedCredits:     isNewAcquisition ? 0 : 0,
    price:           Number(planData.price)        || 0,
    durationDays:    duration,
    status:          'active',
    startDate:       firebase.firestore.Timestamp.fromDate(startDate),
    expiresAt:       firebase.firestore.Timestamp.fromDate(expiresAt),
    nextBillingDate: firebase.firestore.Timestamp.fromDate(expiresAt),
  };

  const patch = {
    subscription: sub,
    updatedBy:    adminUid || uid,
    updatedAt:    firebase.firestore.FieldValue.serverTimestamp(),
  };

  /* Registra venda quando novo plano é adquirido */
  const price = Number(planData.price) || 0;
  if (isNewAcquisition && price > 0) {
    const c0 = (typeof disparoContacts !== 'undefined' ? disparoContacts : []).find(x => x.id === customerId);
    patch.totalSpent       = ((c0 && c0.totalSpent)    || 0) + price;
    patch.purchaseCount    = ((c0 && c0.purchaseCount) || 0) + 1;
    patch.lastPurchaseDate = firebase.firestore.Timestamp.fromDate(startDate);
  }

  return db.collection('users').doc(uid).collection('customers').doc(customerId)
    .update(patch)
    .then(() => {
      const c = (typeof disparoContacts !== 'undefined' ? disparoContacts : []).find(x => x.id === customerId);
      if (c) {
        c.subscription = {
          planId:          sub.planId,
          planName:        sub.planName,
          totalCredits:    sub.totalCredits,
          usedCredits:     0,
          price:           sub.price,
          durationDays:    duration,
          status:          'active',
          startDate,
          expiresAt,
          nextBillingDate: expiresAt,
        };
        if (isNewAcquisition && price > 0) {
          c.totalSpent    = (c.totalSpent    || 0) + price;
          c.purchaseCount = (c.purchaseCount || 0) + 1;
          c.lastPurchaseDate = startDate;
        }
      }

      const histNote = isNewAcquisition
        ? `Novo plano: ${sub.planName} | ${sub.totalCredits} créditos | R$ ${price} | ${startDate.toLocaleDateString('pt-BR')} → ${expiresAt.toLocaleDateString('pt-BR')}`
        : `Plano atualizado: ${sub.planName} | ${sub.totalCredits} créditos | R$ ${price}`;

      return Promise.all([
        crmWriteHistory(uid, customerId, { type: 'plan_updated', note: histNote }, adminUid || uid),
        isNewAcquisition
          ? _billingWriteRecord(uid, customerId, 'new_plan',
              { planId: sub.planId, planName: sub.planName, price, totalCredits: sub.totalCredits, startDate, expiresAt },
              adminUid || uid)
          : Promise.resolve(),
      ]);
    });
}

/**
 * Cancela o plano de assinatura.
 */
function planCancel(uid, customerId, adminUid) {
  return db.collection('users').doc(uid).collection('customers').doc(customerId)
    .update({
      'subscription.status': 'canceled',
      updatedBy: adminUid || uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .then(() => {
      const c = (typeof disparoContacts !== 'undefined' ? disparoContacts : [])
        .find(x => x.id === customerId);
      if (c && c.subscription) c.subscription.status = 'canceled';

      return crmWriteHistory(uid, customerId, { type: 'plan_canceled', note: 'Plano cancelado.' }, adminUid || uid);
    });
}

/**
 * Usa 1 crédito do plano. Retorna Promise<{ok, remaining, limitReached}>.
 */
function useCredit(uid, customerId, adminUid) {
  const c = (typeof disparoContacts !== 'undefined' ? disparoContacts : [])
    .find(x => x.id === customerId);
  if (!c || !c.subscription) return Promise.reject('sem plano');

  const sub  = c.subscription;
  if (sub.status !== 'active') return Promise.reject('plano inativo');

  const used  = sub.usedCredits  || 0;
  const total = sub.totalCredits || 0;
  if (used >= total) return Promise.resolve({ ok: false, remaining: 0, limitReached: true });

  const newUsed     = used + 1;
  const remaining   = total - newUsed;
  const limitReached = newUsed >= total;

  return db.collection('users').doc(uid).collection('customers').doc(customerId)
    .update({
      'subscription.usedCredits': newUsed,
      updatedBy: adminUid || uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .then(() => {
      /* Atualiza memória */
      sub.usedCredits = newUsed;
      if (typeof clientesRenderTable === 'function') clientesRenderTable();

      crmWriteHistory(uid, customerId, {
        type: 'credit_used',
        note: `Crédito usado: ${newUsed}/${total} | Restam ${remaining}`,
      }, adminUid || uid);

      return { ok: true, remaining, limitReached };
    });
}

/**
 * Reseta o ciclo: usedCredits → 0 e avança nextBillingDate +30 dias.
 */
/**
 * Renova o plano: reseta créditos, avança expiresAt conforme durationDays e registra venda.
 */
function planResetCycle(uid, customerId, adminUid) {
  const c = (typeof disparoContacts !== 'undefined' ? disparoContacts : [])
    .find(x => x.id === customerId);
  if (!c || !c.subscription) return Promise.reject('sem plano');

  const sub      = c.subscription;
  const now      = new Date();
  const duration = sub.durationDays || 30;
  const nextDate = new Date(now.getTime() + duration * 86400000);
  const price    = sub.price || 0;

  const patch = {
    'subscription.usedCredits':     0,
    'subscription.status':          'active',
    'subscription.startDate':       firebase.firestore.Timestamp.fromDate(now),
    'subscription.expiresAt':       firebase.firestore.Timestamp.fromDate(nextDate),
    'subscription.nextBillingDate': firebase.firestore.Timestamp.fromDate(nextDate),
    updatedBy: adminUid || uid,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  if (price > 0) {
    patch.totalSpent       = (c.totalSpent    || 0) + price;
    patch.purchaseCount    = (c.purchaseCount || 0) + 1;
    patch.lastPurchaseDate = firebase.firestore.Timestamp.fromDate(now);
  }

  return db.collection('users').doc(uid).collection('customers').doc(customerId)
    .update(patch)
    .then(() => {
      sub.usedCredits     = 0;
      sub.status          = 'active';
      sub.startDate       = now;
      sub.expiresAt       = nextDate;
      sub.nextBillingDate = nextDate;
      if (price > 0) {
        c.totalSpent    = (c.totalSpent    || 0) + price;
        c.purchaseCount = (c.purchaseCount || 0) + 1;
        c.lastPurchaseDate = now;
      }
      if (typeof clientesRenderTable       === 'function') clientesRenderTable();
      if (typeof planRenderBillingDashboard === 'function') planRenderBillingDashboard();

      return Promise.all([
        crmWriteHistory(uid, customerId, {
          type: 'cycle_reset',
          note: `Renovado: ${sub.planName} | ${now.toLocaleDateString('pt-BR')} → ${nextDate.toLocaleDateString('pt-BR')} | R$ ${price}`,
        }, adminUid || uid),
        _billingWriteRecord(uid, customerId, 'renewal',
          { planId: sub.planId || '', planName: sub.planName, price, totalCredits: sub.totalCredits, startDate: now, expiresAt: nextDate },
          adminUid || uid),
      ]);
    });
}

/**
 * Retorna clientes com nextBillingDate nos próximos {daysAhead} dias.
 */
function planGetNearBilling(daysAhead) {
  daysAhead = daysAhead || 5;
  const now    = Date.now();
  const limit  = now + daysAhead * 86400000;
  return (typeof disparoContacts !== 'undefined' ? disparoContacts : [])
    .filter(c => {
      const sub = c.subscription;
      if (!sub || sub.status === 'canceled' || sub.status === 'expired') return false;
      const bd = sub.nextBillingDate;
      if (!(bd instanceof Date)) return false;
      return bd.getTime() >= now && bd.getTime() <= limit;
    })
    .sort((a, b) => a.subscription.nextBillingDate - b.subscription.nextBillingDate);
}

/**
 * Retorna clientes cujo plano expira nos próximos {daysAhead} dias (ou já expirou).
 */
function planGetExpiringSoon(daysAhead) {
  daysAhead = daysAhead || 7;
  const now   = Date.now();
  const limit = now + daysAhead * 86400000;
  return (typeof disparoContacts !== 'undefined' ? disparoContacts : [])
    .filter(c => {
      const sub = c.subscription;
      if (!sub || sub.status === 'canceled') return false;
      const exp = sub.expiresAt;
      if (!(exp instanceof Date)) return false;
      return exp.getTime() <= limit;
    })
    .sort((a, b) => a.subscription.expiresAt - b.subscription.expiresAt);
}

/**
 * Verifica planos expirados: atualiza status em memória e persiste no Firestore.
 */
function planCheckExpiredLocally() {
  const now = new Date();
  const uid = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.uid : null;
  (typeof disparoContacts !== 'undefined' ? disparoContacts : []).forEach(c => {
    const sub = c.subscription;
    if (!sub || sub.status === 'canceled' || sub.status === 'expired') return;
    if (sub.expiresAt instanceof Date && sub.expiresAt < now) {
      sub.status = 'expired';
      if (uid) {
        db.collection('users').doc(uid).collection('customers').doc(c.id)
          .update({
            'subscription.status': 'expired',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          })
          .catch(() => {});
      }
    }
  });
}

/**
 * Renderiza o dashboard de cobranças próximas em #plan-billing-dashboard.
 */
function planRenderBillingDashboard() {
  const wrap = document.getElementById('plan-billing-dashboard');
  if (!wrap) return;

  const near = planGetNearBilling(5);
  if (near.length === 0) { wrap.hidden = true; return; }

  const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const fmtBRL = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  wrap.hidden = false;
  wrap.innerHTML = `
    <div class="billing-dash-header">
      <i class="ph ph-bell-ringing"></i>
      <span>Cobranças nos próximos 5 dias</span>
      <span class="billing-dash-count">${near.length}</span>
    </div>
    <div class="billing-dash-list">
      ${near.map(c => {
        const sub  = c.subscription;
        const date = sub.nextBillingDate.toLocaleDateString('pt-BR');
        const diff = Math.ceil((sub.nextBillingDate.getTime() - Date.now()) / 86400000);
        const diffLbl = diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : `Em ${diff} dias`;
        return `
          <div class="billing-dash-card">
            <div class="billing-dash-info">
              <span class="billing-dash-name">${esc(c.name)}</span>
              <span class="billing-dash-plan">${esc(sub.planName)} · ${fmtBRL(sub.price)}</span>
            </div>
            <div class="billing-dash-right">
              <span class="billing-dash-date ${diff === 0 ? 'billing-dash-date--today' : ''}">${diffLbl} (${date})</span>
              <button class="billing-dash-btn" onclick="planResetCycleUI('${c.id}')" title="Confirmar pagamento e resetar ciclo">
                <i class="ph ph-check-circle"></i> Confirmar
              </button>
            </div>
          </div>`;
      }).join('')}
    </div>`;

  /* Seção de planos expirando */
  const expiring = planGetExpiringSoon(7);
  if (expiring.length > 0) {
    const esc2 = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const fmtBRL2 = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    wrap.innerHTML += `
      <div class="billing-dash-section-title" style="margin-top:14px;">
        <i class="ph ph-clock"></i> Planos expirando em 7 dias
        <span class="billing-dash-count">${expiring.length}</span>
      </div>
      <div class="billing-dash-list">
        ${expiring.map(c => {
          const sub  = c.subscription;
          const exp  = sub.expiresAt;
          const now2 = new Date();
          const isExpired = exp < now2;
          const diff = Math.ceil((exp.getTime() - now2.getTime()) / 86400000);
          const diffLbl = isExpired ? 'Expirado' : diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : `Em ${diff}d`;
          return `
            <div class="billing-dash-card ${isExpired ? 'billing-dash-card--expired' : 'billing-dash-card--expiring'}">
              <div class="billing-dash-info">
                <span class="billing-dash-name">${esc2(c.name)}</span>
                <span class="billing-dash-plan">${esc2(sub.planName)} · ${fmtBRL2(sub.price)}</span>
              </div>
              <div class="billing-dash-right">
                <span class="billing-dash-date ${isExpired ? 'billing-dash-date--today' : ''}">${diffLbl} (${exp.toLocaleDateString('pt-BR')})</span>
                <button class="billing-dash-btn" onclick="planResetCycleUI('${c.id}')" title="Renovar plano">
                  <i class="ph ph-arrows-clockwise"></i> Renovar
                </button>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }
}
