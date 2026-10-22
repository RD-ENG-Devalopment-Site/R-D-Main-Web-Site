const navigationMount = document.querySelector('#sidebar-mount');
const currentPage = document.body.dataset.page || 'main';
const sparePartsEnabled = Boolean(window.RD_AUTH_CONFIG?.sparePartsEnabled && window.RD_AUTH_CONFIG?.sparePartsApiBaseUrl);
const requestedBreakdownSection = new URLSearchParams(location.search).get('section');
const breakdownSection = document.body.dataset.breakdownSection || (['report', 'repair', 'inspection', 'analysis'].includes(requestedBreakdownSection) ? requestedBreakdownSection : location.hash === '#analysis-and-repair' ? 'repair' : location.hash === '#inspection' ? 'inspection' : location.hash === '#analysis' ? 'analysis' : 'report');

if (navigationMount) {
  const isMain = currentPage === 'main';
  const isLowerZone = currentPage === 'machine-lower-zone';
  const isUpperZone = currentPage === 'machine-upper-zone';
  const isRecordingPage = currentPage === 'machine-data-recording';
  const isSparePartsPage = currentPage === 'spare-parts';
  const isPreventiveMaintenancePage = currentPage === 'preventive-maintenance';
  const isBreakdownPage = currentPage === 'machine-breakdown';
  const isUserManagementPage = currentPage === 'user-management';
  const isSystemSettingsPage = currentPage === 'system-settings';
  const isMachinePage = isLowerZone || isUpperZone || isRecordingPage;
  const isSettingsPage = isUserManagementPage || isSystemSettingsPage;
  const pageClass = (active) => active ? ' is-current' : '';
  const currentAttribute = (active) => active ? ' aria-current="page"' : '';

  navigationMount.innerHTML = `
    <div class="sidebar-top">
      <div class="brand-mark">
        <img class="brand-logo" src="assets/RDLOGO.png" alt="R&amp;D Engineer" />
        <span class="brand-title">Engineer R&amp;D Site</span>
      </div>
    </div>

    <div class="sidebar-menu">
      <p class="nav-section">Engineering Data</p>
      <nav class="navigation" aria-label="เมนูหลัก">
        <a class="nav-main${pageClass(isMain)}" href="index.html"${currentAttribute(isMain)} aria-label="Main">
          <svg class="nav-icon nav-icon-main" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 11 8-7 8 7v9H4z" /><path d="M9.5 20v-5h5v5" /></svg>
          <span class="nav-label">Main</span>
        </a>
        <div class="nav-group">
          <button class="nav-disclosure${pageClass(isMachinePage)}" type="button" aria-expanded="${isMachinePage}" aria-controls="machine-menu" aria-label="ข้อมูลเครื่องจักร">
            <svg class="nav-icon nav-icon-machine" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V5" /><path d="M4 20h17" /><path d="M8 17v-5" /><path d="M12.5 17V8" /><path d="M17 17v-9" /><path d="M21 17v-3" /></svg>
            <span class="nav-label">ข้อมูลเครื่องจักร</span>
            <svg class="chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 7.5 4.5 4.5 4.5-4.5" /></svg>
          </button>
          <div class="submenu" id="machine-menu"${isMachinePage ? '' : ' hidden'}>
            <div class="submenu-list">
              <a class="submenu-link${pageClass(isLowerZone)}" href="machine-lower-zone.html"${currentAttribute(isLowerZone)}>โซนล่าง</a>
              <a class="submenu-link${pageClass(isUpperZone)}" href="machine-upper-zone.html"${currentAttribute(isUpperZone)}>โซนบน</a>
              <a class="submenu-link${pageClass(isRecordingPage)}" href="machine-data-recording.html"${currentAttribute(isRecordingPage)}>บันทึกเครื่องจักร</a>
              <span class="submenu-link is-disabled" aria-disabled="true">อื่นๆ</span>
            </div>
          </div>
        </div>
        <div class="nav-group">
          <button class="nav-disclosure${pageClass(isSparePartsPage)}" type="button" aria-expanded="${isSparePartsPage}" aria-controls="parts-menu" aria-label="อะไหล่เครื่องจักร">
            <svg class="nav-icon nav-icon-parts" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3.5 2" /></svg>
            <span class="nav-label">อะไหล่เครื่องจักร</span>
            <svg class="chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 7.5 4.5 4.5 4.5-4.5" /></svg>
          </button>
          <div class="submenu" id="parts-menu"${isSparePartsPage ? '' : ' hidden'}><div class="submenu-list">
            ${sparePartsEnabled || isSparePartsPage
              ? `<a class="submenu-link${pageClass(isSparePartsPage)}" href="spare-parts.html"${currentAttribute(isSparePartsPage)}>รายการอะไหล่</a>`
              : '<span class="submenu-link is-disabled" aria-disabled="true" title="รอเปิด API ระบบคลัง">รายการอะไหล่ · รอเชื่อมต่อ</span>'}
          </div></div>
        </div>
        <div class="nav-group">
          <button class="nav-disclosure${pageClass(isPreventiveMaintenancePage)}" type="button" aria-expanded="${isPreventiveMaintenancePage}" aria-controls="pm-menu" aria-label="Preventive Maintenance">
            <svg class="nav-icon nav-icon-pm" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 9h8M8 13h2m3 0h3M8 17h2m3 0h3" /></svg>
            <span class="nav-label">Preventive Maintenance</span>
            <svg class="chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 7.5 4.5 4.5 4.5-4.5" /></svg>
          </button>
          <div class="submenu" id="pm-menu"${isPreventiveMaintenancePage ? '' : ' hidden'}>
            <div class="submenu-list">
              <a class="submenu-link${pageClass(isPreventiveMaintenancePage)}" href="preventive-maintenance.html"${currentAttribute(isPreventiveMaintenancePage)}>ภาพรวม PM</a>
              <a class="submenu-link" href="preventive-maintenance.html#daily">แผนรายวัน</a>
              <a class="submenu-link" href="preventive-maintenance.html#monthly">แผนรายเดือน</a>
              <a class="submenu-link" href="preventive-maintenance.html#annual">แผนรายปี</a>
            </div>
          </div>
        </div>
        <div class="nav-group">
          <button class="nav-disclosure${pageClass(isBreakdownPage)}" type="button" aria-expanded="${isBreakdownPage}" aria-controls="breakdown-menu" aria-label="Break Down">
            <svg class="nav-icon nav-icon-breakdown" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5m0 3h.01" /></svg>
            <span class="nav-label">Break Down</span>
            <svg class="chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 7.5 4.5 4.5 4.5-4.5" /></svg>
          </button>
          <div class="submenu" id="breakdown-menu"${isBreakdownPage ? '' : ' hidden'}>
            <div class="submenu-list">
              <a class="submenu-link${pageClass(isBreakdownPage && breakdownSection === 'report')}" href="machine-breakdown.html"${currentAttribute(isBreakdownPage && breakdownSection === 'report')}>แจ้งเหตุขัดข้อง</a>
              <a class="submenu-link${pageClass(isBreakdownPage && breakdownSection === 'repair')}" href="machine-breakdown-repair.html"${currentAttribute(isBreakdownPage && breakdownSection === 'repair')}>ใบงานซ่อม</a>
              <a class="submenu-link${pageClass(isBreakdownPage && breakdownSection === 'inspection')}" href="machine-breakdown-inspection.html"${currentAttribute(isBreakdownPage && breakdownSection === 'inspection')}>ตรวจรับและปิดงาน</a>
              <a class="submenu-link${pageClass(isBreakdownPage && breakdownSection === 'analysis')}" href="machine-breakdown-analysis.html"${currentAttribute(isBreakdownPage && breakdownSection === 'analysis')}>รายงานและวิเคราะห์</a>
            </div>
          </div>
        </div>
        <div class="nav-group">
          <button class="nav-disclosure${pageClass(isSettingsPage)}" type="button" aria-expanded="${isSettingsPage}" aria-controls="settings-menu" aria-label="การตั้งค่า">
            <svg class="nav-icon nav-icon-settings" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg>
            <span class="nav-label">การตั้งค่า</span>
            <svg class="chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 7.5 4.5 4.5 4.5-4.5" /></svg>
          </button>
          <div class="submenu" id="settings-menu"${isSettingsPage ? '' : ' hidden'}>
            <div class="submenu-list">
              <a class="submenu-link${pageClass(isUserManagementPage)}" href="user-management.html"${currentAttribute(isUserManagementPage)}>จัดการผู้ใช้งาน</a>
              <a class="submenu-link${pageClass(isSystemSettingsPage)}" href="system-settings.html"${currentAttribute(isSystemSettingsPage)}>ตั้งค่าระบบ</a>
            </div>
          </div>
        </div>
      </nav>
    </div>

    <footer class="sidebar-foot">
      <span class="status-kicker">บัญชีที่ใช้งาน</span>
      <div class="sidebar-session">
        <span class="sidebar-avatar" id="sidebar-account-initial" aria-hidden="true">—</span>
        <strong class="sidebar-account"><span id="sidebar-account-name">กำลังตรวจสอบ…</span><small id="sidebar-account-role"></small></strong>
      </div>
      <button class="toggle-button" id="sidebar-toggle" type="button" aria-label="ย่อแถบนำทาง" aria-expanded="true" title="ย่อแถบนำทาง">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5M9 12h9" /></svg>
      </button>
    </footer>
  `;

  const disclosureButtons = navigationMount.querySelectorAll('.nav-disclosure');

  function setDisclosure(button, expanded) {
    const submenu = navigationMount.querySelector(`#${button.getAttribute('aria-controls')}`);
    button.setAttribute('aria-expanded', String(expanded));
    button.classList.toggle('is-current', expanded);
    submenu.hidden = !expanded;
  }

  disclosureButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const shouldExpand = button.getAttribute('aria-expanded') === 'false';
      disclosureButtons.forEach((item) => setDisclosure(item, false));
      setDisclosure(button, shouldExpand);
    });
  });

  function renderAuthenticatedAccount(user) {
    if (!user) return;
    const accountName = navigationMount.querySelector('#sidebar-account-name');
    const accountRole = navigationMount.querySelector('#sidebar-account-role');
    const accountInitial = navigationMount.querySelector('#sidebar-account-initial');
    if (accountName) accountName.textContent = user.username || 'ผู้ใช้งาน';
    if (accountRole) accountRole.textContent = user.role || '';
    if (accountInitial) accountInitial.textContent = (user.username || user.role || 'U').trim().charAt(0).toUpperCase();
    const settingsGroup = navigationMount.querySelector('[aria-controls="settings-menu"]')?.closest('.nav-group');
    if (settingsGroup && user.role !== 'Admin') settingsGroup.hidden = true;
  }

  renderAuthenticatedAccount(window.RDSiteAuth?.getUser());
  window.RD_AUTH_READY?.then(renderAuthenticatedAccount).catch(() => {});
}

const workspace = document.querySelector('.workspace');
const themeControl = document.querySelector('#theme-toggle');

if (workspace && themeControl) {
  const pageMeta = {
    main: ['Main', 'ภาพรวมงานวิศวกรรม'],
    'machine-lower-zone': ['โซนล่าง', 'ข้อมูลเครื่องจักร'],
    'machine-upper-zone': ['โซนบน', 'ข้อมูลเครื่องจักร'],
    'machine-data-recording': ['บันทึกเครื่องจักร', 'ข้อมูลเครื่องจักร'],
    'spare-parts': ['รายการอะไหล่', 'อะไหล่เครื่องจักร'],
    'preventive-maintenance': ['Preventive Maintenance', 'แผนงานบำรุงรักษา'],
    'machine-breakdown': [{ report: 'แจ้งเหตุขัดข้อง', repair: 'ใบงานซ่อม', inspection: 'ตรวจรับและปิดงาน', analysis: 'รายงานและวิเคราะห์' }[breakdownSection], 'Break Down'],
    'user-management': ['จัดการผู้ใช้งาน', 'สิทธิ์การเข้าถึงระบบ'],
    'system-settings': ['ตั้งค่าระบบ', 'การควบคุมและสถานะระบบ']
  };
  const [pageTitle, pageSection] = pageMeta[currentPage] || pageMeta.main;
  const utilityBar = document.createElement('header');
  utilityBar.className = 'workspace-tools';

  const pageContext = document.createElement('div');
  pageContext.className = 'workspace-context';
  pageContext.innerHTML = `<strong>${pageTitle}</strong><span>${pageSection}</span>`;

  const authenticatedUser = window.RDSiteAuth?.getUser();
  const baseSearchRoutes = [
    { label: 'Main', href: 'index.html', terms: ['main', 'หน้าหลัก'] },
    { label: 'โซนล่าง', href: 'machine-lower-zone.html', terms: ['โซนล่าง', 'เครื่องจักรโซนล่าง'] },
    { label: 'โซนบน', href: 'machine-upper-zone.html', terms: ['โซนบน', 'เครื่องจักรโซนบน'] },
    { label: 'บันทึกเครื่องจักร', href: 'machine-data-recording.html', terms: ['บันทึกเครื่องจักร', 'บันทึกข้อมูล'] },
    { label: 'รายการอะไหล่', href: 'spare-parts.html', terms: ['อะไหล่', 'part no', 'spare parts'], sparePartsOnly: true },
    { label: 'Preventive Maintenance', href: 'preventive-maintenance.html', terms: ['preventive maintenance', 'pm', 'บำรุงรักษา'] },
    { label: 'แจ้งเหตุขัดข้อง', href: 'machine-breakdown.html', terms: ['break down', 'breakdown', 'ขัดข้อง', 'แจ้งเสีย', 'แจ้งเหตุ'] },
    { label: 'ใบงานซ่อม', href: 'machine-breakdown-repair.html', terms: ['ซ่อม', 'ใบงาน', 'วิเคราะห์', 'อะไหล่'] },
    { label: 'ตรวจรับและปิดงาน', href: 'machine-breakdown-inspection.html', terms: ['ตรวจรับ', 'ปิดงาน', 'คืนเครื่อง'] },
    { label: 'รายงานและวิเคราะห์', href: 'machine-breakdown-analysis.html', terms: ['รายงาน', 'ประวัติ', 'เหตุซ้ำ', 'หยุดเครื่อง'] },
    { label: 'จัดการผู้ใช้งาน', href: 'user-management.html', terms: ['จัดการผู้ใช้งาน', 'ผู้ใช้งาน', 'user'], adminOnly: true },
    { label: 'ตั้งค่าระบบ', href: 'system-settings.html', terms: ['ตั้งค่าระบบ', 'การแจ้งเตือน', 'เชื่อมต่อ', 'audit'], adminOnly: true }
  ];
  let searchRoutes = [];
  const searchForm = document.createElement('form');
  searchForm.className = 'workspace-search';
  searchForm.setAttribute('role', 'search');
  searchForm.innerHTML = `
    <label class="sr-only" for="workspace-quick-search">ค้นหาเมนู</label>
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
    <input id="workspace-quick-search" type="search" list="workspace-search-options" autocomplete="off" placeholder="ค้นหาเมนู..." />
    <datalist id="workspace-search-options"></datalist>
  `;

  const actions = document.createElement('div');
  actions.className = 'workspace-actions';
  actions.setAttribute('role', 'toolbar');
  actions.setAttribute('aria-label', 'เครื่องมือผู้ใช้งาน');

  const clock = document.createElement('time');
  clock.className = 'workspace-clock';
  clock.innerHTML = '<span id="workspace-date"></span><strong id="workspace-time"></strong>';

  const accountStatus = document.createElement('span');
  accountStatus.className = 'sr-only';
  accountStatus.id = 'workspace-account-status';
  accountStatus.setAttribute('aria-live', 'polite');
  accountStatus.textContent = 'กำลังตรวจสอบบัญชี';

  const logoutButton = document.createElement('button');
  logoutButton.className = 'workspace-logout';
  logoutButton.type = 'button';
  logoutButton.setAttribute('aria-label', 'ออกจากระบบ');
  logoutButton.title = 'ออกจากระบบ';
  logoutButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" /></svg>';

  actions.append(clock, themeControl, accountStatus, logoutButton);
  utilityBar.append(pageContext, searchForm, actions);
  workspace.before(utilityBar);

  const searchInput = searchForm.querySelector('#workspace-quick-search');
  const searchOptions = searchForm.querySelector('#workspace-search-options');

  function updateSearchRoutes(user) {
    searchRoutes = baseSearchRoutes.filter((route) => (!route.adminOnly || user?.role === 'Admin') && (!route.sparePartsOnly || sparePartsEnabled));
    searchOptions.innerHTML = searchRoutes.map((route) => `<option value="${route.label}"></option>`).join('');
  }

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = searchInput.value.trim().toLocaleLowerCase('th-TH');
    const route = searchRoutes.find((item) => item.label.toLocaleLowerCase('th-TH') === query || item.terms.some((term) => term.includes(query) || query.includes(term)));
    if (!query || !route) {
      searchInput.setCustomValidity('ไม่พบเมนูที่ค้นหา');
      searchInput.reportValidity();
      return;
    }
    window.location.href = route.href;
  });
  searchInput.addEventListener('input', () => searchInput.setCustomValidity(''));

  function renderWorkspaceAccount(user) {
    if (!user) return;
    accountStatus.textContent = `บัญชีที่ใช้งาน ${user.username || 'ผู้ใช้งาน'} สิทธิ์ ${user.role || 'ไม่ระบุ'}`;
    updateSearchRoutes(user);
  }

  updateSearchRoutes(authenticatedUser);
  renderWorkspaceAccount(authenticatedUser);
  window.RD_AUTH_READY?.then(renderWorkspaceAccount).catch(() => {});

  const dateFormatter = new Intl.DateTimeFormat('th-TH', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const timeFormatter = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
  let lastMinute = '';

  function updateWorkspaceClock() {
    const now = new Date();
    const timeText = timeFormatter.format(now);
    if (timeText !== lastMinute) {
      const dateText = dateFormatter.format(now);
      clock.dateTime = now.toISOString();
      clock.querySelector('#workspace-date').textContent = dateText;
      clock.querySelector('#workspace-time').textContent = timeText;
      clock.setAttribute('aria-label', `${dateText} เวลา ${timeText} น.`);
      lastMinute = timeText;
    }
  }

  updateWorkspaceClock();
  window.setInterval(updateWorkspaceClock, 1000);
  logoutButton.addEventListener('click', () => window.RDSiteAuth?.logout());
}
