import { isAuthenticated, getUser, clearSession, isSuperAdmin } from '../auth/session.js';
import { config, applyBrandLogos } from '../config.js';
import { initModals } from '../components/modal.js';
import { showToast } from '../components/toast.js';

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
  { hash: '#/dashboard', label: 'Dashboard', route: 'dashboard' },
  { hash: '#/bookings', label: 'Bookings', route: 'bookings' },
  { hash: '#/booking/create', label: 'Create Booking', route: 'booking/create' },
  { hash: '#/camps', label: 'Camps', route: 'camps', superAdmin: true },
  { hash: '#/blocks', label: 'Blocks', route: 'blocks', superAdmin: true },
  { hash: '#/rooms', label: 'Rooms', route: 'rooms' },
  { hash: '#/rates', label: 'Rates', route: 'rates', superAdmin: true },
  { hash: '#/invoices', label: 'Invoices', route: 'invoices' },
  { hash: '#/reports', label: 'Reports', route: 'reports', superAdmin: true },
  { hash: '#/reservation-log', label: 'Reservation Log', route: 'reservation-log', superAdmin: true },
  { hash: '#/users', label: 'Users', route: 'users', superAdmin: true },
  { hash: '#/settings', label: 'Settings', route: 'settings', superAdmin: true },
];

const loadedRoutes = new Set();
let currentRoute = null;

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '').replace(/^\//, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const params = new URLSearchParams(queryPart);
  const route = pathPart || 'login';
  return { route, params, queryString: queryPart ? `?${queryPart}` : '' };
}

export function navigate(hash) {
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
      return `<a href="${item.hash}"${activeAttr}${superAttr} data-nav-link>${item.label}</a>`;
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
      document.title = `${PAGE_TITLES[route] || route} · ${config.APP_NAME}`;
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
  const logoutBtn = document.querySelector('[data-logout]');
  const adminUser = document.querySelector('.admin-user');

  buildNav(user);

  if (nameEl && user) {
    nameEl.textContent = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  }
  if (roleEl && user) {
    roleEl.textContent = user.role || '';
  }

  document.querySelectorAll('[data-super-admin-only]').forEach((el) => {
    if (!isSuperAdmin(user)) el.hidden = true;
  });

  toggle?.addEventListener('click', () => {
    sidebar?.classList.toggle('is-open');
  });

  logoutBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    clearSession();
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
    login: './spa-pages/spa-login.js',
    dashboard: './spa-pages/spa-dashboard.js',
    bookings: './spa-pages/spa-bookings.js',
    'booking/create': './spa-pages/spa-booking-create.js',
    'booking/edit': './spa-pages/spa-booking-edit.js',
    invoices: './spa-pages/spa-invoices.js',
    camps: './spa-pages/spa-camps.js',
    blocks: './spa-pages/spa-blocks.js',
    rooms: './spa-pages/spa-rooms.js',
    rates: './spa-pages/spa-rates.js',
    reports: './spa-pages/spa-reports.js',
    'reservation-log': './spa-pages/spa-reports.js',
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

  if (route === 'login') {
    if (authed) {
      navigate('#/dashboard');
      return;
    }
    showPage('login');
    await loadPageModule('login');
    currentRoute = 'login';
    return;
  }

  if (!authed) {
    const redirect = encodeURIComponent(window.location.hash || '#/dashboard');
    window.location.hash = '#/login?redirect=' + redirect;
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
window.addEventListener('DOMContentLoaded', () => {
  if (!window.location.hash) {
    window.location.hash = isAuthenticated() ? '#/dashboard' : '#/login';
  } else {
    handleRoute();
  }
});

export { navigate as default };
