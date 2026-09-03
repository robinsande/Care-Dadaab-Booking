import { getDashboardStats } from '../api/dashboard.js';
import { ApiError } from '../api/client.js';
import { requireAuth } from '../auth/session.js';
import { initAdminShell } from '../components/shell.js';
import { withLoading } from '../components/loading.js';
import { showToast } from '../components/toast.js';
import {
  escapeHtml,
  formatDate,
  fullName,
  campLabel,
  statusBadge,
} from '../utils/format.js';

const user = requireAuth();
if (!user) {
  /* redirect in progress */
} else {
  initAdminShell();
  loadDashboard();
}

async function loadDashboard() {
  try {
    const response = await withLoading(() => getDashboardStats(), 'Loading dashboard…');
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

    renderCampStats(data.bookingsByCamp || []);
    renderRecentBookings(data.recentBookings || []);
  } catch (error) {
    showToast(
      error instanceof ApiError ? error.message : 'Unable to load dashboard.',
      'error',
    );
  }
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
