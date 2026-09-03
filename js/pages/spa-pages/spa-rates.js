import { listCamps } from '../../api/camps.js';
import { getCampRates, createCampRate } from '../../api/rates.js';
import { ApiError } from '../../api/client.js';
import { withLoading, setButtonLoading } from '../../components/loading.js';
import { showToast } from '../../components/toast.js';
import { fillSelect } from '../../utils/constants.js';
import { formatMoney } from '../../utils/format.js';
import { applyFieldErrors, getFormValues, validateFields } from '../../utils/validation.js';

let initialized = false;

function parseRatesList(data) {
  if (Array.isArray(data)) return data;
  if (data?.rates && Array.isArray(data.rates)) return data.rates;
  return [];
}

function rateForStayType(ratesList, stayType) {
  const entry = ratesList.find((r) => r.stayType === stayType);
  return entry?.rate || entry;
}

export async function init() {
  if (initialized) return;
  initialized = true;

  const campSelect = document.getElementById('rt-camp-select');
  const form = document.getElementById('rates-form');
  const submitBtn = document.getElementById('rates-submit');
  const currentRatesEl = document.getElementById('rt-current-rates');

  campSelect.addEventListener('change', () => loadRates(campSelect, form, currentRatesEl));
  form.addEventListener('submit', (e) => onSave(e, campSelect, form, submitBtn, currentRatesEl));
  loadCamps(campSelect);
}

async function loadCamps(campSelect) {
  try {
    const response = await listCamps();
    const camps = response.data?.camps || response.data?.items || response.data || [];
    fillSelect(
      campSelect,
      (Array.isArray(camps) ? camps : []).map((c) => ({
        value: c._id || c.id,
        label: c.name,
      })),
      { placeholder: 'Select camp' },
    );
  } catch {
    showToast('Unable to load camps.', 'error');
  }
}

async function loadRates(campSelect, form, currentRatesEl) {
  const campId = campSelect.value;
  if (!campId) {
    form.hidden = true;
    currentRatesEl.textContent = 'Select a camp to view and edit rates.';
    return;
  }

  form.hidden = false;
  try {
    const response = await withLoading(() => getCampRates(campId), 'Loading rates…');
    const ratesList = parseRatesList(response.data);

    const shortRate = rateForStayType(ratesList, 'Short Stay');
    const longRate = rateForStayType(ratesList, 'Long Stay');
    const currency = shortRate?.currency || longRate?.currency || 'KES';

    form.elements.currency.value = currency;
    form.elements.shortStayRate.value = shortRate?.amount ?? '';
    form.elements.longStayRate.value = longRate?.amount ?? '';

    currentRatesEl.innerHTML = `
      Short Stay: ${formatMoney(shortRate?.amount, currency)}
      · Long Stay: ${formatMoney(longRate?.amount, currency)}
    `;
  } catch (error) {
    showToast(error instanceof ApiError ? error.message : 'Unable to load rates.', 'error');
  }
}

async function onSave(event, campSelect, form, submitBtn, currentRatesEl) {
  event.preventDefault();
  const campId = campSelect.value;
  if (!campId) return;

  const values = getFormValues(form);
  values.shortStayRate = values.shortStayRate === '' ? '' : Number(values.shortStayRate);
  values.longStayRate = values.longStayRate === '' ? '' : Number(values.longStayRate);

  const { valid, errors } = validateFields(values, {
    shortStayRate: {
      required: true,
      label: 'Short Stay Rate',
      custom: (v) => (Number(v) >= 0 ? null : 'Rate must be zero or greater.'),
    },
    longStayRate: {
      required: true,
      label: 'Long Stay Rate',
      custom: (v) => (Number(v) >= 0 ? null : 'Rate must be zero or greater.'),
    },
  });

  applyFieldErrors(form, errors);
  if (!valid) return;

  const currency = values.currency || 'KES';

  setButtonLoading(submitBtn, true, 'Saving…');
  try {
    await createCampRate(campId, {
      stayType: 'Short Stay',
      amount: Number(values.shortStayRate),
      currency,
    });
    await createCampRate(campId, {
      stayType: 'Long Stay',
      amount: Number(values.longStayRate),
      currency,
    });
    showToast('Rates updated successfully.', 'success');
    loadRates(campSelect, form, currentRatesEl);
  } catch (error) {
    showToast(error instanceof ApiError ? error.message : 'Unable to update rates.', 'error');
  } finally {
    setButtonLoading(submitBtn, false);
  }
}
