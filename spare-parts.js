(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const list = $('#spare-list');
  if (!list) return;

  const config = window.RD_AUTH_CONFIG;
  const queryInput = $('#spare-query');
  const machineSelect = $('#spare-machine');
  const statusSelect = $('#spare-status');
  const searchButton = $('#spare-search-form button[type="submit"]');
  const loadMoreButton = $('#spare-load-more');
  const listState = $('#spare-list-state');
  const detailState = $('#spare-detail-state');
  const detailContent = $('#spare-detail-content');
  const statusNames = { normal: 'ปกติ', low: 'ใกล้หมด', out: 'หมด' };
  const thaiNumber = new Intl.NumberFormat('th-TH');
  const thaiDate = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' });
  const initialParams = new URLSearchParams(location.search);
  const initialMachineId = initialParams.get('machine_id') || '';
  const initialItemId = initialParams.get('item_id') || '';
  const state = {
    baseUrl: '', machines: new Map(), machineId: initialMachineId, query: '',
    items: [], cursor: null, generatedAt: '', selectedItemId: '',
    listController: null, detailController: null, listSequence: 0, detailSequence: 0,
    listBusy: false, moreFailed: false,
  };

  function validMachineId(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 80 && !/[\x00-\x1F\x7F]/.test(value);
  }

  function validItemId(value) {
    return typeof value === 'string' && /^[A-Za-z0-9._-]{1,128}$/.test(value);
  }

  function inventoryBaseUrl() {
    if (!config?.sparePartsEnabled || !config.sparePartsApiBaseUrl) return '';
    const url = new URL(config.sparePartsApiBaseUrl);
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (!(url.protocol === 'https:' || local) || url.username || url.password || url.search || url.hash) throw new Error('INVALID_API_CONFIG');
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  }

  function dateText(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'ยังไม่ระบุ' : thaiDate.format(date);
  }

  function showListState(message, retry = false, stateName = '') {
    $('#spare-list-message').textContent = message;
    $('#spare-retry').hidden = !retry;
    listState.dataset.state = stateName;
    listState.hidden = false;
  }

  function showDetailState(message, retry = false, stateName = '') {
    $('#spare-detail-message').textContent = message;
    $('#spare-detail-retry').hidden = !retry;
    detailState.dataset.state = stateName;
    detailState.hidden = false;
    detailContent.hidden = true;
  }

  function setSource(text, kind = '') {
    $('#spare-source').textContent = text;
    $('#spare-source').dataset.state = kind;
  }

  function updateUrl() {
    const url = new URL(location.href);
    if (state.machineId) url.searchParams.set('machine_id', state.machineId);
    else url.searchParams.delete('machine_id');
    if (state.selectedItemId) url.searchParams.set('item_id', state.selectedItemId);
    else url.searchParams.delete('item_id');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function showMachineContext() {
    const context = $('#spare-machine-context');
    if (!state.machineId) { context.hidden = true; return; }
    const machine = state.machines.get(state.machineId);
    $('#spare-machine-context-text').textContent = machine
      ? `${machine.name} · ${state.machineId}${machine.zone ? ` · ${machine.zone}` : ''}`
      : `รหัสเครื่องจักร ${state.machineId} ไม่อยู่ในทะเบียนที่ใช้งาน`;
    context.hidden = false;
  }

  function clearDetail() {
    state.detailController?.abort();
    state.detailSequence += 1;
    state.selectedItemId = '';
    $('#spare-detail-announcement').textContent = '';
    updateUrl();
    showDetailState('เลือกอะไหล่จากรายการเพื่อดูรายละเอียด');
    list.querySelectorAll('.spare-item').forEach((button) => button.setAttribute('aria-pressed', 'false'));
  }

  function activeMachine(record) {
    return !/^(false|0|inactive)$/i.test(String(record.active == null ? '' : record.active).trim());
  }

  async function loadMachines() {
    try {
      const records = await window.RDSiteAuth.apiRequest('listMachines');
      if (!Array.isArray(records)) throw new Error('INVALID_RESPONSE');
      const duplicateIds = new Set();
      records.filter(activeMachine).forEach((record) => {
        const id = String(record.machine_id || '').trim();
        if (!validMachineId(id)) return;
        if (state.machines.has(id)) { duplicateIds.add(id); return; }
        state.machines.set(id, { name: String(record.machine_name || id).trim(), zone: String(record.zone || '').trim() });
      });
      duplicateIds.forEach((id) => state.machines.delete(id));
      machineSelect.replaceChildren(new Option('ทุกเครื่องจักร', ''));
      [...state.machines].sort((a, b) => a[1].name.localeCompare(b[1].name, 'th') || a[0].localeCompare(b[0])).forEach(([id, machine]) => {
        machineSelect.add(new Option(`${machine.name} · ${id}`, id));
      });
      machineSelect.disabled = false;
      if (state.machineId && state.machines.has(state.machineId)) machineSelect.value = state.machineId;
      showMachineContext();
      if (state.machineId && !state.machines.has(state.machineId)) {
        showListState('รหัสเครื่องจักรนี้ไม่อยู่ในทะเบียน R&D ที่ใช้งาน หรือมีรหัสซ้ำ กรุณาล้างตัวกรองแล้วเลือกใหม่', false, 'error');
        return false;
      }
      return true;
    } catch (_) {
      machineSelect.replaceChildren(new Option('โหลดทะเบียนเครื่องจักรไม่ได้', ''));
      machineSelect.disabled = true;
      showMachineContext();
      if (state.machineId) {
        showListState('ยังยืนยันรหัสเครื่องจักรจากทะเบียน R&D ไม่ได้ กรุณาโหลดหน้านี้อีกครั้ง', true, 'error');
        return false;
      }
      return true; // Browsing all parts remains possible without a machine filter.
    }
  }

  function validateItem(item) {
    return item && typeof item === 'object' && validItemId(item.id)
      && typeof item.item_code === 'string' && typeof item.name === 'string'
      && Number.isInteger(item.current_stock) && item.current_stock >= 0
      && Number.isInteger(item.min_stock) && item.min_stock >= 0
      && Object.hasOwn(statusNames, item.stock_status)
      && Array.isArray(item.compatible_machines);
  }

  async function requestInventory(path, params, signal) {
    let token;
    try { token = await window.RDSiteAuth.getAccessToken(); }
    catch (error) {
      if (error.message === 'SESSION_EXPIRED') await window.RDSiteAuth.logout();
      throw error;
    }
    const url = new URL(`${state.baseUrl}${path}`);
    Object.entries(params || {}).forEach(([key, value]) => { if (value) url.searchParams.set(key, value); });
    const response = await fetch(url, {
      method: 'GET', headers: { Authorization: `Bearer ${token}` },
      credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal,
    });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) {
      await window.RDSiteAuth.logout();
      throw new Error('AUTH_REQUIRED');
    }
    if (!response.ok) throw new Error(String(body.error?.code || `HTTP_${response.status}`));
    return body;
  }

  function errorMessage(error, subject) {
    const code = String(error?.message || '');
    if (code === 'FORBIDDEN' || code === 'HTTP_403') return 'บัญชีนี้ไม่มีสิทธิ์อ่านข้อมูลอะไหล่จากระบบคลัง';
    if (code === 'MACHINE_NOT_FOUND') return 'ระบบคลังยังไม่รู้จักรหัสเครื่องจักรนี้ กรุณาตรวจการจับคู่รหัสกับทีมคลัง';
    if (code === 'ITEM_NOT_FOUND') return 'ไม่พบรายการอะไหล่นี้ในระบบคลัง';
    if (code === 'RATE_LIMITED' || code === 'HTTP_429') return 'ระบบคลังรับคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่';
    if (code === 'INVALID_RESPONSE') return `รูปแบบข้อมูล${subject}จากระบบคลังไม่ถูกต้อง กรุณาแจ้งผู้ดูแล`;
    return `โหลด${subject}จากระบบคลังไม่ได้ กรุณาลองอีกครั้ง`;
  }

  function renderList() {
    const visible = state.items.filter((item) => !statusSelect.value || item.stock_status === statusSelect.value);
    list.replaceChildren();
    $('#spare-results-summary').textContent = state.items.length
      ? `แสดง ${thaiNumber.format(visible.length)} จาก ${thaiNumber.format(state.items.length)} รายการที่โหลดแล้ว${state.cursor ? ' · มีรายการถัดไป' : ''}`
      : '0 รายการที่โหลดแล้ว';
    $('#spare-generated-at').textContent = state.generatedAt ? `ข้อมูล ณ ${dateText(state.generatedAt)}` : '';
    $('#spare-generated-at').dateTime = state.generatedAt || '';
    if (!visible.length) {
      list.hidden = true;
      if (statusSelect.value && state.items.length) showListState(`ไม่พบสถานะ “${statusNames[statusSelect.value]}” ในรายการที่โหลดแล้ว${state.cursor ? ' · อาจมีในหน้าถัดไป' : ''}`);
      else if (state.machineId) showListState('เครื่องนี้ยังไม่มีอะไหล่ที่ผูกไว้ในระบบคลัง');
      else if (state.query) showListState('ไม่พบอะไหล่ตามคำค้นนี้');
      else showListState('ยังไม่มีรายการอะไหล่ในระบบคลัง');
    } else {
      listState.hidden = true;
      list.hidden = false;
      visible.forEach((item) => {
        const row = document.createElement('li');
        const button = document.createElement('button');
        button.className = 'spare-item';
        button.type = 'button';
        button.dataset.itemId = item.id;
        button.setAttribute('aria-pressed', String(item.id === state.selectedItemId));
        const identity = document.createElement('span');
        identity.className = 'spare-item-identity';
        const code = document.createElement('small'); code.textContent = item.item_code;
        const name = document.createElement('strong'); name.textContent = item.name;
        const part = document.createElement('span'); part.textContent = item.part_no ? `Part No. ${item.part_no}` : 'ยังไม่ระบุ Part No.';
        identity.append(code, name, part);
        const status = document.createElement('span');
        status.className = `spare-stock-label is-${item.stock_status}`;
        status.textContent = statusNames[item.stock_status];
        const amount = document.createElement('strong');
        amount.className = 'spare-item-amount';
        amount.textContent = `${thaiNumber.format(item.current_stock)} ${String(item.unit || '').trim()}`;
        button.append(identity, status, amount);
        row.append(button);
        list.append(row);
      });
    }
    loadMoreButton.hidden = !state.cursor;
    loadMoreButton.disabled = state.listBusy;
  }

  async function loadList(reset = true) {
    if (!state.baseUrl) return;
    if (state.machineId && !state.machines.has(state.machineId)) {
      showListState('กรุณาเลือกรหัสเครื่องจักรที่ยืนยันจากทะเบียน R&D', false, 'error');
      return;
    }
    if (!reset && !state.cursor) return;
    state.listController?.abort();
    const controller = new AbortController();
    const sequence = ++state.listSequence;
    state.listController = controller;
    state.listBusy = true;
    state.moreFailed = !reset;
    if (reset) {
      state.items = [];
      state.cursor = null;
      state.generatedAt = '';
      list.hidden = true;
      list.replaceChildren();
      $('#spare-results-summary').textContent = 'กำลังโหลดข้อมูล';
      $('#spare-generated-at').textContent = '';
      clearDetail();
    }
    showListState(reset ? 'กำลังอ่านรายการจากระบบคลัง…' : 'กำลังโหลดรายการถัดไป…', false, 'loading');
    loadMoreButton.disabled = true;
    try {
      const payload = await requestInventory('/api/rd/spare-parts', {
        q: state.query, machine_id: state.machineId, limit: '50', cursor: reset ? '' : state.cursor,
      }, controller.signal);
      if (sequence !== state.listSequence) return;
      if (!Array.isArray(payload.items) || !payload.items.every(validateItem)
        || !(payload.next_cursor === null || typeof payload.next_cursor === 'string')
        || typeof payload.generated_at !== 'string' || Number.isNaN(new Date(payload.generated_at).getTime())) throw new Error('INVALID_RESPONSE');
      const byId = new Map(state.items.map((item) => [item.id, item]));
      payload.items.forEach((item) => byId.set(item.id, item));
      state.items = [...byId.values()];
      state.cursor = payload.next_cursor;
      state.generatedAt = payload.generated_at;
      setSource('อ่านข้อมูลล่าสุดจากระบบคลังแล้ว · ไม่มีการเก็บยอดสำเนาในเว็บ R&D', 'ready');
      renderList();
    } catch (error) {
      if (controller.signal.aborted || sequence !== state.listSequence) return;
      setSource('การเชื่อมต่อระบบคลังไม่พร้อม · ไม่ได้รับข้อมูลล่าสุด', 'error');
      if (reset) {
        state.items = [];
        state.cursor = null;
        state.generatedAt = '';
        list.hidden = true;
        $('#spare-generated-at').textContent = '';
        $('#spare-results-summary').textContent = 'โหลดข้อมูลไม่สำเร็จ';
      }
      showListState(errorMessage(error, 'รายการอะไหล่'), true, 'error');
      loadMoreButton.hidden = true;
    } finally {
      if (sequence === state.listSequence) {
        state.listBusy = false;
        loadMoreButton.disabled = false;
      }
    }
  }

  function renderDetail(item, generatedAt) {
    $('#spare-detail-code').textContent = item.item_code;
    $('#spare-detail-name').textContent = item.name;
    $('#spare-detail-size').textContent = item.size || 'ยังไม่ระบุสเปก/ขนาด';
    $('#spare-detail-quantity').textContent = `${thaiNumber.format(item.current_stock)} ${String(item.unit || '').trim()}`;
    $('#spare-detail-status').textContent = statusNames[item.stock_status];
    $('#spare-detail-status').className = `spare-stock-label is-${item.stock_status}`;
    $('#spare-detail-part-no').textContent = item.part_no || 'ยังไม่ระบุ';
    $('#spare-detail-unit').textContent = item.unit || 'ยังไม่ระบุ';
    $('#spare-detail-minimum').textContent = thaiNumber.format(item.min_stock);
    $('#spare-detail-category').textContent = item.category || 'ยังไม่ระบุ';
    $('#spare-detail-updated').textContent = dateText(item.updated_at || generatedAt);
    const compatible = $('#spare-compatible-list');
    compatible.replaceChildren();
    if (!item.compatible_machines.length) {
      const entry = document.createElement('li'); entry.textContent = 'ยังไม่ระบุเครื่องจักรที่ใช้ร่วมกัน'; compatible.append(entry);
    } else item.compatible_machines.forEach((machine) => {
      const entry = document.createElement('li');
      entry.textContent = `${String(machine.machine_name || machine.machine_id || 'ไม่ระบุชื่อ')} · ${String(machine.machine_id || 'ไม่ระบุรหัส')}${machine.zone ? ` · ${machine.zone}` : ''}`;
      compatible.append(entry);
    });
    const image = $('#spare-detail-image');
    const fallback = $('#spare-image-fallback');
    const media = image.parentElement;
    media.classList.add('is-placeholder');
    image.hidden = true;
    image.removeAttribute('src');
    fallback.hidden = false;
    fallback.textContent = 'ไม่มีรูปภาพอะไหล่';
    if (item.image_url) {
      try {
        const url = new URL(item.image_url);
        if (url.protocol === 'https:') {
          image.alt = `รูปอะไหล่ ${item.name}`;
          image.onerror = () => { image.hidden = true; fallback.hidden = false; fallback.textContent = 'เปิดรูปภาพไม่ได้ · รายละเอียดอะไหล่ยังอ่านได้'; media.classList.add('is-placeholder'); };
          image.onload = () => { image.hidden = false; fallback.hidden = true; media.classList.remove('is-placeholder'); };
          image.src = url.href;
        }
      } catch (_) { fallback.textContent = 'รูปภาพไม่พร้อม · รายละเอียดอะไหล่ยังอ่านได้'; }
    }
    detailState.hidden = true;
    detailContent.hidden = false;
    $('#spare-detail-announcement').textContent = `โหลดรายละเอียดอะไหล่ ${item.name} แล้ว`;
    list.querySelectorAll('.spare-item').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.itemId === item.id)));
  }

  async function loadDetail(itemId) {
    if (!state.baseUrl || !validItemId(itemId)) return;
    state.detailController?.abort();
    const controller = new AbortController();
    const sequence = ++state.detailSequence;
    state.detailController = controller;
    state.selectedItemId = itemId;
    updateUrl();
    showDetailState('กำลังอ่านรายละเอียดจากระบบคลัง…', false, 'loading');
    try {
      const payload = await requestInventory(`/api/rd/spare-parts/${encodeURIComponent(itemId)}`, {}, controller.signal);
      if (sequence !== state.detailSequence) return;
      if (!validateItem(payload.item) || payload.item.id !== itemId || typeof payload.generated_at !== 'string' || Number.isNaN(new Date(payload.generated_at).getTime())) throw new Error('INVALID_RESPONSE');
      renderDetail(payload.item, payload.generated_at);
    } catch (error) {
      if (controller.signal.aborted || sequence !== state.detailSequence) return;
      showDetailState(errorMessage(error, 'รายละเอียดอะไหล่'), error.message !== 'ITEM_NOT_FOUND', 'error');
    }
  }

  $('#spare-search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    state.query = queryInput.value.trim();
    loadList(true);
  });
  machineSelect.addEventListener('change', () => {
    state.machineId = machineSelect.value;
    showMachineContext();
    updateUrl();
    loadList(true);
  });
  statusSelect.addEventListener('change', () => { if (state.generatedAt) renderList(); });
  $('#spare-clear-machine').addEventListener('click', () => {
    state.machineId = '';
    machineSelect.value = '';
    showMachineContext();
    updateUrl();
    loadList(true);
    machineSelect.focus();
  });
  $('#spare-retry').addEventListener('click', async () => {
    if (state.machineId && !state.machines.has(state.machineId)) {
      if (await loadMachines()) loadList(true);
    } else loadList(!state.moreFailed);
  });
  loadMoreButton.addEventListener('click', () => loadList(false));
  $('#spare-detail-retry').addEventListener('click', () => loadDetail(state.selectedItemId));
  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-item-id]');
    if (button) loadDetail(button.dataset.itemId);
  });

  window.RD_AUTH_READY?.then(async () => {
    try { state.baseUrl = inventoryBaseUrl(); }
    catch (_) {
      setSource('การตั้งค่า URL ระบบคลังไม่ถูกต้อง', 'error');
      showListState('ผู้ดูแลต้องตรวจ URL ของ Inventory Worker ก่อนเปิดใช้งาน', false, 'error');
      return;
    }
    const machineReady = await loadMachines();
    if (!state.baseUrl) {
      setSource('รอเปิด API ระบบคลัง · ยังไม่แสดงข้อมูลสต็อกจริง', 'pending');
      showListState('หน้าอ่านอย่างเดียวพร้อมแล้ว แต่ยังไม่ได้เชื่อม Inventory Worker จึงไม่แสดงรายการหรือยอดคงเหลือ', false, 'pending');
      queryInput.disabled = true;
      statusSelect.disabled = true;
      searchButton.disabled = true;
      return;
    }
    if (!machineReady || (state.machineId && !validMachineId(state.machineId))) return;
    await loadList(true);
    if (validItemId(initialItemId)) loadDetail(initialItemId);
  }).catch(() => {});
})();
