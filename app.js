const appShell = document.querySelector('#app-shell');
const sidebarToggle = document.querySelector('#sidebar-toggle');
const themeToggle = document.querySelector('#theme-toggle');
const themeColor = document.querySelector('meta[name="theme-color"]');

function setTheme(theme) {
  const isLight = theme === 'light';
  appShell.classList.toggle('is-light', isLight);
  themeToggle.setAttribute('aria-pressed', String(isLight));
  themeToggle.setAttribute('aria-label', isLight ? 'เปลี่ยนเป็นโหมดเข้ม' : 'เปลี่ยนเป็นโหมดสว่าง');
  themeToggle.setAttribute('title', isLight ? 'เปลี่ยนเป็นโหมดเข้ม' : 'เปลี่ยนเป็นโหมดสว่าง');
  themeColor.setAttribute('content', isLight ? '#f6f6f7' : '#111319');
  localStorage.setItem('engineering-workspace-theme', theme);
}

setTheme(localStorage.getItem('engineering-workspace-theme') || 'dark');

function setCollapsed(collapsed) {
  appShell.classList.toggle('is-collapsed', collapsed);
  sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
  sidebarToggle.setAttribute('aria-label', collapsed ? 'เปิดแถบนำทาง' : 'ย่อแถบนำทาง');
  sidebarToggle.setAttribute('title', collapsed ? 'เปิดแถบนำทาง' : 'ย่อแถบนำทาง');
}

sidebarToggle.addEventListener('click', () => {
  setCollapsed(!appShell.classList.contains('is-collapsed'));
});

themeToggle.addEventListener('click', () => {
  setTheme(appShell.classList.contains('is-light') ? 'dark' : 'light');
});

const MACHINE_PAGE_SIZE = 10;
const machineCodeCollator = new Intl.Collator(['th', 'en'], { numeric: true, sensitivity: 'base' });
const machineTableBody = document.querySelector('#machine-table-body');
const machineSearch = document.querySelector('#machine-search');
const machineStatusFilter = document.querySelector('#machine-status-filter');
const machineTabs = document.querySelectorAll('.machine-tab');
const machineTabPanels = document.querySelectorAll('.machine-tab-panel');
const machineDetail = document.querySelector('#machine-detail');
const machineWorkbench = document.querySelector('#machine-workbench');
const machineLoadState = document.querySelector('#machine-load-state');
const machineRetry = document.querySelector('#machine-retry');
const previousPageButton = document.querySelector('#machine-page-previous');
const nextPageButton = document.querySelector('#machine-page-next');
const paginationSummary = document.querySelector('#machine-pagination-summary');

let machineDetails = new Map();
let allMachines = [];
let filteredMachines = [];
let selectedMachineId = '';
let machinePage = 1;

function compareMachinesByCode(left, right) {
  return machineCodeCollator.compare(left.code, right.code)
    || machineCodeCollator.compare(left.name, right.name);
}

const statusPresentation = {
  'กำลังทำงาน': { key: 'running', className: 'is-running' },
  'หยุด': { key: 'stopped', className: 'is-stopped' },
  'ซ่อมบำรุง': { key: 'maintenance', className: 'is-maintenance' },
  'ขัดข้อง': { key: 'breakdown', className: 'is-breakdown' },
};

function formatMachineTimestamp(value) {
  if (!value) return 'ยังไม่มีข้อมูลเวลา';
  const normalized = String(value).replace(/\s*\([^)]*\)\s*$/, '');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function normalizeDriveImageUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  const pathMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  const queryMatch = url.match(/[?&]id=([^&]+)/i);
  const fileId = pathMatch?.[1] || queryMatch?.[1];
  return fileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1200` : url;
}

function toMachineModel(record) {
  const status = String(record.status || 'ไม่ระบุสถานะ');
  const presentation = statusPresentation[status] || { key: 'pending', className: 'is-pending' };
  const code = String(record.machine_id || '').trim();
  const name = String(record.machine_name || code || 'ไม่ระบุชื่อ').trim();
  const zone = String(record.zone || 'ไม่ระบุโซน').trim();
  const location = String(record.location || 'ไม่ระบุตำแหน่ง').trim();
  const type = String(record.machine_type || 'ไม่ระบุประเภท').trim();
  const team = String(record.owner_team || 'ยังไม่ระบุทีมดูแล').trim();
  return {
    id: code,
    code,
    name,
    zone,
    location,
    locationLabel: `${zone} · ${location}`,
    type,
    status,
    statusKey: presentation.key,
    statusClass: presentation.className,
    team,
    updated: formatMachineTimestamp(record.last_updated_at),
    imageUrl: normalizeDriveImageUrl(record.image_url),
    imageSource: String(record.image_url || '').trim(),
    search: [name, code, zone, location, type, status, team].join(' ').toLowerCase(),
  };
}

function createStatusBadge(machine) {
  const badge = document.createElement('span');
  badge.className = `machine-status ${machine.statusClass}`;
  badge.textContent = machine.status;
  return badge;
}

function createMachineRow(machine) {
  const row = document.createElement('tr');
  row.dataset.status = machine.statusKey;
  row.dataset.search = machine.search;

  const nameCell = document.createElement('td');
  const selectButton = document.createElement('button');
  selectButton.className = 'machine-select';
  selectButton.type = 'button';
  selectButton.dataset.machine = machine.id;
  selectButton.setAttribute('aria-pressed', String(machine.id === selectedMachineId));
  const name = document.createElement('strong');
  name.textContent = machine.name;
  const code = document.createElement('span');
  code.textContent = machine.code;
  selectButton.append(name, code);
  nameCell.append(selectButton);

  const locationCell = document.createElement('td');
  locationCell.textContent = machine.location;
  const typeCell = document.createElement('td');
  typeCell.textContent = machine.type;
  const statusCell = document.createElement('td');
  statusCell.append(createStatusBadge(machine));
  const teamCell = document.createElement('td');
  teamCell.textContent = machine.team;
  const updatedCell = document.createElement('td');
  updatedCell.textContent = machine.updated;
  row.append(nameCell, locationCell, typeCell, statusCell, teamCell, updatedCell);
  row.classList.toggle('is-selected', machine.id === selectedMachineId);
  return row;
}

function setMachineListState(messageText = '', canRetry = false) {
  if (!machineLoadState) return;
  machineLoadState.hidden = !messageText;
  machineLoadState.querySelector('p').textContent = messageText;
  machineRetry.hidden = !canRetry;
}

function setMachineDetail(machineId) {
  const machine = machineDetails.get(machineId);
  if (!machine || !machineDetail) return;
  selectedMachineId = machineId;
  machineDetail.hidden = false;
  machineWorkbench?.classList.remove('is-empty', 'is-loading');

  const detailName = document.querySelector('#detail-name');
  const code = document.createElement('span');
  code.textContent = ` · ${machine.code}`;
  detailName.replaceChildren(document.createTextNode(machine.name), code);
  document.querySelector('#detail-location').textContent = machine.locationLabel;
  document.querySelector('#detail-type').textContent = machine.type;
  document.querySelector('#detail-status').replaceChildren(createStatusBadge(machine));
  document.querySelector('#detail-team').textContent = machine.team;
  document.querySelector('#detail-updated').textContent = machine.updated;
  document.querySelector('#maintenance-next').textContent = 'ดูข้อมูลในหน้า Preventive Maintenance';
  document.querySelector('#maintenance-history').textContent = 'ดูข้อมูลในหน้าประวัติการซ่อม';
  document.querySelector('#breakdown-summary').textContent = 'ดูรายละเอียดในหน้า Breakdown ของเครื่องจักร';

  const partsLink = document.querySelector('#machine-parts-link');
  const partsPending = document.querySelector('#machine-parts-pending');
  const partsContext = document.querySelector('#machine-parts-context');
  if (partsLink && partsPending && partsContext) {
    partsContext.textContent = `${machine.name} · ${machine.code}`;
    const partsReady = Boolean(machine.code && window.RD_AUTH_CONFIG?.sparePartsEnabled && window.RD_AUTH_CONFIG?.sparePartsApiBaseUrl);
    partsLink.hidden = !partsReady;
    partsPending.hidden = partsReady;
    if (partsReady) partsLink.href = `spare-parts.html?${new URLSearchParams({ machine_id: machine.code })}`;
  }

  const imageMedia = document.querySelector('#detail-image-media');
  const imageCaption = document.querySelector('#detail-image-caption');
  const showImageFallback = () => {
    imageMedia.replaceChildren();
    imageMedia.setAttribute('aria-hidden', 'true');
    imageCaption.textContent = machine.imageSource ? 'ไม่สามารถโหลดรูปภาพเครื่องจักรได้' : 'ไม่มีรูปภาพเครื่องจักร';
  };
  if (machine.imageUrl) {
    const image = document.createElement('img');
    image.alt = `ภาพเครื่องจักร ${machine.name}`;
    image.onerror = showImageFallback;
    imageMedia.replaceChildren(image);
    imageMedia.removeAttribute('aria-hidden');
    imageCaption.textContent = `ภาพเครื่องจักร ${machine.name}`;
    image.src = machine.imageUrl;
  } else {
    showImageFallback();
  }

  machineTableBody.querySelectorAll('tr').forEach((row) => {
    const isSelected = row.querySelector('[data-machine]')?.dataset.machine === machineId;
    row.classList.toggle('is-selected', isSelected);
    row.querySelector('[data-machine]')?.setAttribute('aria-pressed', String(isSelected));
  });
}

function renderMachinePage() {
  if (!machineTableBody) return;
  const totalItems = filteredMachines.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / MACHINE_PAGE_SIZE));
  machinePage = Math.min(machinePage, totalPages);
  const startIndex = (machinePage - 1) * MACHINE_PAGE_SIZE;
  const pageItems = filteredMachines.slice(startIndex, startIndex + MACHINE_PAGE_SIZE);
  machineTableBody.replaceChildren(...pageItems.map(createMachineRow));

  const noResults = document.querySelector('#machine-no-results');
  noResults.hidden = totalItems !== 0 || allMachines.length === 0;
  previousPageButton.disabled = machinePage <= 1;
  nextPageButton.disabled = machinePage >= totalPages || totalItems === 0;
  paginationSummary.textContent = totalItems
    ? `แสดง ${startIndex + 1}–${Math.min(startIndex + MACHINE_PAGE_SIZE, totalItems)} จาก ${totalItems} รายการ`
    : 'ไม่มีรายการที่แสดง';
  document.querySelector('#machine-result-status').textContent = totalItems
    ? `แสดงเครื่องจักร ${totalItems} รายการ`
    : 'ไม่พบเครื่องจักรตามเงื่อนไขที่เลือก';

  if (pageItems.length) {
    if (!pageItems.some((machine) => machine.id === selectedMachineId)) selectedMachineId = pageItems[0].id;
    setMachineDetail(selectedMachineId);
  } else {
    machineDetail.hidden = true;
    machineWorkbench?.classList.add('is-empty');
  }
}

function selectMachineTab(tab) {
  const panelId = tab.getAttribute('aria-controls');
  machineTabs.forEach((item) => {
    const isActive = item === tab;
    item.classList.toggle('is-active', isActive);
    item.setAttribute('aria-selected', String(isActive));
    item.tabIndex = isActive ? 0 : -1;
  });
  machineTabPanels.forEach((panel) => { panel.hidden = panel.id !== panelId; });
}

machineTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectMachineTab(tab));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? machineTabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + machineTabs.length) % machineTabs.length;
    machineTabs[nextIndex].focus();
    selectMachineTab(machineTabs[nextIndex]);
  });
});

function selectTabFromHash() {
  const panelId = window.location.hash.slice(1);
  const tab = [...machineTabs].find((item) => item.getAttribute('aria-controls') === panelId);
  if (tab) selectMachineTab(tab);
}

if (machineTabs.length) {
  selectTabFromHash();
  window.addEventListener('hashchange', selectTabFromHash);
}

function filterMachines() {
  if (!machineTableBody) return;
  const query = machineSearch.value.trim().toLowerCase();
  const status = machineStatusFilter.value;
  filteredMachines = allMachines.filter((machine) => machine.search.includes(query) && (status === 'all' || machine.statusKey === status));
  machinePage = 1;
  renderMachinePage();
}

async function loadMachines() {
  if (!machineTableBody) return;
  machineWorkbench?.classList.add('is-loading');
  machineDetail.hidden = true;
  machineTableBody.innerHTML = '<tr class="machine-loading-row"><td colspan="6">กำลังโหลดข้อมูลเครื่องจักร…</td></tr>';
  setMachineListState();
  paginationSummary.textContent = 'กำลังโหลดข้อมูล';
  previousPageButton.disabled = true;
  nextPageButton.disabled = true;

  try {
    const page = document.body.dataset.page;
    const expectedZone = page === 'machine-upper-zone' ? 'โซนบน' : page === 'machine-lower-zone' ? 'โซนล่าง' : '';
    const records = await window.RDSiteAuth.apiRequest('listMachines', { zone: expectedZone });
    if (!Array.isArray(records)) throw new Error('INVALID_RESPONSE');
    allMachines = records
      .map(toMachineModel)
      .filter((machine) => !expectedZone || machine.zone === expectedZone)
      .sort(compareMachinesByCode);
    machineDetails = new Map(allMachines.map((machine) => [machine.id, machine]));
    filteredMachines = [...allMachines];
    selectedMachineId = allMachines[0]?.id || '';
    machinePage = 1;
    machineWorkbench?.classList.remove('is-loading');

    if (!allMachines.length) {
      machineTableBody.replaceChildren();
      machineDetail.hidden = true;
      machineWorkbench?.classList.add('is-empty');
      setMachineListState(`ยังไม่มีข้อมูลเครื่องจักรใน${expectedZone || 'พื้นที่นี้'}`);
      paginationSummary.textContent = '0 รายการ';
      document.querySelector('#machine-result-status').textContent = 'ยังไม่มีข้อมูลเครื่องจักร';
      return;
    }
    setMachineListState();
    renderMachinePage();
  } catch (error) {
    machineTableBody.replaceChildren();
    machineDetail.hidden = true;
    machineWorkbench?.classList.add('is-empty');
    const messageText = error.message === 'PERMISSION_DENIED'
      ? 'บัญชีนี้ไม่มีสิทธิ์ดูข้อมูลเครื่องจักร'
      : 'ไม่สามารถโหลดข้อมูลเครื่องจักรอย่างปลอดภัยได้';
    setMachineListState(messageText, true);
    paginationSummary.textContent = 'โหลดข้อมูลไม่สำเร็จ';
    document.querySelector('#machine-result-status').textContent = messageText;
  }
}

if (machineTableBody) {
  machineTableBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-machine]');
    if (button) setMachineDetail(button.dataset.machine);
  });
  machineSearch.addEventListener('input', filterMachines);
  machineStatusFilter.addEventListener('change', filterMachines);
  machineRetry.addEventListener('click', loadMachines);
  previousPageButton.addEventListener('click', () => { if (machinePage > 1) { machinePage -= 1; renderMachinePage(); } });
  nextPageButton.addEventListener('click', () => {
    if (machinePage * MACHINE_PAGE_SIZE < filteredMachines.length) { machinePage += 1; renderMachinePage(); }
  });
  window.RD_AUTH_READY?.then(loadMachines).catch(() => {});
}
