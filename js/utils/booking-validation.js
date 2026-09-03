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
        isDepartureAfterArrival(all.arrivalDate, value)
          ? null
          : 'Departure date must be after arrival date.',
    },
    departureCountry: { required: true, label: 'Departure Country' },
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
