/** Shared admin shell: navigation, user chrome, logout. */

import { config, applyBrandLogos } from '../config.js';
import { getUser, clearSession, isSuperAdmin } from '../auth/session.js';

export const ADMIN_NAV = [
  { href: 'dashboard.html', label: 'Dashboard' },
  { href: 'bookings.html', label: 'Bookings' },
  { href: 'booking-create.html', label: 'Create Booking' },
  { href: 'camps.html', label: 'Camps', superAdmin: true },
  { href: 'blocks.html', label: 'Blocks', superAdmin: true },
  { href: 'rooms.html', label: 'Rooms' },
  { href: 'rates.html', label: 'Rates', superAdmin: true },
  { href: 'invoices.html', label: 'Invoices' },
  { href: 'reports.html', label: 'Reports', superAdmin: true },
  { href: 'users.html', label: 'Users', superAdmin: true },
  { href: 'settings.html', label: 'Settings', superAdmin: true },
];

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
      return `<a href="${item.href}"${attrs}${superAttr}>${item.label}</a>`;
    })
    .join('');
}

export function initAdminShell() {
  const user = getUser();
  const nameEl = document.querySelector('[data-admin-name]');
  const roleEl = document.querySelector('[data-admin-role]');
  const toggle = document.querySelector('[data-admin-menu-toggle]');
  const sidebar = document.querySelector('[data-admin-sidebar]');

  renderAdminNav(user);

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

  toggle?.addEventListener('click', () => {
    sidebar?.classList.toggle('is-open');
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
    <link rel="stylesheet" href="../css/components.css">
    <link rel="stylesheet" href="../css/layout.css">
  `;
}
