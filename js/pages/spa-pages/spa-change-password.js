import { changePassword } from '../../api/auth.js';
import { ApiError } from '../../api/client.js';
import { setButtonLoading } from '../../components/loading.js';
import { showToast } from '../../components/toast.js';
import { applyFieldErrors, getFormValues, validateFields } from '../../utils/validation.js';

let initialized = false;

export async function init() {
  if (initialized) return;
  initialized = true;

  const form = document.getElementById('change-password-form');
  const submitBtn = document.getElementById('change-password-submit');

  form.addEventListener('submit', (event) => onSubmit(event, form, submitBtn));
}

async function onSubmit(event, form, submitBtn) {
  event.preventDefault();
  const values = getFormValues(form);

  const { valid, errors } = validateFields(values, {
    currentPassword: { required: true, label: 'Current Password' },
    newPassword: {
      required: true,
      label: 'New Password',
      custom: (value) => (String(value).length >= 8 ? null : 'Password must be at least 8 characters.'),
    },
    confirmPassword: {
      required: true,
      label: 'Confirm New Password',
      custom: (value) => (value === values.newPassword ? null : 'Passwords do not match.'),
    },
  });

  applyFieldErrors(form, errors);
  if (!valid) return;

  setButtonLoading(submitBtn, true, 'Updating…');
  try {
    await changePassword(values.currentPassword, values.newPassword);
    showToast('Password updated.', 'success');
    form.reset();
  } catch (error) {
    showToast(
      error instanceof ApiError ? error.message : 'Unable to update password.',
      'error',
    );
  } finally {
    setButtonLoading(submitBtn, false);
  }
}
