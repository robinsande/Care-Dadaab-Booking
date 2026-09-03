import { getInvoice, downloadInvoicePdf } from '../api/invoices.js';
import { ApiError } from '../api/client.js';
import { getBrandLogoDataUrl } from '../config.js';
import { renderInvoiceDocument } from '../components/invoice-document.js';
import { openModal } from '../components/modal.js';
import { withLoading } from '../components/loading.js';
import { showToast } from '../components/toast.js';
import { invoiceEmailStatus, emailStatusBadge } from '../utils/format.js';

const INVOICE_MODAL_ID = 'invoice';
let printHookApplied = false;
let currentInvoiceId = null;

function applyPrintHook() {
  if (printHookApplied) return;
  printHookApplied = true;
  const backdrop = document.querySelector(`[data-modal="${INVOICE_MODAL_ID}"]`);
  if (!backdrop) return;
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest(`[data-close-modal="${INVOICE_MODAL_ID}"]`)) {
      document.body.classList.remove('invoice-print-mode');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !backdrop.hidden) document.body.classList.remove('invoice-print-mode');
  });
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

function renderEmailStatus(inv) {
  const el = document.getElementById('invoice-email-status');
  if (!el) return;
  const s = invoiceEmailStatus(inv);
  el.innerHTML = `<span class="form-label" style="margin:0;">Email status</span> ${emailStatusBadge(s)}`;
}

async function downloadPdf() {
  if (!currentInvoiceId) return;
  try {
    await withLoading(() => downloadInvoicePdf(currentInvoiceId), 'Downloading PDF…');
    showToast('Invoice PDF downloaded.', 'success');
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : err.message || 'Unable to download PDF.', 'error');
  }
}

export async function openInvoiceDetailModal(id) {
  applyPrintHook();
  try {
    const response = await withLoading(() => getInvoice(id), 'Loading invoice…');
    const inv = response.data?.invoice || response.data;
    const logoSrc = await getBrandLogoDataUrl();
    currentInvoiceId = inv._id || inv.id || id;
    document.getElementById('invoice-modal-title').textContent = inv.invoiceNumber
      ? `Invoice ${inv.invoiceNumber}`
      : 'Invoice';
    document.getElementById('invoice-detail-body').innerHTML = `<div class="invoice-print-area">${renderInvoiceDocument(inv, { logoSrc })}</div>`;
    renderEmailStatus(inv);
    document.getElementById('invoice-print-btn').onclick = () => printInvoice();
    document.getElementById('invoice-pdf-btn').onclick = () => downloadPdf();
    document.body.classList.add('invoice-print-mode');
    openModal(INVOICE_MODAL_ID);
    return inv;
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : 'Unable to load invoice.', 'error');
    throw err;
  }
}

export function getCurrentInvoiceId() {
  return currentInvoiceId;
}

export { downloadPdf as downloadCurrentInvoicePdf, printInvoice as printCurrentInvoice };
