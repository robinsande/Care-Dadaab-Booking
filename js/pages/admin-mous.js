import { api } from '../api/client.js';
import { requireAuth } from '../auth/session.js';
import { initAdminShell } from '../components/shell.js';

const form = document.getElementById('mou-form');
const rows = document.getElementById('mou-rows');
const paymentPanel = document.getElementById('payment-panel');
const paymentRows = document.getElementById('payment-rows');
const message = (text, error = false) => {
  const element = document.getElementById('message');
  element.textContent = text;
  element.style.background = error ? '#fee2e2' : '#eef6ff';
};
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
let selectedMouId = null;

async function loadPayments(mouId) {
  selectedMouId = mouId;
  const response = await api.get(`/mous/${mouId}/payments`);
  const payments = response.data || [];
  paymentPanel.hidden = false;
  document.getElementById('payment-title').textContent = 'Payment schedule';
  paymentRows.innerHTML = payments.map((payment) => `<tr><td>${escapeHtml(payment.periodLabel)}</td><td>${escapeHtml(String(payment.dueDate).slice(0, 10))}</td><td>${Number(payment.amountDue).toLocaleString()}</td><td>${Number(payment.amountPaid || 0).toLocaleString()}</td><td>${escapeHtml(payment.status)}</td><td>${payment.status === 'paid' ? 'Paid' : `<button class="btn btn-secondary btn-sm" data-payment="${payment._id}">Mark paid</button>`}</td></tr>`).join('') || '<tr><td colspan="6">No payment rows.</td></tr>';
}

async function loadMous() {
  const response = await api.get('/mous');
  const mous = response.data || [];
  rows.innerHTML = mous.map((mou) => `<tr><td>${escapeHtml(mou.partyName)}</td><td>${escapeHtml(mou.mouType)}</td><td>${escapeHtml(String(mou.startDate).slice(0, 10))} - ${escapeHtml(String(mou.endDate).slice(0, 10))}</td><td>${escapeHtml(mou.rateCurrency)} ${Number(mou.rateAmount).toLocaleString()} / ${mou.ratePeriod === 'per_month' ? 'month' : 'year'}</td><td>${escapeHtml(mou.status)}</td><td><button class="btn btn-secondary btn-sm" data-mou="${mou._id}">View payments</button></td></tr>`).join('') || '<tr><td colspan="6">No MOUs found.</td></tr>';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api.post('/mous', Object.fromEntries(new FormData(form)));
    form.reset();
    message('MOU created and payment schedule generated.');
    await loadMous();
  } catch (error) { message(error.message, true); }
});

rows.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-mou]');
  if (!button) return;
  try {
    await loadPayments(button.dataset.mou);
  } catch (error) { message(error.message, true); }
});

paymentRows.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-payment]');
  if (!button) return;
  try {
    await api.patch(`/mous/payments/${button.dataset.payment}`, { amountPaid: Number(button.closest('tr').children[2].textContent.replace(/,/g, '')), paidDate: new Date().toISOString(), status: 'paid' });
    message('Payment marked as paid.');
    await loadPayments(selectedMouId);
  } catch (error) { message(error.message, true); }
});

const user = requireAuth({ superAdmin: true });
if (user) { initAdminShell(); loadMous().catch((error) => message(error.message, true)); }
