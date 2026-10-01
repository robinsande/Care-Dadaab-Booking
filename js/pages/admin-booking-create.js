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
  initBookingDraft,
  clearBookingDraft,
} from './admin-booking-form.js?v=20261001-2';

const form = document.getElementById('booking-form');
const submitBtn = document.getElementById('booking-submit');
const priceSummaryEl = document.getElementById('price-summary');
let selectors;

const user = requireAuth();
if (user) {
  initAdminShell();
  initGuestFieldSelects(form);
  setupDateInputs(form.elements.arrivalDate, form.elements.departureDate);
  const draft = initBookingDraft(form);
  selectors = wireCampSelectors(form, {
    priceSummaryEl,
    onReady: async (s) => {
      try {
        await s.init({
          campId: draft?.campId || '',
          blockId: draft?.blockId || '',
          roomId: draft?.roomId || '',
          stayType: draft?.stayType || '',
        });
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
  const isCareStaff = /^(?:care\s*)?staff$/i.test(String(values.contractType || '').trim());
  if (!isCareStaff && appliedRate == null) {
    showToast('A valid rate must be available for the selected camp and stay type.', 'error');
    return;
  }

  const payload = buildBookingPayload(values);

  setButtonLoading(submitBtn, true, 'Creating…');
  try {
    await createBooking(payload);
    showToast('Booking created successfully.', 'success');
    form.reset();
    form.elements.contractType?.dispatchEvent(new Event('change'));
    selectors.setLocationLocked(false);
    await selectors.loadBlocks('');
    selectors.updatePriceSummary();
    form.querySelectorAll('[data-error-for]').forEach((element) => {
      element.textContent = '';
    });
    clearBookingDraft(form);
  } catch (error) {
    showToast(
      error instanceof ApiError ? error.message : 'Unable to create booking.',
      'error',
    );
  } finally {
    setButtonLoading(submitBtn, false);
  }
}
