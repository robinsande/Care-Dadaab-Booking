import { api } from './client.js';

export function listUsers(params = {}) {
  return api.get('/users', { query: params });
}

export function createUser(payload) {
  return api.post('/users', payload);
}

export function updateUser(id, payload) {
  return api.put(`/users/${id}`, payload);
}

/**
 * Deactivate a user. The backend soft-deletes (sets isActive=false) so audit
 * history stays intact; the account is never hard-removed.
 */
export function deactivateUser(id) {
  return api.delete(`/users/${id}`);
}

/** Reactivate a previously deactivated user. */
export function reactivateUser(id) {
  return api.put(`/users/${id}`, { isActive: true });
}
