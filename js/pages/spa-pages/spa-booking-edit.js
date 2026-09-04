import { navigate, getCurrentParams } from '../spa-main.js';
import {
  getBooking,
  updateBooking,
  cancelBooking,
  checkInBooking,
  checkOutBooking,
  generateInvoiceForBooking,
  deleteBooking,
} from '../../api/bookings.js';
import { downloadInvoicePdf } from '../../api/invoices.js';
import { ApiError } from '../../api/client.js';
import { openModal, closeModal, confirmDialog } from '../../components/modal.js';
import { withLoading, setButtonLoading } from '../../components/loading.js';
import { showToast } from '../../components/toast.js';
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
} from '../admin-booking-form.js';
import { validateCancellationReason } from '../../utils/booking-validation.js';
import { applyFieldErrors } from '../../utils/validation.js';
import {
  escapeHtml,
  formatDateTime,
  fullName,
  statusBadge,
  nightsBetween,
} from '../../utils/format.js';
import { isSuperAdmin } from '../../auth/session.js';
import { openInvoiceDetailModal, printCurrentInvoice, downloadCurrentInvoicePdf } from '../invoice-actions.js';

let initialized = false;
let selectors;
let booking = null;

export async function init() {
  if (initialized) {
    booking = null;
    const params = getCurrentParams();
    const bookingId = params.get('id');
    if (bookingId) await loadBooking(bookingId);
    return;
  }
  initialized = true;

  const form = document.getElementById('booking-form');
  const priceSummaryEl = document.getElementById('price-summary');
  const cancelForm = document.getElementById('cancel-form');
  const actionBar = document.getElementById('action-bar');

  initGuestFieldSelects(form);
  setupDateInputs(form.elements.arrivalDate, form.elements.departureDate);
  selectors = wireCampSelectors(form, { priceSummaryEl });
  form.addEventListener('submit', onSave);
  cancelForm?.addEventListener('submit', onCancel);
  actionBar?.addEventListener('click', onAction);

  const invoiceLinkEl = document.getElementById('invoice-link');
  invoiceLinkEl?.addEventListener('click', onInvoiceLinkClick);

  const params = getCurrentParams();
  const bookingId = params.get('id');
  if (!bookingId) {
    showToast('Booking ID is required.', 'error');
    navigate('#/bookings');
    return;
  }
  await loadBooking(bookingId);
}

export async function refresh() {
  if (booking) await loadBooking(booking._id || booking.id);
}

async function loadBooking(bId) {
  try {
    const response = await withLoading(() => getBooking(bId), 'Loading booking…');
    const raw = response.data?.booking || response.data;
    booking = raw?.booking || raw;
    if (!booking) throw new Error('Booking not found');
    if (raw?.invoice || raw?.invoiceId) {
      booking.invoice = raw.invoice;
      booking.invoiceId = raw.invoiceId || raw.invoice?._id || raw.invoice?.id;
    }
    const form = document.getElementById('booking-form');
    const statusEl = document.getElementById('booking-status');
    populateGuestFields(form, booking);
    statusEl.innerHTML = statusBadge(booking.status);
    const ids = resolveBookingIds(booking);
    const lockLocation = booking.status !== 'Booked';
    await selectors.init({ campId: ids.campId, blockId: ids.blockId, roomId: ids.roomId, stayType: ids.stayType, lockLocation });
    if (booking.status !== 'Booked' && booking.appliedRate != null) {
      const amount = booking.appliedRate.amount ?? booking.appliedRate;
      const currency = booking.appliedRate.currency || 'KES';
      renderBookingPriceSummary(document.getElementById('price-summary'), {
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
    showToast(error instanceof ApiError ? error.message : 'Unable to load booking.', 'error');
    setTimeout(() => navigate('#/bookings'), 1500);
  }
}

function updateFormState(b) {
  const editable = b.status === 'Booked';
  const guestOnly = b.status === 'Checked In';
  const frozen = b.status === 'Checked Out' || b.status === 'Cancelled';
  const submitBtn = document.getElementById('booking-submit');
  const form = document.getElementById('booking-form');
  submitBtn.hidden = frozen;
  form.querySelectorAll('input, select, textarea').forEach((el) => {
    if (frozen) el.disabled = true;
  });
  if (guestOnly) {
    selectors.setLocationLocked(true);
    ['campId', 'blockId', 'roomId', 'stayType', 'arrivalDate', 'departureDate'].forEach((name) => {
      const el = form.elements[name];
      if (el) el.disabled = true;
    });
  }
  if (!editable && !guestOnly) submitBtn.hidden = true;
}

function renderTimeline(events) {
  const timelineEl = document.getElementById('booking-timeline');
  if (!timelineEl) return;
  timelineEl.innerHTML = events.length
    ? `<h3 style="font-size:var(--text-base);margin-bottom:var(--space-3);">Timeline</h3>
       <ul class="timeline-list">${events.map((entry) =>
         `<li><strong>${escapeHtml(entry.action || entry.event || entry.status || 'Event')}</strong>
          — ${escapeHtml(formatDateTime(entry.createdAt || entry.at || entry.timestamp))}
          ${entry.message || entry.note ? ` · ${escapeHtml(entry.message || entry.note)}` : ''}
          ${entry.reason ? ` · ${escapeHtml(entry.reason)}` : ''}</li>`
       ).join('')}</ul>`
    : '<p class="text-muted">No timeline events.</p>';
}

function renderInvoiceLink(b) {
  const invoiceLink = document.getElementById('invoice-link');
  if (!invoiceLink) return;
  const invId = b.invoiceId || b.invoice?._id || b.invoice?.id;
  const invNum = b.invoice?.invoiceNumber || '';
  const payStatus = b.invoice?.paymentStatus || '';
  const invInfo = invNum && payStatus
    ? `<span class="text-muted" style="margin-right:var(--space-3);">${escapeHtml(invNum)} · ${escapeHtml(payStatus)}</span>`
    : '';

  if (invId) {
    invoiceLink.innerHTML = `${invInfo}
      <div class="button-group" style="display:inline-flex;flex-wrap:wrap;gap:var(--space-2);">
        <button type="button" class="btn btn-secondary btn-sm" data-invoice-action="view">View Invoice</button>
        <button type="button" class="btn btn-secondary btn-sm" data-invoice-action="print">Print</button>
        <button type="button" class="btn btn-secondary btn-sm" data-invoice-action="pdf">Download PDF</button>
        <button type="button" class="btn btn-secondary btn-sm" data-invoice-action="regen">Regenerate Invoice</button>
      </div>`;
    invoiceLink.dataset.invoiceId = invId;
    invoiceLink.hidden = false;
  } else {
    invoiceLink.innerHTML = `<span class="text-muted" style="margin-right:var(--space-3);">No invoice yet.</span>
      <div class="button-group" style="display:inline-flex;gap:var(--space-2);">
        <button type="button" class="btn btn-primary btn-sm" data-invoice-action="generate">Generate Invoice Now</button>
      </div>`;
    delete invoiceLink.dataset.invoiceId;
    invoiceLink.hidden = false;
  }
}

function renderActions(b) {
  const actionBar = document.getElementById('action-bar');
  if (!actionBar) return;
  const buttons = [];
  if (b.status === 'Booked') {
    buttons.push(`<button type="button" class="btn btn-primary btn-sm" data-action="check-in">Check In</button>`);
    buttons.push(`<button type="button" class="btn btn-danger btn-sm" data-action="cancel">Cancel Booking</button>`);
  }
  if (b.status === 'Checked In') {
    buttons.push(`<button type="button" class="btn btn-primary btn-sm" data-action="check-out">Check Out</button>`);
    buttons.push(`<button type="button" class="btn btn-secondary btn-sm" data-action="early-check-out">Emergency Early Check Out</button>`);
    buttons.push(`<button type="button" class="btn btn-danger btn-sm" data-action="cancel">Cancel Booking</button>`);
  }
  if (isSuperAdmin()) {
    buttons.push(`<button type="button" class="btn btn-danger btn-sm" data-action="delete">Delete Booking</button>`);
  }
  actionBar.innerHTML = buttons.join('');
}

async function onSave(event) {
  event.preventDefault();
  if (!booking || booking.status === 'Checked Out' || booking.status === 'Cancelled') return;
  const form = document.getElementById('booking-form');
  const submitBtn = document.getElementById('booking-submit');
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
    await updateBooking(booking._id || booking.id, payload);
    showToast('Booking updated.', 'success');
    refresh();
  } catch (error) {
    showToast(error instanceof ApiError ? error.message : 'Unable to update booking.', 'error');
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

async function onInvoiceLinkClick(event) {
  const btn = event.target.closest('[data-invoice-action]');
  if (!btn) return;
  const action = btn.dataset.invoiceAction;
  const invId = (document.getElementById('invoice-link')?.dataset?.invoiceId) || booking?.invoiceId || booking?.invoice?._id || booking?.invoice?.id;

  if (action === 'generate' || action === 'regen') {
    try {
      const resp = await withLoading(
        () => generateInvoiceForBooking(booking._id || booking.id),
        action === 'regen' ? 'Regenerating invoice…' : 'Generating invoice…',
      );
      const inv = resp.data?.invoice || resp.data;
      showToast(`Invoice ${inv?.invoiceNumber || ''} generated.`, 'success');
      booking.invoiceId = inv?._id || inv?.id;
      booking.invoice = inv;
      renderInvoiceLink(booking);
      if (booking.invoiceId) {
        try { await openInvoiceDetailModal(booking.invoiceId); } catch (_) {}
      }
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to generate invoice.', 'error');
    }
    return;
  }

  if (!invId) {
    showToast('No invoice available yet. Generate it first.', 'warning');
    return;
  }

  if (action === 'view') {
    try { await openInvoiceDetailModal(invId); } catch (_) {}
    return;
  }
  if (action === 'print') {
    try {
      await openInvoiceDetailModal(invId);
      setTimeout(() => printCurrentInvoice().catch(() => {}), 400);
    } catch (_) {}
    return;
  }
  if (action === 'pdf') {
    try {
      await withLoading(() => downloadInvoicePdf(invId), 'Downloading PDF…');
      showToast('Invoice PDF downloaded.', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : err?.message || 'Unable to download PDF.', 'error');
    }
    return;
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
      await withLoading(() => checkInBooking(booking._id || booking.id), 'Checking in…');
      showToast('Guest checked in.', 'success');
      refresh();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Check-in failed.', 'error');
    }
    return;
  }
  if (action === 'check-out') {
    await processCheckout(false);
    return;
  }
  if (action === 'early-check-out') {
    await processCheckout(true);
    return;
  }
  return onCancelAction(action);
}

async function processCheckout(isEmergency) {
    const nights = nightsBetween(booking.arrivalDate, booking.departureDate);
    const ok = await confirmDialog({
      title: isEmergency ? 'Emergency early check out' : 'Check out guest',
      message: `${isEmergency ? 'Record an emergency early check out for' : 'Check out'} ${fullName(booking)}? An invoice will be generated (${nights ?? '—'} nights).`,
      confirmLabel: 'Check Out',
    });
    if (!ok) return;
    try {
      const resp =       await withLoading(() => checkOutBooking(
        booking._id || booking.id,
        isEmergency ? 'Emergency' : null,
      ), 'Checking out…');
      const data = resp.data || {};
      const inv = data.invoice || data.booking?.invoice;
      showToast('Guest checked out. Invoice generated.', 'success');
      if (inv) {
        const invId = inv._id || inv.id;
        booking.invoiceId = invId;
        booking.invoice = inv;
      }
      await refresh();
      const finalInvId = booking?.invoiceId || booking?.invoice?._id || booking?.invoice?.id;
      if (finalInvId) {
        try { await openInvoiceDetailModal(finalInvId); } catch (_) {}
      }
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Check-out failed.', 'error');
    }
    return;
}

async function onCancelAction(action) {
  if (action === 'cancel') {
    document.getElementById('cancel-reason').value = '';
    applyFieldErrors(document.getElementById('cancel-form'), {});
    openModal('cancel');
    return;
  }
  if (action === 'delete') {
    if (!isSuperAdmin()) {
      showToast('Only Super Admin can delete bookings.', 'error');
      return;
    }
    const ok = await confirmDialog({
      title: 'Delete Booking',
      message: `Permanently delete booking ${booking.bookingReference || ''} for ${fullName(booking)}? This will also remove the linked invoice and timeline, and cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      destructive: true,
    });
    if (!ok) return;
    try {
      await withLoading(() => deleteBooking(booking._id || booking.id), 'Deleting booking…');
      showToast(`Booking ${booking.bookingReference || ''} deleted.`, 'success');
      navigate('#/bookings');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to delete booking.', 'error');
    }
  }
}

async function onCancel(event) {
  event.preventDefault();
  const reason = document.getElementById('cancel-reason').value.trim();
  const cancelForm = document.getElementById('cancel-form');
  const { valid, errors } = validateCancellationReason(reason);
  applyFieldErrors(cancelForm, errors);
  if (!valid) return;
  const sb = document.getElementById('cancel-submit');
  setButtonLoading(sb, true, 'Cancelling…');
  try {
    await cancelBooking(booking._id || booking.id, { reason });
    closeModal('cancel');
    showToast('Booking cancelled.', 'success');
    refresh();
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : 'Cancellation failed.', 'error');
  } finally {
    setButtonLoading(sb, false);
  }
}
