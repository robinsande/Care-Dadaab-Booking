import { navigate } from '../spa-main.js';
import { login } from '../../api/auth.js';
import { ApiError } from '../../api/client.js';
import { applyBrandLogos } from '../../config.js';
import { isAuthenticated, setSession } from '../../auth/session.js';
import { setButtonLoading } from '../../components/loading.js';
import { showToast } from '../../components/toast.js';
import { applyFieldErrors, getFormValues, validateFields } from '../../utils/validation.js';

function normalizeLoginUrl() {
  const url = new URL(window.location.href);
  if (url.pathname.endsWith('/admin/login.html')) {
    url.pathname = url.pathname.replace(/\/admin\/login\.html$/, '/admin/login');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }
}

normalizeLoginUrl();

const idMap = { email: 'login-email', password: 'login-password' };
const orig = document.getElementById.bind(document);
const $ = (id) => orig(idMap[id] || id);

let initialized = false;
let loginRequestActive = false;

export function reset() {
  const form = $('login-form');
  const openLoginButton = document.getElementById('spa-open-login-form');
  const mfaSubmit = document.getElementById('spa-mfa-submit');
  const successOverlay = document.getElementById('spa-login-success');
  const authStatus = document.getElementById('spa-login-auth-status');
  const mfaPanel = document.getElementById('spa-mfa-panel');
  const mfaCode = document.getElementById('spa-mfa-code');
  const mfaQrCode = document.getElementById('spa-mfa-qr-code');
  const mfaManualKey = document.getElementById('spa-mfa-manual-key');
  const mfaInstructions = document.getElementById('spa-mfa-instructions');
  const mfaQrDone = document.getElementById('spa-mfa-qr-done');
  const mfaCodeLabel = document.getElementById('spa-mfa-code-label');

  if (form) {
    form.reset();
    form.hidden = false;
    form.classList.remove('login-form-reveal');
  }
  if (mfaPanel) mfaPanel.hidden = true;
  if (mfaQrCode) mfaQrCode.hidden = true;
  if (mfaManualKey) mfaManualKey.hidden = true;
  if (mfaQrDone) mfaQrDone.hidden = true;
  if (mfaCodeLabel) mfaCodeLabel.hidden = true;
  if (mfaCode) mfaCode.hidden = true;
  if (mfaSubmit) mfaSubmit.hidden = true;
  if (openLoginButton) {
    openLoginButton.hidden = false;
    openLoginButton.setAttribute('aria-expanded', 'false');
  }
  if (successOverlay) {
    successOverlay.hidden = true;
    successOverlay.classList.remove('care-auth-verified');
  }
  if (authStatus) authStatus.textContent = 'Scanning CARE identity';
}

export async function init() {
  if (initialized) return;
  initialized = true;
  applyBrandLogos();

  const form = $('login-form');
  const submitBtn = $('login-submit');
  const openLoginButton = document.getElementById('spa-open-login-form');
  const successOverlay = document.getElementById('spa-login-success');
  const successTitle = document.getElementById('spa-login-success-title');
  const authStatus = document.getElementById('spa-login-auth-status');
  });

  const finishLogin = (user, token) => {
    setSession(token, user);
    if (user.mustChangePassword) {
      showToast('Your password was reset. Please change it now.', 'info');
      navigate('#/change-password');
      return;
    }
    showToast('Signed in successfully.', 'success');
      const redirect = window.sessionStorage.getItem('cams.loginRedirect');
      window.sessionStorage.removeItem('cams.loginRedirect');
      navigate(redirect && redirect.startsWith('#/') ? redirect : '#/dashboard');
  };

  openLoginButton?.addEventListener('click', () => {
    form.hidden = false;
    form.classList.add('login-form-reveal');
    openLoginButton.hidden = true;
    openLoginButton.setAttribute('aria-expanded', 'true');
    $('login-email')?.focus();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (loginRequestActive) return;
    const values = getFormValues(form);
    const { valid, errors } = validateFields(values, {
      email: { required: true, email: true, label: 'Email' },
      password: { required: true, label: 'Password' },
    });
    applyFieldErrors(form, errors);
    if (!valid) return;

    loginRequestActive = true;
    try {
      setButtonLoading(submitBtn, true, 'Signing in...');
      const response = await login(values.email, values.password);
      const data = response.data || response;
      if (!data.token || !data.user) throw new ApiError('Login succeeded but session data was incomplete.');
      finishLogin(data.user, data.token);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Unable to sign in.', 'error');
    } finally {
      setButtonLoading(submitBtn, false);
      loginRequestActive = false;
    }
  });

}

if (!window.__SPA_DEFER_INIT__) init();
export async function refresh() {}
