import { isAuthenticated, getUser, clearSession, isSuperAdmin } from '../auth/session.js';
import { config, applyBrandLogos } from '../config.js';
import { initModals } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { NAV_ICONS } from '../components/shell.js';

const PAGE_TITLES = {
  login: 'Staff Login',
  dashboard: 'Dashboard',
  bookings: 'Bookings',
  'booking/create': 'Create Booking',
  'booking/edit': 'Booking Details',
  invoices: 'Invoices',
  camps: 'Camps',
  blocks: 'Blocks',
  rooms: 'Rooms',
  rates: 'Rates',
  reports: 'Reports',
  'reservation-log': 'Reservation Log',
  users: 'Users',
  settings: 'Settings',
  'change-password': 'Change Password',
};

const SUPER_ADMIN_ROUTES = ['camps', 'blocks', 'rates', 'reports', 'reservation-log', 'users', 'settings'];

const SPA_NAV = [
  { href: '/', label: 'Dashboard', route: 'dashboard', icon: 'home' },
  { hash: '#/bookings', label: 'Bookings', route: 'bookings', icon: 'calendar' },
  { hash: '#/booking/create', label: 'Create Booking', route: 'booking/create', icon: 'calendar-plus' },
  { hash: '#/camps', label: 'Camps', route: 'camps', icon: 'map', superAdmin: true },
  { hash: '#/blocks', label: 'Blocks', route: 'blocks', icon: 'layout-grid', superAdmin: true },
  { hash: '#/rooms', label: 'Rooms', route: 'rooms', icon: 'bed-double' },
  { hash: '#/rates', label: 'Rates', route: 'rates', icon: 'badge-dollar-sign', superAdmin: true },
  { hash: '#/invoices', label: 'Invoices', route: 'invoices', icon: 'receipt' },
  { hash: '#/reports', label: 'Reports', route: 'reports', icon: 'chart-no-axes-combined', superAdmin: true },
  { href: 'admin/reservation-log.html', label: 'Reservation Log', route: 'reservation-log', icon: 'history', superAdmin: true },
  { hash: '#/users', label: 'Users', route: 'users', icon: 'users', superAdmin: true },
  { hash: '#/settings', label: 'Settings', route: 'settings', icon: 'settings', superAdmin: true },
];

const loadedRoutes = new Set();
let currentRoute = null;

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '').replace(/^\//, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const params = new URLSearchParams(queryPart);
  const route = pathPart || (isAuthenticated() ? 'dashboard' : 'login');
  return { route, params, queryString: queryPart ? `?${queryPart}` : '' };
}

export function navigate(hash) {
  if (hash === '#/dashboard') {
    window.history.pushState({}, '', '/');
    handleRoute();
    return;
  }
  if (window.location.hash === hash) {
    handleRoute();
  } else {
    window.location.hash = hash;
  }
}

export function getCurrentParams() {
  return parseHash().params;
}

function buildNav(user) {
  const nav = document.querySelector('[data-admin-nav]');
  if (!nav) return;
  const { route } = parseHash();
  const isSA = isSuperAdmin(user);

  nav.innerHTML = SPA_NAV
    .filter((item) => !item.superAdmin || isSA)
    .map((item) => {
      const isActive =
        item.route === route ||
        (item.route === 'bookings' && route === 'booking/edit');
      const activeAttr = isActive ? ' aria-current="page"' : '';
      const superAttr = item.superAdmin ? ' data-super-admin-only' : '';
      const href = item.href || item.hash;
      const navAttr = item.hash ? ' data-nav-link' : '';
      const icon = NAV_ICONS[item.icon] || '';
      return `<a class="admin-nav-link nav-color-${item.icon}" href="${href}"${activeAttr}${superAttr}${navAttr}><span class="admin-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="presentation">${icon}</svg></span><span>${item.label}</span></a>`;
    })
    .join('');
}

function showPage(route) {
  document.querySelectorAll('.page-container').forEach((el) => {
    el.hidden = true;
  });

  const loginPage = document.getElementById('page-login');
  const adminApp = document.getElementById('admin-app');

  if (route === 'login') {
    loginPage.hidden = false;
    adminApp.hidden = true;
    document.body.classList.add('login-page');
    document.body.classList.remove('admin-body');
  } else {
    loginPage.hidden = true;
    adminApp.hidden = false;
    document.body.classList.remove('login-page');
    document.body.classList.add('admin-body');

    const target = document.querySelector(`[data-route="${route}"]`);
    if (target) {
      target.hidden = false;
      const titleEl = document.getElementById('page-title');
      if (titleEl) {
        titleEl.textContent = PAGE_TITLES[route] || route;
      }
      document.title = config.APP_NAME;
    }
  }
}

function initAdminChromeOnce() {
  if (initAdminChromeOnce.done) return;
  initAdminChromeOnce.done = true;

  const user = getUser();
  const nameEl = document.querySelector('[data-admin-name]');
  const roleEl = document.querySelector('[data-admin-role]');
  const toggle = document.querySelector('[data-admin-menu-toggle]');
  const sidebar = document.querySelector('[data-admin-sidebar]');
  const shell = document.querySelector('.admin-shell');
  const collapseToggle = document.querySelector('[data-admin-collapse-toggle]');
  const logoutBtn = document.querySelector('[data-logout]');
  const adminUser = document.querySelector('.admin-user');

  buildNav(user);

  const collapsed = window.localStorage.getItem('cams.sidebarCollapsed') === 'true';
  shell?.classList.toggle('sidebar-collapsed', collapsed);
  const mobileNavOpen = window.localStorage.getItem('cams.sidebarOpen') === 'true';
  if (window.innerWidth < 960 && mobileNavOpen) {
    sidebar?.classList.add('is-open');
  }
  collapseToggle?.setAttribute('aria-expanded', String(!collapsed));
  collapseToggle?.setAttribute('aria-label', collapsed ? 'Show navigation' : 'Hide navigation');
  if (collapseToggle) collapseToggle.querySelector('span:last-child').textContent = collapsed ? 'Show navigation' : 'Hide navigation';
  collapseToggle?.addEventListener('click', () => {
    if (window.innerWidth < 960) {
      const isOpen = sidebar?.classList.toggle('is-open') || false;
      window.localStorage.setItem('cams.sidebarOpen', String(isOpen));
      toggle?.setAttribute('aria-expanded', String(isOpen));
      return;
    }
    const isCollapsed = shell?.classList.toggle('sidebar-collapsed') || false;
    window.localStorage.setItem('cams.sidebarCollapsed', String(isCollapsed));
    collapseToggle.setAttribute('aria-expanded', String(!isCollapsed));
    collapseToggle.setAttribute('aria-label', isCollapsed ? 'Show navigation' : 'Hide navigation');
    collapseToggle.querySelector('span:last-child').textContent = isCollapsed ? 'Show navigation' : 'Hide navigation';
  });

  if (nameEl && user) {
    nameEl.textContent = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  }
  if (roleEl && user) {
    roleEl.textContent = user.role || '';
  }

  document.querySelectorAll('[data-super-admin-only]').forEach((el) => {
    if (!isSuperAdmin(user)) el.hidden = true;
  });

  toggle?.setAttribute('aria-expanded', 'false');
  if (window.innerWidth < 960 && sidebar?.classList.contains('is-open')) {
    toggle.setAttribute('aria-expanded', 'true');
  }
  toggle?.addEventListener('click', () => {
    const isOpen = sidebar?.classList.toggle('is-open') || false;
    window.localStorage.setItem('cams.sidebarOpen', String(isOpen));
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  document.addEventListener('click', (event) => {
    if (window.innerWidth >= 960 || !sidebar?.classList.contains('is-open')) return;
    if (sidebar.contains(event.target) || toggle?.contains(event.target)) return;
    sidebar.classList.remove('is-open');
    window.localStorage.setItem('cams.sidebarOpen', 'false');
    toggle?.setAttribute('aria-expanded', 'false');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || window.innerWidth >= 960) return;
    sidebar?.classList.remove('is-open');
    window.localStorage.setItem('cams.sidebarOpen', 'false');
    toggle?.setAttribute('aria-expanded', 'false');
  });

  logoutBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    clearSession();
    import('./spa-pages/spa-login.js?v=20260907-4')
      .then((module) => module.reset?.())
      .catch((error) => console.error('[SPA] Failed to reset login view:', error));
    navigate('#/login');
  });

  if (adminUser && logoutBtn) {
    const existingPwd = adminUser.querySelector('[data-change-password]');
    if (!existingPwd) {
      const link = document.createElement('a');
      link.href = '#/change-password';
      link.className = 'btn btn-ghost btn-sm';
      link.setAttribute('data-change-password', '');
      link.setAttribute('data-nav-link', '');
      link.textContent = 'Password';
      adminUser.insertBefore(link, logoutBtn);
    }
  }

  const brandText = document.querySelector('[data-brand-subtitle]');
  if (brandText) brandText.textContent = config.APP_NAME;

  applyBrandLogos();

  initModals();

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-nav-link]');
    if (link) {
      e.preventDefault();
      const hash = link.getAttribute('href');
      if (hash && hash.startsWith('#')) navigate(hash);
    }
  });
}

async function loadPageModule(route) {
  const moduleMap = {
    login: './spa-pages/spa-login.js?v=20260907-4',
    dashboard: './spa-pages/spa-dashboard.js?v=20260904-3',
    bookings: './spa-pages/spa-bookings.js',
    'booking/create': './spa-pages/spa-booking-create.js',
    'booking/edit': './spa-pages/spa-booking-edit.js',
    invoices: './spa-pages/spa-invoices.js',
    camps: './spa-pages/spa-camps.js',
    blocks: './spa-pages/spa-blocks.js',
    rooms: './spa-pages/spa-rooms.js',
    rates: './spa-pages/spa-rates.js',
    reports: './spa-pages/spa-reports.js',
    users: './spa-pages/spa-users.js',
    settings: './spa-pages/spa-settings.js',
    'change-password': './spa-pages/spa-change-password.js',
  };

  const modulePath = moduleMap[route];
  if (!modulePath) return;

  if (loadedRoutes.has(route)) {
    const mod = await import(modulePath);
    if (typeof mod.refresh === 'function') {
      try { await mod.refresh(); } catch (e) { /* ignore */ }
    }
    return;
  }

  try {
    const mod = await import(modulePath);
    loadedRoutes.add(route);
    if (typeof mod.init === 'function') {
      await mod.init();
    }
  } catch (err) {
    console.error(`[SPA] Failed to load module for route "${route}":`, err);
  }
}

async function handleRoute() {
  const { route, params } = parseHash();
  const authed = isAuthenticated();
  const isSA = isSuperAdmin();

  if (route === 'reservation-log') {
    window.location.href = 'admin/reservation-log.html';
    return;
  }

  if (route === 'login') {
    if (authed) {
      navigate('#/dashboard');
      return;
    }
    const legacyRedirect = params.get('redirect');
    if (legacyRedirect) {
      window.sessionStorage.setItem('cams.loginRedirect', legacyRedirect);
    }
    if (window.location.hash) {
      window.history.replaceState({}, '', '/');
    }
    showPage('login');
    await loadPageModule('login');
    currentRoute = 'login';
    return;
  }

  if (!authed) {
    window.sessionStorage.setItem('cams.loginRedirect', window.location.hash || '#/dashboard');
    window.history.replaceState({}, '', '/');
    showPage('login');
    await loadPageModule('login');
    currentRoute = 'login';
    return;
  }

  if (SUPER_ADMIN_ROUTES.includes(route) && !isSA) {
    showToast('Access denied. Super Admin only.', 'error');
    navigate('#/dashboard');
    return;
  }

  initAdminChromeOnce();
  buildNav(getUser());
  showPage(route);
  await loadPageModule(route);
  currentRoute = route;
}

window.addEventListener('hashchange', handleRoute);
window.addEventListener('popstate', handleRoute);
window.addEventListener('DOMContentLoaded', () => {
  handleRoute();
});

export { navigate as default };
