import { getCurrentParams } from '../spa-main.js';
import { openInvoiceDetailModal } from '../invoice-actions.js';
import {
  listInvoices,
  updateInvoicePaymentStatus,
  initiateInvoiceStkPush,
  confirmMpesaInvoicePayment,
  confirmMpesaInvoiceScreenshot,
  resendInvoiceReceiptEmail,
} from '../../api/invoices.js';
import { ApiError } from '../../api/client.js';
import { withLoading } from '../../components/loading.js';
import { showToast } from '../../components/toast.js';
import { renderPagination } from '../../components/pagination.js';
import { confirmDialog, openModal } from '../../components/modal.js';
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
    const resendReceiptButton = e.target.closest('[data-resend-receipt]');
    if (resendReceiptButton) {
      handleReceiptEmailResend(resendReceiptButton);
      return;
    }
    const mpesaButton = e.target.closest('[data-mpesa-action]');
    if (mpesaButton) {
      openMpesaConfirmation(mpesaButton);
      return;
    }
    if (e.target.closest('[data-stk-action]')) {
      handleStkPush(e.target.closest('[data-stk-action]'));
      return;
    }
    if (e.target.closest('[data-payment-action]')) {
      handlePaymentChange(e.target);
      return;
    }
    if (e.target.closest('.action-dropdown')) return;
    const row = e.target.closest('[data-invoice-id]');
    if (row) openInvoiceDetailModal(row.dataset.invoiceId);
  });
  document.getElementById('mpesa-confirmation-form')?.addEventListener('submit', handleMpesaConfirmation);
  document.getElementById('mpesa-screenshot-upload')?.addEventListener('click', handleMpesaScreenshotUpload);
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
        <td>${paid ? `Paid
          ${invoiceEmailStatus(inv).toLowerCase() !== 'sent' ? `<details class="action-dropdown">
            <summary class="btn btn-secondary btn-sm action-dropdown-trigger">Actions</summary>
            <div class="action-dropdown-menu">
              <button type="button" class="action-dropdown-item" data-resend-receipt data-invoice-id="${escapeHtml(id)}">Resend receipt email</button>
            </div>
          </details>` : ''}
        ` : `
          <details class="action-dropdown">
            <summary class="btn btn-secondary btn-sm action-dropdown-trigger">Actions</summary>
            <div class="action-dropdown-menu">
              <button type="button" class="action-dropdown-item" data-payment-action data-invoice-id="${escapeHtml(id)}">Record cash</button>
              <button type="button" class="action-dropdown-item" data-mpesa-action data-invoice-id="${escapeHtml(id)}">Confirm M-Pesa</button>
              <button type="button" class="action-dropdown-item" data-stk-action data-invoice-id="${escapeHtml(id)}">Request payment</button>
            </div>
          </details>
        `}</td>
      </tr>
    `;
  }).join('');
}

function openMpesaConfirmation(button) {
  const form = document.getElementById('mpesa-confirmation-form');
  if (!form) return;
  form.reset();
  form.elements.invoiceId.value = button.dataset.invoiceId;
  openModal('mpesa-confirmation');
}

async function handleMpesaConfirmation(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await confirmMpesaInvoicePayment(
      form.elements.invoiceId.value,
      form.elements.message.value,
      form.elements.confirmed.checked,
    );
    document.querySelector('[data-close-modal="mpesa-confirmation"]')?.click();
    showToast('M-Pesa payment confirmed and invoice marked as paid.', 'success');
    await loadInvoices();
  } catch (error) {
    showToast(error instanceof ApiError ? error.message : 'Unable to confirm M-Pesa payment.', 'error');
  } finally {
    submit.disabled = false;
  }
}

async function handleMpesaScreenshotUpload(event) {
  const form = document.getElementById('mpesa-confirmation-form');
  const screenshot = form?.elements.screenshot.files[0];
  if (!screenshot) {
    form?.elements.screenshot.reportValidity();
    return;
  }
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await confirmMpesaInvoiceScreenshot(form.elements.invoiceId.value, screenshot);
    document.querySelector('[data-close-modal="mpesa-confirmation"]')?.click();
    showToast('M-Pesa screenshot verified and invoice marked as paid.', 'success');
    await loadInvoices();
  } catch (error) {
    showToast(error instanceof ApiError ? error.message : 'Unable to verify the M-Pesa screenshot.', 'error');
  } finally {
    button.disabled = false;
  }
}

async function handleReceiptEmailResend(button) {
  button.disabled = true;
  try {
    const response = await resendInvoiceReceiptEmail(button.dataset.invoiceId);
    if (response.data?.emailStatus === 'sent') {
      showToast('Payment receipt emailed to the guest.', 'success');
    } else {
      showToast('Receipt email is still pending. Check the email configuration and retry.', 'error');
    }
    await loadInvoices();
  } catch (error) {
    button.disabled = false;
    showToast(error instanceof ApiError ? error.message : 'Unable to resend the receipt email.', 'error');
  }
}

async function handleStkPush(button) {
  const phoneNumber = window.prompt('Enter the guest Kenyan phone number for the M-Pesa prompt:');
  if (!phoneNumber?.trim()) return;
  button.disabled = true;
  try {
    const response = await initiateInvoiceStkPush(button.dataset.invoiceId, phoneNumber.trim());
    showToast(response.data?.customerMessage || 'M-Pesa prompt sent to the guest.', 'success');
  } catch (error) {
    button.disabled = false;
    showToast(error instanceof ApiError ? error.message : 'Unable to send M-Pesa prompt.', 'error');
  }
}

async function handlePaymentChange(button) {
  if (!button.matches('[data-payment-action]')) return;
  const confirmed = await confirmDialog({
    title: 'Confirm cash payment',
    message: 'Confirm that this invoice was paid in cash?',
    confirmLabel: 'Yes, record cash',
  });
  if (!confirmed) return;
  button.disabled = true;
  try {
    await updateInvoicePaymentStatus(button.dataset.invoiceId, 'Paid', 'Cash');
    showToast('Cash payment recorded and invoice marked as paid.', 'success');
    await loadInvoices();
  } catch (error) {
    button.disabled = false;
    showToast(error instanceof ApiError ? error.message : 'Unable to update payment status.', 'error');
  }
}
