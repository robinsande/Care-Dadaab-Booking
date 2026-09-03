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
      showToast('Signed in successfully.', 'success');
      navigate('#/dashboard');
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Unable to sign in.', 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

if (!window.__SPA_DEFER_INIT__) init();
export async function refresh() {}
