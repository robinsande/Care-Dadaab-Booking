import {
  listBookings,
  deleteBooking,
  checkInBooking,
  checkOutBooking,
  resendBookingEmails,
} from '../api/bookings.js';
import { listCamps } from '../api/camps.js';
import { ApiError } from '../api/client.js';
import { requireAuth } from '../auth/session.js';
import { initAdminShell } from '../components/shell.js';
import { withLoading } from '../components/loading.js';
import { setButtonLoading } from '../components/loading.js';
import { showToast } from '../components/toast.js';
import { confirmDialog } from '../components/modal.js';
import { renderPagination } from '../components/pagination.js';
import { constants, fillSelect } from '../utils/constants.js';
import { isSuperAdmin } from '../auth/session.js';
import {
  escapeHtml,
  formatDate,
  fullName,
  campLabel,
  roomLabel,
  statusBadge,
} from '../utils/format.js';

const state = {
  page: 1,
  limit: 10,
  search: '',
  status: '',
  campId: '',
  sort: 'createdAt:desc',
  bookings: [],
  total: 0,
  totalPages: 1,
};

const filtersForm = document.getElementById('bookings-filters');
const tableBody = document.getElementById('bookings-table-body');
const paginationEl = document.getElementById('bookings-pagination');

function boot() {
  fillSelect(document.getElementById('status'), constants.BOOKING_STATUSES, {
    placeholder: 'All statuses',
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get('status')) {
    document.getElementById('status').value = params.get('status');
    state.status = params.get('status');
  }

  filtersForm.addEventListener('submit', (event) => {
    event.preventDefault();
    state.search = filtersForm.elements.search.value.trim();
    state.status = filtersForm.elements.status.value;
    state.campId = filtersForm.elements.campId?.value || '';
    state.sort = filtersForm.elements.sort.value;
    state.page = 1;
    loadBookings();
  });

  tableBody.addEventListener('click', onTableAction);
  tableBody.addEventListener('change', onTableAction);
  loadCampsForFilter();
  loadBookings();
}

async function loadCampsForFilter() {
  try {
    const response = await listCamps();
    const camps = response.data?.camps || response.data?.items || response.data || [];
    fillSelect(
      document.getElementById('campId'),
      (Array.isArray(camps) ? camps : []).map((c) => ({
        value: c._id || c.id,
        label: c.name || c.campName,
      })),
      { placeholder: 'All camps' },
    );
  } catch {
    /* optional filter */
  }
}

async function loadBookings() {
  try {
    const [sortBy, sortOrder] = state.sort.split(':');
    const response = await withLoading(
      () =>
        listBookings({
          page: state.page,
          limit: state.limit,
          search: state.search,
          status: state.status,
          campId: state.campId,
          sortBy,
          sortOrder,
        }),
      'Loading bookings…',
    );

    const data = response.data || {};
    state.bookings = data.bookings || data.items || data || [];
    if (!Array.isArray(state.bookings)) state.bookings = [];

    state.total = data.total ?? state.bookings.length;
    state.totalPages = data.totalPages ?? Math.max(1, Math.ceil(state.total / state.limit));
    state.page = data.page ?? state.page;

    renderTable();
    renderPagination(
      paginationEl,
      {
        page: state.page,
        totalPages: state.totalPages,
        total: state.total,
        limit: state.limit,
      },
      (page) => {
        state.page = page;
        loadBookings();
      },
    );
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="9" class="empty-state">Unable to load bookings.</td></tr>`;
    showToast(
      error instanceof ApiError ? error.message : 'Unable to load bookings.',
      'error',
    );
  }
}

function renderTable() {
  if (!state.bookings.length) {
    tableBody.innerHTML = `<tr><td colspan="9" class="empty-state">No bookings found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = state.bookings
    .map((booking) => {
      const id = booking._id || booking.id;
      const actions = [
        `<a class="btn btn-secondary btn-sm" href="booking-edit.html?id=${escapeHtml(id)}">Edit</a>`,
        `<button type="button" class="btn btn-secondary btn-sm" data-action="resend-emails" data-booking-id="${escapeHtml(id)}">Resend Emails</button>`,
      ];
      if (isSuperAdmin()) {
        actions.push(`<button type="button" class="btn btn-danger btn-sm" data-action="delete" data-booking-id="${escapeHtml(id)}">Delete</button>`);
      }
      return `
        <tr data-id="${escapeHtml(id)}">
          <td><a href="booking-edit.html?id=${escapeHtml(id)}"><strong>${escapeHtml(booking.bookingReference || '—')}</strong></a></td>
          <td>${escapeHtml(fullName(booking))}<br><span class="text-muted">${escapeHtml(booking.email || '')}</span></td>
          <td>${escapeHtml(campLabel(booking.camp))}</td>
          <td>${escapeHtml(formatDate(booking.arrivalDate))}</td>
          <td>${escapeHtml(formatDate(booking.departureDate))}</td>
          <td>${escapeHtml(booking.stayType || '—')}</td>
          <td>${statusBadge(booking.status)}</td>
          <td>${escapeHtml(roomLabel(booking.room, booking))}</td>
          <td><div class="button-group" style="gap:var(--space-2);flex-wrap:wrap;">
            ${actions.join(' ')}
            ${booking.status === 'Booked'
              ? `<label class="form-check" title="Check in visitor">
                   <input type="checkbox" data-action="check-in" aria-label="Check in ${escapeHtml(booking.bookingReference || 'visitor')}" />
                   <span>Check in</span>
                 </label>`
              : '—'}
           ${booking.status === 'Checked In'
             ? `<button type="button" class="btn btn-secondary btn-sm" data-action="early-check-out" data-booking-id="${escapeHtml(id)}">Emergency Early Check Out</button>`
             : ''}
          </div></td>
        </tr>
      `;
    })
    .join('');
}

async function onTableAction(event) {
  const resendButton = event.target.closest('button[data-action="resend-emails"]');
  if (resendButton) {
    const booking = state.bookings.find((item) => String(item._id || item.id) === String(resendButton.dataset.bookingId));
    const reference = booking?.bookingReference || 'this booking';
    const confirmed = await confirmDialog({
      title: 'Resend Booking Emails',
      message: `Resend the booking confirmation and invoice for ${reference}?`,
      confirmLabel: 'Resend Emails',
    });
    if (!confirmed) return;
    setButtonLoading(resendButton, true, 'Sending…');
    try {
      const response = await resendBookingEmails(resendButton.dataset.bookingId);
      const result = response.data || {};
      showToast(
        result.bookingEmailSent && result.invoiceEmailSent
          ? `Booking and invoice emails sent for ${reference}.`
          : 'Some emails could not be sent. Check the email service logs.',
        result.bookingEmailSent && result.invoiceEmailSent ? 'success' : 'error',
      );
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Unable to resend booking emails.', 'error');
    } finally {
      setButtonLoading(resendButton, false);
    }
    return;
  }

  const deleteButton = event.target.closest('button[data-action="delete"]');
  if (deleteButton) {
    const booking = state.bookings.find((item) => String(item._id || item.id) === String(deleteButton.dataset.bookingId));
    const reference = booking?.bookingReference || '';
    const confirmed = await confirmDialog({
      title: 'Delete Booking',
      message: `Permanently delete booking ${reference || 'this booking'}? This cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      destructive: true,
    });
    if (!confirmed) return;
    setButtonLoading(deleteButton, true, '…');
    try {
      await deleteBooking(deleteButton.dataset.bookingId);
      showToast(`Booking ${reference} deleted.`, 'success');
      await loadBookings();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Unable to delete booking.', 'error');
    } finally {
      setButtonLoading(deleteButton, false);
    }
    return;
  }

  const checkbox = event.target.closest('input[data-action="check-in"]');
  const earlyCheckout = event.target.closest('[data-action="early-check-out"]');
  if (earlyCheckout) {
    const reason = window.prompt('Reason for emergency early check out:');
    if (reason === null || !reason.trim()) {
      showToast('A reason is required for an emergency early check out.', 'error');
      return;
    }
    if (!window.confirm(`Check out this visitor early due to an emergency?\nReason: ${reason.trim()}`)) return;
    earlyCheckout.disabled = true;
    try {
      await checkOutBooking(earlyCheckout.dataset.bookingId, reason.trim());
      showToast('Visitor checked out early due to emergency.', 'success');
      await loadBookings();
    } catch (error) {
      earlyCheckout.disabled = false;
      showToast(error instanceof ApiError ? error.message : 'Unable to check out visitor.', 'error');
    }
    return;
  }
  if (!checkbox || !checkbox.checked) return;

  const row = checkbox.closest('tr');
  const id = row?.dataset.id;
  if (!id) return;

  checkbox.disabled = true;
  try {
    await checkInBooking(id);
    showToast('Visitor checked in successfully.', 'success');
    await loadBookings();
  } catch (error) {
    checkbox.checked = false;
    checkbox.disabled = false;
    showToast(
      error instanceof ApiError ? error.message : 'Unable to check in visitor.',
      'error',
    );
  }
}

const user = requireAuth();
if (user) {
  initAdminShell();
  boot();
}
