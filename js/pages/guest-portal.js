import { listGuestCamps, listGuestCampRates, listPublicMous, submitPublicBookingRequest } from '../api/guest.js';

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
const careStaffLocation = bookingForm.elements.careStaffLocation;
const internationalCountry = bookingForm.elements.internationalCountry;
const updateCareStaffFields = () => {
  const isCareStaff = bookingForm.elements.contractType.value === 'CARE Staff';
  const isInternationalStaff = careStaffLocation.value === 'CARE International Staff';
  const countryGroup = internationalCountry.closest('.form-field, .form-group') || internationalCountry;
  countryGroup.hidden = !isInternationalStaff;
  countryGroup.classList.toggle('is-hidden', !isInternationalStaff);
  internationalCountry.required = isInternationalStaff;
  if (!isInternationalStaff) internationalCountry.value = '';
  if (isCareStaff && careStaffLocation.value) {
    bookingForm.elements.departureCountry.value = isInternationalStaff ? 'International' : 'Local (Kenyan)';
  }
};
const stayTypeSelect = bookingForm.elements.stayType;
const rateField = bookingForm.querySelector('[data-short-stay]');
const mouFields = bookingForm.querySelectorAll('[data-long-stay]');

arrivalDateInput.min = today;
departureDateInput.min = today;
arrivalDateInput.addEventListener('change', () => {
  departureDateInput.min = arrivalDateInput.value || today;
  if (departureDateInput.value && departureDateInput.value <= arrivalDateInput.value) {
    departureDateInput.value = '';
  }
});
departureDateInput.addEventListener('change', () => {
  if (stayTypeSelect.value === 'Short Stay' && arrivalDateInput.value && departureDateInput.value) {
    const nights = Math.ceil((new Date(departureDateInput.value) - new Date(arrivalDateInput.value)) / 86400000);
    if (nights > 21) message('Short Stay is limited to 21 nights. Select Long Stay (MOU-based) for a longer visit.', true);
  }
});
bookingForm.elements.contractType.addEventListener('change', updateCareStaffFields);
careStaffLocation.addEventListener('change', updateCareStaffFields);
updateCareStaffFields();

const setStayType = async () => {
  const longStay = stayTypeSelect.value === 'Long Stay';
  rateField.classList.toggle('hidden', longStay);
  bookingForm.elements.rateId.required = !longStay;
  bookingForm.elements.rateId.disabled = longStay || !bookingForm.elements.campId.value;
  mouFields.forEach((field) => field.classList.toggle('hidden', !longStay));
  bookingForm.elements.mouId.disabled = !longStay;
  bookingForm.elements.mouId.required = longStay;
  bookingForm.elements.mouRate.value = '';
  if (longStay && bookingForm.elements.mouId.options.length <= 1) {
    const response = await listPublicMous({ status: 'active' });
    const mous = response.data || [];
    bookingForm.elements.mouId.innerHTML = mous.length
      ? `<option value="">Choose an active MOU</option>${mous.map((mou) => `<option value="${mou._id}" data-rate="${mou.rateCurrency} ${Number(mou.rateAmount).toLocaleString()} / ${mou.ratePeriod === 'per_month' ? 'month' : 'year'}">${mou.partyName} (${mou.mouType}) - ${mou.status}</option>`).join('')}`
      : '<option value="">No active MOUs available</option>';
  }
};

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
stayTypeSelect.addEventListener('change', () => setStayType().catch((error) => message(error.message, true)));
bookingForm.elements.mouId.addEventListener('change', () => {
  bookingForm.elements.mouRate.value = bookingForm.elements.mouId.selectedOptions[0]?.dataset.rate || '';
});

bookingForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const values = formData(event.target);
    values.type = 'booking';
    values.driverPickup = event.target.elements.driverPickup.checked;
    if (values.stayType === 'Short Stay' && values.arrivalDate && values.departureDate) {
      const nights = Math.ceil((new Date(values.departureDate) - new Date(values.arrivalDate)) / 86400000);
      if (nights > 21) throw new Error('Short Stay cannot exceed 21 nights. Select Long Stay (MOU-based).');
    }
    await submitPublicBookingRequest(values);
    event.target.reset();
    bookingForm.elements.rateId.disabled = true;
    message('Your booking request has been submitted. The accommodation team will review it and contact you by email.');
  } catch (error) {
    message(error.message, true);
  }
});

loadCamps().then(setStayType).catch((error) => message(error.message, true));
window.addEventListener('load', refreshIcons, { once: true });
