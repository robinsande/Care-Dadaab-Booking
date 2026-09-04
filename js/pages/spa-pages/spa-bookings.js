import { navigate, getCurrentParams } from '../spa-main.js';
import {
  listBookings,
  deleteBooking,
  checkInBooking,
  checkOutBooking,
  resendBookingEmails,
} from '../../api/bookings.js';
import { listCamps } from '../../api/camps.js';
import { ApiError } from '../../api/client.js';
import { withLoading, setButtonLoading } from '../../components/loading.js';
import { showToast } from '../../components/toast.js';
import { confirmDialog } from '../../components/modal.js';
import { renderPagination } from '../../components/pagination.js';
import { constants, fillSelect } from '../../utils/constants.js';
import { isSuperAdmin } from '../../auth/session.js';
import { openInvoiceDetailModal } from '../invoice-actions.js';
import {
  escapeHtml,
  formatDate,
  fullName,
  campLabel,
  roomLabel,
  statusBadge,
} from '../../utils/format.js';

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

let initialized = false;

export async function init() {
  if (initialized) return;
  initialized = true;

  const filtersForm = document.getElementById('bookings-filters');
  const tableBody = document.getElementById('bookings-table-body');
  const paginationEl = document.getElementById('bookings-pagination');

  fillSelect(document.getElementById('bf-status'), constants.BOOKING_STATUSES, {
    placeholder: 'All statuses',
  });

  const params = getCurrentParams();
  if (params.get('status')) {
    document.getElementById('bf-status').value = params.get('status');
    state.status = params.get('status');
  }

  filtersForm.addEventListener('submit', (event) => {
    event.preventDefault();
    state.search = filtersForm.elements.search.value.trim();
    state.status = filtersForm.elements.status.value;
    state.campId = filtersForm.elements.campId?.value || '';
    state.sort = filtersForm.elements.sort.value;
    state.page = 1;
    loadBookings(tableBody, paginationEl);
  });

  tableBody.addEventListener('click', onTableAction);
  tableBody.addEventListener('change', onTableAction);
  await loadCampsForFilter();
  loadBookings(tableBody, paginationEl);
}

export async function refresh() {
  const tableBody = document.getElementById('bookings-table-body');
  const paginationEl = document.getElementById('bookings-pagination');
  state.page = 1;
  loadBookings(tableBody, paginationEl);
}

async function loadCampsForFilter() {
  try {
    const response = await listCamps();
    const camps = response.data?.camps || response.data?.items || response.data || [];
    fillSelect(
      document.getElementById('bf-campId'),
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

async function loadBookings(tableBody, paginationEl) {
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

    renderTable(tableBody);
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
        loadBookings(tableBody, paginationEl);
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

function renderTable(tableBody) {
  if (!state.bookings.length) {
    tableBody.innerHTML = `<tr><td colspan="9" class="empty-state">No bookings found.</td></tr>`;
    return;
  }

  const canDelete = isSuperAdmin();

  tableBody.innerHTML = state.bookings
    .map((booking) => {
      const id = booking._id || booking.id;
      const actions = [];
      actions.push(`<a class="btn btn-secondary btn-sm" data-nav-link data-list-action="edit" href="#/booking/edit?id=${escapeHtml(id)}">Edit</a>`);
      actions.push(`<button type="button" class="btn btn-secondary btn-sm" data-list-action="resend-emails" data-booking-id="${escapeHtml(id)}">Resend Emails</button>`);
      if (booking.invoiceId || booking.invoice?._id || booking.invoice?.id) {
        const invId = booking.invoiceId || booking.invoice?._id || booking.invoice?.id;
        actions.push(`<button type="button" class="btn btn-secondary btn-sm" data-list-action="invoice" data-invoice-id="${escapeHtml(invId)}">Invoice</button>`);
      }
      if (canDelete) {
        actions.push(`<button type="button" class="btn btn-danger btn-sm" data-list-action="delete" data-booking-id="${escapeHtml(id)}">Delete</button>`);
      }
      if (booking.status === 'Booked') {
        actions.push(`<label class="form-check" title="Check in visitor">
          <input type="checkbox" data-list-action="check-in" data-booking-id="${escapeHtml(id)}" aria-label="Check in ${escapeHtml(booking.bookingReference || 'visitor')}" />
          <span>Check in</span>
        </label>`);
      }
      if (booking.status === 'Checked In') {
        actions.push(`<button type="button" class="btn btn-secondary btn-sm" data-list-action="early-check-out" data-booking-id="${escapeHtml(id)}">Emergency Early Check Out</button>`);
      }
      return `
        <tr data-id="${escapeHtml(id)}">
          <td><a data-nav-link href="#/booking/edit?id=${escapeHtml(id)}"><strong>${escapeHtml(booking.bookingReference || '—')}</strong></a></td>
          <td>${escapeHtml(fullName(booking))}<br><span class="text-muted">${escapeHtml(booking.email || '')}</span></td>
          <td>${escapeHtml(campLabel(booking.camp))}</td>
          <td>${escapeHtml(formatDate(booking.arrivalDate))}</td>
          <td>${escapeHtml(formatDate(booking.departureDate))}</td>
          <td>${escapeHtml(booking.stayType || '—')}</td>
          <td>${statusBadge(booking.status)}</td>
          <td>${escapeHtml(roomLabel(booking.room, booking))}</td>
          <td><div class="button-group" style="gap:var(--space-2);flex-wrap:wrap;">${actions.join('')}</div></td>
        </tr>
      `;
    })
    .join('');
}

async function onTableAction(event) {
  const btn = event.target.closest('[data-list-action]');
  if (!btn) return;
  const action = btn.dataset.listAction;

  if (action === 'resend-emails') {
    const bookingId = btn.dataset.bookingId;
    const booking = state.bookings.find((item) => String(item._id || item.id) === String(bookingId));
    const reference = booking?.bookingReference || 'this booking';
    const confirmed = await confirmDialog({
      title: 'Resend Booking Emails',
      message: `Resend the booking confirmation and invoice for ${reference}?`,
      confirmLabel: 'Resend Emails',
    });
    if (!confirmed) return;
    setButtonLoading(btn, true, 'Sending…');
    try {
      const response = await resendBookingEmails(bookingId);
      showToast(`Booking and invoice emails queued for ${reference}.`, 'success');
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Unable to resend booking emails.', 'error');
    } finally {
      setButtonLoading(btn, false);
    }
    return;
  }

  if (action === 'check-in') {
    if (event.type !== 'change' || !btn.checked) return;
    const bookingId = btn.dataset.bookingId;
    btn.disabled = true;
    try {
      await checkInBooking(bookingId);
      showToast('Visitor checked in successfully.', 'success');
      await refresh();
    } catch (error) {
      btn.checked = false;
      btn.disabled = false;
      showToast(
        error instanceof ApiError ? error.message : 'Unable to check in visitor.',
        'error',
      );
    }

    return;
  }

  if (action === 'early-check-out') {
    const reason = window.prompt('Reason for emergency early check out:');
    if (reason === null || !reason.trim()) {
      showToast('A reason is required for an emergency early check out.', 'error');
      return;
    }
    const confirmed = window.confirm(`Check out this visitor early due to an emergency?\nReason: ${reason.trim()}`);
    if (!confirmed) return;
    btn.disabled = true;
    try {
      await checkOutBooking(btn.dataset.bookingId, reason.trim());
      showToast('Visitor checked out early due to emergency.', 'success');
      await refresh();
    } catch (error) {
      btn.disabled = false;
      showToast(error instanceof ApiError ? error.message : 'Unable to check out visitor.', 'error');
    }
    return;
  }

  if (action === 'invoice') {
    const invId = btn.dataset.invoiceId;
    if (invId) {
      try { await openInvoiceDetailModal(invId); } catch (_) {}
    }
    return;
  }

  if (action === 'delete') {
    const bookingId = btn.dataset.bookingId;
    const booking = state.bookings.find((b) => String(b._id || b.id) === String(bookingId));
    const ref = booking?.bookingReference || '';
    const guest = booking ? fullName(booking) : '';
    const ok = await confirmDialog({
      title: 'Delete Booking',
      message: ref && guest
        ? `Permanently delete booking ${ref} for ${guest}? Linked invoice and timeline will also be removed. This cannot be undone.`
        : 'Permanently delete this booking? This cannot be undone.',
      confirmLabel: 'Delete Permanently',
      destructive: true,
    });
    if (!ok) return;
    setButtonLoading(btn, true, '…');
    try {
      await deleteBooking(bookingId);
      showToast(`Booking ${ref || ''} deleted.`, 'success');
      refresh();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to delete booking.', 'error');
    } finally {
      setButtonLoading(btn, false);
    }
  }
}
