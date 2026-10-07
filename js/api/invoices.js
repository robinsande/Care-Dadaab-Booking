import { config } from '../config.js';
import { getToken } from '../auth/session.js';
import { api } from './client.js';

export function listInvoices(params = {}) {
  return api.get('/invoices', { query: params });
}

export function getInvoice(id) {
  return api.get(`/invoices/${id}`);
}

export function updateInvoicePaymentStatus(id, paymentStatus, paymentMethod = 'Cash') {
  return api.patch(`/invoices/${id}/payment-status`, { paymentStatus, paymentMethod });
}

export function initiateInvoiceStkPush(id, phoneNumber) {
  return api.post(`/mpesa/stk/${id}`, { phoneNumber });
}

async function fetchInvoicePdf(id) {
  const base = config.API_BASE_URL.replace(/\/$/, '');
  const url = new URL(`${base}/invoices/${id}`);
  url.searchParams.set('format', 'pdf');

  const token = getToken();
  const response = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(`PDF download failed (${response.status}).`);
  }

  return {
    blob: await response.blob(),
    filename:
    response.headers.get('Content-Disposition')?.match(/filename="?([^"]+)"?/)?.[1]
      || `invoice-${id}.pdf`,
  };
}

/**
 * Download the server-rendered invoice or saved receipt PDF.
 */
export async function downloadInvoicePdf(id) {
  const { blob, filename } = await fetchInvoicePdf(id);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/**
 * Print the same server-rendered PDF that is offered for download.
 */
export async function printInvoicePdf(id) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Allow pop-ups for this site to print the invoice or receipt.');
  }

  let objectUrl;
  try {
    const pdf = await fetchInvoicePdf(id);
    objectUrl = URL.createObjectURL(pdf.blob);
    printWindow.addEventListener('load', () => {
      window.setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 250);
    }, { once: true });
    printWindow.location.href = objectUrl;
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  } catch (error) {
    printWindow.close();
    throw error;
  }
}
