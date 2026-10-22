(function initializeAuthGuard() {
  'use strict';

  const config = window.RD_AUTH_CONFIG;
  if (!config) throw new Error('AUTH_CONFIG_MISSING');

  let session = null;
  let authenticatedUser = null;

  function loadStoredSession() {
    try {
      return JSON.parse(sessionStorage.getItem(config.sessionKey) || 'null');
    } catch (_) {
      sessionStorage.removeItem(config.sessionKey);
      return null;
    }
  }

  function saveSession(value) {
    session = value;
    if (value) sessionStorage.setItem(config.sessionKey, JSON.stringify(value));
    else sessionStorage.removeItem(config.sessionKey);
  }

  async function parseResponse(response) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error_code || payload.code || 'AUTH_REQUEST_FAILED');
    return payload;
  }

  async function refreshSession() {
    if (!session?.refresh_token) throw new Error('SESSION_EXPIRED');
    const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    const payload = await parseResponse(response);
    saveSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600),
    });
  }

  async function getAccessToken() {
    if (!session) throw new Error('SESSION_EXPIRED');
    if (Number(session.expires_at || 0) - 60 <= Math.floor(Date.now() / 1000)) await refreshSession();
    return session.access_token;
  }

  async function verifyUser() {
    const token = await getAccessToken();
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.publishableKey, Authorization: `Bearer ${token}` },
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    const user = await parseResponse(response);
    const role = String(user.app_metadata?.role || '');
    if (!config.allowedRoles.includes(role)) throw new Error('ROLE_NOT_ALLOWED');
    return {
      id: String(user.id || ''),
      username: String(user.app_metadata?.username || '').slice(0, 32),
      role,
    };
  }

  function currentDestination() {
    const filename = location.pathname.split('/').pop() || 'index.html';
    if (!config.protectedPages.includes(filename)) return 'index.html';
    const query = new URLSearchParams();
    if (filename === 'pm-work-order.html') {
      const current = new URLSearchParams(location.search);
      ['id', 'planIds'].forEach((key) => {
        const value = current.get(key);
        if (value && /^[A-Za-z0-9._,-]{1,5000}$/.test(value)) query.set(key, value);
      });
    } else if (filename === 'spare-parts.html') {
      const current = new URLSearchParams(location.search);
      const machineId = current.get('machine_id');
      const itemId = current.get('item_id');
      if (machineId && /^[^\x00-\x1F\x7F]{1,80}$/.test(machineId)) query.set('machine_id', machineId);
      if (itemId && /^[A-Za-z0-9._-]{1,128}$/.test(itemId)) query.set('item_id', itemId);
    } else if (/^machine-breakdown(?:-(?:repair|inspection|analysis))?\.html$/.test(filename)) {
      const current = new URLSearchParams(location.search);
      const section = current.get('section');
      const incident = current.get('incident');
      if (filename === 'machine-breakdown.html' && ['report', 'repair', 'inspection', 'analysis'].includes(section)) query.set('section', section);
      if (incident && /^BD-[A-Za-z0-9_-]{8,100}$/.test(incident)) query.set('incident', incident);
    }
    return `${filename}${query.size ? `?${query}` : ''}${location.hash || ''}`;
  }

  function redirectToLogin(reason) {
    saveSession(null);
    const query = new URLSearchParams({ next: currentDestination() });
    if (reason === 'expired') query.set('reason', 'expired');
    location.replace(`login.html?${query.toString()}`);
  }

  async function logout() {
    const accessToken = session?.access_token;
    saveSession(null);
    authenticatedUser = null;
    if (accessToken) {
      fetch(`${config.supabaseUrl}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      }).catch(() => {});
    }
    location.replace('login.html?reason=logout');
  }

  function markDashboardChanged(action, payload) {
    const sections = {
      saveMachine: ['machines'],
      savePmWorkflow: ['pm'],
      savePmWorkflowV2: ['pm'],
      saveBreakdownWorkflow: ['breakdown'],
      setupBreakdown: ['breakdown'],
    }[action] || (action === 'setupPmV2' && payload.mode === 'apply' ? ['pm'] : []);
    sections.forEach((section) => {
      const revision = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      try { localStorage.setItem(`rd-dashboard-changed:${section}`, revision); } catch (_) {}
      window.dispatchEvent(new CustomEvent('rd-dashboard-data-changed', { detail: { section, revision } }));
    });
  }

  async function apiRequest(action, payload = {}) {
    const accessToken = await getAccessToken();
    const response = await fetch(config.secureApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, accessToken, payload }),
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      const code = result.error || 'API_REQUEST_FAILED';
      if (code === 'AUTH_REQUIRED' || code === 'SESSION_EXPIRED' || code === 'ROLE_NOT_ASSIGNED') await logout();
      throw new Error(code);
    }
    markDashboardChanged(action, payload);
    return result.data;
  }

  session = loadStoredSession();
  window.RDSiteAuth = Object.freeze({
    getAccessToken,
    getUser: () => authenticatedUser,
    getSession: () => session,
    apiRequest,
    logout,
  });

  window.RD_AUTH_READY = (async () => {
    if (!session?.access_token) {
      redirectToLogin('required');
      throw new Error('AUTH_REDIRECT');
    }
    try {
      authenticatedUser = await verifyUser();
      document.documentElement.dataset.authState = 'authenticated';
      window.dispatchEvent(new CustomEvent('rd-auth-ready', { detail: authenticatedUser }));
      return authenticatedUser;
    } catch (error) {
      redirectToLogin('expired');
      throw error;
    }
  })();
  window.RD_AUTH_READY.catch(() => {});
})();
