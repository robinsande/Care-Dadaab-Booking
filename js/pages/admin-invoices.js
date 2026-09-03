import { listInvoices, getInvoice, downloadInvoicePdf } from '../api/invoices.js';
import { ApiError } from '../api/client.js';
import { getBrandLogoDataUrl } from '../config.js';
import { requireAuth } from '../auth/session.js';
import { initAdminShell } from '../components/shell.js';
import { renderInvoiceDocument } from '../components/invoice-document.js';
import { initModals, openModal } from '../components/modal.js';
import { withLoading } from '../components/loading.js';
import { showToast } from '../components/toast.js';
import { renderPagination } from '../components/pagination.js';
import {
  escapeHtml,
  formatMoney,
  fullName,
  invoiceEmailStatus,
  emailStatusBadge,
} from '../utils/format.js';

const INVOICE_MODAL_ID = 'invoice';

function setInvoicePrintMode(active) {
  document.body.classList.toggle('invoice-print-mode', active);
}

function initInvoiceModalPrintMode() {
  const backdrop = document.querySelector(`[data-modal="${INVOICE_MODAL_ID}"]`);
  if (!backdrop || backdrop.dataset.printHook) return;
  backdrop.dataset.printHook = '1';

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest(`[data-close-modal="${INVOICE_MODAL_ID}"]`)) {
      setInvoicePrintMode(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !backdrop.hidden) {
      setInvoicePrintMode(false);
    }
  });
}

const tableBody = document.getElementById('invoices-table-body');
const paginationEl = document.getElementById('invoices-pagination');
const filtersForm = document.getElementById('invoices-filters');
const emailStatusEl = document.getElementById('invoice-email-status');

const state = { page: 1, limit: 10, search: '', total: 0, totalPages: 1, invoices: [] };
let currentInvoiceId = null;

function boot() {
  initInvoiceModalPrintMode();

  filtersForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    state.search = filtersForm.elements.search?.value?.trim() || '';
    state.page = 1;
    loadInvoices();
  });

  tableBody.addEventListener('click', (event) => {
    const row = event.target.closest('[data-invoice-id]');
    if (row) openInvoiceDetail(row.dataset.invoiceId);
  });

  tableBody.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const row = event.target.closest('[data-invoice-id]');
    if (!row) return;
    event.preventDefault();
    openInvoiceDetail(row.dataset.invoiceId);
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get('id')) {
    openInvoiceDetail(params.get('id'));
  }
  if (params.get('search')) {
    const searchInput = filtersForm?.elements.search;
    if (searchInput) {
      searchInput.value = params.get('search');
      state.search = params.get('search');
    }
  }

  loadInvoices();
}

async function loadInvoices() {
  try {
    const response = await withLoading(
      () =>
        listInvoices({
          page: state.page,
          limit: state.limit,
          search: state.search,
        }),
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
      {
        page: state.page,
        totalPages: state.totalPages,
        total: state.total,
        limit: state.limit,
      },
      (page) => {
        state.page = page;
        loadInvoices();
      },
    );
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">Unable to load invoices.</td></tr>`;
    showToast(error instanceof ApiError ? error.message : 'Unable to load invoices.', 'error');
  }
}

function renderTable() {
  if (!state.invoices.length) {
    tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">No invoices found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = state.invoices
    .map((invoice) => {
      const id = invoice._id || invoice.id;
      const guest = invoice.guest || invoice;
      const currency = invoice.appliedRate?.currency || 'KES';
      const emailStatus = invoiceEmailStatus(invoice);
      return `
        <tr class="table-row-clickable" data-invoice-id="${escapeHtml(id)}" tabindex="0" role="button" aria-label="View invoice ${escapeHtml(invoice.invoiceNumber || '')}">
          <td><strong>${escapeHtml(invoice.invoiceNumber || '—')}</strong></td>
          <td>${escapeHtml(invoice.bookingReference || '—')}</td>
          <td>${escapeHtml(fullName(guest))}</td>
          <td>${escapeHtml(invoice.campName || '—')}</td>
          <td>${escapeHtml(formatMoney(invoice.totalAmount, currency))}</td>
          <td>${emailStatusBadge(emailStatus)}</td>
        </tr>
      `;
    })
    .join('');
}

async function printInvoice() {
  const img = document.querySelector('.invoice-document-logo');
  if (img && !img.complete) {
    await new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  }
  window.print();
}

function renderEmailStatus(invoice) {
  if (!emailStatusEl) return;
  const status = invoiceEmailStatus(invoice);
  emailStatusEl.innerHTML = `
    <span class="form-label" style="margin:0;">Email status</span>
    ${emailStatusBadge(status)}
  `;
}

async function downloadPdf() {
  if (!currentInvoiceId) return;
  try {
    await withLoading(() => downloadInvoicePdf(currentInvoiceId), 'Downloading PDF…');
    showToast('Invoice PDF downloaded.', 'success');
  } catch (error) {
    showToast(
      error instanceof ApiError ? error.message : error.message || 'Unable to download PDF.',
      'error',
    );
  }
}

async function openInvoiceDetail(id) {
  try {
    const response = await withLoading(() => getInvoice(id), 'Loading invoice…');
    const invoice = response.data?.invoice || response.data;
    const logoSrc = await getBrandLogoDataUrl();
    currentInvoiceId = invoice._id || invoice.id || id;

    document.getElementById('invoice-modal-title').textContent =
      invoice.invoiceNumber ? `Invoice ${invoice.invoiceNumber}` : 'Invoice';

    document.getElementById('invoice-detail-body').innerHTML = `
      <div class="invoice-print-area">
        ${renderInvoiceDocument(invoice, { logoSrc })}
      </div>
    `;

    renderEmailStatus(invoice);
    document.getElementById('invoice-print-btn').onclick = () => printInvoice();
    document.getElementById('invoice-pdf-btn').onclick = () => downloadPdf();
    setInvoicePrintMode(true);
    openModal(INVOICE_MODAL_ID);
  } catch (error) {
    showToast(error instanceof ApiError ? error.message : 'Unable to load invoice.', 'error');
  }
}

const user = requireAuth();
if (user) {
  initAdminShell();
  initModals();
  boot();
}
