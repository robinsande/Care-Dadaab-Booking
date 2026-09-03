import { config } from '../config.js';
import { getToken } from '../auth/session.js';
import { api } from './client.js';

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

  const apiFormat = format === 'excel' ? 'xlsx' : format;
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
  const filename =
    response.headers.get('Content-Disposition')?.match(/filename="?([^"]+)"?/)?.[1]
    || `report-${type}.${apiFormat === 'xlsx' ? 'xlsx' : apiFormat === 'csv' ? 'csv' : apiFormat}`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
