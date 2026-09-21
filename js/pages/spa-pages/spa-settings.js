import { getSettings, updateSettings } from '../../api/settings.js';
import { ApiError } from '../../api/client.js';
import { withLoading, setButtonLoading } from '../../components/loading.js';
import { showToast } from '../../components/toast.js';
import {
  applyFieldErrors,
  getFormValues,
  isBlank,
  isValidEmail,
  validateFields,
} from '../../utils/validation.js';

let initialized = false;

export async function init() {
  if (initialized) return;
  initialized = true;

  const form = document.getElementById('settings-form');
  const submitBtn = document.getElementById('settings-submit');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = getFormValues(form);

    const { valid, errors } = validateFields(values, {
      supportEmail: {
        label: 'Support Email',
        custom: (value) =>
          isBlank(value) || isValidEmail(value) ? null : 'Enter a valid email address.',
      },
      mpesaTill: { required: true, label: 'M-Pesa Till Number' },
    });

    applyFieldErrors(form, errors);
    if (!valid) return;

    setButtonLoading(submitBtn, true, 'Saving…');
    try {
      await updateSettings({
        facilityName: values.facilityName || '',
        supportEmail: values.supportEmail || '',
        supportPhone: values.supportPhone || '',
        payment: {
          mpesaTillNumber: values.mpesaTill,
          mpesaPaybillNumber: values.mpesaTill,
        },
      });
      showToast('Settings saved successfully.', 'success');
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Unable to save settings.', 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  loadSettings();
}

export async function refresh() {
  await loadSettings();
}

async function loadSettings() {
  try {
    const response = await withLoading(() => getSettings(), 'Loading settings…');
    const settings = response.data?.settings || response.data || {};
    const payment = settings.payment || {};

    const form = document.getElementById('settings-form');
    form.elements.facilityName.value = settings.facilityName || '';
    form.elements.supportEmail.value = settings.supportEmail || '';
    form.elements.supportPhone.value = settings.supportPhone || '';
    form.elements.mpesaTill.value = payment.mpesaTillNumber || payment.mpesaPaybillNumber || '';
  } catch (error) {
    showToast(error instanceof ApiError ? error.message : 'Unable to load settings.', 'error');
  }
}
