import { navigate } from '../spa-main.js';
import { login } from '../../api/auth.js';
import { ApiError } from '../../api/client.js';
import { applyBrandLogos } from '../../config.js';
import { isAuthenticated, setSession } from '../../auth/session.js';
import { setButtonLoading } from '../../components/loading.js';
import { showToast } from '../../components/toast.js';
import { applyFieldErrors, getFormValues, validateFields } from '../../utils/validation.js';

const idMap = { email: 'login-email', password: 'login-password' };
const orig = document.getElementById.bind(document);
const $ = (id) => orig(idMap[id] || id);

let initialized = false;

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

  openLoginButton?.addEventListener('click', () => {
    form.hidden = false;
    form.classList.add('login-form-reveal');
    openLoginButton.hidden = true;
    openLoginButton.setAttribute('aria-expanded', 'true');
    $('login-email')?.focus();
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
      const token = response.data?.token || response.token;
      const user = response.data?.user || response.user;
      if (!token || !user) throw new ApiError('Login succeeded but session data was incomplete.');
      setSession(token, user);
      if (user.mustChangePassword) {
        showToast('Your password was reset. Please change it now.', 'info');
        navigate('#/change-password');
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
      window.setTimeout(() => navigate('#/dashboard'), 2600);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Unable to sign in.', 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

if (!window.__SPA_DEFER_INIT__) init();
export async function refresh() {}
