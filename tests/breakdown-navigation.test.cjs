const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const config = {
  protectedPages: ['index.html', 'machine-breakdown.html', 'machine-breakdown-repair.html', 'machine-breakdown-inspection.html', 'machine-breakdown-analysis.html', 'pm-work-order.html'],
  allowedRoles: ['Admin'], sessionKey: 'test-session', supabaseUrl: 'https://example.test', publishableKey: 'test',
};

async function loginDestination(next) {
  let destination = '';
  const element = { addEventListener() {}, value: '', setAttribute() {}, focus() {} };
  const context = {
    window: { RD_AUTH_CONFIG: config },
    document: { querySelector: () => element },
    location: { search: `?next=${encodeURIComponent(next)}`, replace: value => { destination = value; } },
    sessionStorage: { getItem: () => JSON.stringify({ access_token: 'test', expires_at: Math.floor(Date.now() / 1000) + 3600 }) },
    fetch: async () => ({ ok: true, json: async () => ({ app_metadata: { role: 'Admin' } }) }),
    URLSearchParams, Date,
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'login.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  return destination;
}

test('login returns to the selected Breakdown section and incident after authentication', async () => {
  for (const section of ['report', 'repair', 'inspection', 'analysis']) {
    assert.equal(await loginDestination(`machine-breakdown.html?section=${section}&incident=BD-12345678`), `machine-breakdown.html?section=${section}&incident=BD-12345678`);
  }
  assert.equal(await loginDestination('machine-breakdown.html?section=repair&testRole=admin'), 'index.html');
  assert.equal(await loginDestination('machine-breakdown.html?section=unknown'), 'index.html');
  for (const page of ['machine-breakdown-repair.html', 'machine-breakdown-inspection.html', 'machine-breakdown-analysis.html']) {
    assert.equal(await loginDestination(`${page}?incident=BD-12345678`), `${page}?incident=BD-12345678`);
    assert.equal(await loginDestination(`${page}?section=report`), 'index.html');
    assert.equal(await loginDestination(`${page}?testRole=admin`), 'index.html');
  }
});

test('auth redirect keeps only validated Breakdown route parameters', async () => {
  let redirected = '';
  const context = {
    window: { RD_AUTH_CONFIG: config, dispatchEvent() {} },
    document: { documentElement: { dataset: {} } },
    location: {
      pathname: '/machine-breakdown.html', search: '?section=repair&incident=BD-12345678&testRole=admin', hash: '',
      replace: value => { redirected = value; },
    },
    sessionStorage: { getItem: () => null, removeItem() {}, setItem() {} },
    URLSearchParams, Date, CustomEvent: class {},
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'auth-guard.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  const next = new URLSearchParams(redirected.split('?')[1]).get('next');
  assert.equal(next, 'machine-breakdown.html?section=repair&incident=BD-12345678');
  const pageFiles = { report: 'machine-breakdown.html', repair: 'machine-breakdown-repair.html', inspection: 'machine-breakdown-inspection.html', analysis: 'machine-breakdown-analysis.html' };
  for (const section of ['repair', 'inspection', 'analysis']) {
    let canonical = '';
    const legacy = {
      window: { RD_AUTH_CONFIG: { breakdownPages: pageFiles } },
      document: { body: { dataset: { breakdownSection: 'report' } }, querySelector() { throw Error('Legacy route should redirect before mounting a form'); } },
      location: { pathname: '/machine-breakdown.html', search: `?section=${section}&incident=BD-12345678&testRole=admin`, hash: '', replace: value => { canonical = value; } },
      URLSearchParams,
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'machine-breakdown.js'), 'utf8'), legacy);
    assert.equal(canonical, `${pageFiles[section]}?incident=BD-12345678`);
  }
});

test('shared navigation builds its toolbar and moves the theme control on every Breakdown section and Main', () => {
  function element() {
    return {
      children: [], queries: new Map(),
      append(...nodes) { this.children.push(...nodes); nodes.forEach(node => { node.parentElement = this; }); },
      before(node) { this.insertedBefore = node; },
      querySelector(selector) { if (!this.queries.has(selector)) this.queries.set(selector, element()); return this.queries.get(selector); },
      setAttribute() {}, addEventListener() {},
    };
  }
  for (const [page, search, hash, heading, section] of [
    ['machine-breakdown', '?section=report', '', 'แจ้งเหตุขัดข้อง'],
    ['machine-breakdown', '?section=repair', '', 'ใบงานซ่อม'],
    ['machine-breakdown', '?section=inspection', '', 'ตรวจรับและปิดงาน'],
    ['machine-breakdown', '?section=analysis', '', 'รายงานและวิเคราะห์'],
    ['machine-breakdown', '', '#analysis-and-repair', 'ใบงานซ่อม'],
    ['machine-breakdown', '', '', 'ใบงานซ่อม', 'repair'],
    ['machine-breakdown', '', '', 'ตรวจรับและปิดงาน', 'inspection'],
    ['machine-breakdown', '', '', 'รายงานและวิเคราะห์', 'analysis'],
    ['main', '', '', 'Main'],
  ]) {
    const workspace = element(), theme = element();
    const context = {
      document: { body: { dataset: { page, breakdownSection: section } }, createElement: element, querySelector: selector => selector === '.workspace' ? workspace : selector === '#theme-toggle' ? theme : null },
      location: { search, hash },
      window: { RDSiteAuth: { getUser: () => ({ username: 'TEST', role: 'Admin' }) }, setInterval() {} },
      URLSearchParams, Date, Intl,
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'navigation.js'), 'utf8'), context);
    assert.equal(workspace.insertedBefore.className, 'workspace-tools');
    assert.match(workspace.insertedBefore.children[0].innerHTML, new RegExp(heading));
    assert.equal(theme.parentElement.className, 'workspace-actions');
    assert.ok(workspace.insertedBefore.children.includes(theme.parentElement));
  }
});

test('each dedicated document contains only its own workflow forms and no shared stage rail', () => {
  const configContext = { window: { location: { hostname: 'example.test' } } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'auth-config.js'), 'utf8'), configContext);
  const expected = {
    'machine-breakdown.html': ['report', ['bd-create-form', 'bd-cancel-form']],
    'machine-breakdown-repair.html': ['repair', ['bd-assign-form', 'bd-start-form', 'bd-repair-form', 'bd-cancel-form']],
    'machine-breakdown-inspection.html': ['inspection', ['bd-inspect-form']],
    'machine-breakdown-analysis.html': ['analysis', []],
  };
  for (const [file, [section, forms]] of Object.entries(expected)) {
    assert.ok(configContext.window.RD_AUTH_CONFIG.protectedPages.includes(file));
    assert.equal(configContext.window.RD_AUTH_CONFIG.breakdownPages[section], file);
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(html, new RegExp(`data-breakdown-section="${section}"`));
    assert.doesNotMatch(html, /id="bd-workflow-nav"/);
    assert.deepEqual([...html.matchAll(/<form\b[^>]*\bid="([^"]+)"/g)].map(m => m[1]).sort(), forms.sort());
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, file + ' has duplicate IDs');
  }
});
