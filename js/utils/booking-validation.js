import {
  isArrivalValid,
  isDepartureAfterArrival,
  validateFields,
} from './validation.js';

/** Shared guest + booking field validation for create/edit forms. */
export function validateGuestFields(values, { requireLocation = true } = {}) {
  const rules = {
    firstName: { required: true, label: 'First Name' },
    lastName: { required: true, label: 'Last Name' },
    email: { required: true, email: true, label: 'Email' },
    phone: { required: true, phone: true, label: 'Phone' },
    organisation: { required: false, label: 'Organisation' },
    gender: { required: true, label: 'Gender' },
    contractType: { required: true, label: 'Contract Type' },
    reasonForVisit: { required: true, label: 'Reason for Visit' },
    arrivalDate: {
      required: true,
      label: 'Arrival Date',
      custom: (value) =>
        isArrivalValid(value) ? null : 'Arrival date must not be in the past.',
    },
    departureDate: {
      required: true,
      label: 'Departure Date',
      custom: (value, all) =>
        (() => {
          if (!isDepartureAfterArrival(all.arrivalDate, value)) {
            return 'Departure date must be after arrival date.';
          }
          if (all.stayType !== 'Long Stay') return null;
          const arrival = new Date(`${all.arrivalDate}T00:00:00`);
          const departure = new Date(`${value}T00:00:00`);
          const minimum = new Date(arrival);
          minimum.setMonth(minimum.getMonth() + 1);
          const maximum = new Date(arrival);
          maximum.setMonth(maximum.getMonth() + 12);
          if (departure <= minimum) return 'Long Stay must be more than one month.';
          if (departure > maximum) return 'Long Stay cannot exceed 12 months.';
          return null;
        })(),
    },
    departureCountry: { required: true, label: 'Departure Country' },
    kenyaOffice: {
      custom: (value, all) => {
        const needsOffice = all.contractType === 'CARE Staff'
          && String(all.departureCountry || '').trim().toLowerCase() === 'local (kenyan)';
        return needsOffice && !value ? 'Kenya Office is required for CARE Staff.' : null;
      },
    },
    internationalCountry: {
      custom: (value, all) => all.departureCountry === 'International' && !value
        ? 'Country of Origin is required for International visitors.'
        : null,
    },
  };

  if (requireLocation) {
    rules.campId = { required: true, label: 'Camp' };
    rules.blockId = { required: true, label: 'Block' };
    rules.roomId = { required: true, label: 'Room' };
    rules.stayType = { required: true, label: 'Stay Type' };
  }

  return validateFields(values, rules);
}

export function validateCancellationReason(reason) {
  return validateFields({ reason }, {
    reason: { required: true, label: 'Cancellation reason' },
  });
}
