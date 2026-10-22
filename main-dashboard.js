(function () {
  'use strict';

  const openContent = document.querySelector('#breakdown-open-content');
  const latestContent = document.querySelector('#breakdown-latest-content');
  const count = document.querySelector('#breakdown-open-count');
  const urgentAlert = document.querySelector('#main-urgent-alert');
  const machineState = document.querySelector('#main-machine-state');
  const pmState = document.querySelector('#main-pm-state');
  const upcomingState = document.querySelector('#main-pm-upcoming-state');
  if (!openContent || !latestContent || !count || !urgentAlert || !machineState || !pmState || !upcomingState) return;

  const statusNames = {
    OPEN: 'รับแจ้งแล้ว', ASSIGNED: 'มอบหมายแล้ว', IN_PROGRESS: 'กำลังซ่อม',
    WAITING_PARTS: 'รออะไหล่', PENDING_INSPECTION: 'รอตรวจรับ', REWORK: 'ส่งกลับแก้ไข',
    CLOSED: 'ปิดงาน', CANCELLED: 'ยกเลิก',
  };
  const severityNames = { CRITICAL: 'วิกฤต', HIGH: 'สูง', NORMAL: 'ปกติ', LOW: 'ต่ำ' };
  const numberFormat = new Intl.NumberFormat('th-TH');
  const dateFormat = new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok',
  });
  const shortDateFormat = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' });
  const timeFormat = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
  const machineFields = ['normal', 'stopped', 'warning'].map((key) => document.querySelector(`#main-machine-${key}`));
  const pmFields = ['today', 'near', 'overdue'].map((key) => document.querySelector(`#main-pm-${key}`));
  const scheduleFields = ['daily', 'monthly', 'yearly'].map((key) => document.querySelector(`#main-pm-${key}`));

  function incidentHref(incident) {
    const section = incident.status === 'PENDING_INSPECTION' ? 'inspection'
      : incident.status === 'CLOSED' ? 'analysis'
        : incident.status === 'OPEN' ? 'report' : 'repair';
    return `machine-breakdown.html?${new URLSearchParams({ section, incident: incident.incidentId })}`;
  }

  function incidentTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'ยังไม่ระบุเวลาเกิดเหตุ' : dateFormat.format(date);
  }

  function showState(target, message, canRetry = false) {
    const paragraph = document.createElement('p');
    paragraph.className = 'breakdown-overview-state';
    paragraph.textContent = message;
    target.replaceChildren(paragraph);
    if (canRetry) {
      const retry = document.createElement('button');
      retry.className = 'breakdown-overview-retry';
      retry.type = 'button';
      retry.textContent = 'ลองโหลดอีกครั้ง';
      retry.addEventListener('click', () => refreshSection('breakdown', true));
      target.append(retry);
    }
  }

  function renderUrgentAlert(machines, breakdown, pm) {
    urgentAlert.replaceChildren();
    const machinesReady = Boolean(machines?.ok && Number.isInteger(machines.data?.breakdown));
    const breakdownReady = Boolean(breakdown?.ok && breakdown.data?.ready);
    const pmReady = Boolean(pm?.ok && pm.data?.ready);
    const messages = [];
    if (machinesReady && machines.data.breakdown > 0) {
      messages.push({ text: `ทะเบียนเครื่องจักรสถานะขัดข้อง ${numberFormat.format(machines.data.breakdown)} เครื่อง`, href: 'machine-data-recording.html', action: 'ดูทะเบียนเครื่องจักร' });
    }
    if (breakdownReady && breakdown.data.urgentOpenCount > 0) {
      messages.push({ text: `Break Down ระดับสูง/วิกฤตยังไม่ปิด ${numberFormat.format(breakdown.data.urgentOpenCount)} เหตุ`, href: 'machine-breakdown-repair.html', action: 'ดูใบงานซ่อม' });
    }
    if (pmReady && pm.data.overdue > 0) {
      messages.push({ text: `แผน PM เกินกำหนด ${numberFormat.format(pm.data.overdue)} รายการ`, href: 'preventive-maintenance.html', action: 'ดูแผน PM' });
    }
    if (!messages.length && machinesReady && breakdownReady && pmReady) {
      urgentAlert.textContent = 'ไม่พบเครื่องจักรสถานะขัดข้อง เหตุ Break Down ระดับสูง/วิกฤตที่ยังไม่ปิด หรือแผน PM เกินกำหนด';
      return;
    }
    messages.forEach((message, index) => {
      if (index) urgentAlert.append(document.createTextNode(' · '));
      urgentAlert.append(document.createTextNode(`${message.text} · `));
      const link = document.createElement('a');
      link.href = message.href;
      link.textContent = message.action;
      urgentAlert.append(link);
    });
    if (!machinesReady || !breakdownReady || !pmReady) {
      if (messages.length) urgentAlert.append(document.createTextNode(' · '));
      urgentAlert.append(document.createTextNode(`ยังตรวจสอบ${[!machinesReady && 'ทะเบียนเครื่องจักร', !breakdownReady && 'Break Down', !pmReady && 'PM'].filter(Boolean).join(' และ ')}ได้ไม่ครบ`));
    }
  }

  function updatedAt(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : ` · อัปเดต ${timeFormat.format(date)} น.`;
  }

  function renderMachineSummary(section, generatedAt) {
    const data = section?.ok ? section.data : null;
    if (!data || !['normal', 'stopped', 'warning', 'breakdown', 'unclassified', 'total'].every((key) => Number.isInteger(data[key]) && data[key] >= 0)) {
      machineFields.forEach((field) => { field.textContent = '—'; });
      machineState.textContent = 'โหลดทะเบียนเครื่องจักรไม่สำเร็จ · กรุณาลองเปิดหน้าอีกครั้ง';
      return null;
    }
    [data.normal, data.stopped, data.warning].forEach((value, index) => { machineFields[index].textContent = numberFormat.format(value); });
    machineState.textContent = `${numberFormat.format(data.total)} เครื่องในทะเบียน${data.unclassified ? ` · ไม่ระบุสถานะ ${numberFormat.format(data.unclassified)} เครื่อง` : ''}${updatedAt(generatedAt)}`;
    return data;
  }

  function scheduleDate(value) {
    const date = new Date(`${value}T00:00:00+07:00`);
    return Number.isNaN(date.getTime()) ? value : shortDateFormat.format(date);
  }

  function renderSchedule(target, schedule) {
    target.replaceChildren();
    if (!schedule.count) {
      const empty = document.createElement('p');
      empty.textContent = 'ยังไม่มีแผนรอบนี้ที่ครบกำหนดในอนาคต';
      target.append(empty);
      return;
    }
    const countLabel = document.createElement('strong');
    countLabel.className = 'schedule-count';
    countLabel.textContent = `${numberFormat.format(schedule.count)} รายการถัดไป`;
    const list = document.createElement('ul');
    list.className = 'schedule-list';
    schedule.items.forEach((item) => {
      const entry = document.createElement('li');
      const name = document.createElement('strong');
      name.textContent = item.machineName || 'ไม่ระบุชื่อเครื่องจักร';
      const detail = document.createElement('span');
      detail.textContent = `${scheduleDate(item.dueDate)} · ${item.task || 'ไม่ระบุงาน PM'}`;
      entry.append(name, detail);
      list.append(entry);
    });
    target.append(countLabel, list);
  }

  function renderPmSummary(section) {
    const data = section?.ok ? section.data : null;
    const valid = data && data.ready === true && ['todayTotal', 'nearDue', 'overdue', 'unreadyCount', 'otherCycleCount'].every((key) => Number.isInteger(data[key]) && data[key] >= 0)
      && ['daily', 'monthly', 'yearly'].every((key) => Number.isInteger(data.schedules?.[key]?.count) && Array.isArray(data.schedules[key].items));
    if (!valid) {
      pmFields.forEach((field) => { field.textContent = '—'; });
      const message = data?.ready === false ? 'ทะเบียนแผน PM ยังไม่พร้อม · ต้องเตรียมข้อมูลก่อนแสดงจำนวน' : 'โหลดแผน PM ไม่สำเร็จ · กรุณาลองเปิดหน้าอีกครั้ง';
      pmState.textContent = message;
      upcomingState.textContent = message;
      scheduleFields.forEach((field) => { field.replaceChildren(); const p = document.createElement('p'); p.textContent = 'ยังแสดงกำหนดไม่ได้'; field.append(p); });
      return null;
    }
    [data.todayTotal, data.nearDue, data.overdue].forEach((value, index) => { pmFields[index].textContent = numberFormat.format(value); });
    pmState.textContent = `อ้างอิงวันครบกำหนดของแผน${data.unreadyCount ? ` · อีก ${numberFormat.format(data.unreadyCount)} แผนยังไม่พร้อมนับ` : ''}${updatedAt(data.generatedAt)}`;
    ['daily', 'monthly', 'yearly'].forEach((cycle, index) => renderSchedule(scheduleFields[index], data.schedules[cycle]));
    upcomingState.textContent = data.otherCycleCount
      ? `แสดงรอบรายวัน รายเดือน และรายปี · รอบอื่นอีก ${numberFormat.format(data.otherCycleCount)} รายการดูได้ในภาพรวม PM`
      : `แสดงกำหนดถัดไปสูงสุด 2 รายการต่อรอบ${updatedAt(data.generatedAt)}`;
    return data;
  }

  function createIncidentLink(incident) {
    const link = document.createElement('a');
    link.className = 'breakdown-incident-link';
    link.href = incidentHref(incident);

    const name = document.createElement('strong');
    name.textContent = incident.machineName || incident.machineId || 'ไม่ระบุชื่อเครื่องจักร';
    const detail = document.createElement('span');
    detail.textContent = [incident.machineId, incident.zone].filter(Boolean).join(' · ') || 'ยังไม่ระบุพื้นที่';
    link.append(name, detail);
    return link;
  }

  function renderOpen(data) {
    count.textContent = numberFormat.format(data.openCount);
    count.setAttribute('aria-label', `เหตุที่ยังไม่ปิดงาน ${data.openCount} เหตุ`);
    if (!data.openIncidents.length) {
      showState(openContent, 'ไม่มีเหตุขัดข้องที่ยังไม่ปิดงาน');
      return;
    }
    const list = document.createElement('ul');
    list.className = 'breakdown-incident-list';
    data.openIncidents.forEach((incident) => {
      const item = document.createElement('li');
      const link = createIncidentLink(incident);
      const meta = document.createElement('div');
      meta.className = 'breakdown-incident-meta';
      const status = document.createElement('span');
      status.className = 'breakdown-incident-status';
      status.textContent = statusNames[incident.status] || 'ไม่ระบุสถานะ';
      const time = document.createElement('time');
      time.textContent = incidentTime(incident.occurredAt);
      if (!Number.isNaN(new Date(incident.occurredAt).getTime())) time.dateTime = incident.occurredAt;
      meta.append(status, time);
      item.append(link, meta);
      list.append(item);
    });
    openContent.replaceChildren(list);
  }

  function renderLatest(incident) {
    if (!incident) {
      showState(latestContent, 'ยังไม่มีการแจ้งเหตุ Break Down');
      return;
    }
    const article = document.createElement('article');
    article.className = 'breakdown-latest-incident';
    const link = createIncidentLink(incident);
    const facts = document.createElement('dl');
    facts.className = 'breakdown-latest-facts';
    const values = [
      ['เกิดเหตุ', incidentTime(incident.occurredAt)],
      ['สถานะ', statusNames[incident.status] || 'ไม่ระบุสถานะ'],
      ['ความรุนแรง', severityNames[incident.severity] || 'ยังไม่ระบุ'],
    ];
    values.forEach(([label, value]) => {
      const pair = document.createElement('div');
      const term = document.createElement('dt');
      const detail = document.createElement('dd');
      term.textContent = label;
      detail.textContent = value;
      pair.append(term, detail);
      facts.append(pair);
    });
    article.append(link, facts);
    latestContent.replaceChildren(article);
  }

  function renderBreakdownSummary(section) {
    const data = section?.ok ? section.data : null;
    if (!data || typeof data.ready !== 'boolean' || !Array.isArray(data.openIncidents) || !Number.isInteger(data.openCount) || !Number.isInteger(data.urgentOpenCount)) {
      count.textContent = '—';
      count.setAttribute('aria-label', 'ยังโหลดจำนวนเหตุไม่ได้');
      showState(openContent, 'โหลดข้อมูล Break Down ไม่สำเร็จ', true);
      showState(latestContent, 'โหลดข้อมูล Break Down ไม่สำเร็จ', true);
      return null;
    }
    if (!data.ready) {
      count.textContent = '—';
      count.setAttribute('aria-label', 'ยังไม่ได้เตรียมทะเบียนเหตุ Break Down');
      showState(openContent, 'ยังไม่ได้เตรียมทะเบียนเหตุ Break Down');
      showState(latestContent, 'ยังไม่มีทะเบียนสำหรับอ่านเหตุล่าสุด');
      return null;
    }
    renderOpen(data);
    renderLatest(data.latestIncident);
    return data;
  }

  const refreshConfig = {
    machines: { action: 'getMachineSummary', interval: 3 * 60 * 1000 },
    pm: { action: 'getPmDashboard', interval: 5 * 60 * 1000 },
    breakdown: { action: 'getBreakdownDashboard', interval: 60 * 1000 },
  };
  const sections = Object.keys(refreshConfig);
  const sectionState = Object.fromEntries(sections.map((section) => [section, {
    result: null, revision: '', lastAttemptAt: 0, lastSuccessAt: 0, day: '', loading: false,
  }]));
  const bangkokDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' });
  let initialLoading = false;

  function revisionFor(section) {
    try { return localStorage.getItem(`rd-dashboard-changed:${section}`) || ''; } catch (_) { return ''; }
  }

  function renderSection(section, result, generatedAt) {
    const state = sectionState[section];
    state.result = result;
    if (section === 'machines') renderMachineSummary(result, generatedAt);
    else if (section === 'pm') renderPmSummary(result);
    else renderBreakdownSummary(result);
    renderUrgentAlert(sectionState.machines.result, sectionState.breakdown.result, sectionState.pm.result);
  }

  function needsRefresh(section) {
    const state = sectionState[section];
    if (revisionFor(section) !== state.revision) return true;
    if (section === 'pm' && state.day && state.day !== bangkokDate.format(new Date())) return true;
    if (!state.lastAttemptAt) return true;
    if (!state.result?.ok) return Date.now() - state.lastAttemptAt >= 60000;
    return Date.now() - state.lastSuccessAt >= refreshConfig[section].interval;
  }

  async function refreshSection(section, force = false) {
    const state = sectionState[section];
    if (!state || initialLoading || document.hidden || state.loading || (!force && !needsRefresh(section))) return;
    const requestedRevision = revisionFor(section);
    state.loading = true;
    state.lastAttemptAt = Date.now();
    try {
      const data = await window.RDSiteAuth.apiRequest(refreshConfig[section].action);
      state.lastSuccessAt = Date.now();
      state.revision = requestedRevision;
      if (section === 'pm') state.day = bangkokDate.format(new Date(data.generatedAt || Date.now()));
      renderSection(section, { ok: true, data }, new Date().toISOString());
    } catch (_) {
      renderSection(section, { ok: false });
    } finally {
      state.loading = false;
      // A write made while this request was running may not be in its response.
      if (!document.hidden && revisionFor(section) !== requestedRevision) refreshSection(section, true);
    }
  }

  function refreshDue() {
    if (!initialLoading && !document.hidden) sections.forEach((section) => refreshSection(section));
  }

  async function loadMainDashboard() {
    initialLoading = true;
    urgentAlert.textContent = 'กำลังตรวจสอบเหตุ Break Down และ PM เกินกำหนด…';
    const revisions = Object.fromEntries(sections.map((section) => [section, revisionFor(section)]));
    const startedAt = Date.now();
    try {
      const response = await window.RDSiteAuth.apiRequest('getMainDashboard');
      if (!response || !response.machines || !response.pm || !response.breakdown) throw new Error('INVALID_RESPONSE');
      sections.forEach((section) => {
        const state = sectionState[section];
        state.revision = revisions[section];
        state.lastAttemptAt = startedAt;
        if (response[section].ok) state.lastSuccessAt = Date.now();
        if (section === 'pm' && response.pm.ok) state.day = bangkokDate.format(new Date(response.pm.data.generatedAt || Date.now()));
        renderSection(section, response[section], response.generatedAt);
      });
    } catch (_) {
      sections.forEach((section) => {
        sectionState[section].revision = revisions[section];
        sectionState[section].lastAttemptAt = startedAt;
        renderSection(section, { ok: false });
      });
    } finally {
      initialLoading = false;
      refreshDue();
    }
  }

  window.RD_AUTH_READY?.then(() => {
    loadMainDashboard();
    window.setInterval(refreshDue, 60000);
    document.addEventListener('visibilitychange', refreshDue);
    window.addEventListener('focus', refreshDue);
    window.addEventListener('storage', (event) => {
      const section = event.key?.replace(/^rd-dashboard-changed:/, '');
      if (section && sectionState[section] && event.key === `rd-dashboard-changed:${section}`) refreshSection(section);
    });
    window.addEventListener('rd-dashboard-data-changed', (event) => refreshSection(event.detail?.section));
  }).catch(() => {});
})();
