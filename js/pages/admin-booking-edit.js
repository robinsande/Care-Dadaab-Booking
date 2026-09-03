import { getBooking, updateBooking, cancelBooking, checkInBooking, checkOutBooking } from '../api/bookings.js';
import { ApiError } from '../api/client.js';
import { requireAuth } from '../auth/session.js';
import { initAdminShell } from '../components/shell.js';
import { initModals, openModal, closeModal, confirmDialog } from '../components/modal.js';
import { withLoading, setButtonLoading } from '../components/loading.js';
import { showToast } from '../components/toast.js';
import {
  initGuestFieldSelects,
  setupDateInputs,
  readBookingFormValues,
  buildBookingPayload,
  validateBookingForm,
  wireCampSelectors,
  populateGuestFields,
  resolveBookingIds,
  renderBookingPriceSummary,
} from './admin-booking-form.js';
import { validateCancellationReason } from '../utils/booking-validation.js';
import { applyFieldErrors } from '../utils/validation.js';
import {
  escapeHtml,
  formatDate,
  formatDateTime,
  fullName,
  roomLabel,
  statusBadge,
  yesNo,
  nightsBetween,
} from '../utils/format.js';

const params = new URLSearchParams(window.location.search);
const bookingId = params.get('id');

const form = document.getElementById('booking-form');
const submitBtn = document.getElementById('booking-submit');
const priceSummaryEl = document.getElementById('price-summary');
const statusEl = document.getElementById('booking-status');
const timelineEl = document.getElementById('booking-timeline');
const invoiceLink = document.getElementById('invoice-link');
const actionBar = document.getElementById('action-bar');
const cancelForm = document.getElementById('cancel-form');

let selectors;
let booking = null;

const user = requireAuth();
if (!user) {
  /* redirect */
} else if (!bookingId) {
  showToast('Booking ID is required.', 'error');
  window.location.href = 'bookings.html';
} else {
  initAdminShell();
  initModals();
  initGuestFieldSelects(form);
  setupDateInputs(form.elements.arrivalDate, form.elements.departureDate);
  selectors = wireCampSelectors(form, { priceSummaryEl });
  form.addEventListener('submit', onSave);
  cancelForm?.addEventListener('submit', onCancel);
  actionBar?.addEventListener('click', onAction);
  loadBooking();
}

async function loadBooking() {
  try {
    const response = await withLoading(() => getBooking(bookingId), 'Loading booking…');
    booking = response.data?.booking || response.data;
    if (!booking) throw new Error('Booking not found');

    populateGuestFields(form, booking);
    statusEl.innerHTML = statusBadge(booking.status);

    const ids = resolveBookingIds(booking);
    const lockLocation = booking.status !== 'Booked';

    await selectors.init({
      campId: ids.campId,
      blockId: ids.blockId,
      roomId: ids.roomId,
      stayType: ids.stayType,
      lockLocation,
    });

    if (booking.status !== 'Booked' && booking.appliedRate != null && priceSummaryEl) {
      const amount = booking.appliedRate.amount ?? booking.appliedRate;
      const currency = booking.appliedRate.currency || 'KES';
      renderBookingPriceSummary(priceSummaryEl, {
        stayType: booking.stayType,
        appliedRate: amount,
        currency,
        arrivalDate: booking.arrivalDate,
        departureDate: booking.departureDate,
        appliedAtBooking: true,
      });
    } else {
      selectors.updatePriceSummary?.();
    }

    renderTimeline(booking.timeline || booking.auditTimeline || []);
    renderInvoiceLink(booking);
    renderActions(booking);
    updateFormState(booking);
  } catch (error) {
    showToast(
      error instanceof ApiError ? error.message : 'Unable to load booking.',
      'error',
    );
    setTimeout(() => { window.location.href = 'bookings.html'; }, 1500);
  }
}

function updateFormState(b) {
  const editable = b.status === 'Booked';
  const guestOnly = b.status === 'Checked In';
  const frozen = b.status === 'Checked Out' || b.status === 'Cancelled';

  submitBtn.hidden = frozen;
  form.querySelectorAll('input, select, textarea').forEach((el) => {
    if (frozen) {
      el.disabled = true;
    }
  });

  if (guestOnly) {
    selectors.setLocationLocked(true);
    ['campId', 'blockId', 'roomId', 'stayType', 'arrivalDate', 'departureDate'].forEach((name) => {
      const el = form.elements[name];
      if (el) el.disabled = true;
    });
  }

  if (!editable && !guestOnly) {
    submitBtn.hidden = true;
  }
}

function renderTimeline(events) {
  if (!timelineEl) return;
  timelineEl.innerHTML = events.length
    ? `<h3 style="font-size:var(--text-base);margin-bottom:var(--space-3);">Timeline</h3>
       <ul class="timeline-list">${events
         .map(
           (entry) =>
             `<li><strong>${escapeHtml(entry.action || entry.event || entry.status || 'Event')}</strong>
              — ${escapeHtml(formatDateTime(entry.createdAt || entry.at || entry.timestamp))}
              ${entry.message || entry.note ? ` · ${escapeHtml(entry.message || entry.note)}` : ''}
              ${entry.reason ? ` · ${escapeHtml(entry.reason)}` : ''}</li>`,
         )
         .join('')}</ul>`
    : '<p class="text-muted">No timeline events.</p>';
}

function renderInvoiceLink(b) {
  if (!invoiceLink) return;
  if (b.status === 'Checked Out' || b.invoiceId || b.invoice) {
    const invoiceId = b.invoiceId || b.invoice?._id || b.invoice?.id;
    const href = invoiceId
      ? `invoices.html?id=${encodeURIComponent(invoiceId)}`
      : `invoices.html?search=${encodeURIComponent(b.bookingReference || '')}`;
    invoiceLink.innerHTML = `<a class="btn btn-secondary btn-sm" href="${escapeHtml(href)}">View Invoice</a>`;
    invoiceLink.hidden = false;
  } else {
    invoiceLink.hidden = true;
  }
}

function renderActions(b) {
  if (!actionBar) return;
  const buttons = [];

  if (b.status === 'Booked') {
    buttons.push(`<button type="button" class="btn btn-primary btn-sm" data-action="check-in">Check In</button>`);
    buttons.push(`<button type="button" class="btn btn-danger btn-sm" data-action="cancel">Cancel Booking</button>`);
  }
  if (b.status === 'Checked In') {
    buttons.push(`<button type="button" class="btn btn-primary btn-sm" data-action="check-out">Check Out</button>`);
    buttons.push(`<button type="button" class="btn btn-danger btn-sm" data-action="cancel">Cancel Booking</button>`);
  }

  actionBar.innerHTML = buttons.join('');
}

async function onSave(event) {
  event.preventDefault();
  if (!booking || booking.status === 'Checked Out' || booking.status === 'Cancelled') return;

  const requireLocation = booking.status === 'Booked';
  const values = readBookingFormValues(form);

  if (!validateBookingForm(form, values, { requireLocation })) return;

  if (requireLocation && selectors.getAppliedRate() == null) {
    showToast('A valid rate must be available for the selected camp and stay type.', 'error');
    return;
  }

  const payload = buildBookingPayload(values);

  setButtonLoading(submitBtn, true, 'Saving…');
  try {
    await updateBooking(bookingId, payload);
    showToast('Booking updated.', 'success');
    await loadBooking();
  } catch (error) {
    showToast(
      error instanceof ApiError ? error.message : 'Unable to update booking.',
      'error',
    );
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

async function onAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const action = button.dataset.action;

  if (action === 'check-in') {
    const ok = await confirmDialog({
      title: 'Check in guest',
      message: `Check in ${fullName(booking)}?`,
      confirmLabel: 'Check In',
    });
    if (!ok) return;
    try {
      await withLoading(() => checkInBooking(bookingId), 'Checking in…');
      showToast('Guest checked in.', 'success');
      await loadBooking();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Check-in failed.', 'error');
    }
    return;
  }

  if (action === 'check-out') {
    const nights = nightsBetween(booking.arrivalDate, booking.departureDate);
    const ok = await confirmDialog({
      title: 'Check out guest',
      message: `Check out ${fullName(booking)}? An invoice will be generated (${nights ?? '—'} nights).`,
      confirmLabel: 'Check Out',
    });
    if (!ok) return;
    try {
      await withLoading(() => checkOutBooking(bookingId), 'Checking out…');
      showToast('Guest checked out. Invoice generated.', 'success');
      await loadBooking();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Check-out failed.', 'error');
    }
    return;
  }

  if (action === 'cancel') {
    document.getElementById('cancel-reason').value = '';
    applyFieldErrors(cancelForm, {});
    openModal('cancel');
  }
}

async function onCancel(event) {
  event.preventDefault();
  const reason = document.getElementById('cancel-reason').value.trim();
  const { valid, errors } = validateCancellationReason(reason);
  applyFieldErrors(cancelForm, errors);
  if (!valid) return;

  const submitBtn = document.getElementById('cancel-submit');
  setButtonLoading(submitBtn, true, 'Cancelling…');
  try {
    await cancelBooking(bookingId, { reason });
    closeModal('cancel');
    showToast('Booking cancelled.', 'success');
    await loadBooking();
  } catch (error) {
    showToast(error instanceof ApiError ? error.message : 'Cancellation failed.', 'error');
  } finally {
    setButtonLoading(submitBtn, false);
  }
}
