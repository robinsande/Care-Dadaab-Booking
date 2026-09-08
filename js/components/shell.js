/** Shared admin shell: navigation, user chrome, logout. */

import { config, applyBrandLogos } from '../config.js';
import { getUser, clearSession, isSuperAdmin } from '../auth/session.js';

export const ADMIN_NAV = [
  { href: 'dashboard.html', label: 'Dashboard', icon: 'home' },
  { href: 'bookings.html', label: 'Bookings', icon: 'calendar' },
  { href: 'booking-create.html', label: 'Create Booking', icon: 'calendar-plus' },
  { href: 'camps.html', label: 'Camps', icon: 'map', superAdmin: true },
  { href: 'blocks.html', label: 'Blocks', icon: 'layout-grid', superAdmin: true },
  { href: 'rooms.html', label: 'Rooms', icon: 'bed-double' },
  { href: 'rates.html', label: 'Rates', icon: 'badge-dollar-sign', superAdmin: true },
  { href: 'invoices.html', label: 'Invoices', icon: 'receipt' },
  { href: 'reports.html', label: 'Reports', icon: 'chart-no-axes-combined', superAdmin: true },
  { href: 'reservation-log.html', label: 'Reservation Log', icon: 'history', superAdmin: true },
  { href: 'users.html', label: 'Users', icon: 'users', superAdmin: true },
  { href: 'settings.html', label: 'Settings', icon: 'settings', superAdmin: true },
];

export const NAV_ICONS = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  'calendar-plus': '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>',
  'layout-grid': '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/>',
  'bed-double': '<path d="M2 4v16M2 14h20M22 20V8a2 2 0 0 0-2-2H6a4 4 0 0 0-4 4"/><path d="M6 10h4a2 2 0 0 1 2 2v2H6z"/>',
  'badge-dollar-sign': '<path d="M3.85 8.62a4 4 0 0 1 4.27-4.27 4 4 0 0 1 5.76-1.6 4 4 0 0 1 5.76 1.6 4 4 0 0 1 4.27 4.27 4 4 0 0 1-1.6 5.76 4 4 0 0 1-1.6 5.76 4 4 0 0 1-4.27 4.27 4 4 0 0 1-5.76-1.6 4 4 0 0 1-5.76-1.6 4 4 0 0 1-4.27-4.27 4 4 0 0 1 1.6-5.76Z"/><path d="M16 8h-3.5a1.5 1.5 0 0 0 0 3h3a1.5 1.5 0 0 1 0 3H12m2-8v1m0 7v1"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  'chart-no-axes-combined': '<path d="M3 3v18h18"/><path d="m7 16 4-5 3 3 5-7"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19.4 15 .1.1a2 2 0 1 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4V19a2 2 0 1 1-4 0v-.2a2 2 0 0 0-3.4-1.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 3.6 11H3a2 2 0 1 1 0-4h.2a2 2 0 0 0 1.4-3.4l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A2 2 0 0 0 11 2.4V2a2 2 0 1 1 4 0v.2a2 2 0 0 0 3.4 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A2 2 0 0 0 20.4 10h.2a2 2 0 1 1 0 4h-.2a2 2 0 0 0-1 1Z"/>',
};

export function renderAdminNav(user = getUser()) {
  const nav = document.querySelector('[data-admin-nav]');
  if (!nav) return;

  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';

  nav.innerHTML = ADMIN_NAV
    .filter((item) => !item.superAdmin || isSuperAdmin(user))
    .map((item) => {
      const isActive =
        currentPage === item.href
        || (item.href === 'bookings.html' && currentPage === 'booking-edit.html');
      const attrs = isActive ? ' aria-current="page"' : '';
      const superAttr = item.superAdmin ? ' data-super-admin-only' : '';
      const icon = NAV_ICONS[item.icon] || '';
      return `<a class="admin-nav-link nav-color-${item.icon}" href="${item.href}"${attrs}${superAttr}><span class="admin-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="presentation">${icon}</svg></span><span>${item.label}</span></a>`;
    })
    .join('');
}

export function initAdminShell() {
  const user = getUser();
  const nameEl = document.querySelector('[data-admin-name]');
  const roleEl = document.querySelector('[data-admin-role]');
  const toggle = document.querySelector('[data-admin-menu-toggle]');
  const sidebar = document.querySelector('[data-admin-sidebar]');
  const shell = document.querySelector('.admin-shell');
  const collapseToggle = document.querySelector('[data-admin-collapse-toggle]');

  renderAdminNav(user);

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
      document.querySelector('[data-admin-menu-toggle]')?.setAttribute('aria-expanded', String(isOpen));
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
    if (!isSuperAdmin(user)) {
      el.hidden = true;
    }
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

  document.querySelector('[data-logout]')?.addEventListener('click', (event) => {
    event.preventDefault();
    clearSession();
    window.location.href = '/admin/login.html';
  });

  const adminUser = document.querySelector('.admin-user');
  const logoutBtn = document.querySelector('[data-logout]');
  if (adminUser && logoutBtn && !document.querySelector('[data-change-password]')) {
    const link = document.createElement('a');
    link.href = 'change-password.html';
    link.className = 'btn btn-ghost btn-sm';
    link.setAttribute('data-change-password', '');
    link.textContent = 'Password';
    adminUser.insertBefore(link, logoutBtn);
  }

  const brandText = document.querySelector('[data-brand-subtitle]');
  if (brandText) {
    brandText.textContent = config.APP_NAME;
  }

  applyBrandLogos();
}

export function adminPageHead(title) {
  return `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} · ${config.APP_NAME}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@500;650;700;750&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../css/variables.css">
    <link rel="stylesheet" href="../css/base.css">
    <link rel="stylesheet" href="../css/components.css?v=20260907-13">
    <link rel="stylesheet" href="../css/layout.css?v=20260907-13">
  `;
}
