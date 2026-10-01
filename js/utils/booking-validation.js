import {
  isArrivalValid,
  isDepartureAfterArrival,
  validateFields,
} from './validation.js';
import { getBookingLocationState } from './booking-location.js';

/** Shared guest + booking field validation for create/edit forms. */
export function validateGuestFields(values, { requireLocation = true } = {}) {
  const rules = {
    firstName: { required: true, label: 'First Name' },
    lastName: { required: true, label: 'Last Name' },
    email: { required: true, email: true, label: 'Email' },
    phone: { required: true, phone: true, label: 'Phone' },
    organisation: { required: true, label: 'Organisation' },
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
          const nights = Math.round((departure - arrival) / (24 * 60 * 60 * 1000));
          if (nights <= 21) return 'Long Stay must be more than 21 nights.';
          return null;
        })(),
    },
    departureCountry: { required: true, label: 'Departure Country' },
    kenyaOffice: {
      custom: (value, all) => {
        const needsOffice = getBookingLocationState(all).showKenyaOffice;
        return needsOffice && !value ? 'Kenya Office is required for CARE Staff.' : null;
      },
    },
    internationalCountry: {
      custom: (value, all) => getBookingLocationState(all).showInternationalCountry && !value
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
