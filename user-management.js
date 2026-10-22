const AUTH_CONFIG = window.RD_AUTH_CONFIG;
const SUPABASE_URL = AUTH_CONFIG.supabaseUrl;
const SUPABASE_PUBLISHABLE_KEY = AUTH_CONFIG.publishableKey;
const ADMIN_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/admin-users`;

const appShell = document.querySelector('#app-shell');
const sidebarToggle = document.querySelector('#sidebar-toggle');
const themeToggle = document.querySelector('#theme-toggle');
const themeColor = document.querySelector('meta[name="theme-color"]');
const authView = document.querySelector('#admin-auth-view');
const portal = document.querySelector('#admin-portal');
const listMessage = document.querySelector('#admin-list-message');
const userDialog = document.querySelector('#admin-user-dialog');

let session = null;
let currentUser = null;
let managedUsers = [];

function setTheme(theme) {
  const isLight = theme === 'light';
  appShell.classList.toggle('is-light', isLight);
  themeToggle.setAttribute('aria-pressed', String(isLight));
  themeToggle.setAttribute('aria-label', isLight ? 'เปลี่ยนเป็นโหมดเข้ม' : 'เปลี่ยนเป็นโหมดสว่าง');
  themeToggle.setAttribute('title', isLight ? 'เปลี่ยนเป็นโหมดเข้ม' : 'เปลี่ยนเป็นโหมดสว่าง');
  themeColor.setAttribute('content', isLight ? '#f6f6f7' : '#111319');
  localStorage.setItem('engineering-workspace-theme', theme);
}

function setCollapsed(collapsed) {
  appShell.classList.toggle('is-collapsed', collapsed);
  sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
  sidebarToggle.setAttribute('aria-label', collapsed ? 'เปิดแถบนำทาง' : 'ย่อแถบนำทาง');
  sidebarToggle.setAttribute('title', collapsed ? 'เปิดแถบนำทาง' : 'ย่อแถบนำทาง');
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'REQUEST_FAILED');
  return payload;
}

async function validAccessToken() {
  return window.RDSiteAuth.getAccessToken();
}

async function getAuthenticatedUser() {
  const token = await validAccessToken();
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  });
  const user = await parseResponse(response);
  return {
    id: String(user.id || ''),
    username: String(user.app_metadata?.username || '').slice(0, 32),
    role: String(user.app_metadata?.role || ''),
  };
}

async function adminRequest(action, payload = {}) {
  const token = await validAccessToken();
  const response = await fetch(ADMIN_FUNCTION_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  });
  return parseResponse(response);
}

function setListMessage(text, state = 'success') {
  listMessage.textContent = text;
  listMessage.dataset.state = state;
}

function formatDate(value) {
  if (!value) return 'ยังไม่เคย';
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value));
}

function renderManagedUsers() {
  const body = document.querySelector('#admin-user-table-body');
  if (!managedUsers.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.className = 'admin-empty-cell';
    cell.textContent = 'ยังไม่มีบัญชีผู้ใช้งาน';
    row.append(cell);
    body.replaceChildren(row);
    return;
  }

  body.replaceChildren(...managedUsers.map((user) => {
    const row = document.createElement('tr');
    const username = document.createElement('td');
    username.textContent = user.username;
    const role = document.createElement('td');
    role.textContent = user.role;
    const lastSignIn = document.createElement('td');
    lastSignIn.textContent = formatDate(user.lastSignInAt);
    const action = document.createElement('td');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-table-action';
    button.textContent = 'จัดการ';
    button.addEventListener('click', () => openUserDialog(user));
    action.append(button);
    row.append(username, role, lastSignIn, action);
    return row;
  }));
}

async function loadManagedUsers() {
  setListMessage('กำลังโหลดบัญชีผู้ใช้งาน…');
  try {
    const result = await adminRequest('list');
    managedUsers = result.users || [];
    renderManagedUsers();
    setListMessage(`พบบัญชีผู้ใช้งาน ${managedUsers.length} บัญชี`);
  } catch (error) {
    setListMessage(error.message === 'PERMISSION_DENIED' ? 'บัญชีนี้ไม่มีสิทธิ์จัดการผู้ใช้งาน' : 'ไม่สามารถโหลดบัญชีผู้ใช้งานได้ กรุณาลองใหม่', 'error');
    throw error;
  }
}

async function showPortal() {
  currentUser = window.RDSiteAuth?.getUser() || await getAuthenticatedUser();
  if (currentUser.role !== 'Admin') throw new Error('PERMISSION_DENIED');
  document.querySelector('#admin-account-label').textContent = currentUser.username || currentUser.id.slice(0, 8);
  authView.hidden = true;
  portal.hidden = false;
  await loadManagedUsers();
  document.querySelector('.workspace').scrollTo({ top: 0, behavior: 'instant' });
}

function showAccessDenied() {
  portal.hidden = true;
  authView.hidden = false;
  document.querySelector('#admin-login-title').textContent = 'ไม่มีสิทธิ์เข้าถึงหน้านี้';
  document.querySelector('#admin-access-message').innerHTML = 'บัญชีนี้เข้าสู่ระบบแล้ว แต่ต้องใช้ Role <strong>Admin</strong> เพื่อจัดการผู้ใช้งาน';
}

function openUserDialog(user = null) {
  const isCreate = !user;
  const isSelf = Boolean(user && currentUser && user.id === currentUser.id);
  document.querySelector('#managed-user-id').value = user?.id || '';
  document.querySelector('#managed-username').value = user?.username || '';
  document.querySelector('#managed-role').value = user?.role || 'Viewer';
  document.querySelector('#managed-password').value = '';
  document.querySelector('#managed-password-note').textContent = isCreate ? '(จำเป็น)' : '(เว้นว่างหากไม่เปลี่ยน)';
  document.querySelector('#managed-user-title').textContent = isCreate ? 'เพิ่มผู้ใช้งาน' : `จัดการ ${user.username}`;
  document.querySelector('#managed-user-message').textContent = '';
  document.querySelector('#managed-delete-confirmation').value = '';
  document.querySelector('#managed-username').disabled = isSelf;
  document.querySelector('#managed-role').disabled = isSelf;
  document.querySelector('#managed-danger-zone').hidden = isCreate || isSelf;
  userDialog.showModal();
  (isSelf ? document.querySelector('#managed-password') : document.querySelector('#managed-username')).focus();
}

function closeUserDialog() {
  userDialog.close();
}

function adminErrorMessage(code) {
  const messages = {
    WEAK_PASSWORD: 'รหัสผ่านต้องมีอย่างน้อย 12 ตัว พร้อมตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก ตัวเลข และสัญลักษณ์',
    INVALID_USERNAME: 'รูปแบบชื่อผู้ใช้ไม่ถูกต้อง',
    SELF_IDENTITY_PROTECTED: 'ไม่สามารถเปลี่ยนชื่อหรือ Role ของบัญชีที่กำลังใช้งาน',
    SELF_DELETE_PROTECTED: 'ไม่สามารถลบบัญชีที่กำลังใช้งาน',
    LAST_ADMIN_PROTECTED: 'ต้องมีบัญชี Admin อย่างน้อยหนึ่งบัญชี',
    DELETE_CONFIRMATION_MISMATCH: 'ชื่อผู้ใช้ที่พิมพ์เพื่อยืนยันไม่ตรงกัน',
  };
  return messages[code] || 'ดำเนินการไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองใหม่';
}

async function saveManagedUser(event) {
  event.preventDefault();
  const id = document.querySelector('#managed-user-id').value;
  const message = document.querySelector('#managed-user-message');
  const button = document.querySelector('#managed-user-save');
  const payload = {
    userId: id,
    username: document.querySelector('#managed-username').value,
    role: document.querySelector('#managed-role').value,
    password: document.querySelector('#managed-password').value,
  };
  button.disabled = true;
  message.textContent = 'กำลังบันทึก…';
  message.dataset.state = 'success';
  try {
    await adminRequest(id ? 'update' : 'create', payload);
    closeUserDialog();
    await loadManagedUsers();
    setListMessage(id ? 'บันทึกการเปลี่ยนแปลงแล้ว' : 'สร้างบัญชีผู้ใช้งานแล้ว');
  } catch (error) {
    message.textContent = adminErrorMessage(error.message);
    message.dataset.state = 'error';
  } finally {
    button.disabled = false;
  }
}

async function deleteManagedUser() {
  const id = document.querySelector('#managed-user-id').value;
  const confirmUsername = document.querySelector('#managed-delete-confirmation').value.trim().toLowerCase();
  const message = document.querySelector('#managed-user-message');
  const button = document.querySelector('#managed-user-delete');
  button.disabled = true;
  message.textContent = 'กำลังลบบัญชี…';
  try {
    await adminRequest('delete', { userId: id, confirmUsername });
    closeUserDialog();
    await loadManagedUsers();
    setListMessage('ลบบัญชีผู้ใช้งานแล้ว');
  } catch (error) {
    message.textContent = adminErrorMessage(error.message);
    message.dataset.state = 'error';
  } finally {
    button.disabled = false;
  }
}

setTheme(localStorage.getItem('engineering-workspace-theme') || 'dark');
sidebarToggle.addEventListener('click', () => setCollapsed(!appShell.classList.contains('is-collapsed')));
themeToggle.addEventListener('click', () => setTheme(appShell.classList.contains('is-light') ? 'dark' : 'light'));
document.querySelector('#admin-create-user-button').addEventListener('click', () => openUserDialog());
document.querySelector('#managed-user-close').addEventListener('click', closeUserDialog);
document.querySelector('#managed-user-cancel').addEventListener('click', closeUserDialog);
document.querySelector('#managed-user-form').addEventListener('submit', saveManagedUser);
document.querySelector('#managed-user-delete').addEventListener('click', deleteManagedUser);

(async () => {
  try {
    await window.RD_AUTH_READY;
    session = window.RDSiteAuth?.getSession() || null;
    await showPortal();
  } catch (error) {
    if (error.message === 'PERMISSION_DENIED') showAccessDenied();
  }
})();
