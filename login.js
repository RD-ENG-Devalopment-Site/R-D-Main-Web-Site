(function initializeLogin() {
  'use strict';

  const config = window.RD_AUTH_CONFIG;
  const form = document.querySelector('#site-login-form');
  const usernameInput = document.querySelector('#site-login-username');
  const passwordInput = document.querySelector('#site-login-password');
  const submitButton = document.querySelector('#site-login-submit');
  const message = document.querySelector('#site-login-message');

  function normalizeUsername(value) {
    const username = String(value || '').trim().toLowerCase();
    return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) ? username : '';
  }

  function safeDestination() {
    const requested = new URLSearchParams(location.search).get('next') || 'index.html';
    const match = requested.match(/^([a-z0-9-]+\.html)(\?[^#]*)?(#[a-z0-9_-]+)?$/i);
    if (!match || !config.protectedPages.includes(match[1])) return 'index.html';
    const query = new URLSearchParams(match[2] || '');
    if (match[2]) {
      const allowed = match[1] === 'pm-work-order.html' ? [...query].every(([key, value]) =>
        ['id', 'planIds'].includes(key) && /^[A-Za-z0-9._,-]{1,5000}$/.test(value))
        : match[1] === 'spare-parts.html' ? [...query].every(([key, value]) =>
          key === 'machine_id' ? /^[^\x00-\x1F\x7F]{1,80}$/.test(value)
            : key === 'item_id' && /^[A-Za-z0-9._-]{1,128}$/.test(value))
        : /^machine-breakdown(?:-(?:repair|inspection|analysis))?\.html$/.test(match[1]) ? [...query].every(([key, value]) =>
          key === 'section' ? match[1] === 'machine-breakdown.html' && ['report', 'repair', 'inspection', 'analysis'].includes(value)
            : key === 'incident' && /^BD-[A-Za-z0-9_-]{8,100}$/.test(value))
        : false;
      if (!allowed || ![...query].length) return 'index.html';
    }
    return requested;
  }

  function setMessage(text, state = 'error') {
    message.textContent = text;
    message.dataset.state = state;
    message.setAttribute('role', state === 'error' ? 'alert' : 'status');
  }

  function saveSession(payload) {
    sessionStorage.setItem(config.sessionKey, JSON.stringify({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600),
    }));
  }

  async function parseResponse(response) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error_code || 'INVALID_CREDENTIALS');
    return payload;
  }

  async function verifyRole(accessToken) {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    const user = await parseResponse(response);
    if (!config.allowedRoles.includes(String(user.app_metadata?.role || ''))) throw new Error('ROLE_NOT_ALLOWED');
  }

  async function useStoredSession() {
    let stored;
    try { stored = JSON.parse(sessionStorage.getItem(config.sessionKey) || 'null'); } catch (_) { stored = null; }
    if (!stored?.access_token || Number(stored.expires_at || 0) <= Math.floor(Date.now() / 1000) + 30) return;
    try {
      await verifyRole(stored.access_token);
      location.replace(safeDestination());
    } catch (_) {
      sessionStorage.removeItem(config.sessionKey);
    }
  }

  async function signIn(event) {
    event.preventDefault();
    const username = normalizeUsername(usernameInput.value);
    if (!username) {
      setMessage('กรุณาตรวจชื่อผู้ใช้: ใช้ a-z, 0-9, จุด, ขีดกลาง หรือขีดล่าง');
      usernameInput.focus();
      return;
    }
    if (!passwordInput.value) {
      setMessage('กรุณากรอกรหัสผ่าน');
      passwordInput.focus();
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'กำลังตรวจสอบ…';
    setMessage('กำลังยืนยันตัวตน', 'working');
    try {
      const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `${username}@${config.usernameDomain}`, password: passwordInput.value }),
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      });
      const payload = await parseResponse(response);
      passwordInput.value = '';
      await verifyRole(payload.access_token);
      saveSession(payload);
      setMessage('ยืนยันตัวตนแล้ว กำลังเปิดระบบ…', 'success');
      location.replace(safeDestination());
    } catch (_) {
      passwordInput.value = '';
      sessionStorage.removeItem(config.sessionKey);
      setMessage('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกระงับ');
      passwordInput.focus();
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'เข้าสู่ระบบ';
    }
  }

  form.addEventListener('submit', signIn);
  document.querySelector('#site-login-reveal').addEventListener('click', (event) => {
    const reveal = passwordInput.type === 'password';
    passwordInput.type = reveal ? 'text' : 'password';
    event.currentTarget.setAttribute('aria-pressed', String(reveal));
    event.currentTarget.setAttribute('aria-label', reveal ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
  });

  const reason = new URLSearchParams(location.search).get('reason');
  if (reason === 'expired') setMessage('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
  if (reason === 'logout') setMessage('ออกจากระบบแล้ว', 'success');
  useStoredSession();
})();
