import { getCurrentParams } from '../spa-main.js';
import { openInvoiceDetailModal } from '../invoice-actions.js';
import { listInvoices, updateInvoicePaymentStatus } from '../../api/invoices.js';
import { ApiError } from '../../api/client.js';
import { withLoading } from '../../components/loading.js';
import { showToast } from '../../components/toast.js';
import { renderPagination } from '../../components/pagination.js';
import { confirmDialog } from '../../components/modal.js';
import { escapeHtml, formatMoney, fullName, invoiceEmailStatus, emailStatusBadge, paymentStatusBadge } from '../../utils/format.js';

const state = { page: 1, limit: 10, search: '', total: 0, totalPages: 1, invoices: [] };
let initialized = false;

export async function init() {
  if (initialized) return;
  initialized = true;

  const tableBody = document.getElementById('invoices-table-body');
  const filtersForm = document.getElementById('invoices-filters');

  filtersForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    state.search = filtersForm.elements.search?.value?.trim() || '';
    state.page = 1;
    loadInvoices();
  });

  tableBody.addEventListener('click', (e) => {
    if (e.target.closest('[data-payment-action]')) {
      handlePaymentChange(e.target);
      return;
    }
    const row = e.target.closest('[data-invoice-id]');
    if (row) openInvoiceDetailModal(row.dataset.invoiceId);
  });
  tableBody.addEventListener('change', (e) => handlePaymentChange(e.target));
  tableBody.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('[data-invoice-id]');
    if (!row) return;
    e.preventDefault();
    openInvoiceDetailModal(row.dataset.invoiceId);
  });

  const params = getCurrentParams();
  if (params.get('id')) openInvoiceDetailModal(params.get('id'));
  if (params.get('search')) {
    const si = filtersForm?.elements.search;
    if (si) {
      si.value = params.get('search');
      state.search = params.get('search');
    }

  }

  loadInvoices();
}

export async function refresh() {}

async function loadInvoices() {
  const tableBody = document.getElementById('invoices-table-body');
  const paginationEl = document.getElementById('invoices-pagination');
  try {
    const response = await withLoading(
      () => listInvoices({ page: state.page, limit: state.limit, search: state.search }),
      'Loading invoices…',
    );
    const data = response.data || {};
    state.invoices = data.invoices || data.items || data || [];
    if (!Array.isArray(state.invoices)) state.invoices = [];
    state.total = data.total ?? state.invoices.length;
    state.totalPages = data.totalPages ?? Math.max(1, Math.ceil(state.total / state.limit));
    renderTable();
    renderPagination(
      paginationEl,
      { page: state.page, totalPages: state.totalPages, total: state.total, limit: state.limit },
      (page) => {
        state.page = page;
        loadInvoices();
      },
    );
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="8" class="empty-state">Unable to load invoices.</td></tr>`;
    showToast(error instanceof ApiError ? error.message : 'Unable to load invoices.', 'error');
  }
}

function renderTable() {
  const tbody = document.getElementById('invoices-table-body');
  if (!state.invoices.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No invoices found.</td></tr>`;
    return;
  }
  tbody.innerHTML = state.invoices.map((inv) => {
    const id = inv._id || inv.id;
    const guest = inv.guest || inv;
    const currency = inv.appliedRate?.currency || 'KES';
    const emailStatus = invoiceEmailStatus(inv);
    const paid = inv.paymentStatus === 'Paid';
    return `
      <tr class="table-row-clickable" data-invoice-id="${escapeHtml(id)}" tabindex="0" role="button" aria-label="View invoice ${escapeHtml(inv.invoiceNumber || '')}">
        <td><strong>${escapeHtml(inv.invoiceNumber || '—')}</strong></td>
        <td>${escapeHtml(inv.bookingReference || '—')}</td>
        <td>${escapeHtml(fullName(guest))}</td>
        <td>${escapeHtml(inv.campName || '—')}</td>
        <td>${escapeHtml(formatMoney(inv.totalAmount, currency))}</td>
        <td>${paymentStatusBadge(inv.paymentStatus)}</td>
        <td>${emailStatusBadge(emailStatus)}</td>
        <td>${paid ? 'Paid' : `<button type="button" class="btn btn-primary btn-sm" data-payment-action data-invoice-id="${escapeHtml(id)}">Paid</button>`}</td>
      </tr>
    `;
  }).join('');
}

async function handlePaymentChange(button) {
  if (!button.matches('[data-payment-action]')) return;
  const confirmed = await confirmDialog({
    title: 'Confirm payment',
    message: 'Mark this invoice as paid?',
    confirmLabel: 'Yes, mark paid',
  });
  if (!confirmed) return;
  button.disabled = true;
  try {
    await updateInvoicePaymentStatus(button.dataset.invoiceId, 'Paid');
    showToast('Invoice marked as paid.', 'success');
    await loadInvoices();
  } catch (error) {
    button.disabled = false;
    showToast(error instanceof ApiError ? error.message : 'Unable to update payment status.', 'error');
  }
}
