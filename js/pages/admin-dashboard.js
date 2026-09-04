import { getDashboardStats } from '../api/dashboard.js';
import { ApiError } from '../api/client.js';
import { requireAuth } from '../auth/session.js';
import { initAdminShell } from '../components/shell.js';
import { showToast } from '../components/toast.js';
import {
  escapeHtml,
  formatDate,
  fullName,
  campLabel,
  statusBadge,
} from '../utils/format.js';

const user = requireAuth();
let dashboardRequestActive = false;
if (!user) {
  /* redirect in progress */
} else {
  initAdminShell();
  loadDashboard();
  window.setInterval(() => {
    if (!document.hidden) loadDashboard({ showLoading: false });
  }, 15000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadDashboard({ showLoading: false });
  });
}

async function loadDashboard() {
  if (dashboardRequestActive) return;
  dashboardRequestActive = true;
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
      const el = document.querySelector(`[data-stat="${key}"]`);
      if (el) el.textContent = String(value);
    });
    const dashboardName = document.querySelector('[data-dashboard-name]');
    const currentUserName = document.querySelector('[data-admin-name]')?.textContent;
    if (dashboardName && currentUserName && currentUserName !== '—') dashboardName.textContent = currentUserName.split(' ')[0];
    const updated = document.querySelector('[data-dashboard-updated]');
    if (updated) updated.textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date());

    renderCampStats(data.bookingsByCamp || []);
    renderRoomStatuses(data.roomStatuses || []);
    renderRecentBookings(data.recentBookings || []);
  } catch (error) {
    showDashboardError();
    showToast(
      error instanceof ApiError ? error.message : 'Unable to load dashboard.',
      'error',
    );
  } finally {
    dashboardRequestActive = false;
  }
}

function showDashboardError() {
  const messages = [
    ['room-status-body', 4],
    ['camp-stats-body', 2],
    ['recent-bookings-body', 6],
  ];
  messages.forEach(([id, columns]) => {
    const tbody = document.getElementById(id);
    if (tbody && tbody.querySelector('.empty-state')) {
      tbody.innerHTML = `<tr><td colspan="${columns}" class="empty-state">Dashboard data is temporarily unavailable. Refresh to try again.</td></tr>`;
    }
  });
}

function renderRoomStatuses(rooms) {
  const tbody = document.getElementById('room-status-body');
  if (!tbody) return;
  if (!rooms.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No rooms available.</td></tr>';
    return;
  }
  tbody.innerHTML = rooms.map((room) => `
    <tr>
      <td>${escapeHtml(room.campName)}</td>
      <td>${escapeHtml(room.blockName)}</td>
      <td>${escapeHtml(room.roomNumber)}</td>
      <td>${statusBadge(room.status)}</td>
    </tr>
  `).join('');
}

function renderCampStats(rows) {
  const tbody = document.getElementById('camp-stats-body');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="2" class="empty-state">No camp data available.</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.campName || row.camp || row.name || '—')}</td>
        <td>${escapeHtml(String(row.count ?? row.totalActive ?? 0))}</td>
      </tr>
    `)
    .join('');
}

function renderRecentBookings(bookings) {
  const tbody = document.getElementById('recent-bookings-body');
  if (!bookings.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No recent bookings.</td></tr>';
    return;
  }

  tbody.innerHTML = bookings
    .map((booking) => {
      const id = booking._id || booking.id;
      const camp = booking.campName || campLabel(booking.camp);
      return `
        <tr>
          <td><a href="booking-edit.html?id=${escapeHtml(id)}"><strong>${escapeHtml(booking.bookingReference || '—')}</strong></a></td>
          <td>${escapeHtml(fullName(booking.guest || booking))}</td>
          <td>${escapeHtml(camp)}</td>
          <td>${escapeHtml(formatDate(booking.arrivalDate))}</td>
          <td>${escapeHtml(formatDate(booking.departureDate))}</td>
          <td>${statusBadge(booking.status)}</td>
        </tr>
      `;
    })
    .join('');
}
