import { login } from '../api/auth.js';
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

function normalizeLoginUrl() {
  const url = new URL(window.location.href);
  if (url.pathname.endsWith('/admin/login.html')) {
    url.pathname = url.pathname.replace(/\/admin\/login\.html$/, '/admin/login');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }
}

normalizeLoginUrl();

if (isAuthenticated()) {
  window.location.href = '/';
}

const form = document.getElementById('login-form');
const submitBtn = document.getElementById('login-submit');
const openLoginButton = document.getElementById('open-login-form');
const successOverlay = document.getElementById('login-success');
const successTitle = document.getElementById('login-success-title');
const authStatus = document.getElementById('login-auth-status');
let loginRequestActive = false;

function finishLogin(user, token) {
  setSession(token, user);
  if (user.mustChangePassword) {
    showToast('Your password was reset. Please change it now.', 'info');
    window.location.href = 'change-password.html';
    return;
  }
  showToast('Signed in successfully.', 'success');
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');
    window.location.href = redirect && redirect.startsWith('/admin/')
      ? redirect
      : '/';
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
    loginRequestActive = false;
  }
});

applyBrandLogos();
