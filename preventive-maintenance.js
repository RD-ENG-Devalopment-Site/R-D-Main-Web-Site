(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const labels = { PLANNING: 'กำลังวางแผน', DUE: 'ถึงกำหนด', WAITING_PARTS: 'รออะไหล่', READY: 'พร้อมดำเนินการ', IN_PROGRESS: 'กำลังดำเนินการ', PENDING_INSPECTION: 'รอตรวจรับ', REWORK: 'ต้องแก้ไข', CLOSED: 'ปิดงาน', POSTPONED: 'เลื่อนงาน', CANCELLED: 'ยกเลิก' };
  const units = { DAY: 'วัน', WEEK: 'สัปดาห์', MONTH: 'เดือน', YEAR: 'ปี' };
  const state = { actor: {}, plans: [], orders: [], machines: [], technicians: [], view: 'all', focus: '', ready: false, initialized: false, selection: new Set(), editor: null, setup: null };
  const terminal = (order) => ['CLOSED', 'CANCELLED'].includes(order.status);
  const canPlan = () => ['Admin', 'Engineer'].includes(state.actor.role);
  const key = (plan) => plan.machineId || `unmapped:${[plan.machineName, plan.location || plan.zone].map((value) => String(value || '').trim().toLocaleLowerCase('th')).join('|')}`;
  const interval = (plan) => plan.intervalValue && units[String(plan.intervalUnit).toUpperCase()] ? `${plan.intervalValue} ${units[String(plan.intervalUnit).toUpperCase()]}` : plan.interval || 'ยังไม่ระบุรอบ';
  const actorId = () => state.actor.userId || state.actor.user_id || state.actor.id || '';
  const dateKey = (value) => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  };
  const today = () => dateKey(new Date().toISOString());
  const displayDate = (value, time = false) => {
    if (!value) return 'ยังไม่กำหนด';
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+07:00` : value);
    return Number.isNaN(date.getTime()) ? 'วันที่ไม่ถูกต้อง' : new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', ...(time ? { timeStyle: 'short' } : {}) }).format(date);
  };
  function dueText(value) {
    const day = dateKey(value);
    if (!day) return 'ยังไม่กำหนดวันเริ่มรอบ';
    return `${displayDate(day)}${day < today() ? ' · เกินกำหนด' : day === today() ? ' · ถึงกำหนดวันนี้' : ''}`;
  }
  function machineFor(item) { return state.machines.find((machine) => machine.machineId === item.machineId) || {}; }
  function zone(item) { return item.zone || machineFor(item).zone || ''; }
  function userName(id) { const user = state.technicians.find((entry) => entry.userId === id); return user ? user.displayName || user.username : id || 'ยังไม่มอบหมาย'; }
  function mine(order) { return Boolean(actorId()) && [order.technicianId, order.assignedTechnicianId, order.engineerId, order.supervisorId].includes(actorId()); }
  function commonMatch(item) {
    const search = $('#pm-search').value.trim().toLocaleLowerCase('th');
    const text = [item.workOrderId, item.machineId, item.machineName, item.task, item.location].join(' ').toLocaleLowerCase('th');
    const from = $('#pm-date-from').value; const to = $('#pm-date-to').value; const due = dateKey(item.dueDate);
    return (!search || text.includes(search)) && (!$('#pm-zone-filter').value || zone(item) === $('#pm-zone-filter').value) && (!from || due && due >= from) && (!to || due && due <= to);
  }
  function needsPlan(plan) { return !state.orders.some((order) => !terminal(order) && (order.planItemIds || []).includes(plan.planItemId)) && !plan.activeWorkOrderId; }
  function actionLabel(order) {
    const actions = order.availableActions || [];
    if (actions.includes('approve')) return 'ตรวจรับ';
    if (actions.includes('submit') || actions.includes('saveDraft') && order.status === 'IN_PROGRESS') return 'บันทึกผล';
    if (actions.includes('start')) return 'เริ่มงาน';
    if (actions.includes('prepare')) return 'เตรียมงาน';
    return 'เปิดใบงาน';
  }
  function readiness(order) {
    const value = order.partsReadiness;
    if (value && typeof value === 'object') return value.label || (value.missingCount ? `ขาด ${value.missingCount} รายการ` : 'จองครบตามแผน');
    return ({ READY: 'จองครบตามแผน', SHORTAGE: 'จองยังไม่ครบ', NONE: 'ยืนยันไม่ใช้อะไหล่', UNKNOWN: 'ยังไม่ระบุ' })[value] || value || (order.status === 'WAITING_PARTS' ? 'จองยังไม่ครบ' : 'ดูรายละเอียดในใบงาน');
  }
  function renderSummary() {
    const active = state.orders.filter((order) => !terminal(order));
    const counts = [['plan', 'ต้องจัดแผน', state.plans.filter(needsPlan).length], ['due', 'ถึงกำหนด / เกินกำหนด', state.plans.filter((plan) => dateKey(plan.dueDate) && dateKey(plan.dueDate) <= today()).length], ['WAITING_PARTS', 'รออะไหล่', active.filter((order) => order.status === 'WAITING_PARTS').length], ['PENDING_INSPECTION', 'รอตรวจรับ', active.filter((order) => order.status === 'PENDING_INSPECTION').length]];
    $('#pm-summary').innerHTML = counts.map(([id, label, count]) => `<button type="button" data-focus="${id}" aria-pressed="${state.focus === id}"><span>${label}</span><strong>${count}</strong><small>${['plan', 'due'].includes(id) ? 'รายการแผน' : 'ใบงาน'}</small></button>`).join('');
  }
  function renderOrders() {
    const visible = state.orders.filter((order) => commonMatch(order) && (state.view === 'history' ? terminal(order) : !terminal(order)) && (state.view !== 'mine' || mine(order)) && (!$('#pm-status-filter').value || order.status === $('#pm-status-filter').value));
    const rank = { Critical: 0, High: 1, Normal: 2, Low: 3 };
    visible.sort((a, b) => (dateKey(a.dueDate) || '9999').localeCompare(dateKey(b.dueDate) || '9999') || (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2));
    $('#pm-work-title').textContent = { mine: 'งานของฉัน', history: 'ประวัติใบงาน', all: 'งานที่ต้องดำเนินการ', plans: 'งานที่ต้องดำเนินการ' }[state.view];
    $('#pm-work-description').textContent = `${visible.length} ใบงาน · วันนัดทำงานแยกจากกำหนด PM · จำนวนจองเป็นข้อมูลที่บันทึก ยังไม่ล็อกสต็อกคลัง`;
    if (!visible.length) {
      const message = !state.orders.length ? `มีแผน PM ${state.plans.length} รายการ แต่ยังไม่มีใบงาน${canPlan() ? ' เลือกรายการจากแผนตามเครื่องด้านล่างเพื่อจัดแผน' : ' เมื่อ Engineer มอบหมายงาน ใบงานจะแสดงที่นี่'}` : 'ไม่พบใบงานในมุมมองและตัวกรองนี้ ลองเลือกงานทั้งหมดหรือล้างตัวกรอง';
      $('#pm-work-order-body').innerHTML = `<tr><td colspan="6" class="pm-v2-empty">${esc(message)}</td></tr>`; return;
    }
    $('#pm-work-order-body').innerHTML = visible.map((order) => `<tr><td><strong>${esc(order.machineName || machineFor(order).machineName || 'ยังไม่ผูกเครื่อง')}</strong><small>${esc(order.machineId || 'ไม่มีรหัสเครื่อง')} · ${esc(order.workOrderId)}</small>${order.legacy ? '<small>ใบงานเดิม</small>' : ''}</td><td><span class="${dateKey(order.dueDate) && dateKey(order.dueDate) < today() && !terminal(order) ? 'pm-v2-overdue' : ''}">${esc(terminal(order) ? displayDate(order.dueDate) : dueText(order.dueDate))}</span><small>นัดทำงาน ${esc(displayDate(order.plannedStartAt, true))}</small></td><td>${esc(order.completedCount ?? 0)} / ${esc(order.itemCount ?? 1)} ข้อ</td><td>${esc(readiness(order))}</td><td>${esc(order.technicianName || userName(order.technicianId || order.assignedTechnicianId))}</td><td><span class="pm-v2-status" data-status="${esc(order.status)}">${esc(labels[order.status] || order.status)}</span><a class="pm-v2-button secondary" href="pm-work-order.html?id=${encodeURIComponent(order.workOrderId)}">${esc(actionLabel(order))}</a></td></tr>`).join('');
  }
  function renderPlans() {
    const opened = new Set([...$('#pm-plan-groups').querySelectorAll('details[open]')].map((group) => group.dataset.machine));
    const records = state.plans.filter((plan) => commonMatch(plan) && (!$('#pm-machine-filter').value || key(plan) === $('#pm-machine-filter').value) && (!$('#pm-interval-filter').value || interval(plan) === $('#pm-interval-filter').value) && (state.focus !== 'plan' || needsPlan(plan)) && (state.focus !== 'due' || dateKey(plan.dueDate) && dateKey(plan.dueDate) <= today()));
    const groups = new Map(); records.forEach((plan) => { const id = key(plan); if (!groups.has(id)) groups.set(id, []); groups.get(id).push(plan); });
    $('#pm-records-description').textContent = `${new Set(records.map((plan) => plan.machineId).filter(Boolean)).size} เครื่องที่ผูกทะเบียน · ${records.length} รายการแผน · ${records.filter((plan) => !plan.machineId).length} รายการยังไม่ผูกเครื่อง`;
    $('#pm-selection-help').hidden = !canPlan();
    $('#pm-plan-groups').innerHTML = [...groups.entries()].map(([id, plans]) => {
      const first = plans[0]; const selected = plans.filter((plan) => state.selection.has(plan.planItemId)); const dues = plans.map((plan) => dateKey(plan.dueDate)).filter(Boolean).sort();
      return `<details class="pm-machine-group" data-machine="${esc(id)}" ${opened.has(id) || groups.size === 1 ? 'open' : ''}><summary><span class="pm-machine-identity"><strong>${esc(first.machineName || 'ยังไม่ผูกเครื่องจักร')}</strong><small>${esc(first.machineId || 'ต้องกำหนดรหัสเครื่อง')} · ${esc(zone(first) || first.location || 'ยังไม่ระบุพื้นที่')}</small></span><span class="pm-machine-count"><strong>${plans.length}</strong><small>รายการ PM</small></span><span class="pm-machine-cycles">${esc(dues.length ? `กำหนดใกล้สุด ${displayDate(dues[0])}` : 'ยังไม่กำหนดวันเริ่มรอบ')}</span></summary><div class="pm-v2-machine-tools"><p class="pm-v2-muted">รอบ ${esc([...new Set(plans.map(interval))].join(' / '))}</p>${canPlan() ? `<div class="pm-v2-actions"><button class="pm-v2-button secondary" type="button" data-select-machine="${esc(id)}" ${!state.ready || !first.machineId ? 'disabled' : ''}>เลือกทั้งหมดในเครื่องนี้</button><button class="pm-v2-button" type="button" data-create-machine="${esc(id)}" ${!selected.length ? 'disabled' : ''}>สร้างใบงาน (${selected.length})</button></div>` : ''}</div>${plans.map((plan) => {
        const disabled = !state.ready || !plan.machineId || Boolean(plan.activeWorkOrderId);
        return `<div class="pm-v2-plan-row"><label class="pm-v2-plan-check">${canPlan() ? `<input type="checkbox" value="${esc(plan.planItemId)}" data-plan-select ${state.selection.has(plan.planItemId) ? 'checked' : ''} ${disabled ? 'disabled' : ''} aria-label="เลือก ${esc(plan.task)}" />` : ''}</label><div><strong>${esc(plan.task)}</strong><small>${esc(plan.location || '')}</small>${plan.issue ? `<small class="pm-v2-overdue">${esc(plan.issue)}</small>` : ''}${plan.activeWorkOrderId ? `<a href="pm-work-order.html?id=${encodeURIComponent(plan.activeWorkOrderId)}">มีใบงาน ${esc(plan.activeWorkOrderId)}</a>` : ''}</div><div><small>รอบ PM</small>${esc(interval(plan))}</div><div><small>กำหนด PM</small>${esc(dueText(plan.dueDate))}</div><div><small>อะไหล่ตามแผน</small>${esc([plan.partName, plan.partCode].filter(Boolean).join(' · ') || 'ยังไม่ระบุ')}${plan.partName || plan.partCode ? `<small>${esc(plan.plannedQty ?? 'ยังไม่ระบุจำนวน')} ${esc(plan.unit || '')}</small>` : ''}</div>${canPlan() && state.ready ? `<button type="button" class="pm-v2-button secondary" data-edit-plan="${esc(plan.planItemId)}">กำหนดข้อมูล</button>` : ''}</div>`;
      }).join('')}</details>`;
    }).join('') || '<p class="pm-v2-empty">ไม่พบแผนตามตัวกรองที่เลือก ลองล้างตัวกรอง หรือเตรียมทะเบียนแผนเมื่อยังไม่มีข้อมูล</p>';
  }
  const filterIds = ['pm-search', 'pm-zone-filter', 'pm-date-from', 'pm-date-to', 'pm-status-filter', 'pm-machine-filter', 'pm-interval-filter'];
  function render() {
    $('#pm-work-section').hidden = state.view === 'plans'; $('#pm-plan-section').hidden = state.view === 'mine' || state.view === 'history';
    $('#pm-view-tabs').querySelectorAll('[data-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === state.view)));
    renderSummary(); renderOrders(); renderPlans();
    try { sessionStorage.setItem('rd-pm-overview-v2', JSON.stringify({ view: state.view, focus: state.focus, values: Object.fromEntries(filterIds.map((id) => [id, $(`#${id}`).value])) })); } catch (_) { /* Storage is optional. */ }
  }
  function fillOptions(id, entries, placeholder) {
    const select = $(`#${id}`); const previous = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>${entries.map(([value, text]) => `<option value="${esc(value)}">${esc(text)}</option>`).join('')}`;
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  }
  function restoreFilters() {
    try { const saved = JSON.parse(sessionStorage.getItem('rd-pm-overview-v2') || 'null'); if (saved) { state.view = ['mine', 'all', 'plans', 'history'].includes(saved.view) ? saved.view : 'all'; state.focus = saved.focus || ''; filterIds.forEach((id) => { if (saved.values?.[id]) $(`#${id}`).value = saved.values[id]; }); } } catch (_) { /* Ignore malformed saved filters. */ }
  }
  async function load() {
    const startedAt = performance.now();
    $('#pm-retry').hidden = true; $('#pm-load-message').textContent = 'กำลังโหลดแผนและใบงาน PM…';
    try {
      const data = await window.RDSiteAuth.apiRequest('getPmWorkspaceV2');
      state.actor = data.actor || window.RDSiteAuth.getUser() || {}; state.plans = data.plans || []; state.orders = data.workOrders || []; state.machines = data.machines || []; state.technicians = data.technicians || []; state.ready = Boolean(data.schemaReady);
      state.selection = new Set([...state.selection].filter((id) => state.plans.some((plan) => plan.planItemId === id && !plan.activeWorkOrderId)));
      fillOptions('pm-zone-filter', [...new Set([...state.machines.map((machine) => machine.zone), ...state.plans.map(zone)].filter(Boolean))].sort().map((value) => [value, value]), 'ทุกพื้นที่');
      fillOptions('pm-machine-filter', [...new Map(state.plans.map((plan) => [key(plan), [key(plan), `${plan.machineId || 'ยังไม่ผูกเครื่อง'} · ${plan.machineName}`]])).values()], 'ทุกเครื่องจักร');
      fillOptions('pm-interval-filter', [...new Set(state.plans.map(interval))].sort().map((value) => [value, value]), 'ทุกรอบ');
      if (!state.initialized) { state.view = state.actor.role === 'Technician' ? 'mine' : 'all'; if (state.actor.role === 'Supervisor') $('#pm-status-filter').value = 'PENDING_INSPECTION'; restoreFilters(); state.initialized = true; }
      $('#pm-role-indicator').textContent = state.actor.role || 'อ่านข้อมูล'; $('#pm-plan-jump').hidden = !canPlan(); $('#pm-setup').hidden = !canPlan();
      $('#pm-overview-description').textContent = `${new Set(state.plans.map((plan) => plan.machineId).filter(Boolean)).size} เครื่องที่ผูกทะเบียน · ${state.plans.length} รายการแผน · ${state.orders.length} ใบงาน`;
      const warnings = (data.warnings || []).map((warning) => typeof warning === 'string' ? warning : warning.message || warning.code || '').filter(Boolean);
      const elapsed = `${((performance.now() - startedAt) / 1000).toFixed(1)} วินาที`;
      $('#pm-load-message').textContent = !state.ready ? 'ทะเบียนแผนยังไม่พร้อม ผู้วางแผนต้องตรวจและเตรียมข้อมูลก่อนสร้างใบงาน' : warnings.length ? `${warnings.join(' · ')} · โหลด ${elapsed}` : `ข้อมูลล่าสุดพร้อมใช้งาน · โหลด ${elapsed}`; render();
    } catch (error) {
      $('#pm-load-message').textContent = 'โหลด PM ไม่สำเร็จ กรุณาลองอีกครั้ง หากยังเกิดปัญหาให้ตรวจการติดตั้ง PM API รุ่นใหม่'; $('#pm-retry').hidden = false;
      if (!state.initialized) { $('#pm-work-order-body').innerHTML = '<tr><td colspan="6">ยังโหลดใบงานไม่ได้</td></tr>'; $('#pm-plan-groups').innerHTML = '<p class="pm-v2-empty">ยังโหลดแผนไม่ได้</p>'; }
    }
  }
  function openEditor(plan) {
    state.editor = plan; $('#pm-editor-description').textContent = `${plan.machineName || 'ยังไม่ผูกเครื่อง'} · ${plan.task}`;
    const form = $('#pm-plan-form');
    form.elements.machineId.innerHTML = '<option value="">เลือกเครื่องจักรจากทะเบียน</option>' + state.machines.map((machine) => `<option value="${esc(machine.machineId)}">${esc(machine.machineId)} · ${esc(machine.machineName)} · ${esc(machine.zone || machine.location || '')}</option>`).join('');
    form.elements.machineId.value = plan.machineId || ''; form.elements.baseDate.value = dateKey(plan.baseDate); form.elements.intervalValue.value = plan.intervalValue || ''; form.elements.intervalUnit.value = String(plan.intervalUnit || 'MONTH').toUpperCase();
    $('#pm-editor-message').textContent = ''; $('#pm-plan-editor').hidden = false; form.elements.machineId.focus(); $('#pm-plan-editor').scrollIntoView({ block: 'start' });
  }
  $('#pm-plan-groups').addEventListener('change', (event) => {
    if (!event.target.matches('[data-plan-select]')) return;
    if (event.target.checked) state.selection.add(event.target.value); else state.selection.delete(event.target.value);
    const group = event.target.closest('[data-machine]'); const count = state.plans.filter((plan) => key(plan) === group.dataset.machine && state.selection.has(plan.planItemId)).length;
    const button = group.querySelector('[data-create-machine]'); button.disabled = !count; button.textContent = `สร้างใบงาน (${count})`;
  });
  $('#pm-plan-groups').addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit-plan]'); if (edit) { openEditor(state.plans.find((plan) => plan.planItemId === edit.dataset.editPlan)); return; }
    const select = event.target.closest('[data-select-machine]'); if (select) { state.plans.filter((plan) => key(plan) === select.dataset.selectMachine && !plan.activeWorkOrderId).forEach((plan) => state.selection.add(plan.planItemId)); renderPlans(); return; }
    const create = event.target.closest('[data-create-machine]'); if (create) { const ids = state.plans.filter((plan) => key(plan) === create.dataset.createMachine && state.selection.has(plan.planItemId)).map((plan) => plan.planItemId); if (ids.length) window.location.href = `pm-work-order.html?planIds=${encodeURIComponent(ids.join(','))}`; }
  });
  $('#pm-view-tabs').addEventListener('click', (event) => { const button = event.target.closest('[data-view]'); if (button) { state.view = button.dataset.view; state.focus = ''; $('#pm-status-filter').value = ''; render(); } });
  $('#pm-summary').addEventListener('click', (event) => { const button = event.target.closest('[data-focus]'); if (!button) return; state.focus = state.focus === button.dataset.focus ? '' : button.dataset.focus; if (['plan', 'due'].includes(state.focus)) { state.view = 'plans'; $('#pm-status-filter').value = ''; } else { state.view = 'all'; $('#pm-status-filter').value = state.focus; } render(); });
  filterIds.forEach((id) => $(`#${id}`).addEventListener(id === 'pm-search' ? 'input' : 'change', () => { if (id === 'pm-status-filter') { if (['CLOSED', 'CANCELLED'].includes($('#pm-status-filter').value)) state.view = 'history'; else if (state.view === 'history' && $('#pm-status-filter').value) state.view = 'all'; } render(); }));
  $('#pm-clear-filters').addEventListener('click', () => { filterIds.forEach((id) => { $(`#${id}`).value = ''; }); state.focus = ''; render(); });
  $('#pm-plan-jump').addEventListener('click', () => { state.view = 'plans'; state.focus = ''; render(); $('#pm-plan-title').focus(); $('#pm-plan-section').scrollIntoView({ block: 'start' }); });
  $('#pm-editor-close').addEventListener('click', () => { $('#pm-plan-editor').hidden = true; state.editor = null; });
  $('#pm-plan-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity() || !state.editor) return;
    const button = form.querySelector('[type="submit"]'); button.disabled = true; $('#pm-editor-message').textContent = 'กำลังบันทึก…';
    try { const result = await window.RDSiteAuth.apiRequest('savePmWorkflowV2', { operation: 'updatePlan', planItemId: state.editor.planItemId, expectedRevision: state.editor.revision, requestId: window.PM.requestId(), ...Object.fromEntries(new FormData(form)), intervalValue: Number(form.elements.intervalValue.value) }); if (result.plan) state.editor = result.plan; $('#pm-editor-message').textContent = 'บันทึกข้อมูลแผนแล้ว'; await load(); }
    catch (error) { $('#pm-editor-message').textContent = window.PM.errorMessage(error); } finally { button.disabled = false; }
  });
  async function setup(apply) {
    const preview = $('#pm-setup-preview'); const applyButton = $('#pm-setup-apply'); preview.disabled = true; applyButton.disabled = true; $('#pm-setup-report').textContent = apply ? 'กำลังสำรองและเตรียมทะเบียน…' : 'กำลังตรวจแผนการย้ายข้อมูล…';
    try {
      const report = await window.RDSiteAuth.apiRequest('setupPmV2', { mode: apply ? 'apply' : 'dryRun', requestId: window.PM.requestId() }); state.setup = report;
      const issues = report.issues || [];
      $('#pm-setup-report').innerHTML = `<p>แผนต้นทาง ${esc(report.sourceCount ?? 0)} รายการ · มีในทะเบียน ${esc(report.existingPlanCount ?? 0)} รายการ · เพิ่มใหม่ ${esc(report.toImport ?? 0)} รายการ · อัปเดต ${esc(report.toUpdate ?? 0)} รายการ</p><p>ข้อมูลที่ต้องกำหนด ${issues.length} รายการ${report.backupId ? ` · สำรองข้อมูลแล้ว: ${esc(report.backupId)}` : ''}</p>${issues.length ? `<ul>${issues.map((issue) => `<li>${esc(issue.machineName)} · ${esc(issue.task)} — ${esc(issue.code)}</li>`).join('')}</ul>` : ''}`;
      applyButton.hidden = apply || (report.schemaReady && !Number(report.toImport || 0) && !Number(report.toUpdate || 0)); if (apply) await load();
    } catch (error) { $('#pm-setup-report').textContent = window.PM.errorMessage(error); } finally { preview.disabled = false; applyButton.disabled = false; }
  }
  $('#pm-setup-preview').addEventListener('click', () => setup(false)); $('#pm-setup-apply').addEventListener('click', () => { if (state.setup) setup(true); });
  $('#pm-retry').addEventListener('click', load);
  window.RD_AUTH_READY?.then(load).catch(() => {});
})();
