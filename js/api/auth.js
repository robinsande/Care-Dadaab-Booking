import { api } from './client.js';

export function login(email, password) {
  return api.post('/auth/login', { email, password }, { auth: false });
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
