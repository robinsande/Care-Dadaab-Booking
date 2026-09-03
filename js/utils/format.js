/** Display / formatting helpers. */

const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const DATETIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return DATE_FORMATTER.format(date);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return DATETIME_FORMATTER.format(date);
}

export function formatMoney(amount, currency = 'KES') {
  if (amount === null || amount === undefined || amount === '') return '—';
  const number = Number(amount);
  if (Number.isNaN(number)) return String(amount);
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(number);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function statusBadgeClass(status) {
  const map = {
    Booked: 'badge-approved',
    Cancelled: 'badge-cancelled',
    'Checked In': 'badge-checked-in',
    'Checked Out': 'badge-checked-out',
    Available: 'badge-available',
    Booked: 'badge-approved',
    Occupied: 'badge-occupied',
    Maintenance: 'badge-maintenance',
    Outstanding: 'badge-pending',
    Unpaid: 'badge-pending',
    Paid: 'badge-approved',
    Waived: 'badge-checked-out',
  };
  return map[status] || 'badge-cancelled';
}

export function statusBadge(status) {
  if (!status) return '—';
  return `<span class="badge ${statusBadgeClass(status)}">${escapeHtml(status)}</span>`;
}

export function campLabel(camp) {
  if (!camp) return '—';
  if (typeof camp === 'string') return camp;
  return camp.name || camp.campName || '—';
}

export function roomLabel(room, booking) {
  if (!room && !booking) return '—';
  const source = room || booking;
  if (typeof source === 'string') return source;

  const camp = campLabel(source.camp || booking?.camp || booking?.campName);
  const block =
    source.block?.name
    || source.blockName
    || source.block
    || booking?.blockName
    || booking?.block?.name;
  const number = source.roomNumber ?? source.number ?? booking?.roomNumber;

  const parts = [];
  if (camp && camp !== '—') parts.push(camp);
  if (block) parts.push(`Block ${block}`);
  if (number !== undefined && number !== '') parts.push(`Room ${number}`);

  return parts.length ? parts.join(' · ') : '—';
}

export function fullName(person) {
  if (!person) return '—';
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || '—';
}

/** Current occupant for a room record returned by the API. */
export function roomCurrentGuest(room) {
  if (!room) return '—';
  const guest =
    room.currentGuest
    || room.occupant
    || room.activeBooking?.guest
    || room.currentBooking?.guest;
  if (guest) return fullName(guest);

  const booking = room.activeBooking || room.currentBooking;
  if (booking) return fullName(booking);

  if (room.currentGuestName) return room.currentGuestName;
  return '—';
}

/** Email delivery status for an invoice. */
export function invoiceEmailStatus(invoice) {
  if (!invoice) return '—';
  if (invoice.emailStatus) return invoice.emailStatus;
  if (invoice.emailedAt) return 'Sent';
  if (invoice.emailSent === true) return 'Sent';
  if (invoice.emailSent === false) return 'Not sent';
  // Backend emails guest and officer when invoice is generated (invoice.service.js).
  if (invoice.generatedAt) return 'Sent';
  return '—';
}

export function emailStatusBadge(status) {
  if (!status || status === '—') return '—';
  const normalized = String(status).toLowerCase();
  const sent = normalized === 'sent' || normalized === 'delivered';
  const failed = normalized === 'failed' || normalized === 'error';
  const cls = sent ? 'badge-approved' : failed ? 'badge-cancelled' : 'badge-pending';
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

export function yesNo(value) {
  if (value === true || value === 'true' || value === 'Yes') return 'Yes';
  if (value === false || value === 'false' || value === 'No') return 'No';
  return value ? String(value) : '—';
}

export function nightsBetween(arrivalDate, departureDate) {
  const arrival = new Date(arrivalDate);
  const departure = new Date(departureDate);
  if (Number.isNaN(arrival.getTime()) || Number.isNaN(departure.getTime())) return null;
  const diff = departure.getTime() - arrival.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

export function calculateBookingTotal(arrivalDate, departureDate, appliedRate) {
  const nights = nightsBetween(arrivalDate, departureDate);
  const rate = Number(appliedRate);
  if (nights === null || nights <= 0 || Number.isNaN(rate)) return null;
  return { nights, total: nights * rate };
}
