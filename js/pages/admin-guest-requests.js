import { api } from '../api/client.js';
import { requireAuth } from '../auth/session.js';
import { initAdminShell } from '../components/shell.js';
import { closeModal, confirmDialog, initModals, openModal } from '../components/modal.js';
import { deleteStaffGuestRequest, listAvailableRoomsForGuestRequest } from '../api/guest.js';

const rows = document.getElementById('request-rows');
const message = document.getElementById('message');
const completeForm = document.getElementById('complete-booking-form');
const roomSelect = document.getElementById('available-room');
const roomMessage = document.getElementById('room-availability-message');
const completeButton = document.getElementById('complete-booking-submit');
const summary = document.getElementById('complete-booking-summary');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-GB') : '—';
const guestName = (guest) => `${guest?.firstName || ''} ${guest?.lastName || ''}`.trim() || guest?.email || 'Guest';
const requestsById = new Map();
let selectedRequest = null;

const showMessage = (text, error = false) => {
  message.textContent = text;
  message.style.background = error ? '#fee2e2' : '#eef6ff';
};

async function loadRequests() {
  const response = await api.get('/guest/staff/requests');
  const requests = response.data || [];
  requestsById.clear();
  requests.forEach((request) => requestsById.set(request._id, request));
  rows.innerHTML = requests.map((request) => `<tr><td>${escapeHtml(guestName(request.guest))}</td><td>${escapeHtml(request.type)}</td><td>${escapeHtml(request.camp?.name || '—')}</td><td>${escapeHtml(request.stayType || '—')}</td><td>${escapeHtml(`${formatDate(request.arrivalDate)} - ${formatDate(request.departureDate)}`)}</td><td>${escapeHtml(request.status)}</td><td>${request.status === 'pending' && request.type === 'booking' ? `<button class="btn btn-primary btn-sm" data-approve="${escapeHtml(request._id)}">Complete booking</button> ` : ''}<button class="btn btn-danger btn-sm" data-delete="${escapeHtml(request._id)}">Delete</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty-state">No guest requests found.</td></tr>';
}

async function openCompletionDialog(request) {
  selectedRequest = request;
  summary.textContent = `${guestName(request.guest)} — ${request.camp?.name || 'Camp'}; ${request.stayType}; ${formatDate(request.arrivalDate)} to ${formatDate(request.departureDate)}.`;
  roomSelect.innerHTML = '<option value="">Select an available room</option>';
  roomSelect.disabled = true;
  completeButton.disabled = true;
  roomMessage.textContent = 'Loading available rooms…';
  openModal('complete-booking');

  try {
    const response = await listAvailableRoomsForGuestRequest({
      campId: request.camp?._id || request.camp,
      arrivalDate: request.arrivalDate,
      departureDate: request.departureDate,
    });
    const rooms = response.data || [];
    roomSelect.innerHTML = [
      '<option value="">Select an available room</option>',
      ...rooms.map((room) => `<option value="${escapeHtml(room._id)}">${escapeHtml(`Block ${room.blockName} - Room ${room.roomNumber}`)}</option>`),
    ].join('');
    roomSelect.disabled = false;
    roomMessage.textContent = rooms.length
      ? `${rooms.length} available room${rooms.length === 1 ? '' : 's'} for this stay.`
      : 'No rooms are currently available for the requested dates.';
  } catch (error) {
    roomMessage.textContent = error.message;
    throw error;
  }
}

rows.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-approve]');
  const deleteButton = event.target.closest('[data-delete]');
  if (!button && !deleteButton) return;
  if (deleteButton) {
    const confirmed = await confirmDialog({
      title: 'Delete guest request?',
      message: 'This will permanently delete the selected guest request.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    deleteButton.disabled = true;
    try {
      await deleteStaffGuestRequest(deleteButton.dataset.delete);
      showMessage('Guest request deleted.');
      await loadRequests();
    } catch (error) {
      deleteButton.disabled = false;
      showMessage(error.message, true);
    }
    return;
  }
  const request = requestsById.get(button.dataset.approve);
  if (!request) return;
  button.disabled = true;
  try {
    await openCompletionDialog(request);
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    button.disabled = false;
  }
});

roomSelect.addEventListener('change', () => {
  completeButton.disabled = !roomSelect.value;
});

completeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedRequest || !roomSelect.value) return;
  completeButton.disabled = true;
  try {
    await api.post(`/guest/staff/requests/${selectedRequest._id}/resolve`, {
      action: 'approve',
      roomId: roomSelect.value,
    });
    closeModal('complete-booking');
    showMessage('Booking confirmed, room assigned, and confirmation email sent to the guest.');
    await loadRequests();
  } catch (error) {
    completeButton.disabled = !roomSelect.value;
    showMessage(error.message, true);
  }
});

const user = requireAuth();
if (user) {
  initAdminShell();
  initModals();
  loadRequests().catch((error) => showMessage(error.message, true));
}
