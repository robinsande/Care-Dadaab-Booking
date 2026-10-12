import { escapeHtml } from '../utils/format.js';

const currency = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat();

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
    { label: 'Occupied', value: Number(rooms.occupied) || 0, color: '#e8721e' },
    { label: 'Reserved', value: Number(rooms.booked) || 0, color: '#54206f' },
    { label: 'Available', value: Number(rooms.available) || 0, color: '#24976b' },
    { label: 'Maintenance', value: Number(rooms.maintenance) || 0, color: '#c9cec9' },
  ];
  let position = 0;
  const slices = categories.map((category) => {
    const start = position;
    position += total ? (category.value / total) * 100 : 0;
    return `${category.color} ${start}% ${position}%`;
  });
  const rate = Math.max(0, Math.min(100, Number(data.occupancyRate) || 0));

  const background = total ? slices.join(', ') : '#e7e8e3 0% 100%';
  root.innerHTML = `
    <div class="occupancy-chart-layout">
      <div class="occupancy-chart-ring" role="img" aria-label="${rate}% occupied across ${number.format(total)} active rooms" style="background:conic-gradient(${background})">
        <span><strong>${rate}%</strong><small>occupied</small></span>
      </div>
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

  const maxRevenue = Math.max(...months.map((month) => Number(month.totalRevenue) || 0), 1);
  const totalRevenue = months.reduce((sum, month) => sum + (Number(month.totalRevenue) || 0), 0);
  root.innerHTML = `
    <div class="revenue-chart-summary"><strong>${currency.format(totalRevenue)}</strong><span>invoiced in the last 6 months</span></div>
    <div class="revenue-chart-bars" role="img" aria-label="Monthly invoiced revenue for the last six months">
      ${months.map((month) => {
        const amount = Number(month.totalRevenue) || 0;
        const width = amount ? Math.max((amount / maxRevenue) * 100, 2) : 0;
        return `
          <div class="revenue-chart-row" title="${escapeHtml(month.label)}: ${escapeHtml(currency.format(amount))}">
            <span class="revenue-chart-month">${escapeHtml(month.label)}</span>
            <span class="revenue-chart-track"><i style="width:${width}%"></i></span>
            <strong>${escapeHtml(currency.format(amount))}</strong>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderStayTypes(stayTypes) {
  const root = document.getElementById('dashboard-stay-type-chart');
  if (!root) return;
  if (!stayTypes.length) {
    root.innerHTML = '<p class="chart-empty-state">No stay type data available.</p>';
    return;
  }

  const maxRevenue = Math.max(...stayTypes.map((stay) => Number(stay.totalRevenue) || 0), 1);
  root.innerHTML = `
    <div class="stay-type-chart-rows">
      ${stayTypes.map((stay) => {
        const revenue = Number(stay.totalRevenue) || 0;
        const width = revenue ? Math.max((revenue / maxRevenue) * 100, 2) : 0;
        return `
          <div class="stay-type-chart-row">
            <div class="stay-type-chart-heading"><strong>${escapeHtml(stay.stayType || 'Other')}</strong><span>${number.format(Number(stay.bookingCount) || 0)} bookings</span></div>
            <div class="stay-type-chart-track"><i style="width:${width}%"></i></div>
            <strong class="stay-type-chart-revenue">${escapeHtml(currency.format(revenue))}</strong>
          </div>
        `;
      }).join('')}
    </div>
    <p class="chart-footnote">Revenue grouped by invoice stay type</p>
  `;
}
