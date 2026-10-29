const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'spare-parts.json'), 'utf8'));
const inventoryOrigin = 'https://requisition-consumables-api.requisition-rd.workers.dev';
test('Fixture covers zero, minimum and above-minimum stock without sensitive fields', () => {
  assert.deepEqual(fixture.items.map(({ current_stock, min_stock, stock_status }) => [current_stock, min_stock, stock_status]), [
    [2, 2, 'low'], [0, 2, 'out'], [9, 3, 'normal'],
  ]);
  for (const item of fixture.items) {
    assert.equal(Object.keys(item).some((key) => /price|cost|serial|user|email|phone/i.test(key)), false);
  }
});
test('Inventory Worker origin and feature flag are configured', () => {
  const config = fs.readFileSync(path.join(root, 'auth-config.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'spare-parts.html'), 'utf8');
  assert.ok(config.includes(`sparePartsApiBaseUrl: '${inventoryOrigin}'`));
  for (const [hostname, expected] of [['127.0.0.1', true], ['rd-eng-devalopment-site.github.io', false]]) {
    const window = { location: { hostname } };
    vm.runInNewContext(config, { window });
    assert.equal(window.RD_AUTH_CONFIG.sparePartsEnabled, expected, hostname);
  }
  assert.ok(html.match(/connect-src ([^;]+);/)?.[1].includes(inventoryOrigin));
});
const modules = 'C:\\Users\\NITRO 5\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules';
let chromium;
try { chromium = require('playwright').chromium; }
catch (_) { try { chromium = require(path.join(modules, 'playwright')).chromium; } catch (_) {} }
const chrome = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);

if (!chromium || !chrome) {
  test('Spare-parts browser checks require installed Chrome/Playwright', { skip: true }, () => {});
} else {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent((request.url || '/').split('?')[0]);
    const file = path.resolve(root, pathname.slice(1));
    if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404); response.end('Not found'); return;
    }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  });

  test('Read-only catalog honors machine IDs, search, status and detail contract', async () => {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ executablePath: chrome, headless: true });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const inventoryRequests = [];
    let mode = 'success';
    let featureEnabled = true;
    let directoryMode = 'success';
    try {
      await page.route('**/spare-parts.html*', (route) => {
        const html = fs.readFileSync(path.join(root, 'spare-parts.html'), 'utf8')
          .replace(/connect-src ([^;]+);/, (_, sources) => `connect-src ${sources} https://inventory.test;`);
        route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      });
      await page.route('**/auth-config.js', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: `window.RD_AUTH_CONFIG={sparePartsEnabled:${featureEnabled},sparePartsApiBaseUrl:'https://inventory.test'};` }));
      await page.route('**/auth-guard.js', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: `window.__logoutCount=0;window.RDSiteAuth={getUser:()=>({username:'fixture-engineer',role:'Engineer'}),getAccessToken:async()=> 'FIXTURE_TOKEN',logout:async()=>{window.__logoutCount++}};window.RD_AUTH_READY=Promise.resolve({username:'fixture-engineer',role:'Engineer'});document.documentElement.dataset.authState='authenticated';` }));
      await page.route('https://inventory.test/**', (route) => {
        const request = route.request();
        if (request.method() === 'OPTIONS') {
          route.fulfill({ status: 204, headers: { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'authorization' } });
          return;
        }
        const url = new URL(request.url());
        inventoryRequests.push({ url, method: request.method(), authorization: request.headers().authorization });
        const headers = { 'access-control-allow-origin': origin, 'cache-control': 'no-store' };
        if (url.pathname === '/api/rd/machines') {
          if (directoryMode === 'error') {
            route.fulfill({ status: 503, headers, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INVENTORY_UNAVAILABLE' } }) });
            return;
          }
          route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ machines: [
            { machine_id: 'RD-M-001', machine_name: 'เครื่องบรรจุ', zone: 'โซนล่าง' },
            { machine_id: 'RD-M-002', machine_name: 'เครื่องผสม', zone: 'โซนบน' },
            { machine_id: 'RD-M-003', machine_name: 'เครื่องเป่า', zone: 'โซนล่าง' },
            { machine_id: 'RD-M-005', machine_name: 'รหัสซ้ำ', zone: 'โซนล่าง' },
            { machine_id: 'RD-M-005', machine_name: 'รหัสซ้ำอีกแถว', zone: 'โซนบน' }
          ], generated_at: fixture.generated_at }) });
          return;
        }
        if (mode === 'slow') return; // Leave the request pending until the page's timeout aborts it.
        if (['forbidden', 'unavailable', 'machine-not-found', 'auth-required'].includes(mode)) {
          const status = { forbidden: 403, unavailable: 503, 'machine-not-found': 404, 'auth-required': 401 }[mode];
          const code = { forbidden: 'FORBIDDEN', unavailable: 'INVENTORY_UNAVAILABLE', 'machine-not-found': 'MACHINE_NOT_FOUND', 'auth-required': 'AUTH_REQUIRED' }[mode];
          route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify({ error: { code, message: 'fixture error' } }) });
          return;
        }
        if (url.pathname.endsWith('/item-low')) {
          route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ item: fixture.items[0], generated_at: fixture.generated_at }) });
          return;
        }
        const machineId = url.searchParams.get('machine_id');
        const q = (url.searchParams.get('q') || '').toLowerCase();
        const filtered = fixture.items.filter((item) => (!machineId || item.compatible_machines.some((machine) => machine.machine_id === machineId))
          && (!q || [item.item_code, item.name, item.part_no].some((value) => value.toLowerCase().includes(q))));
        const items = mode === 'paged' ? (url.searchParams.has('cursor') ? filtered.slice(1) : filtered.slice(0, 1)) : filtered;
        const next_cursor = mode === 'paged' && !url.searchParams.has('cursor') ? 'opaque-page-2' : null;
        route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ items, next_cursor, generated_at: fixture.generated_at }) });
      });

      await page.goto(`${origin}/spare-parts.html?machine_id=RD-M-001`);
      await page.getByText('สายพานเครื่องจักร').waitFor();
      assert.equal(await page.locator('.spare-item').count(), 2);
      assert.match(await page.locator('#spare-machine-context-text').innerText(), /RD-M-001/);
      const firstItemsRequest = inventoryRequests.find(({ url }) => url.pathname === '/api/rd/spare-parts');
      assert.equal(firstItemsRequest.url.searchParams.get('machine_id'), 'RD-M-001');
      assert.equal(firstItemsRequest.authorization, 'Bearer FIXTURE_TOKEN');
      assert.equal(firstItemsRequest.url.searchParams.has('accessToken'), false);
      assert.equal(firstItemsRequest.method, 'GET');
      assert.equal(await page.locator('#spare-machine option[value="RD-M-004"]').count(), 0);
      assert.equal(await page.locator('#spare-machine option[value="RD-M-005"]').count(), 0);
      await page.locator('#spare-status').selectOption('out');
      assert.equal(await page.locator('.spare-item').count(), 1);
      await page.locator('#spare-status').selectOption('');
      await page.getByRole('button', { name: /สายพานเครื่องจักร/ }).click();
      await page.locator('#spare-detail-name').getByText('สายพานเครื่องจักร').waitFor();
      assert.equal(await page.locator('#spare-detail-part-no').innerText(), 'BELT-001');
      assert.match(await page.locator('#spare-detail-announcement').innerText(), /สายพานเครื่องจักร/);
      assert.equal(await page.getByText('ราคา').count(), 0);
      assert.equal(await page.locator('#spare-image-fallback').isVisible(), true);
      await page.locator('#spare-clear-machine').click();
      await page.getByText('ลูกปืนเพลา').waitFor();
      assert.equal(await page.locator('.spare-item').count(), 3);
      await page.locator('#spare-query').fill('FILTER-002');
      await page.locator('#spare-search-form button[type="submit"]').click();
      await page.getByText('ฟิลเตอร์ระบบลม').waitFor();
      assert.equal(await page.locator('.spare-item').count(), 1);

      await page.locator('#spare-machine').selectOption('RD-M-003');
      await page.getByText('ไม่พบอะไหล่ที่ตรงกับคำค้นสำหรับเครื่องนี้').waitFor();
      await page.locator('#spare-query').fill('');
      await page.locator('#spare-search-form button[type="submit"]').click();
      await page.getByText('เครื่องนี้ยังไม่มีอะไหล่ที่ผูกไว้ในระบบคลัง').waitFor();
      assert.equal(await page.locator('.spare-item').count(), 0);

      mode = 'slow';
      await page.locator('#spare-machine').selectOption('');
      await page.getByText('ระบบคลังตอบช้าเกินไป กรุณาลองใหม่').waitFor({ timeout: 15000 });
      assert.equal(await page.locator('#spare-retry').isVisible(), true);
      assert.equal(await page.locator('.spare-item').count(), 0);

      mode = 'unavailable';
      await page.locator('#spare-retry').click();
      await page.getByText('โหลดรายการอะไหล่จากระบบคลังไม่ได้ กรุณาลองอีกครั้ง').waitFor();
      assert.equal(await page.locator('#spare-retry').isVisible(), true);
      assert.equal(await page.locator('.spare-item').count(), 0);
      mode = 'forbidden';
      await page.locator('#spare-retry').click();
      await page.getByText('บัญชีนี้ไม่มีสิทธิ์อ่านข้อมูลอะไหล่จากระบบคลัง').waitFor();

      mode = 'machine-not-found';
      await page.locator('#spare-machine').selectOption('RD-M-001');
      await page.getByText('ระบบคลังยังไม่รู้จักรหัสเครื่องจักรนี้ กรุณาตรวจการจับคู่รหัสกับทีมคลัง').waitFor();

      mode = 'paged';
      await page.locator('#spare-query').fill('');
      await page.locator('#spare-search-form button[type="submit"]').click();
      await page.locator('#spare-machine').selectOption('');
      await page.locator('.spare-item').first().waitFor();
      assert.equal(await page.locator('.spare-item').count(), 1);
      await page.locator('#spare-load-more').click();
      await page.getByText('ลูกปืนเพลา').waitFor();
      assert.equal(await page.locator('.spare-item').count(), 3);
      assert.equal(inventoryRequests.at(-1).url.searchParams.get('cursor'), 'opaque-page-2');

      const beforeUnmatched = inventoryRequests.filter(({ url }) => url.pathname === '/api/rd/spare-parts').length;
      await page.goto(`${origin}/spare-parts.html?machine_id=RD-NOT-REGISTERED`);
      await page.getByText(/รหัสเครื่องจักรนี้ไม่อยู่ในทะเบียน R&D/).waitFor();
      assert.equal(inventoryRequests.filter(({ url }) => url.pathname === '/api/rd/spare-parts').length, beforeUnmatched);

      mode = 'auth-required';
      await page.goto(`${origin}/spare-parts.html`);
      await page.waitForFunction(() => window.__logoutCount === 1);

      mode = 'success';
      directoryMode = 'error';
      await page.goto(`${origin}/spare-parts.html`);
      await page.locator('#spare-machine-retry').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#spare-machine option').first().textContent(), 'โหลดทะเบียนเครื่องจักรไม่ได้');
      directoryMode = 'success';
      await page.locator('#spare-machine-retry').click();
      await page.locator('#spare-machine option[value="RD-M-001"]').waitFor({ state: 'attached' });
      assert.equal(await page.locator('#spare-machine-retry').isVisible(), false);
      directoryMode = 'success';
      await page.goto(`${origin}/spare-parts.html?machine_id=RD-M-001`);
      await page.getByText('สายพานเครื่องจักร').waitFor();
      await page.getByRole('button', { name: /สายพานเครื่องจักร/ }).click();
      await page.locator('#spare-detail-name').getByText('สายพานเครื่องจักร').waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300); // Let the shared sidebar width transition settle before visual QA.
      assert.equal(await page.locator('body').evaluate((body) => body.scrollWidth <= window.innerWidth), true);
      if (process.env.SPARE_CAPTURE === '1') {
        await page.evaluate(() => {
          const label = document.createElement('div');
          label.textContent = 'TEST FIXTURE · ไม่ใช่ข้อมูลคลังจริง';
          label.style.cssText = 'position:fixed;z-index:9999;right:12px;bottom:12px;padding:8px 12px;border:2px solid #dc1e32;border-radius:8px;background:#101218;color:#fff;font:700 12px Segoe UI,sans-serif;pointer-events:none';
          document.body.append(label);
        });
        const review = path.join(root, '.impeccable', 'review');
        fs.mkdirSync(review, { recursive: true });
        await page.screenshot({ path: path.join(review, 'spare-mobile.png'), fullPage: true });
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(review, 'spare-desktop.png'), fullPage: true });
      }
      featureEnabled = false;
      const beforeDisabled = inventoryRequests.length;
      await page.goto(`${origin}/spare-parts.html`);
      await page.getByText(/ยังไม่ได้เชื่อม Inventory Worker/).waitFor();
      assert.equal(inventoryRequests.length, beforeDisabled);
      await page.goto(`${origin}/index.html`);
      await page.locator('#parts-menu .is-disabled').waitFor({ state: 'attached' });
      assert.equal(await page.locator('#parts-menu a[href="spare-parts.html"]').count(), 0);
    } finally {
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
    }
  });
}
