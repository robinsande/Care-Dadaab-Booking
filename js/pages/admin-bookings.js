import {
  listBookings,
  deleteBooking,
  checkInBooking,
  checkOutBooking,
  extendBookingStay,
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
import { listStaffGuestRequests, resolveGuestRequest, listCampRoomsForGuestRequest } from '../api/guest.js';
import {
  escapeHtml,
  formatDate,
  formatDateTime,
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
const guestRequestsEl = document.getElementById('guest-requests');

function boot() {
  fillSelect(document.getElementById('status'), constants.BOOKING_STATUSES, {
    placeholder: 'All statuses',
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get('search')) {
    state.search = params.get('search');
    filtersForm.elements.search.value = state.search;
  }

  async function onGuestRequestAction(event) {
    const approve = event.target.closest('[data-guest-request]');
    const reject = event.target.closest('[data-guest-reject]');
    const id = approve?.dataset.guestRequest || reject?.dataset.guestReject;
    if (!id) return;
    try {
      if (reject) {
        const note = window.prompt('Reason for rejecting this request:');
        await resolveGuestRequest(id, { action: 'reject', resolutionNote: note || '' });
      } else {
        const request = await listStaffGuestRequests({ status: 'pending' }).then((response) =>
          (response.data || []).find((item) => String(item._id) === String(id)));
        const payload = { action: 'approve' };
        if (request?.type === 'booking') {
          payload.campId = request.camp?._id;
          const availableResponse = await listCampRoomsForGuestRequest(payload.campId);
          const available = Array.isArray(availableResponse.data)
            ? availableResponse.data
            : availableResponse.data?.rooms
            || availableResponse.data?.items
            || availableResponse.data
            || [];
          if (!available.length) throw new Error('No active rooms exist in the selected camp.');
          const choices = available.map((room, index) =>
            `${index + 1}. ${room.blockName || room.block?.name || ''} Room ${room.roomNumber} [${room.status || 'Unknown'}] (${room._id})`
          ).join('\n');
          const selected = Number(window.prompt(`Choose a room to assign. The system will verify date conflicts:\n${choices}`, '1'));
          const room = available[selected - 1];
          if (!room) throw new Error('A valid room assignment is required.');
          payload.blockId = room.block?._id || room.block;
          payload.roomId = room._id;
        }
        await resolveGuestRequest(id, payload);
      }
      showToast('Guest request updated.', 'success');
      await loadGuestRequests();
      await loadBookings();
    } catch (error) {
      const details = error instanceof ApiError && error.errors?.length
        ? ` ${error.errors.map((item) => item.message).join(' ')}`
        : '';
      showToast(`${error?.message || 'Unable to update guest request.'}${details}`, 'error');
    }
  }
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
  guestRequestsEl?.addEventListener('click', onGuestRequestAction);
  loadCampsForFilter();
  loadBookings();
  loadGuestRequests();
}

async function loadGuestRequests() {
  if (!guestRequestsEl) return;
  try {
    const response = await listStaffGuestRequests({ status: 'pending' });
    const requests = response.data || [];
    guestRequestsEl.innerHTML = requests.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Guest</th><th>Type</th><th>Dates / booking</th><th>Reason</th><th>Action</th></tr></thead><tbody>${requests.map((request) => {
      const booking = request.booking || {};
      const dates = request.arrivalDate ? `${String(request.arrivalDate).slice(0, 10)} → ${String(request.departureDate).slice(0, 10)}` : (booking.bookingReference || '—');
      return `<tr><td>${escapeHtml(`${request.guest?.firstName || ''} ${request.guest?.lastName || ''}`)}<br>${escapeHtml(request.guest?.email || '')}</td><td>${escapeHtml(request.type)}</td><td>${escapeHtml(dates)}<br>${escapeHtml(request.camp?.name || booking.campName || '')}</td><td>${escapeHtml(request.reason || '—')}</td><td><button class="btn btn-primary btn-sm" data-guest-request="${escapeHtml(request._id)}">Approve</button> <button class="btn btn-secondary btn-sm" data-guest-reject="${escapeHtml(request._id)}">Reject</button></td></tr>`;
    }).join('')}</tbody></table></div>` : '<p>No pending guest requests.</p>';
  } catch { guestRequestsEl.innerHTML = '<p>Unable to load guest requests.</p>'; }
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
    tableBody.innerHTML = `<tr><td colspan="12" class="empty-state">Unable to load bookings.</td></tr>`;
    showToast(
      error instanceof ApiError ? error.message : 'Unable to load bookings.',
      'error',
    );
  }
}

function collectExtensionDetails(booking) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
      <div class="modal-header"><h2>Extend Stay</h2><button type="button" class="modal-close" data-extension-cancel aria-label="Close">&times;</button></div>
      <form><div class="modal-body">
        <div class="form-group"><label class="form-label">New departure date <span class="required">*</span></label><input class="form-control" type="date" name="newDepartureDate" min="${String(booking.departureDate).slice(0, 10)}" required></div>
        <div class="form-group"><label class="form-label">Reason for extension <span class="required">*</span></label><textarea class="form-control" name="reason" rows="4" required></textarea></div>
        <p class="text-muted">The additional charge is calculated automatically from the booking rate for the extra nights.</p>
      </div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-extension-cancel>Cancel</button><button type="submit" class="btn btn-primary">Extend Stay</button></div></form>
    </div>`;
    document.body.appendChild(backdrop);
    const form = backdrop.querySelector('form');
    const finish = (value) => { backdrop.remove(); resolve(value); };
    backdrop.querySelectorAll('[data-extension-cancel]').forEach((button) => button.addEventListener('click', () => finish(null)));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      finish({ newDepartureDate: data.get('newDepartureDate'), reason: data.get('reason')?.trim() });
    });
    form.querySelector('[name="newDepartureDate"]').focus();
  });
}

function renderTable() {
  if (!state.bookings.length) {
    tableBody.innerHTML = `<tr><td colspan="12" class="empty-state">No bookings found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = state.bookings
    .map((booking) => {
      const id = booking._id || booking.id;
      const actions = [
        `<a class="btn btn-secondary btn-sm" href="booking-edit.html?id=${escapeHtml(id)}">Edit</a>`,
        `<button type="button" class="btn btn-secondary btn-sm" data-action="resend-emails" data-booking-id="${escapeHtml(id)}">Resend Emails</button>`,
      ];
      const guestEmail = booking.email || booking.guest?.email || '';
      if (guestEmail) {
        actions.push(`<button type="button" class="btn btn-secondary btn-sm" data-action="guest-history" data-guest-search="${escapeHtml(guestEmail)}">Guest History</button>`);
      }
      if (isSuperAdmin()) {
        actions.push(`<button type="button" class="btn btn-danger btn-sm" data-action="delete" data-booking-id="${escapeHtml(id)}">Delete</button>`);
      }
      return `
        <tr data-id="${escapeHtml(id)}">
          <td><a href="booking-edit.html?id=${escapeHtml(id)}"><strong>${escapeHtml(booking.bookingReference || '—')}</strong></a></td>
          <td>${escapeHtml(fullName(booking))}<br><span class="text-muted">${escapeHtml(booking.email || '')}</span></td>
          <td>${escapeHtml(campLabel(booking.camp))}</td>
          <td>${escapeHtml(formatDateTime(booking.createdAt))}</td>
          <td>${escapeHtml(formatDate(booking.arrivalDate))}</td>
          <td>${escapeHtml(formatDate(booking.departureDate))}</td>
          <td>${escapeHtml(formatDateTime(booking.checkedInAt))}</td>
          <td>${escapeHtml(formatDateTime(booking.checkedOutAt))}</td>
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
           ${['Booked', 'Checked In'].includes(booking.status)
             ? `<button type="button" class="btn btn-secondary btn-sm" data-list-action="extend-stay" data-booking-id="${escapeHtml(id)}">Extend Stay</button>`
             : ''}
          </div></td>
        </tr>
      `;
    })
    .join('');
}

async function onTableAction(event) {
  const historyButton = event.target.closest('button[data-action="guest-history"]');
  if (historyButton) {
    state.search = historyButton.dataset.guestSearch || '';
    state.page = 1;
    document.getElementById('search').value = state.search;
    await loadBookings();
    return;
  }
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
      const allSent = result.bookingEmailSent && result.invoiceEmailSent;
      showToast(
        allSent
          ? `Booking and invoice emails sent for ${reference}.`
          : 'One or more emails could not be sent. Check Render email logs.',
        allSent ? 'success' : 'error',
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
  const extendButton = event.target.closest('[data-list-action="extend-stay"]');
  if (extendButton) {
    const booking = state.bookings.find((item) => String(item._id || item.id) === String(extendButton.dataset.bookingId));
    const details = await collectExtensionDetails(booking);
    if (!details) return;
    extendButton.disabled = true;
    try {
      await extendBookingStay(extendButton.dataset.bookingId, {
        ...details,
      });
      showToast('Stay extended, invoice updated, and email sent.', 'success');
      await loadBookings(tableBody, paginationEl);
    } catch (error) {
      extendButton.disabled = false;
      showToast(error instanceof ApiError ? error.message : 'Unable to extend stay.', 'error');
    }
    return;
  }
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
