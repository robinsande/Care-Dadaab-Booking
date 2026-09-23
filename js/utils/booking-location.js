function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

export function getBookingLocationState({ contractType = '', careStaffLocation = '', departureCountry = '' } = {}) {
  const isCareStaff = normalized(contractType) === 'care staff';
  const staffLocation = normalized(careStaffLocation);
  const residence = normalized(departureCountry);
  const isKenyaStaff = isCareStaff && (staffLocation === 'care kenya staff' || staffLocation === 'kenya');
  const isInternationalStaff = isCareStaff
    && (staffLocation === 'care international staff' || staffLocation === 'international');
  const isInternationalResidence = residence === 'international';

  return {
    isCareStaff,
    isKenyaStaff,
    isInternationalStaff,
    showKenyaOffice: isKenyaStaff,
    showInternationalCountry: isInternationalStaff || (!isCareStaff && isInternationalResidence),
  };
}