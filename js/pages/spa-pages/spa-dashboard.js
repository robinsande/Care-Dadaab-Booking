import { navigate } from '../spa-main.js';
import { getDashboardStats } from '../../api/dashboard.js';
import { ApiError } from '../../api/client.js';
import { showToast } from '../../components/toast.js';
import { escapeHtml, formatDate, fullName, campLabel, statusBadge } from '../../utils/format.js';

let initialized = false;
let refreshTimer;
let dashboardRequestActive = false;
let syncButton;

export async function init() {
  if (initialized) return;
  initialized = true;
  syncButton = document.querySelector('[data-dashboard-sync]');
  syncButton?.addEventListener('click', () => loadDashboard({ manual: true }));
  await loadDashboard();
  refreshTimer = window.setInterval(() => {
    if (!document.hidden) loadDashboard({ showLoading: false });
  }, 15000);
  document.addEventListener('visibilitychange', onVisibilityChange);
}

export async function refresh() {
  await loadDashboard();
}

function onVisibilityChange() {
  if (!document.hidden) loadDashboard({ showLoading: false });
}

async function loadDashboard({ manual = false } = {}) {
  if (dashboardRequestActive) return;
  dashboardRequestActive = true;
  syncButton?.classList.add('is-syncing');
  if (manual) syncButton?.setAttribute('aria-busy', 'true');
  try {
    const response = await getDashboardStats();
    const data = response.data || {};

    const mapping = {
      todayArrivals: data.todaysArrivals ?? 0,
      todayDepartures: data.todaysDepartures ?? 0,
      occupiedRooms: data.occupiedRooms ?? 0,
      availableRooms: data.availableRooms ?? 0,
      outstandingInvoices: data.outstandingInvoices ?? 0,
    };

    Object.entries(mapping).forEach(([key, value]) => {
      document.querySelectorAll(`[data-stat="${key}"]`).forEach((el) => {
        el.textContent = String(value);
      });
    });
    const dashboardName = document.querySelector('[data-dashboard-name]');
    const currentUserName = document.querySelector('[data-admin-name]')?.textContent;
    if (dashboardName && currentUserName && currentUserName !== '—') dashboardName.textContent = currentUserName.split(' ')[0];
    const updated = document.querySelector('[data-dashboard-updated]');
    if (updated) updated.textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date());

    renderCampStats(data.bookingsByCamp || []);
    renderRoomStatuses(data.roomStatuses || []);
    renderRecentBookings(data.recentBookings || []);
    renderPendingGuestRequests(data.pendingGuestRequests || []);
  } catch (error) {
    showDashboardError();
    if (manual) showToast(error instanceof ApiError ? error.message : 'Unable to sync dashboard.', 'error');
  } finally {
    dashboardRequestActive = false;
    syncButton?.classList.remove('is-syncing');
    syncButton?.removeAttribute('aria-busy');
  }
}

function showDashboardError() {
  [
    ['room-status-body', 4],
    ['camp-stats-body', 2],
    ['recent-bookings-body', 6],
    ['pending-guest-requests-body', 5],
  ].forEach(([id, columns]) => {
    const tbody = document.getElementById(id);
    if (tbody && (tbody.querySelector('.empty-state') || tbody.querySelector('.skeleton'))) {
      tbody.innerHTML = `<tr><td colspan="${columns}" class="empty-state">Dashboard data is temporarily unavailable. Refresh to try again.</td></tr>`;
    }
  });
}

function renderPendingGuestRequests(requests) {
  const tbody = document.getElementById('pending-guest-requests-body');
  if (!tbody) return;
  if (!requests.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No pending guest booking requests.</td></tr>';
    return;
  }
  tbody.innerHTML = requests.map((request) => `
    <tr>
      <td data-label="Guest">${escapeHtml(fullName(request.guest || {}))}</td>
      <td data-label="Camp">${escapeHtml(request.camp?.name || '—')}</td>
      <td data-label="Arrival">${escapeHtml(formatDate(request.arrivalDate))}</td>
      <td data-label="Departure">${escapeHtml(formatDate(request.departureDate))}</td>
      <td data-label="Stay Type">${escapeHtml(request.stayType || '—')}</td>
    </tr>
  `).join('');
}

function renderRoomStatuses(rooms) {
  const tbody = document.getElementById('room-status-body');
  if (!tbody) return;
  if (!rooms.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No rooms available.</td></tr>';
    return;
  }
  tbody.innerHTML = rooms.map(room => `
    <tr>
      <td data-label="Camp">${escapeHtml(room.campName)}</td>
      <td data-label="Block">${escapeHtml(room.blockName)}</td>
      <td data-label="Room">${escapeHtml(room.roomNumber)}</td>
      <td data-label="Status">${statusBadge(room.status)}</td>
    </tr>
  `).join('');
}

function renderCampStats(rows) {
  const tbody = document.getElementById('camp-stats-body');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="2" class="empty-state">No camp data available.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(row => `
    <tr>
      <td data-label="Camp">${escapeHtml(row.campName || row.camp || row.name || '—')}</td>
      <td data-label="Active bookings">${escapeHtml(String(row.count ?? row.totalActive ?? 0))}</td>
    </tr>
  `).join('');
}

function renderRecentBookings(bookings) {
  const tbody = document.getElementById('recent-bookings-body');
  if (!tbody) return;
  if (!bookings.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No recent bookings.</td></tr>';
    return;
  }
  tbody.innerHTML = bookings.map(booking => {
    const id = booking._id || booking.id;
    const camp = booking.campName || campLabel(booking.camp);
    return `
      <tr>
          <td data-label="Reference"><a data-nav-link href="#/booking/edit?id=${escapeHtml(id)}"><strong>${escapeHtml(booking.bookingReference || '—')}</strong></a></td>
          <td data-label="Guest">${escapeHtml(fullName(booking.guest || booking))}</td>
          <td data-label="Camp">${escapeHtml(camp)}</td>
          <td data-label="Arrival">${escapeHtml(formatDate(booking.arrivalDate))}</td>
          <td data-label="Departure">${escapeHtml(formatDate(booking.departureDate))}</td>
          <td data-label="Status">${statusBadge(booking.status)}</td>
      </tr>
    `;
  }).join('');
}
