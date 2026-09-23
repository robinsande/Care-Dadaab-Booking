import { listGuestCamps, listGuestCampRates, submitPublicBookingRequest } from '../api/guest.js';

const $ = (selector) => document.querySelector(selector);
const formData = (form) => Object.fromEntries(new FormData(form).entries());
const message = (text, error = false) => {
  $('#message').textContent = text;
  $('#message').style.background = error ? '#fee2e2' : '#eef6ff';
};
const refreshIcons = () => window.lucide?.createIcons();
const bookingForm = $('#booking-form');
const arrivalDateInput = bookingForm.elements.arrivalDate;
const departureDateInput = bookingForm.elements.departureDate;
const today = new Date().toISOString().slice(0, 10);

arrivalDateInput.min = today;
departureDateInput.min = today;
arrivalDateInput.addEventListener('change', () => {
  departureDateInput.min = arrivalDateInput.value || today;
  if (departureDateInput.value && departureDateInput.value <= arrivalDateInput.value) {
    departureDateInput.value = '';
  }
});

async function loadCamps() {
  const response = await listGuestCamps();
  const camps = Array.isArray(response.data) ? response.data : (response.data?.items || response.data?.camps || []);
  camps.forEach((camp) => {
    const option = document.createElement('option');
    option.value = camp._id;
    option.textContent = camp.name;
    bookingForm.elements.campId.appendChild(option);
  });
}

bookingForm.elements.campId.addEventListener('change', async () => {
  const rateSelect = bookingForm.elements.rateId;
  rateSelect.innerHTML = '<option value="">Loading rates...</option>';
  rateSelect.disabled = true;
  try {
    const response = await listGuestCampRates(bookingForm.elements.campId.value);
    const rates = Array.isArray(response.data) ? response.data : (response.data?.rates || response.data?.items || []);
    rateSelect.innerHTML = rates.length
      ? `<option value="">Choose room rate</option>${rates.map((rate) => `<option value="${rate._id}" data-stay-type="${rate.stayType}">${rate.stayType} - ${rate.currency} ${Number(rate.amount).toLocaleString()} per night</option>`).join('')}`
      : '<option value="">No rates configured for this camp</option>';
    rateSelect.disabled = !rates.length;
  } catch (error) {
    rateSelect.innerHTML = '<option value="">Unable to load rates</option>';
    message(error.message, true);
  }
});

bookingForm.elements.rateId.addEventListener('change', () => {
  bookingForm.elements.stayType.value = bookingForm.elements.rateId.selectedOptions[0]?.dataset.stayType || '';
});

bookingForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const values = formData(event.target);
    values.type = 'booking';
    values.driverPickup = event.target.elements.driverPickup.checked;
    await submitPublicBookingRequest(values);
    event.target.reset();
    bookingForm.elements.rateId.disabled = true;
    message('Your booking request has been submitted. The accommodation team will review it and contact you by email.');
  } catch (error) {
    message(error.message, true);
  }
});

loadCamps().catch((error) => message(error.message, true));
window.addEventListener('load', refreshIcons, { once: true });
