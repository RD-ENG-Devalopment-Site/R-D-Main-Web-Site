(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const hide = (selector, value) => { const element = $(selector); if (element) element.hidden = value; };
  const context = window.RDBreakdownContext;
  let contextSequence = 0;
  const statuses = { OPEN: 'รับแจ้งแล้ว', ASSIGNED: 'มอบหมายแล้ว', IN_PROGRESS: 'กำลังซ่อม', WAITING_PARTS: 'รออะไหล่', PENDING_INSPECTION: 'รอตรวจรับ', REWORK: 'ส่งกลับแก้ไข', CLOSED: 'ปิดงาน', CANCELLED: 'ยกเลิก' };
  const severities = { CRITICAL: 'วิกฤต', HIGH: 'สูง', NORMAL: 'ปกติ', LOW: 'ต่ำ' };
  const impacts = { STOPPED: 'หยุดเครื่อง', DEGRADED: 'ทำงานได้ลดลง', RUNNING: 'ยังเดินเครื่องได้' };
  const operations = { create: 'รับแจ้งเหตุ', assign: 'มอบหมายงาน', start: 'ตอบรับ / เริ่มซ่อม', saveRepair: 'บันทึกความคืบหน้า', waitParts: 'รออะไหล่', submit: 'ส่งตรวจรับ', approve: 'ตรวจรับและปิดงาน', return: 'ส่งกลับแก้ไข', cancel: 'ยกเลิกเหตุ' };
  const errors = {
    ACTION_NOT_AVAILABLE: 'ระบบหลังบ้านยังไม่มีโมดูล Break Down กรุณาให้ผู้ดูแลอัปเดตบริการ แล้วโหลดข้อมูลอีกครั้ง',
    PERMISSION_DENIED: 'บัญชีนี้ไม่มีสิทธิ์ทำขั้นตอนนี้ หรือสถานะงานเปลี่ยนแล้ว กรุณาโหลดเหตุล่าสุด',
    BD_NOT_READY: 'ยังไม่ได้เตรียมทะเบียนเหตุขัดข้อง ให้ Admin หรือ Engineer เตรียมทะเบียนก่อน',
    BD_SCHEMA_INVALID: 'โครงสร้างทะเบียนเหตุขัดข้องไม่ตรงกับระบบ กรุณาให้ผู้ดูแลตรวจหัวคอลัมน์',
    BD_REQUIRED_FIELDS: 'กรุณากรอกข้อมูลที่จำเป็น และตรวจความยาวข้อความ',
    BD_INVALID_TIME: 'วันที่หรือเวลาไม่ถูกต้อง ต้องไม่อยู่ในอนาคต และเวลาคืนเครื่องต้องไม่ก่อนเวลาเริ่มซ่อมหรือหยุดเครื่อง',
    BD_INVALID_LINK: 'กรุณาใช้ลิงก์ https:// ที่ถูกต้อง สูงสุด 10 ลิงก์ หนึ่งลิงก์ต่อบรรทัด',
    BD_MACHINE_REQUIRED: 'กรุณาเลือกเครื่องจักรที่เปิดใช้งานและมีรหัสไม่ซ้ำจากทะเบียน',
    BD_ASSIGNMENT_REQUIRED: 'ไม่พบช่างที่เปิดใช้งาน กรุณาโหลดข้อมูลใหม่ หรือตรวจบัญชีช่างในระบบ',
    BD_REVISION_CONFLICT: 'มีผู้แก้ไขเหตุนี้แล้ว ข้อมูลที่กรอกยังอยู่ กรุณาเก็บข้อความไว้ก่อนกด “ทิ้งการแก้ไขและโหลดเหตุล่าสุด”',
    BD_REQUEST_CONFLICT: 'รหัสคำขอนี้ถูกใช้กับข้อมูลอื่นแล้ว กรุณาโหลดเหตุล่าสุด',
    BD_REPAIR_INCOMPLETE: 'ก่อนส่งตรวจ กรุณาระบุสาเหตุราก วิธีแก้ไขถาวร ผลทดสอบ และเวลาคืนเครื่อง',
    BD_COMMENT_REQUIRED: 'กรุณาระบุเหตุผลสำหรับขั้นตอนนี้',
    BD_INSPECTION_REQUIRED: 'กรุณาเลือกผลตรวจรับ “ผ่าน พร้อมคืนใช้งาน” ก่อนปิดงาน',
    BD_NOT_FOUND: 'ไม่พบเหตุนี้ กรุณากลับไปเลือกจากรายการ',
    BD_RECORD_TOO_LARGE: 'ข้อมูลเหตุนี้ยาวเกินขนาดที่รองรับ กรุณาย่อข้อความหรือลดจำนวนลิงก์',
    BD_PENDING_CHANGED: 'ยังมีคำขอที่ไม่ทราบผล กรุณากด “ลองส่งคำขอเดิมอีกครั้ง” เพื่อยืนยันผล ก่อนบันทึกข้อมูลที่เปลี่ยนใหม่',
    BD_RECORD_INVALID: 'ข้อมูลเหตุบางรายการอ่านไม่ได้ กรุณาให้ผู้ดูแลตรวจทะเบียนก่อนใช้งานต่อ',
  };
  const sections = {
    report: { title: 'แจ้งเหตุขัดข้อง', description: 'บันทึกและติดตามรายการแจ้งเหตุของเครื่องจักร', list: 'ใบแจ้งเหตุทั้งหมด', count: 'รายการแจ้งเหตุ', statuses: Object.keys(statuses) },
    repair: { title: 'ใบงานซ่อม', description: 'มอบหมายช่าง บันทึกจุดที่เสีย วิธีซ่อม และอะไหล่ที่ใช้', list: 'ใบงานซ่อมที่กำลังดำเนินการ', count: 'อยู่ระหว่างมอบหมายหรือซ่อม', statuses: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'REWORK'] },
    inspection: { title: 'ตรวจรับและปิดงาน', description: 'ตรวจผลซ่อมและผลทดสอบ ก่อนยืนยันคืนเครื่องหรือส่งกลับแก้ไข', list: 'ใบงานที่รอตรวจรับ', count: 'รอตรวจรับ', statuses: ['PENDING_INSPECTION'] },
    analysis: { title: 'รายงานและวิเคราะห์', description: 'ค้นประวัติการซ่อม เวลาหยุดเครื่อง และสาเหตุที่เกิดซ้ำ', list: 'ประวัติงานที่สิ้นสุดแล้ว', count: 'ปิดงานหรือยกเลิกแล้ว', statuses: ['CLOSED', 'CANCELLED'] },
  };
  function sectionFromUrl() {
    if (location.pathname.split('/').pop() !== 'machine-breakdown.html' && Object.hasOwn(sections, document.body.dataset.breakdownSection)) return document.body.dataset.breakdownSection;
    const requested = new URLSearchParams(location.search).get('section');
    if (Object.hasOwn(sections, requested)) return requested;
    if (location.hash === '#analysis-and-repair') return 'repair';
    if (location.hash === '#inspection') return 'inspection';
    if (location.hash === '#analysis') return 'analysis';
    return 'report';
  }
  const pageFiles = window.RD_AUTH_CONFIG.breakdownPages;
  const sectionHref = (section, incidentId = '') => `${pageFiles[section]}${incidentId ? `?${new URLSearchParams({ incident: incidentId })}` : ''}`;
  function clearIncidentReference() {
    const url = new URL(location.href); url.searchParams.delete('incident');
    history.replaceState(null, '', url.pathname + url.search);
  }
  const requestedSection = sectionFromUrl();
  if (location.pathname.split('/').pop() === 'machine-breakdown.html' && requestedSection !== 'report') {
    const incident = new URLSearchParams(location.search).get('incident');
    location.replace(sectionHref(requestedSection, incident && /^BD-[A-Za-z0-9_-]{8,100}$/.test(incident) ? incident : ''));
    return;
  }
  const state = { incidents: [], machines: [], technicians: [], actor: null, ready: false, section: sectionFromUrl(), view: 'all', page: 1, detail: null, dirty: false, createDirty: false, busy: false, pending: null, failed: false };
  const filters = ['bd-search', 'bd-zone', 'bd-status', 'bd-severity', 'bd-from', 'bd-to'];
  const compact = window.matchMedia('(max-width: 640px)');
  $('#bd-filter-details').open = !compact.matches;
  compact.addEventListener('change', event => { $('#bd-filter-details').open = !event.matches; });
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const terminal = incident => ['CLOSED', 'CANCELLED'].includes(incident.status);
  const toInput = value => value ? new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 16) : '';
  const isoInput = value => value ? `${value}:00+07:00` : '';
  const day = value => toInput(value).slice(0, 10);
  const number = value => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 }).format(value);
  function date(value) { return value ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value)) : 'ยังไม่ระบุ'; }
  function message(selector, text, kind = '') { const el = $(selector); el.textContent = text; el.className = `bd-message ${kind ? `is-${kind}` : ''}`; }
  function errorText(error) { return errors[error?.message] || 'เชื่อมต่อหรือบันทึกไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วลองอีกครั้ง ข้อมูลที่กรอกยังอยู่'; }
  function links(value) {
    const urls = String(value || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean);
    if (urls.length > 10 || urls.some(url => { try { const u = new URL(url); return u.protocol !== 'https:' || Boolean(u.username || u.password); } catch (_) { return true; } })) throw Error('BD_INVALID_LINK');
    return urls;
  }
  function pendingKey() { return `rd-breakdown-pending:${state.actor.id}`; }
  function setPending(value) {
    state.pending = value;
    try { if (value) sessionStorage.setItem(pendingKey(), JSON.stringify(value)); else sessionStorage.removeItem(pendingKey()); } catch (_) { /* Current-tab retry still works if storage is unavailable. */ }
    $('#bd-retry-request').hidden = !value;
  }
  function busy(value) {
    state.busy = value;
    document.querySelectorAll('.bd-page button, .bd-page input, .bd-page select, .bd-page textarea').forEach(el => { el.disabled = value; });
    if ($('#bd-new')) $('#bd-new').disabled = value || !state.ready || !state.machines.length;
    if ($('#bd-create-form')) $('#bd-create-form').querySelector('button[type="submit"]').disabled = value || !state.ready;
    $('#bd-tabs')?.setAttribute('aria-busy', String(value));
  }
  function applySection() {
    const config = sections[state.section];
    document.title = `${config.title} | Engineer R&D Site`;
    $('#bd-title').textContent = config.title;
    $('#bd-page-description').textContent = config.description;
    $('#bd-list-title').textContent = config.list;
    hide('#bd-tabs', false);
    hide('#bd-analysis', false);
    hide('#bd-new', !state.canCreate);
    const status = $('#bd-status');
    status.innerHTML = '<option value="">ทุกสถานะในหัวข้อนี้</option>' + config.statuses.map(key => `<option value="${key}">${statuses[key]}</option>`).join('');
    $('#bd-status-field').hidden = config.statuses.length <= 1;
  }
  function filtered() {
    const query = $('#bd-search').value.trim().toLocaleLowerCase('th-TH');
    const from = $('#bd-from').value, to = $('#bd-to').value;
    if (from && to && from > to) return [];
    return state.incidents.filter(i => {
      if (!sections[state.section].statuses.includes(i.status)) return false;
      if (query && [i.incidentId, i.machineId, i.machineName, i.symptoms, i.rootCause, i.repairAction, i.partsUsed].join(' ').toLocaleLowerCase('th-TH').includes(query) === false) return false;
      if ($('#bd-zone').value && i.zone !== $('#bd-zone').value || $('#bd-status').value && i.status !== $('#bd-status').value || $('#bd-severity').value && i.severity !== $('#bd-severity').value) return false;
      if (from && day(i.occurredAt) < from || to && day(i.occurredAt) > to) return false;
      return state.section !== 'repair' || state.view !== 'mine' || Boolean(i.technicianId) && i.technicianId === state.actor?.id;
    });
  }
  function queryOrFilterActive() { return filters.some(id => Boolean($(`#${id}`).value)) || state.section === 'repair' && state.view === 'mine'; }
  function renderAnalysis(incidents) {
    if (!incidents.length) { $('#bd-analysis-content').innerHTML = '<p class="bd-message">ยังไม่มีเหตุที่ปิดงานแล้วภายใต้ตัวกรองนี้</p>'; return; }
    const groups = new Map();
    incidents.forEach(i => {
      const key = JSON.stringify([i.machineId, i.rootCause.trim().toLocaleLowerCase('th-TH')]);
      const group = groups.get(key) || { machine: i.machineName, machineId: i.machineId, cause: i.rootCause, count: 0, downtime: 0 };
      group.count++; group.downtime += i.downtimeMinutes; groups.set(key, group);
    });
    const repeat = [...groups.values()].filter(g => g.count >= 2).sort((a, b) => b.count - a.count);
    const total = incidents.reduce((sum, i) => sum + i.downtimeMinutes, 0);
    const average = incidents.reduce((sum, i) => sum + i.repairMinutes, 0) / incidents.length;
    $('#bd-analysis-content').innerHTML = `<p class="bd-analysis-summary">ปิดงานแล้ว ${number(incidents.length)} เหตุ · เวลาหยุดเครื่องรวม ${number(total)} นาที<br>เวลาเฉลี่ยตั้งแต่เริ่มซ่อมจนคืนเครื่อง ${number(average)} นาที (รวมเวลารอระหว่างซ่อม)<br>เหตุซ้ำใช้เครื่องจักรเดียวกันและข้อความสาเหตุรากตรงกัน</p>${repeat.length ? `<div class="bd-table-wrap" tabindex="0" role="region" aria-label="ตารางสาเหตุซ้ำ"><table class="bd-table"><caption class="sr-only">เครื่องจักรที่พบสาเหตุซ้ำ</caption><thead><tr><th scope="col">เครื่องจักร</th><th scope="col">สาเหตุราก</th><th scope="col">จำนวนเหตุ</th><th scope="col">หยุดเครื่องรวม</th></tr></thead><tbody>${repeat.map(g => `<tr><td>${esc(g.machine)}<small>${esc(g.machineId)}</small></td><td>${esc(g.cause)}</td><td>${number(g.count)}</td><td>${number(g.downtime)} นาที</td></tr>`).join('')}</tbody></table></div>` : '<p class="bd-message">ยังไม่พบสาเหตุรากซ้ำในเครื่องเดียวกันจากเหตุที่เลือก</p>'}`;
  }
  function render() {
    const incidents = filtered();
    const pages = Math.max(1, Math.ceil(incidents.length / 10));
    state.page = Math.min(state.page, pages);
    const invalidRange = $('#bd-from').value && $('#bd-to').value && $('#bd-from').value > $('#bd-to').value;
    $('#bd-count').textContent = invalidRange ? 'กรุณาเลือกวันสิ้นสุดไม่ก่อนวันเริ่มต้น' : `${state.failed ? 'ข้อมูลที่โหลดไว้ก่อนหน้า · ' : ''}${number(incidents.length)} เหตุ · ${sections[state.section].count}`;
    const filterCount = filters.slice(1).filter(id => $(`#${id}`).value).length;
    $('#bd-filter-details summary').textContent = `ตัวกรองเพิ่มเติม${filterCount ? ` · ใช้อยู่ ${filterCount}` : ''}`;
    document.querySelectorAll('#bd-tabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    hide('#bd-analysis', state.section !== 'analysis');
    if (state.section === 'analysis') renderAnalysis(incidents.filter(i => i.status === 'CLOSED'));
    const emptyText = state.failed ? 'ยังโหลดข้อมูลไม่ได้ กรุณากดโหลดข้อมูลล่าสุด' : queryOrFilterActive() ? 'ไม่พบเหตุที่ตรงกับตัวกรองในหัวข้อนี้' : {
      report: 'ยังไม่มีใบแจ้งเหตุ', repair: 'ยังไม่มีใบงานที่กำลังดำเนินการ', inspection: 'ยังไม่มีงานที่รอตรวจรับ', analysis: 'ยังไม่มีประวัติงานที่สิ้นสุดแล้ว',
    }[state.section];
    $('#bd-rows').innerHTML = incidents.slice((state.page - 1) * 10, state.page * 10).map(i => `<tr><td><strong>${esc(i.machineName)}</strong><small>${esc(i.machineId)} · ${esc(i.zone)}</small><p>${esc(i.symptoms.slice(0, 180))}${i.symptoms.length > 180 ? '…' : ''}</p></td><td>${esc(date(i.occurredAt))}<small>${esc(impacts[i.machineImpact])}</small>${terminal(i) ? `<small>หยุดเครื่อง ${number(i.downtimeMinutes)} นาที</small>` : ''}</td><td><span class="bd-tag" data-severity="${esc(i.severity)}">${esc(severities[i.severity])}</span>${!terminal(i) && i.severity === 'CRITICAL' ? '<small class="bd-alert">ต้องติดตามเร่งด่วน</small>' : ''}</td><td>${esc(i.technicianName || 'ยังไม่มอบหมาย')}${!terminal(i) && !i.technicianId ? '<small class="bd-alert">รอผู้รับผิดชอบ</small>' : ''}<small>${esc(i.responsibleTeam)}</small></td><td><span class="bd-tag">${esc(statuses[i.status])}</span><br><button class="bd-button secondary" data-incident="${esc(i.incidentId)}" type="button">${({ report: 'ดูใบแจ้งเหตุ', repair: 'เปิดใบงานซ่อม', inspection: 'เปิดตรวจรับ', analysis: 'ดูประวัติ' })[state.section]}</button></td></tr>`).join('') || `<tr><td colspan="5" class="bd-empty">${emptyText}</td></tr>`;
    $('#bd-pagination').innerHTML = `<span>หน้า ${number(state.page)} / ${number(pages)}</span><button type="button" class="bd-button secondary" data-page="-1" ${state.page === 1 ? 'disabled' : ''}>ก่อนหน้า</button><button type="button" class="bd-button secondary" data-page="1" ${state.page === pages ? 'disabled' : ''}>ถัดไป</button>`;
  }
  function fillForm(form, values) { if (!form) return; Object.entries(values).forEach(([key, value]) => { if (form.elements.namedItem(key)) form.elements.namedItem(key).value = Array.isArray(value) ? value.join('\n') : value ?? ''; }); }
  function facts(fields) { return `<dl class="bd-facts">${fields.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value || 'ยังไม่ระบุ')}</dd></div>`).join('')}</dl>`; }
  function bindPhoto() {
    const photo = $('#bd-machine-context img');
    if (!photo) return;
    const photoState = $('#bd-photo-state');
    const failed = () => { photo.hidden = true; photoState.textContent = 'เปิดรูปไม่ได้ กรุณาตรวจลิงก์และสิทธิ์ในทะเบียนเครื่อง'; };
    photo.addEventListener('error', failed);
    photo.addEventListener('load', () => { photoState.textContent = 'รูปจากทะเบียนปัจจุบัน · ตรวจว่าเป็นเครื่องเดียวกับหน้างาน'; });
    if (photo.complete) { if (!photo.naturalWidth) failed(); else photoState.textContent = 'รูปจากทะเบียนปัจจุบัน · ตรวจว่าเป็นเครื่องเดียวกับหน้างาน'; }
  }
  function renderContext(i, results) {
    const [machines, docs] = results;
    const resolved = machines.status === 'fulfilled' ? context.machine(i, machines.value) : { record: null };
    const m = resolved.record;
    const photo = context.https(m?.image_url);
    const changed = m && (m.machine_name !== i.machineName || m.zone !== i.zone || m.location !== (i.location || ''));
    const references = docs.status === 'fulfilled' && !resolved.ambiguous ? context.documents(i.machineId, docs.value, day(new Date().toISOString())) : [];
    const docHtml = references.map(d => `<li>${d.href ? `<a href="${esc(d.href)}" target="_blank" rel="noopener noreferrer">${esc(d.document_name || d.document_id)}</a>` : `<strong>${esc(d.document_name || d.document_id)}</strong>`}<small>${esc(d.document_type)} · รุ่น ${esc(d.version || 'ยังไม่ระบุ')} · มีผล ${esc(d.effectiveDay || 'ยังไม่ระบุ')}${d.issue ? ` · ${esc(d.issue)}` : ''}</small></li>`).join('');
    $('#bd-machine-context').innerHTML = `<div class="bd-machine-layout"><div class="bd-machine-photo">${photo ? `<img src="${esc(photo)}" alt="รูปเครื่อง ${esc(m.machine_name)} จากทะเบียนปัจจุบัน" referrerpolicy="no-referrer" />` : ''}<p id="bd-photo-state" class="bd-footnote">${photo ? 'กำลังโหลดรูปจากทะเบียน…' : 'ยังไม่มีรูปเครื่องจากทะเบียน'}</p></div><div>${facts([['รหัส / เครื่องปัจจุบัน', m ? `${m.machine_id} · ${m.machine_name}` : `${i.machineId} · ${i.machineName}`], ['ตำแหน่งปัจจุบัน', m ? `${m.zone} · ${m.location || 'ยังไม่ระบุตำแหน่ง'}` : 'ยังยืนยันจากทะเบียนไม่ได้'], ['ทีมดูแลเครื่อง', m?.owner_team || 'ยังไม่ระบุในทะเบียน']])}<p class="bd-footnote">${machines.status !== 'fulfilled' ? 'โหลดทะเบียนเครื่องไม่ได้ กดโหลดข้อมูลประกอบใหม่เพื่อลองอีกครั้ง' : resolved.ambiguous ? 'พบรหัสเครื่องซ้ำในทะเบียน ให้ผู้ดูแลแก้ไขก่อนอ้างอิงรูปและเอกสาร' : !m ? 'ไม่พบเครื่องนี้ในทะเบียนปัจจุบัน ประวัติในเหตุยังอ่านได้' : !context.active(m.active) ? 'เครื่องนี้ไม่ได้เปิดใช้งานในทะเบียนปัจจุบัน' : 'ตำแหน่งและรูปยังต้องตรวจยืนยันกับหน้างาน'}</p>${changed ? `<p class="bd-footnote">ข้อมูลเมื่อแจ้งเหตุ: ${esc(i.machineName)} · ${esc(i.zone)} · ${esc(i.location || 'ยังไม่ระบุตำแหน่ง')} (ต่างจากทะเบียนปัจจุบัน)</p>` : ''}</div></div><div class="bd-context-case">${facts([['อาการที่แจ้ง', i.symptoms], ['ผลกระทบการผลิต', i.productionImpact], ['ข้อควรระวังที่ผู้แจ้งบันทึก', i.safetyNotes || 'ยังไม่ระบุ · ตรวจเอกสารที่หน่วยงานยืนยันก่อนเริ่มงาน']])}</div><div class="bd-context-docs"><h4>คู่มือและเอกสารประจำเครื่อง</h4>${docs.status !== 'fulfilled' ? '<p class="bd-message is-error">โหลดเอกสารไม่ได้ กดโหลดข้อมูลประกอบใหม่เพื่อลองอีกครั้ง</p>' : resolved.ambiguous ? '<p class="bd-message">ยังจับคู่เอกสารไม่ได้ เพราะรหัสเครื่องซ้ำ</p>' : docHtml ? `<ul class="bd-document-list">${docHtml}</ul>` : '<p class="bd-message">ยังไม่มีเอกสารที่เปิดใช้งานในทะเบียนสำหรับเครื่องนี้</p>'}<p class="bd-footnote">ทะเบียนนี้ยังไม่มีข้อมูลผู้อนุมัติเอกสารหรือเกณฑ์คืนเครื่องที่ยืนยันแล้ว กรุณาตรวจเวอร์ชันและสิทธิ์เปิดไฟล์กับวิศวกรหรือหัวหน้าช่างก่อนใช้</p></div>`;
    bindPhoto();
  }
  async function loadContext(i) {
    if (!$('#bd-machine-context')) return;
    const sequence = ++contextSequence;
    $('#bd-machine-context').textContent = 'กำลังโหลดทะเบียนเครื่องและเอกสาร…';
    const results = await Promise.allSettled([window.RDSiteAuth.apiRequest('listMachines'), window.RDSiteAuth.apiRequest('listDocuments', { machineId: i.machineId })]);
    if (sequence === contextSequence && state.detail?.incident.incidentId === i.incidentId) renderContext(i, results);
  }
  async function loadReadiness() {
    const button = $('#bd-readiness-load'); button.disabled = true;
    message('#bd-readiness-message', 'กำลังอ่านทะเบียนเครื่องและเอกสาร…');
    const results = await Promise.allSettled([window.RDSiteAuth.apiRequest('listMachines'), window.RDSiteAuth.apiRequest('listDocuments')]);
    const target = $('#bd-readiness-content');
    if (results.some(r => r.status !== 'fulfilled')) { target.replaceChildren(); message('#bd-readiness-message', 'ตรวจข้อมูลไม่ครบ เพราะโหลดทะเบียนเครื่องหรือเอกสารไม่ได้ กรุณาลองอีกครั้ง', 'error'); button.disabled = false; return; }
    const rows = context.readiness(results[0].value, results[1].value, day(new Date().toISOString()));
    message('#bd-readiness-message', `อ่านทะเบียนแล้ว ${number(rows.length)} เครื่องที่เปิดใช้งาน · ${date(new Date().toISOString())} · ยังไม่ใช่การยืนยันความพร้อมหน้างาน`);
    target.innerHTML = rows.length ? `<div class="bd-table-wrap" tabindex="0" role="region" aria-label="ตารางข้อมูลที่ต้องยืนยัน เลื่อนแนวนอนได้"><table class="bd-table"><caption class="sr-only">ข้อมูลประจำเครื่องจากทะเบียนและรายการรอยืนยัน</caption><thead><tr><th scope="col">เครื่อง / ตำแหน่ง</th><th scope="col">รูป / ทีมดูแล</th><th scope="col">SOP / Manual</th><th scope="col">เกณฑ์ / ผู้ยืนยัน</th></tr></thead><tbody>${rows.map(r => `<tr><td><strong>${esc(r.id)} · ${esc(r.name)}</strong><small>${esc(r.zone)} · ${esc(r.location)}</small>${r.duplicate ? '<small class="bd-alert">รหัสซ้ำ ให้ผู้ดูแลทะเบียนแก้ไข</small>' : ''}</td><td>${esc(r.photo)}<small>ทีม: ${esc(r.team)}</small></td><td>${esc(r.documents)}</td><td>${esc(r.criteria)}<small>${esc(r.verification)}</small></td></tr>`).join('')}</tbody></table></div><p class="bd-footnote">แหล่งข้อมูล: ทะเบียน Machines / Machines_Upper และ Documents · รายชื่อช่างที่มอบหมายได้ตรวจเมื่อเปิดรายการงาน · ผู้ยืนยันและวันที่ยืนยัน: ยังไม่ระบุ · รอนิยามความรุนแรง เวลาเป้าหมาย และหมวดสาเหตุ/อะไหล่จากเจ้าของกระบวนการ</p>` : '<p class="bd-message">ไม่มีเครื่องที่เปิดใช้งานตามค่าจากทะเบียน กรุณาให้ผู้ดูแลตรวจรายการเครื่อง</p>';
    button.disabled = false;
  }
  function renderDetail(data) {
    state.detail = data; state.dirty = false;
    const i = data.incident, actions = i.availableActions;
    $('#bd-register').hidden = true; hide('#bd-create', true); $('#bd-detail').hidden = false;
    $('#bd-detail-title').textContent = `${i.machineName} · ${statuses[i.status]}`;
    $('#bd-detail-subtitle').textContent = `${i.incidentId} · ข้อมูลรุ่น ${i.revision} · เวลาประเทศไทย`;
    if ($('#bd-next-section')) {
    const next = context.nextStep(i);
    $('#bd-next-action').textContent = next.title; $('#bd-next-description').textContent = next.text;
    $('#bd-next-owner').textContent = `ผู้รับผิดชอบ: ${i.technicianName || 'ยังไม่มอบหมาย'} · ทีม: ${i.responsibleTeam || 'ยังไม่ระบุ'}`;
    const reason = ['REWORK', 'WAITING_PARTS'].includes(i.status) ? [...data.events].reverse().find(e => e.operation === (i.status === 'REWORK' ? 'return' : 'waitParts'))?.comment : '';
    $('#bd-next-reason').hidden = !reason; $('#bd-next-reason').textContent = reason ? `เหตุผลล่าสุด: ${reason}` : '';
    let nextSection = next.target === '#bd-inspect-title' ? 'inspection' : ['#bd-assign-title', '#bd-start-title', '#bd-repair-title'].includes(next.target) ? 'repair' : next.target === '#bd-history-title' && terminal(i) ? 'analysis' : '';
    if (state.section === 'report') {
      nextSection = 'repair'; next.target = '#bd-assign-title';
      $('#bd-next-action').textContent = 'ใบงานซ่อมที่เกี่ยวข้อง';
      $('#bd-next-description').textContent = 'เปิดใบงานซ่อมของเหตุนี้เพื่อดูผู้รับผิดชอบและบันทึกผลซ่อม';
    }
    $('#bd-next-go').textContent = nextSection && nextSection !== state.section ? `เปิด${sections[nextSection].title}ที่เกี่ยวข้อง` : next.label;
    $('#bd-next-go').hidden = !next.target;
    $('#bd-next-go').dataset.target = next.target || '';
    $('#bd-next-go').dataset.section = nextSection && nextSection !== state.section ? nextSection : '';
    }
    $('#bd-full-detail').open = state.section !== 'repair' || ['PENDING_INSPECTION', 'CLOSED'].includes(i.status);
    loadContext(i);
    const fields = [
      ['เครื่องจักร / พื้นที่', `${i.machineId} · ${i.zone} · ${i.location || 'ไม่ระบุตำแหน่ง'}`], ['ความรุนแรง / การเดินเครื่อง', `${severities[i.severity]} · ${impacts[i.machineImpact]}`], ['พบเหตุ', date(i.occurredAt)],
      ['ผู้แจ้ง / ช่องทาง', `${i.reporterName} · ${i.reportChannel}`], ['ผู้รับผิดชอบ', `${i.technicianName || 'ยังไม่มอบหมาย'}${i.responsibleTeam ? ` · ${i.responsibleTeam}` : ''}`], ['ตอบรับงาน', date(i.acknowledgedAt)],
      ['เริ่มหยุดเครื่อง', date(i.stoppedAt)], ['เริ่มซ่อม', date(i.repairStartedAt)], ['คืนเครื่อง', date(i.restoredAt)],
      ['เวลาหยุดเครื่อง', i.restoredAt ? `${number(i.downtimeMinutes)} นาที` : 'ยังไม่สิ้นสุด / ยังไม่ระบุ'], ['ตรวจรับโดย', i.inspectorName || 'ยังไม่ตรวจรับ'], ['ปิดงาน', date(i.closedAt)],
      ['อาการที่พบ', i.symptoms, true], ['ผลกระทบต่อการผลิต', i.productionImpact, true], ['ข้อควรระวังด้านความปลอดภัย', i.safetyNotes, true],
      ['สาเหตุเบื้องต้น', i.preliminaryCause, true], ['จุดที่เสียและสาเหตุราก', i.rootCause, true], ['การแก้ไขชั่วคราว', i.temporaryAction, true], ['ซ่อมอย่างไร / วิธีแก้ไขถาวร', i.repairAction, true], ['อะไหล่ที่ใช้', i.partsUsed, true], ['ผลทดสอบ', i.testResult, true], ['หมายเหตุการซ่อม', i.repairNotes, true], ['ผลตรวจรับ', i.inspectionNote, true],
    ];
    const intakeFields = new Set(['เครื่องจักร / พื้นที่', 'ความรุนแรง / การเดินเครื่อง', 'พบเหตุ', 'ผู้แจ้ง / ช่องทาง', 'เริ่มหยุดเครื่อง', 'อาการที่พบ', 'ผลกระทบต่อการผลิต', 'ข้อควรระวังด้านความปลอดภัย']);
    const pageFields = state.section === 'report' ? fields.filter(([label]) => intakeFields.has(label)) : state.section === 'repair' ? fields.filter(([label]) => !['ตรวจรับโดย', 'ปิดงาน', 'ผลตรวจรับ'].includes(label)) : fields;
    const evidence = (i.evidenceUrls || []).map(url => { try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password ? `<li><a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(u.href)}</a></li>` : ''; } catch (_) { return ''; } }).join('');
    $('#bd-incident-summary').innerHTML = `<dl class="bd-facts">${pageFields.filter(f => f[1]).map(([label, value, wide]) => `<div${wide ? ' class="bd-fact-wide"' : ''}><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}${evidence ? `<div class="bd-fact-wide"><dt>หลักฐานประกอบ</dt><dd><ul class="bd-links">${evidence}</ul></dd></div>` : ''}</dl>`;
    hide('#bd-assign-section', state.section !== 'repair' || !actions.includes('assign'));
    hide('#bd-start-section', state.section !== 'repair' || !actions.includes('start'));
    hide('#bd-repair-section', state.section !== 'repair' || !actions.includes('saveRepair'));
    hide('#bd-inspect-section', state.section !== 'inspection' || !actions.includes('approve'));
    hide('#bd-cancel-section', !['report', 'repair'].includes(state.section) || !actions.includes('cancel'));
    if ($('#bd-assign-form')) $('#bd-assign-form').elements.technicianId.innerHTML = '<option value="">เลือกช่างที่เปิดใช้งาน</option>' + state.technicians.map(u => `<option value="${esc(u.userId)}">${esc(u.displayName || u.username)}</option>`).join('');
    fillForm($('#bd-assign-form'), i);
    fillForm($('#bd-start-form'), { repairStartedAt: toInput(new Date().toISOString()) });
    $('#bd-repair-form')?.reset(); fillForm($('#bd-repair-form'), { ...i, restoredAt: toInput(i.restoredAt) });
    $('#bd-inspect-form')?.reset(); $('#bd-cancel-form')?.reset();
    const visibleEvents = state.section === 'report' ? data.events.filter(e => ['create', 'cancel'].includes(e.operation)) : state.section === 'repair' ? data.events.filter(e => ['assign', 'start', 'saveRepair', 'waitParts', 'submit'].includes(e.operation)) : state.section === 'inspection' ? data.events.filter(e => ['approve', 'return'].includes(e.operation)) : data.events;
    $('#bd-events').innerHTML = visibleEvents.map(e => `<li><time datetime="${esc(e.recordedAt)}">${esc(date(e.recordedAt))}</time><div><strong>${esc(operations[e.operation] || e.operation)} · ${esc(statuses[e.toStatus])}</strong><small>${esc(e.actorName)} · ${esc(e.actorRole)} · รุ่น ${e.revision}</small>${e.comment ? `<p>${esc(e.comment)}</p>` : ''}</div></li>`).join('') || '<li>ยังโหลดประวัติไม่ได้ กรุณาโหลดเหตุล่าสุด</li>';
  }
  function allowLeave() { return !state.dirty || window.confirm('มีข้อมูลการซ่อมที่ยังไม่บันทึก ต้องการออกจากเหตุนี้โดยทิ้งการแก้ไขหรือไม่?'); }
  async function openDetail(id, { force = false } = {}) {
    if (state.busy) return;
    if (!force && state.detail?.incident.incidentId === id && state.dirty) { $('#bd-register').hidden = true; hide('#bd-create', true); $('#bd-detail').hidden = false; $('#bd-detail-title').focus(); return; }
    if (!force && !allowLeave()) return;
    busy(true); message('#bd-detail-message', 'กำลังโหลดรายละเอียด…');
    try { const data = await window.RDSiteAuth.apiRequest('getBreakdownIncident', { incidentId: id }); renderDetail(data); message('#bd-detail-message', 'ข้อมูลล่าสุดพร้อมใช้งาน'); $('#bd-detail-title').focus(); }
    catch (error) { message('#bd-message', errorText(error), 'error'); message('#bd-detail-message', errorText(error), 'error'); }
    finally { busy(false); render(); }
  }
  async function load() {
    if (state.busy) return;
    busy(true); message('#bd-message', 'กำลังโหลดรายการล่าสุด…');
    try {
      const data = await window.RDSiteAuth.apiRequest('getBreakdownWorkspace');
      Object.assign(state, { ...data, failed: false });
      hide('#bd-setup', data.ready); hide('#bd-setup-button', !data.canSetup);
      hide('#bd-new', state.section !== 'report' || !data.canCreate);
      hide('#bd-warning', state.section !== 'repair' || !data.warnings.length);
      $('#bd-warning').textContent = data.warnings.length ? 'ยังโหลดรายชื่อช่างไม่ได้ กรุณาตรวจการเชื่อมต่อและรายชื่อช่างก่อนมอบหมายงาน' : '';
      if ($('#bd-create-form')) {
      const selectedMachine = $('#bd-create-form').elements.machineId.value;
      $('#bd-create-form').elements.machineId.innerHTML = '<option value="">เลือกจากทะเบียนเครื่องจักร</option>' + data.machines.map(m => `<option value="${esc(m.machineId)}">${esc(m.machineId)} · ${esc(m.machineName)} · ${esc(m.zone)}</option>`).join('');
      $('#bd-create-form').elements.machineId.value = selectedMachine;
      }
      const zone = $('#bd-zone').value;
      $('#bd-zone').innerHTML = '<option value="">ทุกพื้นที่</option>' + [...new Set([...data.machines, ...data.incidents].map(i => i.zone))].filter(Boolean).map(z => `<option>${esc(z)}</option>`).join(''); $('#bd-zone').value = zone;
      message('#bd-message', !data.ready ? 'ยังไม่ได้เตรียมทะเบียน กรุณาให้ Admin หรือ Engineer เตรียมทะเบียนก่อน' : !data.machines.length ? 'ยังไม่มีเครื่องจักรที่เปิดใช้งาน กรุณาเพิ่มในทะเบียนก่อนแจ้งเหตุ' : `โหลดข้อมูลแล้ว ${date(new Date().toISOString())}${state.dirty ? ' · ฟอร์มที่เปิดอยู่ยังเก็บการแก้ไขไว้' : ''}`);
    } catch (error) { state.failed = true; message('#bd-message', errorText(error), 'error'); }
    finally { busy(false); render(); }
  }
  async function mutate(operation, fields, target) {
    if (state.busy) return;
    const payload = { operation, ...fields };
    if (operation !== 'create') Object.assign(payload, { incidentId: state.detail.incident.incidentId, expectedRevision: state.detail.incident.revision });
    const signature = JSON.stringify(payload);
    if (state.pending && state.pending.signature !== signature) { message(target, errors.BD_PENDING_CHANGED, 'error'); return; }
    const request = state.pending || { signature, payload: { ...payload, requestId: `BDREQ-${crypto.randomUUID()}` } };
    await sendRequest(request, target);
  }
  async function sendRequest(request, target) {
    busy(true); setPending(request); message(target, 'กำลังบันทึก…');
    try {
      const result = await window.RDSiteAuth.apiRequest('saveBreakdownWorkflow', request.payload);
      setPending(null);
      state.incidents = [result.incident, ...state.incidents.filter(i => i.incidentId !== result.incident.incidentId)].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      state.dirty = false;
      if (request.payload.operation === 'create') { $('#bd-create-form')?.reset(); state.createDirty = false; }
      try { const detail = await window.RDSiteAuth.apiRequest('getBreakdownIncident', { incidentId: result.incident.incidentId }); renderDetail(detail); state.incidents = state.incidents.map(i => i.incidentId === detail.incident.incidentId ? detail.incident : i); message('#bd-detail-message', 'บันทึกแล้ว พร้อมประวัติการดำเนินการล่าสุด', 'success'); }
      catch (_) { renderDetail({ incident: result.incident, events: [] }); message('#bd-detail-message', 'บันทึกแล้ว แต่โหลดประวัติไม่สำเร็จ กรุณาโหลดเหตุล่าสุด', 'error'); }
      message('#bd-message', 'บันทึกการดำเนินการแล้ว', 'success'); $('#bd-detail-title').focus();
    } catch (error) {
      if (errors[error.message] && error.message !== 'ACTION_NOT_AVAILABLE') setPending(null);
      message(target, errorText(error), 'error');
      $(target).setAttribute('tabindex', '-1'); $(target).focus();
      if (state.pending) message('#bd-message', 'ยังยืนยันผลการบันทึกไม่ได้ กดลองส่งคำขอเดิมอีกครั้งเพื่อป้องกันการบันทึกซ้ำ', 'error');
    } finally { busy(false); render(); }
  }
  function formData(form) { return Object.fromEntries(new FormData(form)); }
  function formHandler(id, operation, transform = data => data) {
    $(id)?.addEventListener('submit', event => {
      event.preventDefault();
      try { const data = transform(formData(event.currentTarget)); mutate(event.submitter?.dataset.operation || operation, data, id === '#bd-create-form' ? '#bd-create-message' : '#bd-detail-message'); }
      catch (error) { message(id === '#bd-create-form' ? '#bd-create-message' : '#bd-detail-message', errorText(error), 'error'); }
    });
  }
  applySection();
  const retry = document.createElement('button'); retry.type = 'button'; retry.id = 'bd-retry-request'; retry.className = 'bd-button secondary'; retry.textContent = 'ลองส่งคำขอเดิมอีกครั้ง'; retry.hidden = true; $('#bd-message').after(retry);
  retry.addEventListener('click', () => { if (state.pending && !state.busy) sendRequest(state.pending, '#bd-message'); });
  $('#bd-refresh')?.addEventListener('click', load);
  $('#bd-context-refresh')?.addEventListener('click', () => { if (state.detail) loadContext(state.detail.incident); });
  $('#bd-readiness-load')?.addEventListener('click', loadReadiness);
  $('#bd-next-go')?.addEventListener('click', () => {
    const section = $('#bd-next-go').dataset.section;
    if (section && state.detail) { location.assign(sectionHref(section, state.detail.incident.incidentId)); return; }
    const target = $($('#bd-next-go').dataset.target); if (target) { target.setAttribute('tabindex', '-1'); target.focus(); target.scrollIntoView({ block: 'start' }); }
  });
  $('#bd-setup-button')?.addEventListener('click', async () => { busy(true); try { await window.RDSiteAuth.apiRequest('setupBreakdown'); } catch (error) { message('#bd-message', errorText(error), 'error'); busy(false); return; } busy(false); await load(); });
  $('#bd-new')?.addEventListener('click', () => { if (!allowLeave()) return; state.dirty = false; hide('#bd-create', false); $('#bd-detail').hidden = true; $('#bd-register').hidden = true; if (!$('#bd-create-form').elements.occurredAt.value) $('#bd-create-form').elements.occurredAt.value = toInput(new Date().toISOString()); $('#bd-create-title').focus(); });
  $('#bd-create-close')?.addEventListener('click', () => { hide('#bd-create', true); $('#bd-register').hidden = false; $('#bd-new').focus(); });
  $('#bd-detail-close')?.addEventListener('click', () => { $('#bd-detail').hidden = true; $('#bd-register').hidden = false; clearIncidentReference(); $('#bd-refresh').focus(); });
  $('#bd-detail-reload')?.addEventListener('click', () => openDetail(state.detail.incident.incidentId, { force: true }));
  $('#bd-rows')?.addEventListener('click', event => { const b = event.target.closest('[data-incident]'); if (b) openDetail(b.dataset.incident); });
  $('#bd-pagination')?.addEventListener('click', event => { const b = event.target.closest('[data-page]'); if (b) { state.page += Number(b.dataset.page); render(); } });
  $('#bd-tabs')?.addEventListener('click', event => { const b = event.target.closest('[data-view]'); if (b) { state.view = b.dataset.view; state.page = 1; render(); } });
  filters.forEach(id => $(`#${id}`).addEventListener(id === 'bd-search' ? 'input' : 'change', () => { state.page = 1; render(); }));
  $('#bd-clear')?.addEventListener('click', () => { filters.forEach(id => { $(`#${id}`).value = ''; }); state.page = 1; render(); });
  $('#bd-detail')?.addEventListener('input', () => { state.dirty = true; message('#bd-detail-message', 'มีข้อมูลที่ยังไม่บันทึก'); });
  $('#bd-create-form')?.addEventListener('input', () => { state.createDirty = true; });
  window.addEventListener('beforeunload', event => { if (state.dirty || state.createDirty || state.pending) { event.preventDefault(); event.returnValue = ''; } });
  formHandler('#bd-create-form', 'create', data => ({ ...data, occurredAt: isoInput(data.occurredAt), stoppedAt: isoInput(data.stoppedAt), evidenceUrls: links(data.evidenceUrls) }));
  formHandler('#bd-assign-form', 'assign');
  formHandler('#bd-start-form', 'start', data => ({ repairStartedAt: isoInput(data.repairStartedAt) }));
  formHandler('#bd-repair-form', 'saveRepair', data => ({ ...data, restoredAt: isoInput(data.restoredAt), evidenceUrls: links(data.evidenceUrls) }));
  formHandler('#bd-inspect-form', 'approve', data => ({ ...data, comment: data.inspectionNote }));
  formHandler('#bd-cancel-form', 'cancel');
  window.RD_AUTH_READY.then(async actor => {
    state.actor = { ...actor, id: actor.id || actor.userId };
    try { const pending = JSON.parse(sessionStorage.getItem(pendingKey()) || 'null'); if (pending?.payload?.requestId && pending.signature) setPending(pending); } catch (_) { /* Ignore an invalid local retry record. */ }
    await load();
    render();
    const linkedIncident = new URLSearchParams(location.search).get('incident');
    if (linkedIncident) await openDetail(linkedIncident);
    if (state.pending) message('#bd-message', 'มีคำขอเดิมที่ยังไม่ทราบผล กดลองส่งคำขอเดิมอีกครั้งเพื่อยืนยันผล', 'error');
  }).catch(() => {});
})();
