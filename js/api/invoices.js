import { config } from '../config.js';
import { getToken } from '../auth/session.js';
import { api } from './client.js';

export function listInvoices(params = {}) {
  return api.get('/invoices', { query: params });
}

export function getInvoice(id) {
  return api.get(`/invoices/${id}`);
}

/**
 * Download invoice as PDF via authenticated fetch.
 * Backend: GET /invoices/:id?format=pdf
 */
export async function downloadInvoicePdf(id) {
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

  const blob = await response.blob();
  const filename =
    response.headers.get('Content-Disposition')?.match(/filename="?([^"]+)"?/)?.[1]
    || `invoice-${id}.pdf`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
