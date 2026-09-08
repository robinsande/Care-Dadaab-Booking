import { login, verifyMfa } from '../api/auth.js';
import { ApiError } from '../api/client.js';
import { applyBrandLogos } from '../config.js';
import { isAuthenticated, setSession } from '../auth/session.js';
import { setButtonLoading } from '../components/loading.js';
import { showToast } from '../components/toast.js';
import {
  applyFieldErrors,
  getFormValues,
  validateFields,
} from '../utils/validation.js';

if (isAuthenticated()) {
  window.location.href = '/';
}

const form = document.getElementById('login-form');
const submitBtn = document.getElementById('login-submit');
const openLoginButton = document.getElementById('open-login-form');
const successOverlay = document.getElementById('login-success');
const successTitle = document.getElementById('login-success-title');
const authStatus = document.getElementById('login-auth-status');
const mfaPanel = document.getElementById('mfa-panel');
const mfaSubmit = document.getElementById('mfa-submit');
const mfaCode = document.getElementById('mfa-code');
const mfaQrCode = document.getElementById('mfa-qr-code');
const mfaManualKey = document.getElementById('mfa-manual-key');
const mfaInstructions = document.getElementById('mfa-instructions');
const mfaQrDone = document.getElementById('mfa-qr-done');
const mfaCodeLabel = document.getElementById('mfa-code-label');
let mfaState = null;

function showCodeEntry() {
  mfaQrCode.hidden = true;
  mfaManualKey.hidden = true;
  mfaQrDone.hidden = true;
  mfaCodeLabel.hidden = false;
  mfaCode.hidden = false;
  mfaSubmit.hidden = false;
  mfaInstructions.textContent = 'QR code scanned. Enter the six-digit code from Microsoft Authenticator.';
  mfaCode.focus();
}

function finishLogin(user, token) {
  setSession(token, user);
  if (user.mustChangePassword) {
    showToast('Your password was reset. Please change it now.', 'info');
    window.location.href = 'change-password.html';
    return;
  }
  showToast('Signed in successfully.', 'success');
  successTitle.textContent = `Welcome, ${user.firstName || 'back'}`;
  successOverlay.hidden = false;
  authStatus.textContent = 'Scanning CARE identity';
  window.setTimeout(() => { authStatus.textContent = 'Verifying secure access'; }, 700);
  window.setTimeout(() => {
    authStatus.textContent = 'CARE identity verified';
    successOverlay.classList.add('care-auth-verified');
  }, 1450);
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');
  window.setTimeout(() => {
    window.location.href = redirect && redirect.startsWith('/admin/')
      ? redirect
      : '/';
  }, 2600);
}

openLoginButton?.addEventListener('click', () => {
  form.hidden = false;
  form.classList.add('login-form-reveal');
  openLoginButton.hidden = true;
  openLoginButton.setAttribute('aria-expanded', 'true');
  form.querySelector('#email')?.focus();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = getFormValues(form);

  const { valid, errors } = validateFields(values, {
    email: { required: true, email: true, label: 'Email' },
    password: { required: true, label: 'Password' },
  });

  applyFieldErrors(form, errors);
  if (!valid) return;

  setButtonLoading(submitBtn, true, 'Signing in…');

  try {
    const response = await login(values.email, values.password);
    const data = response.data || response;
    if (data.mfaRequired) {
      mfaState = data;
      form.hidden = true;
      mfaPanel.hidden = false;
      if (data.mfaSetupRequired) {
        mfaQrCode.src = data.qrCodeDataUrl;
        mfaQrCode.hidden = false;
        mfaManualKey.textContent = `Can't scan? Use this key: ${data.manualKey}`;
        mfaManualKey.hidden = false;
        mfaQrDone.hidden = false;
        mfaCodeLabel.hidden = true;
        mfaCode.hidden = true;
        mfaSubmit.hidden = true;
        mfaInstructions.textContent = 'Scan this QR code in Microsoft Authenticator, then confirm below.';
      } else {
        mfaQrCode.hidden = true;
        mfaManualKey.hidden = true;
        mfaQrDone.hidden = true;
        mfaCodeLabel.hidden = false;
        mfaCode.hidden = false;
        mfaSubmit.hidden = false;
        mfaInstructions.textContent = 'Open Microsoft Authenticator and enter the current six-digit code.';
        mfaCode.focus();
      }
      return;
    }
    const token = data.token;
    const user = data.user;
    if (!token || !user) {
      throw new ApiError('Login succeeded but session data was incomplete.');
    }
    finishLogin(user, token);
  } catch (error) {
    showToast(
      error instanceof ApiError ? error.message : 'Unable to sign in.',
      'error',
    );
  } finally {
    setButtonLoading(submitBtn, false);
  }
});

mfaQrDone.addEventListener('click', showCodeEntry);

mfaSubmit.addEventListener('click', async () => {
  if (!mfaState || !/^\d{6}$/.test(mfaCode.value.trim())) {
    showToast('Enter the six-digit Microsoft Authenticator code.', 'error');
    return;
  }
  setButtonLoading(mfaSubmit, true, 'Verifying…');
  try {
    const response = await verifyMfa(mfaState.mfaToken, mfaCode.value.trim());
    const data = response.data || response;
    if (!data.token || !data.user) throw new ApiError('Verification response was incomplete.');
    finishLogin(data.user, data.token);
  } catch (error) {
    showToast(error instanceof ApiError ? error.message : 'Unable to verify code.', 'error');
  } finally {
    setButtonLoading(mfaSubmit, false);
  }
});

applyBrandLogos();
