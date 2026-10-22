const SETTINGS_AUTH_CONFIG = window.RD_AUTH_CONFIG;
const settingsAppShell = document.querySelector('#app-shell');
const settingsSidebarToggle = document.querySelector('#sidebar-toggle');
const settingsThemeToggle = document.querySelector('#theme-toggle');
const settingsThemeColor = document.querySelector('meta[name="theme-color"]');
const settingsAuthView = document.querySelector('#settings-auth-view');
const settingsPortal = document.querySelector('#settings-portal');
const settingsForm = document.querySelector('#system-settings-form');
const saveMessage = document.querySelector('#settings-save-message');
const connectionMessage = document.querySelector('#connection-message');
const auditMessage = document.querySelector('#audit-message');

let settingsCurrentUser = null;

function setSettingsTheme(theme) {
  const isLight = theme === 'light';
  settingsAppShell.classList.toggle('is-light', isLight);
  settingsThemeToggle.setAttribute('aria-pressed', String(isLight));
  settingsThemeToggle.setAttribute('aria-label', isLight ? 'เปลี่ยนเป็นโหมดเข้ม' : 'เปลี่ยนเป็นโหมดสว่าง');
  settingsThemeToggle.setAttribute('title', isLight ? 'เปลี่ยนเป็นโหมดเข้ม' : 'เปลี่ยนเป็นโหมดสว่าง');
  settingsThemeColor.setAttribute('content', isLight ? '#f6f6f7' : '#111319');
  localStorage.setItem('engineering-workspace-theme', theme);
}

function setSettingsCollapsed(collapsed) {
  settingsAppShell.classList.toggle('is-collapsed', collapsed);
  settingsSidebarToggle.setAttribute('aria-expanded', String(!collapsed));
  settingsSidebarToggle.setAttribute('aria-label', collapsed ? 'เปิดแถบนำทาง' : 'ย่อแถบนำทาง');
  settingsSidebarToggle.setAttribute('title', collapsed ? 'เปิดแถบนำทาง' : 'ย่อแถบนำทาง');
}

function formatSettingsDate(value) {
  if (!value) return 'ยังไม่มีข้อมูล';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'ยังไม่มีข้อมูล';
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(date);
}

function splitSettingLines(value) {
  return String(value || '').split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}

function setMessage(element, text, state = '') {
  element.textContent = text;
  if (state) element.dataset.state = state;
  else delete element.dataset.state;
}

function settingsErrorMessage(code) {
  const messages = {
    PERMISSION_DENIED: 'บัญชีนี้ไม่มีสิทธิ์ตั้งค่าระบบ',
    INVALID_SYSTEM_VERSION: 'รูปแบบเวอร์ชันระบบไม่ถูกต้อง',
    INVALID_NOTIFICATION_CHANNEL: 'ช่องทางแจ้งเตือนไม่ถูกต้อง',
    TOO_MANY_RECIPIENTS: 'กำหนดผู้รับได้สูงสุด 20 รายการ',
    TOO_MANY_ESCALATION_STEPS: 'กำหนดลำดับ Escalate ได้สูงสุด 10 ขั้น',
    INVALID_URGENCY: 'ระดับความเร่งด่วนไม่ถูกต้อง',
    INVALID_REPEAT_INTERVAL: 'ช่วงแจ้งเตือนซ้ำต้องอยู่ระหว่าง 5–1,440 นาที',
    SYSTEM_SETTINGS_INVALID: 'ข้อมูลตั้งค่าบนเซิร์ฟเวอร์ไม่ถูกต้อง กรุณาตรวจ Script Properties',
    API_REQUEST_FAILED: 'ไม่สามารถติดต่อ GAS API ได้',
  };
  return messages[code] || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
}

function fillSystemSettings(settings) {
  const notification = settings.notifications || {};
  document.querySelector('#system-version').value = settings.systemVersion || '1.0.0';
  document.querySelector('#breakdown-enabled').checked = Boolean(notification.breakdownEnabled);
  document.querySelector('#pm-upcoming-enabled').checked = Boolean(notification.pmUpcomingEnabled);
  document.querySelector('#pm-overdue-enabled').checked = Boolean(notification.pmOverdueEnabled);
  document.querySelector('#notification-recipients').value = (notification.recipients || []).join('\n');
  document.querySelectorAll('[name="notification-channel"]').forEach((input) => { input.checked = (notification.channels || []).includes(input.value); });
  document.querySelector('#notification-urgency').value = notification.urgency || 'high';
  document.querySelector('#repeat-minutes').value = Number(notification.repeatMinutes || 60);
  document.querySelector('#escalation-steps').value = (notification.escalationSteps || []).join('\n');
  if (settings.updatedAt) setMessage(saveMessage, `แก้ไขล่าสุด ${formatSettingsDate(settings.updatedAt)} โดย ${settings.updatedBy || 'ไม่ระบุ'}`, 'success');
}

function collectSystemSettings() {
  const eventEnabled = ['#breakdown-enabled', '#pm-upcoming-enabled', '#pm-overdue-enabled'].some((selector) => document.querySelector(selector).checked);
  const recipients = splitSettingLines(document.querySelector('#notification-recipients').value);
  const channels = Array.from(document.querySelectorAll('[name="notification-channel"]:checked')).map((input) => input.value);
  if (eventEnabled && !recipients.length) throw new Error('RECIPIENT_REQUIRED');
  if (eventEnabled && !channels.length) throw new Error('CHANNEL_REQUIRED');
  return {
    systemVersion: document.querySelector('#system-version').value.trim(),
    notifications: {
      breakdownEnabled: document.querySelector('#breakdown-enabled').checked,
      pmUpcomingEnabled: document.querySelector('#pm-upcoming-enabled').checked,
      pmOverdueEnabled: document.querySelector('#pm-overdue-enabled').checked,
      recipients,
      channels,
      urgency: document.querySelector('#notification-urgency').value,
      repeatMinutes: Number(document.querySelector('#repeat-minutes').value),
      escalationSteps: splitSettingLines(document.querySelector('#escalation-steps').value),
    },
  };
}

function renderConnectionStatus(system) {
  const entries = [
    ['supabase', system.supabase, system.supabase?.host || 'ไม่พร้อมใช้งาน'],
    ['gas', system.gas, system.gas?.ok ? `API ${system.gas.apiVersion}` : 'ไม่พร้อมใช้งาน'],
    ['sheet', system.spreadsheet, system.spreadsheet?.name || 'ไม่พร้อมใช้งาน'],
  ];
  entries.forEach(([name, status, text]) => {
    const dot = document.querySelector(`#${name}-status-dot`);
    const label = document.querySelector(`#${name}-status-text`);
    dot.dataset.state = status?.ok ? 'ready' : 'error';
    label.textContent = text;
  });
  document.querySelector('#last-sync-at').textContent = formatSettingsDate(system.lastSyncAt);
  document.querySelector('#data-sources').textContent = system.spreadsheet?.sources?.length ? system.spreadsheet.sources.join(', ') : 'ยังไม่มีข้อมูล';
  document.querySelector('#api-version').textContent = system.gas?.apiVersion || '—';
  document.querySelector('#deployment-version').textContent = system.gas?.deploymentVersion || '—';
  document.querySelector('#connection-tested-at').textContent = formatSettingsDate(system.testedAt);
}

function allSystemConnectionsReady(system) {
  return Boolean(system.supabase?.ok && system.gas?.ok && system.spreadsheet?.ok);
}

async function supabaseAdminSelect(path) {
  const token = await window.RDSiteAuth.getAccessToken();
  const response = await fetch(`${SETTINGS_AUTH_CONFIG.supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: SETTINGS_AUTH_CONFIG.publishableKey, Authorization: `Bearer ${token}` },
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  });
  const payload = await response.json().catch(() => []);
  if (!response.ok) throw new Error('ROLE_AUDIT_UNAVAILABLE');
  return payload;
}

function auditActorFromNotes(notes, fallback) {
  const match = String(notes || '').match(/Username:\s*([^·]+)/i);
  return match ? match[1].trim() : (fallback || 'ไม่ระบุ');
}

function renderAuditRows(target, entries, type, profiles = new Map()) {
  const body = document.querySelector(target);
  body.replaceChildren();
  if (!entries.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = 'ยังไม่มีประวัติการเปลี่ยนแปลง';
    row.append(cell);
    body.append(row);
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement('tr');
    const time = document.createElement('td');
    const actor = document.createElement('td');
    const action = document.createElement('td');
    const detail = document.createElement('td');
    time.textContent = formatSettingsDate(type === 'role' ? entry.created_at : entry.changedAt);
    if (type === 'role') {
      actor.textContent = profiles.get(entry.actor_user_id) || (entry.actor_user_id === settingsCurrentUser?.id ? settingsCurrentUser.username : String(entry.actor_user_id || '').slice(0, 8));
      action.textContent = entry.action || 'UPDATE_USER';
      const values = entry.detail || {};
      detail.textContent = [values.username, values.role, values.passwordChanged ? 'เปลี่ยนรหัสผ่าน' : ''].filter(Boolean).join(' · ') || '—';
    } else {
      actor.textContent = auditActorFromNotes(entry.notes, String(entry.actorId || '').slice(0, 8));
      action.textContent = entry.action || 'UPDATE';
      detail.textContent = entry.fields || '—';
    }
    row.append(time, actor, action, detail);
    body.append(row);
  });
}

async function loadSystemAudit() {
  setMessage(auditMessage, 'กำลังโหลดประวัติ…');
  try {
    const [systemAudit, roleAudit, profiles] = await Promise.all([
      window.RDSiteAuth.apiRequest('listSystemAudit'),
      supabaseAdminSelect('admin_user_audit?select=id,actor_user_id,target_user_id,action,detail,created_at&order=created_at.desc&limit=50'),
      supabaseAdminSelect('user_profiles?select=id,username'),
    ]);
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile.username]));
    renderAuditRows('#settings-audit-body', systemAudit.entries || [], 'settings');
    renderAuditRows('#role-audit-body', roleAudit || [], 'role', profileMap);
    setMessage(auditMessage, `โหลดประวัติแล้ว ${formatSettingsDate(new Date().toISOString())}`, 'success');
  } catch (_) {
    setMessage(auditMessage, 'โหลดประวัติได้ไม่ครบ กรุณาตรวจ GAS Deployment และ Supabase RLS', 'error');
  }
}

async function loadSystemSettings() {
  setMessage(saveMessage, 'กำลังโหลดการตั้งค่า…');
  try {
    const result = await window.RDSiteAuth.apiRequest('getSystemSettings');
    fillSystemSettings(result.settings || {});
    renderConnectionStatus(result.system || {});
    const ready = allSystemConnectionsReady(result.system || {});
    setMessage(connectionMessage, ready ? 'ทุกระบบพร้อมใช้งาน' : 'พบบางระบบที่ยังไม่พร้อมใช้งาน', ready ? 'success' : 'error');
  } catch (error) {
    setMessage(saveMessage, settingsErrorMessage(error.message), 'error');
    setMessage(connectionMessage, 'ยังไม่สามารถอ่านสถานะระบบได้', 'error');
  }
}

async function saveSystemSettings(event) {
  event.preventDefault();
  const button = document.querySelector('#settings-save-button');
  try {
    if (!settingsForm.reportValidity()) return;
    const payload = collectSystemSettings();
    button.disabled = true;
    button.textContent = 'กำลังบันทึก…';
    setMessage(saveMessage, 'กำลังบันทึกการตั้งค่า…');
    const result = await window.RDSiteAuth.apiRequest('saveSystemSettings', payload);
    fillSystemSettings(result.settings || payload);
    setMessage(saveMessage, result.message || 'บันทึกการตั้งค่าแล้ว', 'success');
    await loadSystemAudit();
  } catch (error) {
    const localMessages = { RECIPIENT_REQUIRED: 'กรุณาระบุผู้รับเมื่อเปิดการแจ้งเตือน', CHANNEL_REQUIRED: 'กรุณาเลือกช่องทางเมื่อเปิดการแจ้งเตือน' };
    setMessage(saveMessage, localMessages[error.message] || settingsErrorMessage(error.message), 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'บันทึกการตั้งค่า';
  }
}

async function testConnections() {
  const button = document.querySelector('#test-connections');
  button.disabled = true;
  button.textContent = 'กำลังทดสอบ…';
  setMessage(connectionMessage, 'กำลังทดสอบ Supabase, GAS และ Google Sheet…');
  try {
    const system = await window.RDSiteAuth.apiRequest('testSystemConnections');
    renderConnectionStatus(system);
    const ready = allSystemConnectionsReady(system);
    setMessage(connectionMessage, ready ? 'ทุกระบบพร้อมใช้งาน' : 'พบบางระบบที่ยังไม่พร้อมใช้งาน กรุณาตรวจสถานะแต่ละรายการ', ready ? 'success' : 'error');
  } catch (error) {
    setMessage(connectionMessage, settingsErrorMessage(error.message), 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'ทดสอบการเชื่อมต่อ';
  }
}

function selectAuditTab(tab) {
  const isSettings = tab === 'settings';
  const settingsTab = document.querySelector('#settings-audit-tab');
  const roleTab = document.querySelector('#role-audit-tab');
  settingsTab.setAttribute('aria-selected', String(isSettings));
  settingsTab.tabIndex = isSettings ? 0 : -1;
  roleTab.setAttribute('aria-selected', String(!isSettings));
  roleTab.tabIndex = isSettings ? -1 : 0;
  document.querySelector('#settings-audit-panel').hidden = !isSettings;
  document.querySelector('#role-audit-panel').hidden = isSettings;
}

function handleAuditTabKeys(event) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const tabs = [document.querySelector('#settings-audit-tab'), document.querySelector('#role-audit-tab')];
  const currentIndex = Math.max(0, tabs.indexOf(event.currentTarget));
  let targetIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : currentIndex;
  if (event.key === 'ArrowRight') targetIndex = (currentIndex + 1) % tabs.length;
  if (event.key === 'ArrowLeft') targetIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  const targetRole = targetIndex === 1 ? 'role' : 'settings';
  selectAuditTab(targetRole);
  tabs[targetIndex].focus();
}

setSettingsTheme(localStorage.getItem('engineering-workspace-theme') || 'dark');
settingsSidebarToggle.addEventListener('click', () => setSettingsCollapsed(!settingsAppShell.classList.contains('is-collapsed')));
settingsThemeToggle.addEventListener('click', () => setSettingsTheme(settingsAppShell.classList.contains('is-light') ? 'dark' : 'light'));
settingsForm.addEventListener('submit', saveSystemSettings);
document.querySelector('#test-connections').addEventListener('click', testConnections);
document.querySelector('#refresh-audit').addEventListener('click', loadSystemAudit);
document.querySelector('#settings-audit-tab').addEventListener('click', () => selectAuditTab('settings'));
document.querySelector('#role-audit-tab').addEventListener('click', () => selectAuditTab('role'));
document.querySelector('#settings-audit-tab').addEventListener('keydown', handleAuditTabKeys);
document.querySelector('#role-audit-tab').addEventListener('keydown', handleAuditTabKeys);

(async () => {
  try {
    settingsCurrentUser = await window.RD_AUTH_READY;
    if (settingsCurrentUser.role !== 'Admin') {
      document.querySelector('#settings-access-title').textContent = 'ไม่มีสิทธิ์เข้าถึงหน้านี้';
      document.querySelector('#settings-access-message').textContent = 'ต้องใช้ Role Admin เพื่อดูหรือแก้ไขการตั้งค่าระบบ';
      return;
    }
    settingsAuthView.hidden = true;
    settingsPortal.hidden = false;
    await Promise.all([loadSystemSettings(), loadSystemAudit()]);
  } catch (_) {
    document.querySelector('#settings-access-title').textContent = 'ไม่สามารถตรวจสอบสิทธิ์ได้';
    document.querySelector('#settings-access-message').textContent = 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง';
  }
})();
