import { api } from '../../api/client.js';
import { downloadReportExport } from '../../api/reports.js';
import { showToast } from '../../components/toast.js';

let initialized = false;
let selectedMouId = null;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const showMessage = (text, error = false) => {
  const element = document.getElementById('spa-mou-message');
  element.textContent = text;
  element.style.background = error ? '#fee2e2' : '#eef6ff';
};

async function loadPayments(mouId) {
  selectedMouId = mouId;
  const response = await api.get(`/mous/${mouId}/payments`);
  const payments = response.data || [];
  document.getElementById('spa-mou-payments').hidden = false;
  document.getElementById('spa-mou-payment-title').textContent = 'Payment schedule';
  document.getElementById('spa-mou-payment-rows').innerHTML = payments.map((payment) => `<tr><td>${escapeHtml(payment.periodLabel)}</td><td>${escapeHtml(String(payment.dueDate).slice(0, 10))}</td><td>${Number(payment.amountDue).toLocaleString()}</td><td>${Number(payment.amountPaid || 0).toLocaleString()}</td><td>${escapeHtml(payment.status)}</td><td>${payment.status === 'paid' ? 'Paid' : `<button class="btn btn-secondary btn-sm" data-spa-payment="${payment._id}">Mark paid</button>`}</td></tr>`).join('') || '<tr><td colspan="6">No payment rows.</td></tr>';
}

async function loadMous() {
  const response = await api.get('/mous');
  const mous = response.data || [];
  document.getElementById('spa-mou-rows').innerHTML = mous.map((mou) => `<tr><td>${escapeHtml(mou.partyName)}</td><td>${escapeHtml(mou.mouType)}</td><td>${escapeHtml(String(mou.startDate).slice(0, 10))} - ${escapeHtml(String(mou.endDate).slice(0, 10))}</td><td>${escapeHtml(mou.rateCurrency)} ${Number(mou.rateAmount).toLocaleString()} / ${mou.ratePeriod === 'per_month' ? 'month' : 'year'}</td><td>${escapeHtml(mou.status)}</td><td><button class="btn btn-secondary btn-sm" data-spa-mou="${mou._id}">View payments</button></td></tr>`).join('') || '<tr><td colspan="6">No MOUs found.</td></tr>';
}

export async function init() {
  if (initialized) return;
  initialized = true;
  const form = document.getElementById('spa-mou-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await api.post('/mous', Object.fromEntries(new FormData(form))); form.reset(); form.elements.rateAmount.value = '6000'; showMessage('MOU created and payment schedule generated.'); await loadMous(); } catch (error) { showMessage(error.message, true); }
  });
  document.getElementById('spa-mou-rows').addEventListener('click', (event) => { const button = event.target.closest('[data-spa-mou]'); if (button) loadPayments(button.dataset.spaMou).catch((error) => showMessage(error.message, true)); });
  document.getElementById('spa-mou-payment-rows').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-spa-payment]');
    if (!button) return;
    try { const amount = Number(button.closest('tr').children[2].textContent.replace(/,/g, '')); await api.patch(`/mous/payments/${button.dataset.spaPayment}`, { amountPaid: amount, paidDate: new Date().toISOString(), status: 'paid' }); showMessage('Payment marked as paid.'); await loadPayments(selectedMouId); } catch (error) { showMessage(error.message, true); }
  });
  document.getElementById('spa-mou-monthly-export').addEventListener('click', () => downloadReportExport('mou-monthly', 'excel').then(() => showToast('Monthly MOU report exported.', 'success')).catch((error) => showMessage(error.message, true)));
  document.getElementById('spa-mou-annual-export').addEventListener('click', () => downloadReportExport('mou-annual', 'excel').then(() => showToast('Annual MOU report exported.', 'success')).catch((error) => showMessage(error.message, true)));
  await loadMous();
}

export async function refresh() { if (initialized) await loadMous(); }