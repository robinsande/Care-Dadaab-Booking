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

export function getMouCategoryForContractType(contractType) {
  return {
    'CARE Staff': 'staff',
    'Implementing Partner': 'implementing_partner',
    'Partner Organisation': 'implementing_partner',
    Government: 'government',
  }[String(contractType || '').trim()] || '';
}

export function getMouCategoryLabel(category) {
  return {
    staff: 'CARE Staff',
    implementing_partner: 'Implementing Partner',
    government: 'Government',
    municipality: 'Municipality',
  }[category] || category || 'Other';
}