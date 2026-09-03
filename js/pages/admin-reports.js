import { listCamps } from '../api/camps.js';
import { getReport, downloadReportExport } from '../api/reports.js';
import { ApiError } from '../api/client.js';
import { requireAuth } from '../auth/session.js';
import { initAdminShell } from '../components/shell.js';
import { withLoading, setButtonLoading } from '../components/loading.js';
import { showToast } from '../components/toast.js';
import { constants, fillSelect } from '../utils/constants.js';
import { escapeHtml } from '../utils/format.js';

const form = document.getElementById('report-filters');
const reportTypeSelect = document.getElementById('reportType');
const generateBtn = document.getElementById('generate-report');
const exportPdfBtn = document.getElementById('export-pdf');
const exportExcelBtn = document.getElementById('export-excel');
const printBtn = document.getElementById('print-report');
const resultsEl = document.getElementById('report-results');
const resultsHead = document.getElementById('report-results-head');
const resultsBody = document.getElementById('report-results-body');

let lastParams = {};

function boot() {
  fillSelect(reportTypeSelect, constants.REPORT_TYPES, { placeholder: 'Select report' });
  fillSelect(form.elements.stayType, constants.STAY_TYPES, { placeholder: 'All stay types' });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    generateReport();
  });

  exportPdfBtn.addEventListener('click', () => exportReport('pdf'));
  exportExcelBtn.addEventListener('click', () => exportReport('excel'));
  printBtn.addEventListener('click', () => window.print());

  loadCamps();
}

async function loadCamps() {
  try {
    const response = await listCamps();
    const camps = response.data?.camps || response.data?.items || response.data || [];
    fillSelect(
      form.elements.campId,
      (Array.isArray(camps) ? camps : []).map((c) => ({
        value: c._id || c.id,
        label: c.name,
      })),
      { placeholder: 'All camps' },
    );
  } catch {
    showToast('Unable to load camps for filter.', 'error');
  }
}

function buildParams() {
  const values = Object.fromEntries(new FormData(form));
  const params = {};
  if (values.from) params.from = values.from;
  if (values.to) params.to = values.to;
  if (values.campId) params.campId = values.campId;
  if (values.stayType) params.stayType = values.stayType;
  return params;
}

function setExportEnabled(enabled) {
  exportPdfBtn.disabled = !enabled;
  exportExcelBtn.disabled = !enabled;
  printBtn.disabled = !enabled;
}

async function generateReport() {
  const reportType = reportTypeSelect.value;
  if (!reportType) {
    showToast('Select a report type.', 'error');
    return;
  }

  lastParams = buildParams();
  setButtonLoading(generateBtn, true, 'Generating…');
  try {
    const response = await getReport(reportType, lastParams);
    const report = response.data || {};
    const rows = report.rows || [];

    if (!rows.length) {
      resultsEl.hidden = false;
      resultsHead.innerHTML = '';
      resultsBody.innerHTML = `<tr><td colspan="6" class="empty-state">No data for selected filters.</td></tr>`;
      setExportEnabled(true);
      return;
    }

    const columns = inferColumns(rows);
    resultsHead.innerHTML = `<tr>${columns.map((col) => `<th>${escapeHtml(col.label || col.key || col)}</th>`).join('')}</tr>`;
    resultsBody.innerHTML = rows
      .map((row) => {
        const data = typeof row.toJSON === 'function' ? row.toJSON() : row;
        const cells = columns.map((col) => {
          const key = col.key || col;
          let val = data[key];
          if (val && typeof val === 'object') val = JSON.stringify(val);
          return `<td>${escapeHtml(String(val ?? ''))}</td>`;
        });
        return `<tr>${cells.join('')}</tr>`;
      })
      .join('');

    resultsEl.hidden = false;
    setExportEnabled(true);
  } catch (error) {
    showToast(error instanceof ApiError ? error.message : 'Unable to generate report.', 'error');
  } finally {
    setButtonLoading(generateBtn, false);
  }
}

function inferColumns(rows) {
  if (!rows.length) return [];
  const first = typeof rows[0].toJSON === 'function' ? rows[0].toJSON() : rows[0];
  return Object.keys(first).map((key) => ({ key, label: key }));
}

async function exportReport(format) {
  const reportType = reportTypeSelect.value;
  if (!reportType) return;

  const params = lastParams || buildParams();
  const label = format === 'pdf' ? 'PDF' : 'Excel';
  try {
    await withLoading(() => downloadReportExport(reportType, format, params), `Exporting ${label}…`);
    showToast(`Report exported as ${label}.`, 'success');
  } catch (error) {
    showToast(error instanceof ApiError ? error.message : 'Export failed.', 'error');
  }
}

const user = requireAuth({ superAdmin: true });
if (user) {
  initAdminShell();
  boot();
}
