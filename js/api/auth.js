import { api } from './client.js?v=20260922-2';
import { config } from '../config.js';

export function wakeBackend() {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);
  return fetch(`${config.API_BASE_URL}/health`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: controller.signal,
  }).catch(() => null).finally(() => window.clearTimeout(timeoutId));
}

export function login(email, password) {
  return api.post('/auth/login', { email, password }, { auth: false });
}

export function verifyMfa(mfaToken, code) {
  return api.post('/auth/mfa/verify', { mfaToken, code }, { auth: false });
}

export function getCurrentUser() {
  return api.get('/auth/me');
}

export function changePassword(currentPassword, newPassword) {
  return api.patch('/auth/change-password', { currentPassword, newPassword });
}

// Note: the backend is stateless (JWT). Signing out is handled client-side by
// clearing the stored session in js/auth/session.js; there is no /auth/logout
// endpoint to call.
