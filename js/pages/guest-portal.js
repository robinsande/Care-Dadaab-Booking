import {
  guestRegister, guestLogin, guestRequestReset, guestResetPassword,
  listGuestCamps, listGuestCampRates, listGuestBookings, listGuestRequests,
  submitBookingRequest, submitBookingAdjustment,
  updateGuestProfile,
} from '../api/guest.js';
import { clearGuestSession, getGuest, getGuestToken, setGuestSession } from '../auth/guest-session.js';

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const formData = (form) => Object.fromEntries(new FormData(form).entries());
const message = (text, error = false) => {
  $('#message').textContent = text;
  $('#message').style.background = error ? '#fee2e2' : '#eef6ff';
};
const refreshIcons = () => window.lucide?.createIcons();
const bookingForm = $('#booking-form');
const profileForm = $('#profile-form');
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

async function loadPortal() {
  $('#auth-section').classList.add('hidden');
  $('#portal-section').classList.remove('hidden');
  $('#sign-out').classList.remove('hidden');
  const guest = getGuest();
  ['firstName', 'lastName', 'phone', 'organisation', 'gender', 'contractType', 'departureCountry', 'kenyaOffice', 'internationalCountry'].forEach((field) => {
    if (guest?.[field]) {
      if (profileForm.elements[field]) profileForm.elements[field].value = guest[field];
      if (bookingForm.elements[field]) bookingForm.elements[field].value = guest[field];
    }
  });
  const camps = await listGuestCamps();
  (camps.data || []).forEach((camp) => {
    const option = document.createElement('option');
    option.value = camp._id;
    option.textContent = camp.name;
    $('#booking-form [name="campId"]').appendChild(option);
  });
  bookingForm.elements.campId.addEventListener('change', async () => {
    const rateSelect = bookingForm.elements.rateId;
    rateSelect.innerHTML = '<option value="">Loading rates…</option>';
    rateSelect.disabled = true;
    try {
      const response = await listGuestCampRates(bookingForm.elements.campId.value);
      const rates = response.data || [];
      rateSelect.innerHTML = rates.length
        ? `<option value="">Choose room rate</option>${rates.map((rate) => `<option value="${rate._id}" data-stay-type="${rate.stayType}">${rate.stayType} - ${rate.currency} ${Number(rate.amount).toLocaleString()} per night</option>`).join('')}`
        : '<option value="">No rates configured for this camp</option>';
      rateSelect.disabled = !rates.length;
    } catch (error) {
      rateSelect.innerHTML = '<option value="">Unable to load rates</option>';
      message(error.message, true);
    }
  }, { once: true });
  bookingForm.elements.rateId.addEventListener('change', () => {
    bookingForm.elements.stayType.value = bookingForm.elements.rateId.selectedOptions[0]?.dataset.stayType || '';
  });
  await refreshLists();
}

async function refreshLists() {
  const [bookings, requests] = await Promise.all([listGuestBookings(), listGuestRequests()]);
  const bookingRows = (bookings.data || []).map((booking) => `
    <tr><td>${esc(booking.bookingReference)}</td><td>${esc(booking.campName || booking.camp?.name)}</td>
    <td>${esc(booking.arrivalDate?.slice(0, 10))} → ${esc(booking.departureDate?.slice(0, 10))}</td>
    <td>${esc(booking.status)}</td><td><button class="btn btn-secondary btn-sm" data-adjust="${booking._id}">Request adjustment</button>
    <button class="btn btn-secondary btn-sm" data-extend="${booking._id}">Request extension</button>
    ${booking.status === 'Checked In' ? `<button class="btn btn-secondary btn-sm" data-checkout="${booking._id}">Request early checkout</button>` : ''}</td></tr>
  `).join('');
  $('#bookings').innerHTML = bookingRows
    ? `<table><thead><tr><th>Reference</th><th>Camp</th><th>Dates</th><th>Status</th><th>Actions</th></tr></thead><tbody>${bookingRows}</tbody></table>`
    : '<p>No bookings yet.</p>';
  $('#requests').innerHTML = (requests.data || []).map((request) =>
    `<div class="request-row"><strong>${esc(request.type)}</strong> — ${esc(request.status)}${request.reason ? `: ${esc(request.reason)}` : ''}</div>`
  ).join('') || '<p>No requests yet.</p>';
  refreshIcons();
}

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const result = await guestLogin(formData(event.target));
    setGuestSession(result.data.token, result.data.guest);
    await loadPortal();
  } catch (error) { message(error.message, true); }
});
$('#register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const result = await guestRegister(formData(event.target));
    setGuestSession(result.data.token, result.data.guest);
    await loadPortal();
  } catch (error) { message(error.message, true); }
});
profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const result = await updateGuestProfile(formData(event.target));
    setGuestSession(getGuestToken(), result.data);
    message('Profile saved.');
  } catch (error) { message(error.message, true); }
});
$('#booking-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const values = formData(event.target);
    values.type = 'booking';
    values.driverPickup = event.target.elements.driverPickup.checked;
    await submitBookingRequest(values);
    event.target.reset();
    message('Booking request submitted. Staff will assign a room and email you an update.');
    await refreshLists();
  } catch (error) { message(error.message, true); }
});
$('#forgot-password').addEventListener('click', () => {
  $('#reset-form').classList.toggle('hidden');
});
$('#reset-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await guestRequestReset(formData(event.target).email);
    message('If an account exists, a recovery link has been sent.');
  } catch (error) { message(error.message, true); }
});
$('#show-register').addEventListener('click', () => $('#register-form').classList.toggle('hidden'));
$('#sign-out').addEventListener('click', () => { clearGuestSession(); window.location.reload(); });
$('#bookings').addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  try {
    if (button.dataset.adjust) {
      const remarks = window.prompt('What should staff adjust?');
      if (remarks) await submitBookingAdjustment(button.dataset.adjust, { type: 'adjustment', remarks, reason: remarks });
    } else if (button.dataset.extend) {
      const newDepartureDate = window.prompt('New departure date (YYYY-MM-DD):');
      if (newDepartureDate) await submitBookingAdjustment(button.dataset.extend, { type: 'extension', newDepartureDate, reason: 'Guest requested extension' });
    } else if (button.dataset.checkout) {
      const reason = window.prompt('Reason for early checkout:');
      if (reason) await submitBookingAdjustment(button.dataset.checkout, { type: 'early_checkout', reason });
    }
    message('Request submitted for staff review.');
    await refreshLists();
  } catch (error) { message(error.message, true); }
});

const resetToken = new URLSearchParams(window.location.search).get('resetToken');
if (resetToken) {
  const password = window.prompt('Enter a new password (at least 8 characters):');
  if (password) guestResetPassword(resetToken, password).then((result) => {
    setGuestSession(result.data.token, result.data.guest);
    return loadPortal();
  }).catch((error) => message(error.message, true));
} else if (getGuestToken() && getGuest()) {
  loadPortal().catch((error) => message(error.message, true));
}

window.addEventListener('load', refreshIcons, { once: true });
