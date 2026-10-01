import { api } from '../api/client.js';
import { requireAuth } from '../auth/session.js';
import { initAdminShell } from '../components/shell.js';
import { confirmDialog } from '../components/modal.js';
import { deleteStaffGuestRequest } from '../api/guest.js';

const rows = document.getElementById('request-rows');
const message = document.getElementById('message');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-GB') : '—';
const guestName = (guest) => `${guest?.firstName || ''} ${guest?.lastName || ''}`.trim() || guest?.email || 'Guest';

const showMessage = (text, error = false) => {
  message.textContent = text;
  message.style.background = error ? '#fee2e2' : '#eef6ff';
};

async function loadRequests() {
  const response = await api.get('/guest/staff/requests');
  const requests = response.data || [];
  rows.innerHTML = requests.map((request) => `<tr><td>${escapeHtml(guestName(request.guest))}</td><td>${escapeHtml(request.type)}</td><td>${escapeHtml(request.camp?.name || '—')}</td><td>${escapeHtml(`${formatDate(request.arrivalDate)} - ${formatDate(request.departureDate)}`)}</td><td>${escapeHtml(request.status)}</td><td>${request.status === 'pending' && request.type === 'booking' ? `<button class="btn btn-primary btn-sm" data-approve="${escapeHtml(request._id)}">Complete booking</button> ` : ''}<button class="btn btn-danger btn-sm" data-delete="${escapeHtml(request._id)}">Delete</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty-state">No guest requests found.</td></tr>';
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
  button.disabled = true;
  try {
    await api.post(`/guest/staff/requests/${button.dataset.approve}/resolve`, { action: 'approve' });
    showMessage('Booking request completed and added to the booking system.');
    await loadRequests();
  } catch (error) {
    button.disabled = false;
    showMessage(error.message, true);
  }
});

const user = requireAuth();
if (user) {
  initAdminShell();
  loadRequests().catch((error) => showMessage(error.message, true));
}
