import { escapeHtml } from '../utils/format.js';

const currency = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat();
const occupancyColors = ['#e8721e', '#54206f', '#24976b', '#c9cec9'];
const stayTypeColors = ['#e8721e', '#54206f', '#24976b', '#3b82f6'];

export function renderDashboardCharts(data) {
  renderOccupancy(data);
  renderRevenue(data.revenueByMonth || []);
  renderStayTypes(data.stayTypeStats || []);
}

export function showDashboardChartsError() {
  ['dashboard-occupancy-chart', 'dashboard-revenue-chart', 'dashboard-stay-type-chart']
    .forEach((id) => {
      const element = document.getElementById(id);
      if (element?.querySelector('.chart-loading-state')) {
        element.innerHTML = '<p class="chart-empty-state">Analytics are temporarily unavailable. Refresh to try again.</p>';
      }
    });
}

function renderOccupancy(data) {
  const root = document.getElementById('dashboard-occupancy-chart');
  if (!root) return;

  const rooms = data.roomOccupancy || {
    occupied: data.occupiedRooms || 0,
    booked: data.bookedRooms || 0,
    available: data.availableRooms || 0,
    maintenance: data.maintenanceRooms || 0,
    total: data.totalActiveRooms || 0,
  };
  const total = Number(rooms.total) || 0;
  const categories = [
    { label: 'Occupied', value: Math.max(Number(rooms.occupied) || 0, 0), color: occupancyColors[0] },
    { label: 'Reserved', value: Math.max(Number(rooms.booked) || 0, 0), color: occupancyColors[1] },
    { label: 'Available', value: Math.max(Number(rooms.available) || 0, 0), color: occupancyColors[2] },
    { label: 'Maintenance', value: Math.max(Number(rooms.maintenance) || 0, 0), color: occupancyColors[3] },
  ];
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const slices = categories.map((category) => {
    const length = total ? (category.value / total) * circumference : 0;
    const segment = `<circle cx="80" cy="80" r="${radius}" fill="none" stroke="${category.color}" stroke-width="14" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}"/>`;
    offset += length;
    return segment;
  });
  const rate = Math.max(0, Math.min(100, Number(data.occupancyRate) || 0));

  root.innerHTML = `
    <div class="occupancy-chart-layout">
      <svg class="occupancy-chart-svg" viewBox="0 0 160 160" role="img" aria-label="${rate}% occupied across ${number.format(total)} active rooms">
        <circle cx="80" cy="80" r="${radius}" fill="none" stroke="#f1f0ec" stroke-width="14"/>
        <g transform="rotate(-90 80 80)">${total ? slices.join('') : ''}</g>
        <text class="occupancy-chart-rate" x="80" y="77" text-anchor="middle">${rate}%</text>
        <text class="occupancy-chart-label" x="80" y="96" text-anchor="middle">occupied</text>
      </svg>
      <ul class="chart-legend">
        ${categories.map((category) => `
          <li><span class="chart-legend-label"><i style="--legend-color:${category.color}"></i>${category.label}</span><strong>${number.format(category.value)}</strong></li>
        `).join('')}
      </ul>
    </div>
    <p class="chart-footnote">${number.format(total)} active rooms across all camps</p>
  `;
}

function renderRevenue(months) {
  const root = document.getElementById('dashboard-revenue-chart');
  if (!root) return;
  if (!months.length) {
    root.innerHTML = '<p class="chart-empty-state">No revenue data available.</p>';
    return;
  }

  const values = months.map((month) => Math.max(Number(month.totalRevenue) || 0, 0));
  const totalRevenue = values.reduce((sum, value) => sum + value, 0);
  const maxRevenue = Math.max(...values, 0);
  const tickMax = niceMaximum(maxRevenue);
  const width = 480;
  const height = 220;
  const left = 66;
  const right = 12;
  const top = 14;
  const bottom = 37;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const slotWidth = plotWidth / months.length;
  const barWidth = Math.min(slotWidth * 0.58, 46);
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = (tickMax * index) / 4;
    const y = top + plotHeight - (index / 4) * plotHeight;
    return `
      <line class="chart-grid-line" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"/>
      <text class="chart-axis-label chart-y-label" x="${left - 8}" y="${y + 4}" text-anchor="end">${escapeHtml(formatAxisCurrency(value))}</text>
    `;
  }).join('');
  const bars = months.map((month, index) => {
    const amount = values[index];
    const barHeight = tickMax ? (amount / tickMax) * plotHeight : 0;
    const x = left + slotWidth * index + (slotWidth - barWidth) / 2;
    const y = top + plotHeight - barHeight;
    const label = safeChartLabel(month.label || month.month);
    const title = `${label}: ${currency.format(amount)}`;
    return `
      <g>
        <title>${escapeHtml(title)}</title>
        ${amount ? `<rect class="revenue-chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="5"/>` : ''}
        <text class="chart-axis-label chart-x-label" x="${x + barWidth / 2}" y="${height - 11}" text-anchor="middle">${escapeHtml(label)}</text>
      </g>
    `;
  }).join('');

  root.innerHTML = `
    <div class="revenue-chart-summary"><strong>${currency.format(totalRevenue)}</strong><span>invoiced in the last 6 months</span></div>
    <svg class="dashboard-chart-svg revenue-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly invoiced revenue for the last six months">
      <defs><linearGradient id="revenue-bar-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffad24"/><stop offset="100%" stop-color="#e8721e"/></linearGradient></defs>
      ${grid}
      <line class="chart-axis-line" x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}"/>
      ${bars}
    </svg>
  `;
}

function renderStayTypes(stayTypes) {
  const root = document.getElementById('dashboard-stay-type-chart');
  if (!root) return;
  if (!stayTypes.length) {
    root.innerHTML = '<p class="chart-empty-state">No stay type data available.</p>';
    return;
  }

  const bookingCounts = stayTypes.map((stay) => Math.max(Number(stay.bookingCount) || 0, 0));
  const tickMax = niceMaximum(Math.max(...bookingCounts, 0));
  const width = 400;
  const rowHeight = 62;
  const height = 66 + stayTypes.length * rowHeight;
  const left = 96;
  const right = 88;
  const top = 31;
  const plotWidth = width - left - right;
  const plotBottom = top + stayTypes.length * rowHeight - 10;
  const tickCount = 4;
  const grid = Array.from({ length: tickCount + 1 }, (_, index) => {
    const value = (tickMax * index) / tickCount;
    const x = left + (index / tickCount) * plotWidth;
    return `
      <line class="chart-grid-line" x1="${x}" y1="${top - 9}" x2="${x}" y2="${plotBottom}"/>
      <text class="chart-axis-label" x="${x}" y="${plotBottom + 18}" text-anchor="middle">${number.format(Math.round(value))}</text>
    `;
  }).join('');
  const rows = stayTypes.map((stay, index) => {
    const count = bookingCounts[index];
    const revenue = Math.max(Number(stay.totalRevenue) || 0, 0);
    const barWidth = tickMax ? (count / tickMax) * plotWidth : 0;
    const y = top + index * rowHeight;
    const label = safeChartLabel(stay.stayType || 'Other');
    const color = stayTypeColors[index % stayTypeColors.length];
    return `
      <g>
        <title>${escapeHtml(`${label}: ${number.format(count)} bookings, ${currency.format(revenue)} invoiced`)}</title>
        <text class="stay-type-axis-label" x="${left - 10}" y="${y + 12}" text-anchor="end">${escapeHtml(label)}</text>
        ${count ? `<rect x="${left}" y="${y - 3}" width="${barWidth}" height="24" rx="5" fill="${color}"/>` : ''}
        <text class="stay-type-count-label" x="${width - right + 12}" y="${y + 14}">${number.format(count)}</text>
        <text class="stay-type-revenue-label" x="${width - 2}" y="${y + 14}" text-anchor="end">${escapeHtml(formatCompactCurrency(revenue))}</text>
      </g>
    `;
  }).join('');
  root.innerHTML = `
    <div class="stay-type-chart-key"><span><i></i>Booking count</span><span>Invoice revenue</span></div>
    <svg class="dashboard-chart-svg stay-type-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Booking counts and invoice revenue by stay type">
      ${grid}
      <line class="chart-axis-line" x1="${left}" y1="${top - 9}" x2="${left}" y2="${plotBottom}"/>
      ${rows}
    </svg>
  `;
}

function niceMaximum(value) {
  if (!value) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatAxisCurrency(value) {
  if (value >= 1000000) return `${number.format(Math.round(value / 100000) / 10)}m`;
  if (value >= 1000) return `${number.format(Math.round(value / 100) / 10)}k`;
  return number.format(Math.round(value));
}

function formatCompactCurrency(value) {
  if (value >= 1000000) return `Ksh ${(value / 1000000).toFixed(1)}m`;
  if (value >= 1000) return `Ksh ${number.format(Math.round(value / 1000))}k`;
  return currency.format(value);
}

function safeChartLabel(value) {
  return String(value || '').slice(0, 24);
}
