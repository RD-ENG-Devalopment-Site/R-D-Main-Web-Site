const resourceConfig = {
  machines: {
    label: 'เครื่องจักร',
    title: 'ข้อมูลเครื่องจักร',
    idKey: 'machine_id',
    displayKeys: ['machine_id', 'machine_name'],
    fields: [
      ['machine_id', 'รหัสเครื่องจักร', 'text', true, 'เช่น M-001'],
      ['machine_name', 'ชื่อเครื่องจักร', 'text', true, 'ระบุชื่อที่ใช้ในพื้นที่ปฏิบัติงาน'],
      ['zone', 'โซน', 'select', true, '', ['โซนล่าง', 'โซนบน']],
      ['location', 'ตำแหน่งติดตั้ง', 'text', true, 'เช่น L-01'],
      ['machine_type', 'ประเภทเครื่องจักร', 'text', true, ''],
      ['manufacturer', 'ผู้ผลิต', 'text', false, ''],
      ['model', 'รุ่น', 'text', false, ''],
      ['serial_number', 'Serial Number', 'text', false, ''],
      ['install_date', 'วันที่ติดตั้ง', 'date', false, ''],
      ['criticality', 'ระดับความสำคัญ', 'select', true, '', ['Critical', 'High', 'Normal', 'Low']],
      ['status', 'สถานะปัจจุบัน', 'select', true, '', ['กำลังทำงาน', 'หยุด', 'ซ่อมบำรุง', 'ขัดข้อง']],
      ['status_reason', 'เหตุผลหรือหมายเหตุสถานะ', 'textarea', false, 'อธิบายเพิ่มเติมเมื่อเครื่องหยุดหรือขัดข้อง'],
      ['owner_user_id', 'รหัสผู้รับผิดชอบ', 'text', false, ''],
      ['owner_team', 'ทีมดูแล', 'text', true, ''],
      ['image_url', 'URL รูปเครื่องจักร', 'url', false, 'https://'],
      ['data_source', 'แหล่งที่มาของข้อมูล', 'text', false, 'เช่น หน้างาน / CMMS'],
      ['active', 'เปิดใช้งานรายการนี้', 'checkbox', false, ''],
    ],
  },
  documents: {
    label: 'เอกสาร', title: 'เอกสารประจำเครื่องจักร', idKey: 'document_id', displayKeys: ['document_id', 'document_name'],
    fields: [
      ['document_id', 'รหัสเอกสาร', 'text', true, 'เช่น DOC-0001'], ['machine_id', 'เครื่องจักร', 'machine', true, ''],
      ['document_type', 'ประเภทเอกสาร', 'select', true, '', ['Manual', 'Drawing', 'SOP', 'Certificate', 'Photo', 'Other']],
      ['document_name', 'ชื่อเอกสาร', 'text', true, ''], ['version', 'เวอร์ชัน', 'text', false, ''],
      ['file_url', 'URL ไฟล์', 'url', true, 'https://'], ['effective_date', 'วันที่มีผล', 'date', false, ''],
      ['uploaded_by_user_id', 'ผู้อัปโหลด', 'text', false, ''], ['active', 'เปิดใช้งานเอกสารนี้', 'checkbox', false, ''],
    ],
  },
};

const appShell = document.querySelector('#app-shell');
const themeToggle = document.querySelector('#theme-toggle');
const sidebarToggle = document.querySelector('#sidebar-toggle');
const themeColor = document.querySelector('meta[name="theme-color"]');
const form = document.querySelector('#record-form');
const fieldsRoot = document.querySelector('#dynamic-fields');
const picker = document.querySelector('#record-picker');
const existingRecord = document.querySelector('#existing-record');
const recordPickerStatus = document.querySelector('#record-picker-status');
const submitButton = document.querySelector('#submit-record');
const message = document.querySelector('#form-message');
const writeAuthState = document.querySelector('#write-auth-state');
let resource = 'machines';
let mode = 'create';
let machineOptions = [];
let currentRecords = [];
let allowedWriteResources = new Set();
let verifiedWriteRole = '';
let originalRecordSnapshot = null;
let changedFields = new Set();
const recordIdCollator = new Intl.Collator(['th', 'en'], { numeric: true, sensitivity: 'base' });

function setTheme(theme) {
  const light = theme === 'light';
  appShell.classList.toggle('is-light', light);
  themeToggle.setAttribute('aria-pressed', String(light));
  themeToggle.setAttribute('aria-label', light ? 'เปลี่ยนเป็นโหมดเข้ม' : 'เปลี่ยนเป็นโหมดสว่าง');
  themeToggle.title = light ? 'เปลี่ยนเป็นโหมดเข้ม' : 'เปลี่ยนเป็นโหมดสว่าง';
  themeColor.content = light ? '#f6f6f7' : '#111319';
  localStorage.setItem('engineering-workspace-theme', theme);
}

function setCollapsed(collapsed) {
  appShell.classList.toggle('is-collapsed', collapsed);
  sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
  sidebarToggle.setAttribute('aria-label', collapsed ? 'เปิดแถบนำทาง' : 'ย่อแถบนำทาง');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character]));
}

function buildField(field) {
  const [name, label, type, required, placeholder, options] = field;
  const wide = type === 'textarea' ? ' is-wide' : '';
  const requiredMark = required ? ' <span aria-hidden="true">*</span>' : '';
  if (type === 'checkbox') {
    return `<div class="form-group${wide}"><div class="checkbox-field"><input id="${name}" name="${name}" type="checkbox" /><label for="${name}">${label}</label></div></div>`;
  }
  let control;
  if (type === 'textarea') {
    control = `<textarea id="${name}" name="${name}" placeholder="${escapeHtml(placeholder)}" ${required ? 'required' : ''}></textarea>`;
  } else if (type === 'select' || type === 'machine') {
    const list = type === 'machine' ? machineOptions.map((item) => [item.machine_id, `${item.machine_id} · ${item.machine_name}`]) : (options || []).map((item) => [item, item]);
    control = `<select id="${name}" name="${name}" ${required ? 'required' : ''}><option value="">เลือก${label}</option>${list.map(([value, text]) => `<option value="${escapeHtml(value)}">${escapeHtml(text)}</option>`).join('')}</select>`;
  } else {
    control = `<input id="${name}" name="${name}" type="${type}" placeholder="${escapeHtml(placeholder)}" ${type === 'number' ? 'min="0" step="any"' : ''} ${required ? 'required' : ''} />`;
  }
  return `<div class="form-group${wide}"><label for="${name}">${label}${requiredMark}</label>${control}</div>`;
}

function renderFields() {
  const config = resourceConfig[resource];
  fieldsRoot.innerHTML = config.fields.map(buildField).join('');
  document.querySelector('#form-title').textContent = config.title;
  document.querySelector('#summary-resource').textContent = config.label;
  document.querySelector('#image-preview-section').hidden = resource !== 'machines';
  if (mode === 'create') restoreDraft();
  setIdentityFieldState();
  updateEditState();
}

function serializeForm() {
  const values = {};
  resourceConfig[resource].fields.forEach(([name, , type]) => {
    const control = form.elements[name];
    values[name] = type === 'checkbox' ? control.checked : control.value.trim();
  });
  return values;
}

function draftKey() { return `machine-recording-draft:${resource}:${mode}`; }

function saveDraft() {
  if (mode !== 'create') return;
  sessionStorage.setItem(draftKey(), JSON.stringify(serializeForm()));
  document.querySelector('#draft-status').textContent = 'บันทึกร่างไว้ในอุปกรณ์นี้แล้ว';
}

function restoreDraft() {
  const draft = sessionStorage.getItem(draftKey());
  if (!draft) return;
  const values = JSON.parse(draft);
  Object.entries(values).forEach(([name, value]) => {
    const control = form.elements[name];
    if (!control) return;
    if (control.type === 'checkbox') control.checked = Boolean(value);
    else control.value = value;
  });
  updateImagePreview();
  document.querySelector('#draft-status').textContent = 'กู้คืนร่างล่าสุดแล้ว';
}

function setIdentityFieldState() {
  const identityControl = form.elements[resourceConfig[resource].idKey];
  if (!identityControl) return;
  const locked = mode === 'update';
  identityControl.readOnly = locked;
  identityControl.closest('.form-group')?.classList.toggle('is-locked', locked);
  identityControl.title = locked ? 'รหัสหลักไม่สามารถเปลี่ยนในโหมดแก้ไขได้' : '';
}

function normalizeValue(value, type) {
  if (type === 'checkbox') return value === true || value === 1 || String(value).toLowerCase() === 'true';
  return String(value ?? '').trim();
}

function updateEditState() {
  changedFields = new Set();
  resourceConfig[resource].fields.forEach(([name, , type]) => {
    const control = form.elements[name];
    if (!control) return;
    const currentValue = type === 'checkbox' ? control.checked : control.value;
    const changed = mode === 'update' && originalRecordSnapshot && normalizeValue(currentValue, type) !== normalizeValue(originalRecordSnapshot[name], type);
    control.closest('.form-group')?.classList.toggle('is-changed', Boolean(changed));
    if (changed) changedFields.add(name);
  });

  if (mode === 'update') {
    const status = document.querySelector('#draft-status');
    if (!originalRecordSnapshot) status.textContent = 'เลือกรายการเพื่อโหลดข้อมูลเดิม';
    else if (!changedFields.size) status.textContent = 'ข้อมูลตรงกับรายการที่บันทึกไว้';
    else status.textContent = `แก้ไขแล้ว ${changedFields.size} ช่อง · ยังไม่ได้บันทึก`;
  }
  updateSubmitPermission();
}

function clearForm({ keepSelection = false } = {}) {
  const selectedId = keepSelection ? existingRecord.value : '';
  form.reset();
  if (keepSelection) existingRecord.value = selectedId;
  sessionStorage.removeItem(draftKey());
  fieldsRoot.querySelectorAll('[aria-invalid="true"]').forEach((item) => item.removeAttribute('aria-invalid'));
  originalRecordSnapshot = null;
  changedFields = new Set();
  fieldsRoot.querySelectorAll('.is-changed').forEach((item) => item.classList.remove('is-changed'));
  message.hidden = true;
  document.querySelector('#draft-status').textContent = mode === 'update' ? 'เลือกรายการเพื่อโหลดข้อมูลเดิม' : 'ยังไม่มีการแก้ไขข้อมูล';
  if (mode === 'update') recordPickerStatus.textContent = 'เมื่อเลือกแล้ว ระบบจะโหลดข้อมูลเดิมเข้าฟอร์มให้อัตโนมัติ';
  setIdentityFieldState();
  updateImagePreview();
  updateSubmitPermission();
}

function loadSelectedRecord({ announce = true } = {}) {
  const config = resourceConfig[resource];
  const selectedId = existingRecord.value;
  const record = currentRecords.find((item) => String(item[config.idKey]) === selectedId);
  if (!record) {
    clearForm();
    return false;
  }

  form.reset();
  existingRecord.value = selectedId;
  config.fields.forEach(([name, , type]) => {
    const control = form.elements[name];
    if (!control) return;
    const value = record[name] ?? '';
    if (type === 'checkbox') control.checked = normalizeValue(value, type);
    else if (type === 'datetime-local' && value) control.value = String(value).slice(0, 16);
    else if (type === 'date' && value) control.value = String(value).slice(0, 10);
    else control.value = value;
  });
  originalRecordSnapshot = serializeForm();
  setIdentityFieldState();
  updateEditState();
  updateImagePreview();
  recordPickerStatus.textContent = `โหลดข้อมูล ${selectedId} แล้ว · แก้ไขเฉพาะช่องที่ต้องการได้ทันที`;
  if (announce) showMessage('โหลดข้อมูลเดิมแล้ว แก้ไขเฉพาะช่องที่ต้องการ จากนั้นกดบันทึกการแก้ไข', 'success');
  return true;
}

function showMessage(text, type) {
  message.textContent = text;
  message.dataset.type = type;
  message.setAttribute('role', type === 'error' ? 'alert' : 'status');
  message.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  message.hidden = false;
}

function setWriteAuthState(state, text) {
  writeAuthState.dataset.state = state;
  writeAuthState.textContent = text;
  writeAuthState.setAttribute('role', state === 'error' ? 'alert' : 'status');
  writeAuthState.setAttribute('aria-live', state === 'error' ? 'assertive' : 'polite');
  document.querySelector('.access-gate').classList.toggle('is-ready', state === 'ready');
  updateSubmitPermission();
}

function apiErrorMessage(code) {
  const [, detail = ''] = String(code || '').split(':');
  const fieldLabels = {
    zone: 'โซน',
    criticality: 'ระดับความสำคัญ',
    status: 'สถานะปัจจุบัน',
    document_type: 'ประเภทเอกสาร',
  };
  const messages = {
    AUTH_REQUIRED: 'กรุณายืนยันรหัสสำหรับบันทึก',
    USER_NOT_REGISTERED: 'ไม่พบสิทธิ์ของรหัสนี้ กรุณาติดต่อผู้ดูแลระบบ',
    USER_INACTIVE: 'บัญชีนี้ถูกระงับ กรุณาติดต่อผู้ดูแลระบบ',
    PERMISSION_DENIED: 'Role ปัจจุบันไม่มีสิทธิ์บันทึกข้อมูลประเภทนี้',
    AUTH_CONFIGURATION_REQUIRED: 'ยังตั้งค่าระบบสิทธิ์ไม่ครบ กรุณาติดต่อผู้ดูแลระบบ',
    DUPLICATE_ID: 'รหัสนี้มีอยู่แล้ว กรุณาใช้รหัสใหม่หรือเลือกโหมดแก้ไข',
    RECORD_NOT_FOUND: 'ไม่พบรายการที่ต้องการแก้ไข กรุณาโหลดรายการใหม่',
    MACHINE_NOT_FOUND: 'ไม่พบรหัสเครื่องจักรอ้างอิง กรุณาตรวจสอบอีกครั้ง',
    INVALID_URL: 'URL ต้องขึ้นต้นด้วย http:// หรือ https://',
    INVALID_NUMBER: 'ค่าตัวเลขต้องเป็นศูนย์หรือมากกว่า',
    INVALID_ENUM: detail && fieldLabels[detail]
      ? `ค่าในช่อง ${fieldLabels[detail]} ไม่อยู่ในรายการที่ระบบรองรับ กรุณาเลือกใหม่จากรายการ`
      : 'ค่าโซน ระดับความสำคัญ หรือสถานะไม่อยู่ในรายการที่ระบบรองรับ กรุณาเลือกใหม่จากรายการ',
    INVALID_DATE: 'รูปแบบวันหรือเวลาไม่ถูกต้อง',
    INVALID_DATE_RANGE: 'วันหรือเวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่มต้น',
    INPUT_TOO_LONG: 'ข้อมูลบางช่องยาวเกินขอบเขตที่ระบบรองรับ',
  };
  const key = String(code || '').split(':')[0];
  return messages[key] || 'บันทึกไม่สำเร็จ กรุณาตรวจข้อมูลและลองอีกครั้ง';
}

function updateSubmitPermission() {
  const authorized = allowedWriteResources.has(resource);
  const permissionDenied = allowedWriteResources.size > 0 && !authorized;
  const updateNotReady = mode === 'update' && (!originalRecordSnapshot || changedFields.size === 0);
  submitButton.disabled = permissionDenied || updateNotReady;
  if (permissionDenied) submitButton.title = 'Role ปัจจุบันไม่มีสิทธิ์บันทึกข้อมูลประเภทนี้';
  else if (mode === 'update' && !originalRecordSnapshot) submitButton.title = 'กรุณาเลือกรายการที่ต้องการแก้ไข';
  else if (mode === 'update' && !changedFields.size) submitButton.title = 'ยังไม่มีข้อมูลที่เปลี่ยนแปลง';
  else submitButton.title = '';
  if (verifiedWriteRole) {
    const currentAccess = authorized ? 'พร้อมบันทึก' : 'ดูได้อย่างเดียว';
    writeAuthState.textContent = `${currentAccess} · ${verifiedWriteRole}`;
  }
}

function updateImagePreview() {
  const preview = document.querySelector('#image-preview');
  if (!preview || resource !== 'machines') return;
  const url = form.elements.image_url?.value.trim();
  if (!url) { preview.innerHTML = '<span>ใส่ URL รูปภาพเพื่อดูตัวอย่าง</span>'; return; }
  const image = new Image();
  image.alt = 'ตัวอย่างรูปเครื่องจักร';
  image.onload = () => preview.replaceChildren(image);
  image.onerror = () => { preview.innerHTML = '<span>ไม่สามารถโหลดรูปจาก URL นี้ได้</span>'; };
  image.src = url;
}

function validateForm() {
  const controls = [...fieldsRoot.querySelectorAll('input, select, textarea')];
  const invalidControls = controls.filter((control) => {
    const invalid = !control.checkValidity();
    control.toggleAttribute('aria-invalid', invalid);
    if (invalid) control.setAttribute('aria-describedby', 'form-message');
    else if (control.getAttribute('aria-describedby') === 'form-message') control.removeAttribute('aria-describedby');
    return invalid;
  });
  if (!invalidControls.length) return true;

  const firstInvalid = invalidControls[0];
  let feedback = 'กรุณาตรวจสอบข้อมูลในช่องที่แจ้งเตือน';
  if (firstInvalid.validity.valueMissing) feedback = 'กรุณากรอกช่องที่มีเครื่องหมาย * ให้ครบถ้วน';
  else if (firstInvalid.validity.typeMismatch) feedback = 'กรุณากรอก URL ให้ถูกต้อง เช่น https://example.com/file';
  else if (firstInvalid.validity.rangeUnderflow) feedback = 'ค่าตัวเลขต้องไม่น้อยกว่า 0';
  showMessage(feedback, 'error');
  firstInvalid.focus();
  return false;
}

async function fetchResource(targetResource) {
  await window.RD_AUTH_READY;
  const action = targetResource === 'documents' ? 'listDocuments' : 'listMachines';
  const records = await window.RDSiteAuth.apiRequest(action);
  return Array.isArray(records) ? records : [];
}

async function refreshRecords() {
  currentRecords = await fetchResource(resource);
  const config = resourceConfig[resource];
  currentRecords.sort((left, right) => recordIdCollator.compare(
    String(left[config.idKey] || ''),
    String(right[config.idKey] || ''),
  ));
  existingRecord.innerHTML = `<option value="">เลือกรายการ</option>${currentRecords.map((item) => {
    const label = config.displayKeys.map((key) => item[key]).filter(Boolean).join(' · ');
    return `<option value="${escapeHtml(item[config.idKey])}">${escapeHtml(label)}</option>`;
  }).join('')}`;
}

async function checkConnection() {
  const state = document.querySelector('#connection-state');
  try {
    machineOptions = await fetchResource('machines');
    state.dataset.state = 'online';
    state.querySelector('span:last-child').textContent = 'ยืนยัน Supabase และเชื่อมต่อข้อมูลแล้ว';
    renderFields();
  } catch {
    state.dataset.state = 'offline';
    state.querySelector('span:last-child').textContent = 'ไม่สามารถเชื่อมต่อบริการข้อมูล';
  }
}

async function setMode(nextMode) {
  mode = nextMode;
  document.querySelectorAll('.mode-button').forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  picker.hidden = mode !== 'update';
  document.querySelector('#summary-mode').textContent = mode === 'create' ? 'เพิ่มรายการ' : 'แก้ไขรายการ';
  submitButton.querySelector('span').textContent = mode === 'create' ? 'บันทึกข้อมูล' : 'บันทึกการแก้ไข';
  clearForm();
  if (mode === 'update') {
    existingRecord.innerHTML = '<option value="">กำลังโหลดรายการ…</option>';
    try { await refreshRecords(); } catch (error) { showMessage(error.message, 'error'); }
  }
}

async function submitRecord(event) {
  event.preventDefault();
  await window.RD_AUTH_READY;
  if (!allowedWriteResources.has(resource)) {
    showMessage('Role ปัจจุบันไม่มีสิทธิ์บันทึกข้อมูลประเภทนี้', 'error');
    return;
  }
  if (mode === 'update' && (!originalRecordSnapshot || !changedFields.size)) {
    showMessage(!originalRecordSnapshot ? 'กรุณาเลือกรายการที่ต้องการแก้ไข' : 'ยังไม่มีข้อมูลที่เปลี่ยนแปลง', 'error');
    return;
  }
  if (!validateForm()) return;
  submitButton.disabled = true;
  submitButton.querySelector('span').textContent = 'กำลังบันทึก…';
  message.hidden = true;
  try {
    const editedId = existingRecord.value;
    const action = resource === 'documents' ? 'saveDocument' : 'saveMachine';
    const payload = await window.RDSiteAuth.apiRequest(action, { ...serializeForm(), mode });
    sessionStorage.removeItem(draftKey());
    if (mode === 'create') form.reset();
    if (resource === 'machines') machineOptions = await fetchResource('machines');
    if (mode === 'update') {
      await refreshRecords();
      existingRecord.value = editedId;
      loadSelectedRecord({ announce: false });
    }
    showMessage(payload?.message || 'บันทึกข้อมูลเรียบร้อยแล้ว', 'success');
    document.querySelector('#draft-status').textContent = 'บันทึกข้อมูลล่าสุดเรียบร้อยแล้ว';
  } catch (error) {
    showMessage(apiErrorMessage(error.message), 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector('span').textContent = mode === 'create' ? 'บันทึกข้อมูล' : 'บันทึกการแก้ไข';
    updateSubmitPermission();
  }
}

setTheme(localStorage.getItem('engineering-workspace-theme') || 'dark');
setCollapsed(window.matchMedia('(max-width: 640px)').matches);
renderFields();
window.RD_AUTH_READY?.then((user) => {
  verifiedWriteRole = user.role;
  const writeRoles = user.role === 'Technician' ? ['documents'] : ['Admin', 'Engineer'].includes(user.role) ? ['machines', 'documents'] : [];
  allowedWriteResources = new Set(writeRoles);
  setWriteAuthState(writeRoles.length ? 'ready' : 'locked', writeRoles.length ? `พร้อมบันทึก · ${user.role}` : `ดูได้อย่างเดียว · ${user.role}`);
  return checkConnection();
}).catch(() => {});

themeToggle.addEventListener('click', () => setTheme(appShell.classList.contains('is-light') ? 'dark' : 'light'));
sidebarToggle.addEventListener('click', () => setCollapsed(!appShell.classList.contains('is-collapsed')));

document.querySelector('#record-type-tabs').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-resource]');
  if (!button || button.dataset.resource === resource) return;
  resource = button.dataset.resource;
  document.querySelectorAll('.record-type').forEach((item) => {
    const active = item === button;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  mode = 'create';
  document.querySelectorAll('.mode-button').forEach((item) => {
    const active = item.dataset.mode === 'create';
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  picker.hidden = true;
  document.querySelector('#summary-mode').textContent = 'เพิ่มรายการ';
  renderFields();
  updateSubmitPermission();
});

document.querySelectorAll('.mode-button').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
document.querySelector('#reset-form').addEventListener('click', () => {
  if (mode === 'update' && existingRecord.value) loadSelectedRecord({ announce: false });
  else clearForm();
});
existingRecord.addEventListener('change', () => loadSelectedRecord());

form.addEventListener('submit', submitRecord);
form.addEventListener('input', (event) => {
  event.target.removeAttribute('aria-invalid');
  if (event.target.getAttribute('aria-describedby') === 'form-message') event.target.removeAttribute('aria-describedby');
  if (mode === 'update') updateEditState();
  else saveDraft();
  if (event.target.name === 'image_url') updateImagePreview();
});
