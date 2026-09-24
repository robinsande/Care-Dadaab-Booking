import { config } from '../config.js';
import { getToken } from '../auth/session.js';
import { api } from './client.js';

export function normalizeReportExportFormat(format = 'json') {
  const value = String(format || 'json').trim().toLowerCase();

  if (value === 'excel' || value === 'xlsx') return 'xlsx';
  if (value === 'pdf') return 'pdf';
  if (value === 'csv') return 'csv';

  return value || 'json';
}

export function resolveReportDownloadFilename(type, format, contentDisposition) {
  const normalizedFormat = normalizeReportExportFormat(format);
  const headerValue = contentDisposition || '';
  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  const asciiMatch = headerValue.match(/filename="?([^";]+)"?/i);
  const explicitName = utf8Match ? decodeURIComponent(utf8Match[1]) : asciiMatch ? asciiMatch[1] : '';

  if (explicitName) return explicitName;

  const extension = normalizedFormat === 'xlsx' ? 'xlsx' : normalizedFormat === 'csv' ? 'csv' : normalizedFormat === 'pdf' ? 'pdf' : 'report';
  return `report-${type}.${extension}`;
}

export function getReport(type, params = {}) {
  return api.get(`/reports/${type}`, { query: { ...params, format: 'json' } });
}

/**
 * Download a report export (CSV) via authenticated fetch.
 * Backend uses query param `format` on GET /reports/:type.
 */
export async function downloadReportExport(type, format, params = {}) {
  const base = config.API_BASE_URL.replace(/\/$/, '');
  const url = new URL(`${base}/reports/${type}`);

  const apiFormat = normalizeReportExportFormat(format);
  const query = { ...params, format: apiFormat };

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const token = getToken();
  const response = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(`Export failed (${response.status}).`);
  }

  const blob = await response.blob();
  const filename = resolveReportDownloadFilename(type, apiFormat, response.headers.get('Content-Disposition'));

  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
    link.remove();
  }, 1000);
}
