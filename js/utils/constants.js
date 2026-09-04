const BOOKING_STATUSES = ['Booked', 'Checked In', 'Checked Out', 'Cancelled'];

const ROOM_STATUSES = ['Available', 'Booked', 'Occupied', 'Maintenance'];

const STAY_TYPES = ['Short Stay', 'Long Stay'];

const GENDERS = ['Male', 'Female'];

const DEPARTURE_COUNTRIES = [
  { value: 'Local (Kenyan)', label: 'Local (Kenyan)' },
  { value: 'International', label: 'International' },
];

const CONTRACT_TYPES = [
  'CARE Staff',
  'Consultant',
  'Partner Organisation',
  'Visitor',
  'Other',
];

const KENYA_OFFICES = ['Nakuru', 'Nairobi', 'Kisumu', 'Regional Office'];

const USER_ROLES = ['Accommodation Officer', 'Super Admin'];

const REPORT_TYPES = [
  { value: 'bookings-by-camp', label: 'Bookings by Camp' },
  { value: 'bookings-by-date', label: 'Bookings by Date Range' },
  { value: 'stay-type-breakdown', label: 'Short Stay vs Long Stay' },
  { value: 'room-utilization', label: 'Room Utilization' },
  { value: 'occupancy', label: 'Occupancy' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'outstanding-invoices', label: 'Outstanding Invoices' },
  { value: 'arrivals', label: 'Arrivals' },
  { value: 'departures', label: 'Departures' },
  { value: 'reservation-log', label: 'Reservation Log' },
];

export const constants = {
  BOOKING_STATUSES,
  ROOM_STATUSES,
  STAY_TYPES,
  GENDERS,
  DEPARTURE_COUNTRIES,
  CONTRACT_TYPES,
  KENYA_OFFICES,
  USER_ROLES,
  REPORT_TYPES,
};

export function fillSelect(select, options, { placeholder = 'Select…', value = '' } = {}) {
  if (!select) return;
  const items = options.map((opt) => {
    if (typeof opt === 'string') return { value: opt, label: opt };
    return opt;
  });

  select.innerHTML = [
    `<option value="">${placeholder}</option>`,
    ...items.map(
      (item) =>
        `<option value="${item.value}" ${String(item.value) === String(value) ? 'selected' : ''}>${item.label}</option>`,
    ),
  ].join('');
}
