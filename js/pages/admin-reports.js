import { listCamps } from '../api/camps.js';
import { listMous } from '../api/mous.js';
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
const summaryEl = document.getElementById('report-summary');

let lastParams = {};

function boot() {
  if (reportTypeSelect.dataset.fixedType !== 'reservation-log') {
    fillSelect(reportTypeSelect, constants.REPORT_TYPES, { placeholder: 'Select report' });
  }
  const requestedType = new URLSearchParams(window.location.search).get('type');
  if (requestedType && constants.REPORT_TYPES.some((item) => item.value === requestedType)) {
    reportTypeSelect.value = requestedType;
  }
  fillSelect(form.elements.stayType, constants.STAY_TYPES, { placeholder: 'All stay types' });
  loadMous();

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

async function loadMous() {
  if (!form.elements.mouId) return;
  try {
    const response = await listMous();
    const mous = response.data || [];
    fillSelect(
      form.elements.mouId,
      mous.map((mou) => ({
        value: mou._id,
        label: `${mou.partyName} (${mou.counterpartyCategory})`,
      })),
      { placeholder: 'All MOUs' },
    );
  } catch {
    showToast('Unable to load MOUs for the report filter.', 'error');
  }
}

function buildParams() {
  const values = Object.fromEntries(new FormData(form));
  const params = {};
  if (values.from) params.from = values.from;
  if (values.to) params.to = values.to;
  if (values.campId) params.campId = values.campId;
  if (values.stayType) params.stayType = values.stayType;
  if (values.period) params.period = values.period;
  if (values.year) params.year = values.year;
  if (values.status) params.status = values.status;
  if (values.counterpartyCategory) params.counterpartyCategory = values.counterpartyCategory;
  if (values.mouId) params.mouId = values.mouId;
  if (values.bookingReference) params.bookingReference = values.bookingReference.trim();
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
    if (summaryEl) {
      const summary = report.summary || {};
      summaryEl.textContent = `Revenue Calculation: ${Object.entries(summary)
        .filter(([key]) => key !== 'personTotals')
        .map(([key, value]) => `${key}: ${typeof value === 'number' ? value.toLocaleString('en-KE', { maximumFractionDigits: 2 }) : String(value ?? '')}`)
        .join(' | ') || 'No revenue data'}`;
    }

    if (reportType === 'reservation-log') {
      renderReservationLog(rows);
      resultsEl.hidden = false;
      setExportEnabled(true);
      return;
    }
    if (reportType === 'mou-revenue' || reportType === 'short-stay-revenue') {
      renderMouRevenue(rows, report, resultsEl);
      resultsEl.hidden = false;
      setExportEnabled(true);
      return;
    }

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

function renderMouRevenue(rows, report, resultsEl) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = row.mouId || row.mou || 'unassigned';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  const columns = [
    ['bookingReference', 'Booking Reference'], ['roomType', 'Room Type / Room'], ['checkInDate', 'Check-in Date'],
    ['departureDate', 'Departure Date'], ['unitPrice', 'Unit Price'], ['rooms', 'Rooms'],
    ['numberOfDays', 'No. of Days'], ['typeOfRoom', 'Stay Type'], ['remark', 'Remark / Occupant / MOU'],
  ];
  resultsEl.classList.add('mou-revenue-print');
  resultsEl.innerHTML = [...groups.entries()].map(([, groupRows]) => {
    const total = groupRows.reduce((sum, row) => sum + Number(row.amountAccumulated || 0), 0);
    const moduleTitle = report.title === 'Short Stay Revenue' ? 'SHORT STAY REVENUE MODULE' : 'ROOM RESERVATION FORM 1';
    return `<section class="mou-report-page"><div class="reservation-log-heading">${moduleTitle}</div><h3>${report.title === 'Short Stay Revenue' ? 'Short Stay Revenue Report' : `Room Reservation Form - ${escapeHtml(groupRows[0]?.mou || 'Unassigned MOU')}`}</h3><p class="reservation-log-date">Recipient: Dadaab Accommodation Team | Sender: CARE International | Period: ${escapeHtml(report.summary?.period || 'All selected dates')} | Revenue Calculation: ${report.title === 'Short Stay Revenue' ? 'Short stay subtotal' : 'MOU subtotal'} ${total.toLocaleString('en-KE', { maximumFractionDigits: 2 })}</p><table class="table"><thead><tr>${columns.map((column) => `<th>${column[1]}</th>`).join('')}</tr></thead><tbody>${groupRows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column[0]] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="form-hint">Remark: Hotel confirmation by: ____________________ Confirmation date: ____________________</p></section>`;
  }).join('') || '<p class="empty-state">No MOU occupancy revenue found.</p>';
}

function renderReservationLog(rows) {
  const columns = [
    ['bookingReference', 'Booking Reference'],
    ['roomType', 'Room Type / Room'],
    ['checkInDate', 'Check-in Date'],
    ['departureDate', 'Departure Date'],
    ['unitPrice', 'Unit Price'],
    ['rooms', 'Rooms'],
    ['numberOfDays', 'No. of Days'],
    ['typeOfRoom', 'Stay Type'],
    ['remark', 'Remark / Occupant / MOU'],
  ];
  const printableRows = [...rows];
  while (printableRows.length < 20) printableRows.push({});
  resultsEl.classList.add('reservation-log-print');
  resultsEl.innerHTML = `
    <div class="reservation-log-heading">ROOM RESERVATION FORM</div>
    <div class="reservation-log-date">Recipient: Dadaab Accommodation Team &nbsp; | &nbsp; Sender: CARE International &nbsp; | &nbsp; Date: ${new Date().toLocaleDateString('en-GB')}</div>
    <table class="table" aria-label="Reservation Log">
      <thead><tr>${columns.map((column) => `<th>${column[1]}</th>`).join('')}</tr></thead>
      <tbody>${printableRows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column[0]] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `;
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
