import {
  listGuestCamps,
  listGuestCampRates,
  listPublicMous,
  submitPublicBookingRequest,
  guestRegister,
  guestLogin,
  guestRequestReset,
  guestResetPassword,
  getGuestPushPublicKey,
  saveGuestPushSubscription,
  removeGuestPushSubscription,
} from '../api/guest.js';
import { getGuestToken, setGuestSession, clearGuestSession } from '../auth/guest-session.js';
import { getMouCategoryForContractType, getMouCategoryLabel } from '../utils/booking-location.js';
import { getBookingLocationState } from '../utils/booking-location.js';

const $ = (selector) => document.querySelector(selector);
const formData = (form) => Object.fromEntries(new FormData(form).entries());
const message = (text, error = false) => {
  $('#message').textContent = text;
  $('#message').style.background = error ? '#fee2e2' : '#eef6ff';
};
const refreshIcons = () => window.lucide?.createIcons();
const accountForm = $('#guest-notification-account');
const pushButton = $('#enable-push-button');
const signOutButton = $('#guest-sign-out-button');
const pushMessage = $('#push-message');
const passwordResetForm = $('#guest-password-reset-form');
const resetRequestButton = $('#guest-reset-request-button');
const bookingForm = $('#booking-form');
const arrivalDateInput = bookingForm.elements.arrivalDate;
const departureDateInput = bookingForm.elements.departureDate;
const today = new Date().toISOString().slice(0, 10);
const careStaffLocation = bookingForm.elements.careStaffLocation;
const internationalCountry = bookingForm.elements.internationalCountry;
const careStaffLocationGroup = bookingForm.querySelector('[data-care-staff-location]');
const updateCareStaffFields = () => {
  const state = getBookingLocationState({
    contractType: bookingForm.elements.contractType.value,
    careStaffLocation: careStaffLocation.value,
    departureCountry: bookingForm.elements.departureCountry.value,
  });
  careStaffLocationGroup.hidden = !state.isCareStaff;
  careStaffLocationGroup.classList.toggle('is-hidden', !state.isCareStaff);
  careStaffLocation.required = state.isCareStaff;
  if (!state.isCareStaff) careStaffLocation.value = '';
  const office = bookingForm.elements.kenyaOffice;
  const officeGroup = office.closest('.form-field, .form-group') || office;
  officeGroup.hidden = !state.showKenyaOffice;
  officeGroup.classList.toggle('is-hidden', !state.showKenyaOffice);
  office.required = state.showKenyaOffice;
  if (!state.showKenyaOffice) office.value = '';
  const countryGroup = internationalCountry.closest('.form-field, .form-group') || internationalCountry;
  countryGroup.hidden = !state.showInternationalCountry;
  countryGroup.classList.toggle('is-hidden', !state.showInternationalCountry);
  internationalCountry.required = state.showInternationalCountry;
  if (!state.showInternationalCountry) internationalCountry.value = '';
  if (state.isCareStaff && careStaffLocation.value) {
    bookingForm.elements.departureCountry.value = state.isInternationalStaff ? 'International' : 'Local (Kenyan)';
  }
};
const stayTypeSelect = bookingForm.elements.stayType;
const rateField = bookingForm.querySelector('[data-short-stay]');
const mouFields = bookingForm.querySelectorAll('[data-long-stay]');
let mouLoadVersion = 0;

const setAccountMode = (mode) => {
  const registration = mode === 'register';
  accountForm.querySelectorAll('[data-account-registration]').forEach((field) => {
    field.hidden = !registration;
    const input = field.querySelector('input');
    input.required = registration && input.name !== 'phone';
    if (!registration) input.value = '';
  });
};

accountForm.querySelector('#guest-login-button').addEventListener('click', () => setAccountMode('login'));
accountForm.querySelector('#guest-register-button').addEventListener('click', () => setAccountMode('register'));
accountForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!accountForm.reportValidity()) return;
  const values = formData(accountForm);
  const mode = event.submitter?.value || 'register';
  delete values.accountMode;
  try {
    const response = mode === 'login' ? await guestLogin(values) : await guestRegister(values);
    const session = response.data || {};
    setGuestSession(session.token, session.guest);
    accountForm.hidden = true;
    accountForm.classList.add('hidden');
    pushButton.classList.remove('hidden');
    signOutButton.classList.remove('hidden');
    pushMessage.hidden = false;
    pushMessage.textContent = `Signed in as ${session.guest?.email || values.email}. Enable notifications on this device.`;
  } catch (error) {
    pushMessage.hidden = false;
    pushMessage.textContent = error.message || 'Unable to sign in or create an account.';
  }
});

resetRequestButton.addEventListener('click', async () => {
  const email = accountForm.elements.email;
  if (!email.checkValidity()) {
    email.reportValidity();
    return;
  }
  try {
    await guestRequestReset(email.value.trim());
    pushMessage.hidden = false;
    pushMessage.textContent = 'If an account exists, a password reset link has been sent to that email.';
  } catch (error) {
    pushMessage.hidden = false;
    pushMessage.textContent = error.message || 'Unable to request a password reset.';
  }
});

passwordResetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!passwordResetForm.reportValidity()) return;
  const resetToken = new URLSearchParams(window.location.search).get('resetToken');
  if (!resetToken) {
    pushMessage.hidden = false;
    pushMessage.textContent = 'The password reset link is missing or invalid.';
    return;
  }
  try {
    const response = await guestResetPassword(resetToken, passwordResetForm.elements.newPassword.value);
    const session = response.data || {};
    setGuestSession(session.token, session.guest);
    passwordResetForm.hidden = true;
    accountForm.hidden = true;
    accountForm.classList.add('hidden');
    pushButton.classList.remove('hidden');
    signOutButton.classList.remove('hidden');
    pushMessage.hidden = false;
    pushMessage.textContent = 'Password reset. You are signed in; enable booking notifications on this device.';
    window.history.replaceState({}, '', window.location.pathname);
  } catch (error) {
    pushMessage.hidden = false;
    pushMessage.textContent = error.message || 'Unable to reset your password.';
  }
});

const decodePushKey = (value) => {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
};

pushButton.addEventListener('click', async () => {
  pushButton.disabled = true;
  pushMessage.hidden = false;
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      throw new Error('Push notifications are not supported by this browser.');
    }
    const keyResponse = await getGuestPushPublicKey();
    const publicKey = keyResponse.data?.publicKey;
    if (!publicKey) throw new Error('Push notifications are not configured yet. Please contact the accommodation team.');
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Allow notifications in your browser to receive booking updates.');
    const subscription = await registration.pushManager.getSubscription()
      || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodePushKey(publicKey),
      });
    await saveGuestPushSubscription(subscription.toJSON());
    pushMessage.textContent = 'Booking check-in and check-out notifications are enabled on this device.';
  } catch (error) {
    pushMessage.textContent = error.message || 'Unable to enable booking notifications.';
  } finally {
    pushButton.disabled = false;
  }
});

signOutButton.addEventListener('click', async () => {
  let subscriptionCleanupError = null;
  try {
    const registration = 'serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistration('/')
      : null;
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      try {
        await removeGuestPushSubscription(subscription.endpoint);
      } catch (error) {
        subscriptionCleanupError = error;
      }
      await subscription.unsubscribe();
    }
  } catch (error) {
    subscriptionCleanupError = error;
  }
  clearGuestSession();
  accountForm.reset();
  accountForm.hidden = false;
  accountForm.classList.remove('hidden');
  setAccountMode('register');
  pushButton.classList.add('hidden');
  signOutButton.classList.add('hidden');
  pushMessage.hidden = false;
  pushMessage.textContent = subscriptionCleanupError
    ? `Signed out, but this device's push subscription could not be removed: ${subscriptionCleanupError.message}`
    : 'Signed out and notifications disabled on this device.';
});

if (getGuestToken()) {
  accountForm.hidden = true;
  accountForm.classList.add('hidden');
  pushButton.classList.remove('hidden');
  signOutButton.classList.remove('hidden');
}
if (new URLSearchParams(window.location.search).has('resetToken')) {
  accountForm.hidden = true;
  accountForm.classList.add('hidden');
  passwordResetForm.hidden = false;
  pushMessage.hidden = false;
  pushMessage.textContent = 'Choose a new password to finish signing in.';
}

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
    if (nights > 21) message('Short Stay is limited to 21 nights. Select Long Stay for a longer visit.', true);
  }
});
bookingForm.elements.contractType.addEventListener('change', updateCareStaffFields);
careStaffLocation.addEventListener('change', updateCareStaffFields);
bookingForm.elements.departureCountry.addEventListener('change', updateCareStaffFields);
updateCareStaffFields();

const setStayType = async () => {
  const longStay = stayTypeSelect.value === 'Long Stay';
  const isCareStaff = /^(?:care\s*)?staff$/i.test(String(bookingForm.elements.contractType.value || '').trim());
  const hideRate = longStay || isCareStaff;
  rateField.hidden = hideRate;
  rateField.classList.toggle('hidden', hideRate);
  bookingForm.elements.rateId.required = !hideRate;
  bookingForm.elements.rateId.disabled = hideRate || !bookingForm.elements.campId.value;
  if (isCareStaff) bookingForm.elements.rateId.value = '';
  mouFields.forEach((field) => {
    field.hidden = !longStay || isCareStaff;
    field.classList.toggle('hidden', !longStay || isCareStaff);
  });
  bookingForm.elements.mouId.disabled = !longStay || isCareStaff;
  bookingForm.elements.mouId.required = false;
  bookingForm.elements.mouRate.value = '';
  if (!longStay || isCareStaff) {
    bookingForm.elements.mouId.value = '';
    return;
  }
  const category = getMouCategoryForContractType(bookingForm.elements.contractType.value);
  const selectedMouId = bookingForm.elements.mouId.value;
  const loadVersion = ++mouLoadVersion;
  if (!category) {
    bookingForm.elements.mouId.innerHTML = '<option value="">Select an eligible contract type first</option>';
    bookingForm.elements.mouId.disabled = true;
    return;
  }
  try {
    const response = await listPublicMous({ status: 'active', counterpartyCategory: category });
    if (loadVersion !== mouLoadVersion) return;
    const mous = response.data || [];
    bookingForm.elements.mouId.innerHTML = mous.length
      ? `<option value="">Optional ${getMouCategoryLabel(category)} MOU</option>${mous.map((mou) => `<option value="${mou._id}">${mou.partyName}</option>`).join('')}`
      : '<option value="">No eligible active MOUs available</option>';
    bookingForm.elements.mouId.value = selectedMouId;
  } catch (error) {
    bookingForm.elements.mouId.innerHTML = '<option value="">Unable to load eligible MOUs</option>';
    throw error;
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
      ? `<option value="">Choose room rate</option>${rates.map((rate) => `<option value="${rate._id}" data-stay-type="${rate.stayType}">${rate.stayType} - ${rate.currency} ${Number(rate.amount).toLocaleString()} per ${rate.stayType === 'Long Stay' ? 'month' : 'night'}</option>`).join('')}`
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
bookingForm.elements.contractType.addEventListener('change', () => setStayType().catch((error) => message(error.message, true)));
bookingForm.elements.mouId.addEventListener('change', () => {
  bookingForm.elements.mouRate.value = bookingForm.elements.mouId.selectedOptions[0]?.dataset.rate || '';
});

bookingForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!bookingForm.checkValidity()) {
    bookingForm.reportValidity();
    return;
  }
  try {
    const values = formData(event.target);
    values.type = 'booking';
    values.driverPickup = event.target.elements.driverPickup.checked;
    if (values.stayType === 'Short Stay' && values.arrivalDate && values.departureDate) {
      const nights = Math.ceil((new Date(values.departureDate) - new Date(values.arrivalDate)) / 86400000);
      if (nights > 21) throw new Error('Short Stay cannot exceed 21 nights. Select Long Stay.');
    }
    await submitPublicBookingRequest(values);
    event.target.reset();
    updateCareStaffFields();
    bookingForm.elements.rateId.disabled = true;
    message('Your booking request has been submitted. The accommodation team will review it and contact you by email.');
  } catch (error) {
    message(error.message, true);
  }
});

loadCamps().then(setStayType).catch((error) => message(error.message, true));
window.addEventListener('load', refreshIcons, { once: true });
