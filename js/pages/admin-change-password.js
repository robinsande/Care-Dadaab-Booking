import { changePassword } from '../api/auth.js';
import { ApiError } from '../api/client.js';
import { requireAuth } from '../auth/session.js';
import { initAdminShell } from '../components/shell.js';
import { setButtonLoading } from '../components/loading.js';
import { showToast } from '../components/toast.js';
import { applyFieldErrors, getFormValues, validateFields } from '../utils/validation.js';

const form = document.getElementById('change-password-form');
const submitBtn = document.getElementById('change-password-submit');

function boot() {
  form.addEventListener('submit', onSubmit);
}

async function onSubmit(event) {
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

const user = requireAuth();
if (user) {
  initAdminShell();
  boot();
}
