import { createBooking } from '../api/bookings.js';
import { ApiError } from '../api/client.js';
import { requireAuth } from '../auth/session.js';
import { initAdminShell } from '../components/shell.js';
import { setButtonLoading } from '../components/loading.js';
import { showToast } from '../components/toast.js';
import {
  initGuestFieldSelects,
  setupDateInputs,
  readBookingFormValues,
  buildBookingPayload,
  validateBookingForm,
  wireCampSelectors,
} from './admin-booking-form.js';

const form = document.getElementById('booking-form');
const submitBtn = document.getElementById('booking-submit');
const priceSummaryEl = document.getElementById('price-summary');
let selectors;

const user = requireAuth();
if (user) {
  initAdminShell();
  initGuestFieldSelects(form);
  setupDateInputs(form.elements.arrivalDate, form.elements.departureDate);
  selectors = wireCampSelectors(form, {
    priceSummaryEl,
    onReady: async (s) => {
      try {
        await s.init();
      } catch (error) {
        showToast(
          error instanceof ApiError ? error.message : 'Unable to load camps.',
          'error',
        );
      }
    },
  });

  form.addEventListener('submit', onSubmit);
}

async function onSubmit(event) {
  event.preventDefault();
  const values = readBookingFormValues(form);

  if (!validateBookingForm(form, values, { requireLocation: true })) return;

  await selectors.updateRateDisplay();
  const appliedRate = selectors.getAppliedRate();
  if (appliedRate == null) {
    showToast('A valid rate must be available for the selected camp and stay type.', 'error');
    return;
  }

  const payload = buildBookingPayload(values);

  setButtonLoading(submitBtn, true, 'Creating…');
  try {
    const response = await createBooking(payload);
    const booking = response.data?.booking || response.data;
    showToast('Booking created successfully.', 'success');
    const id = booking?._id || booking?.id;
    if (id) {
      window.location.href = `booking-edit.html?id=${id}`;
    } else {
      window.location.href = 'bookings.html';
    }
  } catch (error) {
    showToast(
      error instanceof ApiError ? error.message : 'Unable to create booking.',
      'error',
    );
  } finally {
    setButtonLoading(submitBtn, false);
  }
}
