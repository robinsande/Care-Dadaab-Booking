import { navigate } from '../spa-main.js';
import { createBooking } from '../../api/bookings.js';
import { ApiError } from '../../api/client.js';
import { setButtonLoading } from '../../components/loading.js';
import { showToast } from '../../components/toast.js';
import { openInvoiceDetailModal } from '../invoice-actions.js';
import {
  initGuestFieldSelects,
  setupDateInputs,
  readBookingFormValues,
  buildBookingPayload,
  validateBookingForm,
  wireCampSelectors,
} from '../admin-booking-form.js';

let initialized = false;
let globalSelectors;

export async function init() {
  if (initialized) return;
  initialized = true;

  const form = document.getElementById('booking-create-form');
  const submitBtn = document.getElementById('booking-create-submit');
  const priceSummaryEl = document.getElementById('bc-price-summary');

  initGuestFieldSelects(form);
  setupDateInputs(form.elements.arrivalDate, form.elements.departureDate);

  globalSelectors = wireCampSelectors(form, {
    priceSummaryEl,
    onReady: async (s) => {
      try {
        await s.init();
      } catch (error) {
        showToast(error instanceof ApiError ? error.message : 'Unable to load camps.', 'error');
      }
    },
  });

  form.addEventListener('submit', onSubmit);
}

async function onSubmit(event) {
  event.preventDefault();
  const form = document.getElementById('booking-create-form');
  const submitBtn = document.getElementById('booking-create-submit');
  const values = readBookingFormValues(form);
  if (!validateBookingForm(form, values, { requireLocation: true })) return;
  await globalSelectors.updateRateDisplay();
  const appliedRate = globalSelectors.getAppliedRate();
  if (appliedRate == null) {
    showToast('A valid rate must be available for the selected camp and stay type.', 'error');
    return;
  }
  const payload = buildBookingPayload(values);
  setButtonLoading(submitBtn, true, 'Creating…');
  try {
    const response = await createBooking(payload);
    const data = response.data?.booking || response.data;
    const booking = data?.booking || data;
    const invoice = data?.invoice || booking?.invoice;
    const bookingId = booking?._id || booking?.id;
    const invoiceId = invoice?._id || invoice?.id || data?.invoiceId || booking?.invoiceId;

    showToast('Booking created successfully.', 'success');

    if (invoiceId) {
      try {
        await openInvoiceDetailModal(invoiceId);
      } catch (_) {}
    }

    if (bookingId) navigate(`#/booking/edit?id=${bookingId}`);
    else navigate('#/bookings');
  } catch (error) {
    showToast(error instanceof ApiError ? error.message : 'Unable to create booking.', 'error');
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

export async function refresh() {}
