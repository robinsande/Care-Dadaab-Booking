import { createCampSelectors } from '../components/camp-selectors.js';
import { constants, fillSelect } from '../utils/constants.js';
import {
  applyFieldErrors,
  getFormValues,
  todayISODate,
} from '../utils/validation.js';
import { validateGuestFields } from '../utils/booking-validation.js';
import {
  calculateBookingTotal,
  escapeHtml,
  formatMoney,
} from '../utils/format.js';
import { listMous } from '../api/mous.js';

function sliceDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export function initGuestFieldSelects(form) {
  fillSelect(form.elements.gender, constants.GENDERS, { placeholder: 'Select gender' });
  fillSelect(form.elements.departureCountry, constants.DEPARTURE_COUNTRIES, { placeholder: 'Select country of origin' });
  fillSelect(form.elements.contractType, constants.CONTRACT_TYPES, {
    placeholder: 'Select contract type',
  });
  fillSelect(form.elements.kenyaOffice, constants.KENYA_OFFICES, { placeholder: 'Select Kenya office' });
  const internationalGroup = form.elements.internationalCountry?.closest('.form-group');
  let organisationAutoFilled = false;
  const updateInternationalVisibility = () => {
    const isInternational = form.elements.departureCountry?.value === 'International';
    if (internationalGroup) {
      internationalGroup.hidden = !isInternational;
      internationalGroup.classList.toggle('is-hidden', !isInternational);
    }
    if (form.elements.internationalCountry) {
      form.elements.internationalCountry.required = isInternational;
      if (!isInternational) form.elements.internationalCountry.value = '';
    }
  };
  const updateOrganisationDefault = () => {
    const organisation = form.elements.organisation;
    const isLocalKenyan = form.elements.departureCountry?.value === 'Local (Kenyan)';
    if (organisation && isLocalKenyan && !organisation.value.trim()) {
      organisation.value = 'Individual';
      organisationAutoFilled = true;
    } else if (organisation && !isLocalKenyan && organisationAutoFilled) {
      organisation.value = '';
      organisationAutoFilled = false;
    }
  };
  const updateOfficeVisibility = () => {
    const group = form.elements.kenyaOffice?.closest('.form-group');
    const isKenyaStaff = form.elements.contractType?.value === 'CARE Staff'
      && form.elements.departureCountry?.value.trim().toLowerCase() === 'local (kenyan)';
    if (group) group.hidden = !isKenyaStaff;
    if (form.elements.kenyaOffice) {
      form.elements.kenyaOffice.required = isKenyaStaff;
      if (!isKenyaStaff) form.elements.kenyaOffice.value = '';
    }
    updateInternationalVisibility();
    updateOrganisationDefault();
  };
  form.elements.contractType?.addEventListener('change', updateOfficeVisibility);
  form.elements.departureCountry?.addEventListener('change', updateOfficeVisibility);
  updateOfficeVisibility();
  fillSelect(form.elements.stayType, constants.STAY_TYPES, { placeholder: 'Select stay type' });
  const mouField = form.querySelector('[data-mou-field]');
  const mouSelect = form.elements.mouId;
  const updateMouVisibility = async () => {
    const longStay = form.elements.stayType?.value === 'Long Stay';
    if (mouField) mouField.hidden = !longStay;
    if (!mouSelect) return;
    mouSelect.required = longStay;
    mouSelect.disabled = !longStay;
    if (longStay && mouSelect.options.length <= 1) {
      const response = await listMous({ status: 'active' });
      const mous = response.data || [];
      mouSelect.innerHTML = mous.length
        ? `<option value="">Select an active MOU</option>${mous.map((mou) => `<option value="${mou._id}">${mou.partyName} (${mou.mouType}) - ${mou.rateCurrency} ${Number(mou.rateAmount).toLocaleString()} / ${mou.ratePeriod === 'per_month' ? 'month' : 'year'}</option>`).join('')}`
        : '<option value="">No active MOUs available</option>';
    }
  };
  form.elements.stayType?.addEventListener('change', () => updateMouVisibility().catch(() => {}));
  updateMouVisibility().catch(() => {});
}

export function setupDateInputs(arrivalInput, departureInput) {
  const minDate = todayISODate();
  arrivalInput.min = minDate;
  departureInput.min = minDate;

  const updateStayDateLimits = () => {
    if (!arrivalInput.value) return;
    departureInput.min = arrivalInput.value;
    if (arrivalInput.form?.elements.stayType?.value === 'Long Stay') {
      departureInput.removeAttribute('max');
    } else {
      const maximum = new Date(`${arrivalInput.value}T00:00:00`);
      maximum.setDate(maximum.getDate() + 21);
      departureInput.max = maximum.toISOString().slice(0, 10);
    }
  };

  arrivalInput.addEventListener('change', () => {
    updateStayDateLimits();
  });
  arrivalInput.form?.elements.stayType?.addEventListener('change', () => {
    updateStayDateLimits();
  });
}

export function readBookingFormValues(form) {
  const values = getFormValues(form);
  values.driverPickup = Boolean(form.elements.driverPickup?.checked);
  return values;
}

export function buildBookingPayload(values) {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    phone: values.phone,
    organisation: values.organisation || '',
    gender: values.gender,
    contractType: values.contractType || '',
    kenyaOffice: values.kenyaOffice || '',
    internationalCountry: values.internationalCountry || '',
    reasonForVisit: values.reasonForVisit || '',
    arrivalDate: values.arrivalDate,
    departureDate: values.departureDate,
    driverPickup: values.driverPickup,
    departureCountry: values.departureCountry || '',
    remarks: values.remarks || '',
    campId: values.campId,
    blockId: values.blockId,
    roomId: values.roomId,
    stayType: values.stayType,
    mouId: values.mouId || undefined,
  };
}

export function populateGuestFields(form, booking) {
  const guest = booking.guest || booking;
  form.elements.firstName.value = guest.firstName || booking.firstName || '';
  form.elements.lastName.value = guest.lastName || booking.lastName || '';
  form.elements.email.value = guest.email || booking.email || '';
  form.elements.phone.value = guest.phone || booking.phone || '';
  form.elements.organisation.value = guest.organisation || booking.organisation || '';
  form.elements.gender.value = guest.gender || booking.gender || '';
  form.elements.contractType.value = guest.contractType || booking.contractType || '';
  form.elements.kenyaOffice.value = guest.kenyaOffice || booking.kenyaOffice || '';
  form.elements.internationalCountry.value = guest.internationalCountry || booking.internationalCountry || '';
  form.elements.reasonForVisit.value = booking.reasonForVisit || '';
  form.elements.arrivalDate.value = sliceDate(booking.arrivalDate);
  form.elements.departureDate.value = sliceDate(booking.departureDate);
  if (form.elements.mouId) form.elements.mouId.value = booking.mou?._id || booking.mou || '';
  form.elements.driverPickup.checked = Boolean(booking.driverPickup);
  const departureCountry = guest.departureCountry || booking.departureCountry || '';
  form.elements.departureCountry.value = departureCountry === 'Kenya' || departureCountry === 'Kenyan'
    ? 'Local (Kenyan)'
    : departureCountry;
  form.elements.remarks.value = booking.remarks || '';
  form.elements.contractType?.dispatchEvent(new Event('change'));
  form.elements.departureCountry?.dispatchEvent(new Event('change'));
}

export function validateBookingForm(form, values, { requireLocation = true } = {}) {
  const { valid, errors } = validateGuestFields(values, { requireLocation });
  applyFieldErrors(form, errors);
  return valid;
}

export function renderBookingPriceSummary(container, {
  stayType = '',
  appliedRate = null,
  currency = 'KES',
  arrivalDate = '',
  departureDate = '',
  appliedAtBooking = false,
  emptyMessage = 'Select camp, stay type, and dates to view estimated price.',
} = {}) {
  if (!container) return;

  if (!stayType || appliedRate == null) {
    container.innerHTML = `<p class="form-hint mb-0">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  const pricing = calculateBookingTotal(arrivalDate, departureDate, appliedRate);
  const rateLabel = appliedAtBooking ? 'Applied rate' : 'Rate';

  if (!pricing) {
    container.innerHTML = `<p class="form-hint mb-0">${escapeHtml(stayType)} ${rateLabel.toLowerCase()}: ${escapeHtml(formatMoney(appliedRate, currency))}. Select arrival and departure dates to see the total.</p>`;
    return;
  }

  container.innerHTML = `
    <div class="price-summary">
      <p class="price-summary-title">Estimated price</p>
      <dl class="detail-list">
        <div><dt>Stay type</dt><dd>${escapeHtml(stayType)}</dd></div>
        <div><dt>${escapeHtml(rateLabel)}</dt><dd>${escapeHtml(formatMoney(appliedRate, currency))}</dd></div>
        <div><dt>Nights</dt><dd>${pricing.nights}</dd></div>
        <div><dt>Total</dt><dd><strong class="price-summary-total">${escapeHtml(formatMoney(pricing.total, currency))}</strong></dd></div>
      </dl>
    </div>
  `;
}

export function wireCampSelectors(form, { priceSummaryEl, rateDisplay, onReady }) {
  const summaryEl = priceSummaryEl || rateDisplay;

  function updatePriceSummary() {
    if (!summaryEl) return;

    const campId = form.elements.campId?.value;
    const stayType = form.elements.stayType?.value;
    const arrivalDate = form.elements.arrivalDate?.value;
    const departureDate = form.elements.departureDate?.value;

    if (!campId || !stayType) {
      renderBookingPriceSummary(summaryEl);
      return;
    }

    const appliedRate = selectors.getAppliedRate();
    if (appliedRate == null) {
      renderBookingPriceSummary(summaryEl, {
        emptyMessage: 'No rate configured for this camp and stay type.',
      });
      return;
    }

    renderBookingPriceSummary(summaryEl, {
      stayType,
      appliedRate,
      currency: selectors.getCurrency(),
      arrivalDate,
      departureDate,
    });
  }

  const selectors = createCampSelectors({
    campSelect: form.elements.campId,
    blockSelect: form.elements.blockId,
    roomSelect: form.elements.roomId,
    stayTypeSelect: form.elements.stayType,
    arrivalInput: form.elements.arrivalDate,
    departureInput: form.elements.departureDate,
    onRateChange: () => updatePriceSummary(),
  });

  const availabilityDisplay = form.querySelector('[data-room-availability]');
  form.elements.roomId?.addEventListener('change', () => {
    if (!availabilityDisplay) return;
    const room = selectors.getSelectedRoom?.();
    if (!room) {
      availabilityDisplay.textContent = 'Select a room to see capacity and occupancy.';
      return;
    }
    const capacity = room.capacity ?? '—';
    const occupancy = room.currentOccupancy ?? room.occupancy ?? room.occupiedBeds ?? 0;
    availabilityDisplay.textContent = `Capacity ${capacity} · Current occupancy ${occupancy}`;
  });

  form.elements.arrivalDate?.addEventListener('change', updatePriceSummary);
  form.elements.departureDate?.addEventListener('change', updatePriceSummary);

  selectors.updatePriceSummary = updatePriceSummary;

  onReady?.(selectors);
  updatePriceSummary();
  return selectors;
}

export function resolveBookingIds(booking) {
  return {
    campId: booking.campId || booking.camp?._id || booking.camp?.id || booking.camp,
    blockId: booking.blockId || booking.block?._id || booking.block?.id || booking.block,
    roomId: booking.roomId || booking.room?._id || booking.room?.id || booking.room,
    stayType: booking.stayType || '',
  };
}
